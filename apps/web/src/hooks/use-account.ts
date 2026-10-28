"use client";
import { useEffect, useState } from "react";
import { profileSchema, professionalProfileSchema, type Profile, type ProfessionalProfile } from "@tirkha/shared";
import { useAuth } from "../components/auth-provider";
export type Account = { profile: Profile; professional: ProfessionalProfile | null };
function isExpiredSessionError(error: { code?: string; message?: string; status?: number } | null | undefined) {
  return error?.status === 401 || error?.code === "PGRST301" || /jwt|token.*expired|session.*expired|invalid claim/i.test(error?.message ?? "");
}
function isTemporaryRequestError(error: { message?: string; status?: number } | null | undefined) {
  return error?.status === 0 || /network|fetch|temporar|timeout|connection/i.test(error?.message ?? "");
}
export function useAccount() {
  const auth = useAuth();
  const [state, setState] = useState<{ owner: string; account: Account | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const owner = auth.session?.user.id;
  useEffect(() => {
    if (!auth.client || !owner) return;
    let active = true; setState(null);
    const client = auth.client;
    void (async () => {
      try {
        const loadProfile = async () => {
          const result = await client.from("profiles").select("*").eq("id", owner).single();
          if (result.error) throw result.error;
          return profileSchema.parse(result.data);
        };
        let profile: Profile;
        try { profile = await loadProfile(); }
        catch (firstError) {
          if (isExpiredSessionError(firstError as { code?: string; message?: string; status?: number })) {
            const recovery = await client.auth.refreshSession().catch(error => ({ data: { session: null }, error: { message: error instanceof Error ? error.message : "Session refresh failed" } }));
            if (recovery.error || !recovery.data.session) throw new Error("Your sign-in session needs renewal. Try again or sign in again.");
            profile = await loadProfile();
          } else if (isTemporaryRequestError(firstError as { message?: string; status?: number })) {
            await new Promise(resolve => window.setTimeout(resolve, 400));
            profile = await loadProfile();
          } else throw firstError;
        }
        let professional: ProfessionalProfile | null = null;
        if (profile.role === "professional") {
          const result = await client.from("professional_profiles").select("*").eq("profile_id", owner).single();
          if (result.error && isExpiredSessionError(result.error)) {
            const recovery = await client.auth.refreshSession();
            if (recovery.error || !recovery.data.session) throw new Error("Your sign-in session needs renewal. Try again or sign in again.");
            const retry = await client.from("professional_profiles").select("*").eq("profile_id", owner).single();
            if (retry.error) throw retry.error;
            professional = professionalProfileSchema.parse(retry.data);
          } else {
            if (result.error) throw result.error;
            professional = professionalProfileSchema.parse(result.data);
          }
        }
        if (active) setState({ owner, account: { profile, professional }, error: "" });
      } catch (error) {
        const detail = error instanceof Error && /session needs renewal/i.test(error.message)
          ? error.message
          : "Could not load your account right now. Check your connection, then retry or sign in again.";
        if (active) setState({ owner, account: null, error: detail });
      }
    })();
    return () => { active = false; };
  }, [auth.client, owner, attempt]);
  const current = state?.owner === owner ? state : null;
  return {
    ...auth, account: current?.account ?? null,
    accountLoading: auth.loading || (!!owner && !current),
    accountError: auth.error || current?.error || "",
    retry: () => {
      if (auth.error && auth.client && !owner) void auth.client.auth.refreshSession().catch(() => undefined);
      setAttempt((value) => value + 1);
    },
  };
}
