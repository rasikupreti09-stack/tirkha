import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { createPhoneAuth, phoneSchema, phoneOtpSchema } from "../src/phone-auth.ts";
import { profileSchema, profileUpdateSchema } from "../src/schemas.ts";
import { createPilotFixture } from "./pilot-fixture.mjs";

test("phone helpers validate inputs and allow signup roles without admin escalation", async () => {
  const calls=[];
  const auth=createPhoneAuth({auth:{signInWithOtp:async input=>{calls.push(input);return {error:null};},verifyOtp:async input=>{calls.push(input);return {error:null};}}});
  await auth.signInWithPhone("+9779800000001");
  assert.equal(calls[0].options.shouldCreateUser,false);
  await auth.signInWithPhone("+9779800000001",{full_name:"Test Customer",role:"customer"});
  assert.deepEqual(calls[1].options.data,{full_name:"Test Customer",requested_role:"customer"});
  await auth.verifyPhoneOtp("+9779800000001","123456");
  assert.equal(calls[2].type,"sms");
  for(const phone of ["9800000001","+919800000001","+977980000000","+9779800000001;123"]) assert.equal(phoneSchema.safeParse(phone).success,false);
  for(const code of ["12345","1234567","abcdef"]) assert.equal(phoneOtpSchema.safeParse(code).success,false);
  await assert.rejects(auth.signInWithPhone("+9779800000001",{full_name:"Test Admin",role:"admin"}));
  assert.equal(profileSchema.safeParse({id:randomUUID(),full_name:null,phone_number:null,avatar_url:null,role:"customer",created_at:new Date().toISOString()}).success,false);
  assert.equal(profileUpdateSchema.safeParse({phone:"+9779800000001"}).success,false);
  assert.equal(profileUpdateSchema.safeParse({phone_number:"+9779800000001"}).success,false);
});

test("profiles require verified, unique Auth phones; metadata cannot change roles or contacts", async t => {
  const fixture=await createPilotFixture();t.after(()=>fixture.db.close());
  const {db,as,admin}=fixture, id=randomUUID();
  await db.query("insert into auth.users(id,raw_user_meta_data,phone,phone_confirmed_at) values($1,$2,$3,null)",[id,{full_name:"New Professional",requested_role:"professional",phone:"+9779800000999"},"9779800000001"]);
  assert.equal((await db.query("select * from public.profiles where id=$1",[id])).rows.length,0);
  await db.query("update auth.users set phone_confirmed_at=now() where id=$1",[id]);
  const profile=(await db.query("select * from public.profiles where id=$1",[id])).rows[0];
  assert.equal(profile.phone,"+9779800000001");assert.equal(profile.role,"professional");
  assert.equal((await db.query("select verification_status from public.professional_profiles where profile_id=$1",[id])).rows[0].verification_status,"pending");
  await assert.rejects(db.query("insert into auth.users(id,raw_user_meta_data,phone) values($1,'{}',$2)",[randomUUID(),"9779800000001"]),/unique|duplicate/i);
  await db.query("update auth.users set raw_user_meta_data='{\"requested_role\":\"admin\"}',phone='9779800000002' where id=$1",[id]);
  assert.equal((await db.query("select role from public.profiles where id=$1",[id])).rows[0].role,"professional");
  await assert.rejects(db.query("update auth.users set phone_confirmed_at=null where id=$1",[id]),/retain a verified phone/);
  await as(id);
  await assert.rejects(db.query("update public.profiles set phone='+9779800000003' where id=$1",[id]),/permission/i);
  await assert.rejects(db.query("update public.profiles set phone_number='+9779800000003' where id=$1",[id]),/permission/i);
  await admin();
});


test("phone migration refuses unverified legacy profiles without applying partial changes", async t => {
  const db=new PGlite();t.after(()=>db.close());
  await db.exec("create schema auth; create table auth.users(id uuid,phone text,phone_confirmed_at timestamptz,email text,email_confirmed_at timestamptz); create table public.profiles(id uuid primary key);");
  const id=randomUUID();
  await db.query("insert into auth.users(id) values($1)",[id]);
  await db.query("insert into public.profiles(id) values($1)",[id]);
  const sql=await readFile(new URL("../supabase/migrations/11_phone_auth.sql",import.meta.url),"utf8");
  await assert.rejects(db.exec(sql),/existing profiles need a verified/);
  await db.exec("rollback");
  assert.equal((await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='profiles'")).rows.length,1);
  assert.equal((await db.query("select id from public.profiles")).rows[0].id,id);
});

