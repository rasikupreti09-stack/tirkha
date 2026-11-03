export type SpatialBounds = { south: number; west: number; north: number; east: number };
export type SpatialRegionKey = "kathmandu" | "lalitpur" | "bhaktapur" | "kirtipur" | "pokhara" | "chitwan" | "jhapa" | "sunsari";
export type SpatialPosition = [number, number];
export type SpatialGeometry =
  | { type: "Point"; coordinates: SpatialPosition }
  | { type: "MultiPoint" | "LineString"; coordinates: SpatialPosition[] }
  | { type: "MultiLineString" | "Polygon"; coordinates: SpatialPosition[][] }
  | { type: "MultiPolygon"; coordinates: SpatialPosition[][][] };
export type SpatialRegionalFeature = {
  type: "Feature";
  id: string;
  properties: { kind: string; district: string; lod: "macro" | "municipal" | "building"; name?: string; ref?: string };
  geometry: SpatialGeometry;
};
export type SpatialRoadFeature = {
  type: "Feature";
  id?: string;
  /** Worker-derived Leaflet LatLng pairs for label paths; GeoJSON geometry stays standards-compliant. */
  displayPositions?: [number, number][];
  properties?: { class?: "expressway" | "arterial" | "connector" | "local"; name?: string; ref?: string };
  geometry: { type: "LineString"; coordinates: number[][] };
};
export type SpatialBuildingFeature = {
  type: "Feature";
  id?: string;
  properties?: { kind?: string; center?: [number, number]; bounds?: [number, number, number, number] };
  geometry: { type: "Polygon"; coordinates: number[][][] };
};
export type RoadLabelPlacement = { startOffset: number; scale: number };
export type SpatialViewportQuery = {
  bounds: SpatialBounds;
  center: [number, number];
  region: SpatialRegionKey | null;
  zoom: number;
  pixelOrigin: { x: number; y: number };
  size: { x: number; y: number };
  /** Public Supabase project settings; omitted when no regional DB layer is configured. */
  supabase?: { url: string; anonKey: string };
};
export type SpatialViewportResult = {
  roads: { type: "FeatureCollection"; features: SpatialRoadFeature[] };
  buildings: { type: "FeatureCollection"; features: SpatialBuildingFeature[] };
  regionalFeatures: SpatialRegionalFeature[];
  labels: Record<string, RoadLabelPlacement>;
  lodTier: "macro" | "municipal" | "building" | null;
  activeFeatureCount: number;
  estimatedActiveBytes: number;
  truncated: boolean;
};
export type SpatialWorkerRequest = { id: number; type: "query"; query: SpatialViewportQuery };
export type SpatialWorkerResponse =
  | { id: number; ok: true; result: SpatialViewportResult }
  | { id: number; ok: false; error: string };
