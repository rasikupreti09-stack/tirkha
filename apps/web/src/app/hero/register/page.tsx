"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, FileCheck2, ShieldCheck, UploadCloud } from "lucide-react";
import { HERO_OPERATIONAL_ZONES, HERO_TRADES, heroRegistrationSchema, type HeroOperationalZone, type HeroTrade } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";

const zoneLabels: Record<HeroOperationalZone, string> = { Kathmandu: "Kathmandu", Lalitpur: "Lalitpur", Bhaktapur: "Bhaktapur", Baneshwor: "Baneshwor / New Baneshwor", Thamel: "Thamel", Kirtipur: "Kirtipur" };
const tradeLabels: Record<HeroTrade, string> = { PLUMBING: "Plumbing", ELECTRICAL: "Electrical" };

type ExistingApplication = { verification_status: "pending" | "verified" | "rejected"; suspended_at: string | null; operational_zone: HeroOperationalZone | null; trade_code: HeroTrade | null };

export default function HeroRegisterPage() {
  const { client, session, loading } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [trade, setTrade] = useState<HeroTrade | "">("");
  const [zone, setZone] = useState<HeroOperationalZone | "">("");
  const [document, setDocument] = useState<File | null>(null);
  const [application, setApplication] = useState<ExistingApplication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!client || !session) return;
    setPhone(session.user.phone ?? "");
    void client.from("profiles").select("full_name,phone").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (data?.full_name) setFullName(data.full_name);
      if (data?.phone) setPhone(data.phone);
    });
    void client.from("professional_profiles").select("verification_status,suspended_at,operational_zone,trade_code").eq("profile_id", session.user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setApplication(data as ExistingApplication);
      setTrade(data.trade_code ?? ""); setZone(data.operational_zone ?? "");
      if (data.verification_status === "verified" && !data.suspended_at) router.replace("/hero/dashboard");
    });
  }, [client, session, router]);

  function nextStep() {
    setError("");
    if (step === 1) {
      const parsed = heroRegistrationSchema.shape.full_name.safeParse(fullName);
      if (!parsed.success) { setError("Enter your full name (at least 2 characters)."); return; }
      if (!/^\+9779[0-9]{9}$/.test(phone)) { setError("Sign in with a verified Nepal mobile number (+977). Change it through phone verification first."); return; }
    }
    if (step === 2 && (!trade || !zone)) { setError("Choose your trade and the area where you can take jobs."); return; }
    setStep(value => Math.min(3, value + 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (!client || !session) return;
    const registration = heroRegistrationSchema.safeParse({ full_name: fullName, phone, trade_code: trade, operational_zone: zone });
    if (!registration.success || !document) { setError("Complete your name, verified phone, trade and operational zone, then attach a citizenship or government ID document."); return; }
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(document.type) || document.size > 10 * 1024 * 1024) { setError("Choose a JPG, PNG, WebP or PDF file under 10 MB."); return; }
    setBusy(true);
    let uploadedPath: string | null = null;
    try {
      const safeName = document.name.replace(/[^A-Za-z0-9._-]/g, "_");
      uploadedPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const upload = await client.storage.from("hero-kyc-documents").upload(uploadedPath, document, { contentType: document.type, upsert: false });
      if (upload.error) throw upload.error;
      const { data, error: submitError } = await client.rpc("submit_hero_registration", {
        p_full_name: registration.data.full_name, p_phone: registration.data.phone, p_trade_code: registration.data.trade_code,
        p_operational_zone: registration.data.operational_zone, p_document_path: uploadedPath,
      });
      if (submitError) throw submitError;
      setApplication({ verification_status: data ?? "pending", suspended_at: null, trade_code: registration.data.trade_code, operational_zone: registration.data.operational_zone });
      setSuccess("Application submitted. Your account stays pending until Tirkha operations verifies your details.");
    } catch (failure) {
      if (uploadedPath) await client.storage.from("hero-kyc-documents").remove([uploadedPath]).catch(() => undefined);
      setError(failure instanceof Error ? failure.message : "Could not submit your application. Please try again.");
    } finally { setBusy(false); }
  }

  if (loading) return <main className="mx-auto max-w-2xl p-6"><p role="status">Checking your Tirkha account…</p></main>;
  if (!session) return <main className="mx-auto max-w-xl p-6 py-16"><section className="rounded-2xl border bg-white p-7 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">Tirkha | तिर्खा</p><h1 className="mt-3 text-3xl font-semibold">Become a Hero</h1><p className="mt-2 text-slate-600">Sign in with your verified Nepal phone number to submit your professional application.</p><Link href="/login?next=%2Fhero%2Fregister" className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">Sign in to continue</Link></section></main>;
  if (application?.suspended_at) return <main className="mx-auto max-w-xl p-6 py-16"><section className="rounded-2xl border border-rose-200 bg-white p-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">Tirkha | तिर्खा</p><h1 className="mt-3 text-2xl font-semibold">Hero access is suspended</h1><p className="mt-2 text-slate-600">Only Tirkha operations can restore a suspended account. Contact the admin team for a review; submitting a new application cannot bypass the suspension.</p><Link href="/" className="mt-6 inline-flex text-sm font-semibold text-emerald-800 underline">Return to Tirkha</Link></section></main>;
  if (success || (application?.verification_status === "pending")) return <main className="mx-auto max-w-2xl p-6 py-12"><section className="rounded-2xl border bg-white p-7 shadow-sm"><div className="grid size-12 place-items-center rounded-full bg-amber-100 text-amber-800"><FileCheck2 /></div><h1 className="mt-4 text-2xl font-semibold">Application pending verification</h1><p className="mt-2 text-slate-600">{success || "Your submitted Hero profile and identity document are with Tirkha operations for review."}</p><div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Trade:</strong> {application?.trade_code ? tradeLabels[application.trade_code] : "Submitted"}</p><p><strong>Operational zone:</strong> {application?.operational_zone ? zoneLabels[application.operational_zone] : "Submitted"}</p><p><strong>Availability:</strong> Offline until approved</p></div><Link href="/" className="mt-6 inline-flex text-sm font-semibold text-emerald-800 underline">Return to Tirkha</Link></section></main>;

  return <main className="mx-auto max-w-2xl p-4 py-8 sm:p-8"><Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-600"><ArrowLeft size={16} /> Back to Tirkha</Link><section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-8">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">Tirkha | तिर्खा · Hero registration</p><h1 className="mt-2 text-3xl font-semibold">Work with care. Earn with Tirkha.</h1><p className="mt-2 text-sm text-slate-600">Complete these three steps. Your profile remains pending until an admin verifies your identity.</p>
    <ol className="mt-6 grid grid-cols-3 gap-2 text-xs">{["Your details", "Trade & zone", "Identity check"].map((label, index) => <li key={label} className={`rounded-lg px-3 py-2 ${step === index + 1 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{index + 1}. {label}</li>)}</ol>
    <form className="mt-6 space-y-5" onSubmit={event => void submit(event)}>
      {step === 1 && <div className="space-y-4"><label className="grid gap-2 text-sm font-medium">Full name<input className="rounded-lg border px-3 py-3" autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} required minLength={2} maxLength={100} /></label><label className="grid gap-2 text-sm font-medium">Verified phone number<input className="rounded-lg border bg-slate-50 px-3 py-3" value={phone} readOnly aria-describedby="phone-help" /><small id="phone-help" className="font-normal text-slate-500">This is read from your verified Supabase phone sign-in.</small></label></div>}
      {step === 2 && <div className="space-y-4"><label className="grid gap-2 text-sm font-medium">Trade<select className="rounded-lg border bg-white px-3 py-3" value={trade} onChange={event => setTrade(event.target.value as HeroTrade | "")} required><option value="">Select your trade</option>{HERO_TRADES.map(value => <option key={value} value={value}>{tradeLabels[value]}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Operational zone<select className="rounded-lg border bg-white px-3 py-3" value={zone} onChange={event => setZone(event.target.value as HeroOperationalZone | "")} required><option value="">Select your primary service area</option>{HERO_OPERATIONAL_ZONES.map(value => <option key={value} value={value}>{zoneLabels[value]}</option>)}</select><small className="font-normal text-slate-500">Unassigned requests are filtered by this zone, your trade and live dispatch radius.</small></label></div>}
      {step === 3 && <div className="space-y-4"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-2 font-semibold text-emerald-950"><ShieldCheck size={18} /> Private identity verification</div><p className="mt-2 text-sm text-emerald-900">Upload a clear citizenship card or government ID image/PDF. The document is stored in a private bucket, visible only to you and Tirkha admins.</p></div><label className="grid min-h-36 cursor-pointer place-items-center gap-2 rounded-xl border-2 border-dashed p-5 text-center hover:border-emerald-600"><UploadCloud className="text-emerald-800" /><span className="font-semibold">{document?.name ?? "Choose identity document"}</span><small className="text-slate-500">JPG, PNG, WebP or PDF · maximum 10 MB</small><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={event => setDocument(event.target.files?.[0] ?? null)} /></label><p className="text-xs text-slate-500">No identity file is attached to bookings, chat, or earnings history.</p></div>}
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">{error}</p>}
      <div className="flex justify-between gap-3"><button type="button" onClick={() => { setError(""); setStep(value => Math.max(1, value - 1)); }} disabled={step === 1 || busy} className="rounded-lg border px-4 py-3 disabled:opacity-40">Previous</button>{step < 3 ? <button type="button" onClick={nextStep} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white">Continue <ArrowRight size={16} /></button> : <button disabled={busy || !document} className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Submitting securely…" : "Submit for verification"}</button>}</div>
    </form>
  </section></main>;
}
