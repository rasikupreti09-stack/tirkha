import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { generateEsewaSignature, verifyEsewaCallback } from "../src/esewa-server.ts";
import { paisaToRupees, rupeesToPaisa, buildKhaltiInitiation, verifyKhaltiLookup, verifyEsewaLookup, buildPaymentReceipt, publicPaymentResponse, paymentSchema } from "../src/payments.ts";
import { createPilotFixture } from "./pilot-fixture.mjs";
const wire = row => JSON.parse(JSON.stringify(row));

test("eSewa signing and callbacks authenticate all mandatory fields and reject tampering", async () => {
  const secret="unit-test-only-secret", id=randomUUID();
  const input={total_amount:"123.45",transaction_uuid:id,product_code:"TEST"};
  const expected=createHmac("sha256",secret).update("total_amount=123.45,transaction_uuid="+id+",product_code=TEST").digest("base64");
  assert.equal(await generateEsewaSignature(input,secret),expected);
  const fields="transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";
  const payload={transaction_code:"receipt-123",status:"COMPLETE",total_amount:"123.45",transaction_uuid:id,product_code:"TEST",signed_field_names:fields};
  const sign=value=>({...value,signature:createHmac("sha256",secret).update(value.signed_field_names.split(",").map(key=>key+"="+value[key]).join(",")).digest("base64")});
  const encode=value=>Buffer.from(JSON.stringify(value)).toString("base64");
  const signed=sign(payload);
  assert.equal((await verifyEsewaCallback(encode(signed),secret)).transaction_uuid,id);
  for(const [key,value] of [["total_amount","1.00"],["transaction_uuid",randomUUID()],["status","PENDING"],["product_code","OTHER"]]) {
    await assert.rejects(verifyEsewaCallback(encode({...signed,[key]:value}),secret),/signature/);
  }
  await assert.rejects(verifyEsewaCallback(encode(sign({...payload,signed_field_names:"transaction_uuid,status"})),secret),/Unsigned/);
  await assert.rejects(verifyEsewaCallback(encode(signed),"wrong-secret"),/signature/);
  for(const encoded of ["%%%", "a".repeat(9000), Buffer.from("not-json").toString("base64")]) await assert.rejects(verifyEsewaCallback(encoded,secret));
});

test("gateway payloads preserve integer paisa and reject mismatched or unverified success", () => {
  assert.equal(paisaToRupees(12345),"123.45");assert.equal(rupeesToPaisa("1,234.50"),123450);
  for(const value of ["1.001","-1","1e3","1,23","21474836.48"]) assert.throws(()=>rupeesToPaisa(value));
  const input={amount:12345,purchase_order_id:randomUUID(),return_url:"https://merchant.example/callback",website_url:"https://merchant.example",purchase_order_name:"Tirkha booking"};
  assert.deepEqual(buildKhaltiInitiation(input),input);
  assert.throws(()=>buildKhaltiInitiation({...input,amount:1.5}));
  const lookup={pidx:"pidx",total_amount:12345,status:"Completed",transaction_id:"receipt",refunded:false};
  assert.equal(verifyKhaltiLookup(lookup,{pidx:"pidx",amount_paisa:12345}).status,"paid");
  for(const extra of [{pidx:"other"},{total_amount:1},{transaction_id:null},{refunded:true},{status:"Unknown"}]) assert.throws(()=>verifyKhaltiLookup({...lookup,...extra},{pidx:"pidx",amount_paisa:12345}));
  const esewa={transaction_uuid:"uuid",product_code:"TEST",total_amount:"123.45",status:"COMPLETE",ref_id:"receipt"};
  const expected={transaction_uuid:"uuid",product_code:"TEST",amount_paisa:12345,transaction_code:"receipt"};
  assert.equal(verifyEsewaLookup(esewa,expected).status,"paid");
  for(const extra of [{product_code:"OTHER"},{transaction_uuid:"other"},{total_amount:"12.34"},{ref_id:"wrong"}]) assert.throws(()=>verifyEsewaLookup({...esewa,...extra},expected));
  assert.equal(verifyEsewaLookup({...esewa,status:"NOT_FOUND",ref_id:null},{...expected,transaction_code:undefined}).status,"initiated");
});

