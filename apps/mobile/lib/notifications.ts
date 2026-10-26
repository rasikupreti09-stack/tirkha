import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { randomUUID } from "expo-crypto";
import { Platform } from "react-native";
import { expoProjectId } from "@tirkha/shared";
import { getSupabase, isLocalMock } from "./supabase";

const INSTALLATION_KEY = "tirkha.push.installation.v1";
const ENABLED_KEY = "tirkha.push.enabled-user.v1";
let registration: Promise<void> | null = null;
let disabling = false;
export async function notificationModule() {
  if (Platform.OS === "web" || Constants.appOwnership === "expo") throw new Error("Push notifications require a Tirkha development or production build on a physical device.");
  return import("expo-notifications");
}
export async function registerForPushNotifications(requestPermission: boolean) {
  if (disabling) return;
  if (registration) return registration;
  registration = (async () => {
    if (isLocalMock) { if (requestPermission) throw new Error("Push delivery is disabled in local mock mode. Configure an EAS project and hosted Supabase first."); return; }
    const client = getSupabase();
    const { data } = await client.auth.getSession();
    const owner = data.session?.user.id;
    if (!owner) throw new Error("Sign in to enable notifications.");
    if (!requestPermission && await AsyncStorage.getItem(ENABLED_KEY) !== owner) return;
    const notifications = await notificationModule();
    const device = await import("expo-device");
    if (!device.isDevice) throw new Error("Enable push on a physical device.");
    const projectId = expoProjectId(Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID);
    if (Platform.OS === "android") await notifications.setNotificationChannelAsync("bookings", { name: "Booking messages and updates", importance: notifications.AndroidImportance.DEFAULT });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && requestPermission && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    if (!permission.granted) {
      await unregisterPushDevice();
      throw new Error("Notifications are disabled. Allow them in device settings, then try again.");
    }
    const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
    let installationId = await AsyncStorage.getItem(INSTALLATION_KEY);
    if (!installationId) { installationId = randomUUID(); await AsyncStorage.setItem(INSTALLATION_KEY, installationId); }
    const current = await client.auth.getSession();
    if (current.data.session?.user.id !== owner) throw new Error("Your account changed. Try enabling notifications again.");
    const { error } = await client.rpc("register_push_device", { p_token: token, p_installation_id: installationId });
    if (error) throw new Error("Could not register this device. Please try again.");
    await AsyncStorage.setItem(ENABLED_KEY, owner);
  })();
  try { await registration; } finally { registration = null; }
}
async function unregisterPushDevice() {
  const id = await AsyncStorage.getItem(INSTALLATION_KEY);
  if (id) {
    const { error } = await getSupabase().rpc("unregister_push_device", { p_installation_id: id });
    if (error) throw new Error("Could not disable device notifications. Check your connection and retry.");
  }
  await AsyncStorage.removeItem(ENABLED_KEY);
}
export async function disablePushNotifications() {
  // Complete an in-flight registration before revoking it, including during sign-out.
  disabling = true;
  try {
    try { await registration; } catch { /* Revocation still needs to run. */ }
    await unregisterPushDevice();
  } finally { disabling = false; }
}


