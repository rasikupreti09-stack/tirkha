import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as MapLibreGL from "@maplibre/maplibre-react-native";
import type { CameraRef, MapProps, ViewAnnotationEvent } from "@maplibre/maplibre-react-native";
import { KATHMANDU_CENTER, TIRKHA_MAP_STYLE_URL, tokens, type Coordinates, type MapPin } from "@tirkha/shared";
import { Text, View } from "react-native";

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
      {disabled && <View pointerEvents="auto" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(248,250,252,0.18)" }} />}
    </View>
  );
}
