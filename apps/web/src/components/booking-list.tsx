"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { BOOKING_STATUS_LABELS, BOOKING_ACTION_LABELS, BOOKING_PAGE_SIZE, bookingActions, bookingErrorMessage, formatBookingDate, formatNpr, type BookingAction, type BookingListMode, type WorkflowBooking } from "@tirkha/shared";
import { useBookingFeed } from "@/hooks/use-booking-feed";
import type { Account } from "@/hooks/use-account";
import { changeBooking } from "@/lib/bookings";
import { AccountGate } from "./account-gate";
import { Button } from "./ui/button";
import { PaymentCheckout } from "./payment-checkout";
import { ProviderWorkflow } from "./provider-workflow";
import { BookingTrackingCard } from "./booking-tracking-card";
import { HeroGpsTracker } from "./hero-gps-tracker";
import { HeroDispatchInbox } from "./hero-dispatch-inbox";

export function BookingList({ professional = false }: { professional?: boolean }) {
  return <AccountGate roles={[professional ? "professional" : "customer"]}>{(account) => <BookingRecords account={account} professional={professional} />}</AccountGate>;
}
function BookingRecords({ account, professional }: { account: Account; professional: boolean }) {
  const [mode, setMode] = useState<BookingListMode>(professional ? "available" : "active");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const verified = account.professional?.verification_status === "verified";
  const feed = useBookingFeed(account.profile.id, account.profile.role, mode, page);
  async function act(booking: WorkflowBooking, action: BookingAction) {
    if (busyRef.current) return;
    const question = action === "cancelled" ? "Cancel this pending booking request?" : action === "completed" ? "Mark this job as completed?" : action === "accepted" ? "Accept this job at the requested time? The displayed estimate will remain unchanged." : action === "on_the_way" ? "Tell the customer you are on the way?" : "Mark this job as started?";
    if (!window.confirm(question)) return;
    busyRef.current = true; setBusy(booking.id); setMessage("");
    try {
      await changeBooking(booking.id, action);
      setMessage(action === "accepted" ? "Job accepted. You can manage it under Assigned." : "Booking updated.");
    } catch (error) { setMessage(bookingErrorMessage(error)); }
    finally { feed.refresh(); setBusy(null); busyRef.current = false; }
  }
  const modes: { key: BookingListMode; label: string }[] = [
    ...(professional ? [{ key: "available" as const, label: "Available" }] : []),
    { key: "active", label: professional ? "Assigned" : "Active" },
    { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" },
  ];
  return <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 sm:px-6">
    <Link href="/dashboard" className="underline">← Dashboard</Link>
    {professional && <HeroGpsTracker enabled={verified} />}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{professional ? "Professional jobs" : "My bookings"}</h1>
      {!professional && <Button asChild><Link href="/book">Request a service</Link></Button>}
    </div>
    {professional && verified && <HeroDispatchInbox onAccepted={feed.refresh} />}
    {professional && <p className="mt-3 text-sm text-muted-foreground">{verified ? "Available requests match your service categories. Confirm the landmark and appointment before accepting." : "Your professional account is not verified. You can view assigned history; accepting and updating jobs requires verification."}</p>}
    <div className="my-6 flex flex-wrap items-center gap-2" aria-label="Booking filters">
      {modes.map((item) => <Button key={item.key} variant={mode === item.key ? "default" : "outline"} aria-pressed={mode === item.key} onClick={() => { setMode(item.key); setPage(0); setMessage(""); }}>{item.label}</Button>)}
      <Button variant="outline" onClick={feed.refresh}>Refresh</Button>
    </div>
    <p className="mb-4 text-xs text-muted-foreground">{feed.localMock ? "Local mock polling" : feed.live ? "Live status updates connected · also refreshes every 30 seconds" : "Connecting live updates · refreshes every 30 seconds"}</p>
    {message && <p role="status" className="mb-4 rounded-md border bg-muted p-4">{message}</p>}
    {feed.error && <p role="alert" className="mb-4">{feed.error}</p>}
    {feed.loading ? <p role="status">Loading bookings…</p> : !feed.items.length ? !feed.error && <p className="rounded-lg border p-6">{mode === "available" && !verified ? "Verification is required to view available requests." : "No bookings in this view."}</p> : <div className="space-y-4">
      {feed.items.map((booking) => <article id={`booking-${booking.id}`} key={booking.id} className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-xl font-semibold">{feed.categories.find((category) => category.id === booking.category_id)?.name || "Service request"}</h2>
          <span className={booking.status === "in_progress" || booking.status === "on_the_way" || booking.status === "accepted" ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground" : "rounded-full border bg-muted px-3 py-1 text-xs font-medium"}>{BOOKING_STATUS_LABELS[booking.status]}</span>
        </div>
        <p className="mt-4 font-medium">{formatBookingDate(booking.scheduled_at)} · {booking.duration_minutes} minutes</p>
        <p className="mt-2 break-words text-sm">{booking.service_address}</p>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{booking.job_details || "No job details provided."}</p>
        {professional && booking.diagnostic_summary && <aside className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-800"><p className="font-semibold">AI-assisted triage · verify on site</p><p className="mt-1">{booking.diagnostic_summary}</p>{booking.diagnostic_severity && <p className="mt-1"><strong>Customer-reported severity:</strong> {booking.diagnostic_severity}</p>}{booking.diagnostic_urgency && <p className="mt-1"><strong>Urgency flag:</strong> {booking.diagnostic_urgency}</p>}{(booking.suggested_parts ?? []).length > 0 && <p className="mt-1"><strong>Possible parts:</strong> {booking.suggested_parts?.join(", ")} (unconfirmed and unpriced)</p>}</aside>}
        <p className="mt-4 font-semibold">Estimated labour total: {booking.total_price_paisa === null ? "Quote pending" : formatNpr(booking.total_price_paisa)}</p>
        <p className="mt-2 text-sm text-muted-foreground">{booking.professional_id ? "Professional assigned" : "Awaiting professional assignment"}</p>
        <p className="mt-3 break-all text-xs text-muted-foreground">Reference: {booking.id}</p>{(booking.customer_id === account.profile.id || booking.professional_id === account.profile.id) && <Link href={`/chat?booking=${booking.id}`} className="mt-4 inline-block py-2 font-medium underline">Open booking chat</Link>}
        <div className="mt-4 flex flex-wrap gap-3">{!professional && bookingActions(booking, account.profile.id, account.profile.role, verified).map((action) => <Button key={action} variant={action === "cancelled" ? "outline" : "default"} disabled={busy !== null} onClick={() => void act(booking, action)}>{busy === booking.id ? "Updating…" : BOOKING_ACTION_LABELS[action]}</Button>)}</div>
      {professional ? <ProviderWorkflow booking={booking} userId={account.profile.id} verified={verified} busy={busy !== null} updating={busy === booking.id} onAction={(action) => void act(booking, action)} /> : <BookingTrackingCard booking={booking} live={feed.live} localMock={feed.localMock} stale={!!feed.error} />}
      {!professional && <PaymentCheckout bookingId={booking.id} amount={booking.total_price_paisa} cancelled={booking.status === "cancelled"} />}</article>)}
    </div>}
    <nav aria-label="Booking pages" className="mt-6 flex items-center gap-4">
      <Button variant="outline" disabled={page === 0 || feed.loading} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page + 1}</span>
      <Button variant="outline" disabled={feed.items.length < BOOKING_PAGE_SIZE || feed.loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
    </nav>
  </main>;
}



