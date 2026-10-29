"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPhoneAuth, HERO_TRADES, phoneAuthError, phoneSchema, phoneSignupSchema, DEMO_PHONE_AUTH_NUMBERS, DEMO_PHONE_AUTH_CODE, normalizeNepalPhoneNumber, type HeroTrade } from "@tirkha/shared";
import { authDashboardPath, isDemoAuthPhone, safeAuthReturnTarget } from "@/lib/auth";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const demoAuthEnabled = process.env.NEXT_PUBLIC_TIRKHA_DEMO_AUTH === "1" || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1");
const demoPhoneAllowlist = [...new Set([...DEMO_PHONE_AUTH_NUMBERS, ...(process.env.NEXT_PUBLIC_TIRKHA_DEMO_PHONES || "").split(",").map(value => normalizeNepalPhoneNumber(value)).filter(Boolean)])];
const tradeOptions: Record<HeroTrade, { icon: string; label: string }> = {
  PLUMBING: { icon: "🚰", label: "Plumber (प्लम्बर)" },
  ELECTRICAL: { icon: "⚡", label: "Electrician (इलेक्ट्रीशियन)" },
  APPLIANCE_TECHNICIAN: { icon: "🔌", label: "Appliance Repair (उपकरण मर्मत)" },
  BEAUTICIAN: { icon: "✨", label: "Beautician (सौन्दर्य सेवा)" },
  PAINTER: { icon: "🎨", label: "Painter (पेन्टर)" },
  CLEANER: { icon: "🧹", label: "Cleaner / Maid (सरसफाई)" },
  HANDYMAN: { icon: "🛠️", label: "General Handyman / Repair (सामान्य मर्मत)" },
};

