"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";

type GuardState = { userId: string | null; status: "checking" | "allowed" | "redirecting" | "error"; message?: string };

/** Keep Hero-only pages from mounting their data queries until the account role is confirmed. */
export function HeroRouteGuard({ children }: { children: ReactNode }) {
  const { client, session, loading } = useAuth();
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);
  const userId = session?.user.id ?? null;
  const [guard, setGuard] = useState<GuardState>({ userId: null, status: "checking" });
  const current = guard.userId === userId ? guard : { userId, status: "checking" as const };

  useEffect(() => {
    let active = true;
    if (loading) return () => { active = false; };
    if (!session) {
      setGuard({ userId: null, status: "redirecting" });
      router.replace("/login?next=%2Fhero%2Fdashboard");
      return () => { active = false; };
    }
    const authenticatedUserId = session.user.id;

    const isDemo = session.user.user_metadata.demo_auth === true;
    if (isDemo) {
      const isProfessional = session.user.user_metadata.requested_role === "professional";
      if (isProfessional) setGuard({ userId: authenticatedUserId, status: "allowed" });
      else {
        setGuard({ userId: authenticatedUserId, status: "redirecting" });
        router.replace("/");
      }
      return () => { active = false; };
    }

    if (!client) {
      setGuard({ userId: authenticatedUserId, status: "error", message: "Your authenticated session is unavailable. Sign in again to continue." });
      return () => { active = false; };
    }

    setGuard({ userId: authenticatedUserId, status: "checking" });
    void (async () => {
      try {
        const { data, error } = await client.from("profiles").select("role").eq("id", authenticatedUserId).maybeSingle();
        if (!active) return;
        if (error) {
          setGuard({ userId: authenticatedUserId, status: "error", message: "We could not verify your Hero account. Check your connection and retry." });
        } else if (data?.role === "professional") {
          setGuard({ userId: authenticatedUserId, status: "allowed" });
        } else {
          setGuard({ userId: authenticatedUserId, status: "redirecting" });
          router.replace("/hero/register?notice=hero-account-required");
        }
      } catch {
        if (active) setGuard({ userId: authenticatedUserId, status: "error", message: "We could not verify your Hero account. Check your connection and retry." });
      }
    })();

    return () => { active = false; };
  }, [client, session, userId, loading, router, attempt]);

  if (current.status === "allowed") return <>{children}</>;
  if (current.status === "error") return <main className="mx-auto max-w-xl p-6 py-16"><section className="rounded-2xl border bg-white p-7"><h1 className="text-xl font-semibold">Hero account check failed</h1><p role="alert" className="mt-2 text-sm text-slate-600">{current.message}</p><button type="button" className="mt-5 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white" onClick={() => setAttempt(value => value + 1)}>Try again</button></section></main>;
  return <main className="p-8" role="status">{loading || current.status === "checking" ? "Checking your Hero account…" : "Redirecting…"}</main>;
}
