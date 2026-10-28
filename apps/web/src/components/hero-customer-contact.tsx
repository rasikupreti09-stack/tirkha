"use client";

import { useEffect, useState } from "react";
import { bookingContactSchema, type BookingContact } from "@tirkha/shared";
import { useAuth } from "./auth-provider";

const DEMO_CUSTOMER_PHONE = "+9779800000000";

/** Loads contact data only through the booking-scoped, participant-authorized RPC. */
export function HeroCustomerContact({ bookingId, demo = false }: { bookingId: string; demo?: boolean }) {
  const { client } = useAuth();
  const [contact, setContact] = useState<BookingContact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setContact(null);
    if (demo) {
      setContact({ full_name: "Demo customer", phone: DEMO_CUSTOMER_PHONE });
      return () => { active = false; };
    }
    if (!client || !bookingId) return () => { active = false; };
    setLoading(true);
    void (async () => {
      try {
        const result = await client.rpc("get_booking_contact", { p_booking_id: bookingId });
        if (!active) return;
        const row = result.data?.[0];
        if (!result.error && row) {
          const parsed = bookingContactSchema.safeParse(row);
          if (parsed.success) setContact(parsed.data);
        }
      } catch { /* A missing permission or offline connection leaves contact hidden. */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [bookingId, client, demo]);

  return <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer contact</p>
    {contact ? <a className="mt-1 inline-flex min-h-10 items-center font-semibold text-emerald-800 underline underline-offset-2" href={`tel:${contact.phone}`}>{contact.full_name || "Call customer"} · {contact.phone}</a>
      : <p className="mt-1 text-sm text-slate-600">{loading ? "Loading booking contact…" : "Contact is available after assignment or through an active dispatch."}</p>}
  </div>;
}
