"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Banknote, BriefcaseBusiness, MapPin, Power, ReceiptText, ShieldCheck } from "lucide-react";
import { catalogMoney, heroQuoteInputSchema, type HeroOperationalZone, type HeroTrade, type ProfessionalJobQuote, type WorkflowBooking } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";
import { HeroDispatchInbox } from "@/components/hero-dispatch-inbox";
import { HeroGpsTracker } from "@/components/hero-gps-tracker";
import { Button } from "@/components/ui/button";

const zoneLabels: Record<HeroOperationalZone, string> = { Kathmandu: "Kathmandu", Lalitpur: "Lalitpur", Bhaktapur: "Bhaktapur", Baneshwor: "Baneshwor / New Baneshwor", Thamel: "Thamel", Kirtipur: "Kirtipur" };
type HeroAccess = { verification_status: "pending" | "verified" | "rejected"; suspended_at: string | null; operational_zone: HeroOperationalZone | null; trade_code: HeroTrade | null };
type WorkBooking = Pick<WorkflowBooking, "id" | "category_id" | "service_address" | "job_details" | "status" | "total_price_paisa" | "scheduled_at">;

function getCurrentCoordinates() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser does not support GPS.")); return; }
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => reject(new Error("Location permission is needed to go online.")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  });
}

