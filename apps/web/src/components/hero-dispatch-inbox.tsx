"use client";
import { useCallback, useEffect, useState } from "react";
import { formatBookingDate, type Database } from "@tirkha/shared";
import { changeBooking } from "@/lib/bookings";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";

type DispatchNotice = Database["public"]["Tables"]["hero_dispatch_notifications"]["Row"];
export function HeroDispatchInbox({ onAccepted }: { onAccepted: () => void }) {
  const { client, session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<DispatchNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const { data, error: loadError } = await client.from("hero_dispatch_notifications")
      .select("*").eq("professional_id", userId).in("status", ["new", "seen"])
      .order("created_at", { ascending: false }).limit(20);
    if (loadError) { setError("Nearby job alerts are temporarily unavailable. Refresh the jobs list to check for requests."); }
    else { setItems(data ?? []); setError(""); }
    setLoading(false);
  }, [client, userId]);
  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    const load = async () => { if (active) await refresh(); };
    void load();
    const channel = client.channel(`hero-dispatch:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_dispatch_notifications", filter: `professional_id=eq.${userId}` }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); void client.removeChannel(channel); };
  }, [client, userId, refresh]);
  async function accept(item: DispatchNotice) {
    if (busy) return;
    setBusy(item.id); setError("");
    try { await changeBooking(item.booking_id, "accepted"); await refresh(); onAccepted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This request is no longer available. Refresh and try again."); await refresh(); }
    finally { setBusy(null); }
  }
  if (loading && !items.length) return <section className="mb-6 rounded-xl border bg-card p-5" aria-label="Nearby job dispatch"><h2 className="text-lg font-semibold">Nearby requests</h2><p className="mt-2 text-sm text-muted-foreground">Checking for nearby service requests…</p></section>;
  return <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5" aria-label="Nearby job dispatch">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Hero Dispatch</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Nearby service requests</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">Live alerts · within 20 km</span></div>
    {error && <p role="alert" className="mt-3 rounded-md border border-amber-300 bg-white p-3 text-sm text-amber-900">{error}</p>}
    {!error && !items.length && <p className="mt-3 text-sm text-slate-600">No nearby requests right now. Keep your availability on to receive matching jobs.</p>}
    {items.length > 0 && <div className="mt-4 space-y-3">{items.map(item => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{item.service_name}</h3><p className="mt-1 text-sm text-slate-600">{item.distance_meters == null ? "Assigned directly to you" : `${(item.distance_meters / 1000).toFixed(1)} km away`} · {formatBookingDate(item.scheduled_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.diagnostic_urgency === "urgent" ? "bg-rose-100 text-rose-800" : item.diagnostic_urgency === "soon" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{item.diagnostic_severity || (item.diagnostic_urgency ? item.diagnostic_urgency.toUpperCase() : "Routine")}</span></div>
      <p className="mt-3 text-sm text-slate-700">{item.diagnostic_summary || "Customer has not added an AI triage summary. Review the request details before accepting."}</p>
      <p className="mt-2 text-sm text-slate-700"><strong>Customer location:</strong> {item.service_address}</p>
      {item.suggested_parts.length > 0 && <div className="mt-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Possible parts · verify on site</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{item.suggested_parts.map((part, index) => <li key={`${item.id}-part-${index}`}>{part}</li>)}</ul></div>}
      {item.latitude != null && item.longitude != null && <a className="mt-3 inline-block text-sm font-medium text-emerald-800 underline" href={`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Open pinned location in Maps</a>}
      <div className="mt-3"><Button disabled={busy !== null} onClick={() => void accept(item)}>{busy === item.id ? "Accepting…" : "Accept this nearby job"}</Button></div>
    </article>)}</div>}
  </section>;
}
