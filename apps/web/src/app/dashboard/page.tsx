"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { profileSchema, professionalProfileSchema, type Profile, type ProfessionalProfile } from "@tirkha/shared";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { client, session, loading, error: authError, signOut: clearSession } = useAuth();
  const router = useRouter();
  const [account, setAccount] = useState<{ owner: string; profile: Profile; professional: ProfessionalProfile | null } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!loading && !session && !authError) router.replace("/login"); }, [loading, session, authError, router]);
  useEffect(() => {
    if (!client || !session) return;
    let active = true;
    const owner = session.user.id;
    setError(""); setAccount(null);
    void (async () => {
      try {
        const result = await client.from("profiles").select("*").eq("id", owner).single();
        if (result.error) throw result.error;
        const profile = profileSchema.parse(result.data);
        let professional: ProfessionalProfile | null = null;
        if (profile.role === "professional") {
          const result = await client.from("professional_profiles").select("*").eq("profile_id", owner).single();
          if (result.error) throw result.error;
          professional = professionalProfileSchema.parse(result.data);
        }
        if (active) setAccount({ owner, profile, professional });
      } catch { if (active) setError("We could not load your profile. Please try again or contact support."); }
    })();
    return () => { active = false; };
  }, [client, session?.user.id, attempt]);

  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await clearSession();
    } catch { setError("Sign out failed. Please try again."); }
    finally { setBusy(false); }
  }
  if (loading || (!session && !authError)) return <main className="p-8" role="status">Loading your account…</main>;
  if (!session) return <main className="p-8" role="alert">{authError} <a href="/login" className="underline">Return to sign in</a></main>;
  const current = account?.owner === session.user.id ? account : null;
  return <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
    <header className="mb-8 flex items-center justify-between gap-4"><span className="text-2xl font-semibold">Tirkha | तिर्खा</span><Button variant="outline" disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</Button></header>
    <Button asChild className="mb-6"><Link href="/explore">Explore services</Link></Button>
    <Card><CardHeader><CardTitle>{current ? `Welcome, ${current.profile.full_name || "there"}` : "Your dashboard"}</CardTitle></CardHeader>
      <CardContent>
        {error ? <div role="alert"><p>{error}</p><Button variant="outline" className="mt-4" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></div>
          : !current ? <p role="status">Loading your profile…</p>
          : <div className="space-y-4">
            <p className="capitalize">{current.profile.role} account</p>
            {current.professional && <p>Verification: <strong>{current.professional.verification_status}</strong>. {current.professional.verification_status === "pending" ? "Your account is awaiting verification before you can access available jobs." : current.professional.verification_status === "rejected" ? "Contact support about your verification." : "Your professional account is verified."}</p>}
            {current.profile.role === "customer" && <div className="flex flex-wrap gap-3"><Button asChild><Link href="/book">Request a service</Link></Button><Button variant="outline" asChild><Link href="/bookings">My bookings</Link></Button></div>}{current.profile.role === "professional" && <Button asChild><Link href="/jobs">Professional jobs</Link></Button>}
          </div>}
      </CardContent>
    </Card>
  </main>;
}

