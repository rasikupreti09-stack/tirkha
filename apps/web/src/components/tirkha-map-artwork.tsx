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
type RoadLabelPlacement = { startOffset: number; scale: number };
type BuildingFeature = { type: "Feature"; id?: string; properties?: { kind?: string; center?: [number, number] }; geometry: { type: "Polygon"; coordinates: number[][][] } };
type BuildingCollection = { type: "FeatureCollection"; features: BuildingFeature[] };
const prominentNeighborhoods = new Set([
  "THAMEL", "DURBAR MARG", "LAZIMPAT", "NAXAL", "PUTALISADAK", "GAUSHALA", "BALKHU", "KALANKI",
  "TRIPURESHWOR", "MAITIGHAR", "SINAMANGAL", "KOTESHWOR", "KOTESHWOR NEIGHBORHOOD", "BOUDDHA · BOUDHANATH",
  "NEW BANESHWOR", "MID-BANESHWOR", "OLD BANESHWOR", "LALITPUR · PATAN",
  "KUPONDOLE", "JHAMSIKHEL", "PULCHOWK", "JAWALAKHEL", "PATAN DURBAR SQUARE", "BHAKTAPUR DURBAR SQUARE",
  "POKHARA LAKESIDE", "BUDDHA CHOWK", "SIMARA CHOWK",
]);

function subscribeAfterGesture(map: ReturnType<typeof useMap>, events: string, callback: () => void) {
  let frame: number | undefined;
  const schedule = () => {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      callback();
    });
  };
  map.on(events, schedule);
  return () => {
    map.off(events, schedule);
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
  if (kind === "expressway") return 11.5;
  if (kind === "arterial") return 12.5;
  if (kind === "connector") return 13.5;
  return 14;
}

function MapZoomCeiling() {
  const map = useMap();
  useEffect(() => { map.setMaxZoom(28); }, [map]);
  return null;
}

function labelPriority(kind: RoadProperties["class"]): number {
  return kind === "expressway" ? 0 : kind === "arterial" ? 1 : kind === "connector" ? 2 : 3;
}

function segmentViewportFraction(start: { x: number; y: number }, end: { x: number; y: number }, width: number, height: number) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let low = 0;
  let high = 1;
  const clips: [number, number][] = [[-dx, start.x], [dx, width - start.x], [-dy, start.y], [dy, height - start.y]];
  for (const [p, q] of clips) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return null;
      continue;
    }
    const ratio = q / p;
    if (p < 0) low = Math.max(low, ratio);
    else high = Math.min(high, ratio);
    if (low > high) return null;
  }
  return (low + high) / 2;
}

