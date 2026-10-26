import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
export default function Home() {
  const { session, loading } = useAuth();
  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading account" /></View>;
  return <Redirect href={session ? "/(app)/dashboard" : "/(auth)/login"} />;
}
