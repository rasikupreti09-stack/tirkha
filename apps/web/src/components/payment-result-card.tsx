"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { paymentRequestSchema } from "@tirkha/shared";
import { getSupabase } from "../lib/supabase";
import { AccountGate } from "./account-gate";
import { PaymentCheckout } from "./payment-checkout";

export function PaymentResultCard() {
  const id = useSearchParams().get("booking") || "";
  if (!paymentRequestSchema.safeParse({ booking_id: id }).success) return <p className="mt-4">Open My bookings to find your payment record.</p>;
  return <AccountGate roles={["customer"]}>{account => <OwnedPayment key={id + account.profile.id} id={id} customerId={account.profile.id} />}</AccountGate>;
}
function OwnedPayment({ id, customerId }: { id: string; customerId: string }) {
  const [booking, setBooking] = useState<{ total_price_paisa: number | null; status: string } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getSupabase().from("bookings").select("total_price_paisa,status").eq("id", id).eq("customer_id", customerId).single().then(result => {
      if (!active) return;
      if (result.error) setError("Booking unavailable. Open My bookings or sign in with the booking owner's account.");
      else setBooking(result.data);
    });
    return () => { active = false; };
  }, [id, customerId]);
  if (error) return <p role="alert" className="mt-4">{error}</p>;
  return booking ? <PaymentCheckout bookingId={id} amount={booking.total_price_paisa} cancelled={booking.status === "cancelled"} /> : <p role="status" className="mt-4">Loading your payment record…</p>;
}
