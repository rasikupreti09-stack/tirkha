import { useEffect, useRef, useState } from "react";
import MapView, { Marker } from "react-native-maps";
import { KATHMANDU_CENTER, tokens, type Coordinates, type MapPin } from "@tirkha/shared";
import { Text, View } from "react-native";

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
  const [mapReady, setMapReady] = useState(false);
  const [mapSlow, setMapSlow] = useState(false);
  const regionCenter = regionCenters[region] ?? KATHMANDU_CENTER;
  const center = value || regionCenter;
  useEffect(() => {
    map.current?.animateToRegion({ ...(value || regionCenter), latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
  }, [value?.latitude, value?.longitude, region]);
  useEffect(() => {
    if (mapReady) return;
    const timeout = setTimeout(() => setMapSlow(true), 8000);
    return () => clearTimeout(timeout);
  }, [mapReady]);
  return <View style={{ width: "100%", height: 300, backgroundColor: "#e8efeb" }}>
  <MapView ref={map} style={{ width: "100%", height: 300, backgroundColor: "#e8efeb" }} loadingEnabled loadingIndicatorColor="#047857" loadingBackgroundColor="#e8efeb" accessibilityLabel="Service location map. Tap to place the pin, or long press the marker to drag."
    initialRegion={{ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
    onMapReady={() => setMapReady(true)}
    onPress={(event) => { if (!disabled && event.nativeEvent.action !== "marker-press") onPick(event.nativeEvent.coordinate); }}>
    {value && <Marker coordinate={value} draggable={!disabled} pinColor={tokens.colors.primary} title="Service location" description="Long press to drag"
      onDragEnd={(event) => { if (!disabled) onPick(event.nativeEvent.coordinate); }} />}
  </MapView>
  {mapSlow && !mapReady && <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.95)", padding: 10 }}><Text style={{ color: "#1f2937", fontSize: 12 }}>Map is taking longer to load. Your location button and manual coordinates still work. For Android builds, confirm the Google Maps key is configured.</Text></View>}
  </View>;
}
