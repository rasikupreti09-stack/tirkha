import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPilotFixture } from "./pilot-fixture.mjs";
import { signUpSchema, signUpMetadata } from "../src/auth.ts";
import { locationPreferenceSchema, workflowBookingSchema, publicProfessionalSchema } from "../src/schemas.ts";
import { locationToAddress, defaultNepalSchedule, nepalDateTimeToIso } from "../src/booking-workflow.ts";
import { chatMessageSchema } from "../src/chat.ts";
import { khaltiLookupSchema, paymentSchema, safeKhaltiCheckoutUrl } from "../src/payments.ts";
import { supabaseSettings, khaltiSettings, expoProjectId, ConfigurationError } from "../src/environment.ts";

test("configuration diagnostics identify variables without exposing secret values", () => {
  const valid = { NEXT_PUBLIC_SUPABASE_URL: "https://pilot.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private-service-value", KHALTI_SECRET_KEY: "private-khalti-value", APP_URL: "https://tirkha.example" };
  for (const key of Object.keys(valid)) {
    assert.throws(() => khaltiSettings({ ...valid, [key]: undefined }), (error) => error instanceof ConfigurationError && error.message.includes(key) && !error.message.includes("private-"));
  }
  for (const prefix of ["NEXT_PUBLIC", "EXPO_PUBLIC"]) {
    assert.throws(() => supabaseSettings(undefined, "key", prefix), new RegExp(prefix + "_SUPABASE_URL"));
    assert.throws(() => supabaseSettings("https://pilot.supabase.co", undefined, prefix), new RegExp(prefix + "_SUPABASE_ANON_KEY"));
    assert.throws(() => supabaseSettings("https://YOUR_PROJECT_REF.supabase.co", "YOUR_KEY", prefix), /placeholder/);
  }
  assert.throws(() => khaltiSettings({ ...valid, APP_URL: "not-a-url" }), /APP_URL/);
  assert.throws(() => khaltiSettings({ ...valid, KHALTI_ENVIRONMENT: "production", APP_URL: "http://localhost:3000" }), /HTTPS/);
  for (const value of [undefined, "", "------------------------------------", "123"]) assert.throws(() => expoProjectId(value), /EAS_PROJECT_ID/);
  assert.equal(expoProjectId("10000000-0000-4000-8000-000000000001"), "10000000-0000-4000-8000-000000000001");
  assert.equal(khaltiSettings(valid).environment, "sandbox");
});

