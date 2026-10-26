"use client";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@tirkha/shared";
import { useAccount, type Account } from "@/hooks/use-account";
import { Button } from "./ui/button";

export function AccountGate({ roles, children }: { roles: UserRole[]; children: (account: Account) => ReactNode }) {
  const state = useAccount();
  const router = useRouter();
  useEffect(() => { if (!state.loading && !state.session && !state.error) router.replace("/login"); }, [state.loading, state.session, state.error, router]);
  if (state.accountLoading) return <main className="p-8" role="status">Loading your account…</main>;
  if (state.accountError) return <main className="p-8"><p role="alert">{state.accountError}</p><Button className="mt-4" onClick={state.retry}>Try again</Button></main>;
  if (!state.account) return <main className="p-8" role="status">Redirecting to sign in…</main>;
  if (!roles.includes(state.account.profile.role)) return <main className="p-8"><h1 className="text-2xl font-semibold">This page is for {roles.join(" or ")} accounts.</h1><Link href="/dashboard" className="mt-4 block underline">Return to dashboard</Link></main>;
  return <div key={state.account.profile.id}>{children(state.account)}</div>;
}
