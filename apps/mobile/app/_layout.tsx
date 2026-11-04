import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { tokens } from "@tirkha/shared";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "../providers/auth-provider";
import { PushNotificationBridge } from "../components/push-notification-bridge";
import { AppErrorBoundary } from "../components/app-error-boundary";
export default function RootLayout() {
  return <AppErrorBoundary><AuthProvider><StatusBar style="dark" /><SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tokens.colors.background } }} /><PushNotificationBridge />
  </SafeAreaView></AuthProvider></AppErrorBoundary>;
}

