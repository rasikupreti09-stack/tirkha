"use client";
import { useEffect, useMemo, useState } from "react";
import { divIcon, type Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import { KATHMANDU_CENTER, type Coordinates, type MapPin } from "@tirkha/shared";
import { TirkhaMapArtwork, TirkhaMapRegionControl, TirkhaMapSignature } from "./tirkha-map-artwork";

type Props = { value: MapPin | null; onPick: (point: Coordinates) => void; disabled: boolean; height?: number };
function Pin({ value, onPick, disabled, icon }: Props & { icon: ReturnType<typeof divIcon> }) {
  const map = useMapEvents({ click(event) { if (!disabled) onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  useEffect(() => {
    if (value && !map.getBounds().contains([value.latitude, value.longitude])) map.panTo([value.latitude, value.longitude]);
  }, [map, value?.latitude, value?.longitude]);
  return value ? <Marker position={[value.latitude, value.longitude]} icon={icon} draggable={!disabled} title="Service location — drag to move" eventHandlers={{
    dragend(event) {
      if (disabled) return;
      const point = (event.target as LeafletMarker).getLatLng();
      onPick({ latitude: point.lat, longitude: point.lng });
    },
  }} /> : null;
}
export default function LocationMap(props: Props) {
  const pinIcon = useMemo(() => divIcon({
    className: "tirkha-map-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 31C13.7 27.7 3 20.1 3 14A13 13 0 1 1 29 14C29 20.1 18.3 27.7 16 31Z" fill="#047857" stroke="#f8fafc" stroke-width="1.5"/><circle class="tirkha-pin-pulse" cx="16" cy="14" r="6" fill="none" stroke="#d1fae5" stroke-width="2"/><circle cx="16" cy="14" r="2.5" fill="#f8fafc" stroke="#1f2937" stroke-width="1"/></svg>',
  }), []);
  const center = props.value || KATHMANDU_CENTER;
  if (typeof window === "undefined") return <div className="h-[300px] w-full animate-pulse rounded-lg bg-slate-100" role="status">Loading map…</div>;
  return <>
    <div className="tirkha-map-frame">
      <MapContainer center={[center.latitude, center.longitude]} zoom={14} minZoom={6} maxZoom={19} scrollWheelZoom={false} attributionControl={false} style={{ height: props.height ?? 300, width: "100%", zIndex: 0 }} className="tirkha-vector-map" aria-label="Choose your service location">
        <TirkhaMapArtwork />
        <TirkhaMapRegionControl />
        <Pin {...props} icon={pinIcon} />
      </MapContainer>
      <TirkhaMapSignature caption="Kathmandu · Lalitpur · Bhaktapur · Pokhara" />
    </div>
  </>;
}
