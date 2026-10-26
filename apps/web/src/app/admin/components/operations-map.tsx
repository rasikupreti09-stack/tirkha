"use client";
import { useMemo, useState } from "react";
import { divIcon } from "leaflet";
import { MapContainer, Marker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import type { BookingStatus } from "@tirkha/shared";
import { TirkhaMapArtwork, TirkhaMapSignature } from "@/components/tirkha-map-artwork";

type HeroLocation = {
  professional_id: string; latitude: number; longitude: number; heading: number | null;
  speed_mps: number | null; battery_level: number | null; active_booking_id: string | null;
  status: "online_idle" | "en_route" | "on_service"; updated_at: string;
};
type Hero = { id: string; name: string };
export type OperationsJob = { id: string; professional_id: string | null; customer_name: string; service_name: string; status: BookingStatus; address: string };
const VALLEY_CENTER: [number, number] = [27.7172, 85.324];

function motorcycleIcon(heading: number | null, stale = false) {
  return divIcon({
    className: "tirkha-fleet-marker",
    html: `<span style="display:grid;place-items:center;width:32px;height:32px;border:2px solid #fff;border-radius:50%;background:${stale ? "#64748b" : "#047857"};box-shadow:0 2px 8px #0f172a44"><svg viewBox="0 0 24 24" width="18" height="18" style="transform:rotate(${heading ?? 0}deg);fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m9 17 3-7h4l2 7m-9-7H7l-1 4h6m0-4-2-3h3"/></svg></span>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}
function SelectedHeroFocus({ location }: { location: HeroLocation | null }) {
  const map = useMap();
  useEffect(() => { if (location) map.panTo([location.latitude, location.longitude], { animate: true, duration: 0.7 }); }, [location, map]);
  return null;
}
function relativePing(value: string | null) {
  if (!value) return "No location ping";
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`;
}

export function OperationsMap({ heroes, locations, jobs }: { heroes: Hero[]; locations: HeroLocation[]; jobs: OperationsJob[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locationById = useMemo(() => new Map(locations.map(row => [row.professional_id, row])), [locations]);
  const jobByHero = useMemo(() => new Map(jobs.filter(job => job.professional_id).map(job => [job.professional_id!, job])), [jobs]);
  const selectedLocation = selectedId ? locationById.get(selectedId) ?? null : null;
  const selectedJob = selectedId ? jobByHero.get(selectedId) : null;
  const liveLocations = locations.filter(location => Date.now() - Date.parse(location.updated_at) <= 90_000);
  if (typeof window === "undefined") return <div className="grid min-h-[480px] place-items-center rounded-xl border bg-muted text-sm text-muted-foreground" role="status">Loading Valley fleet map…</div>;
  return <div className="grid min-h-[480px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1fr)_320px]">
    <div className="tirkha-map-frame relative min-h-[420px]">
      <MapContainer center={VALLEY_CENTER} zoom={12} minZoom={6} maxZoom={19} scrollWheelZoom attributionControl={false} className="tirkha-vector-map !h-full !min-h-[420px] !w-full" aria-label="Live Kathmandu Valley Hero fleet map">
        <TirkhaMapArtwork />
        <SelectedHeroFocus location={selectedLocation} />
        {liveLocations.map(location => <Marker key={location.professional_id} position={[location.latitude, location.longitude]} icon={motorcycleIcon(location.heading)} eventHandlers={{ click: () => setSelectedId(location.professional_id) }}>
          <Tooltip>{heroes.find(hero => hero.id === location.professional_id)?.name || "Hero"}</Tooltip>
        </Marker>)}
      </MapContainer>
      <TirkhaMapSignature caption="Kathmandu Valley fleet" />
    </div>
    <aside className="flex max-h-[560px] flex-col border-t lg:border-l lg:border-t-0">
      <div className="border-b p-4"><h3 className="font-semibold">Valley Hero fleet</h3><p className="mt-1 text-xs text-muted-foreground">Live GPS · offline after 90 seconds without a ping</p></div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {heroes.map(hero => {
          const location = locationById.get(hero.id);
          const online = !!location && Date.now() - Date.parse(location.updated_at) <= 90_000;
          const label = !online ? "Offline" : location.status === "en_route" ? "En Route" : location.status === "on_service" ? "On Service" : "Online (Idle)";
          return <li key={hero.id}>
            <button type="button" onClick={() => setSelectedId(hero.id)} className={`w-full p-3 text-left hover:bg-muted ${selectedId === hero.id ? "bg-muted" : ""}`}>
              <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{hero.name}</span><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${online ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"}`}>{label}</span></span>
              {location && <span className="mt-1 block text-xs text-muted-foreground">Last ping {relativePing(location.updated_at)}</span>}
            </button>
          </li>;
        })}
        {heroes.length === 0 && <li className="p-5 text-sm text-muted-foreground">No verified Heroes are registered yet.</li>}
      </ul>
      {selectedId && <div className="border-t bg-slate-50 p-4 text-sm">
        <div className="mb-2 flex items-center justify-between gap-2"><strong>{heroes.find(hero => hero.id === selectedId)?.name || "Hero details"}</strong><button type="button" className="text-xs underline" onClick={() => setSelectedId(null)}>Close</button></div>
        {selectedLocation ? <div className="space-y-1 text-xs text-slate-700">
          <p>Battery: {selectedLocation.battery_level == null ? "Unavailable" : `${selectedLocation.battery_level}%`}</p>
          <p>Speed: {selectedLocation.speed_mps == null ? "Unavailable" : `${(selectedLocation.speed_mps * 3.6).toFixed(1)} km/h`}</p>
          <p>Last ping: {new Date(selectedLocation.updated_at).toLocaleString()}</p>
        </div> : <p className="text-xs text-muted-foreground">No location has been received from this Hero.</p>}
        {selectedJob ? <div className="mt-3 rounded-md border bg-white p-3 text-xs"><p className="font-semibold">Active job · {selectedJob.status.replaceAll("_", " ")}</p><p className="mt-1">{selectedJob.service_name} for {selectedJob.customer_name}</p><p className="mt-1 text-muted-foreground">{selectedJob.address}</p></div> : <p className="mt-3 text-xs text-muted-foreground">No active job assigned.</p>}
      </div>}
    </aside>
  </div>;
}
