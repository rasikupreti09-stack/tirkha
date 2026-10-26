import { z } from "zod";
export const paymentStatusSchema = z.enum(["initiating", "initiated", "pending", "confirmed", "paid", "failed", "refunded", "partially_refunded"]);
export const paymentMethodSchema = z.enum(["ESEWA", "KHALTI", "COD"]);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const checkoutRequestSchema = z.strictObject({ booking_id: z.uuid(), action: z.enum(["initiate", "verify"]), method: paymentMethodSchema.optional() });
export const paymentRequestSchema = z.strictObject({ booking_id: z.uuid() });
export const paymentSchema = z.object({
  id: z.uuid(), booking_id: z.uuid(), customer_id: z.uuid(), amount_paisa: z.number().int().min(0).max(2147483647),
  method: paymentMethodSchema.default("KHALTI"),
  status: paymentStatusSchema, environment: z.enum(["sandbox", "production"]),
  pidx: z.string().nullable(), transaction_id: z.string().nullable(), payment_url: z.url().nullable(),
  expires_at: z.iso.datetime({ offset: true }).nullable(), callback_token: z.uuid(),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
});
export const paymentResponseSchema = z.object({
  payment: z.object({ id: z.uuid(), status: paymentStatusSchema, amount_paisa: z.number().int().nonnegative(), environment: z.enum(["sandbox", "production"]),
    method: paymentMethodSchema.default("KHALTI"), reference: z.string().nullable().default(null), updated_at: z.iso.datetime({ offset: true }).optional(),
  }).nullable(),
  checkout_url: z.url().nullable(),
});
export const khaltiInitiationSchema = z.object({ pidx: z.string().min(1).max(200), payment_url: z.url(), expires_at: z.iso.datetime({ offset: true }) });
export const khaltiLookupSchema = z.object({
  pidx: z.string().min(1).max(200), total_amount: z.number().int().positive(), status: z.string(),
  transaction_id: z.string().nullable(), refunded: z.boolean(),
});
export type BookingPayment = z.infer<typeof paymentSchema>;
export type PaymentResponse = z.infer<typeof paymentResponseSchema>;
export function buildDemoPaymentQrUrl(method: "ESEWA" | "KHALTI" | "FONEPAY", reference: string, amountPaisa: number) {
  if (!reference.trim() || !Number.isSafeInteger(amountPaisa) || amountPaisa < 0) throw new Error("A test reference and integer paisa amount are required.");
  const payload = ["TIRKHA-DEMO", method, reference.trim(), String(amountPaisa)].join("|");
  return "https://api.qrserver.com/v1/create-qr-code/?size=192x192&format=svg&data=" + encodeURIComponent(payload);
}
export function publicPaymentResponse(payment: BookingPayment | null, checkoutUrl: string | null = null): PaymentResponse {
  return { payment: payment ? { id: payment.id, status: payment.status, method: payment.method, amount_paisa: payment.amount_paisa,
    environment: payment.environment, reference: payment.transaction_id, updated_at: payment.updated_at } : null, checkout_url: checkoutUrl };
}
export const PAYMENT_LABELS = {
  initiating: "Checkout initiation awaiting confirmation. Contact support if this persists.",
  initiated: "Checkout ready — payment not confirmed", pending: "Payment pending confirmation", confirmed: "Confirmed — cash due on service delivery", paid: "Paid — verified by gateway",
  failed: "Checkout unsuccessful — you can try again", refunded: "Payment refunded", partially_refunded: "Payment partially refunded — contact support",
} as const;

export function safeKhaltiCheckoutUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["pay.khalti.com", "test-pay.khalti.com"].includes(url.hostname) || url.port || url.username || url.password) throw new Error("Invalid checkout URL.");
  return url.toString();
}

