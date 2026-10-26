
import { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { bookingContactSchema, type BookingContact, type WorkflowBooking } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";

export function BookingCall({ booking }: { booking: WorkflowBooking }) {
  const { client, session } = useAuth();
  const [contact, setContact] = useState<{ key: string; data: BookingContact } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const eligible = !!booking.professional_id && ["accepted", "on_the_way", "in_progress", "completed"].includes(booking.status);
  const key = booking.id + ":" + session?.user.id + ":" + booking.professional_id;
  useEffect(() => {
    let active = true;
    setContact(null); setError("");
    if (eligible && client && session) void (async () => {
      try {
        const result = await client.rpc("get_booking_contact", { p_booking_id: booking.id });
        if (result.error) throw result.error;
        const row = result.data?.[0];
        if (active && row) setContact({ key, data: bookingContactSchema.parse(row) });
      } catch { if (active) setError("Contact unavailable. Try again."); }
    })();
    return () => { active = false; };
  }, [client, key, eligible, retry, booking.id, session]);
  if (!eligible) return null;
  const data = contact?.key === key ? contact.data : null;
  return <View className="mt-3">
    {data && <Pressable accessibilityRole="link" accessibilityLabel={`Call ${data.full_name || "booking contact"}`} onPress={() => { void Linking.openURL("tel:" + data.phone).catch(() => setError("Could not open your phone app.")); }} className="min-h-12 justify-center rounded-md border border-border p-3"><Text className="font-medium text-primary">Call {data.full_name || "booking contact"} · {data.phone}</Text></Pressable>}
    {!!error && <Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} className="min-h-12 justify-center"><Text className="text-primary">{error}</Text></Pressable>}
  </View>;
}

