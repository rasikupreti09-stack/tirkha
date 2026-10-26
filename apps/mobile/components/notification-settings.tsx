import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { disablePushNotifications, registerForPushNotifications } from "../lib/notifications";
export function NotificationSettings() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function update(enable: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      if (enable) await registerForPushNotifications(true); else await disablePushNotifications();
      setMessage(enable ? "Booking and chat alerts enabled on this device." : "Push notifications disabled on this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update notifications."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <View className="my-6 rounded-lg border border-border bg-card p-5">
    <Text className="text-lg font-semibold text-primary">Mobile notifications</Text>
    <Text className="mt-2 text-sm text-muted-foreground">Get alerts for assigned booking updates and new chat messages.</Text>
    <View className="mt-4 flex-row flex-wrap gap-3">
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void update(true)} className="min-h-12 justify-center rounded-md bg-primary px-4"><Text className="text-primary-foreground">{busy ? "Updating…" : "Enable alerts"}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void update(false)} className="min-h-12 justify-center rounded-md border border-border px-4"><Text className="text-primary">Disable alerts</Text></Pressable>
    </View>
    {!!message && <Text accessibilityRole="alert" className="mt-3 text-foreground">{message}</Text>}
  </View>;
}
