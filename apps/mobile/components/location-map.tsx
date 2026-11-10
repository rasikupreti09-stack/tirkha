import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import type { CameraRef, MapProps, ViewAnnotationEvent } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { KATHMANDU_CENTER, TIRKHA_MAP_STYLE_URL, tokens, type Coordinates, type MapPin } from "@tirkha/shared";
import * as regionBoundsModule from "../lib/service-region-bounds";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

type RegionBounds = { north: number; south: number; east: number; west: number };

function normalizeRegionBounds(value: unknown): RegionBounds | null {
  if (Array.isArray(value) && value.length >= 4) {
    const [south, west, north, east] = value.map(Number);
    return [south, west, north, east].every(Number.isFinite) ? { north, south, east, west } : null;
  }
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const ne = (item.neBound ?? item.northEast ?? item.ne) as Record<string, unknown> | number[] | undefined;
  const sw = (item.swBound ?? item.southWest ?? item.sw) as Record<string, unknown> | number[] | undefined;
  const number = (v: unknown) => Number(v);
  const north = number(item.north ?? item.maxLat ?? (Array.isArray(ne) ? ne[1] : ne?.latitude ?? ne?.lat));
  const east = number(item.east ?? item.maxLng ?? (Array.isArray(ne) ? ne[0] : ne?.longitude ?? ne?.lng));
  const south = number(item.south ?? item.minLat ?? (Array.isArray(sw) ? sw[1] : sw?.latitude ?? sw?.lat));
  const west = number(item.west ?? item.minLng ?? (Array.isArray(sw) ? sw[0] : sw?.longitude ?? sw?.lng));
  return [north, south, east, west].every(Number.isFinite) ? { north, south, east, west } : null;
}

function getRegionBounds(region: string): RegionBounds | null {
  const api = regionBoundsModule as unknown as Record<string, unknown>;
  for (const name of ["getServiceRegionBounds", "getRegionBounds", "getBoundsForRegion"]) {
    const getter = api[name];
    if (typeof getter === "function") {
      try {
        const bounds = normalizeRegionBounds((getter as (key: string) => unknown)(region));
        if (bounds) return bounds;
      } catch { /* Use the exported bounds map below. */ }
    }
  }
  const map = (api.SERVICE_REGION_BOUNDS ?? api.serviceRegionBounds ?? api.REGION_BOUNDS ?? api.regionBounds) as Record<string, unknown> | undefined;
  return normalizeRegionBounds(map?.[region] ?? map?.[region.toLowerCase().replaceAll(" ", "-")]);
}

function isWithinRegion(point: Coordinates, region: string, bounds: RegionBounds | null): boolean {
  const api = regionBoundsModule as unknown as Record<string, unknown>;
  if (typeof api.isWithinRegionBounds === "function") {
    try {
      return Boolean((api.isWithinRegionBounds as (key: string, latitude: number, longitude: number) => boolean)(region, point.latitude, point.longitude));
    } catch { return false; }
  }
  return Boolean(bounds && point.latitude >= bounds.south && point.latitude <= bounds.north && point.longitude >= bounds.west && point.longitude <= bounds.east);
}

function regionContainsCoordinates(
  point: Coordinates | null | undefined,
  region: string,
  bounds: RegionBounds | null,
): point is Coordinates {
  return Boolean(point && isWithinRegion(point, region, bounds));
}

const regionCenters: Record<string, Coordinates> = {
  "Kathmandu Valley": KATHMANDU_CENTER,
  Kathmandu: KATHMANDU_CENTER,
  Lalitpur: { latitude: 27.6644, longitude: 85.3188 },
  Bhaktapur: { latitude: 27.671, longitude: 85.4298 },
  Kirtipur: { latitude: 27.678, longitude: 85.277 },
  Pokhara: { latitude: 28.2096, longitude: 83.9856 },
  Hetauda: { latitude: 27.428, longitude: 85.032 },
  Simara: { latitude: 27.16, longitude: 84.98 },
  Chitwan: { latitude: 27.68, longitude: 84.43 },
  Jhapa: { latitude: 26.65, longitude: 87.99 },
  Sunsari: { latitude: 26.67, longitude: 87.28 },
};

