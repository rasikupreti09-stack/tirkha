"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Tooltip, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import { Clock3, Crosshair, Navigation } from "lucide-react";
import type { Coordinates } from "@tirkha/shared";
import { useAuth } from "./auth-provider";
import { TirkhaMapArtwork, TirkhaMapSignature, TirkhaMapZoomControl } from "./tirkha-map-artwork";

export type TrackedPoint = { id: string; label: string; kind: "hero" | "customer"; coordinates: Coordinates; updatedAt?: string; heading?: number | null };
function pointIcon(kind: TrackedPoint["kind"], heading = 0) {
  const marker = kind === "hero"
    ? `<span style="display:grid;place-items:center;width:32px;height:32px;border:2px solid #f8fafc;border-radius:50%;background:#047857;box-shadow:0 2px 8px #0f172a44"><svg viewBox="0 0 24 24" width="18" height="18" style="transform:rotate(${heading}deg);transition:transform .35s ease;fill:none;stroke:white;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><circle cx="7" cy="18" r="2.4"/><circle cx="17" cy="18" r="2.4"/><path d="m9.4 18 2.9-6-3-3 2-3m-2 3H7m2.3 3h5.2l2.5 6m-5.3-9h3.5"/></svg></span>`
    : '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 31C13.7 27.7 3 20.1 3 14A13 13 0 1 1 29 14C29 20.1 18.3 27.7 16 31Z" fill="#047857" stroke="#f8fafc" stroke-width="1.5"/><circle class="tirkha-pin-pulse" cx="16" cy="14" r="6" fill="none" stroke="#d1fae5" stroke-width="2"/><circle cx="16" cy="14" r="2.5" fill="#f8fafc" stroke="#1f2937" stroke-width="1"/></svg>';
  return divIcon({
    className: kind === "hero" ? "tirkha-smooth-marker" : "tirkha-map-pin tirkha-smooth-marker",
    html: marker,
    iconSize: [32, 32],
    iconAnchor: kind === "hero" ? [16, 16] : [16, 32],
  });
}
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []; let index = 0; let lat = 0; let lng = 0;
  while (index < encoded.length) {
    let result = 0; let shift = 0; let byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20 && index < encoded.length);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
function FitPoints({ points }: { points: TrackedPoint[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length < 2) return;
    map.fitBounds(points.map(p => [p.coordinates.latitude, p.coordinates.longitude]), { padding: [52, 52], maxZoom: 16, animate: true, duration: 0.7 });
    fitted.current = true;
  }, [map, points]);
  return null;
}
function MapActions({ points }: { points: TrackedPoint[] }) {
  const map = useMap();
  return <div className="leaflet-top leaflet-right tirkha-map-actions">
    <div className="leaflet-control"><button type="button" aria-label="Recenter map on your trip" title="Recenter map" onClick={() => {
      if (points.length > 1) map.fitBounds(points.map(point => [point.coordinates.latitude, point.coordinates.longitude]), { padding: [52, 52], maxZoom: 16, animate: true, duration: 0.7 });
      else if (points[0]) map.setView([points[0].coordinates.latitude, points[0].coordinates.longitude], 16, { animate: true });
    }}><Crosshair size={18} aria-hidden="true" /></button></div>
  </div>;
}
function haversineKm(a: Coordinates, b: Coordinates) {
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude), lng = radians(b.longitude - a.longitude);
  const arc = Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}
