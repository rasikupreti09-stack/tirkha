/// <reference lib="webworker" />

import type { SpatialBounds, SpatialBuildingFeature, SpatialRoadFeature, SpatialViewportQuery, SpatialViewportResult, SpatialWorkerRequest, SpatialWorkerResponse } from "../lib/spatial-engine-protocol";
import type { SpatialGeometry, SpatialRegionalFeature } from "../lib/spatial-engine-protocol";
import { getDistrictLodTier, getDistrictsIntersectingViewport, getDistrictTileBounds, getDistrictTileKeys, isDistrictKey, type DistrictLodTier } from "../lib/districtBounds";
import { getSpatialOfflineValue, putSpatialOfflineValue } from "../lib/spatial-offline-cache";

type Collection<T> = { type: "FeatureCollection"; features: T[] };
type TileEntry = { features: SpatialBuildingFeature[]; bytes: number };
type WorkerScope = DedicatedWorkerGlobalScope;
const worker = self as unknown as WorkerScope;
const CELL = 0.1;
const MAX_FEATURES = 50_000;
const MAX_ROAD_FEATURES = 250_000;
const MAX_ROAD_VERTICES = 5_000_000;
const MAX_BUILDING_TILE_FEATURES = 30_000;
const MAX_CACHE_TILES = 96;
const MAX_BUILDING_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_ACTIVE_BYTES = 128 * 1024 * 1024;
const MAX_ROAD_BYTES = 64 * 1024 * 1024;
const MAX_ROAD_JSON_BYTES = 48 * 1024 * 1024;
const MAX_BUILDING_TILE_JSON_BYTES = 12 * 1024 * 1024;
const MAX_QUERY_CELLS = 100_000;
const MAX_REGIONAL_CACHE_ENTRIES = 24;
const MAX_REGIONAL_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_REGIONAL_RESPONSE_BYTES = 24 * 1024 * 1024;
const MAX_REGIONAL_FEATURES = 5_000;

let roadFeatures: SpatialRoadFeature[] = [];
let roadLoaded = false;
let roadCells = new Map<string, Set<SpatialRoadFeature>>();
let broadRoads: SpatialRoadFeature[] = [];
let roadBounds = new WeakMap<SpatialRoadFeature, SpatialBounds>();
let roadLoad: Promise<void> | null = null;
let buildingCacheBytes = 0;
let cacheGeneration = 0;
const buildingCache = new Map<string, TileEntry>();
const buildingRequests = new Map<string, Promise<SpatialBuildingFeature[]>>();
let regionalCacheBytes = 0;
const regionalCache = new Map<string, { features: SpatialRegionalFeature[]; bytes: number }>();
const regionalRequests = new Map<string, Promise<SpatialRegionalFeature[]>>();

function isPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && typeof value[0] === "number" && Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 && typeof value[1] === "number" && Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
}
function intersects(a: SpatialBounds, b: SpatialBounds) {
  return a.north >= b.south && a.south <= b.north && a.east >= b.west && a.west <= b.east;
}
function roadSize(feature: SpatialRoadFeature) { return feature.geometry.coordinates.length * 32 + 256; }
function buildingSize(feature: SpatialBuildingFeature) {
  let vertices = 0;
  for (const ring of feature.geometry.coordinates) vertices += ring.length;
  return vertices * 32 + 256;
}
function regionalFeatureBytes(feature: SpatialRegionalFeature) {
  let vertices = 0;
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") { vertices += 1; return; }
    for (const child of coordinates) visit(child);
  };
  visit(feature.geometry.coordinates);
  return vertices * 32 + feature.properties.kind.length * 2 + (feature.properties.name?.length ?? 0) * 2 + 320;
}
async function decode(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.ok) throw new Error("Map data request failed (" + response.status + ")");
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error("Map data exceeds the payload limit");
  // Fetch transparently decodes Content-Encoding: gzip. Only manually inflate
  // a .gz asset when the server served it as a raw gzip file.
  const rawGzipAsset = new URL(response.url).pathname.endsWith(".gz")
    && response.headers.get("content-encoding")?.toLowerCase() !== "gzip";
  const compressed = rawGzipAsset;
  if (compressed && typeof DecompressionStream === "undefined") throw new Error("Compressed map data is unsupported in this browser");
  if (!response.body) throw new Error("Map data response has no readable body");
  const stream = compressed ? response.body.pipeThrough(new DecompressionStream("gzip")) : response.body;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Expanded map data exceeds the payload limit");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
