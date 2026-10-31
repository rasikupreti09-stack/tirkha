"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { REGIONS, type Coordinates } from "@tirkha/shared";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false, loading: () => <div className="tirkha-map-explorer-loading" role="status">Preparing your city map…</div> });
const regions: { name: typeof REGIONS[number]; caption: string }[] = [
  { name: "Kathmandu", caption: "Old lanes, new rhythms" },
  { name: "Lalitpur", caption: "Patan and the southern valley" },
  { name: "Bhaktapur", caption: "Heritage streets, familiar turns" },
  { name: "Pokhara", caption: "Lakeside and the city center" },
  { name: "Hetauda", caption: "Buddha Chowk and Rapti Road" },
  { name: "Simara", caption: "Simara Chowk and Jeetpur-Simara" },
];

export default function TirkhaMapExplorer() {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<typeof REGIONS[number]>("Kathmandu");
  return <section className="tirkha-map-explorer" aria-label="Explore the Tirkha city map">
    <div className="tirkha-map-explorer-canvas">
      <LocationMap height={580} region={selectedRegion} onRegionChange={region => setSelectedRegion(region as typeof REGIONS[number])} value={selected ? { ...selected, resolved_address: null } : null} onPick={setSelected} disabled={false} focusPinOnChange={false} />
    </div>
    <aside className="tirkha-map-explorer-panel">
      <div><span className="tirkha-map-panel-overline">SIX CITIES. ONE LOCAL MAP.</span><h2>Where should we<br />meet you?</h2><p>Pick a city, then zoom in to reveal locally curated streets and neighborhood names. Enable pin mode before tapping to choose a home or entrance.</p></div>
      <div className="tirkha-map-city-list" aria-label="Map regions">
        {regions.map((region, index) => <button type="button" key={region.name} aria-pressed={selectedRegion === region.name} onClick={() => { setSelectedRegion(region.name); setSelected(null); }}>
          <span className="tirkha-map-city-number">0{index + 1}</span><span className="tirkha-map-city-copy"><strong>{region.name}</strong><small>{region.caption}</small></span><span className="tirkha-map-city-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="tirkha-map-location-readout"><span className="tirkha-map-location-pulse"/><span><small>YOUR SELECTED POINT</small><strong>{selected ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : "Tap the map to choose a place"}</strong></span></div>
      <p className="tirkha-map-panel-footnote">Your chosen point is precise to the GPS coordinate. Address details can be added when you book a service.</p>
    </aside>
  </section>;
}
