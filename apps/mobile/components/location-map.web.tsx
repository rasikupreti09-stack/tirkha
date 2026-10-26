import { Text } from "react-native";
import type { Coordinates, MapPin } from "@tirkha/shared";

// Native maps are not supported by Expo's web renderer. Next.js owns the web map.
export default function LocationMap(_props: { value: MapPin | null; onPick: (point: Coordinates) => void; disabled: boolean }) {
  return <Text className="p-4 text-foreground">Use the Tirkha web app for an interactive map, or enter coordinates below.</Text>;
}
