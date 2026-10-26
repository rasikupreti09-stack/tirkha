import { useEffect, useRef, useState } from "react";
import { AppState, Image, Linking, Share, Pressable, Text, View } from "react-native";
import { PAYMENT_LABELS, formatNpr, safePaymentCheckoutUrl, buildPaymentReceipt, buildDemoPaymentQrUrl, type PaymentMethod, type PaymentResponse } from "@tirkha/shared";
import { paymentAction, checkoutOrigin } from "../lib/payments";
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
      if (action === "initiate" && next.checkout_url) await Linking.openURL(safePaymentCheckoutUrl(next.checkout_url, checkoutOrigin()));
    } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : "Payment could not be confirmed."); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }
  useEffect(() => {
    setResult(null); void run("verify");
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void run("verify"); });
    return () => { generation.current++; lock.current = false; subscription.remove(); };
  }, [bookingId]);
  const payment = result?.payment;
  const status = payment?.status;
  const reserved = !!status && status !== "failed";
  const minimum = method === "KHALTI" ? 1000 : method === "ESEWA" ? 1 : 0;
  const receiptable = payment && ["confirmed","paid","refunded","partially_refunded"].includes(payment.status);
  const payable = !cancelled && amount !== null && amount >= minimum && (!status || status === "failed" || status === "initiated");
  return <View className="mt-5 rounded-lg border border-border bg-muted p-4">
    <Text className="font-semibold text-primary">{status ? PAYMENT_LABELS[status] : "Booking payment"}{payment?.method !== "COD" && payment?.environment === "sandbox" ? " · Sandbox" : ""}</Text>
    <Text className="mt-3 text-sm leading-5 text-muted-foreground">{amount === null ? "A price must be agreed before checkout." : amount === 0 ? "No payment is due." : amount < minimum ? "Below this gateway's minimum. Choose another method." : `Booking amount: ${formatNpr(amount)}. Pay once now or after completion; materials and later adjustments are excluded.`}</Text>
    <Text className="mt-3 text-xs text-muted-foreground">Online checkout opens in your browser. Return here to verify payment. COD confirms cash is due, not collected.</Text>
    <View accessibilityRole="radiogroup" className="mt-4 gap-2">{(["ESEWA","KHALTI","FONEPAY","COD"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: method === value, disabled: busy || reserved || cancelled }} disabled={busy || reserved || cancelled} onPress={() => setMethod(value)} className={method === value ? "min-h-12 rounded-md bg-primary p-3" : "min-h-12 rounded-md border border-border bg-card p-3"}><Text className={method === value ? "text-primary-foreground" : "text-foreground"}>{value === "ESEWA" ? "eSewa" : value === "KHALTI" ? "Khalti" : value === "FONEPAY" ? "FonePay Instant QR · test" : "Cash on Delivery"}</Text></Pressable>)}</View>
    {!!error && <Text accessibilityRole="alert" className="mt-3 text-foreground">{error}</Text>}
    {payable && <Pressable accessibilityRole="button" disabled={busy || !result} onPress={() => void run("initiate")} className="mt-4 min-h-12 items-center justify-center rounded-md bg-primary p-3"><Text className="font-semibold text-primary-foreground">{busy ? "Checking…" : method === "COD" ? "Confirm cash on delivery" : method === "FONEPAY" ? "Show FonePay test QR" : "Continue to " + method}</Text></Pressable>}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run("verify")} className="mt-3 min-h-12 items-center justify-center rounded-md border border-border p-3"><Text className="text-primary">{busy ? "Checking payment…" : "Check payment status"}</Text></Pressable>
    {testReference && method === "FONEPAY" && <View className="mt-4 rounded-md border border-border bg-background p-4"><Text className="font-semibold text-foreground">FonePay test QR · not a payment request</Text><Text className="mt-2 text-xs leading-5 text-muted-foreground">This scannable code contains a test reference and integer paisa amount only. It cannot collect or verify money.</Text><Image className="mt-3 h-48 w-48 self-center bg-white" source={{ uri: buildDemoPaymentQrUrl("FONEPAY", testReference, amount ?? 0) }} accessibilityLabel="Scannable FonePay test QR"/><Text selectable className="mt-2 text-xs text-foreground">Reference: {testReference}</Text><Pressable accessibilityRole="button" className="mt-3 min-h-12 justify-center rounded-md border border-border p-3" onPress={() => void Share.share({ message: testReference })}><Text className="text-primary">Copy or share test reference</Text></Pressable></View>}
    {receiptable && <View className="mt-4 rounded-md border border-border bg-background p-3"><Text selectable className="text-xs leading-5 text-foreground">{buildPaymentReceipt(bookingId, payment)}</Text>
      <Pressable accessibilityRole="button" className="mt-3 min-h-12 justify-center rounded-md border border-border p-3" onPress={() => {
        void Share.share({ message: buildPaymentReceipt(bookingId, payment) }).catch(() => setError("Could not share receipt. You can copy its text instead."));
      }}><Text className="text-primary">Share receipt</Text></Pressable>
    </View>}
  </View>;
}
