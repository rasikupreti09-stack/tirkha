import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { reverseGeocode, nepalAreaFromNominatim } from "../src/geocoding.ts";
import { bookingRequestSchema, locationPreferenceSchema, workflowBookingSchema } from "../src/schemas.ts";
import { createPilotFixture } from "./pilot-fixture.mjs";

test("reverse geocoding uses area-level Nepal labels and identifies the app", async () => {
  const data = { address: { country_code: "np", suburb: "Baneshwor", city: "Kathmandu", road: "Private lane", house_number: "123" } };
  assert.equal(nepalAreaFromNominatim(data), "Baneshwor, Kathmandu");
  assert.equal(nepalAreaFromNominatim({ address: { country_code: "np", village: "Balthali", municipality: "Panauti" } }), "Balthali, Panauti");
  assert.equal(nepalAreaFromNominatim({ address: { country_code: "np", suburb: "Pokhara", city: "Pokhara" } }), "Pokhara");
  for (const bad of [null, {}, { address: { country_code: "np" } }, { address: { country_code: "in", city: "Delhi" } }]) assert.throws(() => nepalAreaFromNominatim(bad));
  let called = 0;
  const options = { userAgent: "Tirkha/unit-test", fetcher: async (url, init) => {
    called++;
    assert.equal(url.origin, "https://nominatim.openstreetmap.org");
    assert.equal(url.searchParams.get("lat"), "27.69");
    assert.equal(url.searchParams.get("lon"), "85.34");
    assert.equal(url.searchParams.get("zoom"), "14");
    assert.equal(init.headers["User-Agent"], "Tirkha/unit-test");
    return Response.json(data);
  } };
  assert.equal(await reverseGeocode(27.69,85.34,options), "Baneshwor, Kathmandu");
  for (const [lat,lon] of [[NaN,85],[91,85],[27,Infinity],[27,-181]]) await assert.rejects(reverseGeocode(lat,lon,options), /valid latitude/);
  assert.equal(called,1);
  await assert.rejects(reverseGeocode(27,85,{ ...options, userAgent: "" }), /identifier/);
  await assert.rejects(reverseGeocode(27,85,{ ...options, fetcher: async () => new Response(null,{status:429}) }), /busy/);
  await assert.rejects(reverseGeocode(27,85,{ ...options, fetcher: async () => Response.json({error:"Unable to geocode"}) }), /No area/);
});

test("saved pins round-trip; incomplete coordinates and orphan labels are rejected", () => {
  const pin = { latitude:27.69,longitude:85.34,resolved_address:"Baneshwor, Kathmandu" };
  const location = { municipality:"Kathmandu",landmark:"Baneshwor chowk",map_pin:pin };
  assert.deepEqual(locationPreferenceSchema.parse(JSON.parse(JSON.stringify(location))),location);
  const request = { request_id:randomUUID(),category_id:randomUUID(),professional_id:null,service_address:"Near Baneshwor chowk",job_details:"Please repair the kitchen tap",scheduled_at:new Date(Date.now()+86400000).toISOString(),duration_minutes:60 };
  assert.equal(bookingRequestSchema.safeParse({...request,...pin}).success,true);
  for (const extra of [{latitude:27.69},{longitude:85.34},{resolved_address:"Baneshwor"},{...pin,latitude:Infinity}]) assert.equal(bookingRequestSchema.safeParse({...request,...extra}).success,false);
  assert.equal(bookingRequestSchema.safeParse(request).success,true);
});

test("migration 07 persists pins, protects retries, and enforces a private global geocoder gate", async (t) => {
  const { db, ids, as, admin } = await createPilotFixture(); t.after(()=>db.close());
  await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[ids.customer,{full_name:"Map customer",requested_role:"customer"}]);
  const category=(await db.query("select id from public.service_categories where slug='plumbing'")).rows[0].id;
  const args=[randomUUID(),category,null,"Baneshwor, Kathmandu, near chowk","Please repair the kitchen tap",new Date(Date.now()+86400000).toISOString(),60,27.69,85.34,"Baneshwor, Kathmandu"];
  const create=async(values)=>(await db.query("select row_to_json(b) data from public.create_booking_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) b",values)).rows[0].data;
  await as(ids.customer);
  const booking=workflowBookingSchema.parse(await create(args));
  assert.equal(booking.latitude,27.69); assert.equal(booking.longitude,85.34); assert.equal(booking.resolved_address,"Baneshwor, Kathmandu");
  assert.equal((await create(args)).id,booking.id);
  for(const [index,value] of [[7,27.7],[8,85.35],[9,"Different area"]]) {
    const changed=[...args];changed[index]=value;await assert.rejects(create(changed),/REQUEST_ID_REUSED/);
  }
  for(const [lat,lon,area] of [[null,85,null],[27,null,null],[91,85,null],[27,181,null],[null,null,"No pin"]]) {
    const invalid=[...args];invalid[0]=randomUUID();invalid[7]=lat;invalid[8]=lon;invalid[9]=area;
    await assert.rejects(create(invalid),/check constraint/);
  }
  const manual=[...args];manual[0]=randomUUID();manual[7]=manual[8]=manual[9]=null;
  assert.equal((await create(manual)).latitude,null);
  await assert.rejects(db.query("select public.claim_geocoding($1)",[randomUUID()]),/permission denied/);
  await assert.rejects(db.query("select * from public.geocoding_cache"),/permission denied/);
  await as(null,"service_role");
  const lease=randomUUID(), other=randomUUID();
  const claim=async(id)=>(await db.query("select public.claim_geocoding($1) ok",[id])).rows[0].ok;
  assert.equal(await claim(lease),true);assert.equal(await claim(other),false);
  await db.query("select public.release_geocoding($1)",[other]);assert.equal(await claim(other),false);
  await db.query("select public.release_geocoding($1)",[lease]);assert.equal(await claim(other),false);
  assert.ok((await db.query("select extract(epoch from next_allowed_at-clock_timestamp()) seconds from public.geocoding_gate")).rows[0].seconds > 0);
  await admin();await db.exec("update public.geocoding_gate set next_allowed_at=clock_timestamp()-interval '1 second'");
  await as(null,"service_role");assert.equal(await claim(other),true);
  await db.query("insert into public.geocoding_cache values($1,$2,now()+interval '7 days')",["test-cell","Baneshwor, Kathmandu"]);
  await as(null,"anon");await assert.rejects(db.query("select * from public.geocoding_cache"),/permission denied/);
});

