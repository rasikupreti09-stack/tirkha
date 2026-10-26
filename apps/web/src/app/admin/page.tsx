"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, BriefcaseBusiness, CheckCircle2, Users } from "lucide-react";
import type { WorkflowBooking } from "@tirkha/shared";
import { OperationsMap, type OperationsHeroLocation, type OperationsJob } from "@/app/admin/components/operations-map-loader";
import { useAuth } from "@/components/auth-provider";
import { BOOKING_STATUS_LABELS, catalogMoney } from "@tirkha/shared";

type ProfileRow = { id: string; full_name: string | null; role: string };
type CategoryRow = { id: string; name: string };
type LedgerRow = { booking_id: string; commission_paisa: number; entry_amount_paisa: number };
type OfferingRow = { active: boolean };
const activeStatuses = ["accepted", "on_the_way", "in_progress"] as const;

export default function AdminPage() {
  const { client, session, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [bookings, setBookings] = useState<WorkflowBooking[]>([]);
  const [heroLocations, setHeroLocations] = useState<OperationsHeroLocation[]>([]);
  const [verifiedHeroes, setVerifiedHeroes] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [activeServiceCount, setActiveServiceCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [authGuardExpired, setAuthGuardExpired] = useState(false);
  const [adminCheckExpired, setAdminCheckExpired] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setAuthGuardExpired(true), 3_000);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (loading || !session || !busy) return;
    const timer = window.setTimeout(() => setAdminCheckExpired(true), 3_000);
    return () => window.clearTimeout(timer);
  }, [loading, session, busy]);
  const refresh = useCallback(async () => {
    if (!client || !session) { setBusy(false); setIsAdmin(false); return; }
    setAdminCheckExpired(false);
    setBusy(true); setError("");
    try {
      const profileResult = await client.from("profiles").select("id,role").eq("id", session.user.id).single();
      if (profileResult.error) throw profileResult.error;
      if (profileResult.data.role !== "admin") { setIsAdmin(false); setBusy(false); return; }
      setIsAdmin(true);
      const [bookingResult, locationsResult, verifiedResult, profileList, categoryList, ledgerResult, offerings, completedCountResult] = await Promise.all([
        client.from("bookings").select("*").order("created_at", { ascending: false }).limit(300),
        client.from("hero_locations").select("professional_id,latitude,longitude,heading,speed_mps,battery_level,active_booking_id,status,updated_at"),
        client.from("professional_profiles").select("profile_id").eq("verification_status", "verified"),
        client.from("profiles").select("id,full_name,role"),
        client.from("service_categories").select("id,name"),
        client.from("professional_settlement_ledger").select("booking_id,commission_paisa,entry_amount_paisa"),
        client.from("service_offerings").select("active").eq("active", true),
        client.from("bookings").select("id", { count: "exact", head: true }).eq("status", "completed"),
      ]);
      const firstError = [bookingResult, locationsResult, verifiedResult, profileList, categoryList, ledgerResult, offerings].find(result => result.error)?.error;
      if (firstError) throw firstError;
      if (completedCountResult.error) throw completedCountResult.error;
      setBookings((bookingResult.data || []) as WorkflowBooking[]);
      setHeroLocations((locationsResult.data || []) as OperationsHeroLocation[]);
      setVerifiedHeroes((verifiedResult.data || []).map(row => row.profile_id));
      setProfiles((profileList.data || []) as ProfileRow[]);
      setCategories((categoryList.data || []) as CategoryRow[]);
      setLedger((ledgerResult.data || []) as LedgerRow[]);
      setActiveServiceCount(((offerings.data || []) as OfferingRow[]).length);
      setCompletedCount(completedCountResult.count || 0);
    } catch {
      setError("Admin data is unavailable. Apply migration 18 and verify this account has the admin role.");
    } finally { setBusy(false); }
  }, [client, session]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!client || !isAdmin) return;
    const channel = client.channel("hero_locations:all")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hero_locations" }, payload => {
        const row = payload.new as OperationsHeroLocation;
        setHeroLocations(current => [...current.filter(item => item.professional_id !== row.professional_id), row]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "hero_locations" }, payload => {
        const row = payload.new as OperationsHeroLocation;
        setHeroLocations(current => [...current.filter(item => item.professional_id !== row.professional_id), row]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "hero_locations" }, payload => {
        const row = payload.old as Pick<OperationsHeroLocation, "professional_id">;
        setHeroLocations(current => current.filter(item => item.professional_id !== row.professional_id));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "professional_settlement_ledger" }, () => void refresh())
      .subscribe();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { window.clearInterval(timer); void client.removeChannel(channel); };
  }, [client, isAdmin, refresh]);

  const recentPresence = useMemo(() => heroLocations.filter(row => Date.now() - Date.parse(row.updated_at) <= 90_000), [heroLocations]);
  const onlineIds = useMemo(() => new Set(recentPresence.map(row => row.professional_id)), [recentPresence]);
  const people = useMemo(() => new Map(profiles.map(profile => [profile.id, profile.full_name || (profile.role === "professional" ? "Hero" : "Customer")])), [profiles]);
  const categoryNames = useMemo(() => new Map(categories.map(category => [category.id, category.name])), [categories]);
  const commissions = useMemo(() => new Map(ledger.map(entry => [entry.booking_id, entry.commission_paisa])), [ledger]);
  const heroes = verifiedHeroes.map(id => ({ id, name: people.get(id) || "Hero" }));
  const jobs: OperationsJob[] = bookings.filter(b => activeStatuses.includes(b.status as typeof activeStatuses[number])).map(b => ({
    id: b.id, professional_id: b.professional_id, customer_name: people.get(b.customer_id) || "Customer",
    service_name: categoryNames.get(b.category_id) || "Service", status: b.status,
    address: b.service_address,
  }));
  if (loading && !authGuardExpired) return <main className="mx-auto grid min-h-[55vh] max-w-7xl place-items-center p-6" role="status"><div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Checking Tirkha | तिर्खा admin session…</div></main>;
  if (!session) return <AdminGuardCard title="Admin Sign-In Required" description={authGuardExpired && loading ? "We could not confirm an active admin session within 3 seconds. Sign in with your Tirkha admin account to continue." : "Sign in with an account assigned the Tirkha admin role to open the operations dashboard."} />;
  if (busy && adminCheckExpired) return <AdminGuardCard title="Admin Access Could Not Be Verified" description="The admin access check did not finish within 3 seconds. Sign in with an authorized admin account or reload this page to try again." />;
  if (busy) return <main className="mx-auto grid min-h-[55vh] max-w-7xl place-items-center p-6" role="status"><div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading Tirkha | तिर्खा operations…</div></main>;
  if (!isAdmin) return <AdminGuardCard title="Admin Access Required" description="This account does not have the Tirkha admin role. Sign in with an authorized admin account." />;
  return <main className="mx-auto max-w-7xl space-y-6 p-4 py-8 md:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Kathmandu Valley operations</p><h1 className="mt-2 text-3xl font-semibold">Tirkha | तिर्खा Control Centre</h1><p className="mt-1 text-sm text-muted-foreground">Live operational overview · presence expires after 90 seconds</p></div><button className="rounded-md border px-4 py-2" onClick={() => void refresh()} disabled={busy}>Refresh data</button></header>
    {error && <p role="alert" className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3" aria-label="Valley metrics">
      <Metric icon={<BriefcaseBusiness/>} label="Active services" value={activeServiceCount}/>
      <Metric icon={<Users/>} label="Online Heroes" value={onlineIds.size}/>
      <Metric icon={<CheckCircle2/>} label="Completed jobs" value={completedCount}/>
    </section>
    <section><div className="mb-3 flex items-center gap-2"><Activity size={18}/><h2 className="text-xl font-semibold">Live Hero and order map</h2></div><OperationsMap heroes={heroes} locations={heroLocations} jobs={jobs}/>{recentPresence.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No fresh Hero locations yet. Verified Heroes share GPS while their jobs page is open.</p>}</section>
    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Order monitoring</h2><span className="text-sm text-muted-foreground">COD commission is ledgered after completion</span></div><div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted"><tr>{["Customer", "Hero", "Service", "Status", "COD commission"].map(title => <th key={title} className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody>{bookings.map(booking => { const fee = commissions.get(booking.id); return <tr key={booking.id} className="border-t"><td className="px-4 py-3">{people.get(booking.customer_id) || "Customer"}</td><td className="px-4 py-3">{booking.professional_id ? people.get(booking.professional_id) || "Hero" : "Unassigned"}</td><td className="px-4 py-3">{categoryNames.get(booking.category_id) || "Service"}</td><td className="px-4 py-3">{BOOKING_STATUS_LABELS[booking.status]}</td><td className="px-4 py-3">{fee == null ? booking.payment_method === "COD" ? "Pending completion" : "—" : catalogMoney(fee)}</td></tr>; })}{!bookings.length && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>No bookings found.</td></tr>}</tbody></table></div></section>
  </main>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="flex items-center gap-4 rounded-xl border bg-card p-5"><span className="rounded-lg bg-muted p-3">{icon}</span><div><p className="text-sm text-muted-foreground">{label}</p><strong className="text-2xl">{value}</strong></div></article>;
}
function AdminGuardCard({ title, description }: { title: string; description: string }) {
  return <main className="mx-auto grid min-h-[65vh] max-w-xl place-items-center p-6">
    <section className="w-full rounded-2xl border bg-card p-7 shadow-sm" aria-labelledby="admin-guard-title">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-700">Tirkha | तिर्खा</p>
      <h1 id="admin-guard-title" className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      <Link href="/login?next=%2Fadmin" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-700 px-5 font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Sign in to Admin</Link>
      <p className="mt-4 text-xs text-muted-foreground">Admin accounts must be authorized by Tirkha operations.</p>
    </section>
  </main>;
}