export function MapTracker({ points, origin, destination, navigation = false, navigationTarget, live = false }: {
  points: TrackedPoint[]; origin?: Coordinates; destination?: Coordinates; navigation?: boolean; navigationTarget?: Coordinates; live?: boolean;
}) {
  const { session } = useAuth();
  const [path, setPath] = useState<[number, number][]>([]);
  const [eta, setEta] = useState<number | null>(null);
  const [roadDistanceKm, setRoadDistanceKm] = useState<number | null>(null);
  const [routeMessage, setRouteMessage] = useState("Approximate city estimate · traffic-aware routing when available");
  const lastRouteRequest = useRef<{ origin: Coordinates; requestedAt: number } | null>(null);
  useEffect(() => {
    if (!origin || !destination || !session?.access_token) return;
    const previous = lastRouteRequest.current;
    const now = Date.now();
    if (previous && now - previous.requestedAt < 60_000 && haversineKm(previous.origin, origin) < 0.25) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      lastRouteRequest.current = { origin, requestedAt: Date.now() };
      void fetch("/api/directions/route", {
        method: "POST", signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ origin, destination }),
      })
        .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Route unavailable"); return result as { encodedPolyline: string; durationSeconds: number; distanceMeters?: number }; })
        .then(result => {
          if (!active) return;
          setPath(decodePolyline(result.encodedPolyline));
          setEta(Math.max(1, Math.round(result.durationSeconds / 60)));
          if (result.distanceMeters != null) setRoadDistanceKm(result.distanceMeters / 1000);
          setRouteMessage("Traffic-aware road route");
        })
        .catch(() => { if (active) setRouteMessage("GPS-based estimate · road routing is temporarily unavailable"); });
    }, 350);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, session?.access_token]);
  const directDistanceKm = origin && destination ? haversineKm(origin, destination) : null;
  const displayDistanceKm = roadDistanceKm ?? (directDistanceKm == null ? null : directDistanceKm * 1.3);
  const displayEta = eta ?? (displayDistanceKm == null ? null : Math.max(1, Math.ceil(displayDistanceKm / 15 * 60)));
  const heroPoint = points.find(point => point.kind === "hero");
  const view = useMemo(() => destination ? [destination.latitude, destination.longitude] as [number, number] : origin ? [origin.latitude, origin.longitude] as [number, number] : [27.7172, 85.324] as [number, number], [destination, origin]);
  const target = navigationTarget ?? destination;
  const navUrl = target ? typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? `https://maps.apple.com/?daddr=${target.latitude},${target.longitude}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}&travelmode=driving` : "";
  if (typeof window === "undefined") return <div className="h-[360px] animate-pulse rounded-xl bg-muted" role="status">Loading live map…</div>;
  return <section className="tirkha-map-surface">
    <div className="tirkha-map-frame tirkha-live-map-canvas">
      <MapContainer center={view} zoom={16} minZoom={6} maxZoom={19} zoomControl={false} zoomSnap={0.5} zoomDelta={0.75} wheelPxPerZoomLevel={100} touchZoom doubleClickZoom scrollWheelZoom attributionControl={false} className="tirkha-vector-map !h-full !w-full" aria-label="Live service map">
      <TirkhaMapArtwork />
      <TirkhaMapZoomControl />
      <FitPoints points={points} />
      <MapActions points={points} />
      {points.map(point => point.kind === "hero"
        ? <Marker key={point.id} position={[point.coordinates.latitude, point.coordinates.longitude]} icon={pointIcon("hero", point.heading ?? 0)}><Tooltip>{point.label}{point.updatedAt ? ` · ${new Date(point.updatedAt).toLocaleTimeString()}` : ""}</Tooltip></Marker>
        : <Marker key={point.id} position={[point.coordinates.latitude, point.coordinates.longitude]} icon={pointIcon("customer")}><Tooltip>{point.label}{point.updatedAt ? ` · ${new Date(point.updatedAt).toLocaleTimeString()}` : ""}</Tooltip></Marker>)}
      {path.length > 0 && <><Polyline positions={path} pathOptions={{ color: "#ffffff", weight: 10, opacity: 0.9, lineCap: "round", lineJoin: "round" }} /><Polyline positions={path} pathOptions={{ color: "#047857", weight: 5, opacity: 0.96, lineCap: "round", lineJoin: "round" }} /></>}
      </MapContainer>
      <div className="tirkha-map-live-chip"><span className={`tirkha-live-indicator ${live ? "is-live" : ""}`} /><span><strong>{live ? "HERO IS LIVE" : heroPoint ? "LAST GPS LOCATION" : "WAITING FOR HERO"}</strong><small>{heroPoint?.updatedAt ? `Updated ${new Date(heroPoint.updatedAt).toLocaleTimeString()}` : "Live updates appear here"}</small></span></div>
      <TirkhaMapSignature caption="Live across our service cities" />
    </div>
    <div className="tirkha-route-summary">
      <div className="tirkha-route-arrival"><span className="tirkha-route-icon"><Clock3 size={19} aria-hidden="true" /></span><span><small>ESTIMATED ARRIVAL</small><strong>{displayEta == null ? "Calculating…" : `${displayEta} min`}</strong></span></div>
      <div className="tirkha-route-distance"><strong>{displayDistanceKm == null ? "—" : `${displayDistanceKm.toFixed(1)} km`}</strong><small>{routeMessage}</small></div>
      {navigation && (navUrl ? <a className="tirkha-navigation-button" href={navUrl} target="_blank" rel="noreferrer"><Navigation size={17} aria-hidden="true" />Directions</a> : <span className="tirkha-navigation-button is-disabled"><Navigation size={17} aria-hidden="true" />Waiting for location</span>)}
    </div>
  </section>;
}
