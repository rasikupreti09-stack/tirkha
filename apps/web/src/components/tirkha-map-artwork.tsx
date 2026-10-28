"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { canvas, DomEvent } from "leaflet";
import { CircleMarker, GeoJSON, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";
import { tirkhaCityViews, tirkhaLandmarks, tirkhaParks, tirkhaRoads, tirkhaWaterways } from "@/lib/tirkha-map-data";

type RoadProperties = { class?: "expressway" | "arterial" | "connector" | "local"; name?: string | null; ref?: string | null };
type RoadFeature = { type: "Feature"; id?: string; properties?: RoadProperties; geometry: { type: "LineString"; coordinates: number[][] } };
type RoadCollection = { type: "FeatureCollection"; features: RoadFeature[] };
type BuildingFeature = { type: "Feature"; id?: string; properties?: { kind?: string; center?: [number, number] }; geometry: { type: "Polygon"; coordinates: number[][][] } };
type BuildingCollection = { type: "FeatureCollection"; features: BuildingFeature[] };

async function loadBuildingTile(region: string, tile: string, signal: AbortSignal): Promise<BuildingFeature[]> {
  const response = await fetch(`/data/buildings/${region}/${tile}.geojson.gz`, { cache: "force-cache", signal });
  if (!response.ok || typeof DecompressionStream === "undefined") return [];
  const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"));
  const collection = await new Response(stream).json() as BuildingCollection;
  return collection.features ?? [];
}

function mapBuildingTiles(map: ReturnType<typeof useMap>) {
  const bounds = map.getBounds();
  const south = Math.floor(bounds.getSouth() * 100);
  const north = Math.floor(bounds.getNorth() * 100);
  const west = Math.floor(bounds.getWest() * 100);
  const east = Math.floor(bounds.getEast() * 100);
  const tiles: string[] = [];
  for (let lat = south; lat <= north; lat++) {
    for (let lon = west; lon <= east; lon++) tiles.push(`${lat}_${lon}`);
  }
  return tiles;
}

/** Original Tirkha cartography rendered from geographic vector geometry, with no raster tile layer. */
export function TirkhaMapArtwork() {
  const [roadData, setRoadData] = useState<RoadCollection | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/data/tirkha-nepal-roads.geojson.gz", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok || typeof DecompressionStream === "undefined") return null;
        const stream = new Blob([await response.arrayBuffer()]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(stream).json() as Promise<RoadCollection>;
      })
      .then((result) => { if (active && result?.features?.length) setRoadData(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  return <>
    {tirkhaParks.map((park, index) => <Polygon key={`park-${index}`} positions={park} pathOptions={{ color: "#b8d3bf", weight: 1, fillColor: "#dcebdd", fillOpacity: 0.8, interactive: false }} />)}
    {tirkhaWaterways.map((line, index) => <Polyline key={`water-${index}`} positions={line} pathOptions={{ color: "#a9c9ce", weight: 8, opacity: 0.42, lineCap: "round", lineJoin: "round", interactive: false }} />)}
    {tirkhaWaterways.map((line, index) => <Polyline key={`water-core-${index}`} positions={line} pathOptions={{ color: "#8db8c0", weight: 2.4, opacity: 0.82, lineCap: "round", lineJoin: "round", interactive: false }} />)}
    {!roadData && <CuratedRoadNetwork />}
    {roadData && <DetailedRoadNetwork data={roadData} />}
    <DetailedBuildingFootprints />
    <CuratedLandmarkLabels />
  </>;
}

function CuratedRoadNetwork() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    return () => { map.off("zoomend", update); };
  }, [map]);
  return <>
    {tirkhaRoads.map((road, index) => {
      const width = road.kind === "expressway" ? 8 : road.kind === "arterial" ? 6 : road.kind === "connector" ? 4.4 : 2.4;
      const color = road.kind === "expressway" ? "#4b7778" : road.kind === "arterial" ? "#829d99" : road.kind === "connector" ? "#b2c0b9" : "#d1d9d2";
      const labelZoom = road.kind === "expressway" ? 11 : road.kind === "arterial" ? 13 : road.kind === "connector" ? 15 : 16;
      return <Fragment key={`road-${index}`}>
        <Polyline positions={road.points} pathOptions={{ color: "#fbfcf9", weight: width + 3, opacity: 0.94, lineCap: "round", lineJoin: "round", interactive: false }} />
        <Polyline positions={road.points} pathOptions={{ color, weight: width, opacity: road.kind === "local" ? 0.85 : 1, lineCap: "round", lineJoin: "round", interactive: zoom >= labelZoom }}>
          {road.name && zoom >= labelZoom && <Tooltip sticky direction="top" className="tirkha-road-label">{road.name}</Tooltip>}
        </Polyline>
      </Fragment>;
    })}
  </>;
}

