"use client";
import { useEffect, useRef, useState } from "react";
import { PAYMENT_LABELS, formatNpr, safePaymentCheckoutUrl, buildPaymentReceipt, buildDemoPaymentQrUrl, type PaymentMethod, type PaymentResponse } from "@tirkha/shared";
import { paymentAction, checkoutOrigin } from "@/lib/payments";
import { Button } from "./ui/button";
export function PaymentCheckout({ bookingId, amount, cancelled = false }: { bookingId: string; amount: number | null; cancelled?: boolean }) {
  const [method, setMethod] = useState<PaymentMethod | "FONEPAY">("ESEWA");
  const [testReference, setTestReference] = useState("");
  const [result, setResult] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  async function run(action: "initiate" | "verify") {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    const version = ++generation.current;
    try {
      if (method === "FONEPAY") { if (action === "initiate") setTestReference("TIR-" + bookingId.slice(0,8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase()); return; }
      const next = await paymentAction(bookingId, action, method);
      if (version !== generation.current) return;
      setResult(next);
      if (next.payment && next.payment.status !== "failed") setMethod(next.payment.method);
      if (action === "initiate" && next.checkout_url) window.location.assign(safePaymentCheckoutUrl(next.checkout_url, checkoutOrigin()));
    } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : "Payment could not be confirmed."); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => {
    setResult(null); void run("verify");
    const refresh = () => { void run("verify"); };
    window.addEventListener("focus", refresh);
    return () => { generation.current++; lock.current = false; window.removeEventListener("focus", refresh); };
  }, [bookingId]);
  const payment = result?.payment;
  const status = payment?.status;
  const reserved = !!status && status !== "failed";
  const minimum = method === "KHALTI" ? 1000 : method === "ESEWA" ? 1 : 0;
  const receiptable = payment && ["confirmed","paid","refunded","partially_refunded"].includes(payment.status);
  const payable = !cancelled && amount !== null && amount >= minimum && (!status || status === "failed" || status === "initiated");
  return <section aria-label="Booking checkout" className="mt-5 rounded-lg border bg-muted p-4">
    <p role="status" className="font-medium">{status ? PAYMENT_LABELS[status] : "Booking payment"}{payment?.method !== "COD" && payment?.environment === "sandbox" ? " · Sandbox" : ""}</p>
    <p className="mt-2 text-sm text-muted-foreground">{amount === null ? "A price must be agreed before checkout." : amount === 0 ? "No payment is due for this booking." : amount < minimum ? "Below this gateway's minimum. Choose another method." : `Booking amount: ${formatNpr(amount)}. Pay once now or after completion; materials and later adjustments are excluded.`}</p>
    <p className="mt-2 text-xs text-muted-foreground">COD confirms cash is due, not collected. Online payment requires server verification.</p>
    <fieldset disabled={busy || reserved || cancelled} className="mt-4 flex flex-wrap gap-4"><legend className="mb-2 text-sm font-medium">Payment method</legend>
      {(["ESEWA","KHALTI","FONEPAY","COD"] as const).map(value => <label key={value} className="flex min-h-11 items-center gap-2"><input type="radio" name={"method-" + bookingId} checked={method === value} onChange={() => setMethod(value)} />{value === "ESEWA" ? "eSewa" : value === "KHALTI" ? "Khalti" : value === "FONEPAY" ? "FonePay Instant QR · test" : "Cash on Delivery"}</label>)}
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {payable && <Button disabled={busy || !result} onClick={() => method === "FONEPAY" ? setTestReference("TIR-" + bookingId.slice(0,8).toUpperCase() + "-" + Date.now().toString(36).toUpperCase()) : void run("initiate")}>{busy ? "Checking…" : method === "COD" ? "Confirm cash on delivery" : method === "FONEPAY" ? "Show FonePay test QR" : "Continue to " + method}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => void run("verify")}>{busy ? "Checking payment…" : "Check payment status"}</Button>
    </div>
    {testReference && method === "FONEPAY" && <div className="mt-4 rounded-md border bg-background p-4"><h3 className="font-medium">FonePay test QR · not a payment request</h3><p className="mt-2 text-sm text-muted-foreground">This scannable code contains a test reference and integer paisa amount only. It cannot collect or verify money.</p><img className="mt-3 h-48 w-48 border bg-white p-2" src={buildDemoPaymentQrUrl("FONEPAY", testReference, amount ?? 0)} width={192} height={192} alt="Scannable FonePay test QR" referrerPolicy="no-referrer"/><p className="mt-2 break-all text-xs" aria-live="polite">Reference: {testReference}</p><Button variant="outline" className="mt-3" onClick={async () => { try { await navigator.clipboard.writeText(testReference); setError("Test reference copied."); } catch { setError("Could not copy automatically. Select and copy the reference above."); } }}>Copy reference</Button></div>}
    {receiptable && <div className="mt-4 rounded-md border bg-background p-3"><h3 className="font-medium">{payment.status === "confirmed" ? "COD confirmation" : "Payment receipt"}</h3>
      <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{buildPaymentReceipt(bookingId, payment)}</pre>
      <Button variant="outline" className="mt-3" onClick={() => {
        const url = URL.createObjectURL(new Blob([buildPaymentReceipt(bookingId, payment)], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a"); link.href = url; link.download = "tirkha-" + payment.id + ".txt";
        document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}>Download receipt</Button>
    </div>}
  </section>;
}