async function ensureRoadIndex() {
  if (roadLoaded) return;
  if (!roadLoad) {
    const generation = cacheGeneration;
    const load = (async () => {
    const url = new URL("/data/tirkha-nepal-roads.geojson.gz", worker.location.origin);
    let value = await getSpatialOfflineValue<unknown>("roads:national:v1", "roads");
    if (value === undefined) {
      try {
        value = await decode(await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(25_000) }), MAX_ROAD_JSON_BYTES);
        void putSpatialOfflineValue("roads:national:v1", "roads", value);
      } catch (networkError) {
        value = await getSpatialOfflineValue<unknown>("roads:national:v1", "roads", { allowExpired: true });
        if (value === undefined) throw networkError;
      }
    }
    if (!value || typeof value !== "object" || (value as {type?: unknown}).type !== "FeatureCollection") throw new Error("Road source is not a GeoJSON FeatureCollection");
    const raw = (value as {features?: unknown}).features;
    if (!Array.isArray(raw) || raw.length > MAX_ROAD_FEATURES) throw new Error("Road source exceeds the supported feature limit");
    const features: SpatialRoadFeature[] = [];
    const cells = new Map<string, Set<SpatialRoadFeature>>();
    const broad: SpatialRoadFeature[] = [];
    const boundsByFeature = new WeakMap<SpatialRoadFeature, SpatialBounds>();
    let vertexCount = 0;
    let byteCount = 0;
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const input = item as Partial<SpatialRoadFeature>;
      const coords = input.geometry?.type === "LineString" ? input.geometry.coordinates : null;
      if (!Array.isArray(coords) || coords.length < 2 || coords.length > 100_000 || !coords.every(isPair)) continue;
      vertexCount += coords.length;
      if (vertexCount > MAX_ROAD_VERTICES) throw new Error("Road source exceeds the coordinate limit");
      let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
      for (const point of coords) {
        const longitude = point[0], latitude = point[1];
        south = Math.min(south, latitude); west = Math.min(west, longitude);
        north = Math.max(north, latitude); east = Math.max(east, longitude);
      }
      const props = input.properties && typeof input.properties === "object" ? input.properties : {};
      const roadClass = ["expressway", "arterial", "connector", "local"].includes(String(props.class)) ? props.class : "local";
      const feature: SpatialRoadFeature = {
        type: "Feature",
        ...(typeof input.id === "string" || typeof input.id === "number" ? { id: String(input.id) } : {}),
        properties: { class: roadClass, ...(typeof props.name === "string" ? { name: props.name.slice(0, 160) } : {}), ...(typeof props.ref === "string" ? { ref: props.ref.slice(0, 80) } : {}) },
        geometry: { type: "LineString", coordinates: coords },
      };
      const box = { south, west, north, east };
      boundsByFeature.set(feature, box);
      byteCount += roadSize(feature);
      if (byteCount > MAX_ROAD_BYTES) throw new Error("Road source exceeds the worker cache budget");
      const minRow = Math.floor(south / CELL), maxRow = Math.floor(north / CELL);
      const minCol = Math.floor(west / CELL), maxCol = Math.floor(east / CELL);
      if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > 64) {
        // Long highways are checked separately, avoiding giant grid fan-out.
        broad.push(feature);
      } else {
        for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
          const key = row + ":" + col;
          let cell = cells.get(key);
          if (!cell) { cell = new Set(); cells.set(key, cell); }
          cell.add(feature);
        }
      }
      features.push(feature);
    }
    if (generation !== cacheGeneration) return;
    roadFeatures = features;
    roadLoaded = true;
    roadCells = cells;
    broadRoads = broad;
    roadBounds = boundsByFeature;
    })();
    let tracked: Promise<void>;
    tracked = load.finally(() => { if (roadLoad === tracked) roadLoad = null; });
    roadLoad = tracked;
  }
  await roadLoad;
}
function queryRoads(bounds: SpatialBounds): SpatialRoadFeature[] {
  const candidates = new Set<SpatialRoadFeature>(broadRoads);
  const minRow = Math.floor(bounds.south / CELL), maxRow = Math.floor(bounds.north / CELL);
  const minCol = Math.floor(bounds.west / CELL), maxCol = Math.floor(bounds.east / CELL);
  if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > MAX_QUERY_CELLS) {
    for (const feature of roadFeatures) {
      const box = roadBounds.get(feature);
      if (box && intersects(box, bounds)) candidates.add(feature);
    }
    return Array.from(candidates);
  }
  for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
    const set = roadCells.get(row + ":" + col);
    if (set) for (const feature of set) candidates.add(feature);
  }
  const result: SpatialRoadFeature[] = [];
  for (const feature of candidates) {
    const box = roadBounds.get(feature);
    if (box && intersects(box, bounds)) result.push(feature);
  }
  // Full-data fallback for unusually large geometry bounds; the feature cap
  // below keeps the returned viewport deterministic and bounded.
  return result;
}
function validateBuildings(value: unknown): SpatialBuildingFeature[] {
  if (!value || typeof value !== "object" || (value as {type?: unknown}).type !== "FeatureCollection") return [];
  const raw = (value as {features?: unknown}).features;
  if (!Array.isArray(raw) || raw.length > MAX_BUILDING_TILE_FEATURES) return [];
  const output: SpatialBuildingFeature[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const input = item as Partial<SpatialBuildingFeature>;
    const rings = input.geometry?.type === "Polygon" ? input.geometry.coordinates : null;
    if (!Array.isArray(rings) || !rings.length) continue;
    let valid = true, vertices = 0, south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
    for (let index = 0; index < rings.length; index++) {
      const ring = rings[index];
      if (!Array.isArray(ring) || ring.length < 4 || ring.length > 20_000 || (vertices += ring.length) > 20_000 || !ring.every(isPair)) { valid = false; break; }
      if (index === 0) for (const point of ring) {
        south = Math.min(south, point[1]); west = Math.min(west, point[0]);
        north = Math.max(north, point[1]); east = Math.max(east, point[0]);
      }
    }
    if (!valid || !Number.isFinite(south) || !Number.isFinite(west)) continue;
    const rawCenter = input.properties?.center;
    const center: [number, number] = Array.isArray(rawCenter) && Number.isFinite(rawCenter[0]) && Number.isFinite(rawCenter[1])
      ? [Number(rawCenter[0]), Number(rawCenter[1])]
      : [(south + north) / 2, (west + east) / 2];
    if (Math.abs(center[0]) > 90 || Math.abs(center[1]) > 180) continue;
    output.push({ type: "Feature", ...(typeof input.id === "string" || typeof input.id === "number" ? { id: String(input.id) } : {}), properties: { kind: typeof input.properties?.kind === "string" ? input.properties.kind.slice(0, 80) : "building", center, bounds: [south, west, north, east] }, geometry: { type: "Polygon", coordinates: rings } });
  }
  return output;
}
function validPosition(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
}
function validateGeometry(value: unknown): SpatialGeometry | null {
  if (!value || typeof value !== "object") return null;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  const coordinates = geometry.coordinates;
  if (geometry.type === "Point" && validPosition(coordinates)) return { type: "Point", coordinates };
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    if (Array.isArray(coordinates) && coordinates.length >= (geometry.type === "LineString" ? 2 : 1) && coordinates.length <= 100_000 && coordinates.every(validPosition)) {
      return { type: geometry.type, coordinates };
    }
    return null;
  }
  if (geometry.type === "Polygon" || geometry.type === "MultiLineString") {
    if (Array.isArray(coordinates) && coordinates.length > 0 && coordinates.length <= 1_000) {
      let vertices = 0;
      const valid = coordinates.every((line) => Array.isArray(line) && line.length >= (geometry.type === "Polygon" ? 4 : 2)
        && (vertices += line.length) <= 100_000 && line.every(validPosition));
      if (valid) return { type: geometry.type, coordinates };
    }
    return null;
  }
  if (geometry.type === "MultiPolygon") {
    if (Array.isArray(coordinates) && coordinates.length > 0 && coordinates.length <= 1_000) {
      let vertices = 0;
      const valid = coordinates.every((polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.length <= 1_000
        && polygon.every((ring) => Array.isArray(ring) && ring.length >= 4 && (vertices += ring.length) <= 100_000 && ring.every(validPosition)));
      if (valid) return { type: "MultiPolygon", coordinates };
    }
  }
  return null;
}
function parseRegionalFeatures(value: unknown, district: string, tier: DistrictLodTier): SpatialRegionalFeature[] {
  if (!Array.isArray(value) || value.length > MAX_REGIONAL_FEATURES) return [];
  const output: SpatialRegionalFeature[] = [];
  let bytes = 0;
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const input = row as { feature_id?: unknown; feature_kind?: unknown; lod_tier?: unknown; properties?: unknown; geometry?: unknown };
    if (typeof input.feature_id !== "string" || typeof input.feature_kind !== "string") continue;
    const geometry = validateGeometry(input.geometry);
    if (!geometry) continue;
    const properties = input.properties && typeof input.properties === "object" && !Array.isArray(input.properties)
      ? input.properties as Record<string, unknown> : {};
    const feature: SpatialRegionalFeature = {
      type: "Feature",
      id: input.feature_id,
      properties: {
        kind: input.feature_kind.slice(0, 80),
        district,
        lod: input.lod_tier === "macro" || input.lod_tier === "municipal" || input.lod_tier === "building" ? input.lod_tier : tier,
        ...(typeof properties.name === "string" ? { name: properties.name.slice(0, 160) } : {}),
        ...(typeof properties.ref === "string" ? { ref: properties.ref.slice(0, 80) } : {}),
      },
      geometry,
    };
    bytes += regionalFeatureBytes(feature);
    if (bytes > MAX_REGIONAL_RESPONSE_BYTES) return [];
    output.push(feature);
  }
  return output;
}
function regionalFeatureBounds(feature: SpatialRegionalFeature): SpatialBounds | null {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  const visit = (coordinates: unknown): void => {
    if (!Array.isArray(coordinates)) return;
    if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
      west = Math.min(west, coordinates[0]); east = Math.max(east, coordinates[0]);
      south = Math.min(south, coordinates[1]); north = Math.max(north, coordinates[1]);
      return;
    }
    for (const child of coordinates) visit(child);
  };
  visit(feature.geometry.coordinates);
  return Number.isFinite(south) && Number.isFinite(west) ? { south, west, north, east } : null;
}
function cacheRegionalFeatures(key: string, features: SpatialRegionalFeature[]) {
  let bytes = 0;
  for (const feature of features) bytes += regionalFeatureBytes(feature);
  if (!features.length || bytes > MAX_REGIONAL_CACHE_BYTES) return;
  const previous = regionalCache.get(key);
  if (previous) regionalCacheBytes -= previous.bytes;
  regionalCache.delete(key);
  regionalCache.set(key, { features, bytes });
  regionalCacheBytes += bytes;
  while (regionalCache.size > MAX_REGIONAL_CACHE_ENTRIES || regionalCacheBytes > MAX_REGIONAL_CACHE_BYTES) {
    const oldest = regionalCache.keys().next().value;
    if (oldest === undefined) break;
    regionalCacheBytes -= regionalCache.get(oldest)?.bytes ?? 0;
    regionalCache.delete(oldest);
  }
}
async function loadRegionalFeatures(query: SpatialViewportQuery, limit: number): Promise<SpatialRegionalFeature[]> {
  const district = query.region;
  const tier = getDistrictLodTier(query.zoom);
  const supabase = query.supabase;
  if (!district || !isDistrictKey(district) || !tier || !supabase || limit < 1
    || !Number.isFinite(limit)) return [];
  if (!getDistrictsIntersectingViewport(query.bounds).some(candidate => candidate.key === district)) return [];
  const projectUrl = new URL(supabase.url);
  if ((projectUrl.protocol !== "https:" && projectUrl.hostname !== "localhost") || !supabase.anonKey || supabase.anonKey.length > 4096) return [];
  let requestBounds = query.bounds;
  let cacheKey: string;
  if (tier === "building") {
    const tileKeys = getDistrictTileKeys(district, query.bounds);
    if (!tileKeys.length) return [];
    const tileBounds = tileKeys.map((key) => getDistrictTileBounds(district, key)).filter((bounds): bounds is SpatialBounds => bounds !== null);
    if (!tileBounds.length) return [];
    requestBounds = tileBounds.reduce<SpatialBounds>((bounds, tile) => ({
      south: Math.min(bounds.south, tile.south), west: Math.min(bounds.west, tile.west),
      north: Math.max(bounds.north, tile.north), east: Math.max(bounds.east, tile.east),
    }), { ...tileBounds[0] });
    cacheKey = `${district}:${tier}:${tileKeys.join(",")}`;
  } else {
    // Quantized bounds improve repeat visits while keeping each cached response
    // bounded to a small viewport neighborhood.
    const south = Math.floor(query.bounds.south * 100) / 100;
    const west = Math.floor(query.bounds.west * 100) / 100;
    const north = Math.ceil(query.bounds.north * 100) / 100;
    const east = Math.ceil(query.bounds.east * 100) / 100;
    requestBounds = { south, west, north, east };
    cacheKey = [district, tier, south.toFixed(2), west.toFixed(2), north.toFixed(2), east.toFixed(2)].join(":");
  }
  const cached = regionalCache.get(cacheKey);
  if (cached) {
    regionalCache.delete(cacheKey); regionalCache.set(cacheKey, cached);
    return cached.features.filter((feature) => {
      const bounds = regionalFeatureBounds(feature);
      return bounds !== null && intersects(bounds, query.bounds);
    });
  }
  const offlineKey = `regional:${cacheKey}:v1`;
  const offlineFeatures = await getSpatialOfflineValue<unknown>(offlineKey, "regional");
  if (Array.isArray(offlineFeatures)) {
    const valid = validateCachedRegionalFeatures(offlineFeatures, district, tier);
    if (valid.length) {
      cacheRegionalFeatures(cacheKey, valid);
      return valid.filter((feature) => {
        const bounds = regionalFeatureBounds(feature);
        return bounds !== null && intersects(bounds, query.bounds);
      });
    }
  }
  let request = regionalRequests.get(cacheKey);
  if (!request) {
    request = (async () => {
      const response = await fetch(new URL("/rest/v1/rpc/get_spatial_features_for_viewport", projectUrl), {
        method: "POST",
        headers: { apikey: supabase.anonKey, Authorization: `Bearer ${supabase.anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_district_key: district,
          p_west: requestBounds.west,
          p_south: requestBounds.south,
          p_east: requestBounds.east,
          p_north: requestBounds.north,
          p_zoom: query.zoom,
          p_limit: Math.max(1, Math.min(MAX_REGIONAL_FEATURES, Math.trunc(limit))),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const rows = await decode(response, MAX_REGIONAL_RESPONSE_BYTES);
      return parseRegionalFeatures(rows, district, tier);
    })();
    regionalRequests.set(cacheKey, request);
  }
  try {
    const features = await request;
    cacheRegionalFeatures(cacheKey, features);
    void putSpatialOfflineValue(offlineKey, "regional", features);
    return features.filter((feature) => {
      const bounds = regionalFeatureBounds(feature);
      return bounds !== null && intersects(bounds, query.bounds);
    });
  } catch (networkError) {
    const stale = await getSpatialOfflineValue<unknown>(offlineKey, "regional", { allowExpired: true });
    if (Array.isArray(stale)) {
      const valid = validateCachedRegionalFeatures(stale, district, tier);
      if (valid.length) {
        cacheRegionalFeatures(cacheKey, valid);
        return valid.filter((feature) => {
          const bounds = regionalFeatureBounds(feature);
          return bounds !== null && intersects(bounds, query.bounds);
        });
      }
    }
    throw networkError;
  } finally {
    if (regionalRequests.get(cacheKey) === request) regionalRequests.delete(cacheKey);
  }
}
function validateCachedRegionalFeatures(value: unknown[], district: string, tier: DistrictLodTier): SpatialRegionalFeature[] {
  if (value.length > MAX_REGIONAL_FEATURES) return [];
  const output: SpatialRegionalFeature[] = [];
  let bytes = 0;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const feature = item as Partial<SpatialRegionalFeature>;
    const geometry = validateGeometry(feature.geometry);
    const properties = feature.properties;
    if (feature.type !== "Feature" || (typeof feature.id !== "string" && typeof feature.id !== "number") || !geometry || !properties || typeof properties !== "object" || typeof properties.kind !== "string") continue;
    const normalized: SpatialRegionalFeature = {
      type: "Feature",
      id: String(feature.id).slice(0, 160),
      properties: {
        kind: properties.kind.slice(0, 80), district,
        lod: properties.lod === "macro" || properties.lod === "municipal" || properties.lod === "building" ? properties.lod : tier,
        ...(typeof properties.name === "string" ? { name: properties.name.slice(0, 160) } : {}),
        ...(typeof properties.ref === "string" ? { ref: properties.ref.slice(0, 80) } : {}),
      },
      geometry,
    };
    bytes += regionalFeatureBytes(normalized);
    if (bytes > MAX_REGIONAL_RESPONSE_BYTES) return [];
    output.push(normalized);
  }
  return output;
}
function makeTiles(bounds: SpatialBounds, region: string | null) {
  // Only request building packs shipped with this version. Other regions keep
  // their curated map base until their district data has been added.
  if (!region || isDistrictKey(region) || !["kathmandu", "lalitpur", "bhaktapur", "kirtipur", "pokhara"].includes(region)) return [];
  const output: string[] = [];
  for (let lat = Math.floor(bounds.south * 100); lat <= Math.floor(bounds.north * 100); lat++) {
    for (let lon = Math.floor(bounds.west * 100); lon <= Math.floor(bounds.east * 100); lon++) {
      output.push(lat + "_" + lon);
      if (output.length > MAX_TILE_REQUESTS) return [];
    }
  }
  return output;
}
const MAX_TILE_REQUESTS = 32;
function tileSource(region: string, tile: string) {
  if (region !== "kirtipur") return region;
  return Number(tile.split("_")[0]) < 2767 ? "lalitpur" : "kathmandu";
}
async function loadTile(region: string, tile: string): Promise<SpatialBuildingFeature[]> {
  const source = tileSource(region, tile);
  const key = source + ":" + tile;
  const hit = buildingCache.get(key);
  if (hit) { buildingCache.delete(key); buildingCache.set(key, hit); return hit.features; }
  const generation = cacheGeneration;
  let request = buildingRequests.get(key);
  if (!request) {
    request = (async () => {
      const offlineKey = `building:${source}:${tile}:v1`;
      const cached = await getSpatialOfflineValue<unknown>(offlineKey, "tile");
      if (cached !== undefined) return validateBuildings(cached);
      try {
        const response = await fetch(new URL("/data/buildings/" + source + "/" + tile + ".geojson.gz", worker.location.origin), { cache: "force-cache", signal: AbortSignal.timeout(15_000) });
        const value = await decode(response, MAX_BUILDING_TILE_JSON_BYTES);
        const features = validateBuildings(value);
        if (features.length) void putSpatialOfflineValue(offlineKey, "tile", value);
        return features;
      } catch (networkError) {
        const stale = await getSpatialOfflineValue<unknown>(offlineKey, "tile", { allowExpired: true });
        if (stale === undefined) throw networkError;
        return validateBuildings(stale);
      }
    })();
    buildingRequests.set(key, request);
  }
  try {
    const features = await request;
    let bytes = 0;
    for (const feature of features) bytes += buildingSize(feature);
    if (generation === cacheGeneration && features.length && bytes <= MAX_BUILDING_CACHE_BYTES) {
      const previous = buildingCache.get(key);
      if (previous) buildingCacheBytes -= previous.bytes;
      buildingCache.delete(key);
      buildingCache.set(key, { features, bytes }); buildingCacheBytes += bytes;
      while (buildingCache.size > MAX_CACHE_TILES || buildingCacheBytes > MAX_BUILDING_CACHE_BYTES) {
        const first = buildingCache.keys().next().value;
        if (first === undefined) break;
        buildingCacheBytes -= buildingCache.get(first)?.bytes ?? 0;
        buildingCache.delete(first);
      }
    }
    return features;
  } finally {
    if (buildingRequests.get(key) === request) buildingRequests.delete(key);
  }
}
function createLabelPlacements(features: SpatialRoadFeature[], query: SpatialViewportQuery) {
  const output: SpatialViewportResult["labels"] = Object.create(null) as SpatialViewportResult["labels"];
  if (query.zoom < 11.5 || query.size.x <= 0 || query.size.y <= 0) return output;
  const fontSize = Math.min(15, Math.max(9.5, 9.5 + (query.zoom - 15.5) * 0.48));
  const world = 256 * 2 ** query.zoom;
  const project = (lat: number, lon: number) => {
    const radians = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
    const sine = Math.sin(radians);
    return { x: (lon + 180) / 360 * world - query.pixelOrigin.x, y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * world - query.pixelOrigin.y };
  };
  const items: { feature: SpatialRoadFeature; key: string; name: string; points: { x: number; y: number }[]; positions: [number, number][]; segmentLengths: number[]; length: number; visible: number[]; priority: number }[] = [];
  for (const feature of features) {
    const name = feature.properties?.name || feature.properties?.ref;
    const kind = feature.properties?.class;
    const minZoom = kind === "expressway" ? 11.5 : kind === "arterial" ? 12.5 : kind === "connector" ? 13.5 : 14;
    if (!name || query.zoom < minZoom || feature.geometry.coordinates.length < 2) continue;
    const positions = feature.displayPositions ?? feature.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
    const points = positions.map(([lat, lon]) => project(lat, lon));
    if (points[points.length - 1].x < points[0].x || (Math.abs(points[points.length - 1].x - points[0].x) < 4 && points[points.length - 1].y < points[0].y)) { points.reverse(); positions.reverse(); }
    let length = 0; const segmentLengths: number[] = [];
    for (let i = 1; i < points.length; i++) { const dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y; const segment = Math.hypot(dx, dy); segmentLengths.push(segment); length += segment; }
    if (!length) continue;
    let travelled = 0; const visible: number[] = [];
    for (let i = 0; i < segmentLengths.length; i++) {
      const start = points[i], end = points[i + 1], dx = end.x - start.x, dy = end.y - start.y;
      let low = 0, high = 1;
      const edges: [number, number][] = [[-dx, start.x], [dx, query.size.x - start.x], [-dy, start.y], [dy, query.size.y - start.y]];
      let valid = true;
      for (const [p, q] of edges) {
        if (Math.abs(p) < 1e-8) { if (q < 0) { valid = false; break; } continue; }
        const ratio = q / p;
        if (p < 0) low = Math.max(low, ratio); else high = Math.min(high, ratio);
        if (low > high) { valid = false; break; }
      }
      if (valid) visible.push((travelled + segmentLengths[i] * (low + high) / 2) / length * 100);
      travelled += segmentLengths[i];
    }
    if (!visible.length) continue;
    visible.sort((a, b) => Math.abs(a - 50) - Math.abs(b - 50));
    const coordinates = feature.geometry.coordinates;
    const labelName = feature.properties?.name || feature.properties?.ref || "road";
    const key = feature.id !== undefined ? "osm-" + feature.id : labelName + ":" + (coordinates[0]?.join(",") ?? "") + ":" + (coordinates[coordinates.length - 1]?.join(",") ?? "");
    items.push({ feature, key, name, points, positions, segmentLengths, length, visible: visible.slice(0, 8), priority: kind === "expressway" ? 0 : kind === "arterial" ? 1 : kind === "connector" ? 2 : 3 });
  }
  items.sort((a, b) => a.priority - b.priority || b.length - a.length);
  const cellSize = 96;
  const occupied = new Map<string, { left: number; right: number; top: number; bottom: number }[]>();
  const cellsFor = (box: { left: number; right: number; top: number; bottom: number }) => {
    const cells: string[] = [];
    for (let x = Math.floor(box.left / cellSize); x <= Math.floor(box.right / cellSize); x++) for (let y = Math.floor(box.top / cellSize); y <= Math.floor(box.bottom / cellSize); y++) cells.push(x + ":" + y);
    return cells;
  };
  for (const item of items) {
    const candidates = [50, 36, 64, 22, 78, 10, 90, 5, 95, ...item.visible];
    const offsets = [...new Set(candidates)];
    let best: { startOffset: number; scale: number; box: { left: number; right: number; top: number; bottom: number }; collisions: number } | null = null;
    for (const scale of [1, 0.9, 0.8, 0.7, 0.62]) {
      const width = item.name.length * fontSize * 0.62 * scale + 4;
      for (const startOffset of offsets) {
        let distance = item.length * startOffset / 100;
        let anchor = item.points[0], angle = 0;
        for (let i = 1; i < item.points.length; i++) {
          const segment = item.segmentLengths[i - 1];
          if (distance <= segment) {
            const ratio = segment ? distance / segment : 0;
            const previous = item.points[i - 1], current = item.points[i];
            anchor = { x: previous.x + (current.x - previous.x) * ratio, y: previous.y + (current.y - previous.y) * ratio };
            angle = Math.atan2(current.y - previous.y, current.x - previous.x);
            break;
          }
          distance -= segment;
        }
        if (anchor.x < 0 || anchor.x > query.size.x || anchor.y < 0 || anchor.y > query.size.y) continue;
        const height = fontSize * scale * 1.35 + 3;
        const boxWidth = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle));
        const boxHeight = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
        const box = { left: anchor.x - boxWidth / 2, right: anchor.x + boxWidth / 2, top: anchor.y - boxHeight / 2, bottom: anchor.y + boxHeight / 2 };
        const collisionCandidates = new Set(cellsFor(box).flatMap(cell => occupied.get(cell) ?? []));
        let collisions = 0;
        for (const other of collisionCandidates) if (box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top) collisions++;
        if (!best || collisions < best.collisions) best = { startOffset, scale, box, collisions };
        if (collisions === 0) break;
      }
      if (best?.collisions === 0) break;
    }
    if (!best) continue;
    output[item.key] = { startOffset: best.startOffset, scale: best.scale };
    for (const cell of cellsFor(best.box)) {
      const bucket = occupied.get(cell);
      if (bucket) bucket.push(best.box); else occupied.set(cell, [best.box]);
    }
  }
  return output;
}

async function query(query: SpatialViewportQuery): Promise<SpatialViewportResult> {
  const bounds = query.bounds;
  try { await ensureRoadIndex(); } catch {
    // A missing national road extract must not prevent a district's independent
    // PostGIS LOD response or the UI's curated vector fallback from rendering.
  }
  const lodTier = getDistrictLodTier(query.zoom);
  let candidates = queryRoads(bounds);
  if (lodTier === "macro") candidates = candidates.filter(feature => feature.properties?.class === "expressway" || feature.properties?.class === "arterial");
  candidates.sort((a, b) => {
    const priority = (kind?: string) => kind === "expressway" ? 0 : kind === "arterial" ? 1 : kind === "connector" ? 2 : 3;
    return priority(a.properties?.class) - priority(b.properties?.class);
  });
  const selectedRoads: SpatialRoadFeature[] = [];
  let featureCount = 0, estimatedBytes = 0, truncated = false;
  for (const feature of candidates) {
    const named = feature.properties?.name || feature.properties?.ref;
    const labelMinZoom = feature.properties?.class === "expressway" ? 11.5 : feature.properties?.class === "arterial" ? 12.5 : feature.properties?.class === "connector" ? 13.5 : 14;
    const displayPositions = named && query.zoom >= labelMinZoom
      ? feature.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
      : undefined;
    const bytes = roadSize(feature) + (displayPositions?.length ?? 0) * 16;
    if (featureCount >= MAX_FEATURES || estimatedBytes + bytes > MAX_ACTIVE_BYTES) { truncated = true; break; }
    selectedRoads.push(displayPositions ? { ...feature, displayPositions } : feature); featureCount++; estimatedBytes += bytes;
  }
  const region = query.region;
  const tiles = query.zoom >= 17.5 ? makeTiles(bounds, region) : [];
  const selectedBuildings: SpatialBuildingFeature[] = [];
  const seen = new Set<SpatialBuildingFeature>();
  if (region) for (let offset = 0; offset < tiles.length; offset += 4) {
    // Keep tile retrieval parallel enough for responsive detail loading while
    // bounding network concurrency on low-memory phones and free-tier hosting.
    const batch = tiles.slice(offset, offset + 4);
    const collections = await Promise.all(batch.map(tile => loadTile(region, tile).catch(() => [])));
    for (const collection of collections) {
      for (const feature of collection) {
        const box = feature.properties?.bounds;
        if (!box || !intersects({ south: box[0], west: box[1], north: box[2], east: box[3] }, bounds) || seen.has(feature)) continue;
        seen.add(feature);
        const bytes = buildingSize(feature);
        if (featureCount >= MAX_FEATURES || estimatedBytes + bytes > MAX_ACTIVE_BYTES) { truncated = true; break; }
        selectedBuildings.push(feature); featureCount++; estimatedBytes += bytes;
      }
      if (truncated) break;
    }
    if (truncated) break;
  }
  const regionalFeatures = region && isDistrictKey(region) && lodTier
    ? await loadRegionalFeatures(query, Math.min(MAX_REGIONAL_FEATURES, MAX_FEATURES - featureCount)).catch(() => [])
    : [];
  const activeRegionalFeatures: SpatialRegionalFeature[] = [];
  for (const feature of regionalFeatures) {
    const bytes = regionalFeatureBytes(feature);
    if (featureCount >= MAX_FEATURES || estimatedBytes + bytes > MAX_ACTIVE_BYTES) { truncated = true; break; }
    activeRegionalFeatures.push(feature);
    featureCount++;
    estimatedBytes += bytes;
  }
  return { roads: { type: "FeatureCollection", features: selectedRoads }, buildings: { type: "FeatureCollection", features: selectedBuildings }, regionalFeatures: activeRegionalFeatures, labels: createLabelPlacements(selectedRoads, query), lodTier, activeFeatureCount: featureCount, estimatedActiveBytes: estimatedBytes, truncated };
}
function reset() {
  cacheGeneration++;
  roadFeatures = []; roadLoaded = false; roadCells.clear(); broadRoads = []; roadBounds = new WeakMap(); roadLoad = null;
  buildingCache.clear(); buildingRequests.clear(); buildingCacheBytes = 0;
  regionalCache.clear(); regionalRequests.clear(); regionalCacheBytes = 0;
}
function isViewportQuery(value: unknown): value is SpatialViewportQuery {
  if (!value || typeof value !== "object") return false;
  const query = value as Partial<SpatialViewportQuery>;
  const bounds = query.bounds;
  const center = query.center;
  const origin = query.pixelOrigin;
  const size = query.size;
  const allowedRegions = [null, "kathmandu", "lalitpur", "bhaktapur", "kirtipur", "pokhara", "chitwan", "jhapa", "sunsari"];
  return !!bounds && [bounds.south, bounds.west, bounds.north, bounds.east].every(Number.isFinite)
    && bounds.south >= -85.1 && bounds.north <= 85.1 && bounds.south < bounds.north
    && bounds.west >= -180 && bounds.east <= 180 && bounds.west < bounds.east
    && !!center && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1])
    && Math.abs(center[0]) <= 90 && Math.abs(center[1]) <= 180
    && allowedRegions.includes(query.region ?? null)
    && Number.isFinite(query.zoom) && query.zoom! >= 5 && query.zoom! <= 28
    && !!origin && Number.isFinite(origin.x) && Number.isFinite(origin.y) && Math.abs(origin.x) <= 1e12 && Math.abs(origin.y) <= 1e12
    && !!size && Number.isFinite(size.x) && Number.isFinite(size.y) && size.x > 0 && size.y > 0 && size.x <= 10_000 && size.y <= 10_000;
}
worker.addEventListener("message", (event: MessageEvent<SpatialWorkerRequest>) => {
  const incoming: unknown = event.data;
  if (!incoming || typeof incoming !== "object") return;
  const message = incoming as Partial<SpatialWorkerRequest>;
  const id = message.id;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || message.type !== "query") return;
  if (!isViewportQuery(message.query)) {
    worker.postMessage({ id, ok: false, error: "Invalid map viewport request" } satisfies SpatialWorkerResponse);
    return;
  }
  void query(message.query).then(result => worker.postMessage({ id, ok: true, result } satisfies SpatialWorkerResponse)).catch(error => {
    reset();
    worker.postMessage({ id, ok: false, error: error instanceof Error ? error.message : "Spatial data could not be loaded" } satisfies SpatialWorkerResponse);
  });
});

export {};
