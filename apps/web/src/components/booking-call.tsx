"use client";
import { useEffect, useState } from "react";

import { bookingContactSchema, type BookingContact, type WorkflowBooking } from "@tirkha/shared";
import { useAuth } from "./auth-provider";
import { InAppCallModal } from "./booking-voice-call";

export function BookingCall({ booking }: { booking: WorkflowBooking }) {
  const { client, session } = useAuth();
  const [contact, setContact] = useState<{ key: string; data: BookingContact } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const eligible = !!booking.professional_id && ["requested", "accepted", "on_the_way", "in_progress"].includes(booking.status);
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
  if (!eligible) return booking.status === "requested" ? <p className="mt-3 text-sm text-muted-foreground">Voice call becomes available as soon as a Hero is assigned to this request.</p> : null;
  const data = contact?.key === key ? contact.data : null;
  return <div className="mt-3">
    {data && <><a className="inline-flex min-h-11 items-center rounded-md border px-3 font-medium underline" href={"tel:" + data.phone}>Call {data.full_name || "booking contact"} · {data.phone}</a><InAppCallModal bookingId={booking.id} active={["requested", "accepted", "on_the_way", "in_progress"].includes(booking.status)} phoneNumber={data.phone}/></>}
    {error && <button type="button" className="min-h-11 underline" onClick={() => setRetry(n => n + 1)}>{error}</button>}
  </div>;
}

