"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { createPhoneAuth, phoneAuthError } from "@tirkha/shared";
import { useAuth } from "./auth-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const { client, error: sessionError } = useAuth();
  const [phone, setPhone] = useState("+977");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"customer" | "professional">("customer");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [returnTo, setReturnTo] = useState("/dashboard");
  const [returnToReady, setReturnToReady] = useState(false);
  const lock = useRef(false);
  useEffect(() => { const timer = setInterval(() => setCooldown(n => Math.max(0, n - 1)), 1000); return () => clearInterval(timer); }, []);
  async function submit(verify = sent) {
    if (!client || lock.current || (!verify && cooldown > 0)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const auth = createPhoneAuth(client);
      const result = verify ? await auth.verifyPhoneOtp(phone, token)
        : await auth.signInWithPhone(phone, signup ? { full_name: name, role } : undefined);
      if (result.error) throw result.error;
      if (!verify) { setSent(true); setToken(""); setCooldown(60); }
    } catch (failure) { setError(phoneAuthError(failure)); }
    finally { lock.current = false; setBusy(false); }
  }

  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("next");
    if (requested?.startsWith("/") && !requested.startsWith("//")) setReturnTo(requested);
    setReturnToReady(true);
  }, []);
  useEffect(() => { if (session && !loading && returnToReady) router.replace(returnTo); }, [session, loading, router, returnTo, returnToReady]);
  if (loading || session) return <main role="status" className="p-8">Loading your account…</main>;
  return <main className="flex min-h-screen items-center justify-center bg-background p-6">
    <Card className="w-full max-w-md"><CardHeader><CardTitle>Tirkha | तिर्खा · {signup ? "Create account" : "Sign in"}</CardTitle></CardHeader><CardContent>
      <p className="mb-4 text-sm text-muted-foreground">Use your Nepal mobile number. Email is optional and is not needed to sign in.</p>
      {(error || sessionError) && <p role="alert" className="mb-4">{error || sessionError}</p>}
      {process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1" && <p className="mb-4 text-sm">Local demo only: code 123456. No SMS is sent.</p>}
      <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4">
        <fieldset disabled={busy || !client} className="space-y-4">
          {signup && !sent && <><Label htmlFor="full-name">Full name</Label><Input id="full-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} autoComplete="name" required />
          <Label htmlFor="role">Account type</Label><select id="role" className="w-full rounded-md border bg-background p-3" value={role} onChange={e => setRole(e.target.value as typeof role)}><option value="customer">Customer</option><option value="professional">Professional (verification required)</option></select></>}
          <Label htmlFor="phone">Mobile number (+977)</Label><Input id="phone" type="tel" autoComplete="tel" placeholder="+97798XXXXXXXX" value={phone} readOnly={sent} onChange={e => setPhone(e.target.value)} maxLength={14} required />
          {sent && <><p role="status" className="text-sm">Enter the SMS code for {phone}.</p><Label htmlFor="otp">Six-digit code</Label><Input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={token} onChange={e => setToken(e.target.value.replace(/\D/g, ""))} required /></>}
          <Button type="submit" className="w-full" disabled={busy || !client || (!sent && cooldown > 0)}>{busy ? "Please wait…" : sent ? "Verify and continue" : cooldown ? `Wait ${cooldown}s` : "Send SMS code"}</Button>
          {sent && <div className="flex gap-3"><Button type="button" variant="outline" disabled={cooldown > 0} onClick={() => void submit(false)}>{cooldown ? `Resend in ${cooldown}s` : "Resend code"}</Button><Button type="button" variant="outline" onClick={() => { setSent(false); setToken(""); setError(""); }}>Change number</Button></div>}
        </fieldset>
      </form>
      <Link className="mt-6 block underline" href={signup ? "/login" : "/signup"}>{signup ? "Already registered? Sign in" : "New here? Create account"}</Link>
    </CardContent></Card>
  </main>;
}

