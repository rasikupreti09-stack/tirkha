"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { configurationMessage, DEMO_PHONE_AUTH_NUMBERS, normalizeNepalPhoneNumber, observeAuthSession, type AuthSnapshot, type Database, type HeroTrade } from "@tirkha/shared";
import { getSupabase } from "@/lib/supabase";
import { isDemoAuthPhone } from "@/lib/auth";

type DemoRole = "customer" | "professional";
type DemoIdentity = { id?: string; phone: string; role: DemoRole; fullName: string; trade?: string; tradeCategory?: HeroTrade; createdAt: string };
type AuthState = AuthSnapshot<Session> & { client: SupabaseClient<Database> | null; demoSignIn: (phone: string, role: DemoRole, fullName?: string, tradeCategory?: HeroTrade) => void };
const demoStorageKey = "tirkha.demo-auth.v1";
const activeRoleStorageKey = "tirkha.demo-auth.active-role";
const demoAuthEnabled = process.env.NEXT_PUBLIC_TIRKHA_DEMO_AUTH === "1" || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1");
const demoPhoneAllowlist = [...new Set([...DEMO_PHONE_AUTH_NUMBERS, ...(process.env.NEXT_PUBLIC_TIRKHA_DEMO_PHONES || "").split(",").map(value => normalizeNepalPhoneNumber(value)).filter(Boolean)])];
function roleStorageKey(role: DemoRole) { return `${demoStorageKey}:${role}`; }
function expectedDemoRole(): DemoRole {
  if (typeof window === "undefined") return "customer";
  const url = new URL(window.location.href);
  const next = url.searchParams.get("next");
  if (window.location.pathname.startsWith("/hero/") || next?.toLowerCase().includes("hero") || url.searchParams.get("role") === "professional") return "professional";
  try {
    const active = window.sessionStorage.getItem(activeRoleStorageKey);
    if (active === "customer" || active === "professional") return active;
  } catch { /* Route-based role selection still works when tab storage is unavailable. */ }
  return "customer";
}
function sessionFromIdentity(identity: DemoIdentity): Session | null {
  if (!isDemoAuthPhone(identity.phone, demoAuthEnabled, demoPhoneAllowlist) || !["customer", "professional"].includes(identity.role)) return null;
  const createdAt = new Date(identity.createdAt);
  if (Number.isNaN(createdAt.valueOf()) || Date.now() - createdAt.valueOf() > 7 * 24 * 60 * 60 * 1000) return null;
  const expiresAt = Math.floor(createdAt.valueOf() / 1000) + 7 * 24 * 60 * 60;
  const digits = identity.phone.replace(/\D/g, "").slice(-11).padStart(11, "0") + (identity.role === "professional" ? "1" : "0");
  return {
    access_token: "",
    token_type: "bearer",
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    refresh_token: "",
    user: {
      id: `00000000-0000-4000-8000-${digits}`,
      app_metadata: { provider: "phone", providers: ["phone"], demo_auth: true },
      user_metadata: { phone: identity.phone, full_name: identity.fullName, requested_role: identity.role, ...(identity.tradeCategory ? { trade_category: identity.tradeCategory } : {}), demo_auth: true },
      aud: "authenticated",
      created_at: createdAt.toISOString(),
      phone: identity.phone,
    },
  };
}
function readDemoSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const role = expectedDemoRole();
    const raw = window.localStorage.getItem(roleStorageKey(role));
    if (raw) {
      const session = sessionFromIdentity(JSON.parse(raw) as DemoIdentity);
      if (session) return session;
    }
    // Read the pre role-scoped key for existing local demo sessions.
    const legacy = window.localStorage.getItem("tirkha_demo_user") ?? window.localStorage.getItem(demoStorageKey);
    if (!legacy) return null;
    const identity = JSON.parse(legacy) as DemoIdentity;
    return identity.role === role ? sessionFromIdentity(identity) : null;
  } catch { return null; }
}
const initialState: AuthSnapshot<Session> = { session: null, loading: true, error: null };
const AuthContext = createContext<AuthState>({ client: null, ...initialState, demoSignIn: () => undefined });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [state, setState] = useState<AuthSnapshot<Session>>(initialState);
  useEffect(() => {
    const savedDemo = readDemoSession();
    if (savedDemo) setState({ session: savedDemo, loading: false, error: null });
    try {
      const supabase = getSupabase();
      setClient(supabase);
      return observeAuthSession<Session>(supabase.auth, snapshot => {
        const demoSession = readDemoSession();
        setState(demoSession ? { session: demoSession, loading: false, error: null } : snapshot);
      });
    } catch (error) {
      if (!savedDemo) setState({ session: null, loading: false, error: demoAuthEnabled ? null : configurationMessage(error, "Sign-in is unavailable. Please contact Tirkha support.") });
    }
  }, []);
  function demoSignIn(phone: string, role: DemoRole, fullName = "Tirkha Demo User", tradeCategory?: HeroTrade) {
    const normalizedPhone = normalizeNepalPhoneNumber(phone);
    if (!isDemoAuthPhone(normalizedPhone, demoAuthEnabled, demoPhoneAllowlist)) throw new Error("Demo sign-in is disabled for this number.");
    const identity: DemoIdentity = { id: role === "professional" ? "demo-hero-id" : "demo-customer-id", phone: normalizedPhone, role, fullName: fullName.trim() || "Tirkha Demo User", trade: tradeCategory?.toLowerCase() ?? (role === "professional" ? "plumber" : undefined), ...(tradeCategory ? { tradeCategory } : {}), createdAt: new Date().toISOString() };
    try {
      window.localStorage.setItem(roleStorageKey(role), JSON.stringify(identity));
      window.localStorage.setItem("tirkha_demo_user", JSON.stringify(identity));
      window.sessionStorage.setItem(activeRoleStorageKey, role);
    } catch { /* Keep the demo session usable in this tab if browser storage is unavailable. */ }
    const session = sessionFromIdentity(identity);
    if (!session) throw new Error("Could not start the local demo session.");
    setState({ session, loading: false, error: null });
  }
  return <AuthContext.Provider value={{ ...state, client, demoSignIn }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
