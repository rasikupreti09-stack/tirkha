import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";
export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading account" /></View>;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
