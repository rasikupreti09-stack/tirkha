import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { configurationMessage, observeAuthSession, parseAuthCallback, type AuthSnapshot, type Database } from "@tirkha/shared";
import { getSupabase } from "../lib/supabase";

type AuthState = AuthSnapshot<Session> & {
  client: SupabaseClient<Database> | null;
  callbackError: string | null;
  callbackPending: boolean;
};
const AuthContext = createContext<AuthState>({ client: null, session: null, loading: true, error: null, callbackError: null, callbackPending: false });
export const confirmationRedirectUrl = () => Linking.createURL("auth/callback");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [state, setState] = useState<AuthSnapshot<Session>>({ session: null, loading: true, error: null });
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const [callbackPending, setCallbackPending] = useState(false);
  useEffect(() => {
    let supabase: SupabaseClient<Database>;
    try { supabase = getSupabase(); setClient(supabase); }
    catch (error) { setState({ session: null, loading: false, error: configurationMessage(error, "Sign-in is unavailable. Please contact Tirkha support.") }); return; }
    let active = true;
    let lastUrl: string | null = null;
    const unsubscribe = observeAuthSession<Session>(supabase.auth, setState);
    const refresh = (status: string) => {
      const operation = status === "active" ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh();
      void operation.catch(() => { /* A subsequent auth request will surface connection failures. */ });
    };
    refresh(AppState.currentState);
    const appState = AppState.addEventListener("change", refresh);

    async function handleUrl(url: string | null) {
      if (!active || !url || url === lastUrl) return;
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
      } catch (error) { if (active) setCallbackError("Could not confirm this session. Try signing in with your phone number and SMS code."); }
      finally { if (active) setCallbackPending(false); }
    }
    const links = Linking.addEventListener("url", ({ url }) => { void handleUrl(url); });
    void Linking.getInitialURL().then(handleUrl).catch(() => {
      if (active) setCallbackError("Could not open the confirmation link. Please return to sign in.");
    });
    return () => {
      active = false; unsubscribe(); appState.remove(); links.remove();
      void supabase.auth.stopAutoRefresh().catch(() => {});
    };
  }, []);
  return <AuthContext.Provider value={{ ...state, client, callbackError, callbackPending }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);


