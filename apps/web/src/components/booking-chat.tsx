"use client";
import { useSearchParams } from "next/navigation";
import { AccountGate } from "./account-gate";
import { HeroCommHub } from "./hero-comm-hub";

export function BookingChat() {
  const id = useSearchParams().get("booking") || "";
  return <AccountGate roles={["customer", "professional"]}>{({ profile }) => <HeroCommHub key={profile.id + id} bookingId={id} userId={profile.id} professional={profile.role === "professional"} />}</AccountGate>;
}
