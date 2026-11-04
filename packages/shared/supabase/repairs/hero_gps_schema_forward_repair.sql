-- Forward-only compatibility repair for the production Hero GPS schema.
-- The live table currently uses hero_id/speed; the app reads and writes
-- professional_id/speed_mps/status/active_booking_id.
-- Preserves existing GPS rows and never modifies bookings or payments.
-- Run manually in Supabase SQL Editor after reviewing the preflight checks.

begin;

do $preflight$
begin
  if to_regclass('public.hero_locations') is null
    or to_regclass('public.professional_profiles') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.bookings') is null then
    raise exception 'Hero GPS repair preflight failed: a required table is missing; no changes were applied.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hero_locations' and column_name='hero_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='hero_locations' and column_name='speed'
  ) then
    raise exception 'Hero GPS repair preflight failed: expected legacy hero_id and speed columns were not found; no changes were applied.';
  end if;
end;
$preflight$;

-- Keep the legacy columns for compatibility while adding the canonical fields
-- consumed by the current app and dispatch queries.
alter table public.hero_locations
  add column if not exists professional_id uuid,
  add column if not exists speed_mps double precision,
  add column if not exists active_booking_id uuid,
  add column if not exists status text;

update public.hero_locations
set professional_id=coalesce(professional_id,hero_id),
    speed_mps=coalesce(speed_mps,speed),
    status=coalesce(status,'online_idle')
where professional_id is null or speed_mps is null or status is null;

alter table public.hero_locations
  alter column professional_id set not null,
  alter column status set default 'online_idle',
  alter column status set not null;

create unique index if not exists hero_locations_professional_id_uidx
  on public.hero_locations(professional_id);
create index if not exists hero_locations_active_booking_idx
  on public.hero_locations(active_booking_id)
  where active_booking_id is not null;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hero_locations'::regclass
      and conname='hero_locations_status_check'
  ) then
    alter table public.hero_locations
      add constraint hero_locations_status_check
      check (status in ('online_idle','en_route','on_service')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.hero_locations'::regclass
      and conname='hero_locations_active_booking_id_fkey'
  ) then
    alter table public.hero_locations
      add constraint hero_locations_active_booking_id_fkey
      foreign key (active_booking_id) references public.bookings(id) on delete set null not valid;
  end if;
end;
$constraints$;

-- Ensure PostgREST resolves the exact six-argument RPC used by the current app.
-- If the old function has this exact SQL signature, replace it; other legacy
-- overloads are retained but made non-callable by browser roles below.
drop function if exists public.update_hero_location(
  double precision,double precision,double precision,double precision,smallint,uuid
);

create function public.update_hero_location(
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null,
  p_speed_mps double precision default null,
  p_battery_level smallint default null,
  p_active_booking_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  booking_status text;
  derived_status text := 'online_idle';
begin
  if actor is null
    or p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or (p_heading is not null and (p_heading < 0 or p_heading >= 360))
    or (p_speed_mps is not null and p_speed_mps < 0)
    or (p_battery_level is not null and p_battery_level not between 0 and 100)
    or not exists (
      select 1
      from public.profiles p
      join public.professional_profiles pp on pp.profile_id=p.id
      where p.id=actor and p.role='professional'
        and pp.verification_status::text='verified'
    ) then
    raise exception using errcode='42501',message='VERIFIED_PROFESSIONAL_REQUIRED';
  end if;

  if p_active_booking_id is not null then
    select b.status::text into booking_status
    from public.bookings b
    where b.id=p_active_booking_id and b.professional_id=actor
      and b.status::text in ('accepted','on_the_way','in_progress');

    if not found then
      raise exception using errcode='42501',message='ACTIVE_BOOKING_UNAVAILABLE';
    end if;

    derived_status := case booking_status
      when 'on_the_way' then 'en_route'
      when 'in_progress' then 'on_service'
      else 'online_idle'
    end;
  end if;

  insert into public.hero_locations(
    hero_id,professional_id,latitude,longitude,heading,speed,speed_mps,
    battery_level,active_booking_id,status,updated_at
  ) values (
    actor,actor,p_latitude,p_longitude,p_heading,p_speed_mps,p_speed_mps,
    p_battery_level,p_active_booking_id,derived_status,now()
  )
  on conflict (hero_id) do update set
    professional_id=excluded.professional_id,
    latitude=excluded.latitude,
    longitude=excluded.longitude,
    heading=coalesce(excluded.heading,public.hero_locations.heading),
    speed=excluded.speed,
    speed_mps=excluded.speed_mps,
    battery_level=coalesce(excluded.battery_level,public.hero_locations.battery_level),
    active_booking_id=excluded.active_booking_id,
    status=excluded.status,
    updated_at=excluded.updated_at;
end;
$function$;

-- Disable any older overloads that might otherwise expose a SECURITY DEFINER
-- location write without the verified-Hero and active-booking checks above.
do $privileges$
declare
  legacy_function record;
begin
  for legacy_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname='update_hero_location'
      and p.oid <> 'public.update_hero_location(double precision,double precision,double precision,double precision,smallint,uuid)'::regprocedure
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      legacy_function.signature
    );
  end loop;
end;
$privileges$;

revoke all on function public.update_hero_location(
  double precision,double precision,double precision,double precision,smallint,uuid
) from public,anon;
grant execute on function public.update_hero_location(
  double precision,double precision,double precision,double precision,smallint,uuid
) to authenticated;

create or replace function public.set_hero_availability(
  p_online boolean,
  p_latitude double precision default null,
  p_longitude double precision default null
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
begin
  if actor is null or p_online is null then
    raise exception using errcode='42501',message='AUTHENTICATED_HERO_REQUIRED';
  end if;

  if not exists (
    select 1 from public.profiles p
    join public.professional_profiles pp on pp.profile_id=p.id
    where p.id=actor and p.role='professional'
      and pp.verification_status::text='verified'
  ) then
    raise exception using errcode='42501',message='VERIFIED_PROFESSIONAL_REQUIRED';
  end if;

  if not p_online then
    if exists (
      select 1 from public.bookings b
      where b.professional_id=actor
        and b.status::text in ('accepted','on_the_way','in_progress')
    ) then
      raise exception using errcode='23514',message='ACTIVE_BOOKING_CANNOT_GO_OFFLINE';
    end if;

    delete from public.hero_locations where hero_id=actor;
    return;
  end if;

  if p_latitude is null or p_longitude is null then
    raise exception using errcode='22023',message='GPS_LOCATION_REQUIRED';
  end if;

  perform public.update_hero_location(
    p_latitude,p_longitude,null,null,null,null
  );
end;
$function$;

revoke all on function public.set_hero_availability(boolean,double precision,double precision)
  from public,anon;
grant execute on function public.set_hero_availability(boolean,double precision,double precision)
  to authenticated;

-- Browser clients may read only the rows allowed by the participant RLS policy.
revoke select on public.hero_locations from public,anon;
grant select on public.hero_locations to authenticated;

do $realtime$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public' and tablename='hero_locations'
    ) then
    alter publication supabase_realtime add table public.hero_locations;
  end if;
end;
$realtime$;

commit;
