"""Extract compact, self-hosted Nepal road geometry for Tirkha's custom map renderer.

Run after installing the `osmium` Python package:
  python scripts/build-tirkha-map-data.py <path-to-nepal-latest.osm.pbf>

Derived data remains ODbL-licensed. The live map must keep the visible OSM attribution.
"""

from __future__ import annotations

import json
import gzip
import sys
from datetime import datetime, timezone
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "public" / "data" / "tirkha-nepal-roads.geojson.gz"
BUILDINGS_DIR = ROOT / "apps" / "web" / "public" / "data" / "buildings"
AREAS = (
    (27.62, 85.24, 27.77, 85.47),  # Kathmandu, Lalitpur and Bhaktapur
    (28.17, 83.92, 28.27, 84.03),  # Pokhara
)
BUILDING_AREAS = {
    "kathmandu": (27.675, 85.275, 27.755, 85.375),
    "lalitpur": (27.645, 85.285, 27.700, 85.355),
    "bhaktapur": (27.650, 85.395, 27.710, 85.465),
    "pokhara": (28.175, 83.930, 28.255, 84.025),
}
SKIP = {"footway", "path", "steps", "cycleway", "corridor", "construction", "proposed", "abandoned", "platform", "raceway"}


def simplify(coords: list[list[float]], epsilon: float = 0.000012) -> list[list[float]]:
    if len(coords) <= 2:
        return coords
    start, end = coords[0], coords[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    denom = dx * dx + dy * dy
    best_index, best_dist = -1, 0.0
    for index, point in enumerate(coords[1:-1], 1):
        if denom == 0:
            distance = (point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2
        else:
            t = max(0.0, min(1.0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / denom))
            px, py = start[0] + t * dx, start[1] + t * dy
            distance = (point[0] - px) ** 2 + (point[1] - py) ** 2
        if distance > best_dist:
            best_index, best_dist = index, distance
    if best_dist > epsilon * epsilon:
        left = simplify(coords[: best_index + 1], epsilon)
        right = simplify(coords[best_index:], epsilon)
        return left[:-1] + right
    return [start, end]


def road_class(highway: str) -> str:
    if highway in {"motorway", "trunk", "motorway_link", "trunk_link"}:
        return "expressway"
    if highway in {"primary", "secondary", "primary_link", "secondary_link"}:
        return "arterial"
    if highway in {"tertiary", "tertiary_link", "unclassified"}:
        return "connector"
    return "local"


class RoadCollector(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.features: list[dict] = []
        self.seen: set[int] = set()

    def way(self, way: osmium.osm.Way) -> None:
        highway = way.tags.get("highway")
        if not highway or highway in SKIP or way.id in self.seen:
            return
        coords: list[list[float]] = []
        inside = False
        for node in way.nodes:
            if not node.location.valid():
                continue
            lon, lat = float(node.location.lon), float(node.location.lat)
            coords.append([round(lon, 6), round(lat, 6)])
            if any(south <= lat <= north and west <= lon <= east for south, west, north, east in AREAS):
                inside = True
        if not inside or len(coords) < 2:
            return
        self.seen.add(way.id)
        coords = simplify(coords)
        tags = way.tags
        self.features.append({
            "type": "Feature",
            "id": f"osm-way-{way.id}",
            "properties": {
                "class": road_class(highway),
                "highway": highway,
                "name": tags.get("name"),
                "ref": tags.get("ref"),
                "surface": tags.get("surface"),
                "oneway": tags.get("oneway"),
                "bridge": tags.get("bridge"),
                "tunnel": tags.get("tunnel"),
            },
            "geometry": {"type": "LineString", "coordinates": coords},
        })


class BuildingCollector(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.features: dict[str, dict[str, list[dict]]] = {region: {} for region in BUILDING_AREAS}
        self.seen: set[int] = set()

    def way(self, way: osmium.osm.Way) -> None:
        if way.id in self.seen or not way.tags.get("building"):
            return
        coords: list[list[float]] = []
        for node in way.nodes:
            if not node.location.valid():
                return
            coords.append([round(float(node.location.lon), 6), round(float(node.location.lat), 6)])
        if len(coords) < 4 or coords[0] != coords[-1]:
            return
        min_lon = min(point[0] for point in coords)
        max_lon = max(point[0] for point in coords)
        min_lat = min(point[1] for point in coords)
        max_lat = max(point[1] for point in coords)
        region = next((name for name, (south, west, north, east) in BUILDING_AREAS.items()
                       if max_lat >= south and min_lat <= north and max_lon >= west and min_lon <= east), None)
        if not region:
            return
        center_lon = sum(point[0] for point in coords[:-1]) / (len(coords) - 1)
        center_lat = sum(point[1] for point in coords[:-1]) / (len(coords) - 1)
        tile = f"{int(center_lat * 100)}_{int(center_lon * 100)}"
        self.seen.add(way.id)
        self.features[region].setdefault(tile, []).append({
            "type": "Feature",
            "id": f"osm-building-{way.id}",
            "properties": {
                "kind": way.tags.get("building"),
                "center": [round(center_lon, 6), round(center_lat, 6)],
            },
            "geometry": {"type": "Polygon", "coordinates": [coords]},
        })


class MapCollector(osmium.SimpleHandler):
    """Collect street and building geometry in one pass through the PBF."""
    def __init__(self) -> None:
        super().__init__()
        self.roads = RoadCollector()
        self.buildings = BuildingCollector()

    def way(self, way: osmium.osm.Way) -> None:
        self.roads.way(way)
        self.buildings.way(way)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/build-tirkha-map-data.py <nepal-latest.osm.pbf>")
    source = Path(sys.argv[1]).resolve()
    if not source.is_file():
        raise SystemExit(f"OSM extract not found: {source}")
    collector = MapCollector()
    collector.apply_file(str(source), locations=True)
    road_collector = collector.roads
    payload = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "© OpenStreetMap contributors",
            "license": "Open Database License (ODbL) 1.0",
            "built_at": datetime.now(timezone.utc).isoformat(),
            "regions": ["Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara"],
        },
        "features": road_collector.features,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    encoded = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    OUTPUT.write_bytes(gzip.compress(encoded, compresslevel=9, mtime=0))
    print(f"Saved {len(road_collector.features):,} roads ({OUTPUT.stat().st_size / 1024 / 1024:.2f} MiB gzip) to {OUTPUT}")
    BUILDINGS_DIR.mkdir(parents=True, exist_ok=True)
    for region, tiles in collector.buildings.features.items():
        total = 0
        total_bytes = 0
        region_dir = BUILDINGS_DIR / region
        region_dir.mkdir(parents=True, exist_ok=True)
        for tile, features in tiles.items():
            buildings_payload = {
                "type": "FeatureCollection",
                "metadata": {"source": "© OpenStreetMap contributors", "license": "Open Database License (ODbL) 1.0", "region": region, "grid": tile},
                "features": features,
            }
            buildings_encoded = json.dumps(buildings_payload, separators=(",", ":")).encode("utf-8")
            target = region_dir / f"{tile}.geojson.gz"
            target.write_bytes(gzip.compress(buildings_encoded, compresslevel=9, mtime=0))
            total += len(features)
            total_bytes += target.stat().st_size
        print(f"Saved {total:,} {region} building footprints in {len(tiles):,} local tiles ({total_bytes / 1024 / 1024:.2f} MiB gzip)")


if __name__ == "__main__":
    main()
