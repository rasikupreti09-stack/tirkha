"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BOOKING_STATUS_LABELS, formatBookingDate, workflowBookingSchema, type WorkflowBooking } from "@tirkha/shared";
import { AccountGate } from "@/components/account-gate";
import { HeroCommHub } from "@/components/hero-comm-hub";
import { BookingTrackingCard } from "@/components/booking-tracking-card";
import { useAuth } from "@/components/auth-provider";
import { isLocalMock } from "@/lib/supabase";

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const bookingId = typeof params.id === "string" ? params.id : "";

  return <AccountGate roles={["customer", "professional"]}>{({ profile }) => profile.role === "professional"
    ? <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6"><Link href="/jobs" className="underline">← Back to bookings</Link><HeroCommHub key={`${profile.id}:${bookingId}`} bookingId={bookingId} userId={profile.id} professional initialTab="hero" /></main>
    : <CustomerBookingDetails key={`${profile.id}:${bookingId}`} bookingId={bookingId} userId={profile.id} />}</AccountGate>;
}

function CustomerBookingDetails({ bookingId, userId }: { bookingId: string; userId: string }) {
  const { client } = useAuth();
  const [booking, setBooking] = useState<WorkflowBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const readGeneration = useRef(0);
  const localMock = isLocalMock;
  const refresh = useCallback(async () => {
    if (!client || !bookingId) { setLoading(false); setError("Booking details are unavailable right now."); return; }
    const generation = ++readGeneration.current;
    try {
      const result = await client.from("bookings").select("*").eq("id", bookingId).eq("customer_id", userId).maybeSingle();
      if (generation !== readGeneration.current) return;
      if (result.error) throw result.error;
      if (!result.data) { setBooking(null); setError("This booking was not found or is not available to this account."); }
      else { setBooking(workflowBookingSchema.parse(result.data)); setError(""); }
    } catch { if (generation === readGeneration.current) setError("Could not refresh this booking. Try again shortly."); }
    finally { if (generation === readGeneration.current) setLoading(false); }
  }, [bookingId, client, userId]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    let refreshTimer: number | undefined;
    let refreshing = false;
    const load = async () => {
      if (!active || refreshing) return;
      refreshing = true;
      await refresh();
      refreshing = false;
    };
    void load();
    let channel: ReturnType<NonNullable<typeof client>["channel"]> | null = null;
    if (client && !localMock) {
      channel = client.channel(`booking-detail:${bookingId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` }, () => {
          if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
          refreshTimer = window.setTimeout(() => void load(), 180);
        })
        .subscribe(status => { if (active) setLive(status === "SUBSCRIBED"); });
    }
    timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      readGeneration.current++;
      if (timer !== undefined) window.clearInterval(timer);
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      window.removeEventListener("focus", load);
      if (channel) void client?.removeChannel(channel);
    };
  }, [bookingId, client, localMock, refresh]);

  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-8 sm:px-6">
    <Link href="/bookings" className="underline">← Back to bookings</Link>
    <h1 className="mt-6 text-3xl font-semibold">Booking details</h1>
    {loading && <p role="status" className="mt-4">Loading booking…</p>}
    {error && <p role="alert" className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">{error} <button type="button" className="ml-2 underline" onClick={() => void refresh()}>Refresh</button></p>}
    {booking && <>
      <section className="mt-5 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{booking.service_address}</h2><p className="mt-2 text-sm text-muted-foreground">Scheduled {formatBookingDate(booking.scheduled_at)}</p></div><span className="rounded-full border px-3 py-1 text-sm font-semibold">{BOOKING_STATUS_LABELS[booking.status]}</span></div>
        <p className="mt-4 whitespace-pre-wrap text-sm">{booking.job_details}</p>
        <p className="mt-3 text-xs text-muted-foreground">{localMock ? "Local preview · periodic updates" : live ? "Live booking updates connected" : "Connecting to live updates · periodic refresh enabled"}</p>
      </section>
      <BookingTrackingCard booking={booking} live={live} localMock={localMock} stale={!!error} userId={userId} />
    </>}
  </main>;
}
