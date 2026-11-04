import { useCallback, useEffect, useMemo, useState } from "react";
import { profileSchema, professionalProfileSchema, type Profile, type ProfessionalProfile } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
export type Account = { profile: Profile; professional: ProfessionalProfile | null };
export function useAccount() {
  const auth = useAuth();
  const [state, setState] = useState<{ owner: string; account: Account | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const owner = auth.session?.user.id;
  const demoAccount = useMemo<Account | null>(() => {
    const demo = auth.demoUser;
    if (!demo) return null;
    const profile = profileSchema.parse({
      id: demo.id,
      full_name: demo.fullName,
      phone_number: demo.phone,
      phone: demo.phone,
      avatar_url: null,
      role: demo.role,
      created_at: new Date().toISOString(),
      email: null,
    });
    const professional = demo.role === "professional" ? professionalProfileSchema.parse({
      profile_id: demo.id,
      bio: null,
      verification_status: "pending",
      rating: 0,
      hourly_rate_paisa: null,
      trade_code: demo.tradeCategory,
      trade_category: demo.tradeCategory,
      operational_zone: null,
      citizenship_document_path: null,
      suspended_at: null,
    }) : null;
    return { profile, professional };
  }, [auth.demoUser]);
  useEffect(() => {
    if (!auth.client || !owner) return;
    let active = true; setState(null);
    const client = auth.client;
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
        if (active) setState({ owner, account: { profile, professional }, error: "" });
      } catch { if (active) setState({ owner, account: null, error: "Could not load your account. Please try again." }); }
    })();
    return () => { active = false; };
  }, [auth.client, owner, attempt]);
  const current = state?.owner === owner ? state : null;
  const signOut = useCallback(async () => {
    if (signOutBusy) return;
    setSignOutBusy(true);
    setNotice("");
    try { await auth.signOut(); }
    finally { setSignOutBusy(false); }
  }, [auth.signOut, signOutBusy]);
  return {
    ...auth, account: demoAccount ?? current?.account ?? null,
    accountLoading: auth.loading || (!auth.isDemo && !!owner && !current),
    accountError: auth.error || current?.error || "",
    retry: () => setAttempt((value) => value + 1),
    signOut,
    signOutBusy,
    notice,
    setNotice,
  };
}
