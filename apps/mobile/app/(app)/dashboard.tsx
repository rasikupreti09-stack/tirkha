import { Link } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAccount } from "../../hooks/use-account";
import { NotificationSettings } from "../../components/notification-settings";
import { disablePushNotifications } from "../../lib/notifications";

export default function Dashboard() {
  const state = useAccount();

  async function signOut() {
    if (state.signOutBusy) return;
    try {
      if (!state.isDemo && state.session) await disablePushNotifications();
      await state.signOut();
    } catch (failure) {
      state.setNotice(failure instanceof Error ? failure.message : "Sign out failed. Please try again.");
    }
  }

  if (state.accountLoading) return <View className="flex-1 items-center justify-center bg-background p-8">
    <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading your Tirkha account" />
    <Text className="mt-4 text-center text-muted-foreground">Loading your account…</Text>
  </View>;

  if (!state.account) return <View className="flex-1 justify-center bg-background p-6">
    <Text accessibilityRole="header" className="mb-2 text-2xl font-semibold text-primary">We couldn’t open your dashboard</Text>
    <Text accessibilityRole="alert" className="mb-5 text-foreground">{state.accountError || "Your account details are unavailable right now."}</Text>
    <Pressable accessibilityRole="button" onPress={state.retry} className="min-h-12 items-center justify-center rounded-md bg-primary p-3">
      <Text className="font-semibold text-primary-foreground">Try again</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => void signOut()} className="mt-2 min-h-12 items-center justify-center p-3">
      <Text className="text-primary underline">Sign out and return to sign in</Text>
    </Pressable>
  </View>;

  const { profile, professional } = state.account;
  return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
    <View className="mb-8 flex-row items-center justify-between">
      <View>
        <Text className="text-2xl font-semibold text-primary">Tirkha | तिर्खा</Text>
        <Text className="text-sm text-muted-foreground">Your home, effortlessly managed.</Text>
      </View>
      <Pressable accessibilityRole="button" disabled={state.signOutBusy} onPress={() => void signOut()} className="min-h-11 justify-center rounded-md border border-border px-4 py-3">
        <Text className="font-medium text-primary">{state.signOutBusy ? "Signing out…" : "Sign out"}</Text>
      </Pressable>
    </View>

    {state.notice ? <Text accessibilityRole="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-foreground">{state.notice}</Text> : null}
    {state.isDemo ? <View className="mb-5 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
      <Text className="mb-1 font-semibold text-emerald-950">Demo session on this device</Text>
      <Text className="text-emerald-900">You are signed in as a {profile.role === "professional" ? "Hero" : "customer"} preview. Browse the app safely; demo requests do not create live bookings, contact Heroes, or send payments.</Text>
    </View> : null}

    <View className="mb-5 rounded-lg border border-border bg-card p-5">
      <Text accessibilityRole="header" className="mb-1 text-2xl font-semibold text-foreground">Namaste, {profile.full_name || "there"}</Text>
      <Text className="mb-5 capitalize text-muted-foreground">{profile.role === "professional" ? `${professional?.trade_category?.replaceAll("_", " ").toLowerCase() || "service"} Hero` : "Customer account"}</Text>
      <Link href="/(app)/categories" className="mb-3 min-h-12 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">Explore services</Link>
      {profile.role === "customer" && !state.isDemo ? <>
        <Link href="/(app)/book" className="mb-3 min-h-12 rounded-md border border-border p-4 text-center font-semibold text-primary">Request a service</Link>
        <Link href="/(app)/bookings" className="min-h-12 p-3 text-center text-primary underline">My bookings</Link>
      </> : null}
      {profile.role === "professional" ? <View className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-4">
        <Text className="mb-1 font-semibold text-foreground">{state.isDemo ? "Hero preview" : `Verification: ${professional?.verification_status ?? "pending"}`}</Text>
        <Text className="mb-3 text-foreground">{state.isDemo ? "Live job dispatch and GPS sharing need a verified, database-backed Hero account." : professional?.verification_status === "verified" ? "Your profile is verified." : "Your application is awaiting admin review. Job dispatch stays locked until approval."}</Text>
        {!state.isDemo && (!professional?.operational_zone || !professional?.citizenship_document_path) ? <Link href="/(app)/hero-register" className="min-h-11 rounded-md bg-primary p-3 text-center font-semibold text-primary-foreground">Continue registration</Link> : null}
        {!state.isDemo && professional?.verification_status === "verified" ? <Link href="/(app)/jobs" className="min-h-11 rounded-md bg-primary p-3 text-center font-semibold text-primary-foreground">Open job board</Link> : null}
      </View> : null}
      {profile.role === "customer" && state.isDemo ? <Text className="mt-3 text-sm text-muted-foreground">Sign in with a real verified account to create and track live service requests.</Text> : null}
    </View>
    {!state.isDemo && state.session ? <NotificationSettings /> : null}
  </ScrollView>;
}
