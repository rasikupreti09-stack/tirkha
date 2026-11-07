import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, isDemo, demoUser, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session && !isDemo) return <Redirect href="/(auth)/login" />;

  const displayName = demoUser?.fullName ?? session?.user.user_metadata?.full_name ?? "Tirkha account";
  const phone = demoUser?.phone ?? session?.user.phone ?? "";
  const role = demoUser?.role === "professional" ? "Service Hero" : "Customer";

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch {
      setError("Sign out failed. Please try again.");
    } finally {
      setSigningOut(false);
    }
  }

  return <View className="flex-1 bg-background px-5 pt-8">
    <Text className="text-3xl font-bold text-primary">Profile</Text>
    <Text className="mt-2 text-base text-muted-foreground">Your Tirkha account details</Text>

    <View className="mt-7 rounded-3xl border border-border bg-card p-5">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Text className="text-2xl font-bold text-primary">{displayName.trim().charAt(0).toUpperCase() || "T"}</Text>
      </View>
      <Text className="mt-4 text-xl font-bold text-foreground">{displayName}</Text>
      {!!phone && <Text className="mt-1 text-base text-muted-foreground">{phone}</Text>}
      <Text className="mt-3 self-start rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{role}{isDemo ? " · Demo" : ""}</Text>
    </View>

    {error && <Text accessibilityRole="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</Text>}

    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      disabled={signingOut}
      onPress={() => void handleSignOut()}
      className="mt-7 min-h-14 flex-row items-center justify-center rounded-2xl bg-primary px-5"
      style={({ pressed }) => ({ opacity: pressed || signingOut ? 0.8 : 1 })}
    >
      {signingOut ? <ActivityIndicator color="#ffffff" /> : <Text className="text-base font-bold text-primary-foreground">Sign Out</Text>}
    </Pressable>
  </View>;
}
