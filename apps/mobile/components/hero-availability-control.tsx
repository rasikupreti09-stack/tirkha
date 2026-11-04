import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { isCoordinateInHeroOperationalZone, type HeroOperationalZone } from "@tirkha/shared";
import type { Account } from "../hooks/use-account";
import { useAuth } from "../providers/auth-provider";
import { useHeroLocationService } from "../providers/hero-location-service";

const LOCATION_STALE_MS = 90_000;

function availabilityError(message: string) {
  if (message.includes("ACTIVE_JOB_MUST_REMAIN_ONLINE")) return "Finish your active job before going offline.";
  if (message.includes("VERIFIED_PROFESSIONAL_REQUIRED")) return "Your Hero account must be fully verified before you can go online.";
  if (message.includes("ACTIVE_BOOKING_UNAVAILABLE")) return "Your active booking changed. Refresh your bookings and try again.";
  return "Could not update availability. Check your connection and try again.";
}

/** Foreground-only GPS publisher. Server RPCs remain the authority for eligibility and status. */
export function HeroAvailabilityControl({ account }: { account: Account }) {
  const { client } = useAuth();
  const gps = useHeroLocationService();
  const professional = account.professional;
  const heroId = account.profile.id;
  const zone = professional?.operational_zone as HeroOperationalZone | null | undefined;
  const verified = professional?.verification_status === "verified" && !professional.suspended_at;
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const busyRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(timer);
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
      const inZone = !!data && isCoordinateInHeroOperationalZone(data, zone);
      const validTimestamp = Number.isFinite(stamp) && stamp <= Date.now() + 30_000;
      setOnline(inZone && validTimestamp);
      setLastPing(inZone && validTimestamp ? data?.updated_at ?? null : null);
      setLoading(false);
    };
    void refresh();
    const channel = client.channel(`mobile-hero-availability:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${heroId}` }, () => { void refresh(); })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [client, heroId, verified, zone]);

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
      }
    } catch (failure) {
      setError(failure instanceof Error && !failure.message.match(/^[A-Z_]+$/)
        ? failure.message
        : availabilityError(failure instanceof Error ? failure.message : ""));
    } finally { busyRef.current = false; setBusy(false); }
  }

  const effectiveLastPing = gps.lastPing ?? lastPing;
  const stale = online && (!effectiveLastPing || clock - Date.parse(effectiveLastPing) > LOCATION_STALE_MS);
  return <View className="mt-4 rounded-xl border border-border bg-card p-4">
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-semibold text-primary">Hero availability</Text>
        <Text accessibilityLiveRegion="polite" className="mt-1 text-sm text-muted-foreground">
          {loading ? "Checking status…" : online ? stale ? "Online · GPS needs reconnecting" : gps.active ? "Online · GPS sharing active" : "Online · GPS pauses in the background" : "Offline · nearby jobs will not be dispatched"}
        </Text>
      </View>
      <Pressable accessibilityRole="switch" accessibilityLabel="Hero availability" accessibilityState={{ checked: online, disabled: loading || busy || !verified }}
        disabled={loading || busy || !verified} onPress={() => void toggleAvailability()}
        className={`min-h-12 min-w-32 items-center justify-center rounded-lg px-4 ${online ? "bg-emerald-700" : "bg-slate-800"} disabled:opacity-50`}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">{online ? "Go offline" : "Go online"}</Text>}
      </Pressable>
    </View>
    {!verified && <Text className="mt-3 text-sm text-muted-foreground">A verified, active Hero profile is required to receive requests.</Text>}
    {online && effectiveLastPing && <Text className="mt-2 text-xs text-muted-foreground">Last GPS update: {new Date(effectiveLastPing).toLocaleTimeString()}</Text>}
    {!!(gps.error || error) && <Text accessibilityRole="alert" className="mt-3 text-sm text-rose-800">{gps.error || error}</Text>}
    <Text className="mt-3 text-xs text-muted-foreground">Location sharing continues while you navigate Tirkha, and pauses when the app is in the background. Keep Tirkha open during dispatch and active jobs.</Text>
  </View>;
}
