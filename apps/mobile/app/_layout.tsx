import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { tokens } from "@tirkha/shared";
export default function RootLayout() {
  return <><StatusBar style="dark" /><Stack screenOptions={{
    headerStyle: { backgroundColor: tokens.colors.background },
    headerTintColor: tokens.colors.primary,
    contentStyle: { backgroundColor: tokens.colors.background },
  }}><Stack.Screen name="index" options={{ title: "Tirkha" }} /></Stack></>;
}
