"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Banknote, BriefcaseBusiness, MapPin, Power, ReceiptText, ShieldCheck } from "lucide-react";
import { catalogMoney, heroQuoteInputSchema, nextBookingStatus, workflowBookingSchema, type CompletedTransaction, type HeroOperationalZone, type HeroTrade, type ProfessionalJobQuote, type WorkflowBooking } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";
import { HeroDispatchInbox } from "@/components/hero-dispatch-inbox";
import { HeroGpsTracker } from "@/components/hero-gps-tracker";
import { HeroCustomerContact } from "@/components/hero-customer-contact";
import { HeroJobLocationMap } from "@/components/hero-job-location-map";
import { BookingChatDrawer } from "@/components/booking-chat-drawer";
import { BookingCall } from "@/components/booking-call";
import { HeroRouteGuard } from "@/components/hero-route-guard";
import { Button } from "@/components/ui/button";

const tradeLabels: Record<HeroTrade, string> = { PLUMBING: "🚰 Plumber (प्लम्बर)", ELECTRICAL: "⚡ Electrician (इलेक्ट्रीशियन)", APPLIANCE_TECHNICIAN: "🔌 Appliance Repair (उपकरण मर्मत)", BEAUTICIAN: "✨ Beautician (सौन्दर्य सेवा)", PAINTER: "🎨 Painter (पेन्टर)", CLEANER: "🧹 Cleaner / Maid (सरसफाई)", HANDYMAN: "🛠️ General Handyman / Repair (सामान्य मर्मत)" };
const zoneLabels: Record<HeroOperationalZone, string> = { Kathmandu: "Kathmandu", Lalitpur: "Lalitpur", Bhaktapur: "Bhaktapur", Baneshwor: "Baneshwor / New Baneshwor", Thamel: "Thamel", Kirtipur: "Kirtipur" };
type HeroAccess = { verification_status: "pending" | "verified" | "rejected"; suspended_at: string | null; operational_zone: HeroOperationalZone | null; trade_code: HeroTrade | null; trade_category: HeroTrade | null };
type WorkBooking = Pick<WorkflowBooking, "id" | "category_id" | "service_address" | "job_details" | "status" | "total_price_paisa" | "scheduled_at" | "latitude" | "longitude">;
const demoEarningsKey = "tirkha.demo-hero-earnings.v1";
const demoJobsKey = "tirkha.demo-hero-jobs.v1";
const demoAvailabilityKey = "tirkha.demo-hero-online.v1";
function readDemoArray<T>(key: string): T[] { try { const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(value) ? value as T[] : []; } catch { return []; } }

function getCurrentCoordinates() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser does not support GPS.")); return; }
    navigator.geolocation.getCurrentPosition(position => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => reject(new Error("Location permission is needed to go online.")), { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  });
}

export default function HeroDashboardPage() {
  return <HeroRouteGuard><HeroDashboardContent /></HeroRouteGuard>;
}

