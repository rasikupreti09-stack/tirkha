import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { profileSchema, professionalProfileSchema, tokens, type Profile, type ProfessionalProfile } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";
import { NotificationSettings } from "../../components/notification-settings";
import { disablePushNotifications } from "../../lib/notifications";

export default function Dashboard() {
  const { client, session } = useAuth();
  const [account, setAccount] = useState<{ owner: string; profile: Profile; professional: ProfessionalProfile | null } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!client || !session) return;
    let active = true;
    const owner = session.user.id;
    setError(""); setAccount(null);
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
        if (active) setAccount({ owner, profile, professional });
      } catch { if (active) setError("We could not load your profile. Please try again or contact support."); }
    })();
    return () => { active = false; };
  }, [client, session?.user.id, attempt]);
  async function signOut() {
    if (!client || busy) return;
    setBusy(true); setError("");
    try {
      await disablePushNotifications();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch (error) { setError(error instanceof Error ? error.message : "Sign out failed. Please try again."); }
    finally { setBusy(false); }
  }
  if (!session) return null;
  const current = account?.owner === session.user.id ? account : null;
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
    <View className="mb-8 flex-row items-center justify-between">
      <Text className="text-2xl font-semibold text-primary">Tirkha</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} className="min-h-11 justify-center rounded-md border border-border px-4 py-3">
        <Text className="font-medium text-primary">{busy ? "Signing out…" : "Sign out"}</Text>
      </Pressable>
    </View>
    <Link href="/(app)/categories" className="mb-6 rounded-md bg-primary px-4 py-4 text-center font-semibold text-primary-foreground">Explore services</Link>
    <View className="rounded-lg border border-border bg-card p-6">
      <Text accessibilityRole="header" className="mb-4 text-2xl font-semibold text-foreground">{current ? `Welcome, ${current.profile.full_name || "there"}` : "Your dashboard"}</Text>
      {error ? <View>
        <Text accessibilityRole="alert" className="text-foreground">{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} className="mt-4 min-h-11 justify-center">
          <Text className="font-medium text-primary underline">Try again</Text>
        </Pressable>
      </View> : !current ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading profile" /> : <View>
        <Text className="mb-4 capitalize text-foreground">{current.profile.role} account</Text>
        {current.professional && <Text className="mb-4 text-foreground">Verification: {current.professional.verification_status}. {current.professional.verification_status === "pending" ? "Your account is awaiting verification before you can access available jobs." : current.professional.verification_status === "rejected" ? "Contact support about your verification." : "Your professional account is verified."}</Text>}
        {current.profile.role === "customer" && <View><Link href="/(app)/book" className="mb-3 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">Request a service</Link><Link href="/(app)/bookings" className="py-4 text-primary underline">My bookings</Link></View>}{current.profile.role === "professional" && <Link href="/(app)/jobs" className="rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">Professional jobs</Link>}
      </View>}
    </View>
    <NotificationSettings />
  </ScrollView>;
}


