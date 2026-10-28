"use client";
import { BookingCall } from "./booking-call";
import { bookingActions, BOOKING_ACTION_LABELS, type BookingAction, type WorkflowBooking } from "@tirkha/shared";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { MapTracker, type TrackedPoint } from "./map-tracker-loader";
import { useAuth } from "./auth-provider";
import { BookingChatDrawer } from "./booking-chat-drawer";

export function ProviderWorkflow({ booking, userId, verified, busy, updating, onAction }: {
  booking: WorkflowBooking; userId: string; verified: boolean; busy: boolean; updating: boolean;
  onAction: (action: BookingAction) => void;
}) {
  const { client } = useAuth();
  const actions = bookingActions(booking, userId, "professional", verified);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; heading: number | null } | null>(null);
  useEffect(() => {
    if (!client || !verified || !["accepted", "on_the_way", "in_progress"].includes(booking.status)) { setCoordinates(null); return; }
    let active = true;
    const channel = client.channel(`hero-tracking:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${userId}` }, payload => {
        const point = payload.new as { latitude: number; longitude: number; heading: number | null; updated_at: string };
        if (active && point?.latitude != null && Date.now() - Date.parse(point.updated_at) <= 90_000) setCoordinates({ latitude: point.latitude, longitude: point.longitude, heading: point.heading });
      }).subscribe();
    void client.from("hero_locations").select("latitude,longitude,heading,updated_at").eq("professional_id", userId).maybeSingle().then(result => {
      const point = result.data;
      if (active && point && Date.now() - Date.parse(point.updated_at) <= 90_000) setCoordinates({ latitude: point.latitude, longitude: point.longitude, heading: point.heading });
    });
    return () => { active = false; void client.removeChannel(channel); };
  }, [booking.status, client, userId, verified]);
  const destination = booking.latitude != null && booking.longitude != null ? { latitude: booking.latitude, longitude: booking.longitude } : null;
  const routePoints: TrackedPoint[] = [...(coordinates ? [{ id: "hero", label: "Your live location", kind: "hero" as const, coordinates, heading: coordinates.heading }] : []), ...(destination ? [{ id: "customer", label: "Customer destination", kind: "customer" as const, coordinates: destination }] : [])];
  return <section className="mt-4 space-y-3" aria-label="Provider job workflow">
    <p className="text-sm text-muted-foreground">Accepted → On the Way → In Progress → Completed</p>
    <div className="flex flex-wrap gap-3">{actions.map((action) => <Button key={action} disabled={busy} onClick={() => onAction(action)}>{updating ? "Updating…" : BOOKING_ACTION_LABELS[action]}</Button>)}</div>
    <BookingCall booking={booking} />
    <BookingChatDrawer bookingId={booking.id} userId={userId} professional disabled={!verified || !["accepted", "on_the_way", "in_progress"].includes(booking.status)} />
    {verified && destination && ["accepted", "on_the_way", "in_progress"].includes(booking.status) && <div className="mt-4"><h3 className="mb-2 font-medium">Route to the customer</h3><MapTracker points={routePoints} origin={coordinates ?? undefined} destination={destination} navigation/></div>}
  </section>;
}

