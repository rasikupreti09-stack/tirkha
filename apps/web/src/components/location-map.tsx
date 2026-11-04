"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { divIcon, type Map as LeafletMap, type Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { KATHMANDU_CENTER, REGIONS, type Coordinates, type MapPin } from "@tirkha/shared";
import { TirkhaMapArtwork, TirkhaMapRegionControl, TirkhaMapSignature, TirkhaMapZoomControl } from "./tirkha-map-artwork";
import { SpatialEngineErrorBoundary } from "./spatial-engine-error-boundary";
import { tirkhaCityViews } from "@/lib/tirkha-map-data";
import { NEPAL_LEAFLET_BOUNDS } from "@/lib/districtBounds";

type Props = { value: MapPin | null; currentLocation?: Coordinates | null; autoLocate?: boolean; onPick: (point: Coordinates) => void; disabled: boolean; height?: number; region?: typeof REGIONS[number]; regionFocusKey?: number; serviceAreaOnly?: boolean; onRegionChange?: (region: typeof REGIONS[number]) => void; onLocated?: (point: Coordinates) => boolean | void; focusPinOnChange?: boolean };
type RegionView = (typeof tirkhaCityViews)[number];
type MapBounds = [[number, number], [number, number]];
const valleyView: RegionView = {
  id: "kathmandu-valley",
  label: "Kathmandu Valley",
  subtitle: "Kathmandu, Lalitpur, Bhaktapur and Kirtipur",
  center: [27.69, 85.35],
  zoom: 11.5,
  maxZoom: 28,
  bounds: { south: 27.625, west: 85.245, north: 27.755, east: 85.465 },
};

function toLeafletBounds(region: RegionView): MapBounds {
  const bounds = region.bounds;
  return [[bounds.south, bounds.west], [bounds.north, bounds.east]];
}

function focusRegion(map: LeafletMap, region: RegionView) {
  map.flyToBounds(toLeafletBounds(region), {
    padding: [32, 32],
    maxZoom: region.maxZoom,
    duration: 0.85,
    easeLinearity: 0.25,
  });
}

/** Hard-clamps the camera and raises min zoom enough to keep its viewport inside Nepal. */
function RegionCameraGuard({ bounds, minimumZoom = 7, maximumZoom = 28 }: { bounds: MapBounds; minimumZoom?: number; maximumZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setMaxBounds(bounds);
    map.options.maxBoundsViscosity = 1;
    map.setMaxZoom(maximumZoom);

    const constrainViewport = () => {
      const viewportMinZoom = map.getBoundsZoom(bounds, false);
      const safeMinZoom = Math.min(maximumZoom, Math.max(minimumZoom, viewportMinZoom));
      map.setMinZoom(safeMinZoom);
      if (map.getZoom() < safeMinZoom) map.setZoom(safeMinZoom, { animate: false });
      map.panInsideBounds(bounds, { animate: false });
    };

    constrainViewport();
    map.on("resize", constrainViewport);
    map.on("zoomend", constrainViewport);
    return () => {
      map.off("resize", constrainViewport);
      map.off("zoomend", constrainViewport);
    };
  }, [bounds, map, maximumZoom, minimumZoom]);
  return null;
}

