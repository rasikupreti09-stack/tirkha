import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPilotFixture } from "./pilot-fixture.mjs";

test("diagnostic booking dispatches a private live alert only to nearby verified on-duty category Heroes", async (t) => {
  const fixture = await createPilotFixture();
  t.after(() => fixture.db.close());
  const { db, ids, admin, as } = fixture;
  const nearby = ids.professional;
  const far = randomUUID();
  const customer = ids.customer;
  await admin();
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4),($5,$6)", [far, { requested_role: "professional", full_name: "Far Hero" }, customer, { requested_role: "customer", full_name: "Test Customer" }, nearby, { requested_role: "professional", full_name: "Nearby Hero" }]);
  await db.query("update public.professional_profiles set verification_status='verified' where profile_id=any($1::uuid[])", [[nearby, far]]);
  const category = (await db.query("select id from public.service_categories where slug='plumbing'")).rows[0].id;
  await db.query("insert into public.professional_service_categories values($1,$2),($3,$2)", [nearby, category, far]);
  const installLocation = async (id, latitude, longitude) => {
    await as(id);
    await db.query("select public.update_hero_location($1,$2,null,null,null,null)", [latitude, longitude]);
  };
  await installLocation(nearby, 27.7000, 85.3200);
  await installLocation(far, 27.9500, 85.3200);

  await as(customer);
  const requestId = randomUUID();
  const booking = (await db.query(`select row_to_json(b) data from public.create_diagnostic_booking_request(
    $1,$2,null,$3,$4,$5,60,$6,$7,$8,$9,$10,$11,$12
  ) b`, [requestId, category, "Kathmandu, Ward 10, near Baneshwor", "AI triage: tap leak; inspect before work.", new Date(Date.now() + 86400000).toISOString(), 27.7010, 85.3210, "New Baneshwor, Kathmandu", "Tap leak: customer reports water below sink; cause not confirmed.", "Getting worse", "soon", ["Tap washer or cartridge (inspect first)"]])).rows[0].data;
  assert.equal(booking.status, "requested");
  assert.deepEqual(booking.suggested_parts, ["Tap washer or cartridge (inspect first)"]);

  await as(nearby);
  assert.equal((await db.query("select * from public.bookings where id=$1", [booking.id])).rows.length, 1);
  const inbox = await db.query("select * from public.hero_dispatch_notifications where booking_id=$1", [booking.id]);
  assert.equal(inbox.rows.length, 1);
  assert.equal(inbox.rows[0].professional_id, nearby);
  assert.equal(inbox.rows[0].diagnostic_urgency, "soon");
  assert.equal(inbox.rows[0].diagnostic_severity, "Getting worse");
  assert.equal(inbox.rows[0].service_address, booking.service_address);
  assert.ok(inbox.rows[0].distance_meters <= 20000);

  await as(far);
  assert.equal((await db.query("select * from public.hero_dispatch_notifications where booking_id=$1", [booking.id])).rows.length, 0);
  assert.equal((await db.query("select * from public.bookings where id=$1", [booking.id])).rows.length, 0);
  await admin();
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [ids.outsider, { requested_role: "professional", full_name: "Unverified" }]);
  await as(ids.outsider);
  assert.equal((await db.query("select * from public.hero_dispatch_notifications where booking_id=$1", [booking.id])).rows.length, 0);

  await as(nearby);
  await db.query("select public.transition_booking($1,'accepted')", [booking.id]);
  assert.equal((await db.query("select status from public.hero_dispatch_notifications where booking_id=$1", [booking.id])).rows[0].status, "accepted");
});
