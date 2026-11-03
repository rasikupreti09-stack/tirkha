-- PostGIS store and bounded LOD query path for Chitwan, Jhapa and Sunsari.
-- Apply as the Supabase migration owner. Boundary geometry must be imported
-- before feature batches are accepted; bounding rectangles are only a fast gate.
begin;

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

create type public.spatial_lod_tier as enum ('macro', 'municipal', 'building');

create table public.spatial_districts (
  district_key text primary key check (district_key in ('chitwan', 'jhapa', 'sunsari')),
  district_name text not null,
  center extensions.geometry(Point, 4326) not null,
  bbox extensions.geometry(Polygon, 4326) not null,
  boundary extensions.geometry(MultiPolygon, 4326),
  dataset_version text,
  pending_boundary extensions.geometry(MultiPolygon, 4326),
  pending_version text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  check (extensions.ST_SRID(center) = 4326),
  check (extensions.ST_SRID(bbox) = 4326),
  check (boundary is null or extensions.ST_SRID(boundary) = 4326),
  check (pending_boundary is null or extensions.ST_SRID(pending_boundary) = 4326)
);

create table public.spatial_features (
  feature_id uuid primary key default gen_random_uuid(),
  district_key text not null references public.spatial_districts(district_key) on delete cascade,
  lod_tier public.spatial_lod_tier not null,
  feature_kind text not null check (char_length(feature_kind) between 1 and 80),
  source_id text not null check (char_length(source_id) between 1 and 180),
  dataset_version text not null check (char_length(dataset_version) between 1 and 80),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  geom extensions.geometry(Geometry, 4326) not null,
  created_at timestamptz not null default now(),
  unique (district_key, lod_tier, source_id, dataset_version),
  check (extensions.ST_SRID(geom) = 4326),
  check (not extensions.ST_IsEmpty(geom))
);

create index spatial_districts_bbox_gist on public.spatial_districts using gist (bbox);
create index spatial_districts_boundary_gist on public.spatial_districts using gist (boundary);
create index spatial_features_geom_gist on public.spatial_features using gist (geom);
create index spatial_features_district_lod_idx on public.spatial_features (district_key, lod_tier, dataset_version);

alter table public.spatial_districts enable row level security;
alter table public.spatial_features enable row level security;
create policy spatial_districts_map_read on public.spatial_districts
  for select to anon, authenticated using (enabled);
create policy spatial_features_map_read on public.spatial_features
  for select to anon, authenticated using (
    exists (select 1 from public.spatial_districts d where d.district_key = spatial_features.district_key and d.enabled)
  );
revoke all on public.spatial_districts, public.spatial_features from public, anon, authenticated;
grant select on public.spatial_districts, public.spatial_features to service_role;

insert into public.spatial_districts (district_key, district_name, center, bbox)
values
  ('chitwan', 'Chitwan', extensions.ST_SetSRID(extensions.ST_MakePoint(84.3576014411, 27.6177706875), 4326), extensions.ST_MakeEnvelope(83.9186529938, 27.3550205807, 84.7965498883, 27.8805207943, 4326)),
  ('jhapa', 'Jhapa', extensions.ST_SetSRID(extensions.ST_MakePoint(87.9117197165, 26.5835578295), 4326), extensions.ST_MakeEnvelope(87.6355827303, 26.3611635576, 88.1878567027, 26.8059521014, 4326)),
  ('sunsari', 'Sunsari', extensions.ST_SetSRID(extensions.ST_MakePoint(87.1288586950, 26.6410162093), 4326), extensions.ST_MakeEnvelope(86.9039041360, 26.4032533752, 87.3538132541, 26.8787790433, 4326))
on conflict (district_key) do update set
  district_name = excluded.district_name,
  center = excluded.center,
  bbox = excluded.bbox,
  updated_at = now();

create or replace function public.spatial_lod_for_zoom(p_zoom numeric)
returns public.spatial_lod_tier
language sql immutable strict set search_path = '' as $$
  select case
    when p_zoom between 8 and 13.999 then 'macro'::public.spatial_lod_tier
    when p_zoom between 14 and 17.999 then 'municipal'::public.spatial_lod_tier
    when p_zoom between 18 and 28 then 'building'::public.spatial_lod_tier
    else null
  end;
$$;

