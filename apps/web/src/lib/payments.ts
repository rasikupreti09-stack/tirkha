import { paymentResponseSchema, paymentSchema, publicPaymentResponse, type PaymentMethod, type PaymentResponse } from "@tirkha/shared";
import { getSupabase, isLocalMock } from "./supabase";
export function checkoutOrigin() { return window.location.origin; }

export async function paymentAction(bookingId: string, action: "initiate" | "verify", method: PaymentMethod = "KHALTI"): Promise<PaymentResponse> {
  const client = getSupabase();
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error("Sign in to manage payment.");
  if (action === "initiate" && method === "COD") {
    const result = await client.rpc("confirm_cod", { p_booking_id: bookingId }).single();
    if (result.error) {
      const messages: Record<string,string> = { QUOTE_PENDING: "A price must be agreed before confirming COD.", PAYMENT_METHOD_LOCKED: "An online payment is already reserved. Check its status before changing method.", BOOKING_CANCELLED: "Cancelled bookings cannot be confirmed." };
      throw new Error(messages[result.error.message] || "COD could not be confirmed. Refresh payment status before retrying.");
    }
    return publicPaymentResponse(paymentSchema.parse(result.data));
  }
  if (action === "verify") {
    const result = await client.from("booking_payments").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(10);
    if (result.error) throw new Error("Could not read payment status. Check your connection and migration 10.");
    const rows = paymentSchema.array().parse(result.data);
    const payment = rows.find(row => row.status !== "failed") || rows[0] || null;
    if (!payment || payment.method === "COD" || isLocalMock) return publicPaymentResponse(payment);
  }
  if (isLocalMock) throw new Error("Online gateways are disabled in local mock mode. Choose COD or configure a gateway sandbox.");
  const response = await fetch(checkoutOrigin() + "/api/payments/checkout", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token },
    body: JSON.stringify({ booking_id: bookingId, action, method }), signal: AbortSignal.timeout(20000),
  });
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error(payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Payment could not be confirmed. Check status before retrying.");
  return paymentResponseSchema.parse(payload);
}
