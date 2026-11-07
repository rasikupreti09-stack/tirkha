import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import type { CameraRef, MapProps, ViewAnnotationEvent } from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import { KATHMANDU_CENTER, TIRKHA_MAP_STYLE_URL, tokens, type Coordinates, type MapPin } from "@tirkha/shared";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

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
  const center = value ?? regionCenter;
  const centerCoordinate = useMemo<[number, number]>(
    () => [center.longitude, center.latitude],
    [center.longitude, center.latitude],
  );

  useEffect(() => {
    if (mapReady) camera.current?.flyTo({ center: centerCoordinate, duration: 350, easing: "ease" });
  }, [centerCoordinate, mapReady, region]);

  const handleMapPress = useCallback((event: MapPressEvent) => {
    if (disabled) return;
    const point = toCoordinates(event);
    if (point) onPick(point);
  }, [disabled, onPick]);

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
      setCurrentLocation(point);
      camera.current?.flyTo({ center: [point.longitude, point.latitude], duration: 500, easing: "ease" });
    } catch {
      Alert.alert("Could not get your location", "Check that device location is enabled, or choose your service location manually on the map.");
    } finally {
      setLocating(false);
    }
  }, [locating]);

  return (
    <View accessibilityLabel="Service location map. Tap to place the pin." style={{ width: "100%", height: 300, overflow: "hidden", backgroundColor: "#e8efeb" }}>
      <MapLibreGL.Map
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
          initialViewState={{ center: centerCoordinate, zoom: 13.5 }}
          minZoom={5}
          maxZoom={20}
        />
        {currentLocation && (
          <MapLibreGL.ViewAnnotation
            lngLat={[currentLocation.longitude, currentLocation.latitude]}
            anchor="center"
          >
            <View accessible accessibilityLabel="Your current GPS location" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(37,99,235,0.18)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#2563eb", borderWidth: 3, borderColor: "#ffffff", elevation: 4 }} />
            </View>
          </MapLibreGL.ViewAnnotation>
        )}
        {value && (
          <MapLibreGL.ViewAnnotation
            lngLat={[value.longitude, value.latitude]}
            anchor="bottom"
            draggable={!disabled}
            onDragEnd={(event: { nativeEvent: ViewAnnotationEvent }) => {
              if (disabled) return;
              const point = toCoordinates(event);
              if (point) onPick(point);
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