export function paisaToRupees(paisa: number): string {
  z.number().int().nonnegative().max(2147483647).parse(paisa);
  return Math.floor(paisa / 100) + "." + String(paisa % 100).padStart(2, "0");
}
export function rupeesToPaisa(value: string | number): number {
  const text = String(value);
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) throw new Error("Invalid gateway amount.");
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > 2147483647n) throw new Error("Invalid gateway amount.");
  return Number(result);
}
export function buildKhaltiInitiation(input: { amount: number; purchase_order_id: string; return_url: string; website_url: string; purchase_order_name: string }) {
  return z.strictObject({
    amount: z.number().int().min(1000).max(2147483647), purchase_order_id: z.uuid(),
    return_url: z.url(), website_url: z.url(), purchase_order_name: z.string().min(1).max(200),
  }).parse(input);
}
export function verifyKhaltiLookup(value: unknown, expected: { pidx: string; amount_paisa: number }) {
  const lookup = khaltiLookupSchema.parse(value);
  if (lookup.pidx !== expected.pidx || lookup.total_amount !== expected.amount_paisa) throw new Error("Payment amount or reference mismatch.");
  const statuses: Record<string, BookingPayment["status"]> = { Completed: "paid", Pending: "pending", Initiated: "initiated", Expired: "failed", "User canceled": "failed", Refunded: "refunded", "Partially Refunded": "partially_refunded", "Partially refunded": "partially_refunded" };
  const status = statuses[lookup.status];
  if (!status || (status === "paid" && lookup.refunded) || (["paid","refunded","partially_refunded"].includes(status) && !lookup.transaction_id)) throw new Error("Gateway verification is incomplete.");
  return { status, pidx: lookup.pidx, amount_paisa: lookup.total_amount, transaction_id: lookup.transaction_id };
}
export function verifyEsewaLookup(value: unknown, expected: { transaction_uuid: string; product_code: string; amount_paisa: number; transaction_code?: string }) {
  const lookup = z.object({ product_code: z.string(), transaction_uuid: z.string(), total_amount: z.union([z.string(), z.number()]),
    status: z.string(), ref_id: z.string().nullable().optional(),
  }).parse(value);
  if (lookup.product_code !== expected.product_code || lookup.transaction_uuid !== expected.transaction_uuid || rupeesToPaisa(lookup.total_amount) !== expected.amount_paisa) throw new Error("Payment amount or reference mismatch.");
  const statuses: Record<string, BookingPayment["status"]> = { COMPLETE: "paid", PENDING: "pending", AMBIGUOUS: "pending", FULL_REFUND: "refunded", PARTIAL_REFUND: "partially_refunded", CANCELED: "failed", NOT_FOUND: "initiated" };
  const status = statuses[lookup.status];
  if (!status || (["paid","refunded","partially_refunded"].includes(status) && !lookup.ref_id)
    || (expected.transaction_code && lookup.ref_id !== expected.transaction_code)) throw new Error("Gateway verification is incomplete.");
  // NOT_FOUND can occur before a valid checkout is opened. Never release its
  // reservation automatically and risk charging a second transaction.
  return { status, transaction_id: lookup.ref_id || null };
}
export function buildPaymentReceipt(bookingId: string, payment: NonNullable<PaymentResponse["payment"]>): string {
  if (!["confirmed","paid","refunded","partially_refunded"].includes(payment.status)) throw new Error("No confirmed receipt is available.");
  return ["Tirkha — " + (payment.status === "confirmed" ? "COD confirmation (not proof of payment)" : "Payment record"),
    "Booking: " + bookingId, "Receipt: " + payment.id, "Method: " + payment.method,
    "Status: " + PAYMENT_LABELS[payment.status],
    "Labour subtotal: NPR " + paisaToRupees(payment.amount_paisa),
    "Additional fees charged: NPR 0.00",
    "Total: NPR " + paisaToRupees(payment.amount_paisa),
    ...(payment.status === "confirmed" ? ["Due on completion: NPR " + paisaToRupees(payment.amount_paisa)] : []),
    "Materials and taxes are not itemized in this labour-only record.",
    "Gateway reference: " + (payment.reference || "Not applicable"),
    "Updated: " + (payment.updated_at || "Not available"),
    payment.method !== "COD" && payment.environment === "sandbox" ? "SANDBOX — no live payment receipt" : "",
    "Booking labour payment record. This is not a tax invoice.",
  ].filter(Boolean).join("\n");
}
export function safePaymentCheckoutUrl(value: string, apiOrigin: string): string {
  const url = new URL(value);
  if (url.hostname === "pay.khalti.com" || url.hostname === "test-pay.khalti.com") return safeKhaltiCheckoutUrl(value);
  const origin = new URL(apiOrigin);
  if (url.origin !== origin.origin || url.pathname !== "/api/payments/esewa/checkout" || url.username || url.password
    || !["https:","http:"].includes(url.protocol)) throw new Error("Invalid checkout URL.");
  return url.toString();
}

