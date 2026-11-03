"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { REGIONS, type Coordinates } from "@tirkha/shared";
import { tirkhaCoreCityViews } from "@/lib/tirkha-map-data";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false, loading: () => <div className="tirkha-map-explorer-loading" role="status">Preparing your city map…</div> });
const regions: { name: typeof REGIONS[number]; caption: string }[] = tirkhaCoreCityViews.map(({ label, subtitle }) => ({
  name: label as typeof REGIONS[number],
  caption: subtitle,
}));

export default function TirkhaMapExplorer() {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<typeof REGIONS[number]>("Kathmandu");
  const [regionFocusKey, setRegionFocusKey] = useState(0);
  return <section className="tirkha-map-explorer" aria-label="Explore the Tirkha city map">
    <div className="tirkha-map-explorer-canvas">
      <LocationMap height={580} region={selectedRegion} regionFocusKey={regionFocusKey} serviceAreaOnly onRegionChange={region => { setSelectedRegion(region as typeof REGIONS[number]); setRegionFocusKey(key => key + 1); setSelected(null); }} value={selected ? { ...selected, resolved_address: null } : null} onPick={setSelected} disabled={false} focusPinOnChange={false} />
    </div>
    <aside className="tirkha-map-explorer-panel">
      <div><span className="tirkha-map-panel-overline">SEVEN CORE CITIES. ONE LOCAL MAP.</span><h2>Where should we<br />meet you?</h2><p>Choose one of our core service cities, then explore its mapped streets and neighborhoods. The map stays within the selected service area.</p></div>
      <div className="tirkha-map-city-list" aria-label="Map regions">
        {regions.map((region, index) => <button type="button" key={region.name} aria-pressed={selectedRegion === region.name} onClick={() => { setSelectedRegion(region.name); setRegionFocusKey(key => key + 1); setSelected(null); }}>
          <span className="tirkha-map-city-number">0{index + 1}</span><span className="tirkha-map-city-copy"><strong>{region.name}</strong><small>{region.caption}</small></span><span className="tirkha-map-city-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="tirkha-map-location-readout"><span className="tirkha-map-location-pulse"/><span><small>YOUR SELECTED POINT</small><strong>{selected ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : "Tap the map to choose a place"}</strong></span></div>
      <p className="tirkha-map-panel-footnote">Your chosen point is precise to the GPS coordinate. Address details can be added when you book a service.</p>
    </aside>
  </section>;
}
