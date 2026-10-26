import { Redirect, Link } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { tokens } from "@tirkha/shared";
import { useAuth } from "../../providers/auth-provider";
export default function Callback() {
  const { session, loading, callbackError, callbackPending, error } = useAuth();
  if (session && !callbackPending) return <Redirect href="/(app)/dashboard" />;
  return <View className="flex-1 justify-center bg-background p-6">
    <Text accessibilityRole="header" className="mb-4 text-2xl font-semibold text-primary">Confirm your account</Text>
    {loading || callbackPending ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Confirming account" /> :
      <Text accessibilityRole={callbackError || error ? "alert" : undefined} className="text-foreground">{callbackError || error || "After confirming your email, you can sign in to continue."}</Text>}
    <Link href="/(auth)/login" replace className="mt-6 py-3 font-medium text-primary underline">Return to sign in</Link>
  </View>;
}
