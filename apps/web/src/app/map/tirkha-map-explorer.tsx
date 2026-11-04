"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { REGIONS, type Coordinates } from "@tirkha/shared";
import { tirkhaCityViews } from "@/lib/tirkha-map-data";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false, loading: () => <div className="tirkha-map-explorer-loading" role="status">Preparing your city map…</div> });
const regions: { name: typeof REGIONS[number]; caption: string }[] = tirkhaCityViews.map(({ label, subtitle }) => ({
  name: label as typeof REGIONS[number],
  caption: subtitle,
}));

export default function TirkhaMapExplorer() {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState<typeof REGIONS[number]>("Kathmandu");
  const [regionFocusKey, setRegionFocusKey] = useState(0);
  function handleLocated(point: Coordinates) {
    const match = tirkhaCityViews.find(({ bounds }) => point.latitude >= bounds.south && point.latitude <= bounds.north
      && point.longitude >= bounds.west && point.longitude <= bounds.east);
    if (!match) {
      setLocationMessage("Your location is outside the currently mapped Tirkha service regions. You can still select a service location manually.");
      setLocationSource(null);
      setCurrentLocation(null);
      setSelected(null);
      return false;
    }
    setLocationMessage("");
    setCurrentLocation(point);
    setLocationSource("gps");
    setSelectedRegion(match.label as typeof REGIONS[number]);
    setRegionFocusKey(key => key + 1);
    return true;
  }
  return <section className="tirkha-map-explorer" aria-label="Explore the Tirkha city map">
    <div className="tirkha-map-explorer-canvas">
      <LocationMap height={580} region={selectedRegion} regionFocusKey={regionFocusKey} serviceAreaOnly autoLocate currentLocation={currentLocation} onLocated={handleLocated} onRegionChange={region => { setSelectedRegion(region as typeof REGIONS[number]); setRegionFocusKey(key => key + 1); setSelected(null); setCurrentLocation(null); setLocationSource(null); }} value={selected && locationSource !== "gps" ? { ...selected, resolved_address: null } : null} onPick={point => { setSelected(point); setCurrentLocation(null); setLocationSource(null); }} disabled={false} focusPinOnChange={false} />
    </div>
    <aside className="tirkha-map-explorer-panel">
      <div><span className="tirkha-map-panel-overline">TEN SERVICE REGIONS. ONE LOCAL MAP.</span><h2>Where should we<br />meet you?</h2><p>Choose a service region, then explore its mapped streets and neighborhoods. The camera stays within the selected region.</p></div>
      <div className="tirkha-map-city-list" aria-label="Map regions">
        {regions.map((region, index) => <button type="button" key={region.name} aria-pressed={selectedRegion === region.name} onClick={() => { setSelectedRegion(region.name); setRegionFocusKey(key => key + 1); setSelected(null); }}>
          <span className="tirkha-map-city-number">0{index + 1}</span><span className="tirkha-map-city-copy"><strong>{region.name}</strong><small>{region.caption}</small></span><span className="tirkha-map-city-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="tirkha-map-location-readout"><span className="tirkha-map-location-pulse"/><span><small>{locationSource === "gps" ? "YOUR CURRENT LOCATION" : "YOUR SELECTED POINT"}</small><strong>{selected ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : "Use location or tap the map"}</strong></span></div>
      {locationMessage && <p role="status" className="tirkha-map-panel-footnote">{locationMessage}</p>}
      <p className="tirkha-map-panel-footnote">Your chosen point is precise to the GPS coordinate. Address details can be added when you book a service.</p>
    </aside>
  </section>;
}
