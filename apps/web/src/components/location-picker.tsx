"use client";
import dynamic from "next/dynamic";
import { useEffect, useId, useState } from "react";
import { coordinatesSchema, type MapPin } from "@tirkha/shared";
import { usePinResolution } from "../hooks/use-pin-resolution";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const LocationMap = dynamic(() => import("./location-map"), { ssr: false, loading: () => <p role="status" className="min-h-40 p-4">Loading map…</p> });
export function LocationPicker({ value, onChange, disabled = false }: { value: MapPin | null; onChange: (pin: MapPin | null) => void; disabled?: boolean }) {
  const lookup = usePinResolution(value, onChange, disabled);
  const id = useId();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [inputError, setInputError] = useState("");
  useEffect(() => { setLatitude(value ? String(value.latitude) : ""); setLongitude(value ? String(value.longitude) : ""); setInputError(""); }, [value?.latitude, value?.longitude]);
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">Tap the map or drag the pin, then resolve the area. This optional pin is saved with your booking. No device location permission is needed.</p>
    <div className="overflow-hidden rounded-lg border border-border"><LocationMap value={value} onPick={lookup.pick} disabled={disabled} /></div>
    <details><summary className="cursor-pointer text-sm underline">Enter coordinates with the keyboard</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><Label htmlFor={id + "lat"}>Latitude</Label><Input id={id + "lat"} inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} disabled={disabled} /></div>
        <div><Label htmlFor={id + "lon"}>Longitude</Label><Input id={id + "lon"} inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} disabled={disabled} /></div>
      </div>
      <Button type="button" variant="outline" className="mt-3" disabled={disabled} onClick={() => {
        const parsed = coordinatesSchema.safeParse({ latitude: Number(latitude), longitude: Number(longitude) });
        if (!latitude.trim() || !longitude.trim() || !parsed.success) { setInputError("Enter latitude −90 to 90 and longitude −180 to 180."); return; }
        setInputError(""); lookup.pick(parsed.data);
      }}>Place pin at coordinates</Button>
    </details>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!value || lookup.busy || disabled} onClick={() => void lookup.resolve()}>{lookup.busy ? "Resolving area…" : "Resolve area"}</Button>
      {value && <Button type="button" variant="outline" disabled={disabled} onClick={() => lookup.pick(null)}>Remove pin</Button>}</div>
    <p role="status" className="text-sm">{value ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)} · ${value.resolved_address || "Area not resolved; you can enter it manually."}` : "No pin selected. The map starts in Kathmandu."}</p>
    {(lookup.error || inputError) && <p role="alert" className="text-sm">{inputError || lookup.error}</p>}
    <p className="text-xs text-muted-foreground">Area lookup sends the selected coordinates to OpenStreetMap, not your landmark or job details. Results are approximate; check your address. © <a href="https://www.openstreetmap.org/copyright" className="underline">OpenStreetMap contributors</a>.</p>
  </div>;
}
