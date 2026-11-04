import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { coordinatesSchema, type MapPin } from "@tirkha/shared";
import { usePinResolution } from "../hooks/use-pin-resolution";
import LocationMap from "./location-map";

export function LocationPicker({ value, onChange, disabled = false, region = "Kathmandu Valley" }: { value: MapPin | null; onChange: (pin: MapPin | null) => void; disabled?: boolean; region?: string }) {
  const lookup = usePinResolution(value, onChange, disabled);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [inputError, setInputError] = useState("");
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  useEffect(() => { setLatitude(value ? String(value.latitude) : ""); setLongitude(value ? String(value.longitude) : ""); setInputError(""); }, [value?.latitude, value?.longitude]);
  const button = "my-2 min-h-12 justify-center rounded-md border border-border bg-card p-3";
  async function useCurrentLocation() {
    if (disabled || locating) return;
    setLocating(true);
    setLocationError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationError("Location access is off. Allow it in your phone settings, or choose a place on the map / enter coordinates.");
        return;
      }
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationError("Turn on Location/GPS on your phone, then try again. You can still choose a place manually.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      lookup.pick({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (error) {
      setLocationError(error instanceof Error ? `Could not read your location: ${error.message}` : "Could not read your location. Try again or choose a place manually.");
    } finally {
      setLocating(false);
    }
  }
  return <View className="mb-5 gap-2">
    <Text className="text-sm text-muted-foreground">Use your current location to place the service pin automatically, or select a point on the map. You can adjust it before booking.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || locating }} disabled={disabled || locating} onPress={() => void useCurrentLocation()} className={`${button} border-emerald-700 bg-emerald-700`}>
      <Text className="text-center font-semibold text-white">{locating ? "Finding your location…" : "◎  Use my current location"}</Text>
    </Pressable>
    <View className="overflow-hidden rounded-lg border border-border"><LocationMap value={value} onPick={lookup.pick} disabled={disabled} region={region} /></View>
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
    {(locationError || lookup.error || inputError) && <Text accessibilityRole="alert" className="text-sm text-foreground">{locationError || inputError || lookup.error}</Text>}
    <Text className="text-xs text-muted-foreground">Area lookup sends selected coordinates to OpenStreetMap, not your landmark or job details. Results are approximate; check your address.</Text>
    <Text accessibilityRole="link" onPress={() => void Linking.openURL("https://www.openstreetmap.org/copyright")} className="py-2 text-xs text-foreground underline">Area data © OpenStreetMap contributors</Text>
  </View>;
}
