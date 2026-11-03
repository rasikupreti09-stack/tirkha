import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPilotFixture } from "./pilot-fixture.mjs";

test("regional catalog fails closed and booking RPC rechecks availability", async (t) => {
  const { db, ids, as } = await createPilotFixture();
  t.after(() => db.close());
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [ids.customer, { requested_role: "customer", full_name: "Region customer" }]);
  await db.query(`insert into public.service_offerings(
    id,title,category_slug,category_name,icon,vertical,base_paisa,visit_paisa,duration_minutes,
    description,included,excluded,keywords,image,regions,active,sort_order
  ) values('future-service','Future plumbing service','plumbing','Plumbing','wrench','Home repairs',0,0,30,
    'New service awaiting regional approval',array[]::text[],array[]::text[],array[]::text[],'/images/plumbing.jpg',array[]::text[],true,99)`);
  const newOfferingAvailability = (await db.query(`select status from public.service_region_availability
    where service_offering_id='future-service' and service_region_id='hetauda'`)).rows[0];
  assert.equal(newOfferingAvailability.status, "coming_soon", "new services get an explicit closed row for each region");

  const catalog = async (region) => (await db.query(
    "select public.get_regional_service_catalog($1) as rows", [region],
  )).rows[0].rows;
  for (const region of ["Hetauda", "Simara", "Chitwan", "Jhapa", "Sunsari"]) {
    const rows = await catalog(region);
    assert.ok(rows.length > 0, `${region} should still show the catalog`);
    assert.ok(rows.every((row) => row.availability_status !== "available"), `${region} must fail closed`);
    assert.ok(rows.some((row) => row.service.id === "future-service" && row.availability_status === "coming_soon"), `${region} should show newly added services as coming soon`);
  }
  assert.ok((await catalog("Lalitpur")).some((row) => row.service.id === "sink-leak" && row.availability_status === "available"));
  assert.ok((await catalog("Pokhara")).some((row) => row.service.id === "sink-leak" && row.availability_status === "available"));

  const category = (await db.query("select id from public.service_categories where slug='plumbing'")).rows[0].id;
  const requestId = randomUUID();
  const makeBooking = (region, offering = "sink-leak") => db.query(`select * from public.create_diagnostic_booking_request(
    $1,$2,null,'Kathmandu, near Baneshwor','Repair the leaking kitchen tap',$3,60,
    null,null,null,null,null,null,'{}',$4,$5
  )`, [requestId, category, new Date(Date.now() + 86400000).toISOString(), region, offering]);

  await as(ids.customer);
  const booking = (await makeBooking("Kathmandu")).rows[0];
  assert.equal(booking.service_region_id, "kathmandu-valley");
  assert.equal(booking.service_offering_id,"sink-leak");
  await assert.rejects(makeBooking("Kathmandu","pipe-fitting"), /REQUEST_ID_REUSED/);
  await db.exec("reset role");
  await db.query("update public.service_region_availability set status='coming_soon' where service_offering_id='pipe-fitting' and service_region_id='kathmandu-valley'");
  await as(ids.customer);
  await assert.rejects(db.query(`select * from public.create_diagnostic_booking_request(
    $1,$2,null,'Kathmandu, Baneshwor','Fit a new pipe joint',$3,60,null,null,null,null,null,null,'{}','Kathmandu','pipe-fitting'
  )`, [randomUUID(), category, new Date(Date.now() + 86400000).toISOString()]), /SERVICE_NOT_AVAILABLE_IN_REGION/);
  await assert.rejects(makeBooking("Hetauda"), /REQUEST_ID_REUSED/);
  const astrology = (await db.query("select id from public.service_categories where slug='astrology'")).rows[0].id;
  await assert.rejects(db.query(`select * from public.create_diagnostic_booking_request(
    $1,$2,null,'Pokhara, Lakeside','Schedule an astrology consultation',$3,60,
    null,null,null,null,null,null,'{}','Pokhara','astrology-session'
  )`, [randomUUID(), astrology, new Date(Date.now() + 86400000).toISOString()]), /SERVICE_NOT_AVAILABLE_IN_REGION/);
  await assert.rejects(db.query(`select * from public.create_booking_request(
    $1,$2,null,'Kathmandu, Baneshwor','Repair the leaking tap',$3,60
  )`, [randomUUID(), category, new Date(Date.now() + 86400000).toISOString()]), /permission denied/);
});
