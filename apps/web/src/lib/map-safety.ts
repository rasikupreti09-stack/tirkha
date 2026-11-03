import type { Coordinates } from "@tirkha/shared";
import { NEPAL_BOUNDS } from "./districtBounds";

const OPERATIONAL_REGION_BOUNDS: Record<string, { south: number; west: number; north: number; east: number }> = {
  "Kathmandu Valley": { south: 27.625, west: 85.245, north: 27.755, east: 85.465 },
  Pokhara: { south: 28.175, west: 83.940, north: 28.255, east: 84.035 },
  Hetauda: { south: 27.350, west: 84.970, north: 27.500, east: 85.120 },
  Simara: { south: 27.120, west: 84.910, north: 27.240, east: 85.080 },
};

/** Numeric safety envelope for GPS and map API data (not a legal border polygon). */
export function isNepalCoordinate(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<Coordinates>;
  return typeof point.latitude === "number" && Number.isFinite(point.latitude)
    && typeof point.longitude === "number" && Number.isFinite(point.longitude)
    && point.latitude >= NEPAL_BOUNDS.south && point.latitude <= NEPAL_BOUNDS.north
    && point.longitude >= NEPAL_BOUNDS.west && point.longitude <= NEPAL_BOUNDS.east;
}

/** Keep Hero availability aligned with the server-enforced operational zone. */
export function isCoordinateInOperationalRegion(value: unknown, region: string | null | undefined): value is Coordinates {
  if (!isNepalCoordinate(value) || !region) return false;
  const bounds = OPERATIONAL_REGION_BOUNDS[region];
  return !!bounds && value.latitude >= bounds.south && value.latitude <= bounds.north
    && value.longitude >= bounds.west && value.longitude <= bounds.east;
}

/** Rejects malformed, stale, or implausibly future-dated location pings. */
export function isFreshMapTimestamp(value: unknown, now = Date.now(), maxAgeMs = 90_000): value is string {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now + 30_000 && now - timestamp <= maxAgeMs;
}

/**
 * A local tracking camera envelope around its participants. Bounds are clipped
 * to the Nepal safety envelope so a malformed route cannot pull a tracking map
 * across borders or let users drag it into an unrelated part of the world.
 */
export function getTrackingBounds(points: readonly Coordinates[], paddingDegrees = 0.12): [[number, number], [number, number]] {
  const validPoints = points.filter(isNepalCoordinate);
  const fallback = validPoints.length ? validPoints : [{ latitude: 27.7172, longitude: 85.324 }];
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const point of fallback) {
    south = Math.min(south, point.latitude);
    west = Math.min(west, point.longitude);
    north = Math.max(north, point.latitude);
    east = Math.max(east, point.longitude);
  }
  return [
    [Math.max(NEPAL_BOUNDS.south, south - paddingDegrees), Math.max(NEPAL_BOUNDS.west, west - paddingDegrees)],
    [Math.min(NEPAL_BOUNDS.north, north + paddingDegrees), Math.min(NEPAL_BOUNDS.east, east + paddingDegrees)],
  ];
}
