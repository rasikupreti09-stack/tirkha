import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useRouter } from "expo-router";
import { pushNavigationSchema } from "@tirkha/shared";
import type { NotificationResponse } from "expo-notifications";
import { useAuth } from "../providers/auth-provider";
import { notificationModule, registerForPushNotifications } from "../lib/notifications";
export function PushNotificationBridge() {
  const { session } = useAuth();
  const router = useRouter();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    let cleanup = () => {};
    const owner = session?.user.id;
    if (!owner) return;
    const register = () => { void registerForPushNotifications(false).catch(() => {}); };
    register();
    const foreground = AppState.addEventListener("change", (state) => { if (state === "active") register(); });
    void notificationModule().then(async (notifications) => {
      if (!active) return;
      notifications.setNotificationHandler({ handleNotification: async (notification) => {
        const data = pushNavigationSchema.safeParse(notification.request.content.data);
        const visible = active && data.success && data.data.recipient_id === owner;
        return { shouldShowBanner: visible, shouldShowList: visible, shouldPlaySound: visible, shouldSetBadge: false };
      } });
      const open = (response: NotificationResponse) => {
        if (!active) return;
        const id = response.notification.request.identifier;
        const data = pushNavigationSchema.safeParse(response.notification.request.content.data);
        if (!data.success || data.data.recipient_id !== owner || handled.current === id) return;
        handled.current = id;
        // RLS on the destination validates membership; never navigate a push-provided URL.
        router.push(data.data.kind === "hero_dispatch" ? "/(app)/jobs" : { pathname: "/(app)/chat", params: { booking: data.data.booking_id } });
        void notifications.clearLastNotificationResponseAsync();
      };
      const responseSubscription = notifications.addNotificationResponseReceivedListener(open);
      const tokenSubscription = notifications.addPushTokenListener(register);
      cleanup = () => { responseSubscription.remove(); tokenSubscription.remove(); notifications.setNotificationHandler(null); };
      const last = await notifications.getLastNotificationResponseAsync();
      if (last) open(last);
    }).catch(() => {});
    return () => { active = false; foreground.remove(); cleanup(); };
  }, [session?.user.id, router]);
  return null;
}
