"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { HeroCommHub } from "./hero-comm-hub";

/** An on-demand chat surface for one active, participant-owned booking. */
export function BookingChatDrawer({ bookingId, userId, professional, disabled = false }: {
  bookingId: string;
  userId: string;
  professional: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-900 hover:bg-slate-50">
      <MessageCircle size={17} aria-hidden="true" /> Open booking chat
    </button>
    {open && <div className="fixed inset-0 z-[1000] flex justify-end bg-slate-950/45" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Booking chat" className="h-full w-full max-w-2xl overflow-y-auto bg-background p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex justify-end">
          <button type="button" autoFocus onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 font-medium" aria-label="Close booking chat"><X size={17} /> Close</button>
        </div>
        <HeroCommHub key={`${bookingId}:${userId}`} bookingId={bookingId} userId={userId} professional={professional} embedded initialTab="hero" />
      </section>
    </div>}
  </>;
}
