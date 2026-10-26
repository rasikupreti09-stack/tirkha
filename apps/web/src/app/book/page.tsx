import { Suspense } from "react";
import { BookingForm } from "@/components/booking-form";
export default function BookPage() {
  return <Suspense fallback={<main className="p-8" role="status">Loading booking form…</main>}><BookingForm /></Suspense>;
}
