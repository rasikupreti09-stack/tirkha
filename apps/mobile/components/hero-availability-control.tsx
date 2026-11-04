import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { isCoordinateInHeroOperationalZone, type HeroOperationalZone } from "@tirkha/shared";
import type { Account } from "../hooks/use-account";
import { useAuth } from "../providers/auth-provider";

const GPS_HEARTBEAT_MS = 20_000;
const GPS_MIN_DISTANCE_METERS = 18;
const LOCATION_STALE_MS = 90_000;

type HeroLocation = {
  latitude: number;
  longitude: number;
  updated_at: string;
};

function distanceMeters(a: Pick<HeroLocation, "latitude" | "longitude">, b: Pick<HeroLocation, "latitude" | "longitude">) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function availabilityError(message: string) {
  if (message.includes("ACTIVE_JOB_MUST_REMAIN_ONLINE")) return "Finish your active job before going offline.";
  if (message.includes("VERIFIED_PROFESSIONAL_REQUIRED")) return "Your Hero account must be fully verified before you can go online.";
  if (message.includes("ACTIVE_BOOKING_UNAVAILABLE")) return "Your active booking changed. Refresh your bookings and try again.";
  return "Could not update availability. Check your connection and try again.";
}

/** Foreground-only GPS publisher. Server RPCs remain the authority for eligibility and status. */
export function HeroAvailabilityControl({ account }: { account: Account }) {
  const { client } = useAuth();
  const professional = account.professional;
  const heroId = account.profile.id;
  const zone = professional?.operational_zone as HeroOperationalZone | null | undefined;
  const verified = professional?.verification_status === "verified" && !professional.suspended_at;
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [clock, setClock] = useState(Date.now());
  const mounted = useRef(true);
  const busyRef = useRef(false);
  const lastSentAt = useRef(0);
  const lastSentPoint = useRef<HeroLocation | null>(null);
  const activeBookingId = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshActiveBooking = useCallback(async () => {
    if (!client) return;
    const { data, error: queryError } = await client.from("bookings").select("id")
      .eq("professional_id", heroId).in("status", ["accepted", "on_the_way", "in_progress"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!queryError) activeBookingId.current = data?.id ?? null;
  }, [client, heroId]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setAppActive(state === "active"));
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!client || !verified) { setLoading(false); return; }
    let active = true;
    const refresh = async () => {
      const { data, error: queryError } = await client.from("hero_locations").select("latitude,longitude,updated_at")
        .eq("professional_id", heroId).maybeSingle();
      if (!active) return;
      if (queryError) { setError("Could not check your availability. Retry when your connection is stable."); setLoading(false); return; }
      const stamp = data?.updated_at ? Date.parse(data.updated_at) : NaN;
      const fresh = Number.isFinite(stamp) && stamp <= Date.now() + 30_000 && Date.now() - stamp <= LOCATION_STALE_MS;
      const inZone = !!data && isCoordinateInHeroOperationalZone(data, zone);
      setOnline(fresh && inZone);
      setLastPing(fresh && inZone ? data.updated_at : null);
      if (fresh && inZone && data) {
        lastSentPoint.current = { latitude: data.latitude, longitude: data.longitude, updated_at: data.updated_at };
        lastSentAt.current = stamp;
      }
      setLoading(false);
    };
    void refresh();
    void refreshActiveBooking();
    const channel = client.channel(`mobile-hero-availability:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${heroId}` }, () => { void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${heroId}` }, () => { void refreshActiveBooking(); })
      .subscribe();
    const heartbeat = setInterval(() => { void refreshActiveBooking(); }, 30_000);
    return () => { active = false; clearInterval(heartbeat); void client.removeChannel(channel); };
  }, [client, heroId, verified, zone, refreshActiveBooking]);

  const publishPosition = useCallback(async (position: Location.LocationObject) => {
    if (!client || !mounted.current) return;
    const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    if (!isCoordinateInHeroOperationalZone(point, zone)) {
      setError(`GPS moved outside your registered ${zone ?? "service"} region. Move back into your work area to resume location updates.`);
      return;
    }
    const now = Date.now();
    if (lastSentPoint.current && now - lastSentAt.current < GPS_HEARTBEAT_MS
      && distanceMeters(lastSentPoint.current, point) < GPS_MIN_DISTANCE_METERS) return;
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const heading = position.coords.heading;
      const speed = position.coords.speed;
      const { error: rpcError } = await client.rpc("update_hero_location", {
        p_latitude: point.latitude,
        p_longitude: point.longitude,
        p_heading: heading !== null && heading >= 0 ? heading : null,
        p_speed_mps: speed !== null && speed >= 0 ? speed : null,
        p_active_booking_id: activeBookingId.current,
      });
      if (rpcError) throw rpcError;
      const sent = { ...point, updated_at: new Date().toISOString() };
      lastSentPoint.current = sent;
      lastSentAt.current = Date.now();
      if (mounted.current) { setLastPing(sent.updated_at); setError(""); }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? availabilityError(failure.message) : "GPS update failed. Check your connection.");
    } finally { busyRef.current = false; }
  }, [client, zone]);

  useEffect(() => {
    if (!online || !appActive || !client || !verified || !zone) return;
    let active = true;
    let watcher: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!active || permission.status !== "granted") {
          if (active) setError("Location permission is off. Enable it in phone settings to receive nearby jobs.");
          return;
        }
        if (!await Location.hasServicesEnabledAsync()) {
          if (active) setError("Turn on phone Location/GPS to share your Hero position.");
          return;
        }
        watcher = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8_000,
          distanceInterval: 12,
        }, position => { if (active) void publishPosition(position); });
      } catch {
        if (active) setError("Could not start GPS updates. Keep Tirkha open and retry.");
      }
    })();
    return () => { active = false; watcher?.remove(); };
  }, [online, appActive, client, verified, zone, publishPosition]);

  async function toggleAvailability() {
    if (!client || busyRef.current || busy || loading) return;
    if (!verified || !zone) { setError("Complete Hero verification and select a service region before going online."); return; }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (online) {
        const { error: rpcError } = await client.rpc("set_hero_availability", { p_online: false });
        if (rpcError) throw rpcError;
        setOnline(false);
        setLastPing(null);
        lastSentPoint.current = null;
        lastSentAt.current = 0;
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") throw new Error("Allow location access while using Tirkha to go online.");
        if (!await Location.hasServicesEnabledAsync()) throw new Error("Turn on Location/GPS on your phone, then try again.");
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (!isCoordinateInHeroOperationalZone(point, zone)) throw new Error(`Your current location must be inside your registered ${zone} service region.`);
        const { error: rpcError } = await client.rpc("set_hero_availability", {
          p_online: true, p_latitude: point.latitude, p_longitude: point.longitude,
        });
        if (rpcError) throw rpcError;
        const stamp = new Date().toISOString();
        setOnline(true);
        setLastPing(stamp);
        lastSentPoint.current = { ...point, updated_at: stamp };
        lastSentAt.current = Date.now();
      }
    } catch (failure) {
      setError(failure instanceof Error && !failure.message.match(/^[A-Z_]+$/)
        ? failure.message
        : availabilityError(failure instanceof Error ? failure.message : ""));
    } finally { busyRef.current = false; setBusy(false); }
  }

  const stale = online && (!lastPing || clock - Date.parse(lastPing) > LOCATION_STALE_MS);
  return <View className="mt-4 rounded-xl border border-border bg-card p-4">
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-semibold text-primary">Hero availability</Text>
        <Text accessibilityLiveRegion="polite" className="mt-1 text-sm text-muted-foreground">
          {loading ? "Checking status…" : online ? stale ? "Online · GPS needs reconnecting" : appActive ? "Online · sharing GPS while app is open" : "Online · GPS pauses in background" : "Offline · nearby jobs will not be dispatched"}
        </Text>
      </View>
      <Pressable accessibilityRole="switch" accessibilityLabel="Hero availability" accessibilityState={{ checked: online, disabled: loading || busy || !verified }}
        disabled={loading || busy || !verified} onPress={() => void toggleAvailability()}
        className={`min-h-12 min-w-32 items-center justify-center rounded-lg px-4 ${online ? "bg-emerald-700" : "bg-slate-800"} disabled:opacity-50`}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">{online ? "Go offline" : "Go online"}</Text>}
      </Pressable>
    </View>
    {!verified && <Text className="mt-3 text-sm text-muted-foreground">A verified, active Hero profile is required to receive requests.</Text>}
    {online && lastPing && <Text className="mt-2 text-xs text-muted-foreground">Last GPS update: {new Date(lastPing).toLocaleTimeString()}</Text>}
    {!!error && <Text accessibilityRole="alert" className="mt-3 text-sm text-rose-800">{error}</Text>}
    <Text className="mt-3 text-xs text-muted-foreground">Location is shared only while you are online and Tirkha is open. Keep the app in the foreground during dispatch and active jobs.</Text>
  </View>;
}
