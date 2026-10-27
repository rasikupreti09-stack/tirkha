"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { configurationMessage, DEMO_PHONE_AUTH_NUMBERS, isDemoPhoneAuthNumber, observeAuthSession, type AuthSnapshot, type Database } from "@tirkha/shared";
import { getSupabase } from "@/lib/supabase";

type DemoRole = "customer" | "professional";
type DemoIdentity = { phone: string; role: DemoRole; fullName: string; createdAt: string };
type AuthState = AuthSnapshot<Session> & { client: SupabaseClient<Database> | null; demoSignIn: (phone: string, role: DemoRole, fullName?: string) => void };
const demoStorageKey = "tirkha.demo-auth.v1";
const demoAuthEnabled = process.env.NEXT_PUBLIC_TIRKHA_DEMO_AUTH === "1" || (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1");
const demoPhoneAllowlist = (process.env.NEXT_PUBLIC_TIRKHA_DEMO_PHONES || DEMO_PHONE_AUTH_NUMBERS.join(","))
  .split(",").map(value => value.trim()).filter(Boolean);
function readDemoSession(): Session | null {
  if (!demoAuthEnabled || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(demoStorageKey);
    if (!raw) return null;
    const identity = JSON.parse(raw) as DemoIdentity;
    if (!isDemoPhoneAuthNumber(identity.phone, true, demoPhoneAllowlist) || !["customer", "professional"].includes(identity.role)) return null;
    const createdAt = new Date(identity.createdAt);
    if (Number.isNaN(createdAt.valueOf()) || Date.now() - createdAt.valueOf() > 7 * 24 * 60 * 60 * 1000) return null;
    const expiresAt = Math.floor(createdAt.valueOf() / 1000) + 7 * 24 * 60 * 60;
    const digits = identity.phone.replace(/\D/g, "").slice(-12).padStart(12, "0");
    return {
      access_token: "",
      token_type: "bearer",
      expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
      expires_at: expiresAt,
      refresh_token: "",
      user: {
        id: `00000000-0000-4000-8000-${digits}`,
        app_metadata: { provider: "phone", providers: ["phone"], demo_auth: true },
        user_metadata: { phone: identity.phone, full_name: identity.fullName, requested_role: identity.role, demo_auth: true },
        aud: "authenticated",
        created_at: createdAt.toISOString(),
        phone: identity.phone,
      },
    };
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
  function demoSignIn(phone: string, role: DemoRole, fullName = "Tirkha Demo User") {
    if (!isDemoPhoneAuthNumber(phone, demoAuthEnabled, demoPhoneAllowlist)) throw new Error("Demo sign-in is disabled for this number.");
    const identity: DemoIdentity = { phone, role, fullName: fullName.trim() || "Tirkha Demo User", createdAt: new Date().toISOString() };
    window.localStorage.setItem(demoStorageKey, JSON.stringify(identity));
    const session = readDemoSession();
    if (!session) throw new Error("Could not start the local demo session.");
    setState({ session, loading: false, error: null });
  }
  return <AuthContext.Provider value={{ ...state, client, demoSignIn }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
