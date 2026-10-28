"use client";
import { useCallback, useEffect, useState } from "react";
import { formatBookingDate, type Database, type HeroTrade, type WorkflowBooking } from "@tirkha/shared";
import { changeBooking } from "@/lib/bookings";
import { useAuth } from "./auth-provider";
import { HeroCustomerContact } from "./hero-customer-contact";
import { HeroJobLocationMap } from "./hero-job-location-map";
import { Button } from "./ui/button";

type DispatchNotice = Database["public"]["Tables"]["hero_dispatch_notifications"]["Row"];
type DemoAcceptedBooking = Pick<WorkflowBooking, "id" | "category_id" | "service_address" | "job_details" | "status" | "total_price_paisa" | "scheduled_at" | "latitude" | "longitude">;
export function HeroDispatchInbox({ onAccepted, demo = false, trade = null }: { onAccepted: (booking?: DemoAcceptedBooking) => void; demo?: boolean; trade?: HeroTrade | null }) {
  const { client, session } = useAuth();
  const userId = session?.user.id;
  const heroTradeCategory = trade;
  const [items, setItems] = useState<DispatchNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [demoAccepted, setDemoAccepted] = useState(false);
  const demoNotice: DispatchNotice = {
    id: "tirkha-demo-dispatch", booking_id: "tirkha-demo-booking", professional_id: userId ?? "tirkha-demo-hero", status: "new",
    trade_category: trade,
    service_name: trade === "ELECTRICAL" ? "Switchboard safety inspection" : trade === "APPLIANCE_TECHNICIAN" ? "Water pump inspection" : trade === "BEAUTICIAN" ? "Home Salon & Spa consultation" : trade === "PAINTER" ? "Interior painting consultation" : trade === "CLEANER" ? "Deep home cleaning" : trade === "HANDYMAN" ? "General repair inspection" : "Under-sink leak repair",
    diagnostic_summary: `Demo ${trade ?? "unassigned"} request · Confirm service details and scope before work.`,
    diagnostic_severity: "Routine · Demo", diagnostic_urgency: "routine", suggested_parts: trade === "ELECTRICAL" ? ["Inspect breaker and accessible terminals"] : trade === "PLUMBING" ? ["Check accessible joints; confirm parts on site"] : [],
    service_address: "New Baneshwor, Kathmandu · near the main junction", latitude: 27.6915, longitude: 85.342,
    distance_meters: 1800, scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), created_at: new Date().toISOString(),
  };
  const visibleItems = demo ? (demoAccepted || !trade ? [] : [demoNotice]) : trade ? items.filter(item => item.trade_category === trade) : [];
  const refresh = useCallback(async () => {
    if (demo) { setLoading(false); return; }
    if (!client || !userId) return;
    if (!heroTradeCategory) { setItems([]); setError(""); setLoading(false); return; }
    const { data, error: loadError } = await client.from("hero_dispatch_notifications")
      .select("*").eq("professional_id", userId).eq("trade_category", heroTradeCategory).in("status", ["new", "seen"])
      .order("created_at", { ascending: false }).limit(20);
    if (loadError) { setError("Nearby job alerts are temporarily unavailable. Refresh the jobs list to check for requests."); }
    else { setItems(data ?? []); setError(""); }
    setLoading(false);
  }, [client, userId, demo, trade]);
  useEffect(() => {
    if (demo) { setLoading(false); return; }
    if (!client || !userId || !heroTradeCategory) { setLoading(false); setItems([]); return; }
    let active = true;
    const load = async () => { if (active) await refresh(); };
    void load();
    const channel = client.channel(`hero-dispatch:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_dispatch_notifications", filter: `trade_category=eq.${heroTradeCategory}` }, () => void load())
      .subscribe();
    const timer = window.setInterval(() => void load(), 30_000);
    window.addEventListener("focus", load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", load); void client.removeChannel(channel); };
  }, [client, userId, refresh, demo, trade]);
  async function accept(item: DispatchNotice) {
    if (busy) return;
    setBusy(item.id); setError("");
    if (demo) {
      setDemoAccepted(true);
      onAccepted({ id: item.booking_id, category_id: `demo-${trade?.toLowerCase() ?? "plumbing"}`, service_address: item.service_address, job_details: item.diagnostic_summary ?? "Demo service request", status: "accepted", total_price_paisa: null, scheduled_at: item.scheduled_at, latitude: item.latitude, longitude: item.longitude });
      setBusy(null);
      return;
    }
    try { await changeBooking(item.booking_id, "accepted"); await refresh(); onAccepted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This request is no longer available. Refresh and try again."); await refresh(); }
    finally { setBusy(null); }
  }
  if (!demo && loading && !items.length) return <section className="mb-6 rounded-xl border bg-card p-5" aria-label="Nearby job dispatch"><h2 className="text-lg font-semibold">Nearby requests</h2><p className="mt-2 text-sm text-muted-foreground">Checking for nearby service requests…</p></section>;
  return <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5" aria-label="Nearby job dispatch">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">{demo ? "Demo Dispatch" : "Hero Dispatch"}</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Nearby service requests</h2></div><span className="rounded-full bg-white px-3 py-1 text-xs text-slate-600">{demo ? "Interactive preview · local only" : "Live alerts · within 20 km"}</span></div>
    {error && <p role="alert" className="mt-3 rounded-md border border-amber-300 bg-white p-3 text-sm text-amber-900">{error}</p>}
    {!trade && <p className="mt-3 text-sm text-slate-600">Choose a trade specialty in your Hero profile to receive matching requests.</p>}
    {!!trade && !error && !visibleItems.length && <p className="mt-3 text-sm text-slate-600">{demo ? "Demo request accepted. Its status is now in your active job list." : "No nearby requests for your trade right now. Keep your availability on to receive matching jobs."}</p>}
    {visibleItems.length > 0 && <div className="mt-4 space-y-3">{visibleItems.map(item => <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">{item.service_name}</h3><p className="mt-1 text-sm text-slate-600">{item.distance_meters == null ? "Assigned directly to you" : `${(item.distance_meters / 1000).toFixed(1)} km away`} · {formatBookingDate(item.scheduled_at)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.diagnostic_urgency === "urgent" ? "bg-rose-100 text-rose-800" : item.diagnostic_urgency === "soon" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>{item.diagnostic_severity || (item.diagnostic_urgency ? item.diagnostic_urgency.toUpperCase() : "Routine")}</span></div>
      <p className="mt-3 text-sm text-slate-700">{item.diagnostic_summary || "Customer has not added an AI triage summary. Review the request details before accepting."}</p>
      <p className="mt-2 text-sm text-slate-700"><strong>Customer location:</strong> {item.service_address}</p>
      <HeroCustomerContact bookingId={item.booking_id} demo={demo} />
      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="font-semibold text-slate-900">Estimated price: Rs. 650–1,000</p><p className="mt-1 text-xs text-slate-600">Indicative inspection and minor-work range only. The Hero confirms labour and materials on site; customer approval is required before extra work.</p></div>
      {item.suggested_parts.length > 0 && <div className="mt-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Possible parts · verify on site</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{item.suggested_parts.map((part, index) => <li key={`${item.id}-part-${index}`}>{part}</li>)}</ul></div>}
      {item.latitude != null && item.longitude != null && <HeroJobLocationMap professionalId={userId ?? "tirkha-demo-hero"} destination={{ latitude: item.latitude, longitude: item.longitude }} destinationLabel={item.service_address} demo={demo} />}
      <div className="mt-3"><Button disabled={busy !== null} onClick={() => void accept(item)}>{busy === item.id ? "Accepting…" : "Accept this nearby job"}</Button></div>
    </article>)}</div>}
  </section>;
}
