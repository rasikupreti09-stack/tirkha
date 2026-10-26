import { z } from "zod";

export type BookingSubscriptionTarget =
  | { booking_id: string }
  | { user_id: string; role: "customer" | "professional" }
  | { available: true };

// A small structural interface keeps React and platform-specific Supabase
// initialization out of shared. Real Supabase channels satisfy this contract.
export interface BookingRealtimeChannel {
  on(type: "postgres_changes", filter: { event: "INSERT" | "UPDATE"; schema: string; table: string; filter: string }, callback: () => void): BookingRealtimeChannel;
  subscribe(callback: (status: string) => void): unknown;
}
let subscriptionId = 0;
export function subscribeToBookings<T extends BookingRealtimeChannel>(
  client: { channel(name: string): T; removeChannel(channel: T): Promise<unknown> },
  target: BookingSubscriptionTarget,
  options: { onChange: () => void; onStatus?: (live: boolean) => void; enabled?: boolean },
): () => void {
  let filter: string;
  if ("booking_id" in target) filter = `id=eq.${z.uuid().parse(target.booking_id)}`;
  else if ("user_id" in target) {
    const role = z.enum(["customer", "professional"]).parse(target.role);
    filter = `${role === "customer" ? "customer_id" : "professional_id"}=eq.${z.uuid().parse(target.user_id)}`;
  } else filter = "status=eq.requested";
  if (options.enabled === false) { options.onStatus?.(false); return () => {}; }
  let active = true;
  const channel = client.channel(`bookings:${filter}:${++subscriptionId}`);
  const changed = () => { if (active) options.onChange(); };
  channel.on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings", filter }, changed);
  channel.on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter }, changed);
  channel.subscribe((status) => {
    if (!active) return;
    options.onStatus?.(status === "SUBSCRIBED");
    // Re-fetch on every connection/reconnection to close subscription gaps.
    if (status === "SUBSCRIBED") changed();
  });
  return () => {
    if (!active) return;
    active = false;
    void client.removeChannel(channel).catch(() => {});
  };
}