test("payment methods enforce COD ownership, cross-gateway locks, server settlement and immutable job progress", async t => {
  const {db,ids,as,admin}=await createPilotFixture();t.after(()=>db.close());
  for(const id of [ids.customer,ids.outsider]) await db.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)",[id,{full_name:"Payment customer",requested_role:"customer"}]);
  const category=(await db.query("select id from public.service_categories limit 1")).rows[0].id;
  async function booking() {
    await as(ids.customer);
    const row=(await db.query("select * from public.create_booking_request($1,$2,null,'Near Baneshwor chowk','Repair a kitchen tap',$3,60)",[randomUUID(),category,new Date(Date.now()+86400000).toISOString()])).rows[0];
    await admin();await db.query("update public.bookings set total_price_paisa=12345 where id=$1",[row.id]);return row;
  }
  const cod=await booking();await as(ids.outsider);
  await assert.rejects(db.query("select * from public.confirm_cod($1)",[cod.id]),/BOOKING_UNAVAILABLE/);
  await as(ids.customer);
  const payment=paymentSchema.parse(wire((await db.query("select * from public.confirm_cod($1)",[cod.id])).rows[0]));
  assert.equal(payment.method,"COD");assert.equal(payment.status,"confirmed");
  assert.equal((await db.query("select * from public.confirm_cod($1)",[cod.id])).rows[0].id,payment.id);
  let row=(await db.query("select * from public.bookings where id=$1",[cod.id])).rows[0];
  assert.equal(row.status,"requested");assert.equal(row.checkout_status,"confirmed");assert.equal(row.payment_method,"COD");
  assert.match(buildPaymentReceipt(cod.id,publicPaymentResponse(payment).payment),/not proof of payment/);
  assert.match(buildPaymentReceipt(cod.id,publicPaymentResponse(payment).payment),/Labour subtotal: NPR 123[.]45/);
  assert.match(buildPaymentReceipt(cod.id,publicPaymentResponse(payment).payment),/Due on completion: NPR/);
  await db.query("select * from public.transition_booking($1,'cancelled')",[cod.id]);
  assert.equal((await db.query("select * from public.booking_payments where id=$1",[payment.id])).rows[0].status,"failed");
  const online=await booking();await as(null,"service_role");
  const reserve=method=>db.query("select * from public.reserve_gateway_payment($1,$2,$3,'sandbox',$4)",[online.id,ids.customer,randomUUID(),method]);
  const esewa=(await reserve("ESEWA")).rows[0];
  await assert.rejects(reserve("KHALTI"),/PAYMENT_METHOD_LOCKED/);
  const lookup=(amount,status,ref,method="ESEWA")=>db.query("select * from public.record_gateway_lookup($1,$2,$3,$4,$5,$6)",[esewa.id,esewa.id,amount,status,ref,method]);
  await assert.rejects(lookup(1,"paid","ref"),/PAYMENT_MISMATCH/);
  await assert.rejects(lookup(12345,"paid","ref","KHALTI"),/PAYMENT_MISMATCH/);
  await assert.rejects(lookup(12345,"paid",null),/PAYMENT_MISMATCH/);
  await as(ids.customer);
  await assert.rejects(db.query("select * from public.confirm_cod($1)",[online.id]),/PAYMENT_METHOD_LOCKED/);
  await assert.rejects(lookup(12345,"paid","ref"),/permission denied/);
  await as(null,"service_role");
  const paid=paymentSchema.parse(wire((await lookup(12345,"paid","gateway-ref")).rows[0]));
  assert.equal((await lookup(12345,"pending",null)).rows[0].status,"paid");
  assert.equal((await lookup(12345,"paid","gateway-ref")).rows[0].id,paid.id);
  await as(ids.customer);
  row=(await db.query("select * from public.bookings where id=$1",[online.id])).rows[0];
  assert.equal(row.status,"requested");assert.equal(row.checkout_status,"paid");assert.equal(row.payment_method,"ESEWA");
  assert.match(buildPaymentReceipt(online.id,publicPaymentResponse(paid).payment),/gateway-ref/);
  await as(ids.outsider);assert.equal((await db.query("select * from public.booking_payments where booking_id=$1",[online.id])).rows.length,0);
});



