import { BookingCall } from "./booking-call";
import { Pressable, Text, View } from "react-native";
import { bookingActions, BOOKING_ACTION_LABELS, type BookingAction, type WorkflowBooking } from "@tirkha/shared";

export function ProviderWorkflow({ booking, userId, verified, busy, updating, onAction }: {
  booking: WorkflowBooking; userId: string; verified: boolean; busy: boolean; updating: boolean;
  onAction: (action: BookingAction) => void;
}) {
  const actions = bookingActions(booking, userId, "professional", verified);
  return <View className="mt-4 gap-3">
    <Text className="text-sm text-muted-foreground">Accepted → On the Way → In Progress → Completed</Text>
    {actions.map((action) => <Pressable key={action} accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => onAction(action)} className="min-h-12 justify-center rounded-md bg-primary p-3">
      <Text className="font-medium text-primary-foreground">{updating ? "Updating…" : BOOKING_ACTION_LABELS[action]}</Text>
    </Pressable>)}
    <BookingCall booking={booking} />
  </View>;
}