type MapPressEvent = Parameters<NonNullable<MapProps["onPress"]>>[0];
type MapCoordinateEvent = { nativeEvent: { lngLat: readonly [number, number] } };

function toCoordinates(event: MapCoordinateEvent): Coordinates | null {
  const point = event.nativeEvent.lngLat;
  if (!point || point.length < 2) return null;
  const [longitude, latitude] = point;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export default function LocationMap({
  value,
  onPick,
  disabled,
  region = "Kathmandu Valley",
}: {
  value: MapPin | null;
  onPick: (point: Coordinates) => void;
  disabled: boolean;
  region?: string;
}) {
  const camera = useRef<CameraRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const regionCenter = regionCenters[region] ?? KATHMANDU_CENTER;
  const regionBounds = getRegionBounds(region);
  const selectedLocation = regionContainsCoordinates(value, region, regionBounds) ? value : null;
  const visibleCurrentLocation = regionContainsCoordinates(currentLocation, region, regionBounds) ? currentLocation : null;
  const center = selectedLocation ?? regionCenter;
  const centerCoordinate = useMemo<[number, number]>(
    () => [center.longitude, center.latitude],
    [center.longitude, center.latitude],
  );
  const cameraBoundsProps = useMemo(() => {
    if (!regionBounds) return {};
    const bounds = {
      neBound: [regionBounds.east, regionBounds.north] as [number, number],
      swBound: [regionBounds.west, regionBounds.south] as [number, number],
    };
    return { bounds, maxBounds: bounds } as unknown as ComponentProps<typeof MapLibreGL.Camera>;
  }, [regionBounds]);

  useEffect(() => {
    if (!regionContainsCoordinates(currentLocation, region, regionBounds)) setCurrentLocation(null);
    if (!mapReady) return;
    const boundedCamera = camera.current as (CameraRef & {
      fitBounds?: (ne: [number, number], sw: [number, number], padding?: number, duration?: number) => void;
    }) | null;
    if (regionBounds && boundedCamera?.fitBounds) {
      boundedCamera.fitBounds(
        [regionBounds.east, regionBounds.north],
        [regionBounds.west, regionBounds.south],
        28,
        350,
      );
      return;
    }
    camera.current?.flyTo({ center: centerCoordinate, duration: 350, easing: "ease" });
  }, [centerCoordinate, currentLocation, mapReady, region, regionBounds]);

  const pickWithinRegion = useCallback((point: Coordinates | null) => {
    if (disabled) return;
    if (!point || !regionContainsCoordinates(point, region, regionBounds)) {
      Alert.alert("Outside selected service area", `Choose a location inside ${region}.`);
      return;
    }
    onPick(point);
  }, [disabled, onPick, region, regionBounds]);

  const handleMapPress = useCallback((event: MapPressEvent) => {
    if (disabled) return;
    const point = toCoordinates(event);
    if (point) pickWithinRegion(point);
  }, [disabled, pickWithinRegion]);

  const centerOnMyLocation = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location permission needed", "Allow location access to center the map on your current position.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        throw new Error("The device returned an invalid location.");
      }
      if (!regionContainsCoordinates(point, region, regionBounds)) {
        setCurrentLocation(null);
        Alert.alert("Outside selected service area", `Your current location is outside ${region}. Choose a location inside the selected service area.`);
        return;
      }
      setCurrentLocation(point);
      camera.current?.flyTo({ center: [point.longitude, point.latitude], duration: 500, easing: "ease" });
    } catch {
      Alert.alert("Could not get your location", "Check that device location is enabled, or choose your service location manually on the map.");
    } finally {
      setLocating(false);
    }
  }, [locating, region, regionBounds]);

  return (
    <View accessibilityLabel="Service location map. Tap to place the pin." style={{ width: "100%", height: 300, overflow: "hidden", backgroundColor: "#e8efeb" }}>
      <MapLibreGL.Map
        {...(regionBounds ? ({ maxBounds: cameraBoundsProps.maxBounds } as unknown as Partial<MapProps>) : {})}
        mapStyle={TIRKHA_MAP_STYLE_URL}
        style={{ width: "100%", height: 300 }}
        androidView="texture"
        attribution
        logo={false}
        compass={false}
        scaleBar
        dragPan={!disabled}
        touchZoom={!disabled}
        doubleTapZoom={!disabled}
        doubleTapHoldZoom={!disabled}
        touchRotate={false}
        touchPitch={false}
        onDidFinishLoadingMap={() => { setMapReady(true); setMapError(false); }}
        onDidFailLoadingMap={() => setMapError(true)}
        onPress={handleMapPress}
        onLongPress={handleMapPress}
      >
        <MapLibreGL.Camera
          ref={camera}
          {...cameraBoundsProps}
          initialViewState={{ center: centerCoordinate, zoom: 13.5 }}
          minZoom={5}
          maxZoom={20}
        />
        {visibleCurrentLocation && (
          <MapLibreGL.ViewAnnotation
            lngLat={[visibleCurrentLocation.longitude, visibleCurrentLocation.latitude]}
            anchor="center"
          >
            <View accessible accessibilityLabel="Your current GPS location" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(37,99,235,0.18)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#2563eb", borderWidth: 3, borderColor: "#ffffff", elevation: 4 }} />
            </View>
          </MapLibreGL.ViewAnnotation>
        )}
        {selectedLocation && (
          <MapLibreGL.ViewAnnotation
            lngLat={[selectedLocation.longitude, selectedLocation.latitude]}
            anchor="bottom"
            draggable={!disabled}
            onDragEnd={(event: { nativeEvent: ViewAnnotationEvent }) => {
              if (disabled) return;
              const point = toCoordinates(event);
              if (point) pickWithinRegion(point);
            }}
          >
            <View accessible accessibilityLabel="Selected service location" style={{ alignItems: "center", justifyContent: "center", width: 34, height: 42 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.colors.primary, borderWidth: 3, borderColor: "#ffffff", alignItems: "center", justifyContent: "center", elevation: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" }} />
              </View>
              <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: tokens.colors.primary, marginTop: -2 }} />
            </View>
          </MapLibreGL.ViewAnnotation>
        )}
      </MapLibreGL.Map>

      {!mapReady && !mapError && (
        <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.95)", padding: 10 }}>
          <Text style={{ color: "#1f2937", fontSize: 12 }}>Loading Tirkha map…</Text>
        </View>
      )}
      {mapError && (
        <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.96)", padding: 10 }}>
          <Text style={{ color: "#1f2937", fontSize: 12 }}>Map tiles are temporarily unavailable. You can still use your location or enter the address manually.</Text>
        </View>
      )}
      <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.96)", paddingHorizontal: 10, paddingVertical: 7, elevation: 2 }}>
        <Text style={{ color: "#1f2937", fontSize: 11 }}>🔵 You  ·  🟢 Service location</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Center on my location"
        disabled={locating || disabled}
        onPress={centerOnMyLocation}
        style={({ pressed }) => ({ position: "absolute", top: 10, right: 10, minHeight: 42, borderRadius: 22, backgroundColor: "#ffffff", paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, elevation: 4, opacity: disabled ? 0.55 : pressed ? 0.82 : 1 })}
      >
        {locating ? <ActivityIndicator size="small" color={tokens.colors.primary} /> : <Text style={{ color: tokens.colors.primary, fontSize: 17, fontWeight: "700" }}>◎</Text>}
        <Text style={{ color: "#1f2937", fontSize: 12, fontWeight: "600" }}>My location</Text>
      </Pressable>
      {disabled && <View pointerEvents="auto" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(248,250,252,0.18)" }} />}
    </View>
  );
}