-- Import district boundary GeoJSON as a Feature or Polygon/MultiPolygon geometry.
create or replace function public.register_spatial_district_boundary(
  p_district_key text,
  p_boundary_geojson jsonb,
  p_dataset_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  boundary_json jsonb;
  boundary_geom extensions.geometry;
begin
  if p_district_key not in ('chitwan', 'jhapa', 'sunsari')
    or p_dataset_version is null or char_length(p_dataset_version) not between 1 and 80
    or p_boundary_geojson is null then
    raise exception using errcode = '22023', message = 'INVALID_SPATIAL_DISTRICT_BOUNDARY';
  end if;
  boundary_json := case when p_boundary_geojson ->> 'type' = 'Feature'
    then p_boundary_geojson -> 'geometry' else p_boundary_geojson end;
  boundary_geom := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(boundary_json::text), 4326);
  if extensions.ST_GeometryType(boundary_geom) not in ('ST_Polygon', 'ST_MultiPolygon')
    or not extensions.ST_IsValid(boundary_geom) then
    raise exception using errcode = '22023', message = 'DISTRICT_BOUNDARY_MUST_BE_VALID_POLYGON';
  end if;
  delete from public.spatial_features f
    where f.district_key = p_district_key
      and f.dataset_version is distinct from (select d.dataset_version from public.spatial_districts d where d.district_key = p_district_key);
  update public.spatial_districts
    set pending_boundary = extensions.ST_Multi(boundary_geom), pending_version = p_dataset_version,
        updated_at = now()
    where district_key = p_district_key;
  if not found then raise exception using errcode = '22023', message = 'UNKNOWN_SPATIAL_DISTRICT'; end if;
end;
$$;

-- Ingest small batches from a GeoJSON FeatureCollection; large datasets should
-- be split into <=1,000-feature batches by the offline importer.
create or replace function public.ingest_spatial_feature_batch(
  p_district_key text,
  p_lod_tier public.spatial_lod_tier,
  p_dataset_version text,
  p_feature_collection jsonb
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  district_boundary extensions.geometry;
  item jsonb;
  input_geom extensions.geometry;
  clipped_geom extensions.geometry;
  source_id text;
  feature_kind text;
  inserted_count integer := 0;
  feature_list jsonb;
begin
  if p_district_key not in ('chitwan', 'jhapa', 'sunsari')
    or p_dataset_version is null or char_length(p_dataset_version) not between 1 and 80
    or p_feature_collection is null or p_lod_tier is null
    or p_feature_collection ->> 'type' <> 'FeatureCollection' then
    raise exception using errcode = '22023', message = 'INVALID_SPATIAL_FEATURE_BATCH';
  end if;
  feature_list := p_feature_collection -> 'features';
  if feature_list is null or jsonb_typeof(feature_list) <> 'array' or jsonb_array_length(feature_list) > 1000 then
    raise exception using errcode = '22023', message = 'SPATIAL_BATCH_LIMIT_EXCEEDED';
  end if;
  select pending_boundary into district_boundary from public.spatial_districts
    where district_key = p_district_key and pending_version = p_dataset_version for update;
  if district_boundary is null then raise exception using errcode = '22023', message = 'DISTRICT_BOUNDARY_VERSION_NOT_REGISTERED'; end if;

  for item in select value from jsonb_array_elements(feature_list) loop
    if item ->> 'type' <> 'Feature' or item -> 'geometry' is null then continue; end if;
    input_geom := extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON((item -> 'geometry')::text), 4326);
    if input_geom is null or extensions.ST_IsEmpty(input_geom) or not extensions.ST_IsValid(input_geom)
      or not extensions.ST_Intersects(input_geom, district_boundary) then continue; end if;
    clipped_geom := extensions.ST_Intersection(input_geom, district_boundary);
    if clipped_geom is null or extensions.ST_IsEmpty(clipped_geom) then continue; end if;
    source_id := coalesce(nullif(item ->> 'id', ''), nullif(item -> 'properties' ->> 'osm_id', ''), md5(item::text));
    feature_kind := left(coalesce(
      nullif(item -> 'properties' ->> 'feature_kind', ''),
      nullif(item -> 'properties' ->> 'kind', ''),
      nullif(item -> 'properties' ->> 'highway', ''),
      nullif(item -> 'properties' ->> 'boundary', ''),
      case when item -> 'properties' ? 'building' then 'building' end,
      'other'), 80);
    insert into public.spatial_features (district_key, lod_tier, feature_kind, source_id, dataset_version, properties, geom)
    values (p_district_key, p_lod_tier, feature_kind, left(source_id, 180), p_dataset_version,
      coalesce(item -> 'properties', '{}'::jsonb), clipped_geom)
    on conflict (district_key, lod_tier, source_id, dataset_version)
    do update set feature_kind = excluded.feature_kind, properties = excluded.properties, geom = excluded.geom;
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;

