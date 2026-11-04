import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import { isCoordinateInHeroOperationalZone } from "@tirkha/shared";
import type { Account } from "../hooks/use-account";
import { useAuth } from "./auth-provider";

const GPS_HEARTBEAT_MS = 20_000;
const GPS_MIN_DISTANCE_METERS = 18;
const LOCATION_REFRESH_MS = 30_000;

type Point = { latitude: number; longitude: number };
type LocationServiceState = { lastPing: string | null; error: string; active: boolean };
const LocationServiceContext = createContext<LocationServiceState>({ lastPing: null, error: "", active: false });

function distanceMeters(a: Point, b: Point) {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const haversine = Math.sin(lat / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function gpsErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("VERIFIED_PROFESSIONAL_REQUIRED")) return "GPS sharing stopped because this Hero account is not verified.";
  if (message.includes("ACTIVE_BOOKING_UNAVAILABLE")) return "GPS is reconnecting to the active job. Keep Tirkha open.";
  return "GPS update failed. Check location permission, GPS, and internet, then keep Tirkha open to retry.";
}

/** Keeps a verified Hero's foreground GPS stream alive across Expo Router screen changes. */
export function HeroLocationService({ account, children }: { account: Account | null; children: ReactNode }) {
  const { client } = useAuth();
  const professional = account?.professional;
  const heroId = account?.profile.id;
  const zone = professional?.operational_zone;
  const eligible = professional?.verification_status === "verified" && !professional.suspended_at && !!zone;
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [serverOnline, setServerOnline] = useState(false);
  const [lastPing, setLastPing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const onlineRef = useRef(false);
  const busyRef = useRef(false);
  const activeBookingId = useRef<string | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const lastSentAt = useRef(0);
  const latestPosition = useRef<Location.LocationObject | null>(null);

  useEffect(() => {
    const listener = AppState.addEventListener("change", state => setAppActive(state === "active"));
    return () => listener.remove();
  }, []);

  const publish = useCallback(async (position: Location.LocationObject, force = false) => {
    if (!client || !heroId || !zone || !onlineRef.current) return;
    latestPosition.current = position;
    const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    if (!isCoordinateInHeroOperationalZone(point, zone)) {
      setError(`GPS is outside your registered ${zone} service region. Updates will resume when you return.`);
      return;
    }
    const now = Date.now();
    if (!force && lastPoint.current && now - lastSentAt.current < GPS_HEARTBEAT_MS
      && distanceMeters(lastPoint.current, point) < GPS_MIN_DISTANCE_METERS) return;
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
      const sentAt = new Date().toISOString();
      lastPoint.current = point;
      lastSentAt.current = Date.now();
      setLastPing(sentAt);
      setError("");
    } catch (failure) {
      setError(gpsErrorMessage(failure));
    } finally {
      busyRef.current = false;
    }
  }, [client, heroId, zone]);

  const refreshActiveBooking = useCallback(async () => {
    if (!client || !heroId) return;
    const { data, error: queryError } = await client.from("bookings").select("id")
      .eq("professional_id", heroId).in("status", ["accepted", "on_the_way", "in_progress"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (queryError) return;
    const nextId = data?.id ?? null;
    if (activeBookingId.current === nextId) return;
    activeBookingId.current = nextId;
    const position = latestPosition.current;
    if (position && onlineRef.current) void publish(position, true);
  }, [client, heroId, publish]);

  useEffect(() => {
    if (!client || !heroId || !eligible || !zone) {
      onlineRef.current = false;
      setServerOnline(false);
      return;
    }
    let mounted = true;
    const refreshLocation = async () => {
      const { data, error: queryError } = await client.from("hero_locations")
        .select("latitude,longitude,updated_at,status,active_booking_id")
        .eq("professional_id", heroId).maybeSingle();
      if (!mounted) return;
      if (queryError) { setError("Could not refresh Hero GPS status. Reconnecting automatically."); return; }
      const isOnline = !!data && ["online_idle", "en_route", "on_service"].includes(data.status)
        && isCoordinateInHeroOperationalZone(data, zone);
      onlineRef.current = isOnline;
      setServerOnline(isOnline);
      if (!isOnline || !data) {
        setLastPing(null);
        lastPoint.current = null;
        lastSentAt.current = 0;
        activeBookingId.current = null;
        latestPosition.current = null;
        return;
      }
      const stamp = Date.parse(data.updated_at);
      if (Number.isFinite(stamp)) {
        setLastPing(data.updated_at);
        lastPoint.current = { latitude: data.latitude, longitude: data.longitude };
        lastSentAt.current = stamp;
      }
      activeBookingId.current = data.active_booking_id;
      setError("");
      void refreshActiveBooking();
    };
    void refreshLocation();
    const channel = client.channel(`mobile-hero-gps-service:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${heroId}` }, () => { void refreshLocation(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${heroId}` }, () => { void refreshActiveBooking(); })
      .subscribe();
    const poll = setInterval(() => { if (appActive) { void refreshLocation(); void refreshActiveBooking(); } }, LOCATION_REFRESH_MS);
    return () => {
      mounted = false;
      clearInterval(poll);
      onlineRef.current = false;
      void client.removeChannel(channel);
    };
  }, [client, heroId, eligible, zone, appActive, refreshActiveBooking]);

  useEffect(() => {
    if (!serverOnline || !appActive || !eligible || !zone) return;
    let active = true;
    let watcher: Location.LocationSubscription | null = null;
    void (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== "granted") { setError("Location permission is off. Re-enable it in phone settings to resume GPS sharing."); return; }
        if (!await Location.hasServicesEnabledAsync()) { setError("Phone Location/GPS is off. Turn it on to resume Hero tracking."); return; }
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        await publish(current);
        watcher = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 8_000,
          distanceInterval: 12,
        }, position => { if (active) void publish(position); });
      } catch (failure) {
        if (active) setError(gpsErrorMessage(failure));
      }
    })();
    return () => { active = false; watcher?.remove(); };
  }, [serverOnline, appActive, eligible, zone, publish]);

  const context = useMemo(() => ({ lastPing, error, active: serverOnline && appActive }), [lastPing, error, serverOnline, appActive]);
  return <LocationServiceContext.Provider value={context}>{children}</LocationServiceContext.Provider>;
}

export function useHeroLocationService() { return useContext(LocationServiceContext); }
