/**
 * Conservative district extent router for Tirkha's east/central Nepal data.
 * Extents are the WGS84 bounding boxes published by ICIMOD's Nepal District
 * Feature Layer (source: https://geoapps.icimod.org/arcgis/rest/services/Nepal/NepalAdmin/MapServer/2).
 * The boxes are a fast request gate, not legal district boundaries. Exact
 * clipping/intersection is enforced against the imported PostGIS boundary.
 */
export type DistrictKey = "chitwan" | "jhapa" | "sunsari";
export type DistrictLodTier = "macro" | "municipal" | "building";
export type DistrictBounds = { south: number; west: number; north: number; east: number };
export type DistrictPoint = { latitude: number; longitude: number };

export type DistrictDefinition = {
  /** Stable routing key shared by the UI, worker protocol and PostGIS RPC. */
  key: DistrictKey;
  name: string;
  description: string;
  /** Midpoint of the district bounding box; used only for initial camera focus. */
  center: DistrictPoint;
  /** Initial overview zoom used by the district picker. */
  zoom: 12;
  bounds: DistrictBounds;
};

export const DISTRICT_DATA_ZOOM_MIN = 8;
export const DISTRICT_DATA_ZOOM_MAX = 28;
export const DISTRICT_TILE_DEGREES = 0.01;
export const DISTRICT_MAX_TILES_PER_VIEW = 32;

export const DISTRICTS: readonly DistrictDefinition[] = [
  {
    key: "chitwan",
    name: "Chitwan",
    description: "Bharatpur, Ratnanagar and nearby towns",
    center: { latitude: 27.6177706875, longitude: 84.3576014411 },
    zoom: 12,
    bounds: { south: 27.3550205807, west: 83.9186529938, north: 27.8805207943, east: 84.7965498883 },
  },
  {
    key: "jhapa",
    name: "Jhapa",
    description: "Birtamod, Damak and the eastern corridor",
    center: { latitude: 26.5835578295, longitude: 87.9117197165 },
    zoom: 12,
    bounds: { south: 26.3611635576, west: 87.6355827303, north: 26.8059521014, east: 88.1878567027 },
  },
  {
    key: "sunsari",
    name: "Sunsari",
    description: "Dharan, Itahari and surrounding communities",
    center: { latitude: 26.6410162093, longitude: 87.1288586950 },
    zoom: 12,
    bounds: { south: 26.4032533752, west: 86.9039041360, north: 26.8787790433, east: 87.3538132541 },
  },
] as const;

export function isDistrictKey(value: unknown): value is DistrictKey {
  return value === "chitwan" || value === "jhapa" || value === "sunsari";
}

/** z8–13: macro boundaries/highways; z14–17: municipal/ward network; z18–28: buildings/local geometry. */
export function getDistrictLodTier(zoom: number): DistrictLodTier | null {
  if (!Number.isFinite(zoom) || zoom < DISTRICT_DATA_ZOOM_MIN || zoom > DISTRICT_DATA_ZOOM_MAX) return null;
  if (zoom < 14) return "macro";
  if (zoom < 18) return "municipal";
  return "building";
}

export function districtBoundsIntersect(a: DistrictBounds, b: DistrictBounds): boolean {
  return Number.isFinite(a.south) && Number.isFinite(a.west)
    && Number.isFinite(a.north) && Number.isFinite(a.east)
    && Number.isFinite(b.south) && Number.isFinite(b.west)
    && Number.isFinite(b.north) && Number.isFinite(b.east)
    && a.south <= a.north && a.west <= a.east
    && b.south <= b.north && b.west <= b.east
    && a.north >= b.south && a.south <= b.north
    && a.east >= b.west && a.west <= b.east;
}

/** Returns candidate districts for a viewport; PostGIS performs exact polygon tests afterward. */
export function getDistrictsIntersectingViewport(viewport: DistrictBounds): DistrictDefinition[] {
  return DISTRICTS.filter((district) => districtBoundsIntersect(viewport, district.bounds));
}

/** Returns a candidate district only when the point lies within its published extent. */
export function getDistrictAtPoint(point: DistrictPoint): DistrictDefinition | null {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return null;
  return DISTRICTS.find(({ bounds }) => point.latitude >= bounds.south && point.latitude <= bounds.north
    && point.longitude >= bounds.west && point.longitude <= bounds.east) ?? null;
}

/**
 * Produces bounded 0.01-degree on-demand tile keys, clipped to the district
 * extent. Returns no keys outside supported districts or when the viewport
 * would fan out into an unsafe number of requests.
 */
export function getDistrictTileKeys(
  districtKey: DistrictKey,
  viewport: DistrictBounds,
  maxTiles = DISTRICT_MAX_TILES_PER_VIEW,
): string[] {
  const district = DISTRICTS.find((candidate) => candidate.key === districtKey);
  if (!district || !Number.isSafeInteger(maxTiles) || maxTiles < 1
    || !districtBoundsIntersect(viewport, district.bounds)) return [];

  const south = Math.max(viewport.south, district.bounds.south);
  const west = Math.max(viewport.west, district.bounds.west);
  const north = Math.min(viewport.north, district.bounds.north);
  const east = Math.min(viewport.east, district.bounds.east);
  const minLat = Math.floor(south / DISTRICT_TILE_DEGREES);
  const maxLat = Math.floor(north / DISTRICT_TILE_DEGREES);
  const minLon = Math.floor(west / DISTRICT_TILE_DEGREES);
  const maxLon = Math.floor(east / DISTRICT_TILE_DEGREES);
  const tileCount = (maxLat - minLat + 1) * (maxLon - minLon + 1);
  if (!Number.isSafeInteger(tileCount) || tileCount <= 0 || tileCount > maxTiles) return [];

  const keys: string[] = [];
  for (let latitude = minLat; latitude <= maxLat; latitude += 1) {
    for (let longitude = minLon; longitude <= maxLon; longitude += 1) keys.push(`${latitude}_${longitude}`);
  }
  return keys;
}

/** Returns the WGS84 extent of a generated district tile key, clipped to the district gate. */
export function getDistrictTileBounds(districtKey: DistrictKey, tileKey: string): DistrictBounds | null {
  const district = DISTRICTS.find((candidate) => candidate.key === districtKey);
  const match = /^(-?\d+)_(-?\d+)$/.exec(tileKey);
  if (!district || !match) return null;
  const latitudeIndex = Number(match[1]);
  const longitudeIndex = Number(match[2]);
  if (!Number.isSafeInteger(latitudeIndex) || !Number.isSafeInteger(longitudeIndex)) return null;
  const bounds = {
    south: Math.max(latitudeIndex * DISTRICT_TILE_DEGREES, district.bounds.south),
    west: Math.max(longitudeIndex * DISTRICT_TILE_DEGREES, district.bounds.west),
    north: Math.min((latitudeIndex + 1) * DISTRICT_TILE_DEGREES, district.bounds.north),
    east: Math.min((longitudeIndex + 1) * DISTRICT_TILE_DEGREES, district.bounds.east),
  };
  return bounds.south < bounds.north && bounds.west < bounds.east ? bounds : null;
}
