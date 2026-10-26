import { useEffect, useState } from "react";
import { profileSchema, professionalProfileSchema, type Profile, type ProfessionalProfile } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
export type Account = { profile: Profile; professional: ProfessionalProfile | null };
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
  return {
    ...auth, account: current?.account ?? null,
    accountLoading: auth.loading || (!!owner && !current),
    accountError: auth.error || current?.error || "",
    retry: () => setAttempt((value) => value + 1),
  };
}
