import { BookingCall } from "./booking-call";
import { Text, View } from "react-native";
import { BOOKING_TRACKING_STEPS, BOOKING_TRACKING_MESSAGES, BOOKING_STATUS_LABELS, formatBookingDate, type WorkflowBooking } from "@tirkha/shared";

export function BookingTrackingCard({ booking, live, localMock, stale }: {
  booking: WorkflowBooking; live: boolean; localMock: boolean; stale: boolean;
}) {
  const current = BOOKING_TRACKING_STEPS.findIndex((status) => status === booking.status);
  return <View className="mt-5 rounded-lg border border-border bg-background p-4">
    <Text accessibilityLiveRegion="polite" className="font-semibold text-primary">Job status: {BOOKING_STATUS_LABELS[booking.status]}. {BOOKING_TRACKING_MESSAGES[booking.status]}</Text>
    {booking.status !== "cancelled" && <View accessibilityRole="progressbar" accessibilityLabel="Booking progress" accessibilityValue={{ min: 0, max: 4, now: current, text: BOOKING_STATUS_LABELS[booking.status] }} className="mt-4 h-2 overflow-hidden rounded-full bg-border">
      <View className="h-full bg-primary" style={{ width: `${current / 4 * 100}%` }} />
    </View>}
    {booking.status !== "cancelled" && <View className="mt-4 gap-2">
      {BOOKING_TRACKING_STEPS.map((status, index) => <Text key={status} className={index <= current ? "rounded-md bg-primary p-3 text-sm text-primary-foreground" : "rounded-md border border-border p-3 text-sm text-muted-foreground"}>
        {index + 1}. {BOOKING_STATUS_LABELS[status]}{status === booking.status ? " (current)" : ""}
      </Text>)}
    </View>}
    <Text className="mt-3 text-xs text-muted-foreground">{stale ? "Refresh failed — showing last loaded status." : localMock ? "Local demo · polling updates" : live ? "Live updates connected" : "Live connection unavailable · polling updates"}</Text>
    <Text className="mt-1 text-xs text-muted-foreground">Status saved: {formatBookingDate(booking.updated_at)}</Text>
    <BookingCall booking={booking} />
  </View>;
}

