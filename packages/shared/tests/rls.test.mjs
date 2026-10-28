import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { legacyProfileSchema as profileSchema, professionalProfileSchema, serviceCategorySchema, bookingSchema } from "../src/schemas.ts";

test("initial migration enforces grants, RLS and constraints in PostgreSQL", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const c1 = "10000000-0000-4000-8000-000000000001";
  const c2 = "10000000-0000-4000-8000-000000000002";
  const p1 = "10000000-0000-4000-8000-000000000003";
  const p2 = "10000000-0000-4000-8000-000000000004";
  const cat = "20000000-0000-4000-8000-000000000001";
  // Local Supabase Auth contract stub. No cloud or actual user accounts are involved.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users(id) values ('${c1}');
  `);
  await db.exec(await readFile(new URL("../supabase/migrations/01_initial_schema.sql", import.meta.url), "utf8"));
  // The test intentionally applies migration 01 only, then adds nullable columns
  // introduced by later Hero onboarding migrations so current row schemas can be checked.
  await db.exec(`alter table public.professional_profiles
    add column trade_code text,
    add column trade_category text,
    add column operational_zone text,
    add column citizenship_document_path text,
    add column suspended_at timestamptz`);
  await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $4), ($2, $4), ($3, $4)", [c2, p1, p2, { role: "admin" }]);
  assert.deepEqual((await db.query("select distinct role from public.profiles")).rows, [{ role: "customer" }]);
  await db.exec(`
    update public.profiles set role = 'professional' where id in ('${p1}', '${p2}');
    insert into public.professional_profiles(profile_id, verification_status) values ('${p1}', 'verified'), ('${p2}', 'pending');
    insert into public.service_categories(id, name, slug) values ('${cat}', 'Plumbing', 'plumbing');
    insert into public.bookings(customer_id, professional_id, category_id, status, service_address, scheduled_at) values
      ('${c1}', null, '${cat}', 'requested', 'Address one', now()),
      ('${c2}', '${p1}', '${cat}', 'accepted', 'Address two', now()),
      ('${c2}', '${p2}', '${cat}', 'completed', 'Address three', now()),
      ('${c2}', null, '${cat}', 'cancelled', 'Address four', now());
  `);

  const as = async (role, user, action) => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
    await db.exec(`set role ${role}`);
    try { return await action(); } finally { await db.exec("reset role"); }
  };
  const denied = (sql, params = [], code = "42501") => assert.rejects(db.query(sql, params), (error) => error.code === code);
  const states = async () => (await db.query("select status from public.bookings order by status::text")).rows.map((r) => r.status);

  await t.test("real database JSON rows match exported schemas", async () => {
    for (const [table, schema] of [["profiles", profileSchema], ["professional_profiles", professionalProfileSchema], ["service_categories", serviceCategorySchema], ["bookings", bookingSchema]]) {
      for (const { data } of (await db.query(`select row_to_json(t) as data from public.${table} t`)).rows) schema.parse(data);
    }
  });

  await t.test("anonymous visitors can read categories only", () => as("anon", null, async () => {
    assert.equal((await db.query("select * from public.service_categories")).rows.length, 1);
    await denied("select * from public.profiles");
    await denied("select * from public.bookings");
    await denied("insert into public.service_categories(name, slug) values ('Other', 'other')");
  }));

  await t.test("customer ownership and privilege escalation protections", () => as("authenticated", c1, async () => {
    assert.equal((await db.query("select * from public.profiles")).rows.length, 1);
    assert.deepEqual(await states(), ["requested"]);
    assert.equal((await db.query("update public.profiles set full_name = 'Owner' where id = $1 returning id", [c1])).rows.length, 1);
    assert.equal((await db.query("update public.profiles set full_name = 'Intruder' where id = $1 returning id", [c2])).rows.length, 0);
    await denied("update public.profiles set role = 'admin' where id = $1", [c1]);
    await denied("delete from public.profiles where id = $1", [c1]);
    await denied("insert into public.profiles(id, role) values ($1, 'admin')", [c1]);
    await denied("update public.bookings set status = 'completed' where customer_id = $1", [c1]);
    await denied("delete from public.bookings where customer_id = $1", [c1]);
  }));

  await t.test("verified professionals see their assignments and open requests", () => as("authenticated", p1, async () => {
    assert.deepEqual(await states(), ["accepted", "requested"]);
    assert.equal((await db.query("select * from public.professional_profiles")).rows.length, 1);
    await denied("update public.professional_profiles set verification_status = 'verified'");
    await denied("insert into public.bookings(customer_id, category_id, service_address, scheduled_at) values ($1, $2, 'Address', now())", [p1, cat]);
  }));

  await t.test("pending professionals see only existing assignments", () => as("authenticated", p2, async () => {
    assert.deepEqual(await states(), ["completed"]);
  }));

  await t.test("customers can create requests but cannot forge owner, assignment, price, or status", () => as("authenticated", c1, async () => {
    const sql = "insert into public.bookings(customer_id, category_id, service_address, scheduled_at) values ($1, $2, 'Address', now()) returning *";
    const created = (await db.query(sql, [c1, cat])).rows[0];
    assert.equal(created.status, "requested");
    assert.equal(created.professional_id, null);
    assert.equal(created.total_price_paisa, null);
    await denied(sql, [c2, cat]);
    await denied("insert into public.bookings(customer_id, category_id, service_address, scheduled_at, total_price_paisa) values ($1, $2, 'Address', now(), 1)", [c1, cat]);
    await denied("insert into public.bookings(customer_id, category_id, service_address, scheduled_at, professional_id) values ($1, $2, 'Address', now(), $3)", [c1, cat, p1]);
    await denied("insert into public.bookings(customer_id, category_id, service_address, scheduled_at, status) values ($1, $2, 'Address', now(), 'completed')", [c1, cat]);
  }));

  await t.test("database constraints reject invalid records even through trusted writes", async () => {
    await denied("update public.professional_profiles set rating = 5.01", [], "23514");
    await denied("update public.professional_profiles set hourly_rate_paisa = -1", [], "23514");
    await denied("update public.bookings set total_price_paisa = -1", [], "23514");
    await denied("update public.bookings set status = 'completed' where professional_id is null", [], "23514");
    await denied("insert into public.service_categories(name, slug) values ('Duplicate', 'plumbing')", [], "23505");
    await denied("insert into public.bookings(customer_id, category_id, service_address, scheduled_at) values ($1, $2, 'Address', now())", [c1, c1], "23503");
  });

  await t.test("signup migration allowlists roles and never self-verifies professionals", async () => {
    await db.exec(await readFile(new URL("../supabase/migrations/02_auth_signup_roles.sql", import.meta.url), "utf8"));
    const newPro = "10000000-0000-4000-8000-000000000005";
    const malicious = "10000000-0000-4000-8000-000000000006";
    const newCustomer = "10000000-0000-4000-8000-000000000007";
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $2)", [newPro, { full_name: "  Professional Name  ", requested_role: "professional", role: "admin", verification_status: "verified", rating: 5 }]);
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $2)", [malicious, { requested_role: "admin", role: "admin" }]);
    await db.query("insert into auth.users(id, raw_user_meta_data) values ($1, $2)", [newCustomer, { requested_role: "customer", full_name: "Customer" }]);
    assert.deepEqual((await db.query("select full_name, role from public.profiles where id = $1", [newPro])).rows[0], { full_name: "Professional Name", role: "professional" });
    assert.deepEqual((await db.query("select verification_status, rating from public.professional_profiles where profile_id = $1", [newPro])).rows[0], { verification_status: "pending", rating: "0.00" });
    assert.equal((await db.query("select role from public.profiles where id = $1", [malicious])).rows[0].role, "customer");
    assert.equal((await db.query("select count(*)::int as count from public.professional_profiles where profile_id = $1", [newCustomer])).rows[0].count, 0);
    await db.query("update auth.users set raw_user_meta_data = $1 where id = $2", [{ requested_role: "admin" }, newPro]);
    assert.equal((await db.query("select role from public.profiles where id = $1", [newPro])).rows[0].role, "professional");
    assert.equal((await db.query("select role from public.profiles where id = $1", [c1])).rows[0].role, "customer");
    await as("authenticated", newPro, async () => {
      assert.deepEqual(await states(), []);
      await denied("update public.profiles set role = 'admin' where id = $1", [newPro]);
      await denied("update public.professional_profiles set verification_status = 'verified' where profile_id = $1", [newPro]);
    });
  });
});

