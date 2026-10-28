"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { Coordinates } from "@tirkha/shared";
import { MapTracker, type TrackedPoint } from "./map-tracker-loader";
import { useAuth } from "./auth-provider";

type HeroLocation = {
  professional_id: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  updated_at: string;
};

/** A compact, booking-scoped map for an eligible Hero and the customer's saved pin. */
export const HeroJobLocationMap = memo(function HeroJobLocationMap({
  professionalId,
  destination,
  destinationLabel,
  demo = false,
}: {
  professionalId: string;
  destination: Coordinates;
  destinationLabel: string;
  demo?: boolean;
}) {
  const { client } = useAuth();
  const [hero, setHero] = useState<HeroLocation | null>(null);
  const [heroLocationStale, setHeroLocationStale] = useState(false);

  useEffect(() => {
    if (demo || !client || !professionalId) {
      setHero(null);
      return;
    }
    let active = true;
    const update = (row: HeroLocation | null) => {
      if (!active || !row) return;
      setHeroLocationStale(false);
      setHero(current => {
        if (current && Date.parse(row.updated_at) < Date.parse(current.updated_at)) return current;
        if (current?.latitude === row.latitude && current.longitude === row.longitude && current.heading === row.heading && current.updated_at === row.updated_at) return current;
        return row;
      });
    };
    void (async () => {
      try {
        const result = await client.from("hero_locations")
          .select("professional_id,latitude,longitude,heading,updated_at")
          .eq("professional_id", professionalId)
          .maybeSingle();
        if (!result.error) update(result.data as HeroLocation | null);
      } catch { /* The realtime stream can still provide a new GPS location. */ }
    })();
    const channel = client.channel(`hero-job-map:${professionalId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_locations", filter: `professional_id=eq.${professionalId}` }, payload => {
        update((payload.new as HeroLocation | null) ?? null);
      })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [client, demo, professionalId]);

  useEffect(() => {
    if (!hero || demo) return;
    const delay = Math.max(0, Date.parse(hero.updated_at) + 90_000 - Date.now());
    const timer = window.setTimeout(() => setHeroLocationStale(true), delay);
    return () => window.clearTimeout(timer);
  }, [demo, hero]);

  const customerPoint = useMemo<TrackedPoint>(() => ({ id: "customer-destination", label: destinationLabel, kind: "customer", coordinates: destination }), [destination.latitude, destination.longitude, destinationLabel]);
  const freshHero = hero && !heroLocationStale && Date.now() - Date.parse(hero.updated_at) <= 90_000 ? hero : null;
  const origin = useMemo(() => freshHero ? { latitude: freshHero.latitude, longitude: freshHero.longitude } : undefined, [freshHero?.latitude, freshHero?.longitude]);
  const points = useMemo<TrackedPoint[]>(() => [
    ...(freshHero ? [{ id: freshHero.professional_id, label: "Your live Hero location", kind: "hero" as const, coordinates: origin!, heading: freshHero.heading, updatedAt: freshHero.updated_at }] : []),
    customerPoint,
  ], [customerPoint, freshHero, origin]);

  return <div className="mt-4 rounded-xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <div><p className="text-sm font-semibold text-slate-900">Customer location</p><p className="text-xs text-slate-600">{destinationLabel}</p></div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${freshHero ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
        {demo ? "Demo pin · no live Hero GPS" : freshHero ? "Hero GPS live" : "Waiting for Hero GPS"}
      </span>
    </div>
    <div className="min-h-[360px]">
      <MapTracker points={points} origin={origin} destination={destination} live={!!freshHero && !demo} navigation navigationTarget={destination} />
    </div>
  </div>;
}, (a, b) => a.professionalId === b.professionalId && a.destination.latitude === b.destination.latitude
  && a.destination.longitude === b.destination.longitude && a.destinationLabel === b.destinationLabel && a.demo === b.demo);