export default function HeroDashboardPage() {
  const { client, session, loading } = useAuth();
  const router = useRouter();
  const [access, setAccess] = useState<HeroAccess | null>(null);
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<WorkBooking[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heroId = session?.user.id;

  const refresh = useCallback(async () => {
    if (!client || !heroId) { setLoadingData(false); return; }
    const [profileResult, locationResult, activeResult, categoryResult] = await Promise.all([
      client.from("professional_profiles").select("verification_status,suspended_at,operational_zone,trade_code").eq("profile_id", heroId).maybeSingle(),
      client.from("hero_locations").select("updated_at").eq("professional_id", heroId).maybeSingle(),
      client.from("bookings").select("id,category_id,service_address,job_details,status,total_price_paisa,scheduled_at").eq("professional_id", heroId).in("status", ["accepted", "on_the_way", "in_progress"]).order("scheduled_at", { ascending: true }),
      client.from("service_categories").select("id,name"),
    ]);
    if (profileResult.error) { setError("Could not load Hero verification. Ensure migration 21 is applied."); setLoadingData(false); return; }
    setAccess(profileResult.data as HeroAccess | null);
    setOnline(!!locationResult.data && Date.now() - Date.parse(locationResult.data.updated_at) < 90_000);
    if (activeResult.error) setError("Could not load your active work list."); else setJobs((activeResult.data ?? []) as WorkBooking[]);
    if (!categoryResult.error) setCategories(new Map((categoryResult.data ?? []).map(row => [row.id, row.name])));
    setLoadingData(false);
  }, [client, heroId]);

  useEffect(() => { if (!loading && !session) router.replace("/login?next=%2Fhero%2Fdashboard"); }, [loading, session, router]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!client || !heroId) return;
    const channel = client.channel(`hero-portal:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${heroId}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${heroId}` }, () => void refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "professional_profiles", filter: `profile_id=eq.${heroId}` }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [client, heroId, refresh]);

  async function toggleAvailability() {
    if (!client || busy) return;
    setBusy(true); setError("");
    try {
      if (online) {
        const { error: rpcError } = await client.rpc("set_hero_availability", { p_online: false });
        if (rpcError) throw rpcError;
        setOnline(false);
      } else {
        const coordinates = await getCurrentCoordinates();
        const { error: rpcError } = await client.rpc("set_hero_availability", { p_online: true, p_latitude: coordinates.latitude, p_longitude: coordinates.longitude });
        if (rpcError) throw rpcError;
        setOnline(true);
      }
      await refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Availability could not be changed."); }
    finally { setBusy(false); }
  }

  if (loading || loadingData) return <main className="mx-auto max-w-6xl p-6" role="status">Loading your Hero workspace…</main>;
  if (!session) return null;
  if (!access) return <main className="mx-auto max-w-xl p-6 py-16"><section className="rounded-2xl border bg-white p-7"><h1 className="text-2xl font-semibold">Hero profile not found</h1><p className="mt-2 text-slate-600">Submit a Hero registration before opening the work dashboard.</p><Link className="mt-5 inline-block text-emerald-800 underline" href="/hero/register">Start registration</Link></section></main>;
  if (access.verification_status !== "verified" || access.suspended_at) return <main className="mx-auto max-w-3xl space-y-5 p-4 py-10 sm:p-8"><div className="rounded-2xl border bg-white p-7"><ShieldCheck className="text-amber-700"/><h1 className="mt-3 text-2xl font-semibold">{access.suspended_at ? "Hero access suspended" : access.verification_status === "rejected" ? "Application needs attention" : "Verification in progress"}</h1><p className="mt-2 text-slate-600">{access.suspended_at ? "Contact Tirkha operations to review your account status." : access.verification_status === "rejected" ? "Your application was not approved. You can update your details and resubmit identity verification." : "Your account remains offline until Tirkha operations verifies your identity and trade."}</p><Link className="mt-5 inline-block rounded-lg border px-4 py-2 font-medium" href="/hero/register">Review application</Link></div></main>;

  return <main className="mx-auto max-w-7xl space-y-6 p-4 py-8 sm:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Tirkha | तिर्खा · Hero portal</p><h1 className="mt-2 text-3xl font-semibold">Your work, clearly organized.</h1><p className="mt-1 text-sm text-slate-600">{access.trade_code} · {access.operational_zone ? zoneLabels[access.operational_zone] : "Zone not set"} · Nearby jobs use trade, zone and GPS eligibility.</p></div><button type="button" disabled={busy || (online && jobs.length > 0)} onClick={() => void toggleAvailability()} className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-55 ${online ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-800 hover:bg-slate-900"}`}><Power size={18}/>{busy ? "Updating…" : online ? "Online · Go offline" : "Offline · Go online"}</button></header>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><Stat icon={<Activity/>} label="Availability" value={online ? "Online" : "Offline"}/><Stat icon={<BriefcaseBusiness/>} label="Active work" value={String(jobs.length)}/><Stat icon={<MapPin/>} label="Service zone" value={access.operational_zone ? zoneLabels[access.operational_zone] : "Not set"}/></section>
    <HeroGpsTracker enabled={online}/>
    <HeroDispatchInbox onAccepted={() => void refresh()}/>
    <section className="space-y-3"><div><h2 className="text-xl font-semibold">My active jobs</h2><p className="text-sm text-slate-600">Written estimates can be submitted only after the job is marked in progress and physically inspected.</p></div>{jobs.length === 0 ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">No assigned active jobs yet. Keep availability online to see nearby eligible requests.</div> : jobs.map(job => <article key={job.id} className="grid gap-4 rounded-xl border bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]"><div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase">{job.status.replaceAll("_", " ")}</span><h3 className="mt-3 font-semibold">{categories.get(job.category_id) ?? "Service"}</h3><p className="mt-1 text-sm text-slate-600">{job.service_address}</p><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{job.job_details}</p><p className="mt-3 text-xs text-slate-500">Scheduled {new Date(job.scheduled_at).toLocaleString()}</p>{job.status === "in_progress" && <QuoteForm bookingId={job.id}/>}</div>{job.status === "in_progress" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h4 className="flex items-center gap-2 font-semibold"><ReceiptText size={18}/> On-site written quote</h4><p className="mt-2 text-sm text-emerald-950">Inspect the work in person, then submit labour and materials as separate NPR amounts. The customer must review the written scope before any extra work starts.</p></div> : <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{job.status === "accepted" ? "Mark the job in progress from My Bookings after reaching the customer and beginning the inspection." : "Use the booking workflow to update the current job status."}<Link className="mt-3 block font-medium text-emerald-800 underline" href="/jobs">Open Job Board / Bookings</Link></div>}</article>)}</section>
    <div className="flex justify-end"><Link href="/hero/history" className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-3 font-semibold"><Banknote size={18}/> View completed-job earnings</Link></div>
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="flex items-center gap-4 rounded-xl border bg-white p-5"><span className="rounded-lg bg-slate-100 p-3 text-emerald-800">{icon}</span><span><small className="block text-slate-500">{label}</small><strong className="text-lg">{value}</strong></span></article>; }

function QuoteForm({ bookingId }: { bookingId: string }) {
  const { client } = useAuth();
  const [labor, setLabor] = useState("");
  const [materials, setMaterials] = useState("");
  const [breakdown, setBreakdown] = useState("");
  const [scope, setScope] = useState("");
  const [quote, setQuote] = useState<ProfessionalJobQuote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!client) return;
    void client.from("professional_job_quotes").select("*").eq("booking_id", bookingId).maybeSingle().then(({ data }) => setQuote(data));
  }, [client, bookingId]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!client || busy) return;
    setError("");
    const quoteInput = heroQuoteInputSchema.safeParse({ labor_paisa: Math.round(Number(labor) * 100), materials_paisa: Math.round(Number(materials) * 100), materials_breakdown: breakdown, scope });
    if (!quoteInput.success) { setError("Enter valid NPR amounts, itemize materials, and describe the inspected job scope (at least 10 characters)."); return; }
    setBusy(true);
    const { data, error: rpcError } = await client.rpc("submit_professional_job_quote", { p_booking_id: bookingId, p_labor_paisa: quoteInput.data.labor_paisa, p_materials_paisa: quoteInput.data.materials_paisa, p_materials_breakdown: quoteInput.data.materials_breakdown, p_scope: quoteInput.data.scope });
    if (rpcError) setError(rpcError.message.includes("ON_SITE_INSPECTION_REQUIRED") ? "Only submit after the booking is in progress and you have inspected it on site." : rpcError.message);
    else setQuote(data);
    setBusy(false);
  }
  if (quote) return <div className="mt-5 rounded-xl border bg-slate-50 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><ReceiptText size={16}/> Written quote submitted · {new Date(quote.created_at).toLocaleString()}</div><p className="mt-2">Labour: {catalogMoney(quote.labor_paisa)} · Materials: {catalogMoney(quote.materials_paisa)}</p><p className="mt-1 font-semibold">Total: {catalogMoney(quote.total_paisa)}</p><p className="mt-2 whitespace-pre-wrap text-slate-600">{quote.scope}</p></div>;
  return <form onSubmit={event => void submit(event)} className="mt-5 space-y-3 rounded-xl border bg-white p-4"><h4 className="font-semibold">Create itemized inspection quote</h4><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Labour (NPR)<input className="rounded-md border px-3 py-2 text-sm" type="number" min="0" step="0.01" value={labor} onChange={event => setLabor(event.target.value)} required/></label><label className="grid gap-1 text-xs font-medium">Materials & spares (NPR)<input className="rounded-md border px-3 py-2 text-sm" type="number" min="0" step="0.01" value={materials} onChange={event => setMaterials(event.target.value)} required/></label></div><label className="grid gap-1 text-xs font-medium">Material / spare itemization<textarea className="rounded-md border px-3 py-2 text-sm" rows={2} placeholder="Item, quantity, unit price" value={breakdown} onChange={event => setBreakdown(event.target.value)} required/></label><label className="grid gap-1 text-xs font-medium">Inspection findings and job scope<textarea className="rounded-md border px-3 py-2 text-sm" rows={3} minLength={10} value={scope} onChange={event => setScope(event.target.value)} required/></label>{error && <p role="alert" className="text-sm text-rose-700">{error}</p>}<Button disabled={busy}>{busy ? "Submitting…" : "Submit written quote"}</Button></form>;
}
