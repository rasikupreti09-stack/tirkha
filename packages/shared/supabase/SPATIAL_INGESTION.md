# District spatial ingestion

Migration `31_spatial_district_data.sql` adds the PostGIS store, GIST indexes,
restricted ingestion RPCs, LOD selection, and a bounded viewport read RPC for
Chitwan, Jhapa, and Sunsari. Apply it after migration 30 with PostGIS enabled
in the Supabase `extensions` schema. The district records start disabled and
cannot serve features until a valid district polygon and all three LOD tiers
have been imported and published.

## LOD contract

| Zoom | Tier | Expected source content |
| --- | --- | --- |
| z8–z13 | `macro` | Primary highways and district/major administrative boundaries |
| z14–z17 | `municipal` | Municipal roads and ward boundaries |
| z18–z28 | `building` | Building footprints and local paths/geometries |

The worker calls `get_spatial_features_for_viewport` only for a viewport that
intersects one of the district bounding boxes. The database checks the exact
district polygon, uses the GIST index, simplifies geometry for the requested
zoom, and caps each response at 5,000 features. Building requests are grouped
into 0.01-degree geographic chunks; the worker limits each viewport to 32
chunks and keeps a 24 MiB LRU for regional results.

## Import

The importer expects a valid district boundary GeoJSON and a district-clipped
GeoJSON `FeatureCollection` whose properties include OSM-style tags such as
`highway`, `boundary`, `admin_level`, and `building`. It streams the source,
assigns features to LOD tiers, sends idempotent batches (at most 500 features
and about 1.25 MB), and publishes atomically only when all three tiers have
data. Failed imports stay hidden; a previously published version stays live.

Install the streaming parser and run once per district:

```powershell
python -m pip install -r scripts/requirements-spatial.txt
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'server-only-key'
python scripts/ingest-district-spatial-data.py `
  --district chitwan `
  --version 2026-11-source-release-1 `
  --boundary .\private-data\chitwan-boundary.geojson `
  --features .\private-data\chitwan-features.geojson
```

Repeat with `jhapa` and `sunsari`. Keep source GeoJSON and the service-role
key out of Git. Use datasets with rights for commercial display and retain
their required attribution in the map's source credits. This repository does
not include the bulk district source files; no synthetic roads or building
footprints are seeded by the migration.

The TypeScript request router in `apps/web/src/lib/districtBounds.ts` uses the
district extent coordinates published by the [ICIMOD Nepal district layer](https://geoapps.icimod.org/arcgis/rest/services/Nepal/NepalAdmin/MapServer/2).
Those extents are fast rejection gates only; the imported polygon remains the
authoritative spatial boundary.
