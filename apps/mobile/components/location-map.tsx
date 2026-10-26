import { useEffect, useRef } from "react";
import MapView, { Marker } from "react-native-maps";
import { KATHMANDU_CENTER, tokens, type Coordinates, type MapPin } from "@tirkha/shared";

export default function LocationMap({ value, onPick, disabled }: { value: MapPin | null; onPick: (point: Coordinates) => void; disabled: boolean }) {
  const map = useRef<MapView>(null);
  const center = value || KATHMANDU_CENTER;
  useEffect(() => {
    if (value) map.current?.animateToRegion({ ...value, latitudeDelta: 0.025, longitudeDelta: 0.025 }, 250);
  }, [value?.latitude, value?.longitude]);
  return <MapView ref={map} style={{ width: "100%", height: 300 }} accessibilityLabel="Service location map. Tap to place the pin, or long press the marker to drag."
    initialRegion={{ ...center, latitudeDelta: 0.035, longitudeDelta: 0.035 }}
    onPress={(event) => { if (!disabled && event.nativeEvent.action !== "marker-press") onPick(event.nativeEvent.coordinate); }}>
    {value && <Marker coordinate={value} draggable={!disabled} pinColor={tokens.colors.primary} title="Service location" description="Long press to drag"
      onDragEnd={(event) => { if (!disabled) onPick(event.nativeEvent.coordinate); }} />}
  </MapView>;
}
