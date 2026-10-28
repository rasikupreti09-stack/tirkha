"use client";
import { useState } from "react";
import Link from "next/link";
import { Bot, ImagePlus, PhoneCall, Send } from "lucide-react";
import { BOOKING_STATUS_LABELS, formatBookingDate } from "@tirkha/shared";
import { Button } from "./ui/button";
import { useBookingChat } from "@/hooks/use-booking-chat";
import { BookingVoiceCall } from "./booking-voice-call";

export function HeroCommHub({ bookingId, userId, professional, embedded = false, initialTab = "ai" }: { bookingId: string; userId: string; professional: boolean; embedded?: boolean; initialTab?: "ai" | "hero" }) {
  const [tab, setTab] = useState<"ai" | "hero">(initialTab);
  const chat = useBookingChat(bookingId, userId);
  const canCall = !!chat.booking?.professional_id && ["requested", "accepted", "on_the_way", "in_progress"].includes(chat.booking.status);
  const Container = embedded ? "section" : "main";
  return <Container className={embedded ? "w-full" : "mx-auto min-h-screen max-w-3xl px-4 py-8"}>
    {!embedded && <Link href={professional ? "/jobs" : "/bookings"} className="underline">← Bookings</Link>}
    <h1 className={`${embedded ? "text-xl" : "mt-6 text-3xl"} font-semibold`}>Tirkha | तिर्खा communication hub</h1>
    {chat.booking && <p className="mt-2">Booking status: {BOOKING_STATUS_LABELS[chat.booking.status]}</p>}
    {canCall ? <BookingVoiceCall bookingId={bookingId} active={canCall}/> : !chat.booking ? <button type="button" disabled aria-label="Call controls loading booking status" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm text-muted-foreground">Phone call · checking request</button> : chat.booking.status === "requested" && <button type="button" disabled className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm text-muted-foreground">Phone call · available when a Hero is assigned</button>}
    <div className="mt-6 flex gap-2 border-b" role="tablist" aria-label="Communication options">
      <button role="tab" aria-selected={tab === "ai"} className="min-h-11 border-b-2 px-3" onClick={() => setTab("ai")}><Bot className="mr-2 inline" size={16}/>AI Support Concierge</button>
      <button role="tab" aria-selected={tab === "hero"} className="min-h-11 border-b-2 px-3" onClick={() => setTab("hero")}><PhoneCall className="mr-2 inline" size={16}/>Hero Direct Chat</button>
    </div>
    {tab === "ai" ? <section role="tabpanel" className="mt-5 rounded-xl border p-5"><h2 className="text-xl font-semibold">24/7 service concierge</h2><p className="mt-2 text-sm text-muted-foreground">Ask about service scopes, pricing, coverage, safety, or describe the issue. The assistant can collect severity, area, and preferred time before adding a service to your cart.</p><Button className="mt-4" onClick={() => { window.dispatchEvent(new Event("tirkha:open-assistant")); }}>Open AI Concierge</Button></section> : <section role="tabpanel" className="mt-5">
      <p className="text-sm text-muted-foreground">{chat.localMock ? "Local mock conversation" : chat.live ? "Live updates connected" : "Connecting live updates"} · refreshes every 15 seconds</p>
      <div className="my-4 flex flex-wrap gap-3"><Button variant="outline" onClick={chat.refresh}>Refresh</Button><Button variant="outline" disabled={!chat.hasOlder || chat.loading} onClick={chat.older}>Older messages</Button><Button variant="outline" onClick={chat.latest}>Latest messages</Button></div>
      {chat.error && <p role="alert">{chat.error}</p>}{chat.loading && <p role="status">Refreshing conversation…</p>}
      <div role="log" aria-label="Booking messages" aria-live="polite" className="my-5 space-y-3">{!chat.messages.length && !chat.loading && !chat.error && <p>No messages yet.</p>}{chat.messages.map(message => <article key={message.id} className={message.sender_id === userId ? "ml-6 rounded-lg border bg-muted p-4" : "mr-6 rounded-lg border bg-card p-4"}><p className="text-xs font-semibold">{message.sender_id === userId ? "You" : "Booking participant"} · {formatBookingDate(message.created_at)}</p>{message.attachment_path && chat.imageUrls[message.attachment_path] ? <a href={chat.imageUrls[message.attachment_path]} target="_blank" rel="noreferrer"><img className="mt-3 max-h-72 rounded object-contain" src={chat.imageUrls[message.attachment_path]} alt="Photo shared for this booking"/></a> : <p className="mt-2 whitespace-pre-wrap break-words">{message.body}</p>}</article>)}</div>
      {chat.booking && !chat.writable && <p className="rounded-md border p-4">{chat.booking.professional_id ? "This booking is closed. Message history is read-only." : "Hero chat becomes available when a professional is assigned."}</p>}
      {chat.writable && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void chat.send(); }}><label htmlFor="hub-chat-message" className="font-medium">Message your Hero</label><textarea id="hub-chat-message" maxLength={2000} rows={3} value={chat.draft} disabled={chat.sending} onChange={event => chat.setDraft(event.target.value)} className="w-full rounded-md border bg-background p-3"/><div className="flex flex-wrap gap-3"><Button type="submit" disabled={chat.sending || !chat.draft.trim()}><Send size={16} className="mr-2"/>{chat.sending ? "Sending…" : "Send message"}</Button><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium"><ImagePlus size={16}/>Attach a site photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled={chat.sending} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void chat.sendAttachment(file); event.currentTarget.value = ""; }}/></label></div>{chat.sendError && <p role="alert">{chat.sendError}</p>}</form>}
      {chat.booking?.status === "requested" && !chat.booking.professional_id && <p className="mt-3 text-sm text-muted-foreground">Voice calling is ready once a Hero is assigned to this request. You can open chat now and start messaging after assignment.</p>}
    </section>}
  </Container>;
}
