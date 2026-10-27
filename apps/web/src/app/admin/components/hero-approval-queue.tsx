"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Eye, Phone, RefreshCw, ShieldAlert, UserRoundCheck, X } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import type { HeroOperationalZone, HeroTrade, VerificationStatus } from "@tirkha/shared";

const trades: Record<HeroTrade, string> = { PLUMBING: "Plumbing", ELECTRICAL: "Electrical" };
const zones: Record<HeroOperationalZone, string> = { Kathmandu: "Kathmandu", Lalitpur: "Lalitpur", Bhaktapur: "Bhaktapur", Baneshwor: "Baneshwor", Thamel: "Thamel", Kirtipur: "Kirtipur" };
type KycRow = { profile_id: string; trade_code: HeroTrade | null; operational_zone: HeroOperationalZone | null; citizenship_document_path: string | null; verification_status: VerificationStatus; suspended_at: string | null };
type Contact = { id: string; full_name: string | null; phone: string };

export function HeroApprovalQueue() {
  const { client } = useAuth();
  const [heroes, setHeroes] = useState<KycRow[]>([]);
  const [contacts, setContacts] = useState<Map<string, Contact>>(new Map());
  const [signedDocuments, setSignedDocuments] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    if (!client) return;
    setLoading(true); setError("");
    const result = await client.from("professional_profiles").select("profile_id,trade_code,operational_zone,citizenship_document_path,verification_status,suspended_at").order("verification_status");
    if (result.error) { setError("Hero verification queue could not load. Apply migration 21 and confirm the current user has the admin role."); setLoading(false); return; }
    const rows = (result.data ?? []) as KycRow[];
    setHeroes(rows);
    if (rows.length) {
      const profileResult = await client.from("profiles").select("id,full_name,phone").in("id", rows.map(row => row.profile_id));
      if (profileResult.error) setError("Hero contact details could not load.");
      else setContacts(new Map((profileResult.data ?? []).map(row => [row.id, { id: row.id, full_name: row.full_name, phone: row.phone }])));
    } else setContacts(new Map());
    setLoading(false);
  }, [client]);
  useEffect(() => { void refresh(); }, [refresh]);
  const pendingCount = useMemo(() => heroes.filter(hero => hero.verification_status === "pending" && !hero.suspended_at).length, [heroes]);

  async function changeStatus(profileId: string, status: "verified" | "rejected" | "suspended") {
    if (!client || busy) return;
    setBusy(profileId); setError(""); setNotice("");
    const result = await client.rpc("admin_set_hero_status", { p_profile_id: profileId, p_status: status });
    if (result.error) setError(result.error.message);
    else { setNotice(status === "verified" ? "Hero approved and enabled." : status === "suspended" ? "Hero access suspended; location sharing was stopped." : "Application rejected."); setSignedDocuments(current => { const clone = new Map(current); clone.delete(profileId); return clone; }); await refresh(); }
    setBusy(null);
  }
  async function openDocument(hero: KycRow) {
    if (!client || !hero.citizenship_document_path) { setError("No identity document is attached to this application."); return; }
    setBusy(hero.profile_id); setError("");
    const { data, error: signedError } = await client.storage.from("hero-kyc-documents").createSignedUrl(hero.citizenship_document_path, 60);
    if (signedError) setError("Could not open the private ID file. Check Storage policies and admin permissions.");
    else setSignedDocuments(current => new Map(current).set(hero.profile_id, data.signedUrl));
    setBusy(null);
  }
  return <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-800">Identity & trade controls</p><h2 className="mt-1 text-xl font-semibold">Hero KYC approval queue</h2><p className="mt-1 text-sm text-slate-600">Review the private ID document, registered trade and zone before enabling dispatch.</p></div><button type="button" disabled={loading} onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm"><RefreshCw size={15}/> Refresh</button></div>
    <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">Pending review · {pendingCount}</span><span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">Approved · {heroes.filter(hero => hero.verification_status === "verified" && !hero.suspended_at).length}</span></div>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {loading ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-500" role="status">Loading Hero applications…</div> : heroes.length === 0 ? <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">No Hero applications are registered yet.</div> : <div className="grid gap-4 lg:grid-cols-2">{heroes.map(hero => {
      const contact = contacts.get(hero.profile_id), suspended = !!hero.suspended_at;
      const label = suspended ? "Suspended" : hero.verification_status === "verified" ? "Approved" : hero.verification_status === "rejected" ? "Rejected" : "Pending review";
      return <article key={hero.profile_id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{contact?.full_name || "New Hero applicant"}</h3><p className="mt-1 text-xs text-slate-500">{hero.profile_id}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${suspended || hero.verification_status === "rejected" ? "bg-rose-100 text-rose-800" : hero.verification_status === "verified" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{label}</span></div>
        <div className="mt-4 grid gap-2 rounded-lg bg-slate-50 p-3 text-sm"><p><strong>Verified phone:</strong> {contact?.phone || "Unavailable"}</p><p><strong>Trade:</strong> {hero.trade_code ? trades[hero.trade_code] : "Not selected"}</p><p><strong>Operational zone:</strong> {hero.operational_zone ? zones[hero.operational_zone] : "Not selected"}</p></div>
        <div className="mt-4 flex flex-wrap items-center gap-2">{contact?.phone && <a className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium text-slate-800" href={`tel:${contact.phone}`} aria-label={`Call ${contact.full_name || "Hero"} at ${contact.phone}`}><Phone size={15}/> Call Hero</a>}{hero.citizenship_document_path && <button type="button" disabled={busy === hero.profile_id} onClick={() => void openDocument(hero)} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium"><Eye size={15}/> {busy === hero.profile_id ? "Loading…" : "Review private ID"}</button>}{signedDocuments.get(hero.profile_id) && <a className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-medium text-emerald-800 underline" href={signedDocuments.get(hero.profile_id)} target="_blank" rel="noreferrer">Open (60 sec) <ExternalLink size={14}/></a>}</div>
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">{hero.verification_status !== "verified" || suspended ? <button disabled={busy === hero.profile_id} onClick={() => void changeStatus(hero.profile_id, "verified")} className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><UserRoundCheck size={15}/> Approve Hero</button> : <button disabled={busy === hero.profile_id} onClick={() => void changeStatus(hero.profile_id, "suspended")} className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 disabled:opacity-50"><ShieldAlert size={15}/> Suspend</button>}{hero.verification_status !== "rejected" && !suspended && <button disabled={busy === hero.profile_id} onClick={() => void changeStatus(hero.profile_id, "rejected")} className="inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-800 disabled:opacity-50"><X size={15}/> Reject application</button>}{hero.verification_status === "verified" && suspended && <span className="inline-flex items-center gap-1 text-xs text-amber-900"><ShieldAlert size={14}/> Re-approval required to restore access</span>}</div>
      </article>;
    })}</div>}
  </section>;
}
