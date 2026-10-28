import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { startMockSupabase, MOCK_ANON_KEY } from "../scripts/mock-supabase.mjs";
const { createClient } = createRequire(new URL("../../../apps/web/package.json", import.meta.url))("@supabase/supabase-js");

test("local service works with the actual Supabase SDK: signup, sessions, profiles, browse and booking/chat RPCs", async (t) => {
  const mock=await startMockSupabase(0);t.after(()=>mock.close());
  const client=()=>createClient(mock.url,MOCK_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const customer=client(), professional=client(), newcomer=client();
  const result=await newcomer.auth.signUp({email:"new@tirkha.test",password:"ValidLocalPassword!",options:{data:{full_name:"New professional",requested_role:"professional"}}});
  assert.equal(result.error,null);assert.ok(result.data.session);
  const own=await newcomer.from("profiles").select("*").eq("id",result.data.user.id).single();assert.equal(own.error,null);assert.equal(own.data.role,"professional");
  const pp=await newcomer.from("professional_profiles").select("*").eq("profile_id",result.data.user.id).single();assert.equal(pp.error,null);assert.equal(pp.data.verification_status,"pending");
  const wrong=await customer.auth.signInWithPassword({email:"customer@tirkha.test",password:"wrong"});assert.equal(wrong.error.code,"invalid_credentials");
  for(const [sdk,email] of [[customer,"customer@tirkha.test"],[professional,"professional@tirkha.test"]]) assert.equal((await sdk.auth.signInWithPassword({email,password:"TirkhaLocal123!"})).error,null);
  assert.equal((await customer.auth.getUser()).data.user.id,mock.customer.id);
  assert.equal((await customer.auth.refreshSession()).error,null);
  const categories=await customer.from("service_categories").select("*").order("name");assert.equal(categories.data.length,17);
  const category=categories.data.find(row=>row.slug==="plumbing");
  const directory=await customer.rpc("list_verified_professionals",{p_category_slug:"plumbing",p_limit:12,p_offset:0});assert.equal(directory.error,null);assert.equal(directory.data[0].profile_id,mock.professional.id);
  const booking=await customer.rpc("create_booking_request",{p_request_id:randomUUID(),p_category_id:category.id,p_professional_id:mock.professional.id,p_service_address:"Lalitpur, near Patan Dhoka",p_job_details:"Please repair the leaking tap",p_scheduled_at:new Date(Date.now()+86400000).toISOString(),p_duration_minutes:60,p_latitude:27.6785,p_longitude:85.3184,p_resolved_address:"Patan, Lalitpur"}).single();
  assert.equal(booking.error,null);assert.equal(booking.data.status,"requested");assert.equal(booking.data.latitude,27.6785);assert.equal(booking.data.longitude,85.3184);assert.equal(booking.data.resolved_address,"Patan, Lalitpur");
  const location=await professional.rpc("update_hero_location",{p_latitude:27.6786,p_longitude:85.3185,p_heading:0});assert.equal(location.error,null);
  const diagnostic=await customer.rpc("create_diagnostic_booking_request",{p_request_id:randomUUID(),p_category_id:category.id,p_professional_id:null,p_service_address:"Lalitpur, Ward 4, near Patan Dhoka",p_job_details:"AI-assisted triage request for a leak",p_scheduled_at:new Date(Date.now()+2*86400000).toISOString(),p_duration_minutes:60,p_latitude:27.6787,p_longitude:85.3186,p_resolved_address:"Patan Dhoka, Lalitpur",p_diagnostic_summary:"Under-sink leak; source not confirmed.",p_diagnostic_severity:"Getting worse",p_diagnostic_urgency:"soon",p_suggested_parts:["Tap washer (inspect first)"]}).single();
  assert.equal(diagnostic.error,null);assert.equal(diagnostic.data.diagnostic_urgency,"soon");assert.deepEqual(diagnostic.data.suggested_parts,["Tap washer (inspect first)"]);
  const dispatch=await professional.from("hero_dispatch_notifications").select("*").eq("booking_id",diagnostic.data.id).single();assert.equal(dispatch.error,null);assert.equal(dispatch.data.service_address,diagnostic.data.service_address);assert.equal(dispatch.data.distance_meters<=20000,true);
  const cod=await customer.rpc("confirm_cod",{p_booking_id:booking.data.id}).single();assert.equal(cod.error,null);assert.equal(cod.data.method,"COD");assert.equal(cod.data.status,"confirmed");
  const receipt=await customer.from("booking_payments").select("*").eq("booking_id",booking.data.id).single();assert.equal(receipt.error,null);assert.equal(receipt.data.id,cod.data.id);
  const accepted=await professional.rpc("transition_booking",{p_booking_id:booking.data.id,p_action:"accepted"}).single();assert.equal(accepted.error,null);assert.equal(accepted.data.status,"accepted");assert.equal(accepted.data.checkout_status,"confirmed");
  const travelling=await professional.rpc("transition_booking",{p_booking_id:booking.data.id,p_action:"on_the_way"}).single();assert.equal(travelling.error,null);assert.equal(travelling.data.status,"on_the_way");
  const message=await customer.rpc("send_booking_message",{p_booking_id:booking.data.id,p_client_message_id:randomUUID(),p_body:"Use the side entrance."}).single();assert.equal(message.error,null);
  const messages=await professional.from("booking_messages").select("*").eq("booking_id",booking.data.id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(50);assert.equal(messages.error,null);assert.equal(messages.data[0].body,"Use the side entrance.");
  const outsider=await newcomer.from("booking_messages").select("*");assert.equal(outsider.data.length,0);
  const origin=await fetch(mock.url+"/health",{headers:{Origin:"https://external.example"}});assert.equal(origin.status,403);
  assert.equal((await customer.auth.signOut({scope:"local"})).error,null);
  assert.equal((await customer.auth.getSession()).data.session,null);
});

test("phone OTP SDK flow verifies a six-digit code, persists a session, and protects booking contacts", async t => {
  const mock=await startMockSupabase(0);t.after(()=>mock.close());
  const create=()=>createClient(mock.url,MOCK_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const customer=create(),professional=create(),outsider=create();
  for(const [sdk,phone] of [[customer,mock.customer.phone],[professional,mock.professional.phone],[outsider,"+9779600000099"]]) {
    const sent=await sdk.auth.signInWithOtp({phone,options:{shouldCreateUser:true,data:{full_name:"Phone Customer"}}});
    assert.equal(sent.error,null);
    const wrong=await sdk.auth.verifyOtp({phone,token:"000000",type:"sms"});assert.equal(wrong.error.code,"otp_expired");
    const verified=await sdk.auth.verifyOtp({phone,token:"123456",type:"sms"});assert.equal(verified.error,null);assert.ok(verified.data.session);
    const replay=await sdk.auth.verifyOtp({phone,token:"123456",type:"sms"});assert.equal(replay.error.code,"otp_expired");
    const own=await sdk.from("profiles").select("*").eq("id",verified.data.user.id).single();assert.equal(own.data.phone,phone);
  }
  const category=(await customer.from("service_categories").select("*").eq("slug","plumbing").single()).data.id;
  const booking=await customer.rpc("create_booking_request",{p_request_id:randomUUID(),p_category_id:category,p_professional_id:mock.professional.id,p_service_address:"Kathmandu, Baneshwor",p_job_details:"Fix the leaking tap",p_scheduled_at:new Date(Date.now()+86400000).toISOString(),p_duration_minutes:60}).single();
  assert.equal(booking.error,null);
  const contact=sdk=>sdk.rpc("get_booking_contact",{p_booking_id:booking.data.id});
  assert.equal((await contact(customer)).data[0].phone,mock.professional.phone);
  assert.equal((await professional.rpc("transition_booking",{p_booking_id:booking.data.id,p_action:"accepted"})).error,null);
  assert.equal((await contact(customer)).data[0].phone,mock.professional.phone);
  assert.equal((await contact(professional)).data[0].phone,mock.customer.phone);
  assert.deepEqual((await contact(outsider)).data,[]);
  assert.deepEqual((await contact(create())).data,null);
});

