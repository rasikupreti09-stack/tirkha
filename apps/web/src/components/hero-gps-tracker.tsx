"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-provider";

type BatteryManagerLike = { level: number; addEventListener?: (type: "levelchange", listener: () => void) => void; removeEventListener?: (type: "levelchange", listener: () => void) => void };
type LocationSnapshot = { latitude: number; longitude: number; heading: number | null; speed: number | null; timestamp: number };
const TRACKING_MIN_INTERVAL_MS = 3_000;
const TRACKING_HEARTBEAT_MS = 15_000;
const MIN_MOVEMENT_METERS = 12;

function distanceMeters(a: LocationSnapshot, b: LocationSnapshot) {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude);
  const lng = radians(b.longitude - a.longitude);
  const arc = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

/** Publishes a verified Hero's active location while this authenticated work screen is open. */
export function HeroGpsTracker({ enabled }: { enabled: boolean }) {
  const { client, session } = useAuth();
  const [status, setStatus] = useState("");
  const positionRef = useRef<LocationSnapshot | null>(null);
  const batteryRef = useRef<number | null>(null);
  const activeBookingRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const lastSentRef = useRef(0);
  const lastSentPositionRef = useRef<LocationSnapshot | null>(null);

  useEffect(() => {
    if (!enabled || !client || !session || typeof navigator === "undefined") return;
    if (!navigator.geolocation) { setStatus("This browser does not support GPS location sharing."); return; }
    let active = true;
    let battery: BatteryManagerLike | null = null;
    let updateBattery: (() => void) | null = null;
    let heartbeat: number | undefined;
    const heroId = session.user.id;

    const loadActiveBooking = async () => {
      const { data, error } = await client.from("bookings").select("id")
        .eq("professional_id", heroId).in("status", ["accepted", "on_the_way", "in_progress"])
        .order("scheduled_at", { ascending: true }).limit(1);
      if (active && !error) activeBookingRef.current = data?.[0]?.id ?? null;
    };
    void loadActiveBooking();
    const bookingsChannel = client.channel(`hero-active-bookings:${heroId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${heroId}` }, () => void loadActiveBooking())
      .subscribe();

    const flush = async () => {
      const position = positionRef.current;
      const now = Date.now();
      if (!active || !position || sendingRef.current || now - position.timestamp > 20_000 || now - lastSentRef.current < TRACKING_MIN_INTERVAL_MS) return;
      const movedMeters = lastSentPositionRef.current ? distanceMeters(lastSentPositionRef.current, position) : Number.POSITIVE_INFINITY;
      if (lastSentRef.current > 0 && movedMeters < MIN_MOVEMENT_METERS && now - lastSentRef.current < TRACKING_HEARTBEAT_MS) return;
      sendingRef.current = true;
      lastSentRef.current = now;
      try {
        const { error } = await client.rpc("update_hero_location", {
          p_latitude: position.latitude,
          p_longitude: position.longitude,
          p_heading: position.heading,
          p_speed_mps: position.speed,
          p_battery_level: batteryRef.current,
          p_active_booking_id: activeBookingRef.current,
        });
        if (error) throw error;
        lastSentPositionRef.current = position;
        if (active) setStatus("Sharing your live location with the customer and Tirkha operations.");
      } catch {
        if (active) setStatus("GPS sharing could not update. Check your connection; updates will retry.");
      } finally {
        sendingRef.current = false;
      }
    };

    const watchId = navigator.geolocation.watchPosition(position => {
      const { latitude, longitude, heading, speed } = position.coords;
      positionRef.current = {
        latitude, longitude,
        heading: heading != null && Number.isFinite(heading) && heading >= 0 ? heading % 360 : null,
        speed: speed != null && Number.isFinite(speed) && speed >= 0 ? speed : null,
        timestamp: position.timestamp,
      };
      void flush();
    }, () => { if (active) setStatus("Location access is off. Enable it in browser settings to share your live position."); }, {
      enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000,
    });
    heartbeat = window.setInterval(() => void flush(), TRACKING_MIN_INTERVAL_MS);

    const batteryApi = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> };
    if (batteryApi.getBattery) void batteryApi.getBattery().then(value => {
      if (!active) return;
      battery = value;
      updateBattery = () => { batteryRef.current = Math.round(value.level * 100); };
      updateBattery();
      value.addEventListener?.("levelchange", updateBattery);
    }).catch(() => undefined);

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      if (heartbeat !== undefined) window.clearInterval(heartbeat);
      if (battery && updateBattery) battery.removeEventListener?.("levelchange", updateBattery);
      void client.removeChannel(bookingsChannel);
    };
  }, [client, enabled, session]);

  return enabled ? <p className="mt-3 text-xs text-muted-foreground" role="status">{status || "Allow GPS access to share your Hero location every few seconds."}</p> : null;
}
