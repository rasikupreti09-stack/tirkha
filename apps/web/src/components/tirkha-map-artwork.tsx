"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import { canvas, DomEvent, svg, type Polyline as LeafletPolyline, type LatLngExpression } from "leaflet";
import { CircleMarker, GeoJSON, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";
import { Crosshair, MapPin, MapPinned } from "lucide-react";
import { tirkhaCityViews, tirkhaLandmarks, tirkhaParks, tirkhaRoads, tirkhaUrbanBlocks, tirkhaWaterways } from "@/lib/tirkha-map-data";
import { TirkhaMark } from "./tirkha-mark";

type RoadProperties = { class?: "expressway" | "arterial" | "connector" | "local"; name?: string | null; ref?: string | null };
type RoadFeature = { type: "Feature"; id?: string; properties?: RoadProperties; geometry: { type: "LineString"; coordinates: number[][] } };
type RoadCollection = { type: "FeatureCollection"; features: RoadFeature[] };
type RoadLabelCandidate = { key: string; name: string; kind: RoadProperties["class"]; positions: LatLngExpression[] };
type BuildingFeature = { type: "Feature"; id?: string; properties?: { kind?: string; center?: [number, number] }; geometry: { type: "Polygon"; coordinates: number[][][] } };
type BuildingCollection = { type: "FeatureCollection"; features: BuildingFeature[] };

function subscribeAfterGesture(map: ReturnType<typeof useMap>, events: string, callback: () => void) {
  let timeout: number | undefined;
  let frame: number | undefined;
  const schedule = () => {
    if (timeout !== undefined) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      frame = window.requestAnimationFrame(callback);
    }, 150);
  };
  map.on(events, schedule);
  return () => {
    map.off(events, schedule);
    if (timeout !== undefined) window.clearTimeout(timeout);
    if (frame !== undefined) window.cancelAnimationFrame(frame);
  };
}

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

function roadLabelZoom(kind: RoadProperties["class"]): number {
  if (kind === "expressway") return 15;
  if (kind === "arterial") return 16;
  if (kind === "connector") return 17.5;
  return 18;
}

function labelPriority(kind: RoadProperties["class"]): number {
  return kind === "expressway" ? 0 : kind === "arterial" ? 1 : kind === "connector" ? 2 : 3;
}

function chooseNonCollidingRoadLabels(candidates: RoadLabelCandidate[], map: ReturnType<typeof useMap>, zoom: number, limit = 18) {
  if (zoom < 14) return new Set<string>();
  const detailTier = zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
  const fontWidth = detailTier >= 3 ? 7.5 : detailTier === 2 ? 7 : 6.5;
  const paddedBounds = map.getBounds().pad(0.05);
  const projected = candidates
    .filter((candidate) => candidate.positions.length >= 2 && candidate.name.trim() && zoom >= roadLabelZoom(candidate.kind))
    .map((candidate) => {
      const points = candidate.positions.map((position) => map.latLngToContainerPoint(position));
      let totalLength = 0;
      for (let index = 1; index < points.length; index += 1) totalLength += points[index - 1].distanceTo(points[index]);
      let midpoint = points[0];
      let remaining = totalLength / 2;
      for (let index = 1; index < points.length; index += 1) {
        const segment = points[index - 1].distanceTo(points[index]);
        if (remaining <= segment) {
          const ratio = segment ? remaining / segment : 0;
          midpoint = points[index - 1].add(points[index].subtract(points[index - 1]).multiplyBy(ratio));
          break;
        }
        remaining -= segment;
      }
      const labelWidth = candidate.name.length * fontWidth + 18;
      return { ...candidate, midpoint, totalLength, labelWidth, priority: labelPriority(candidate.kind) };
    })
    .filter((candidate) => candidate.totalLength >= candidate.labelWidth * 1.25)
    .filter((candidate) => paddedBounds.contains(map.containerPointToLatLng(candidate.midpoint)))
    .sort((a, b) => a.priority - b.priority || b.totalLength - a.totalLength);

  const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
  const seenNames = new Set<string>();
  const selected = new Set<string>();
  for (const candidate of projected) {
    const normalizedName = candidate.name.toLocaleLowerCase().replace(/\s+/g, " ").trim();
    if (seenNames.has(normalizedName)) continue;
    const rect = {
      left: candidate.midpoint.x - candidate.labelWidth / 2,
      right: candidate.midpoint.x + candidate.labelWidth / 2,
      top: candidate.midpoint.y - 10,
      bottom: candidate.midpoint.y + 10,
    };
    if (occupied.some((other) => rect.left < other.right + 12 && rect.right + 12 > other.left && rect.top < other.bottom + 8 && rect.bottom + 8 > other.top)) continue;
    occupied.push(rect);
    seenNames.add(normalizedName);
    selected.add(candidate.key);
    if (selected.size >= limit) break;
  }
  return selected;
}

