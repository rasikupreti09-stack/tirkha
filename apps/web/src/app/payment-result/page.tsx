import Link from "next/link";
import { Suspense } from "react";
import { PaymentResultCard } from "@/components/payment-result-card";
export default function PaymentResult() {
  return <main className="mx-auto max-w-xl px-6 py-12">
    <h1 className="text-3xl font-semibold">Payment verification</h1>
    <Suspense fallback={<p className="mt-4">Loading payment…</p>}><PaymentResultCard /></Suspense>
    <p className="mt-4">Open your bookings to check the verified payment status and view your receipt. Returning from checkout does not by itself confirm payment.</p>
    <div className="mt-6 flex flex-wrap gap-4"><Link href="/bookings" className="rounded-md bg-primary px-4 py-3 text-primary-foreground">Open web bookings</Link><a href="tirkha://bookings" className="rounded-md border px-4 py-3">Return to Tirkha app</a></div>
    <p className="mt-4 text-sm text-muted-foreground">If the app link does not open, switch back to Tirkha and tap Check payment status. You may need to sign in again on the web.</p>
  </main>;
}