function chooseNonCollidingRoadLabels(candidates: RoadLabelCandidate[], map: ReturnType<typeof useMap>, zoom: number) {
  if (zoom < 11.5) return new Map<string, RoadLabelPlacement>();
  const fontSize = Math.min(15, Math.max(9.5, 9.5 + (zoom - 15.5) * 0.48));
  const bounds = map.getBounds();
  const measure = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (measure) measure.font = `800 ${fontSize}px Arial, sans-serif`;
  const projected = candidates
    .filter((candidate) => candidate.positions.length >= 2 && candidate.name.trim() && zoom >= roadLabelZoom(candidate.kind))
    .map((candidate) => {
      const points = candidate.positions.map((position) => map.latLngToContainerPoint(position));
      let totalLength = 0;
      const segments = points.slice(1).map((point, index) => ({ start: points[index], end: point, length: points[index].distanceTo(point) }));
      for (const segment of segments) totalLength += segment.length;
      let traveled = 0;
      const visibleOffsets: number[] = [];
      const size = map.getSize();
      for (const segment of segments) {
        const fraction = segmentViewportFraction(segment.start, segment.end, size.x, size.y);
        if (fraction !== null && totalLength > 0) visibleOffsets.push((traveled + segment.length * fraction) / totalLength * 100);
        traveled += segment.length;
      }
      return { ...candidate, points, totalLength, visibleOffsets: visibleOffsets.sort((a, b) => Math.abs(a - 50) - Math.abs(b - 50)).slice(0, 8), priority: labelPriority(candidate.kind) };
    })
    .sort((a, b) => a.priority - b.priority || b.totalLength - a.totalLength);

  const cellSize = 96;
  const occupied = new Map<string, { left: number; right: number; top: number; bottom: number }[]>();
  const placements = new Map<string, RoadLabelPlacement>();
  const rectCells = (rect: { left: number; right: number; top: number; bottom: number }) => {
    const keys: string[] = [];
    for (let x = Math.floor(rect.left / cellSize); x <= Math.floor(rect.right / cellSize); x += 1) {
      for (let y = Math.floor(rect.top / cellSize); y <= Math.floor(rect.bottom / cellSize); y += 1) keys.push(`${x}:${y}`);
    }
    return keys;
  };
  const collidingRects = (rect: { left: number; right: number; top: number; bottom: number }) => {
    const candidatesInCells = new Set(rectCells(rect).flatMap((cell) => occupied.get(cell) ?? []));
    return [...candidatesInCells].filter((other) => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top);
  };

  for (const candidate of projected) {
    const textWidth = measure?.measureText(candidate.name).width ?? candidate.name.length * fontSize * 0.62;
    const options: { startOffset: number; scale: number; rect: { left: number; right: number; top: number; bottom: number }; collisions: number }[] = [];
    for (const scale of [1, 0.9, 0.8, 0.7, 0.62]) {
      const labelWidth = (textWidth * scale) + 4;
      const offsets = [...new Set([50, 36, 64, 22, 78, 10, 90, 5, 95, ...candidate.visibleOffsets])];
      for (const startOffset of offsets) {
        let distance = candidate.totalLength * startOffset / 100;
        let anchor = candidate.points[0];
        let angle = 0;
        for (let index = 1; index < candidate.points.length; index += 1) {
          const segment = candidate.points[index - 1].distanceTo(candidate.points[index]);
          if (distance <= segment) {
            const ratio = segment ? distance / segment : 0;
            anchor = candidate.points[index - 1].add(candidate.points[index].subtract(candidate.points[index - 1]).multiplyBy(ratio));
            angle = Math.atan2(candidate.points[index].y - candidate.points[index - 1].y, candidate.points[index].x - candidate.points[index - 1].x);
            break;
          }
          distance -= segment;
        }
        if (!bounds.contains(map.containerPointToLatLng(anchor))) continue;
        const labelHeight = fontSize * scale * 1.35 + 3;
        const boxWidth = Math.abs(labelWidth * Math.cos(angle)) + Math.abs(labelHeight * Math.sin(angle));
        const boxHeight = Math.abs(labelWidth * Math.sin(angle)) + Math.abs(labelHeight * Math.cos(angle));
        const rect = { left: anchor.x - boxWidth / 2, right: anchor.x + boxWidth / 2, top: anchor.y - boxHeight / 2, bottom: anchor.y + boxHeight / 2 };
        options.push({ startOffset, scale, rect, collisions: collidingRects(rect).length });
        if (options[options.length - 1].collisions === 0) break;
      }
      if (options.length && options[options.length - 1].collisions === 0) break;
    }
    if (!options.length) continue;
    // Keep every in-view name. Prefer a clear placement; if the screen is very
    // dense, use the smallest overlap and reduced type instead of dropping it.
    const selected = options.find((option) => option.collisions === 0)
      ?? options.reduce((best, option) => option.collisions < best.collisions ? option : best);
    placements.set(candidate.key, { startOffset: selected.startOffset, scale: selected.scale });
    for (const cell of rectCells(selected.rect)) occupied.set(cell, [...(occupied.get(cell) ?? []), selected.rect]);
  }
  return placements;
}

function orderedForScreenTextPath(positions: LatLngExpression[], map: ReturnType<typeof useMap>) {
  if (positions.length < 2) return positions;
  const first = map.latLngToLayerPoint(positions[0]);
  const last = map.latLngToLayerPoint(positions[positions.length - 1]);
  const rightToLeft = last.x < first.x || (Math.abs(last.x - first.x) < 4 && last.y < first.y);
  return rightToLeft ? [...positions].reverse() : positions;
}

let nextSvgPathLabelId = 0;