function orderedForScreenTextPath(positions: LatLngExpression[], map: ReturnType<typeof useMap>) {
  if (positions.length < 2) return positions;
  const first = map.latLngToLayerPoint(positions[0]);
  const last = map.latLngToLayerPoint(positions[positions.length - 1]);
  const rightToLeft = last.x < first.x || (Math.abs(last.x - first.x) < 4 && last.y < first.y);
  return rightToLeft ? [...positions].reverse() : positions;
}

let nextSvgPathLabelId = 0;

function SvgPathName({ pathRef, label, detailTier }: { pathRef: { current: LeafletPolyline | null }; label: string; detailTier: number }) {
  useEffect(() => {
    let labelNode: SVGTextElement | null = null;
    const frame = window.requestAnimationFrame(() => {
      const path = pathRef.current?.getElement() as SVGPathElement | undefined;
      const svgRoot = path?.ownerSVGElement;
      if (!path || !svgRoot) return;
      if (!path.id) path.id = `tirkha-street-path-${nextSvgPathLabelId++}`;
      labelNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelNode.setAttribute("class", `tirkha-road-inline-label tirkha-label-detail-${detailTier}`);
      labelNode.setAttribute("aria-hidden", "true");
      const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
      textPath.setAttribute("href", `#${path.id}`);
      textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${path.id}`);
      textPath.setAttribute("startOffset", "50%");
      textPath.setAttribute("text-anchor", "middle");
      textPath.textContent = label;
      labelNode.appendChild(textPath);
      svgRoot.appendChild(labelNode);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      labelNode?.remove();
    };
  }, [detailTier, label, pathRef]);
  return null;
}

/** Original Tirkha cartography rendered from geographic vector geometry, with no raster tile layer. */
export const TirkhaMapArtwork = memo(function TirkhaMapArtwork() {
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
    <CityBlockLayouts />
    {!roadData && <CuratedRoadNetwork />}
    {roadData && <DetailedRoadNetwork data={roadData} />}
    <DetailedBuildingFootprints />
    <CuratedLandmarkLabels />
  </>;
});

function CityBlockLayouts() {
  const map = useMap();
  const renderer = useMemo(() => canvas({ padding: 0.15 }), []);
  const [zoom, setZoom] = useState(map.getZoom());
  const [boundsKey, setBoundsKey] = useState(map.getBounds().pad(0.12).toBBoxString());

  useEffect(() => {
    const update = () => {
      setZoom(map.getZoom());
      setBoundsKey(map.getBounds().pad(0.12).toBBoxString());
    };
    return subscribeAfterGesture(map, "zoomend moveend", update);
  }, [map]);

  const visibleBlocks = useMemo(() => {
    if (zoom < 17.5) return [];
    const [west, south, east, north] = boundsKey.split(",").map(Number);
    return tirkhaUrbanBlocks.filter((block) => {
      const lats = block.outline.map(([latitude]) => latitude);
      const lngs = block.outline.map(([, longitude]) => longitude);
      return Math.max(...lats) >= south && Math.min(...lats) <= north
        && Math.max(...lngs) >= west && Math.min(...lngs) <= east;
    });
  }, [boundsKey, zoom]);

  if (!visibleBlocks.length) return null;
  return <>
    {visibleBlocks.map((block) => {
      const fillColor = block.landUse === "commercial" ? "#e7e3d6" : block.landUse === "industrial" ? "#dce3df" : "#e0e8df";
      return <Fragment key={block.id}>
        <Polygon positions={block.outline} pathOptions={{ renderer, color: "#fffdf8", weight: zoom >= 18 ? 1.5 : 1, opacity: 0.95, fillColor, fillOpacity: zoom >= 18 ? 0.34 : 0.7, lineJoin: "round", interactive: false }} />
        {zoom >= 19 && block.buildings.map((outline, index) => <Polygon key={`${block.id}-building-${index}`} positions={outline} pathOptions={{ renderer, color: "#fdfcf8", weight: zoom >= 20 ? 1.25 : 0.9, opacity: 0.98, fillColor: block.landUse === "commercial" ? "#cec9b9" : "#cbd8cc", fillOpacity: 0.92, lineJoin: "round", interactive: false }} />)}
      </Fragment>;
    })}
  </>;
}

function CuratedRoadNetwork() {
  const map = useMap();
  const casingRenderer = useMemo(() => svg({ padding: 0.25 }), []);
  const roadRenderer = useMemo(() => svg({ padding: 0.25 }), []);
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    return subscribeAfterGesture(map, "zoomend moveend", update);
  }, [map]);
  const detailTier = zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
  const labelKeys = useMemo(() => chooseNonCollidingRoadLabels(tirkhaRoads.map((road, index) => ({
    key: String(index),
    name: road.name ?? "",
    kind: road.kind,
    positions: road.points,
  })), map, zoom, zoom >= 19 ? 20 : 14), [map, zoom]);
  return <>
    {tirkhaRoads.map((road, index) => <CuratedRoadSegment key={`road-${index}`} road={road} zoom={zoom} detailTier={detailTier} showLabel={labelKeys.has(String(index))} casingRenderer={casingRenderer} roadRenderer={roadRenderer} />)}
  </>;
}

function CuratedRoadSegment({ road, zoom, detailTier, showLabel, casingRenderer, roadRenderer }: {
  road: (typeof tirkhaRoads)[number];
  zoom: number;
  detailTier: number;
  showLabel: boolean;
  casingRenderer: ReturnType<typeof svg>;
  roadRenderer: ReturnType<typeof svg>;
}) {
  const pathRef = useRef<LeafletPolyline | null>(null);
  const widthScale = zoom < 19 ? 1 : Math.min(1.8, 1 + (zoom - 19) * 0.2);
  const baseWidth = road.kind === "expressway" ? 5.2 : road.kind === "arterial" ? 3.8 : road.kind === "connector" ? 2.5 : 1.35;
  const width = baseWidth * widthScale;
  const color = road.kind === "expressway" ? "#4b7778" : road.kind === "arterial" ? "#829d99" : road.kind === "connector" ? "#b2c0b9" : "#d1d9d2";
  return <Fragment>
    <Polyline positions={road.points} pathOptions={{ color: "#fbfcf9", weight: width + 2.6, opacity: 0.98, lineCap: "round", lineJoin: "round", interactive: false, renderer: casingRenderer }} />
    <Polyline ref={pathRef} positions={road.points} pathOptions={{ color, weight: width, opacity: road.kind === "local" ? 0.92 : 1, lineCap: "round", lineJoin: "round", interactive: false, renderer: roadRenderer }} />
    {road.name && showLabel && <SvgPathName pathRef={pathRef} label={road.name} detailTier={detailTier} />}
  </Fragment>;
}

function DetailedBuildingFootprints() {
  const map = useMap();
  const readView = () => {
    const zoom = map.getZoom();
    const region = footprintRegion(map.getCenter().lat, map.getCenter().lng);
    const tiles = zoom >= 17.5 && region ? mapBuildingTiles(map) : [];
    return { zoom, region, tiles, signature: `${region}:${tiles.join(",")}`, viewport: map.getBounds().toBBoxString() };
  };
  const [view, setView] = useState(readView);
  const [data, setData] = useState<{ signature: string; region: string; features: BuildingFeature[] } | null>(null);
  const renderer = useMemo(() => canvas({ padding: 0.1 }), []);

  useEffect(() => {
    const update = () => setView(readView());
    return subscribeAfterGesture(map, "zoomend moveend", update);
  }, [map]);

  useEffect(() => {
    if (view.zoom < 17.5 || !view.region || !view.tiles.length || view.tiles.length > 32 || data?.signature === view.signature) return;
    const controller = new AbortController();
    const region = view.region;
    void Promise.all(view.tiles.map((tile) => loadBuildingTile(region, tile, controller.signal)))
      .then((collections) => { if (!controller.signal.aborted) setData({ signature: view.signature, region, features: collections.flat() }); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [data?.signature, view.region, view.signature, view.zoom]);

  const visible = useMemo(() => {
    if (view.zoom < 17.5 || data?.region !== view.region || data?.signature !== view.signature) return null;
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

function footprintRegion(latitude: number, longitude: number): string | null {
  // Detailed footprint packs currently cover these four cities only. New cities
  // keep their native road and landmark artwork without requesting fake tiles.
  if ((latitude >= 27.38 && latitude <= 27.49 && longitude >= 84.94 && longitude <= 85.10)
    || (latitude >= 27.12 && latitude <= 27.23 && longitude >= 84.91 && longitude <= 85.04)) return null;
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
    return subscribeAfterGesture(map, "zoomend moveend", update);
  }, [map]);
  const visible = useMemo(() => {
    const bounds = map.getBounds().pad(0.08);
    const detailTier = zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
    const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
    return [...tirkhaLandmarks]
      .filter((place) => zoom >= Math.max(place.minZoom, place.kind === "district" ? 10 : 14) && bounds.contains(place.point))
      .sort((a, b) => b.minZoom - a.minZoom)
      .filter((place) => {
        const point = map.latLngToContainerPoint(place.point);
        const fontScale = detailTier >= 3 ? 7.3 : detailTier === 2 ? 6.7 : detailTier === 1 ? 6.1 : 5.8;
        const width = Math.min(210, place.name.length * fontScale + 20 + detailTier * 2);
        const height = (place.kind === "district" ? 30 : 25) + detailTier * 2;
        const rect = { left: point.x - width / 2, right: point.x + width / 2, top: point.y - height, bottom: point.y };
        if (occupied.some(other => rect.left < other.right + 5 && rect.right + 5 > other.left && rect.top < other.bottom + 4 && rect.bottom + 4 > other.top)) return false;
        occupied.push(rect);
        return true;
      });
  }, [map, zoom]);
  const detailTier = zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
  return <>
    {visible.map((place) => <CircleMarker key={place.name} center={place.point} radius={(place.kind === "district" ? 3.2 : 2) + Math.min(detailTier, 2) * 0.35} pathOptions={{ color: "#fffdf8", weight: 1.5, fillColor: place.kind === "district" ? "#16675c" : "#718b83", fillOpacity: 1 }}>
      <Tooltip permanent direction="top" offset={[0, -4]} className={`${place.kind === "district" ? "tirkha-city-label" : "tirkha-place-label"} tirkha-label-detail-${detailTier}`}>{place.name}</Tooltip>
    </CircleMarker>)}
  </>;
}

function DetailedRoadNetwork({ data }: { data: RoadCollection }) {
  const map = useMap();
  const renderer = useMemo(() => canvas({ padding: 0.5 }), []);
  const labelRenderer = useMemo(() => svg({ padding: 0.5 }), []);
  const readBounds = () => map.getBounds().pad(0.3).toBBoxString();
  const [boundsKey, setBoundsKey] = useState(readBounds);
  useEffect(() => { map.invalidateSize({ pan: false }); }, [map]);
  useEffect(() => {
    const update = () => setBoundsKey(readBounds());
    return subscribeAfterGesture(map, "zoomend moveend", update);
  }, [map]);
  const visibleData = useMemo(() => {
    const [west, south, east, north] = boundsKey.split(",").map(Number);
    const features = data.features.filter(feature => {
      const points = feature.geometry.coordinates;
      if (!points.length) return false;
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const [longitude, latitude] of points) {
        minLng = Math.min(minLng, longitude); minLat = Math.min(minLat, latitude);
        maxLng = Math.max(maxLng, longitude); maxLat = Math.max(maxLat, latitude);
      }
      return maxLng >= west && minLng <= east && maxLat >= south && minLat <= north;
    });
    return { ...data, features };
  }, [boundsKey, data]);
  const zoom = map.getZoom();
  const labelKeys = useMemo(() => chooseNonCollidingRoadLabels(visibleData.features.flatMap((feature) => {
    const name = feature.properties?.name || feature.properties?.ref;
    if (!name) return [];
    return [{
      key: roadFeatureKey(feature),
      name,
      kind: feature.properties?.class,
      positions: feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    }];
  }), map, zoom, zoom >= 20 ? 22 : zoom >= 18 ? 16 : 12), [map, visibleData.features, zoom]);
  const labeledRoads = useMemo(() => visibleData.features.filter((feature) => labelKeys.has(roadFeatureKey(feature))), [labelKeys, visibleData.features]);
  // The bundled country road extract is sparse outside its original four-city
  // coverage. Keep the locally curated network visible in those views instead
  // of replacing it with an empty canvas when the extract finishes loading.
  if (visibleData.features.length < 12) {
    const zoom = map.getZoom();
    const scale = zoom < 19 ? 1 : Math.min(1.45, 1 + (zoom - 19) * 0.22);
    return <><CuratedRoadNetwork />{visibleData.features.length > 0 && <GeoJSON
      key={boundsKey}
      data={visibleData as never}
      style={(feature) => {
        const properties = feature?.properties as RoadProperties | undefined;
        const type = properties?.class;
        const baseWidth = type === "expressway" ? 3.3 : type === "arterial" ? 2.4 : type === "connector" ? 1.45 : 0.78;
        return { color: type === "expressway" ? "#3e716c" : type === "arterial" ? "#718f87" : type === "connector" ? "#aabbb2" : "#cbd5ce", weight: baseWidth * scale, opacity: 0.96, lineCap: "round", lineJoin: "round", renderer };
      }}
    />}</>;
  }
  const detailTier = zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
  const strokeScale = zoom < 19 ? 1 : Math.min(1.45, 1 + (zoom - 19) * 0.22);
  return <>
    <GeoJSON
      key={boundsKey}
      data={visibleData as never}
      style={(feature) => {
        const properties = feature?.properties as RoadProperties | undefined;
        const type = properties?.class;
        const baseWidth = type === "expressway" ? 3.3 : type === "arterial" ? 2.4 : type === "connector" ? 1.45 : 0.78;
        return {
          color: type === "expressway" ? "#3e716c" : type === "arterial" ? "#718f87" : type === "connector" ? "#aabbb2" : "#cbd5ce",
          weight: baseWidth * strokeScale,
          opacity: type === "local" ? 0.86 : 0.98,
          lineCap: "round",
          lineJoin: "round",
          renderer,
        };
      }}
    />
    {labeledRoads.map((feature) => <RoadFeatureName key={roadFeatureKey(feature)} feature={feature} label={feature.properties?.name || feature.properties?.ref || ""} renderer={labelRenderer} detailTier={detailTier} />)}
  </>;
}

function roadFeatureKey(feature: RoadFeature) {
  if (feature.id !== undefined) return `osm-${feature.id}`;
  const points = feature.geometry.coordinates;
  const first = points[0]?.join(",") ?? "";
  const last = points[points.length - 1]?.join(",") ?? "";
  return `${feature.properties?.name ?? feature.properties?.ref ?? "road"}:${first}:${last}`;
}

function RoadFeatureName({ feature, label, renderer, detailTier }: { feature: RoadFeature; label: string; renderer: ReturnType<typeof svg>; detailTier: number }) {
  const map = useMap();
  const pathRef = useRef<LeafletPolyline | null>(null);
  const positions = useMemo(() => orderedForScreenTextPath(
    feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    map,
  ), [feature, map]);
  return <>
    <Polyline ref={pathRef} positions={positions} pathOptions={{ renderer, color: "#000", opacity: 0, weight: 1, interactive: false }} />
    <SvgPathName pathRef={pathRef} label={label} detailTier={detailTier} />
  </>;
}

export function TirkhaMapRegionControl({ onRegionSelect }: { onRegionSelect?: (region: string) => void } = {}) {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (controlRef.current) DomEvent.disableClickPropagation(controlRef.current); }, []);
  return <div ref={controlRef} className="leaflet-top leaflet-right tirkha-region-control" aria-label="Choose map region">
    <div className="tirkha-region-pills">{tirkhaCityViews.map((city) => <button key={city.label} type="button" onClick={(event) => { event.stopPropagation(); map.flyTo(city.center, city.zoom, { duration: 0.8, easeLinearity: 0.25 }); onRegionSelect?.(city.label); }} aria-label={`Show ${city.label}`}>
      <span className="tirkha-region-dot" />{city.label}
    </button>)}</div>
  </div>;
}

/** Shared animated map controls sized for mouse, stylus, and touch use. */
export function TirkhaMapZoomControl({ recenterPoints, onLocate, locating = false, pinningEnabled, onTogglePinning }: {
  recenterPoints?: [number, number][];
  onLocate?: () => void;
  locating?: boolean;
  pinningEnabled?: boolean;
  onTogglePinning?: () => void;
}) {
  const map = useMap();
  const controlRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (controlRef.current) DomEvent.disableClickPropagation(controlRef.current); }, []);
  return <div ref={controlRef} className="leaflet-top leaflet-left tirkha-zoom-control" aria-label="Map zoom controls">
    <div className="tirkha-zoom-stack">
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={(event) => { event.stopPropagation(); map.zoomIn(0.5, { animate: true }); }}>+</button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={(event) => { event.stopPropagation(); map.zoomOut(0.5, { animate: true }); }}>−</button>
      {recenterPoints && <button type="button" aria-label="Re-center map" title="Re-center map" onClick={(event) => {
        event.stopPropagation();
        if (recenterPoints.length > 1) map.fitBounds(recenterPoints, { padding: [52, 52], maxZoom: 16, animate: true, duration: 0.65 });
        else if (recenterPoints[0]) map.flyTo(recenterPoints[0], Math.max(16, map.getZoom()), { animate: true, duration: 0.65 });
      }}><Crosshair size={18} aria-hidden="true" /></button>}
      {onLocate && <button type="button" aria-label="My Location" title={locating ? "Finding your location…" : "My Location"} disabled={locating} onClick={(event) => { event.stopPropagation(); onLocate(); }}><Crosshair size={18} aria-hidden="true" /></button>}
      {onTogglePinning && <button className={pinningEnabled ? "is-pinning" : ""} type="button" aria-label={pinningEnabled ? "Disable location pin mode" : "Enable location pin mode"} aria-pressed={pinningEnabled} title={pinningEnabled ? "Pin mode on · tap the map to place your pin" : "Pin mode off · safe to pan the map"} onClick={(event) => { event.stopPropagation(); onTogglePinning(); }}>{pinningEnabled ? <MapPinned size={18} aria-hidden="true" /> : <MapPin size={18} aria-hidden="true" />}</button>}
    </div>
  </div>;
}

export function TirkhaMapSignature({ caption = "A closer view of home" }: { caption?: string }) {
  return <div className="tirkha-map-signature" aria-label="Tirkha custom map"><TirkhaMark className="tirkha-map-signature-mark"/><span><strong>TIRKHA MAP</strong><small>{caption}</small><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></span><span className="tirkha-map-live-dot" aria-hidden="true" /></div>;
}
