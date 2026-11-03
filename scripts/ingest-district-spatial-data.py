#!/usr/bin/env python3
"""Stream district GeoJSON into the bounded Supabase/PostGIS LOD store.

Input must be a district-clipped source GeoJSON FeatureCollection and a
district-boundary GeoJSON Feature/Polygon/MultiPolygon. Features are assigned
to macro, municipal or building LOD from common OSM tags, sent in bounded
idempotent RPC batches, and the district is published only after all tiers
contain data. No service-role credential is written to disk.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Iterator

try:
    import ijson
except ImportError as error:
    raise SystemExit("Missing dependency: install scripts/requirements-spatial.txt with `python -m pip install -r scripts/requirements-spatial.txt`.") from error

DISTRICTS = {"chitwan", "jhapa", "sunsari"}
MACRO_HIGHWAYS = {"motorway", "trunk", "primary", "secondary"}
MUNICIPAL_HIGHWAYS = {"tertiary", "residential", "unclassified", "living_street", "road"}
LOCAL_HIGHWAYS = {"service", "track", "path", "footway", "cycleway", "pedestrian", "steps"}
MAX_BATCH_FEATURES = 500
MAX_BATCH_BYTES = 1_250_000


def properties_of(feature: dict[str, Any]) -> dict[str, Any]:
    properties = feature.get("properties")
    if not isinstance(properties, dict):
        return {}
    nested = properties.get("tags")
    return nested if isinstance(nested, dict) else properties


def lod_of(feature: dict[str, Any]) -> str | None:
    properties = properties_of(feature)
    highway = str(properties.get("highway", "")).lower()
    boundary = str(properties.get("boundary", "")).lower()
    try:
        admin_level = int(properties.get("admin_level", 99))
    except (TypeError, ValueError):
        admin_level = 99
    building = properties.get("building")
    if building not in (None, False, "", "no"):
        return "building"
    if highway in MACRO_HIGHWAYS or (boundary == "administrative" and admin_level <= 6):
        return "macro"
    if highway in MUNICIPAL_HIGHWAYS or (boundary == "administrative" and admin_level in (7, 8)) or properties.get("waterway"):
        return "municipal"
    if highway in LOCAL_HIGHWAYS:
        return "building"
    return None


def iter_features(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("rb") as source:
        for feature in ijson.items(source, "features.item"):
            if isinstance(feature, dict) and feature.get("type") == "Feature" and isinstance(feature.get("geometry"), dict):
                yield feature


def rpc(base_url: str, service_key: str, name: str, payload: dict[str, Any]) -> Any:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/rest/v1/rpc/{name}",
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            body = response.read(MAX_BATCH_BYTES + 1024)
            if len(body) > MAX_BATCH_BYTES + 1024:
                raise RuntimeError(f"RPC {name} response exceeded the safety limit")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as error:
        # Do not print request headers or credentials in error output.
        detail = error.read(2048).decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase RPC {name} failed with HTTP {error.code}: {detail}") from error


def send_batch(base_url: str, service_key: str, district: str, version: str, tier: str, features: list[dict[str, Any]]) -> int:
    result = rpc(base_url, service_key, "ingest_spatial_feature_batch", {
        "p_district_key": district,
        "p_lod_tier": tier,
        "p_dataset_version": version,
        "p_feature_collection": {"type": "FeatureCollection", "features": features},
    })
    if not isinstance(result, int):
        raise RuntimeError("Spatial ingestion RPC returned an unexpected batch result")
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--district", required=True, choices=sorted(DISTRICTS))
    parser.add_argument("--version", required=True, help="Immutable source release identifier, e.g. 2026-11-osm-1")
    parser.add_argument("--boundary", required=True, type=Path, help="District boundary GeoJSON Feature or Polygon/MultiPolygon")
    parser.add_argument("--features", required=True, type=Path, help="District-clipped GeoJSON FeatureCollection with OSM-style tags")
    args = parser.parse_args()

    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base_url or not service_key:
        parser.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment; never commit the service-role key.")
    if not args.boundary.is_file() or not args.features.is_file():
        parser.error("Both --boundary and --features must point to existing GeoJSON files.")
    if len(args.version) > 80:
        parser.error("--version must be 80 characters or fewer.")

    boundary = json.loads(args.boundary.read_text(encoding="utf-8"))
    if not isinstance(boundary, dict):
        parser.error("Boundary input must be a GeoJSON object.")
    rpc(base_url, service_key, "register_spatial_district_boundary", {
        "p_district_key": args.district,
        "p_boundary_geojson": boundary,
        "p_dataset_version": args.version,
    })

    tiers = ("macro", "municipal", "building")
    counts = {tier: 0 for tier in tiers}
    batches: dict[str, list[dict[str, Any]]] = {tier: [] for tier in tiers}
    batch_bytes = {tier: 0 for tier in tiers}
    for feature in iter_features(args.features):
        tier = lod_of(feature)
        if tier is None:
            continue
        encoded_size = len(json.dumps(feature, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        if encoded_size > MAX_BATCH_BYTES:
            raise RuntimeError(f"A single {tier} feature exceeds the RPC batch size limit; simplify it at source before ingestion.")
        if batches[tier] and (len(batches[tier]) >= MAX_BATCH_FEATURES or batch_bytes[tier] + encoded_size > MAX_BATCH_BYTES):
            counts[tier] += send_batch(base_url, service_key, args.district, args.version, tier, batches[tier])
            print(f"{args.district}: uploaded {tier} batch ({len(batches[tier])} features)", flush=True)
            batches[tier], batch_bytes[tier] = [], 0
        batches[tier].append(feature)
        batch_bytes[tier] += encoded_size

    for tier in tiers:
        if batches[tier]:
            counts[tier] += send_batch(base_url, service_key, args.district, args.version, tier, batches[tier])
            print(f"{args.district}: uploaded final {tier} batch ({len(batches[tier])} features)", flush=True)
        if counts[tier] == 0:
            raise RuntimeError(f"No {tier} features were found. Dataset remains disabled; provide a source layer for each LOD tier and retry.")

    published = rpc(base_url, service_key, "publish_spatial_district_dataset", {
        "p_district_key": args.district,
        "p_dataset_version": args.version,
    })
    if not isinstance(published, int) or published <= 0:
        raise RuntimeError("Dataset publish did not return a positive feature count")
    print(f"Published {args.district} dataset {args.version}: {published} features ({counts})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Spatial ingestion failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
