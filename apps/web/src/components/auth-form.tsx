"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createPhoneAuth, isDemoPhoneAuthNumber, phoneAuthError, phoneSchema, phoneSignupSchema, verifyDemoPhoneAuthCode, DEMO_PHONE_AUTH_NUMBERS, DEMO_PHONE_AUTH_CODE, normalizeNepalPhoneNumber } from "@tirkha/shared";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const demoAuthEnabled = process.env.NEXT_PUBLIC_TIRKHA_DEMO_AUTH === "1" || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1");
const demoPhoneAllowlist = (process.env.NEXT_PUBLIC_TIRKHA_DEMO_PHONES || DEMO_PHONE_AUTH_NUMBERS.join(","))
  .split(",").map(value => normalizeNepalPhoneNumber(value)).filter(Boolean);

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { client, error: sessionError, demoSignIn, session, loading } = useAuth();
  const [phone, setPhone] = useState("+977");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "professional">("customer");
  const [sent, setSent] = useState(false);
  const [demoCodeSent, setDemoCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [returnTo, setReturnTo] = useState("/dashboard");
  const [returnToReady, setReturnToReady] = useState(false);
  const lock = useRef(false);
  const normalizedPhone = normalizeNepalPhoneNumber(phone);
  const isDemoPhone = isDemoPhoneAuthNumber(normalizedPhone, demoAuthEnabled, demoPhoneAllowlist);
  const canUseDemo = demoAuthEnabled;
  useEffect(() => { const timer = setInterval(() => setCooldown(n => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, []);

  async function submit(verify = sent) {
    if (lock.current || (!verify && cooldown > 0)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const canonicalPhone = phoneSchema.parse(normalizedPhone);
      if (!verify && signup) phoneSignupSchema.parse({ full_name: name, role });
      if (isDemoPhone) {
        if (!verify) {
          setSent(true); setDemoCodeSent(true); setToken(""); setCooldown(0);
          return;
        }
        if (!verifyDemoPhoneAuthCode(canonicalPhone, token, demoAuthEnabled, demoPhoneAllowlist)) {
          throw new Error(`For this demo number, enter ${DEMO_PHONE_AUTH_CODE}.`);
        }
        const demoRole = signup ? role : returnTo.startsWith("/hero/") ? "professional" : "customer";
        demoSignIn(canonicalPhone, demoRole, name || "Tirkha Demo User");
        return;
      }
      if (!client) throw new Error("Supabase phone authentication is not configured. Enable the local demo option or configure Supabase.");
      const auth = createPhoneAuth(client);
      const result = verify ? await auth.verifyPhoneOtp(canonicalPhone, token)
        : await auth.signInWithPhone(canonicalPhone, signup ? { full_name: name, role } : undefined);
      if (result.error) throw result.error;
      if (!verify) { setSent(true); setDemoCodeSent(false); setToken(""); setCooldown(60); }
    } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith("For this demo")
        ? failure.message : phoneAuthError(failure));
    } finally { lock.current = false; setBusy(false); }
  }

  const router = useRouter();
  useEffect(() => {
    const encoded = new URL(window.location.href).searchParams.get("next");
    let requested = encoded;
    if (requested) { try { requested = decodeURIComponent(requested); } catch { requested = null; } }
    if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")) {
      const safeTarget = new URL(requested, window.location.origin);
      if (safeTarget.origin === window.location.origin) {
        const localPath = safeTarget.pathname + safeTarget.search + safeTarget.hash;
        setReturnTo(localPath);
        if (!signup && safeTarget.pathname.startsWith("/hero/")) setRole("professional");
      }
    }
    setReturnToReady(true);
  }, [signup]);
  useEffect(() => { if (session && !loading && returnToReady) router.replace(returnTo); }, [session, loading, router, returnTo, returnToReady]);
  if (loading || session) return <main role="status" className="p-8">Loading your account…</main>;
  return <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <Card className="w-full max-w-md"><CardHeader><CardTitle>Tirkha | तिर्खा · {signup ? "Create account" : "Sign in"}</CardTitle></CardHeader><CardContent>
      <p className="mb-4 text-sm text-muted-foreground">Use your Nepal mobile number. Email is optional and is not needed to sign in.</p>
      {(error || (!canUseDemo && sessionError)) && <p role="alert" className="mb-4">{error || sessionError}</p>}
      {canUseDemo && <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">Demo sign-in is enabled for configured test numbers only. Test code: <b>{DEMO_PHONE_AUTH_CODE}</b>. Demo sessions are local and do not authenticate to Supabase.</p>}
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
        <fieldset disabled={busy || (!client && !canUseDemo)} className="space-y-4">
          {signup && !sent && <><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} autoComplete="name" required />
          <Label htmlFor="role">Account type</Label><select id="role" className="w-full rounded-md border bg-background p-3" value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="customer">Customer</option><option value="professional">Professional (verification required)</option></select></>}
          <Label htmlFor="phone">Mobile number (+977)</Label><Input id="phone" type="tel" autoComplete="tel" placeholder="+97798XXXXXXXX" value={phone} readOnly={sent} onChange={e => setPhone(e.target.value)} maxLength={14} required />
          {sent && <><p role="status" className="text-sm">{demoCodeSent ? `Demo code ${DEMO_PHONE_AUTH_CODE} is ready for ${phone}.` : `Enter the SMS code for ${phone}.`}</p><Label htmlFor="otp">Six-digit code</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ""))} required /></>}
          <Button type="submit" className="w-full" disabled={busy || (!client && !canUseDemo) || (!sent && cooldown > 0)}>{busy ? "Please wait…" : sent ? "Verify and continue" : cooldown ? `Wait ${cooldown}s` : "Send SMS code"}</Button>
          {sent && !demoCodeSent && <div className="flex gap-3"><Button type="button" variant="outline" disabled={cooldown > 0} onClick={() => void submit(false)}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Button><Button type="button" variant="outline" onClick={() => { setSent(false); setDemoCodeSent(false); setToken(""); setError(""); }}>Change number</Button></div>}
          {sent && demoCodeSent && <Button type="button" variant="outline" onClick={() => { setSent(false); setDemoCodeSent(false); setToken(""); setError(""); }}>Change number</Button>}
        </fieldset>
      </form>
      <Link className="mt-6 block underline" href={signup ? "/login" : "/signup"}>{signup ? "Already registered? Sign in" : "New here? Create account"}</Link>
    </CardContent></Card>
  </main>;
}
