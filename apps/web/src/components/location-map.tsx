"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { divIcon, type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import { KATHMANDU_CENTER, REGIONS, type Coordinates, type MapPin } from "@tirkha/shared";
import { TirkhaMapArtwork, TirkhaMapRegionControl, TirkhaMapSignature, TirkhaMapZoomControl } from "./tirkha-map-artwork";
import { tirkhaCityViews } from "@/lib/tirkha-map-data";

type Props = { value: MapPin | null; onPick: (point: Coordinates) => void; disabled: boolean; height?: number; region?: typeof REGIONS[number]; onRegionChange?: (region: typeof REGIONS[number]) => void };
const Pin = memo(function Pin({ value, onPick, disabled, pinningEnabled, icon }: Pick<Props, "value" | "onPick" | "disabled"> & { pinningEnabled: boolean; icon: ReturnType<typeof divIcon> }) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const pickRef = useRef(onPick);
  const clickEnabledRef = useRef(pinningEnabled && !disabled);
  pickRef.current = onPick;
  clickEnabledRef.current = pinningEnabled && !disabled;
  const onMapClick = useCallback((event: { latlng: { lat: number; lng: number } }) => {
    if (clickEnabledRef.current) requestAnimationFrame(() => pickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
  }, []);
  const map = useMapEvents({ click: onMapClick });
  useEffect(() => {
    if (!value) return;
    markerRef.current?.setLatLng([value.latitude, value.longitude]);
    if (!map.getBounds().contains([value.latitude, value.longitude]) || map.getZoom() < 16) map.flyTo([value.latitude, value.longitude], Math.max(16, map.getZoom()), { animate: true, duration: 0.45 });
  }, [map, value?.latitude, value?.longitude]);
  return value ? <Marker ref={markerRef} position={[value.latitude, value.longitude]} icon={icon} draggable={!disabled && pinningEnabled} title={pinningEnabled ? "Service location — drag to move" : "Enable pin mode to drag the location"} eventHandlers={{
    dragend(event) {
      if (disabled) return;
      const point = (event.target as LeafletMarker).getLatLng();
      requestAnimationFrame(() => onPick({ latitude: point.lat, longitude: point.lng }));
    },
  }} /> : null;
});
export default function LocationMap(props: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [locating, setLocating] = useState(false);
  const [pinningEnabled, setPinningEnabled] = useState(false);
  const [locationError, setLocationError] = useState("");
  const previousRegion = useRef(props.region);
  const pinIcon = useMemo(() => divIcon({
    className: "tirkha-map-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 31C13.7 27.7 3 20.1 3 14A13 13 0 1 1 29 14C29 20.1 18.3 27.7 16 31Z" fill="#047857" stroke="#f8fafc" stroke-width="1.5"/><circle class="tirkha-pin-pulse" cx="16" cy="14" r="6" fill="none" stroke="#d1fae5" stroke-width="2"/><circle cx="16" cy="14" r="2.5" fill="#f8fafc" stroke="#1f2937" stroke-width="1"/></svg>',
  }), []);
  const regionView = tirkhaCityViews.find(view => view.label === props.region)
    ?? (props.region === "Kathmandu Valley" ? tirkhaCityViews[0] : undefined);
  const center = props.value || (regionView ? { latitude: regionView.center[0], longitude: regionView.center[1] } : KATHMANDU_CENTER);
  useEffect(() => {
    if (previousRegion.current !== props.region && !props.value && regionView) {
      mapRef.current?.flyTo(regionView.center, regionView.zoom, { animate: true, duration: 0.65 });
    }
    previousRegion.current = props.region;
  }, [props.region, props.value, regionView]);
  const locateMe = () => {
    if (!navigator.geolocation || locating || props.disabled) {
      if (!navigator.geolocation) setLocationError("This browser does not provide location access.");
      return;
    }
    setLocating(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      props.onPick(point);
      mapRef.current?.flyTo([point.latitude, point.longitude], Math.max(16, mapRef.current.getZoom()), { animate: true, duration: 0.75 });
      setLocating(false);
    }, () => { setLocationError("Location permission was unavailable. You can still tap the map or enter coordinates."); setLocating(false); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  };
  if (typeof window === "undefined") return <div className="h-[300px] w-full animate-pulse rounded-lg bg-slate-100" role="status">Loading map…</div>;
  return <>
    <div className="tirkha-map-frame">
      <MapContainer ref={mapRef} center={[center.latitude, center.longitude]} zoom={props.value ? 16 : regionView?.zoom ?? 12} minZoom={6} maxZoom={19} zoomControl={false} zoomSnap={0.5} zoomDelta={0.5} wheelPxPerZoomLevel={120} zoomAnimation touchZoom doubleClickZoom scrollWheelZoom attributionControl={false} preferCanvas style={{ height: props.height ?? 300, width: "100%", zIndex: 0 }} className="tirkha-vector-map" aria-label="Choose your service location">
        <TirkhaMapArtwork />
        <TirkhaMapRegionControl onRegionSelect={region => props.onRegionChange?.(region as typeof REGIONS[number])} />
        <TirkhaMapZoomControl onLocate={locateMe} locating={locating} pinningEnabled={pinningEnabled} onTogglePinning={() => setPinningEnabled(value => !value)} />
        <Pin value={props.value} onPick={props.onPick} disabled={props.disabled} pinningEnabled={pinningEnabled} icon={pinIcon} />
      </MapContainer>
      <TirkhaMapSignature caption="Kathmandu Valley · Pokhara · Hetauda · Simara" />
    </div>
    <p className="mt-2 px-1 text-xs text-slate-600">{pinningEnabled ? "Pin mode is on: tap or drag the pin to set your exact location. Turn it off to pan safely." : "Pin mode is off so you can pan the map. Tap the pin control to place or move your location."}</p>
    {locationError && <p role="status" className="px-2 pt-2 text-xs text-amber-800">{locationError}</p>}
  </>;
}
