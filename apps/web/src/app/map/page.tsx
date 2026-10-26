import type { Metadata } from "next";
import TirkhaMapExplorer from "./tirkha-map-explorer";

export const metadata: Metadata = { title: "Tirkha Map", description: "Explore Tirkha's original city map for Kathmandu, Lalitpur, Bhaktapur and Pokhara." };

export default function MapPage() {
  return <main className="tirkha-map-page">
    <header className="tirkha-map-page-header">
      <a href="/" className="tirkha-map-back">← <span>Tirkha | तिर्खा</span></a>
      <span className="tirkha-map-page-status"><i /> A MAP MADE FOR OUR CITIES</span>
    </header>
    <section className="tirkha-map-page-intro">
      <p className="tirkha-map-page-kicker">THE TIRKHA CITY MAP</p>
      <h1>Closer to every corner<br /><em>you call home.</em></h1>
      <p>Our own map experience, shaped around Nepal’s neighborhoods. Explore service areas, move the pin, and see where your next bit of help begins.</p>
    </section>
    <TirkhaMapExplorer />
    <footer className="tirkha-map-page-footer"><span>Tirkha owns the cartography and map experience.</span><span>Street data © OpenStreetMap contributors (ODbL). GPS pins use exact coordinates; road-snapped live routes depend on routing service availability.</span></footer>
  </main>;
}