function DetailedBuildingFootprints() {
  const map = useMap();
  const readView = () => {
    const zoom = map.getZoom();
    const region = footprintRegion(map.getCenter().lat, map.getCenter().lng);
    const tiles = zoom >= 16 ? mapBuildingTiles(map) : [];
    return { zoom, region, tiles, signature: `${region}:${tiles.join(",")}`, viewport: map.getBounds().toBBoxString() };
  };
  const [view, setView] = useState(readView);
  const [data, setData] = useState<{ signature: string; region: string; features: BuildingFeature[] } | null>(null);
  const renderer = useMemo(() => canvas({ padding: 0.1 }), []);

  useEffect(() => {
    const update = () => setView(readView());
    map.on("zoomend moveend", update);
    return () => { map.off("zoomend moveend", update); };
  }, [map]);

  useEffect(() => {
    if (view.zoom < 16 || !view.tiles.length || view.tiles.length > 32 || data?.signature === view.signature) return;
    const controller = new AbortController();
    void Promise.all(view.tiles.map((tile) => loadBuildingTile(view.region, tile, controller.signal)))
      .then((collections) => { if (!controller.signal.aborted) setData({ signature: view.signature, region: view.region, features: collections.flat() }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [data?.signature, view.region, view.signature, view.zoom]);

  const visible = useMemo(() => {
    if (view.zoom < 16 || data?.region !== view.region || data?.signature !== view.signature) return null;
    const bounds = map.getBounds().pad(0.12);
    return data.features.filter((feature) => {
      const center = feature.properties?.center;
      return center ? bounds.contains([center[1], center[0]]) : false;
    });
  }, [data, map, view.region, view.signature, view.viewport, view.zoom]);

  if (!visible?.length) return null;
  return <GeoJSON
    key={view.signature}
    data={{ type: "FeatureCollection", features: visible } as never}
    style={(feature) => {
      const kind = String(feature?.properties?.kind ?? "");
      const fillColor = kind === "apartments" || kind === "residential" ? "#cbd1c9" : kind === "commercial" ? "#d7d3c7" : "#dedbd1";
      return { color: "#fffefb", weight: 0.65, opacity: 0.95, fillColor, fillOpacity: 0.96, lineJoin: "round", renderer };
    }}
    interactive={false}
  />;
}

function footprintRegion(latitude: number, longitude: number) {
  if (latitude >= 28.12) return "pokhara";
  if (longitude >= 85.39) return "bhaktapur";
  if (latitude < 27.70 || longitude < 85.30) return "lalitpur";
  return "kathmandu";
}

function CuratedLandmarkLabels() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend moveend", update);
    return () => { map.off("zoomend moveend", update); };
  }, [map]);
  const visible = useMemo(() => {
    const bounds = map.getBounds().pad(0.08);
    const occupied = new Set<string>();
    return [...tirkhaLandmarks]
      .filter((place) => zoom >= place.minZoom && bounds.contains(place.point))
      .sort((a, b) => b.minZoom - a.minZoom)
      .filter((place) => {
        const point = map.latLngToContainerPoint(place.point);
        const cell = `${Math.floor(point.x / 78)}:${Math.floor(point.y / 32)}`;
        if (occupied.has(cell)) return false;
        occupied.add(cell);
        return true;
      });
  }, [map, zoom]);
  return <>
    {visible.map((place) => <CircleMarker key={place.name} center={place.point} radius={place.kind === "district" ? 3.2 : 2} pathOptions={{ color: "#fffdf8", weight: 1.5, fillColor: place.kind === "district" ? "#16675c" : "#718b83", fillOpacity: 1 }}>
      <Tooltip permanent direction="top" offset={[0, -4]} className={place.kind === "district" ? "tirkha-city-label" : "tirkha-place-label"}>{place.name}</Tooltip>
    </CircleMarker>)}
  </>;
}

function DetailedRoadNetwork({ data }: { data: RoadCollection }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const renderer = useMemo(() => canvas({ padding: 0.5 }), []);
  useEffect(() => {
    map.invalidateSize({ pan: false });
    const updateZoom = () => setZoom(map.getZoom());
    map.on("zoomend", updateZoom);
    return () => { map.off("zoomend", updateZoom); };
  }, [map]);
  return <GeoJSON
    key={Math.floor(zoom)}
    data={data as never}
    style={(feature) => {
      const properties = feature?.properties as RoadProperties | undefined;
      const type = properties?.class;
      const zoom = map.getZoom();
      return {
        color: type === "expressway" ? "#3e716c" : type === "arterial" ? "#718f87" : type === "connector" ? "#aabbb2" : "#cbd5ce",
        weight: type === "expressway" ? 3.4 : type === "arterial" ? 2.5 : type === "connector" ? (zoom >= 14 ? 1.55 : 1.1) : (zoom >= 15 ? 1.1 : 0.68),
        opacity: type === "local" ? 0.82 : 0.97,
        lineCap: "round",
        lineJoin: "round",
        renderer,
      };
    }}
    onEachFeature={(feature, layer) => {
      const props = feature.properties as RoadProperties | undefined;
      const label = props?.name || props?.ref;
      const minimumLabelZoom = props?.class === "expressway" ? 11 : props?.class === "arterial" ? 13 : props?.class === "connector" ? 15 : 17;
      if (label) layer.bindTooltip(label, { permanent: zoom >= minimumLabelZoom, sticky: zoom < minimumLabelZoom, direction: "top", className: "tirkha-road-label" });
    }}
  />;
}

export function TirkhaMapRegionControl() {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (controlRef.current) DomEvent.disableClickPropagation(controlRef.current); }, []);
  return <div ref={controlRef} className="leaflet-top leaflet-right tirkha-region-control" aria-label="Choose map region">
    <div className="tirkha-region-pills">{tirkhaCityViews.map((city) => <button key={city.label} type="button" onClick={(event) => { event.stopPropagation(); map.flyTo(city.center, city.zoom, { duration: 0.7 }); }} aria-label={`Show ${city.label}`}>
      <span className="tirkha-region-dot" />{city.label}
    </button>)}</div>
  </div>;
}

/** Shared animated zoom controls sized for mouse, stylus, and touch use. */
export function TirkhaMapZoomControl() {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (controlRef.current) DomEvent.disableClickPropagation(controlRef.current); }, []);
  return <div ref={controlRef} className="leaflet-top leaflet-left tirkha-zoom-control" aria-label="Map zoom controls">
    <div className="tirkha-zoom-stack">
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={(event) => { event.stopPropagation(); map.zoomIn(0.75, { animate: true }); }}>+</button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={(event) => { event.stopPropagation(); map.zoomOut(0.75, { animate: true }); }}>−</button>
    </div>
  </div>;
}

export function TirkhaMapSignature({ caption = "A closer view of home" }: { caption?: string }) {
  return <div className="tirkha-map-signature" aria-label="Tirkha custom map"><span className="tirkha-map-signature-mark">t</span><span><strong>TIRKHA MAP</strong><small>{caption}</small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></span><span className="tirkha-map-live-dot" aria-hidden="true" /></div>;
}
