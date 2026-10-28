"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AccountGate } from "@/components/account-gate";
import { HeroCommHub } from "@/components/hero-comm-hub";

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params.id === "string" ? params.id : "";

  return <AccountGate roles={["customer", "professional"]}>{({ profile }) => <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
    <Link href={profile.role === "professional" ? "/jobs" : "/bookings"} className="underline">← Back to bookings</Link>
    <HeroCommHub key={`${profile.id}:${bookingId}`} bookingId={bookingId} userId={profile.id} professional={profile.role === "professional"} initialTab="hero" />
  </main>}</AccountGate>;
}
