import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generateEsewaSignature, verifyEsewaCallback } from "@tirkha/shared/payments-server";
import { checkoutRequestSchema, paymentRequestSchema, paymentSchema, publicPaymentResponse, paisaToRupees, rupeesToPaisa,
  verifyEsewaLookup, requiredSetting, httpSetting, ConfigurationError, type BookingPayment, type Database } from "@tirkha/shared";
import { paymentPost } from "./khalti-server";

class CheckoutError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
function server() {
  if (process.env.TIRKHA_LOCAL_MOCK === "1") throw new CheckoutError("Online gateways are disabled in local mock mode. COD remains available.", 503);
  return createClient<Database>(httpSetting(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredSetting(process.env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}
type DB = ReturnType<typeof server>;
function origin() { return new URL(httpSetting(process.env.APP_URL, "APP_URL")).origin; }
function esewaConfig() {
  const environment = process.env.ESEWA_ENVIRONMENT || "sandbox";
  if (!["sandbox","production"].includes(environment)) throw new ConfigurationError(["ESEWA_ENVIRONMENT must be sandbox or production"]);
  const secret = requiredSetting(process.env.ESEWA_SECRET_KEY, "ESEWA_SECRET_KEY");
  const productCode = requiredSetting(process.env.ESEWA_PRODUCT_CODE, "ESEWA_PRODUCT_CODE");
  if (!/^[A-Za-z0-9_-]+$/.test(productCode)) throw new ConfigurationError(["ESEWA_PRODUCT_CODE is invalid"]);
  if (environment === "production" && !origin().startsWith("https:")) throw new ConfigurationError(["APP_URL must use HTTPS for eSewa production"]);
  return { environment, secret, productCode,
    form: environment === "production" ? "https://epay.esewa.com.np/api/epay/main/v2/form" : "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    lookup: environment === "production" ? "https://esewa.com.np/api/epay/transaction/status/" : "https://rc.esewa.com.np/api/epay/transaction/status/",
  };
}
function errorResponse(error: unknown) {
  if (error instanceof CheckoutError || error instanceof ConfigurationError) return Response.json({ error: error.message }, { status: error instanceof CheckoutError ? error.status : 503, headers: noStore });
  const code = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const messages: Record<string,string> = {
    PAYMENT_METHOD_LOCKED: "A different payment method is already reserved. Check that payment or contact support.",
    PAYMENT_ENVIRONMENT_MISMATCH: "This payment belongs to a different gateway environment.",
    QUOTE_PENDING: "A price must be agreed before checkout.", BOOKING_CANCELLED: "Cancelled bookings cannot be paid.",
    PAYMENT_MINIMUM: "This amount is below the gateway minimum.", BOOKING_UNAVAILABLE: "Booking unavailable.",
  };
  return Response.json({ error: messages[code] || "Payment could not be verified. Check status before retrying; contact support if this persists." }, { status: messages[code] ? 409 : 502, headers: noStore });
}
async function userId(request: Request, db: DB) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || token.length > 8192) throw new CheckoutError("Sign in to manage payment.", 401);
  const result = await db.auth.getUser(token);
  if (result.error || !result.data.user) throw new CheckoutError("Your session expired. Sign in again.", 401);
  return result.data.user.id;
}
function bridgeUrl(payment: BookingPayment) {
  if (payment.method !== "ESEWA" || payment.status !== "initiated" || !payment.expires_at || Date.parse(payment.expires_at) <= Date.now()) return null;
  const url = new URL("/api/payments/esewa/checkout", origin());
  url.searchParams.set("attempt", payment.id); url.searchParams.set("state", payment.callback_token);
  return url.toString();
}
async function verifyEsewa(db: DB, payment: BookingPayment, transactionCode?: string) {
  const config = esewaConfig();
  if (payment.method !== "ESEWA" || payment.environment !== config.environment) throw new CheckoutError("Payment environment or method mismatch.");
  const url = new URL(config.lookup);
  url.searchParams.set("product_code", config.productCode);
  url.searchParams.set("total_amount", paisaToRupees(payment.amount_paisa));
  url.searchParams.set("transaction_uuid", payment.id);
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new CheckoutError("eSewa verification is unavailable. Check payment status again.", 502);
  const verified = verifyEsewaLookup(await response.json(), { transaction_uuid: payment.id, product_code: config.productCode, amount_paisa: payment.amount_paisa, transaction_code: transactionCode });
  const result = await db.rpc("record_gateway_lookup", { p_attempt_id: payment.id, p_pidx: payment.id,
    p_amount: payment.amount_paisa, p_status: verified.status, p_transaction_id: verified.transaction_id, p_method: "ESEWA" }).single();
  if (result.error) throw result.error;
  return paymentSchema.parse(result.data);
}
export async function checkoutPost(request: Request) {
  try {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== origin()) throw new CheckoutError("This origin is not allowed.", 403);
    const raw = await request.text();
    if (raw.length > 1024) throw new CheckoutError("Invalid checkout request.", 400);
    let parsed;
    try { parsed = checkoutRequestSchema.parse(JSON.parse(raw)); } catch { throw new CheckoutError("Invalid checkout request.", 400); }
    const db = server(), customer = await userId(request, db);
    const booking = await db.from("bookings").select("id").eq("id", parsed.booking_id).eq("customer_id", customer).maybeSingle();
    if (booking.error || !booking.data) throw new CheckoutError("Booking unavailable.", 404);
    const latest = await db.from("booking_payments").select("*").eq("booking_id", parsed.booking_id).order("created_at", { ascending: false }).limit(10);
    if (latest.error) throw latest.error;
    const rows = paymentSchema.array().parse(latest.data);
    let payment = rows.find(row => row.status !== "failed") || rows[0] || null;
    const method = parsed.action === "initiate" ? parsed.method : payment?.method;
    if (parsed.action === "initiate" && !method) throw new CheckoutError("Choose a payment method.", 400);
    if (payment && payment.status !== "failed" && method && payment.method !== method) throw new CheckoutError("A different method is reserved. Check its payment status first.");
    if (method === "KHALTI") {
      return paymentPost(new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ booking_id: parsed.booking_id }) }), parsed.action);
    }
    if (parsed.action === "initiate") {
      const config = method === "ESEWA" ? esewaConfig() : null;
      const reserved = await db.rpc("reserve_gateway_payment", { p_booking_id: parsed.booking_id, p_customer_id: customer, p_attempt_id: randomUUID(),
        p_environment: config?.environment || "production", p_method: method! }).single();
      if (reserved.error) throw reserved.error;
      payment = paymentSchema.parse(reserved.data);
      if (payment.method === "ESEWA" && !bridgeUrl(payment) && payment.status === "initiated") throw new CheckoutError("This checkout link expired. Check payment status or contact support; do not start a second payment.");
    } else if (payment?.method === "ESEWA" && payment.status !== "failed") payment = await verifyEsewa(db, payment);
    return Response.json(publicPaymentResponse(payment, payment ? bridgeUrl(payment) : null), { headers: noStore });
  } catch (error) { return errorResponse(error); }
}
async function callbackPayment(request: Request) {
  const url = new URL(request.url), id = url.searchParams.get("attempt") || "", token = url.searchParams.get("state") || "";
  if (!paymentRequestSchema.safeParse({ booking_id: id }).success || !paymentRequestSchema.safeParse({ booking_id: token }).success) throw new CheckoutError("Invalid checkout link.", 400);
  const db = server();
  const row = await db.from("booking_payments").select("*").eq("id", id).maybeSingle();
  if (row.error) throw row.error;
  if (!row.data || row.data.method !== "ESEWA" || !timingSafeEqual(Buffer.from(token), Buffer.from(row.data.callback_token))) throw new CheckoutError("Invalid checkout link.", 400);
  const payment = paymentSchema.parse(row.data), config = esewaConfig();
  if (payment.environment !== config.environment) throw new CheckoutError("Payment environment mismatch.");
  return { db, payment, config, url };
}
function resultRedirect(bookingId: string) {
  return new Response(null, { status: 303, headers: { ...noStore, Location: origin() + "/payment-result?booking=" + bookingId } });
}
export async function esewaCallback(request: Request) {
  try {
    const { db, payment, config, url } = await callbackPayment(request);
    const encoded = url.searchParams.get("data");
    let transactionCode: string | undefined;
    if (encoded) {
      let callback;
      try { callback = await verifyEsewaCallback(encoded, config.secret); } catch { throw new CheckoutError("Invalid eSewa callback signature.", 400); }
      if (callback.transaction_uuid !== payment.id || callback.product_code !== config.productCode || rupeesToPaisa(callback.total_amount) !== payment.amount_paisa) throw new CheckoutError("eSewa payment reference or amount mismatch.", 400);
      if (callback.status === "COMPLETE") transactionCode = callback.transaction_code;
    }
    // Signed callback alone is insufficient. Only the server status lookup settles.
    try { await verifyEsewa(db, payment, transactionCode); } catch { /* Authenticated status check can reconcile later; never display unverified success. */ }
    return resultRedirect(payment.booking_id);
  } catch (error) { return errorResponse(error); }
}
export async function esewaCheckout(request: Request) {
  try {
    const { payment, config } = await callbackPayment(request);
    if (payment.status !== "initiated") return resultRedirect(payment.booking_id);
    if (!payment.expires_at || Date.parse(payment.expires_at) <= Date.now()) throw new CheckoutError("Checkout link expired. Return to your booking and check payment status.");
    const callback = new URL("/api/payments/esewa/callback", origin());
    callback.searchParams.set("attempt", payment.id); callback.searchParams.set("state", payment.callback_token);
    const fields: Record<string,string> = {
      amount: paisaToRupees(payment.amount_paisa), tax_amount: "0", total_amount: paisaToRupees(payment.amount_paisa),
      transaction_uuid: payment.id, product_code: config.productCode, product_service_charge: "0", product_delivery_charge: "0",
      success_url: callback.toString(), failure_url: callback.toString(), signed_field_names: "total_amount,transaction_uuid,product_code",
    };
    fields.signature = await generateEsewaSignature({ total_amount: fields.total_amount, transaction_uuid: payment.id, product_code: config.productCode }, config.secret);
    const escape = (value: string) => value.replaceAll("&","&amp;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");
    const nonce = randomUUID();
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tirkha eSewa checkout</title></head><body><h1>Continue to eSewa</h1><p>Keep this payment reference: ' + escape(payment.id) + '</p><form id="checkout" method="post" action="' + config.form + '">' +
      Object.entries(fields).map(([name,value]) => '<input type="hidden" name="' + name + '" value="' + escape(value) + '">').join("") +
      '<button type="submit">Continue to eSewa</button></form><script nonce="' + nonce + '">document.getElementById("checkout").submit();</script></body></html>';
    return new Response(html, { headers: { ...noStore, "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; script-src 'nonce-" + nonce + "'; form-action " + new URL(config.form).origin + "; base-uri 'none'; frame-ancestors 'none'" } });
  } catch (error) { return errorResponse(error); }
}