test("pilot journey across every migration: signup → browse → landmark → book → accept → chat → pay → complete", async (t) => {
  const fixture = await createPilotFixture();
  const { db, ids, as, admin, prepareVerifiedHero } = fixture;
  t.after(() => db.close());
  let category, booking, payment, message;
  const requestId = randomUUID(), attemptId = randomUUID(), nonce = randomUUID();
  const customerDevice = randomUUID(), proDevice = randomUUID();
  const schedule = defaultNepalSchedule();
  const createBooking = () => db.query("select row_to_json(b) data from public.create_booking_request($1,$2,$3,$4,$5,$6,$7) b", [requestId,category,ids.professional,"Lalitpur, Ward 4, Near Patan Dhoka","Repair the leaking kitchen tap",nepalDateTimeToIso(schedule.date,schedule.time),90]);
  const transition = async (status) => (await db.query("select row_to_json(b) data from public.transition_booking($1,$2) b", [booking.id,status])).rows[0].data;
  await t.test("signup provisions customer and pending professional without self-verification", async () => {
    for (const [name,id] of Object.entries(ids)) {
      const role = name === "customer" || name === "outsider" || name === "admin" ? "customer" : "professional";
      const input = signUpSchema.parse({ full_name: "Pilot " + name, email: name + "@example.test", password: "pilot-local-password", confirm_password: "pilot-local-password", role });
      await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[id,{...signUpMetadata(input),verification_status:"verified"}]);
    }
    await db.query("update public.profiles set role='admin' where id=$1", [ids.admin]);
    assert.equal((await db.query("select verification_status from public.professional_profiles where profile_id=$1",[ids.professional])).rows[0].verification_status,"pending");
    category=(await db.query("select id from public.service_categories where slug='plumbing'")).rows[0].id;
    await prepareVerifiedHero(ids.professional, "Lalitpur");
    await db.query("update public.professional_profiles set hourly_rate_paisa=12551 where profile_id=$1",[ids.professional]);
    await db.query("insert into public.professional_service_categories values($1,$2)",[ids.professional,category]);
  });
  await t.test("browse exposes only verified professionals; landmark selection round-trips",async()=>{
    await as(null,"anon");
    assert.equal((await db.query("select * from public.service_categories")).rows.length,17);
    const people=(await db.query("select row_to_json(p) data from public.list_verified_professionals('plumbing') p")).rows;
    assert.equal(people.length,1);publicProfessionalSchema.parse(people[0].data);
    const landmark=locationPreferenceSchema.parse(JSON.parse(JSON.stringify({municipality:"Lalitpur",ward:"4",landmark:"Patan Dhoka"})));
    assert.equal(locationToAddress(landmark),"Lalitpur, Ward 4, Near Patan Dhoka");
  });
  await t.test("registered devices receive durable booking alerts and requests are idempotent",async()=>{
    await as(ids.customer);await db.query("select public.register_push_device($1,$2)",["ExponentPushToken[pilot_customer]",customerDevice]);
    await as(ids.professional);await db.query("select public.register_push_device($1,$2)",["ExpoPushToken[pilot_professional]",proDevice]);
    await as(ids.customer);booking=(await createBooking()).rows[0].data;workflowBookingSchema.parse(booking);
    assert.equal(booking.total_price_paisa,18827);assert.equal(booking.status,"requested");
    assert.equal((await createBooking()).rows[0].data.id,booking.id);
    await admin();const queue=(await db.query("select * from public.push_outbox")).rows;
    assert.equal(queue.length,1);assert.equal(queue[0].recipient_id,ids.professional);
  });
  await t.test("acceptance and participant chat enforce access, replay safety and Realtime publication",async()=>{
    await as(ids.professional);booking=await transition("accepted");
    await as(ids.customer);
    const photoPath=`${booking.id}/site-photo.webp`;
    await db.query("insert into storage.objects(bucket_id,name,owner_id) values('booking-chat-images',$1,$2)",[photoPath,ids.customer]);
    const send=()=>db.query("select row_to_json(m) data from public.send_booking_message($1,$2,$3,$4) m",[booking.id,nonce,"Photo attachment",photoPath]);
    message=(await send()).rows[0].data;chatMessageSchema.parse(message);
    assert.equal(message.attachment_path,photoPath);
    assert.equal((await send()).rows[0].data.id,message.id);
    await as(ids.professional);assert.equal((await db.query("select * from public.booking_messages")).rows.length,1);
    await as(ids.outsider);assert.equal((await db.query("select * from public.booking_messages")).rows.length,0);
    assert.equal((await db.query("select * from storage.objects where name=$1",[photoPath])).rows.length,0);
    await assert.rejects(db.query("select public.send_booking_message($1,$2,'Not allowed')",[booking.id,randomUUID()]),/CHAT_UNAVAILABLE/);
    await assert.rejects(db.query("insert into public.booking_messages(booking_id,sender_id,client_message_id,body) values($1,$2,$3,'forged')",[booking.id,ids.customer,randomUUID()]),e=>e.code==="42501");
    await admin();const publications=(await db.query("select tablename from pg_publication_tables where pubname='supabase_realtime'")).rows.map(r=>r.tablename);
    assert.ok(publications.includes("booking_messages"));assert.ok(publications.includes("bookings"));
    assert.ok(publications.includes("professional_presence"));
    await as(ids.professional);await db.query("select public.update_professional_presence(27.7172,85.324)");
    await assert.rejects(db.query("select public.update_professional_presence(91,85)",[]),/VERIFIED_PROFESSIONAL_REQUIRED/);
    await as(ids.customer);assert.equal((await db.query("select * from public.professional_presence where professional_id=$1",[ids.professional])).rows.length,1);
    await as(ids.outsider);assert.equal((await db.query("select * from public.professional_presence where professional_id=$1",[ids.professional])).rows.length,0);
    await as(ids.admin);assert.equal((await db.query("select * from public.bookings where id=$1",[booking.id])).rows.length,1);
    assert.equal((await db.query("select * from public.professional_presence where professional_id=$1",[ids.professional])).rows.length,1);
    await as(ids.customer);
    await db.query("select set_config('realtime.topic',$1,false)",["booking-call:"+booking.id]);
    await db.query("insert into realtime.messages(topic) values($1)",["booking-call:"+booking.id]);
    await as(ids.outsider);await db.query("select set_config('realtime.topic',$1,false)",["booking-call:"+booking.id]);
    assert.equal((await db.query("select * from realtime.messages")).rows.length,0);
    await admin();
    assert.equal((await db.query("select * from public.push_outbox where kind='chat'")).rows.length,1);
  });
  await t.test("Khalti reservation is server-only, price-bound and safe to retry",async()=>{
    await as(ids.customer);
    await assert.rejects(db.query("select public.reserve_booking_payment($1,$2,$3,'sandbox')",[booking.id,ids.customer,attemptId]),e=>e.code==="42501");
    await as(null,"service_role");
    const reserve=async(id)=>(await db.query("select row_to_json(p) data from public.reserve_booking_payment($1,$2,$3,'sandbox') p",[booking.id,ids.customer,id])).rows[0].data;
    payment=await reserve(attemptId);paymentSchema.parse(payment);assert.equal(payment.amount_paisa,18827);
    assert.equal((await reserve(randomUUID())).id,payment.id);
    await db.query("select public.attach_khalti_checkout($1,$2,$3,$4)",[payment.id,"pilot-pidx",safeKhaltiCheckoutUrl("https://test-pay.khalti.com/?pidx=pilot-pidx"),new Date(Date.now()+3600000).toISOString()]);
    await assert.rejects(db.query("select public.record_khalti_lookup($1,'wrong-pidx',18827,'paid','tx')",[payment.id]),/PAYMENT_MISMATCH/);
    await assert.rejects(db.query("select public.record_khalti_lookup($1,'pilot-pidx',1,'paid','tx')",[payment.id]),/PAYMENT_MISMATCH/);
    await assert.rejects(db.query("select public.record_khalti_lookup($1,'pilot-pidx',18827,'paid',null)",[payment.id]),/PAYMENT_MISMATCH/);
  });
  await t.test("verified Khalti fixture becomes paid; late pending cannot erase payment",async()=>{
    // Deterministic provider response fixture, not a live Khalti charge.
    const lookup=khaltiLookupSchema.parse({pidx:"pilot-pidx",total_amount:18827,status:"Completed",transaction_id:"pilot-transaction",refunded:false});
    payment=(await db.query("select row_to_json(p) data from public.record_khalti_lookup($1,$2,$3,'paid',$4) p",[payment.id,lookup.pidx,lookup.total_amount,lookup.transaction_id])).rows[0].data;
    assert.equal(payment.status,"paid");
    assert.equal((await db.query("select status from public.record_khalti_lookup($1,'pilot-pidx',18827,'pending',null)",[payment.id])).rows[0].status,"paid");
    await as(ids.outsider);assert.equal((await db.query("select * from public.booking_payments")).rows.length,0);
    await as(ids.customer);assert.equal((await db.query("select status from public.booking_payments")).rows[0].status,"paid");
  });
  await t.test("completion closes chat, purges transient messages and preserves paid state",async()=>{
    await as(ids.professional);booking=await transition("on_the_way");booking=await transition("in_progress");booking=await transition("completed");
    assert.equal(booking.status,"completed");
    await assert.rejects(db.query("select public.send_booking_message($1,$2,'Another message')",[booking.id,randomUUID()]),/CHAT_CLOSED/);
    assert.equal((await db.query("select * from public.booking_messages")).rows.length,0);
    await as(ids.customer);await assert.rejects(transition("cancelled"),/REQUEST_NO_LONGER_PENDING/);
    assert.equal((await db.query("select status from public.booking_payments")).rows[0].status,"paid");
  });
  await t.test("completed COD work writes a single private 12.5% Hero commission ledger entry",async()=>{
    const codRequest=randomUUID(),codSchedule=new Date(Date.now()+3*86400000).toISOString();
    await as(ids.customer);
    const codBooking=(await db.query("select row_to_json(b) data from public.create_booking_request($1,$2,$3,$4,$5,$6,$7) b",[codRequest,category,ids.professional,"Kathmandu, New Baneshwor","Repair a leaking sink pipe",codSchedule,60])).rows[0].data;
    await db.query("select * from public.confirm_cod($1)",[codBooking.id]);
    await as(ids.professional);
    const move=async(action)=>(await db.query("select row_to_json(b) data from public.transition_booking($1,$2) b",[codBooking.id,action])).rows[0].data;
    await move("accepted");await move("on_the_way");await move("in_progress");await move("completed");
    const entries=(await db.query("select * from public.completed_transactions where booking_id=$1",[codBooking.id])).rows;
    assert.equal(entries.length,1);assert.equal(entries[0].gross_amount,"125.51");
    assert.equal(entries[0].commission_rate,"12.50");assert.equal(entries[0].company_income,"15.69");
    assert.equal(entries[0].hero_payout,"109.82");assert.equal(entries[0].payment_type,"CASH");
    await move("completed");assert.equal((await db.query("select count(*)::int count from public.completed_transactions where booking_id=$1",[codBooking.id])).rows[0].count,1);
    await as(ids.customer);assert.equal((await db.query("select * from public.completed_transactions where booking_id=$1",[codBooking.id])).rows.length,0);
    await assert.rejects(db.query("insert into public.completed_transactions(booking_id,\"timestamp\",hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type) values($1,now(),$2,'Hero','PLUMBING',100,12.5,12.5,87.5,'CASH')",[codBooking.id,ids.professional]),e=>e.code==="42501");
  });
  await t.test("outbox leases prevent duplicate claims and device revocation is private",async()=>{
    await as(ids.outsider);await assert.rejects(db.query("select * from public.push_devices"),e=>e.code==="42501");
    await assert.rejects(db.query("select * from public.push_outbox"),e=>e.code==="42501");
    await as(null,"service_role");const expectedClaimCount=Number((await db.query("select count(*)::int as count from public.push_outbox where state in ('queued','processing','receipt') and available_at<=now() and attempts<8")).rows[0].count);
    const claimed=(await db.query("select * from public.claim_push_jobs($1)",[randomUUID()])).rows;
    assert.equal(claimed.length,expectedClaimCount);assert.ok(claimed.length>0);assert.equal((await db.query("select * from public.claim_push_jobs($1)",[randomUUID()])).rows.length,0);
    await as(ids.customer);await db.query("select public.unregister_push_device($1)",[customerDevice]);
    await admin();assert.equal((await db.query("select * from public.push_devices where user_id=$1",[ids.customer])).rows.length,0);
  });
});

