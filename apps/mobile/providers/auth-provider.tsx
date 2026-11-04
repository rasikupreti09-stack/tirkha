import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { configurationMessage, observeAuthSession, parseAuthCallback, type AuthSnapshot, type Database, type HeroTrade, type UserRole } from "@tirkha/shared";
import { getSupabase } from "../lib/supabase";

const DEMO_SESSION_KEY = "tirkha.mobile.demo-session.v1";
const AUTH_STARTUP_TIMEOUT_MS = 10_000;
export type MobileDemoUser = { id: string; phone: string; role: "customer" | "professional"; fullName: string; tradeCategory: HeroTrade | null };

type AuthState = AuthSnapshot<Session> & {
  client: SupabaseClient<Database> | null;
  demoUser: MobileDemoUser | null;
  isDemo: boolean;
  demoSignIn: (phone: string, role: UserRole, fullName: string, tradeCategory?: HeroTrade) => Promise<void>;
  signOut: () => Promise<void>;
  callbackError: string | null;
  callbackPending: boolean;
};
const AuthContext = createContext<AuthState>({ client: null, session: null, loading: true, error: null, demoUser: null, isDemo: false, demoSignIn: async () => {}, signOut: async () => {}, callbackError: null, callbackPending: false });
export const confirmationRedirectUrl = () => Linking.createURL("auth/callback");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [state, setState] = useState<AuthSnapshot<Session>>({ session: null, loading: true, error: null });
  const [demoUser, setDemoUser] = useState<MobileDemoUser | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [callbackPending, setCallbackPending] = useState(false);
  useEffect(() => {
    let active = true;
    // If storage or auth initialization stalls, release the router into the
    // sign-in screen with an explanation instead of leaving a spinner forever.
    const startupTimeout = setTimeout(() => {
      if (!active) return;
      setState(current => current.loading
        ? { session: null, loading: false, error: "Account startup took too long. You can retry sign-in or continue with preview demo access." }
        : current);
    }, AUTH_STARTUP_TIMEOUT_MS);
    let lastUrl: string | null = null;
    let unsubscribe = () => {};
    let supabase: SupabaseClient<Database> | null = null;
    const refresh = (status: string) => {
      if (!supabase) return;
      const operation = status === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
      void operation.catch(() => { /* A subsequent auth request will surface connection failures. */ });
    };
    const appState = AppState.addEventListener("change", refresh);

    async function handleUrl(url: string | null) {
      if (!active || !supabase || !url || url === lastUrl) return;
      const callback = parseAuthCallback(url, confirmationRedirectUrl());
      if (callback.kind === "ignore") return;
      lastUrl = url;
      setCallbackError(null);
      if (callback.kind === "error") { setCallbackError(callback.message); return; }
      setCallbackPending(true);
      try {
        const { error } = await supabase.auth.setSession({
          access_token: callback.access_token, refresh_token: callback.refresh_token,
        });
        if (error) throw error;
      } catch { if (active) setCallbackError("Could not confirm this session. Try signing in with your phone number and SMS code."); }
      finally { if (active) setCallbackPending(false); }
    }
    const links = Linking.addEventListener("url", ({ url }) => { void handleUrl(url); });
    void (async () => {
      let restoredDemo: MobileDemoUser | null = null;
      try {
        const rawDemoUser = await AsyncStorage.getItem(DEMO_SESSION_KEY);
        if (rawDemoUser) {
          const parsed: unknown = JSON.parse(rawDemoUser);
          if (isMobileDemoUser(parsed)) {
            restoredDemo = parsed;
            setDemoUser(parsed);
          }
          else await AsyncStorage.removeItem(DEMO_SESSION_KEY);
        }
      } catch {
        // Corrupt local demo data must not prevent the sign-in screen from opening.
        await AsyncStorage.removeItem(DEMO_SESSION_KEY).catch(() => {});
      }
      try {
        supabase = getSupabase();
        setClient(supabase);
        // A device-local demo identity takes precedence over any stale Supabase
        // session on this installation. Clear it before observing auth events.
        if (restoredDemo) await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        unsubscribe = observeAuthSession<Session>(supabase.auth, setState);
        refresh(AppState.currentState);
        const initialUrl = await Linking.getInitialURL();
        await handleUrl(initialUrl);
      } catch (error) {
        if (active) setState({ session: null, loading: false, error: restoredDemo ? null : configurationMessage(error, "Sign-in is unavailable. Please contact Tirkha support.") });
      } finally {
        if (active && !supabase) setState(current => ({ ...current, loading: false }));
      }
    })();
    return () => {
      active = false; clearTimeout(startupTimeout); unsubscribe(); appState.remove(); links.remove();
      if (supabase) void supabase.auth.stopAutoRefresh().catch(() => {});
    };
  }, []);

  async function demoSignIn(phone: string, role: UserRole, fullName: string, tradeCategory?: HeroTrade) {
    if (role === "admin") throw new Error("Admin sign-in is not available in the mobile demo.");
    const user: MobileDemoUser = { id: createDemoId(phone, role), phone, role, fullName: fullName.trim() || "Tirkha Demo User", tradeCategory: role === "professional" ? tradeCategory ?? "PLUMBING" : null };
    await AsyncStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    setDemoUser(user);
    setState({ session: null, loading: false, error: null });
    if (client) {
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) {
        // Keep the local demo usable even if a stale real session cannot be cleared.
        setState({ session: null, loading: false, error: null });
      }
    }
  }

  async function signOut() {
    await AsyncStorage.removeItem(DEMO_SESSION_KEY);
    setDemoUser(null);
    if (client) {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    setState({ session: null, loading: false, error: null });
  }

  const isDemo = demoUser !== null;
  return <AuthContext.Provider value={{ ...state, client, demoUser, isDemo, demoSignIn, signOut, callbackError, callbackPending }}>{children}</AuthContext.Provider>;
}

function isMobileDemoUser(value: unknown): value is MobileDemoUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<MobileDemoUser>;
  return typeof user.id === "string" && typeof user.phone === "string"
    && (user.role === "customer" || user.role === "professional")
    && typeof user.fullName === "string"
    && (user.tradeCategory === null || typeof user.tradeCategory === "string");
}

function createDemoId(phone: string, role: "customer" | "professional") {
  // Stable UUID-shaped identifiers keep local UI schema validation predictable.
  let hash = 2166136261;
  for (const character of `${role}:${phone}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const first = (hash >>> 0).toString(16).padStart(8, "0");
  const second = Math.imul(hash ^ 0x9e3779b9, 2246822519).toString(16).replace("-", "").slice(-8).padStart(8, "0");
  return `${first}-${second.slice(0, 4)}-4${second.slice(0, 3)}-a${first.slice(0, 3)}-${second}${first.slice(0, 4)}`;
}
export const useAuth = () => useContext(AuthContext);


