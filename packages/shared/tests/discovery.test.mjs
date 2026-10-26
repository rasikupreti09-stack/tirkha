import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { formatNpr, hourlyRateLabel } from "../src/discovery.ts";
import { locationPreferenceSchema, publicProfessionalSchema } from "../src/schemas.ts";

test("NPR prices preserve paisa and distinguish zero from unknown", () => {
  assert.equal(formatNpr(12550), "NPR 125.50");
  assert.equal(formatNpr(100000), "NPR 1,000.00");
  assert.equal(hourlyRateLabel(0), "NPR 0.00 / hour");
  assert.equal(hourlyRateLabel(null), "Price on request");
  assert.equal(formatNpr(1), "NPR 0.01");
  for (const value of [-1, 1.5, Infinity, NaN, 2_147_483_648]) assert.throws(() => formatNpr(value));
});
test("Nepal location preferences support free text and optional wards", () => {
  assert.deepEqual(locationPreferenceSchema.parse({ municipality: "  Lalitpur ", landmark: " Patan Dhoka ", ward: "4" }),
    { municipality: "Lalitpur", landmark: "Patan Dhoka", ward: "4" });
  locationPreferenceSchema.parse({ municipality: "Dhulikhel", landmark: "Near the bus park" });
  locationPreferenceSchema.parse({ municipality: "काठमाडौं", landmark: "बौद्ध", ward: "" });
  for (const ward of ["0", "-1", "1.5", "100", "abc"]) {
    assert.equal(locationPreferenceSchema.safeParse({ municipality: "Lalitpur", landmark: "Patan", ward }).success, false);
  }
  assert.equal(locationPreferenceSchema.safeParse({ municipality: " ", landmark: " " }).success, false);
});
test("discovery seed and public RPC enforce category, role and verification boundaries", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  `);
  for (const migration of ["01_initial_schema.sql", "02_auth_signup_roles.sql", "03_service_discovery.sql"]) {
    await db.exec(await readFile(new URL("../supabase/migrations/" + migration, import.meta.url), "utf8"));
  }
  const seed = await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8");
  await db.exec(seed);
  const categories = (await db.query("select id, slug from public.service_categories order by slug")).rows;
  await db.exec(seed);
  assert.deepEqual((await db.query("select id, slug from public.service_categories order by slug")).rows, categories);
  assert.equal(categories.length, 5);
  const plumbing = categories.find((item) => item.slug === "plumbing").id;
  const electrical = categories.find((item) => item.slug === "electrical").id;
  const verified = "10000000-0000-4000-8000-000000000001";
  const pending = "10000000-0000-4000-8000-000000000002";
  const unrelated = "10000000-0000-4000-8000-000000000003";
  const customer = "10000000-0000-4000-8000-000000000004";
  for (const id of [verified, pending, unrelated]) {
    await db.query("insert into auth.users values ($1, $2)", [id, { requested_role: "professional", full_name: "Test professional" }]);
  }
  await db.query("insert into auth.users values ($1, $2)", [customer, { requested_role: "customer" }]);
  await db.query("insert into public.professional_profiles(profile_id, verification_status) values ($1, 'verified')", [customer]);
  await db.query("update public.professional_profiles set verification_status = 'verified', rating = 4.5, hourly_rate_paisa = 12550 where profile_id = any($1::uuid[])", [[verified, unrelated]]);
  await db.exec("update public.profiles set phone_number = 'PRIVATE_CONTACT'");
  for (const [professional, category] of [[verified, plumbing], [pending, plumbing], [unrelated, electrical], [customer, plumbing]]) {
    await db.query("insert into public.professional_service_categories values ($1, $2)", [professional, category]);
  }
  const directory = async (slug, limit = 12, offset = 0) => (await db.query(
    "select row_to_json(p) as data from public.list_verified_professionals($1, $2, $3) p", [slug, limit, offset],
  )).rows.map((row) => row.data);
  await db.exec("set role anon");
  const results = await directory("plumbing");
  assert.equal(results.length, 1);
  assert.equal(results[0].profile_id, verified);
  publicProfessionalSchema.parse(results[0]);
  assert.deepEqual(Object.keys(results[0]).sort(), ["bio", "full_name", "hourly_rate_paisa", "profile_id", "rating"]);
  assert.equal(JSON.stringify(results).includes("PRIVATE_CONTACT"), false);
  assert.equal((await directory("electrical"))[0].profile_id, unrelated);
  assert.deepEqual(await directory("missing-category"), []);
  assert.deepEqual(await directory("plumbing", 12, 1), []);
  assert.equal((await directory("plumbing", -1, -1)).length, 1);
  for (const table of ["profiles", "professional_profiles", "professional_service_categories"]) {
    await assert.rejects(db.query("select * from public." + table), (error) => error.code === "42501");
  }
  assert.equal((await db.query("select * from public.service_categories")).rows.length, 5);
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [pending]);
  await db.exec("set role authenticated");
  assert.equal((await db.query("select * from public.professional_service_categories")).rows.length, 1);
  await assert.rejects(db.query("insert into public.professional_service_categories values ($1, $2)", [pending, electrical]), (error) => error.code === "42501");
  assert.equal((await directory("plumbing")).length, 1);
  await db.exec("reset role");
  await db.query("update public.professional_profiles set verification_status = 'rejected' where profile_id = $1", [verified]);
  await db.exec("set role anon");
  assert.deepEqual(await directory("plumbing"), []);
  await db.exec("reset role");
});