type AccountRole = "customer" | "professional";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { client, error: sessionError, demoSignIn, session, loading } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AccountRole>("customer");
  const [tradeCategory, setTradeCategory] = useState<HeroTrade | "">("");
  const [sent, setSent] = useState(false);
  const [demoCodeSent, setDemoCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [explicitReturnTo, setExplicitReturnTo] = useState<string | null>(null);
  const [returnToReady, setReturnToReady] = useState(false);
  const lock = useRef(false);
  const normalizedPhone = normalizeNepalPhoneNumber(`+977${phone}`);
  const isDemoPhone = isDemoAuthPhone(normalizedPhone, demoAuthEnabled, demoPhoneAllowlist);
  const canUseDemo = demoAuthEnabled || isDemoPhone;
  const destination = explicitReturnTo ?? authDashboardPath(role);

  useEffect(() => {
    const timer = setInterval(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const next = safeAuthReturnTarget(url.searchParams.get("next"), window.location.origin);
    if (url.searchParams.get("role") === "professional") setRole("professional");
    setExplicitReturnTo(next);
    if (next?.toLowerCase().includes("hero")) setRole("professional");
    setReturnToReady(true);
  }, []);
  useEffect(() => {
    if (session && !loading && returnToReady) router.replace(destination);
  }, [session, loading, router, destination, returnToReady]);

  function changeRole(nextRole: AccountRole) {
    setRole(nextRole);
    setError("");
    if (nextRole === "customer") setTradeCategory("");
  }

  function completeDemoSignIn(rawDigits: string) {
    const canonicalPhone = normalizeNepalPhoneNumber(rawDigits);
    if (role === "professional" && signup && !tradeCategory) {
      setError("Choose a trade category to continue as a Hero.");
      return;
    }
    demoSignIn(canonicalPhone, role, name || "Tirkha Demo User", role === "professional" ? tradeCategory || undefined : undefined);
    const selectedRole = role === "professional" ? "hero" : "customer";
    document.cookie = "tirkha_demo_role=" + selectedRole + "; Path=/; SameSite=Lax; Max-Age=604800";
    const targetRoute = explicitReturnTo ?? authDashboardPath(role);
    window.location.href = targetRoute;
  }

  function handleOtpVerification(event: FormEvent<HTMLFormElement>, rawDigits: string, isDemo: boolean) {
    if (isDemo && token.trim() === DEMO_PHONE_AUTH_CODE) {
      event.preventDefault();
      event.stopPropagation();
      completeDemoSignIn(rawDigits);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isDemo) {
      setError("For this demo number, enter " + DEMO_PHONE_AUTH_CODE + ".");
      return;
    }
    void submit(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const rawDigits = phone.replace(/\D/g, "");
    const isDemo = isDemoAuthPhone(normalizedPhone, demoAuthEnabled, demoPhoneAllowlist);
    event.preventDefault();
    event.stopPropagation();

    if (sent) {
      handleOtpVerification(event, rawDigits, isDemo);
      return;
    }
    if (isDemo) {
      setError("");
      setSent(true);
      setDemoCodeSent(true);
      setToken("");
      setCooldown(0);
      return;
    }
    if (lock.current || cooldown > 0) return;
    void submit(false);
  }

  async function submit(verify = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const canonicalPhone = phoneSchema.parse(normalizedPhone);
      if (!verify && signup) {
        if (role === "professional" && !tradeCategory) throw new Error("Choose a trade category to continue as a Hero.");
        phoneSignupSchema.parse({ full_name: name, role, ...(role === "professional" ? { trade_category: tradeCategory } : {}) });
      }

      if (!client) throw new Error("Supabase phone authentication is not configured. Enable demo mode or configure Supabase.");
      const auth = createPhoneAuth(client);
      const result = verify
        ? await auth.verifyPhoneOtp(canonicalPhone, token)
        : await auth.signInWithPhone(canonicalPhone, signup ? {
            full_name: name,
            role,
            ...(role === "professional" ? { trade_category: tradeCategory || undefined } : {}),
          } : undefined);
      if (result.error) throw result.error;
      if (!verify) {
        setSent(true);
        setDemoCodeSent(false);
        setToken("");
        setCooldown(60);
      }
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith("Choose a trade category")
        ? failure.message : phoneAuthError(failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading || session) return <main role="status" className="p-8">Loading your account…</main>;
  return <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>Tirkha | तिर्खा · {signup ? "Create account" : "Sign in"}</CardTitle></CardHeader>
      <CardContent>
        <div className="mb-5 grid grid-cols-2 rounded-lg border bg-muted p-1" role="tablist" aria-label="Choose account role">
          <button type="button" role="tab" aria-selected={role === "customer"} onClick={() => changeRole("customer")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${role === "customer" ? "bg-white text-slate-950 shadow-sm" : "text-muted-foreground"}`}>Customer</button>
          <button type="button" role="tab" aria-selected={role === "professional"} onClick={() => changeRole("professional")} className={`rounded-md px-3 py-2 text-sm font-semibold transition ${role === "professional" ? "bg-slate-900 text-white shadow-sm" : "text-muted-foreground"}`}>Hero / Specialist</button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Use your Nepal mobile number. Email is optional and is not needed to sign in.</p>
        {(error || (!client && !canUseDemo && sessionError)) && <p role="alert" className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error || sessionError}</p>}
        {canUseDemo && <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Demo sign-in works for configured test numbers{demoAuthEnabled ? " or any valid Nepal number while explicit demo mode is enabled" : ""}. Demo OTP: <b>{DEMO_PHONE_AUTH_CODE}</b>. Demo sessions are local and cannot access live dispatch.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            {signup && <><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={name} onChange={event => setName(event.target.value)} maxLength={100} autoComplete="name" required /></>}
            {role === "professional" && <><Label htmlFor="trade-category">Trade category</Label><select id="trade-category" className="w-full rounded-md border bg-background p-3" value={tradeCategory} onChange={event => setTradeCategory(event.target.value as HeroTrade | "")} required><option value="">Choose your specialty</option>{HERO_TRADES.map(trade => <option key={trade} value={trade}>{tradeOptions[trade].icon} {tradeOptions[trade].label}</option>)}</select><small className="block text-xs text-muted-foreground">Your requests and Hero dashboard will use this trade category.</small></>}
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex overflow-hidden rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"><span className="flex items-center border-r bg-muted px-3 text-sm font-medium text-foreground" aria-hidden="true">+977</span><Input id="phone" className="rounded-none border-0 shadow-none focus-visible:ring-0" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" value={phone} readOnly={sent} onChange={event => { const digits = event.target.value.replace(/\D/g, ""); setPhone((digits.startsWith("977") ? digits.slice(3) : digits).slice(-10)); }} maxLength={10} pattern="9[0-9]{9}" aria-describedby="phone-help" required /></div>
            <small id="phone-help" className="text-xs text-muted-foreground">Enter your 10-digit Nepal mobile number. The +977 code is added automatically.</small>
            {sent && <><div role="status" className={demoCodeSent ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" : "text-sm text-muted-foreground"}>{demoCodeSent ? <>Demo Mode: Enter OTP <strong>{DEMO_PHONE_AUTH_CODE}</strong></> : `Enter the SMS code sent to ${normalizedPhone}.`}</div><Label htmlFor="otp">Six-digit code</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={event => setToken(event.target.value.replace(/\D/g, ""))} required /></>}
            <Button type="submit" className="w-full" disabled={busy || (!client && !isDemoPhone) || (!sent && cooldown > 0)}>{busy ? "Please wait…" : sent ? "Verify and continue" : cooldown ? `Wait ${cooldown}s` : isDemoPhone ? "Continue with demo code" : "Send SMS code"}</Button>
            {sent && !demoCodeSent && <div className="flex gap-3"><Button type="button" variant="outline" disabled={cooldown > 0} onClick={() => void submit(false)}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Button><Button type="button" variant="outline" onClick={() => { setSent(false); setToken(""); setError(""); }}>Change number</Button></div>}
            {sent && demoCodeSent && <Button type="button" variant="outline" onClick={() => { setSent(false); setDemoCodeSent(false); setToken(""); setError(""); }}>Change number</Button>}
          </fieldset>
        </form>
        <Link className="mt-6 block underline" href={signup ? `/login${role === "professional" ? "?role=professional" : ""}` : `/signup${role === "professional" ? "?role=professional" : ""}`}>{signup ? "Already registered? Sign in" : "New here? Create account"}</Link>
      </CardContent>
    </Card>
  </main>;
}