function SvgPathName({ pathRef, label, fontSize, placement = { startOffset: 50, scale: 1 } }: { pathRef: { current: LeafletPolyline | null }; label: string; fontSize: number; placement?: RoadLabelPlacement }) {
  const labelNodeRef = useRef<SVGTextElement | null>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const path = pathRef.current?.getElement() as SVGPathElement | undefined;
      const svgRoot = path?.ownerSVGElement;
      if (!path || !svgRoot) return;
      if (!path.id) path.id = `tirkha-street-path-${nextSvgPathLabelId++}`;
      const labelNode = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelNode.setAttribute("class", "tirkha-road-inline-label");
      labelNode.setAttribute("font-size", String(fontSize * placement.scale));
      labelNode.setAttribute("aria-hidden", "true");
      labelNodeRef.current = labelNode;
      const textPath = document.createElementNS("http://www.w3.org/2000/svg", "textPath");
      textPath.setAttribute("href", `#${path.id}`);
      textPath.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${path.id}`);
      textPath.setAttribute("startOffset", `${placement.startOffset}%`);
      textPath.setAttribute("text-anchor", "middle");
      textPath.textContent = label;
      labelNode.appendChild(textPath);
      svgRoot.appendChild(labelNode);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      labelNodeRef.current?.remove();
      labelNodeRef.current = null;
    };
  }, [label, pathRef, placement.scale, placement.startOffset]);
  useEffect(() => {
    labelNodeRef.current?.setAttribute("font-size", String(fontSize * placement.scale));
    labelNodeRef.current?.querySelector("textPath")?.setAttribute("startOffset", `${placement.startOffset}%`);
  }, [fontSize, placement.scale, placement.startOffset]);
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
    <MapZoomCeiling />
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
        {zoom >= 19 && block.buildings.map((outline, index) => <Polygon key={`${block.id}-building-${index}`} positions={outline} pathOptions={{ renderer, color: "#fdfcf8", weight: Math.min(4.07, zoom >= 20 ? 1.35 + (zoom - 20) * 0.34 : 0.9), opacity: 0.98, fillColor: block.landUse === "commercial" ? "#cec9b9" : "#cbd8cc", fillOpacity: 0.92, lineJoin: "round", interactive: false }} />)}
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
  const fontSize = Math.min(15, Math.max(9.5, 9.5 + (zoom - 15.5) * 0.48));
  const labelPlacements = useMemo(() => chooseNonCollidingRoadLabels(tirkhaRoads.map((road, index) => ({
    key: String(index),
    name: road.name ?? "",
    kind: road.kind,
    positions: road.points,
  })), map, zoom), [map, zoom]);
  return <>
    {tirkhaRoads.map((road, index) => <CuratedRoadSegment key={`road-${index}`} road={road} zoom={zoom} fontSize={fontSize} labelPlacement={labelPlacements.get(String(index))} casingRenderer={casingRenderer} roadRenderer={roadRenderer} />)}
  </>;
}

function CuratedRoadSegment({ road, zoom, fontSize, labelPlacement, casingRenderer, roadRenderer }: {
  road: (typeof tirkhaRoads)[number];
  zoom: number;
  fontSize: number;
  labelPlacement?: RoadLabelPlacement;
  casingRenderer: ReturnType<typeof svg>;
  roadRenderer: ReturnType<typeof svg>;
}) {
  const pathRef = useRef<LeafletPolyline | null>(null);
  const widthScale = zoom < 19 ? 1 : Math.min(3.34, 1 + (zoom - 19) * 0.26);
  const baseWidth = road.kind === "expressway" ? 5.2 : road.kind === "arterial" ? 3.8 : road.kind === "connector" ? 2.5 : 1.35;
  const width = baseWidth * widthScale;
  const color = road.kind === "expressway" ? "#4b7778" : road.kind === "arterial" ? "#829d99" : road.kind === "connector" ? "#b2c0b9" : "#d1d9d2";
  return <Fragment>
    <Polyline positions={road.points} pathOptions={{ color: "#fbfcf9", weight: width + 2.6, opacity: 0.98, lineCap: "round", lineJoin: "round", interactive: false, renderer: casingRenderer }} />
    <Polyline ref={pathRef} positions={road.points} pathOptions={{ color, weight: width, opacity: road.kind === "local" ? 0.92 : 1, lineCap: "round", lineJoin: "round", interactive: false, renderer: roadRenderer }} />
    {road.name && labelPlacement && <SvgPathName pathRef={pathRef} label={road.name} fontSize={fontSize} placement={labelPlacement} />}
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
      const footprintScale = view.zoom < 20 ? 1 : Math.min(4.23, 1.35 + (view.zoom - 20) * 0.36);
      return { color: "#fffefb", weight: 0.65 * footprintScale, opacity: 0.95, fillColor, fillOpacity: 0.96, lineJoin: "round", renderer };
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
    const detailTier = zoom >= 24 ? 5 : zoom >= 22 ? 4 : zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
    const fontSize = detailTier >= 5 ? 15.5 : detailTier === 4 ? 14 : detailTier === 3 ? 12.5 : detailTier === 2 ? 11.5 : detailTier === 1 ? 10.5 : 10;
    const measure = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    if (measure) measure.font = `800 ${fontSize}px Arial, sans-serif`;
    const occupied: { left: number; right: number; top: number; bottom: number }[] = [];
    return [...tirkhaLandmarks]
      .filter((place) => {
        const minZoom = place.kind === "district"
          ? 9.5
          : prominentNeighborhoods.has(place.name.toUpperCase())
            ? 11.5
            : Math.max(13.5, Math.min(place.minZoom, 14));
        return zoom >= minZoom && bounds.contains(place.point);
      })
      .sort((a, b) => {
        const priority = (place: (typeof tirkhaLandmarks)[number]) => prominentNeighborhoods.has(place.name.toUpperCase()) ? 0 : place.kind === "district" ? 1 : 2;
        return priority(a) - priority(b) || b.minZoom - a.minZoom;
      })
      .map((place) => {
        const point = map.latLngToContainerPoint(place.point);
        const width = Math.min(210, (measure?.measureText(place.name).width ?? place.name.length * fontSize * 0.62) + 12);
        const height = fontSize + 8;
        const offsets: [number, number][] = [[0, -4], [0, -height - 9], [0, 8], [-width / 2 - 10, -4], [width / 2 + 10, -4], [0, -height * 2 - 14], [0, height + 10]];
        const placements = offsets.map(([x, y]) => {
          const left = point.x + x - width / 2;
          const top = point.y + y - height;
          const rect = { left, right: left + width, top, bottom: top + height };
          return { offset: [x, y] as [number, number], rect, collisions: occupied.filter(other => rect.left < other.right && rect.right > other.left && rect.top < other.bottom && rect.bottom > other.top).length };
        });
        const placement = placements.find((candidate) => candidate.collisions === 0)
          ?? placements.reduce((best, candidate) => candidate.collisions < best.collisions ? candidate : best);
        occupied.push(placement.rect);
        return { ...place, labelOffset: placement.offset };
      });
  }, [map, zoom]);
  const detailTier = zoom >= 24 ? 5 : zoom >= 22 ? 4 : zoom >= 20 ? 3 : zoom >= 18 ? 2 : zoom >= 16 ? 1 : 0;
  return <>
    {visible.map((place) => <CircleMarker key={place.name} center={place.point} radius={(place.kind === "district" ? 3.2 : 2) + Math.min(detailTier, 2) * 0.35} pathOptions={{ color: "#fffdf8", weight: 1.5, fillColor: place.kind === "district" ? "#16675c" : "#718b83", fillOpacity: 1 }}>
      <Tooltip permanent direction="top" offset={place.labelOffset} className={`${place.kind === "district" ? "tirkha-city-label" : "tirkha-place-label"} ${prominentNeighborhoods.has(place.name.toUpperCase()) ? "tirkha-place-label-hub" : ""} tirkha-label-detail-${detailTier}`}>{place.name}</Tooltip>
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
  const labelPlacements = useMemo(() => chooseNonCollidingRoadLabels(visibleData.features.flatMap((feature) => {
    const name = feature.properties?.name || feature.properties?.ref;
    if (!name) return [];
    return [{
      key: roadFeatureKey(feature),
      name,
      kind: feature.properties?.class,
      positions: orderedForScreenTextPath(feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]), map),
    }];
  }), map, zoom), [map, visibleData.features, zoom]);
  const labeledRoads = useMemo(() => visibleData.features.filter((feature) => labelPlacements.has(roadFeatureKey(feature))), [labelPlacements, visibleData.features]);
  // The bundled country road extract is sparse outside its original four-city
  // coverage. Keep the locally curated network visible in those views instead
  // of replacing it with an empty canvas when the extract finishes loading.
  if (visibleData.features.length < 12) {
    const zoom = map.getZoom();
    const scale = zoom < 19 ? 1 : Math.min(3.25, 1 + (zoom - 19) * 0.25);
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
  const fontSize = Math.min(15, Math.max(9.5, 9.5 + (zoom - 15.5) * 0.48));
  const strokeScale = zoom < 19 ? 1 : Math.min(3.25, 1 + (zoom - 19) * 0.25);
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
    {labeledRoads.map((feature) => <RoadFeatureName key={roadFeatureKey(feature)} feature={feature} label={feature.properties?.name || feature.properties?.ref || ""} renderer={labelRenderer} fontSize={fontSize} placement={labelPlacements.get(roadFeatureKey(feature))} />)}
  </>;
}

function roadFeatureKey(feature: RoadFeature) {
  if (feature.id !== undefined) return `osm-${feature.id}`;
  const points = feature.geometry.coordinates;
  const first = points[0]?.join(",") ?? "";
  const last = points[points.length - 1]?.join(",") ?? "";
  return `${feature.properties?.name ?? feature.properties?.ref ?? "road"}:${first}:${last}`;
}

function RoadFeatureName({ feature, label, renderer, fontSize, placement }: { feature: RoadFeature; label: string; renderer: ReturnType<typeof svg>; fontSize: number; placement?: RoadLabelPlacement }) {
  const map = useMap();
  const pathRef = useRef<LeafletPolyline | null>(null);
  const positions = useMemo(() => orderedForScreenTextPath(
    feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    map,
  ), [feature, map]);
  return <>
    <Polyline ref={pathRef} positions={positions} pathOptions={{ renderer, color: "#000", opacity: 0, weight: 1, interactive: false }} />
    {placement && <SvgPathName pathRef={pathRef} label={label} fontSize={fontSize} placement={placement} />}
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