function HeroDashboardContent() {
  const { client, session, loading } = useAuth();
  const router = useRouter();
  const [access, setAccess] = useState<HeroAccess | null>(null);
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<WorkBooking[]>([]);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoProfile, setDemoProfile] = useState(false);
  const [demoEarnings, setDemoEarnings] = useState<CompletedTransaction[]>([]);
  const [selectedMapJobId, setSelectedMapJobId] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>(async () => undefined);
  const heroId = session?.user.id;
  const jobDestinations = useMemo(() => new Map(jobs
    .filter(job => job.latitude != null && job.longitude != null)
    .map(job => [job.id, { latitude: job.latitude!, longitude: job.longitude! }] as const)), [jobs]);
  const visibleMapJobId = selectedMapJobId && jobDestinations.has(selectedMapJobId) ? selectedMapJobId : jobDestinations.keys().next().value ?? null;

  const refresh = useCallback(async () => {
    if (session?.user.user_metadata.demo_auth === true && heroId) {
      const metadataTrade = session.user.user_metadata.trade_category;
      const trade = typeof metadataTrade === "string" && ["PLUMBING", "ELECTRICAL", "APPLIANCE_TECHNICIAN", "BEAUTICIAN", "PAINTER", "CLEANER", "HANDYMAN"].includes(metadataTrade) ? metadataTrade as HeroTrade : null;
      setDemoProfile(true);
      setAccess({ verification_status: "pending", suspended_at: null, operational_zone: null, trade_code: trade, trade_category: trade });
      setOnline(localStorage.getItem(demoAvailabilityKey) === "true");
      setJobs(readDemoArray<WorkBooking>(demoJobsKey));
      setDemoEarnings(readDemoArray<CompletedTransaction>(demoEarningsKey));
      const categoryName = trade === "ELECTRICAL" ? "Electrical" : trade === "APPLIANCE_TECHNICIAN" ? "Appliance Repair" : trade === "BEAUTICIAN" ? "Home Salon & Spa" : trade === "PAINTER" ? "Painting" : trade === "CLEANER" ? "Home Cleaning" : trade === "HANDYMAN" ? "General Handyman" : "Plumbing";
      setCategories(new Map([[`demo-${trade?.toLowerCase() ?? "plumbing"}`, categoryName]]));
      setLoadingData(false); return;
    }
    if (!client || !heroId) { setLoadingData(false); return; }
    const [profileResult, locationResult, activeResult, categoryResult] = await Promise.all([
      client.from("professional_profiles").select("verification_status,suspended_at,operational_zone,trade_code,trade_category").eq("profile_id", heroId).maybeSingle(),
      client.from("hero_locations").select("updated_at").eq("professional_id", heroId).maybeSingle(),
      client.from("bookings").select("*").eq("professional_id", heroId).in("status", ["requested", "accepted", "on_the_way", "in_progress"]).order("scheduled_at", { ascending: true }),
      client.from("service_categories").select("id,name"),
    ]);
    if (profileResult.error) { setError("Could not load Hero verification. Ensure migration 21 is applied."); setLoadingData(false); return; }
    setDemoProfile(false);
    setAccess(profileResult.data as HeroAccess | null);
    setOnline(!!locationResult.data && Date.now() - Date.parse(locationResult.data.updated_at) < 90_000);
    if (activeResult.error) setError("Could not load your active work list."); else setJobs((activeResult.data ?? []) as WorkBooking[]);
    if (!categoryResult.error) setCategories(new Map((categoryResult.data ?? []).map(row => [row.id, row.name])));
    setLoadingData(false);
  }, [client, heroId, session]);

  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { if (!loading && !session) router.replace("/login?next=%2Fhero%2Fdashboard"); }, [loading, session, router]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!client || !heroId || session?.user.user_metadata.demo_auth === true) return;
    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { void refreshRef.current(); }, 250);
    };
    const channel = client.channel(`hero-portal:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${heroId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "professional_profiles", filter: `profile_id=eq.${heroId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${heroId}` }, payload => {
        const location = payload.new as { updated_at?: string };
        const recentlyOnline = payload.eventType !== "DELETE" && !!location.updated_at && Date.now() - Date.parse(location.updated_at) < 90_000;
        setOnline(current => current === recentlyOnline ? current : recentlyOnline);
      })
      .subscribe();
    return () => { if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); void client.removeChannel(channel); };
  }, [client, heroId, session?.user.user_metadata.demo_auth]);

  async function toggleAvailability() {
    if (busy) return;
    if (demoProfile) {
      setOnline(value => { const next = !value; localStorage.setItem(demoAvailabilityKey, String(next)); return next; });
      setError("");
      return;
    }
    if (!client) return;
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

  function acceptDemoJob(booking?: WorkBooking) {
    if (!demoProfile || !booking) { void refresh(); return; }
    setJobs(current => {
      const next = [booking, ...current.filter(job => job.id !== booking.id)];
      localStorage.setItem(demoJobsKey, JSON.stringify(next));
      return next;
    });
  }

  function advanceDemoJob(booking: WorkBooking) {
    const nextStatus = nextBookingStatus(booking.status);
    if (!demoProfile || !nextStatus) return;
    if (nextStatus === "completed") {
      const grossNpr = 1500;
      const companyIncomeNpr = Math.round(grossNpr * 0.125 * 100) / 100;
      const earning: CompletedTransaction = {
        transaction_id: `demo-tx-${Date.now()}`, booking_id: booking.id, timestamp: new Date().toISOString(),
        hero_id: heroId ?? "demo-hero", hero_name: session?.user.user_metadata.full_name ?? "Demo Hero",
        hero_trade: access?.trade_category ?? access?.trade_code ?? "PLUMBING", gross_amount: grossNpr,
        commission_rate: 12.5, company_income: companyIncomeNpr, hero_payout: grossNpr - companyIncomeNpr, payment_type: "CASH",
      };
      setDemoEarnings(current => { const next = [earning, ...current]; localStorage.setItem(demoEarningsKey, JSON.stringify(next)); return next; });
      setJobs(current => { const next = current.filter(job => job.id !== booking.id); localStorage.setItem(demoJobsKey, JSON.stringify(next)); return next; });
      return;
    }
    setJobs(current => { const next = current.map(job => job.id === booking.id ? { ...job, status: nextStatus } : job); localStorage.setItem(demoJobsKey, JSON.stringify(next)); return next; });
  }

  if (loading || loadingData) return <main className="mx-auto max-w-6xl p-6" role="status">Loading your Hero workspace…</main>;
  if (!session) return null;
  if (!access) return <main className="mx-auto max-w-xl p-6 py-16"><section className="rounded-2xl border bg-white p-7"><h1 className="text-2xl font-semibold">Hero profile not found</h1><p className="mt-2 text-slate-600">Submit a Hero registration before opening the work dashboard.</p><Link className="mt-5 inline-block text-emerald-800 underline" href="/hero/register">Start registration</Link></section></main>;
  if (!demoProfile && (access.verification_status !== "verified" || access.suspended_at)) return <main className="mx-auto max-w-3xl space-y-5 p-4 py-10 sm:p-8"><div className="rounded-2xl border bg-white p-7"><ShieldCheck className="text-amber-700"/><h1 className="mt-3 text-2xl font-semibold">{access.suspended_at ? "Hero access suspended" : access.verification_status === "rejected" ? "Application needs attention" : "Verification in progress"}</h1><p className="mt-2 text-slate-600">{access.suspended_at ? "Contact Tirkha operations to review your account status." : access.verification_status === "rejected" ? "Your application was not approved. You can update your details and resubmit identity verification." : "Your account remains offline until Tirkha operations verifies your identity and trade."}</p><Link className="mt-5 inline-block rounded-lg border px-4 py-2 font-medium" href="/hero/register">Review application</Link></div></main>;

  return <main className="mx-auto max-w-7xl space-y-6 p-4 py-8 sm:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">Tirkha | तिर्खा · Hero portal</p><h1 className="mt-2 text-3xl font-semibold">Your work, clearly organized.</h1><p className="mt-1 text-sm text-slate-600">{(access.trade_category ?? access.trade_code) ? tradeLabels[(access.trade_category ?? access.trade_code)!] : "Trade not selected"} · {access.operational_zone ? zoneLabels[access.operational_zone] : "Zone not set"} · Nearby jobs use trade, zone and GPS eligibility.</p></div><button type="button" disabled={busy || (online && jobs.length > 0)} onClick={() => void toggleAvailability()} className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-55 ${online ? "bg-emerald-700 hover:bg-emerald-800" : "bg-slate-800 hover:bg-slate-900"}`}><Power size={18}/>{busy ? "Updating…" : online ? "Online · Go offline" : "Offline · Go online"}</button></header>
    {demoProfile && <p role="status" className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">Demo Hero workspace: requests, availability, job status and earnings below are simulated and saved only in this browser. They do not dispatch a real provider or create financial records.</p>}
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3"><Stat icon={<Activity/>} label="Availability" value={online ? "Online" : "Offline"}/><Stat icon={<BriefcaseBusiness/>} label="Active work" value={String(jobs.length)}/><Stat icon={<MapPin/>} label="Service zone" value={access.operational_zone ? zoneLabels[access.operational_zone] : "Not set"}/></section>
    <HeroGpsTracker enabled={online && !demoProfile}/>
    <HeroDispatchInbox demo={demoProfile} trade={access.trade_category ?? access.trade_code} onAccepted={acceptDemoJob}/>
    {demoProfile && <section className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-3"><div><small className="text-slate-500">Demo gross receipts</small><strong className="mt-1 block text-xl">{catalogMoney(Math.round(demoEarnings.reduce((sum, row) => sum + row.gross_amount, 0) * 100))}</strong></div><div><small className="text-slate-500">Demo commission · 12.5%</small><strong className="mt-1 block text-xl">{catalogMoney(Math.round(demoEarnings.reduce((sum, row) => sum + row.company_income, 0) * 100))}</strong></div><div><small className="text-slate-500">Demo net earnings</small><strong className="mt-1 block text-xl text-emerald-800">{catalogMoney(Math.round(demoEarnings.reduce((sum, row) => sum + row.hero_payout, 0) * 100))}</strong></div></section>}
    <section className="space-y-3"><div><h2 className="text-xl font-semibold">My active jobs</h2><p className="text-sm text-slate-600">Written estimates can be submitted only after the job is marked in progress and physically inspected.</p></div>{jobs.length === 0 ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-600">No assigned active jobs yet. Keep availability online to see nearby eligible requests.</div> : jobs.map(job => <article key={job.id} className="grid gap-4 rounded-xl border bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]"><div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase">{job.status.replaceAll("_", " ")}</span><h3 className="mt-3 font-semibold">{categories.get(job.category_id) ?? "Service"}</h3><p className="mt-1 text-sm text-slate-600">{job.service_address}</p><HeroCustomerContact bookingId={job.id} demo={demoProfile}/><HeroBookingCommunication job={job} userId={heroId ?? ""} demo={demoProfile}/><div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-3"><p className="font-semibold text-slate-900">Estimated price: Rs. 650–1,000</p><p className="mt-1 text-xs text-slate-600">Indicative inspection and minor-work range only. Final labour and materials must be confirmed on site with customer approval.</p></div><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{job.job_details}</p><p className="mt-3 text-xs text-slate-500">Scheduled {new Date(job.scheduled_at).toLocaleString()}</p>{job.status === "in_progress" && !demoProfile && <QuoteForm bookingId={job.id}/>}</div>{job.status === "in_progress" ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><h4 className="flex items-center gap-2 font-semibold"><ReceiptText size={18}/>{demoProfile ? "Demo inspection stage" : "On-site written quote"}</h4><p className="mt-2 text-sm text-emerald-950">{demoProfile ? "Advance this sample job to completion to see a simulated receipt in your demo earnings." : "Inspect the work in person, then submit labour and materials as separate NPR amounts. The customer must review the written scope before any extra work starts."}</p></div> : <div className="rounded-xl bg-slate-50 p-5 text-sm text-slate-600">{job.status === "accepted" ? "Mark the job in progress from My Bookings after reaching the customer and beginning the inspection." : "Use the booking workflow to update the current job status."}<Link className="mt-3 block font-medium text-emerald-800 underline" href="/jobs">Open Job Board / Bookings</Link></div>}{jobDestinations.has(job.id) && <div className="lg:col-span-2">{job.id !== visibleMapJobId ? <Button variant="outline" type="button" aria-pressed={false} onClick={() => setSelectedMapJobId(job.id)}>Show live map for this job</Button> : <><p className="mb-2 text-sm font-medium">Live map · {job.service_address}</p><HeroJobLocationMap professionalId={heroId ?? ""} destination={jobDestinations.get(job.id)!} destinationLabel={job.service_address} demo={demoProfile}/></>}</div>}{demoProfile && job.status !== "in_progress" && <div className="lg:col-span-2"><Button type="button" onClick={() => advanceDemoJob(job)}>{job.status === "accepted" ? "Simulate Hero on the way" : job.status === "on_the_way" ? "Start demo inspection" : "Advance demo job"}</Button></div>}{demoProfile && job.status === "in_progress" && <div className="lg:col-span-2"><Button type="button" onClick={() => advanceDemoJob(job)}>Complete demo job</Button></div>}</article>)}</section>
    <div className="flex justify-end"><Link href="/hero/history" className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-3 font-semibold"><Banknote size={18}/> View completed-job earnings</Link></div>
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <article className="flex items-center gap-4 rounded-xl border bg-white p-5"><span className="rounded-lg bg-slate-100 p-3 text-emerald-800">{icon}</span><span><small className="block text-slate-500">{label}</small><strong className="text-lg">{value}</strong></span></article>; }

function HeroBookingCommunication({ job, userId, demo }: { job: WorkBooking; userId: string; demo: boolean }) {
  const parsed = workflowBookingSchema.safeParse(job);
  if (demo || !parsed.success) return <div className="mt-3 flex flex-wrap gap-2" aria-label="Booking chat and call controls"><button type="button" disabled className="min-h-10 rounded-md border px-3 text-sm text-slate-500">Chat · live booking required</button><button type="button" disabled className="min-h-10 rounded-md border px-3 text-sm text-slate-500">Call · live booking required</button></div>;
  return <><BookingCall booking={parsed.data}/><BookingChatDrawer bookingId={job.id} userId={userId} professional disabled={!userId || !["requested", "accepted", "on_the_way", "in_progress"].includes(job.status)} /></>;
}

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
