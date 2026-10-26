import { useEffect, useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { coordinatesSchema, type MapPin } from "@tirkha/shared";
import { usePinResolution } from "../hooks/use-pin-resolution";
import LocationMap from "./location-map";

export function LocationPicker({ value, onChange, disabled = false }: { value: MapPin | null; onChange: (pin: MapPin | null) => void; disabled?: boolean }) {
  const lookup = usePinResolution(value, onChange, disabled);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [inputError, setInputError] = useState("");
  const [showCoordinates, setShowCoordinates] = useState(false);
  useEffect(() => { setLatitude(value ? String(value.latitude) : ""); setLongitude(value ? String(value.longitude) : ""); setInputError(""); }, [value?.latitude, value?.longitude]);
  const button = "my-2 min-h-12 justify-center rounded-md border border-border bg-card p-3";
  return <View className="mb-5 gap-2">
    <Text className="text-sm text-muted-foreground">Tap the map, or long press the pin to drag it. Tap Resolve area to fill your municipality. A pin is optional; no location permission is needed.</Text>
    <View className="overflow-hidden rounded-lg border border-border"><LocationMap value={value} onPick={lookup.pick} disabled={disabled} /></View>
    <Pressable accessibilityRole="button" onPress={() => setShowCoordinates(!showCoordinates)} className={button}><Text className="text-foreground">{showCoordinates ? "Hide coordinate entry" : "Enter coordinates manually"}</Text></Pressable>
    {showCoordinates && <View className="gap-2">
      <Text className="text-foreground">Latitude</Text><TextInput accessibilityLabel="Latitude" editable={!disabled} value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation" className="min-h-12 rounded-md border border-border bg-card px-3 text-foreground" />
      <Text className="text-foreground">Longitude</Text><TextInput accessibilityLabel="Longitude" editable={!disabled} value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation" className="min-h-12 rounded-md border border-border bg-card px-3 text-foreground" />
      <Pressable accessibilityRole="button" disabled={disabled} className={button} onPress={() => {
        const parsed = coordinatesSchema.safeParse({ latitude: Number(latitude), longitude: Number(longitude) });
        if (!latitude.trim() || !longitude.trim() || !parsed.success) { setInputError("Enter latitude −90 to 90 and longitude −180 to 180."); return; }
        setInputError(""); lookup.pick(parsed.data);
      }}><Text className="text-foreground">Place pin at coordinates</Text></Pressable>
    </View>}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !value || lookup.busy || disabled }} disabled={!value || lookup.busy || disabled} onPress={() => void lookup.resolve()} className={button}><Text className="text-foreground">{lookup.busy ? "Resolving area…" : "Resolve area"}</Text></Pressable>
    {value && <Pressable accessibilityRole="button" disabled={disabled} onPress={() => lookup.pick(null)} className={button}><Text className="text-foreground">Remove pin</Text></Pressable>}
    <Text accessibilityLiveRegion="polite" className="text-sm text-foreground">{value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)} · ${value.resolved_address || "Area not resolved; you can enter it manually."}` : "No pin selected. The map starts in Kathmandu."}</Text>
    {(lookup.error || inputError) && <Text accessibilityRole="alert" className="text-sm text-foreground">{inputError || lookup.error}</Text>}
    <Text className="text-xs text-muted-foreground">Area lookup sends selected coordinates to OpenStreetMap, not your landmark or job details. Results are approximate; check your address.</Text>
    <Text accessibilityRole="link" onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")} className="py-2 text-xs text-foreground underline">Area data © OpenStreetMap contributors</Text>
  </View>;
}
