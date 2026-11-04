import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";
import { useAccount } from "../../hooks/use-account";
import { HeroLocationService } from "../../providers/hero-location-service";
export default function AppLayout() {
  const { session, loading } = useAuth();
  const { account } = useAccount();
  if (loading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading account" /></View>;
  if (!session) return <Redirect href="/(auth)/login" />;
  return <HeroLocationService account={account}><Stack screenOptions={{ headerShown: false }} /></HeroLocationService>;
}
