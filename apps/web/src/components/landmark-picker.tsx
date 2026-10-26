"use client";
import { useEffect, useState, type FormEvent } from "react";
import { LOCATION_STORAGE_KEY, NEPAL_AREA_SUGGESTIONS, locationPreferenceSchema } from "@tirkha/shared";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function LandmarkPicker() {
  const [value, setValue] = useState({ municipality: "", ward: "", landmark: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = locationPreferenceSchema.safeParse(JSON.parse(raw));
      if (parsed.success) setValue({ municipality: parsed.data.municipality, landmark: parsed.data.landmark, ward: parsed.data.ward ?? "" });
    } catch { /* Browsing still works when storage is unavailable. */ }
  }, []);
  function update(field: keyof typeof value, text: string) {
    setValue((current) => ({ ...current, [field]: text })); setMessage(""); setError("");
  }
  function save(event: FormEvent) {
    event.preventDefault(); setMessage(""); setError("");
    const parsed = locationPreferenceSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    try { localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(parsed.data)); setMessage("Location saved on this device for your next booking."); }
    catch { setError("This browser could not save your location. You can still browse services."); }
  }
  const landmarks = NEPAL_AREA_SUGGESTIONS.find((area) => area.municipality.toLowerCase() === value.municipality.toLowerCase())?.landmarks ?? [];
  return <section aria-labelledby="location-title" className="my-8 rounded-lg border bg-card p-5 sm:p-6">
    <h2 id="location-title" className="text-lg font-semibold">Where do you need help?</h2>
    <p className="mt-1 text-sm text-muted-foreground">Save your municipality and a nearby landmark. Listings are not filtered by location yet.</p>
    <form onSubmit={save} noValidate className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_100px_1fr_auto]">
      <div className="space-y-2"><Label htmlFor="municipality">Municipality or area</Label><Input id="municipality" list="municipalities" autoComplete="address-level2" placeholder="e.g. Lalitpur" value={value.municipality} onChange={(event) => update("municipality", event.target.value)} maxLength={100} aria-describedby={error ? "location-error" : undefined} />
        <datalist id="municipalities">{NEPAL_AREA_SUGGESTIONS.map((area) => <option key={area.municipality} value={area.municipality} />)}</datalist></div>
      <div className="space-y-2"><Label htmlFor="ward">Ward (optional)</Label><Input id="ward" inputMode="numeric" placeholder="e.g. 4" value={value.ward} onChange={(event) => update("ward", event.target.value)} maxLength={2} /></div>
      <div className="space-y-2"><Label htmlFor="landmark">Nearby landmark</Label><Input id="landmark" list="landmarks" placeholder="e.g. near Patan Dhoka" value={value.landmark} onChange={(event) => update("landmark", event.target.value)} maxLength={160} />
        <datalist id="landmarks">{landmarks.map((landmark) => <option key={landmark} value={landmark} />)}</datalist></div>
      <Button type="submit" className="h-11 self-end">Save location</Button>
    </form>
    {error && <p id="location-error" role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    <Button variant="outline" size="sm" className="mt-4" onClick={() => {
      try { localStorage.removeItem(LOCATION_STORAGE_KEY); setValue({ municipality: "", ward: "", landmark: "" }); setError(""); setMessage("Saved location cleared."); }
      catch { setError("Could not clear saved location. Check your browser settings."); }
    }}>Clear saved location</Button>
  </section>;
}
