import type { Metadata } from "next";
import TirkhaMapExplorer from "./tirkha-map-explorer";

export const metadata: Metadata = { title: "Tirkha Map | तिर्खा", description: "Explore Tirkha's ten service regions: Kathmandu, Lalitpur, Bhaktapur, Kirtipur, Pokhara, Hetauda, Simara, Chitwan, Jhapa and Sunsari." };

export default function MapPage() {
  return <main className="tirkha-map-page">
    <header className="tirkha-map-page-header">
      <a href="/" className="tirkha-map-back">← <span>Tirkha | तिर्खा</span></a>
      <span className="tirkha-map-page-status"><i /> A MAP MADE FOR OUR CITIES</span>
    </header>
    <section className="tirkha-map-page-intro">
      <p className="tirkha-map-page-kicker">THE TIRKHA CITY MAP</p>
      <h1>Closer to every corner<br /><em>you call home.</em></h1>
      <p>Explore Kathmandu, Lalitpur, Bhaktapur, Kirtipur, Pokhara, Hetauda, Simara, Chitwan, Jhapa and Sunsari. Choose a region, explore its neighborhoods, and place a precise service pin.</p>
    </section>
    <TirkhaMapExplorer />
    <footer className="tirkha-map-page-footer"><span>Tirkha owns the cartography and map experience.</span><span>Street data © OpenStreetMap contributors (ODbL). GPS pins use exact coordinates; road-snapped live routes depend on routing service availability.</span></footer>
  </main>;
}
