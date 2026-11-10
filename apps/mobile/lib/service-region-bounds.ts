export type ServiceRegionBounds = Readonly<{
  south: number;
  west: number;
  north: number;
  east: number;
}>;

export type ServiceRegionCoordinate = Readonly<{
  latitude: number;
  longitude: number;
}>;

/** Operational map extents, not legal or administrative boundary data. */
export const SERVICE_REGION_BOUNDS: Readonly<Record<string, ServiceRegionBounds>> = {
  "Kathmandu Valley": { south: 27.55, west: 85.17, north: 27.85, east: 85.57 },
  Kathmandu: { south: 27.64, west: 85.25, north: 27.79, east: 85.43 },
  Lalitpur: { south: 27.57, west: 85.27, north: 27.70, east: 85.38 },
  Bhaktapur: { south: 27.62, west: 85.38, north: 27.75, east: 85.51 },
  Kirtipur: { south: 27.63, west: 85.23, north: 27.70, east: 85.31 },
  Pokhara: { south: 28.10, west: 83.90, north: 28.30, east: 84.05 },
  Hetauda: { south: 27.35, west: 84.95, north: 27.55, east: 85.15 },
  Makwanpur: { south: 27.10, west: 84.65, north: 27.75, east: 85.40 },
  "Simara / Birgunj / Pathlaiya": { south: 26.75, west: 84.55, north: 27.30, east: 85.32 },
  "Bara/Parsa Corridor": { south: 26.75, west: 84.55, north: 27.30, east: 85.32 },
  Jhapa: { south: 26.30, west: 87.55, north: 26.75, east: 88.20 },
  Chitwan: { south: 27.50, west: 84.25, north: 27.83, east: 84.65 },
  Sunsari: { south: 26.58, west: 87.18, north: 26.91, east: 87.40 },
};

export const SERVICE_REGION_CENTERS: Readonly<Record<string, ServiceRegionCoordinate>> = {
  "Kathmandu Valley": { latitude: 27.7172, longitude: 85.324 },
  Kathmandu: { latitude: 27.7172, longitude: 85.324 },
  Lalitpur: { latitude: 27.6588, longitude: 85.3247 },
  Bhaktapur: { latitude: 27.671, longitude: 85.4298 },
  Kirtipur: { latitude: 27.678, longitude: 85.277 },
  Pokhara: { latitude: 28.2096, longitude: 83.9856 },
  Hetauda: { latitude: 27.4287, longitude: 85.0322 },
  Makwanpur: { latitude: 27.43, longitude: 85.02 },
  "Simara / Birgunj / Pathlaiya": { latitude: 27.02, longitude: 84.93 },
  "Bara/Parsa Corridor": { latitude: 27.02, longitude: 84.93 },
  Jhapa: { latitude: 26.64, longitude: 87.99 },
  Chitwan: { latitude: 27.68, longitude: 84.43 },
  Sunsari: { latitude: 26.67, longitude: 87.28 },
};

const REGION_ALIASES: readonly (readonly [string, string])[] = [
  ["simara birgunj pathlaiya", "Simara / Birgunj / Pathlaiya"],
  ["simara birgunj", "Simara / Birgunj / Pathlaiya"],
  ["bara parsa corridor", "Simara / Birgunj / Pathlaiya"],
  ["pathlaiya", "Simara / Birgunj / Pathlaiya"],
  ["dumarwana", "Simara / Birgunj / Pathlaiya"],
  ["jeetpur", "Simara / Birgunj / Pathlaiya"],
  ["birgunj", "Simara / Birgunj / Pathlaiya"],
  ["simara", "Simara / Birgunj / Pathlaiya"],
  ["makwanpur district", "Makwanpur"],
  ["hetauda", "Hetauda"],
  ["makwanpur", "Makwanpur"],
  ["jhapa district", "Jhapa"],
  ["birtamod", "Jhapa"],
  ["damak", "Jhapa"],
  ["jhapa", "Jhapa"],
  ["bharatpur", "Chitwan"],
  ["narayangarh", "Chitwan"],
  ["chitwan district", "Chitwan"],
  ["chitwan", "Chitwan"],
  ["sunsari district", "Sunsari"],
  ["itahari", "Sunsari"],
  ["dharan", "Sunsari"],
  ["sunsari", "Sunsari"],
  ["kathmandu valley", "Kathmandu Valley"],
  ["bhaktapur", "Bhaktapur"],
  ["lalitpur", "Lalitpur"],
  ["kirtipur", "Kirtipur"],
  ["kathmandu", "Kathmandu"],
  ["pokhara", "Pokhara"],
];

function normalizeRegionName(region: string): string {
  return region.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function canonicalizeServiceRegion(region?: string | null): string {
  if (!region) return "Kathmandu Valley";
  const normalized = normalizeRegionName(region);
  for (const [alias, canonical] of REGION_ALIASES) {
    if (normalized === alias || normalized.includes(alias)) return canonical;
  }
  return region in SERVICE_REGION_BOUNDS ? region : "Kathmandu Valley";
}

export function getServiceRegionBounds(region?: string | null): ServiceRegionBounds {
  return SERVICE_REGION_BOUNDS[canonicalizeServiceRegion(region)] ?? SERVICE_REGION_BOUNDS["Kathmandu Valley"];
}

export function getServiceRegionCenter(region?: string | null): ServiceRegionCoordinate {
  return SERVICE_REGION_CENTERS[canonicalizeServiceRegion(region)] ?? SERVICE_REGION_CENTERS["Kathmandu Valley"];
}

export function isWithinRegionBounds(
  coordinate: ServiceRegionCoordinate | null | undefined,
  region?: string | null,
): boolean {
  if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) return false;
  const bounds = getServiceRegionBounds(region);
  return coordinate.latitude >= bounds.south
    && coordinate.latitude <= bounds.north
    && coordinate.longitude >= bounds.west
    && coordinate.longitude <= bounds.east;
}
