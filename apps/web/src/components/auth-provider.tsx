"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { configurationMessage, observeAuthSession, type AuthSnapshot, type Database } from "@tirkha/shared";
import { getSupabase } from "@/lib/supabase";

type AuthState = AuthSnapshot<Session> & { client: SupabaseClient<Database> | null };
const AuthContext = createContext<AuthState>({ client: null, session: null, loading: true, error: null });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<SupabaseClient<Database> | null>(null);
  const [state, setState] = useState<AuthSnapshot<Session>>({ session: null, loading: true, error: null });
  useEffect(() => {
    try {
      const supabase = getSupabase();
      setClient(supabase);
      return observeAuthSession<Session>(supabase.auth, setState);
    } catch (error) {
      setState({ session: null, loading: false, error: configurationMessage(error, "Sign-in is unavailable. Please contact Tirkha support.") });
    }
  }, []);
  return <AuthContext.Provider value={{ ...state, client }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);

