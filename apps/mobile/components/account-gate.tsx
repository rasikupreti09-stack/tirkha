import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Link, Redirect } from "expo-router";
import { tokens, type UserRole } from "@tirkha/shared";
import { useAccount, type Account } from "../hooks/use-account";
export function AccountGate({ roles, children }: { roles: UserRole[]; children: (account: Account) => ReactNode }) {
  const state = useAccount();
  if (state.accountLoading) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading account" /></View>;
  if (state.accountError) return <View className="flex-1 justify-center p-6"><Text accessibilityRole="alert">{state.accountError}</Text><Pressable accessibilityRole="button" onPress={state.retry} className="mt-4 min-h-12 justify-center"><Text className="text-primary underline">Try again</Text></Pressable></View>;
  if (!state.session) return <Redirect href="/(auth)/login" />;
  if (!state.account) return null;
  if (!roles.includes(state.account.profile.role)) return <View className="flex-1 justify-center p-6"><Text className="text-xl font-semibold">This page is for {roles.join(" or ")} accounts.</Text><Link href="/(app)/dashboard" className="mt-4 py-3 text-primary underline">Return to dashboard</Link></View>;
  return <View key={state.account.profile.id} className="flex-1">{children(state.account)}</View>;
}
