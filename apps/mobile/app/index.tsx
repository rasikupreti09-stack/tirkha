import { Redirect } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
export default function Home() {
  const { session, loading, isDemo } = useAuth();
  if (loading) return <View className="flex-1 items-center justify-center bg-background px-8">
    <ActivityIndicator size="large" color={tokens.colors.primary} accessibilityLabel="Loading account" />
    <Text accessibilityLiveRegion="polite" className="mt-5 text-xl font-semibold text-primary">Tirkha | तिर्खा</Text>
    <Text className="mt-2 text-center text-muted-foreground">Preparing your account…</Text>
  </View>;
  return <Redirect href={session || isDemo ? "/(app)" : "/(auth)/login"} />;
}
