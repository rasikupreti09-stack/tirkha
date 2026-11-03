import { useEffect, useRef } from "react";
import MapView, { Marker } from "react-native-maps";
import { KATHMANDU_CENTER, tokens, type Coordinates, type MapPin } from "@tirkha/shared";

const regionCenters: Record<string, Coordinates> = {
  "Kathmandu Valley": KATHMANDU_CENTER, Kathmandu: KATHMANDU_CENTER,
  Lalitpur: { latitude: 27.6644, longitude: 85.3188 }, Bhaktapur: { latitude: 27.671, longitude: 85.4298 },
  Kirtipur: { latitude: 27.678, longitude: 85.277 }, Pokhara: { latitude: 28.2096, longitude: 83.9856 },
  Hetauda: { latitude: 27.428, longitude: 85.032 }, Simara: { latitude: 27.16, longitude: 84.98 },
  Chitwan: { latitude: 27.68, longitude: 84.43 }, Jhapa: { latitude: 26.65, longitude: 87.99 },
  Sunsari: { latitude: 26.67, longitude: 87.28 },
};
export default function LocationMap({ value, onPick, disabled, region = "Kathmandu Valley" }: { value: MapPin | null; onPick: (point: Coordinates) => void; disabled: boolean; region?: string }) {
  const map = useRef<MapView>(null);
  const regionCenter = regionCenters[region] ?? KATHMANDU_CENTER;
  const center = value || regionCenter;
  useEffect(() => {
    map.current?.animateToRegion({ ...(value || regionCenter), latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
  }, [value?.latitude, value?.longitude, region]);
  return <MapView ref={map} style={{ width: "100%", height: 300 }} accessibilityLabel="Service location map. Tap to place the pin, or long press the marker to drag."
    initialRegion={{ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
    onPress={(event) => { if (!disabled && event.nativeEvent.action !== "marker-press") onPick(event.nativeEvent.coordinate); }}>
    {value && <Marker coordinate={value} draggable={!disabled} pinColor={tokens.colors.primary} title="Service location" description="Long press to drag"
      onDragEnd={(event) => { if (!disabled) onPick(event.nativeEvent.coordinate); }} />}
  </MapView>;
}