const Pin = memo(function Pin({ value, onPick, onPinPlaced, disabled, pinningEnabled, focusPinOnChange, icon, allowedBounds }: Pick<Props, "value" | "onPick" | "disabled" | "focusPinOnChange"> & { onPinPlaced: () => void; pinningEnabled: boolean; icon: ReturnType<typeof divIcon>; allowedBounds?: MapBounds }) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const pickRef = useRef(onPick);
  const clickEnabledRef = useRef(pinningEnabled && !disabled);
  pickRef.current = onPick;
  clickEnabledRef.current = pinningEnabled && !disabled;
  const onMapClick = useCallback((event: { latlng: { lat: number; lng: number } }) => {
    const insideAllowedBounds = !allowedBounds || (event.latlng.lat >= allowedBounds[0][0] && event.latlng.lat <= allowedBounds[1][0]
      && event.latlng.lng >= allowedBounds[0][1] && event.latlng.lng <= allowedBounds[1][1]);
    if (clickEnabledRef.current && insideAllowedBounds) {
      clickEnabledRef.current = false;
      onPinPlaced();
      requestAnimationFrame(() => pickRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
    }
  }, [allowedBounds, onPinPlaced]);
  const map = useMapEvents({ click: onMapClick });
  useEffect(() => {
    if (!value || focusPinOnChange === false) return;
    markerRef.current?.setLatLng([value.latitude, value.longitude]);
    if (!map.getBounds().contains([value.latitude, value.longitude]) || map.getZoom() < 16) map.flyTo([value.latitude, value.longitude], Math.max(16, map.getZoom()), { animate: true, duration: 0.45 });
  }, [focusPinOnChange, map, value?.latitude, value?.longitude]);
  return value ? <Marker ref={markerRef} position={[value.latitude, value.longitude]} icon={icon} draggable={!disabled && pinningEnabled} title={pinningEnabled ? "Service location — drag to move" : "Enable pin mode to drag the location"} eventHandlers={{
    dragend(event) {
      if (disabled) return;
      const point = (event.target as LeafletMarker).getLatLng();
      const insideAllowedBounds = !allowedBounds || (point.lat >= allowedBounds[0][0] && point.lat <= allowedBounds[1][0]
        && point.lng >= allowedBounds[0][1] && point.lng <= allowedBounds[1][1]);
      if (!insideAllowedBounds) {
        if (value) markerRef.current?.setLatLng([value.latitude, value.longitude]);
        return;
      }
      clickEnabledRef.current = false;
      onPinPlaced();
      requestAnimationFrame(() => {
        onPick({ latitude: point.lat, longitude: point.lng });
      });
    },
  }} /> : null;
});
export default function LocationMap(props: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [locating, setLocating] = useState(false);
  const [pinningEnabled, setPinningEnabled] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [mapRegionFocusKey, setMapRegionFocusKey] = useState(0);
  const autoLocateStarted = useRef(false);
  const disarmPinning = useCallback(() => setPinningEnabled(false), []);
  const previousRegionFocus = useRef(`${props.region ?? ""}:${props.regionFocusKey ?? 0}:${mapRegionFocusKey}`);
  const pinIcon = useMemo(() => divIcon({
    className: "tirkha-map-pin",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    html: '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><path d="M16 31C13.7 27.7 3 20.1 3 14A13 13 0 1 1 29 14C29 20.1 18.3 27.7 16 31Z" fill="#047857" stroke="#f8fafc" stroke-width="1.5"/><circle class="tirkha-pin-pulse" cx="16" cy="14" r="6" fill="none" stroke="#d1fae5" stroke-width="2"/><circle cx="16" cy="14" r="2.5" fill="#f8fafc" stroke="#1f2937" stroke-width="1"/></svg>',
  }), []);
  const currentLocationIcon = useMemo(() => divIcon({
    className: "tirkha-current-location-marker",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: '<span class="tirkha-current-location-dot" aria-label="Your current location"></span>',
  }), []);
  const availableRegionViews = tirkhaCityViews;
  const regionView = availableRegionViews.find(view => view.label === props.region)
    ?? (props.region === "Kathmandu Valley" ? valleyView : undefined);
  const cameraBounds = useMemo(() => props.serviceAreaOnly && regionView ? toLeafletBounds(regionView) : NEPAL_LEAFLET_BOUNDS, [props.serviceAreaOnly, regionView]);
  const pinBounds = props.serviceAreaOnly && regionView ? toLeafletBounds(regionView) : undefined;
  const cameraMinimumZoom = props.serviceAreaOnly ? 0 : 7;
  const cameraMaximumZoom = props.serviceAreaOnly && regionView ? regionView.maxZoom : 28;
  const center = props.value || (regionView ? { latitude: regionView.center[0], longitude: regionView.center[1] } : KATHMANDU_CENTER);
  const regionFocusSignature = `${props.region ?? ""}:${props.regionFocusKey ?? 0}:${mapRegionFocusKey}`;
  useEffect(() => {
    if (previousRegionFocus.current !== regionFocusSignature && regionView && mapRef.current) {
      focusRegion(mapRef.current, regionView);
    }
    previousRegionFocus.current = regionFocusSignature;
  }, [regionFocusSignature, props.region, regionView]);
  const locateMe = useCallback(() => {
    if (!navigator.geolocation || locating || props.disabled) {
      if (!navigator.geolocation) setLocationError("This browser does not provide location access.");
      return;
    }
    setLocating(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!props.onLocated && props.serviceAreaOnly && pinBounds && (point.latitude < pinBounds[0][0] || point.latitude > pinBounds[1][0]
        || point.longitude < pinBounds[0][1] || point.longitude > pinBounds[1][1])) {
        setLocationError("Your current location is outside the selected Tirkha service region. Choose a region to place the pin there.");
        setLocating(false);
        return;
      }
      props.onPick(point);
      if (props.onLocated?.(point) === false) {
        setLocationError("Your current position is outside the mapped Tirkha service regions. Choose a mapped region or set a location manually.");
        setLocating(false);
        return;
      }
      if (!props.onLocated) requestAnimationFrame(() => mapRef.current?.flyTo([point.latitude, point.longitude], Math.max(16, mapRef.current.getZoom()), { animate: true, duration: 0.75 }));
      setLocating(false);
    }, error => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location permission is off. Allow it in your browser, then choose Use my location. You can still select a point manually."
        : error.code === error.POSITION_UNAVAILABLE
          ? "Your device could not determine a GPS position. Check Location/GPS settings and try again, or choose a point manually."
          : "Location lookup timed out. Try Use my location again, or choose a point manually.";
      setLocationError(message);
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }, [locating, props.disabled, props.onLocated, props.onPick, props.serviceAreaOnly, pinBounds]);
  useEffect(() => {
    if (!props.autoLocate || autoLocateStarted.current) return;
    autoLocateStarted.current = true;
    locateMe();
  }, [locateMe, props.autoLocate]);
  if (typeof window === "undefined") return <div className="h-[300px] w-full animate-pulse rounded-lg bg-slate-100" role="status">Loading map…</div>;
  return <>
    <div className="tirkha-map-frame">
      <SpatialEngineErrorBoundary><MapContainer ref={mapRef} center={[center.latitude, center.longitude]} zoom={props.value && props.focusPinOnChange !== false ? 16 : regionView?.zoom ?? 12} minZoom={7} maxZoom={cameraMaximumZoom} maxBounds={cameraBounds} maxBoundsViscosity={1} worldCopyJump={false} zoomControl={false} zoomSnap={0.25} zoomDelta={0.5} wheelPxPerZoomLevel={30} zoomAnimation touchZoom doubleClickZoom scrollWheelZoom inertia inertiaDeceleration={2800} inertiaMaxSpeed={1800} easeLinearity={0.25} bounceAtZoomLimits={false} attributionControl={false} preferCanvas style={{ height: props.height ?? 300, width: "100%", zIndex: 0 }} className="tirkha-vector-map" aria-label="Choose your service location">
        <RegionCameraGuard bounds={cameraBounds} minimumZoom={cameraMinimumZoom} maximumZoom={cameraMaximumZoom} />
        <TirkhaMapArtwork maxZoom={cameraMaximumZoom} />
        <TirkhaMapRegionControl regions={availableRegionViews} onRegionSelect={region => {
          setMapRegionFocusKey((current) => current + 1);
          props.onRegionChange?.(region as typeof REGIONS[number]);
        }} />
        <TirkhaMapZoomControl onLocate={locateMe} locating={locating} pinningEnabled={pinningEnabled} onTogglePinning={() => setPinningEnabled(value => !value)} />
        <Pin value={props.value} onPick={props.onPick} onPinPlaced={disarmPinning} disabled={props.disabled} focusPinOnChange={props.focusPinOnChange} pinningEnabled={pinningEnabled} icon={pinIcon} allowedBounds={pinBounds} />
        {props.currentLocation && <Marker position={[props.currentLocation.latitude, props.currentLocation.longitude]} icon={currentLocationIcon} interactive={false} keyboard={false} title="Your current location" />}
      </MapContainer></SpatialEngineErrorBoundary>
      <TirkhaMapSignature caption="Kathmandu · Lalitpur · Bhaktapur · Kirtipur · Pokhara · Hetauda · Simara · Chitwan · Jhapa · Sunsari" />
    </div>
    <p className="mt-2 px-1 text-xs text-slate-600">{pinningEnabled ? "Pin mode is on: tap or drag the pin to set your exact location. Turn it off to pan safely." : "Pin mode is off so you can pan the map. Tap the pin control to place or move your location."}</p>
    {locationError && <p role="status" className="px-2 pt-2 text-xs text-amber-800">{locationError}</p>}
  </>;
}
