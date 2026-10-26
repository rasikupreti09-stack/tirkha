import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildKhaltiInitiation, verifyKhaltiLookup, publicPaymentResponse, ConfigurationError, khaltiSettings, khaltiInitiationSchema, khaltiLookupSchema, paymentRequestSchema, paymentSchema, safeKhaltiCheckoutUrl, type BookingPayment, type Database, type PaymentResponse } from "@tirkha/shared";

class PaymentError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}
function configuration() {
  if (process.env.TIRKHA_LOCAL_MOCK === "1") throw new PaymentError("Khalti is disabled in local mock mode. Configure sandbox credentials to enable payments.", 503);
  return khaltiSettings(process.env);
}
function serverClient() {
  const config = configuration();
  return createClient<Database>(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
type ServerClient = ReturnType<typeof serverClient>;
async function authenticated(request: Request, db: ServerClient) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token || token.length > 8192) throw new PaymentError("Sign in to manage payment.", 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new PaymentError("Your session expired. Sign in again.", 401);
  return data.user.id;
}
async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 1024) throw new PaymentError("Invalid payment request.", 400);
  try { return paymentRequestSchema.parse(JSON.parse(raw)); }
  catch { throw new PaymentError("Invalid payment request.", 400); }
}
async function ownedBooking(db: ServerClient, id: string, userId: string) {
  const { data, error } = await db.from("bookings").select("id,customer_id").eq("id", id).eq("customer_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) throw new PaymentError("Booking unavailable.", 404);
}
async function latest(db: ServerClient, bookingId: string) {
  const { data, error } = await db.from("booking_payments").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? paymentSchema.parse(data) : null;
}
function publicResult(payment: BookingPayment | null): PaymentResponse {
  return publicPaymentResponse(payment,
    payment?.status === "initiated" && payment.payment_url && payment.expires_at && Date.parse(payment.expires_at) > Date.now() ? safeKhaltiCheckoutUrl(payment.payment_url) : null);
}
async function khalti(endpoint: string, payload: object) {
  const config = configuration();
  const response = await fetch(config.api + endpoint + "/", {
    method: "POST", headers: { Authorization: `Key ${config.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
  // Lookup returns HTTP 400 for valid Expired / User canceled results.
  return { ok: response.ok, status: response.status, data: await response.json() as unknown };
}
async function verify(db: ServerClient, payment: BookingPayment) {
  if (payment.method !== "KHALTI") throw new PaymentError("This booking uses a different payment method.");
  if (!payment.pidx) return payment;
  if (payment.environment !== configuration().environment) throw new PaymentError("This payment belongs to a different Khalti environment. Contact support.");
  const response = await khalti("lookup", { pidx: payment.pidx });
  if (!response.ok && response.status !== 400) throw new PaymentError("Khalti verification is unavailable. Check again shortly.", 502);
  const parsed = khaltiLookupSchema.safeParse(response.data);
  if (!parsed.success) throw new PaymentError("Khalti has not confirmed this payment. Check again shortly.", 502);
  const lookup = parsed.data;
  if (lookup.pidx !== payment.pidx || lookup.total_amount !== payment.amount_paisa) throw new PaymentError("Payment amount or reference mismatch. Contact support.", 502);
  const { status } = verifyKhaltiLookup(lookup, { pidx: payment.pidx, amount_paisa: payment.amount_paisa });
  const { data, error } = await db.rpc("record_khalti_lookup", { p_attempt_id: payment.id, p_pidx: lookup.pidx, p_amount: lookup.total_amount, p_status: status, p_transaction_id: lookup.transaction_id }).single();
  if (error) throw error;
  return paymentSchema.parse(data);
}
function responseError(error: unknown) {
  if (error instanceof ConfigurationError) return Response.json({ error: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (error instanceof PaymentError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  const code = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const messages: Record<string, string> = { BOOKING_UNAVAILABLE: "Booking unavailable.", BOOKING_CANCELLED: "Cancelled bookings cannot be paid.", QUOTE_PENDING: "Agree a price before paying for this request.", PAYMENT_MINIMUM: "Khalti checkout requires at least NPR 10.00.", PAYMENT_CONFLICT: "Payment is being processed. Check payment status before retrying." };
  return Response.json({ error: messages[code] || "Payment could not be confirmed. Check payment status before retrying; contact support if this persists." }, { status: messages[code] ? 409 : 502, headers: { "Cache-Control": "no-store" } });
}
export async function paymentPost(request: Request, action: "initiate" | "verify") {
  try {
    const config = configuration();
    const origin = request.headers.get("origin");
    if (origin && origin !== config.origin) throw new PaymentError("This origin is not allowed.", 403);
    const db = serverClient();
    const userId = await authenticated(request, db);
    const input = await body(request);
    await ownedBooking(db, input.booking_id, userId);
    let payment = await latest(db, input.booking_id);
    if (payment && payment.method !== "KHALTI") {
      if (payment.status !== "failed") throw new PaymentError("This booking uses a different payment method.");
      payment = null;
    }
    if (payment?.pidx) payment = await verify(db, payment);
    if (action === "verify") return Response.json(publicResult(payment), { headers: { "Cache-Control": "no-store" } });
    const attemptId = randomUUID();
    const reservation = await db.rpc("reserve_booking_payment", { p_booking_id: input.booking_id, p_customer_id: userId, p_attempt_id: attemptId, p_environment: config.environment }).single();
    if (reservation.error) throw reservation.error;
    payment = paymentSchema.parse(reservation.data);
    if (payment.id !== attemptId) return Response.json(publicResult(payment), { headers: { "Cache-Control": "no-store" } });
    const callback = new URL("/api/payments/khalti/callback", config.origin);
    callback.searchParams.set("attempt", payment.id); callback.searchParams.set("state", payment.callback_token);
    // Never retry an ambiguous initiation: the gateway may have created a chargeable checkout.
    const initiated = await khalti("initiate", buildKhaltiInitiation({ return_url: callback.toString(), website_url: config.origin, amount: payment.amount_paisa, purchase_order_id: payment.id, purchase_order_name: "Tirkha booking " + payment.booking_id }));
    if (!initiated.ok) {
      if ([400, 401, 403].includes(initiated.status)) {
        const { error } = await db.from("booking_payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("status", "initiating");
        if (error) throw error;
      }
      throw new PaymentError("Khalti could not start checkout. Check payment status before retrying.", 502);
    }
    const checkout = khaltiInitiationSchema.parse(initiated.data);
    const checkoutUrl = safeKhaltiCheckoutUrl(checkout.payment_url);
    const expectedHost = config.environment === "production" ? "pay.khalti.com" : "test-pay.khalti.com";
    if (new URL(checkoutUrl).hostname !== expectedHost) throw new PaymentError("Unexpected checkout environment.", 502);
    const saved = await db.rpc("attach_khalti_checkout", { p_attempt_id: payment.id, p_pidx: checkout.pidx, p_url: checkoutUrl, p_expires_at: checkout.expires_at }).single();
    if (saved.error) throw saved.error;
    return Response.json(publicResult(paymentSchema.parse(saved.data)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return responseError(error); }
}
export async function paymentCallback(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("attempt") || "", state = url.searchParams.get("state") || "", pidx = url.searchParams.get("pidx") || "";
    if (!paymentRequestSchema.safeParse({ booking_id: id }).success || !paymentRequestSchema.safeParse({ booking_id: state }).success || !pidx || pidx.length > 200) throw new PaymentError("Invalid payment callback.", 400);
    const db = serverClient();
    const { data, error } = await db.from("booking_payments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data || !timingSafeEqual(Buffer.from(state), Buffer.from(data.callback_token)) || data.pidx !== pidx) throw new PaymentError("Invalid payment callback.", 400);
    // Ignore callback status, transaction and amount. Only the authenticated lookup is authoritative.
    try { await verify(db, paymentSchema.parse(data)); } catch { /* The result screen offers authenticated reconciliation. Never claim success here. */ }
    return new Response(null, { status: 303, headers: { Location: configuration().origin + "/payment-result?booking=" + data.booking_id, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return responseError(error); }
}


