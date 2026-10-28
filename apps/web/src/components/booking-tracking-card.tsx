"use client";
import { BookingCall } from "./booking-call";
import { BOOKING_TRACKING_STEPS, BOOKING_TRACKING_MESSAGES, BOOKING_STATUS_LABELS, formatBookingDate, type WorkflowBooking } from "@tirkha/shared";
import { CustomerRouteTracker } from "./customer-route-tracker";
import { BookingChatDrawer } from "./booking-chat-drawer";

// The list owns one shared subscription for the user, not a socket per card.
export function BookingTrackingCard({ booking, live, localMock, stale, userId }: {
  booking: WorkflowBooking; live: boolean; localMock: boolean; stale: boolean; userId: string;
}) {
  const current = BOOKING_TRACKING_STEPS.findIndex((status) => status === booking.status);
  return <section aria-label="Booking tracking" className="mt-5 rounded-lg border border-border bg-background p-4">
    <div role="status" aria-live="polite">
      <h3 className="font-semibold">Job status: {BOOKING_STATUS_LABELS[booking.status]}</h3>
      <p className="mt-2 text-sm">{BOOKING_TRACKING_MESSAGES[booking.status]}</p>
    </div>
    {booking.status !== "cancelled" && <div role="progressbar" aria-label="Booking progress" aria-valuemin={0} aria-valuemax={4} aria-valuenow={current} aria-valuetext={BOOKING_STATUS_LABELS[booking.status]} className="mt-4 h-2 overflow-hidden rounded-full bg-border">
      <div className="h-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${current / 4 * 100}%` }} />
    </div>}
    {booking.status !== "cancelled" && <ol aria-label="Booking progress" className="mt-4 flex flex-wrap gap-2">
      {BOOKING_TRACKING_STEPS.map((status, index) => <li key={status} aria-current={status === booking.status ? "step" : undefined} className={index <= current ? "rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground" : "rounded-md border px-3 py-2 text-xs text-muted-foreground"}>
        {index + 1}. {BOOKING_STATUS_LABELS[status]}{status === booking.status ? " (current)" : ""}
      </li>)}
    </ol>}
    <p className="mt-3 text-xs text-muted-foreground">{stale ? "Refresh failed — showing last loaded status." : localMock ? "Local demo · polling updates" : live ? "Live updates connected" : "Live connection unavailable · polling updates"}</p>
    <p className="mt-1 text-xs text-muted-foreground">Status saved: {formatBookingDate(booking.updated_at)}</p>
    <BookingCall booking={booking} />
    <BookingChatDrawer bookingId={booking.id} userId={userId} professional={false} disabled={!booking.professional_id || !["requested", "accepted", "on_the_way", "in_progress"].includes(booking.status)} />
    <CustomerRouteTracker booking={booking}/>
  </section>;
}

