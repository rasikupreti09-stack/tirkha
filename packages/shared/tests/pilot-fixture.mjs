import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Ephemeral PostgreSQL only: never connects to or seeds a hosted project.
export async function createPilotFixture() {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create schema auth;
      create schema realtime;
      create table realtime.messages(id uuid default gen_random_uuid(), topic text not null);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as 'select current_setting(''realtime.topic'',true)';
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text);
      create function storage.foldername(object_name text) returns text[] language sql immutable as $$
        select case
          when position('/' in object_name) = 0 then array[]::text[]
          else string_to_array(regexp_replace(object_name, '/[^/]*$', ''), '/')
        end;
      $$;
      alter table storage.objects enable row level security;
      create sequence auth.test_phone_seq start 9800000001;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb,
        phone text default ('977' || nextval('auth.test_phone_seq')::text),
        phone_confirmed_at timestamptz default now(), email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
      grant usage on schema auth to authenticated;
      grant usage on schema realtime, storage to authenticated;
      grant select,insert on realtime.messages to authenticated;
      grant select,insert on storage.objects to authenticated;
      grant select on storage.buckets to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant execute on function realtime.topic() to authenticated;
      create publication supabase_realtime;`);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const file of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) await db.exec(await readFile(new URL(file, directory), "utf8"));
    await db.exec(await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
    const ids = { customer: randomUUID(), professional: randomUUID(), outsider: randomUUID(), pending: randomUUID(), admin: randomUUID() };
    async function as(user, role = "authenticated") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || ""]);
      await db.exec("set role " + ({ authenticated: "authenticated", service_role: "service_role", anon: "anon" }[role]));
    }
    async function prepareVerifiedHero(profileId, zone = "Kathmandu") {
      await db.query(`update public.professional_profiles
        set verification_status='verified', trade_code='PLUMBING', trade_category='PLUMBING',
            operational_zone=$2, citizenship_document_path=profile_id::text || '/test-id.pdf',
            hourly_rate_paisa=12550
        where profile_id=$1`, [profileId, zone]);
    }
    return { db, ids, as, prepareVerifiedHero, async admin() { await db.exec("reset role"); } };
  } catch (error) { await db.close(); throw error; }
}