-- Publish only complete district versions and remove superseded geometry rows.
create or replace function public.publish_spatial_district_dataset(
  p_district_key text,
  p_dataset_version text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare tier_count integer;
begin
  if p_district_key not in ('chitwan', 'jhapa', 'sunsari') or p_dataset_version is null then
    raise exception using errcode = '22023', message = 'INVALID_SPATIAL_DISTRICT_VERSION';
  end if;
  if not exists (select 1 from public.spatial_districts d where d.district_key = p_district_key
      and d.pending_version = p_dataset_version and d.pending_boundary is not null) then
    raise exception using errcode = '22023', message = 'SPATIAL_DISTRICT_BOUNDARY_OR_VERSION_MISSING';
  end if;
  select count(distinct f.lod_tier)::integer into tier_count
    from public.spatial_features f
    where f.district_key = p_district_key and f.dataset_version = p_dataset_version;
  if tier_count <> 3 then
    raise exception using errcode = '22023', message = 'ALL_THREE_SPATIAL_LOD_TIERS_REQUIRED';
  end if;
  update public.spatial_districts set boundary = pending_boundary, dataset_version = pending_version,
      pending_boundary = null, pending_version = null, enabled = true, updated_at = now()
    where district_key = p_district_key and pending_version = p_dataset_version;
  delete from public.spatial_features where district_key = p_district_key and dataset_version <> p_dataset_version;
  return (select count(*)::integer from public.spatial_features f where f.district_key = p_district_key and f.dataset_version = p_dataset_version);
end;
$$;

-- Bounded public map read. The bbox is first checked against the district's
-- fast rectangle and then intersected with the true imported district polygon.
create or replace function public.get_spatial_features_for_viewport(
  p_district_key text,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_zoom numeric,
  p_limit integer default 2500
) returns table (
  feature_id uuid,
  district_key text,
  lod_tier public.spatial_lod_tier,
  feature_kind text,
  properties jsonb,
  geometry jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  viewport extensions.geometry;
  selected_tier public.spatial_lod_tier;
  simplify_tolerance double precision;
begin
  if p_district_key not in ('chitwan', 'jhapa', 'sunsari')
    or p_west is null or p_south is null or p_east is null or p_north is null
    or p_west < -180 or p_east > 180 or p_south < -85.1 or p_north > 85.1
    or p_west >= p_east or p_south >= p_north
    or p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception using errcode = '22023', message = 'INVALID_SPATIAL_VIEWPORT';
  end if;
  selected_tier := public.spatial_lod_for_zoom(p_zoom);
  if selected_tier is null then return; end if;
  viewport := extensions.ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326);
  if not exists (
    select 1 from public.spatial_districts d
    where d.district_key = p_district_key and d.enabled and d.boundary is not null
      and extensions.ST_Intersects(d.bbox, viewport)
      and extensions.ST_Intersects(d.boundary, viewport)
  ) then return; end if;

  simplify_tolerance := case
    when p_zoom < 14 then 0.0015
    when p_zoom < 18 then 0.00015
    else greatest(0.000001, 0.00002 / power(2, greatest(0, p_zoom - 18)))
  end;

  return query
    select f.feature_id, f.district_key, f.lod_tier, f.feature_kind, f.properties,
      extensions.ST_AsGeoJSON(extensions.ST_SimplifyPreserveTopology(f.geom, simplify_tolerance), 6)::jsonb
    from public.spatial_features f
    join public.spatial_districts d on d.district_key = f.district_key
    where f.district_key = p_district_key and f.dataset_version = d.dataset_version and d.enabled
      and f.lod_tier <= selected_tier
      and f.geom && viewport
      and extensions.ST_Intersects(f.geom, viewport)
    order by f.lod_tier, f.feature_kind, f.feature_id
    limit p_limit;
end;
$$;

revoke all on function public.spatial_lod_for_zoom(numeric) from public;
revoke all on function public.register_spatial_district_boundary(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.ingest_spatial_feature_batch(text, public.spatial_lod_tier, text, jsonb) from public, anon, authenticated;
revoke all on function public.publish_spatial_district_dataset(text, text) from public, anon, authenticated;
revoke all on function public.get_spatial_features_for_viewport(text, double precision, double precision, double precision, double precision, numeric, integer) from public;
grant execute on function public.get_spatial_features_for_viewport(text, double precision, double precision, double precision, double precision, numeric, integer) to anon, authenticated;
grant execute on function public.register_spatial_district_boundary(text, jsonb, text) to service_role;
grant execute on function public.ingest_spatial_feature_batch(text, public.spatial_lod_tier, text, jsonb) to service_role;
grant execute on function public.publish_spatial_district_dataset(text, text) to service_role;
grant usage on type public.spatial_lod_tier to anon, authenticated, service_role;

commit;
