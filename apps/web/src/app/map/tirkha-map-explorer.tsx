"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Coordinates } from "@tirkha/shared";

const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false, loading: () => <div className="tirkha-map-explorer-loading" role="status">Preparing your city map…</div> });
const regions = [
  { name: "Kathmandu", caption: "Old lanes, new rhythms", coordinate: [27.7172, 85.324] as [number,number] },
  { name: "Lalitpur", caption: "Patan and the southern valley", coordinate: [27.674, 85.322] as [number,number] },
  { name: "Bhaktapur", caption: "Heritage streets, familiar turns", coordinate: [27.676, 85.432] as [number,number] },
  { name: "Pokhara", caption: "Lakeside and the city center", coordinate: [28.217, 83.985] as [number,number] },
];

export default function TirkhaMapExplorer() {
  const [selected, setSelected] = useState<Coordinates | null>(null);
  return <section className="tirkha-map-explorer" aria-label="Explore the Tirkha city map">
    <div className="tirkha-map-explorer-canvas">
      <LocationMap height={580} value={selected ? { ...selected, resolved_address: null } : null} onPick={setSelected} disabled={false} />
    </div>
    <aside className="tirkha-map-explorer-panel">
      <div><span className="tirkha-map-panel-overline">FOUR CITIES. ONE LOCAL MAP.</span><h2>Where should we<br />meet you?</h2><p>Pick a city, then zoom in to reveal local names and mapped building outlines. Tap the map to place your service pin at the right home or entrance.</p></div>
      <div className="tirkha-map-city-list" aria-label="Map regions">
        {regions.map((region, index) => <button type="button" key={region.name} onClick={() => { setSelected({ latitude: region.coordinate[0], longitude: region.coordinate[1] }); }}>
          <span className="tirkha-map-city-number">0{index + 1}</span><span className="tirkha-map-city-copy"><strong>{region.name}</strong><small>{region.caption}</small></span><span className="tirkha-map-city-arrow" aria-hidden="true">↗</span>
        </button>)}
      </div>
      <div className="tirkha-map-location-readout"><span className="tirkha-map-location-pulse"/><span><small>YOUR SELECTED POINT</small><strong>{selected ? `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}` : "Tap the map to choose a place"}</strong></span></div>
      <p className="tirkha-map-panel-footnote">Your chosen point is precise to the GPS coordinate. Address details can be added when you book a service.</p>
    </aside>
  </section>;
}
