"use client";
import { useEffect, useMemo, useState } from "react";
import { Activity, MapPin, Radio, ShieldCheck } from "lucide-react";
import type { WorkflowBooking } from "@tirkha/shared";
import { MapTracker, type TrackedPoint } from "./map-tracker-loader";
import { useAuth } from "./auth-provider";

type HeroLocation = {
  professional_id: string; latitude: number; longitude: number; heading: number | null;
  speed_mps: number | null; battery_level: number | null; active_booking_id: string | null;
  status: "online_idle" | "en_route" | "on_service"; updated_at: string;
};
type ChannelState = "connecting" | "live" | "reconnecting";
const activeStatuses = ["accepted", "on_the_way", "in_progress"];

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degree: number) => degree * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude), dLng = radians(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function statusTitle(status: WorkflowBooking["status"]) {
  if (status === "accepted") return "Your Hero accepted the job";
  if (status === "on_the_way") return "Your Hero is on the way";
  return "Your service is in progress";
}

export function CustomerTrackingMap({ booking }: { booking: WorkflowBooking }) {
  const { client } = useAuth();
  const [hero, setHero] = useState<HeroLocation | null>(null);
  const [channelState, setChannelState] = useState<ChannelState>("connecting");
  const enabled = !!client && !!booking.professional_id && activeStatuses.includes(booking.status);

  useEffect(() => {
    if (!client || !booking.professional_id || !activeStatuses.includes(booking.status)) {
      setHero(null);
      setChannelState("connecting");
      return;
    }
    let active = true;
    const updateIfNewer = (row: HeroLocation | null) => {
      if (!row || !active) return;
      setHero(current => !current || Date.parse(row.updated_at) >= Date.parse(current.updated_at) ? row : current);
    };
    void client.from("hero_locations")
      .select("professional_id,latitude,longitude,heading,speed_mps,battery_level,active_booking_id,status,updated_at")
      .eq("professional_id", booking.professional_id).maybeSingle()
      .then(result => { if (!result.error) updateIfNewer(result.data as HeroLocation | null); });
    const channel = client.channel(`hero-tracking:${booking.professional_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${booking.professional_id}` }, payload => {
        updateIfNewer((payload.new as HeroLocation | null) ?? null);
      })
      .subscribe(status => {
        if (!active) return;
        setChannelState(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED" ? "reconnecting" : "connecting");
      });
    return () => { active = false; void client.removeChannel(channel); };
  }, [booking.professional_id, booking.status, client]);

  const destination = useMemo(() => booking.latitude != null && booking.longitude != null
    ? { latitude: booking.latitude, longitude: booking.longitude } : null, [booking.latitude, booking.longitude]);
  if (!enabled || !destination) return null;

  const freshHero = hero && Date.now() - Date.parse(hero.updated_at) <= 90_000 ? hero : null;
  const origin = freshHero ? { latitude: freshHero.latitude, longitude: freshHero.longitude } : undefined;
  const points: TrackedPoint[] = [
    ...(freshHero ? [{ id: freshHero.professional_id, label: "Your Hero", kind: "hero" as const, coordinates: origin!, heading: freshHero.heading, updatedAt: freshHero.updated_at }] : []),
    { id: booking.id, label: "Your service address", kind: "customer", coordinates: destination },
  ];
  const distanceKm = origin ? haversineKm(origin, destination) : null;
  const isLive = !!freshHero && channelState === "live";
  const connectionLabel = !freshHero
    ? "Waiting for your Hero's GPS"
    : isLive ? "Live location connected" : channelState === "reconnecting" ? "Reconnecting to live location" : "Location recently updated";

  return <section className="tirkha-tracking-shell mt-5" aria-label="Live service tracking">
    <header className="tirkha-tracking-header">
      <div className="min-w-0">
        <p className="tirkha-tracking-kicker"><span className={`tirkha-live-indicator ${isLive ? "is-live" : ""}`} />TIRKHA LIVE TRIP</p>
        <h3>{statusTitle(booking.status)}</h3>
        <p className="tirkha-tracking-subtitle">A clear view of your Hero's journey to your service location.</p>
      </div>
      <span className={`tirkha-connection-badge ${isLive ? "is-live" : ""}`}>
        <Radio size={15} aria-hidden="true" />{connectionLabel}
      </span>
    </header>

    <div className="tirkha-tracking-map-wrap">
      <MapTracker points={points} origin={origin} destination={destination} navigation navigationTarget={destination} live={isLive} />
      <div className="tirkha-trust-note"><ShieldCheck size={15} aria-hidden="true" /><span>Location shared for this active booking</span></div>
    </div>

    <footer className="tirkha-tracking-footer">
      <div className="tirkha-tracking-metric">
        <span className="tirkha-metric-icon"><MapPin size={16} aria-hidden="true" /></span>
        <span><small>Distance to you</small><strong>{distanceKm == null ? "Waiting for GPS" : `${distanceKm.toFixed(1)} km`}</strong></span>
      </div>
      <div className="tirkha-tracking-metric">
        <span className="tirkha-metric-icon"><Activity size={16} aria-hidden="true" /></span>
        <span><small>Hero's movement</small><strong>{freshHero?.speed_mps == null ? "Location updates live" : `${(freshHero.speed_mps * 3.6).toFixed(0)} km/h`}</strong></span>
      </div>
      <p className="tirkha-gps-updated">{freshHero ? `GPS updated ${new Date(freshHero.updated_at).toLocaleTimeString()}` : "The map will center on your Hero when GPS is available."}</p>
    </footer>
  </section>;
}
