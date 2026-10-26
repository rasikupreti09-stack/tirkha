import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPilotFixture } from "./pilot-fixture.mjs";
import { bookingActions, nextBookingStatus, transitionBookingStatus } from "../src/booking-workflow.ts";
import { canChat } from "../src/chat.ts";
import { workflowBookingSchema } from "../src/schemas.ts";

test("shared transition helpers order actions and call only the authenticated booking RPC", async () => {
  assert.deepEqual(["requested","accepted","on_the_way","in_progress","completed","cancelled"].map(nextBookingStatus),
    ["accepted","on_the_way","in_progress","completed",null,null]);
  const id=randomUUID();let calls=0;
  const client={rpc(name,args) { calls++;assert.equal(name,"transition_booking");assert.deepEqual(args,{p_booking_id:id,p_action:"on_the_way"});
    return {single:async()=>({data:{id,status:"on_the_way"},error:null})}; }};
  assert.equal((await transitionBookingStatus(client,id,"on_the_way")).status,"on_the_way");
  await assert.rejects(transitionBookingStatus(client,"bad-id","accepted"));
  await assert.rejects(transitionBookingStatus(client,id,"invented-status"));
  assert.equal(calls,1);
  const denied={message:"BOOKING_UNAVAILABLE"};
  await assert.rejects(transitionBookingStatus({rpc:()=>({single:async()=>({data:null,error:denied})})},id,"accepted"),error=>error===denied);
  assert.deepEqual(bookingActions({customer_id:randomUUID(),professional_id:id,status:"requested",scheduled_at:"2000-01-01T00:00:00Z"},id,"professional",true),[]);
});

test("hero location retention purges only GPS rows older than five minutes", async t => {
  const { db, admin } = await createPilotFixture(); t.after(() => db.close());
  const staleId = randomUUID(), freshId = randomUUID();
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4)", [
    staleId, { full_name: "Stale Hero", requested_role: "professional" },
    freshId, { full_name: "Active Hero", requested_role: "professional" },
  ]);
  await admin();
  await db.query(`insert into public.hero_locations(professional_id,latitude,longitude,status,updated_at)
    values($1,27.7,85.3,'online_idle',now()-interval '6 minutes'),
          ($2,27.7,85.3,'online_idle',now()-interval '4 minutes')`, [staleId, freshId]);

  const result = await db.query("select public.purge_stale_hero_locations() as purged");
  assert.equal(Number(result.rows[0].purged), 1);
  assert.equal((await db.query("select count(*)::int as count from public.hero_locations where professional_id=$1", [staleId])).rows[0].count, 0);
  assert.equal((await db.query("select count(*)::int as count from public.hero_locations where professional_id=$1", [freshId])).rows[0].count, 1);
  assert.equal((await db.query("select count(*)::int as count from public.profiles where id=any($1::uuid[])", [[staleId, freshId]])).rows[0].count, 2);
});

test("provider tracking enforces ordered transitions, ownership, retry safety, chat and push", async (t) => {
  const {db,ids,as,admin}=await createPilotFixture();t.after(()=>db.close());
  for(const [name,id] of Object.entries(ids)) await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[id,{full_name:name,requested_role:name==="customer"||name==="outsider"?"customer":"professional"}]);
  const category=(await db.query("select id from public.service_categories where slug='plumbing'")).rows[0].id;
  await db.query("update public.professional_profiles set verification_status='verified' where profile_id=$1",[ids.professional]);
  await db.query("insert into public.professional_service_categories values($1,$2)",[ids.professional,category]);
  await as(ids.customer);
  await db.query("select public.register_push_device($1,$2)",["ExponentPushToken[tracking_customer]",randomUUID()]);
  const create=async()=>(await db.query("select row_to_json(b) data from public.create_booking_request($1,$2,null,'Near Baneshwor chowk','Repair kitchen tap please',$3,60) b",[randomUUID(),category,new Date(Date.now()+86400000).toISOString()])).rows[0].data;
  let booking=await create();const overlap=await create();
  const transition=async(action,id=booking.id)=>(await db.query("select row_to_json(b) data from public.transition_booking($1,$2) b",[id,action])).rows[0].data;
  await assert.rejects(transition("on_the_way"),/VERIFIED_PROFESSIONAL_REQUIRED/);
  await as(ids.pending);await assert.rejects(transition("accepted"),/VERIFIED_PROFESSIONAL_REQUIRED/);
  await as(ids.professional);
  await assert.rejects(transition("on_the_way"),/INVALID_TRANSITION/);
  booking=await transition("accepted");
  assert.deepEqual(bookingActions(booking,ids.professional,"professional",true),["on_the_way"]);
  await assert.rejects(transition("in_progress"),/INVALID_TRANSITION/);
  booking=workflowBookingSchema.parse(await transition("on_the_way"));
  assert.equal(booking.status,"on_the_way");assert.equal((await transition("on_the_way")).id,booking.id);
  assert.deepEqual(bookingActions(booking,ids.professional,"professional",true),["in_progress"]);
  assert.equal(canChat(booking,ids.customer),true);
  await assert.rejects(transition("accepted",overlap.id),/SCHEDULE_CONFLICT/);
  await assert.rejects(transition("completed"),/INVALID_TRANSITION/);
  await as(ids.customer);
  const message=await db.query("select * from public.send_booking_message($1,$2,'See you at the gate')",[booking.id,randomUUID()]);
  assert.equal(message.rows.length,1);
  await assert.rejects(transition("cancelled"),/REQUEST_NO_LONGER_PENDING/);
  await assert.rejects(transition("in_progress"),/VERIFIED_PROFESSIONAL_REQUIRED/);
  await as(ids.outsider);assert.equal((await db.query("select * from public.bookings where id=$1",[booking.id])).rows.length,0);
  await as(ids.professional);
  booking=await transition("in_progress");booking=await transition("completed");
  assert.equal(booking.status,"completed");assert.equal(canChat(booking,ids.customer),false);
  await assert.rejects(transition("on_the_way"),/INVALID_TRANSITION/);
  await admin();
  assert.equal((await db.query("select * from public.booking_status_history where booking_id=$1 and to_status='on_the_way'",[booking.id])).rows.length,1);
  assert.equal((await db.query("select * from public.push_outbox where booking_id=$1 and booking_status='on_the_way' and recipient_id=$2",[booking.id,ids.customer])).rows.length,1);
});

