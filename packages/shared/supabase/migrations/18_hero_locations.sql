begin;

create table public.hero_locations (
  professional_id uuid primary key references public.professional_profiles(profile_id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  heading double precision check (heading is null or heading between 0 and 359.999),
  speed_mps double precision check (speed_mps is null or speed_mps >= 0),
  battery_level smallint check (battery_level is null or battery_level between 0 and 100),
  active_booking_id uuid references public.bookings(id) on delete set null,
  status text not null check (status in ('online_idle', 'en_route', 'on_service')),
  updated_at timestamptz not null default now()
);

create index hero_locations_updated_at_idx on public.hero_locations(updated_at desc);
alter table public.hero_locations enable row level security;
revoke all on public.hero_locations from public, anon, authenticated;
grant select on public.hero_locations to authenticated;
grant all on public.hero_locations to service_role;

create policy hero_locations_owner_read on public.hero_locations for select to authenticated
  using (professional_id = (select auth.uid()));
create policy hero_locations_admin_read on public.hero_locations for select to authenticated
  using ((select public.is_tirkha_admin()));
create policy hero_locations_assigned_customer_read on public.hero_locations for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.professional_id = hero_locations.professional_id
      and b.customer_id = (select auth.uid())
      and b.status in ('accepted', 'on_the_way', 'in_progress')
  ));
create policy professional_profiles_admin_read on public.professional_profiles for select to authenticated
  using ((select public.is_tirkha_admin()));

create function public.update_hero_location(
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null,
  p_speed_mps double precision default null,
  p_battery_level smallint default null,
  p_active_booking_id uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  booking_status public.booking_status;
  derived_status text := 'online_idle';
begin
  if actor is null or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or (p_heading is not null and (p_heading < 0 or p_heading >= 360))
     or (p_speed_mps is not null and p_speed_mps < 0)
     or (p_battery_level is not null and p_battery_level not between 0 and 100)
     or not exists (
       select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
       where p.id = actor and p.role = 'professional' and pp.verification_status = 'verified'
     ) then
    raise exception using errcode = '42501', message = 'VERIFIED_PROFESSIONAL_REQUIRED';
  end if;

  if p_active_booking_id is not null then
    select b.status into booking_status from public.bookings b
    where b.id = p_active_booking_id and b.professional_id = actor
      and b.status in ('accepted', 'on_the_way', 'in_progress');
    if not found then
      raise exception using errcode = '42501', message = 'ACTIVE_BOOKING_UNAVAILABLE';
    end if;
    derived_status := case booking_status
      when 'on_the_way' then 'en_route'
      when 'in_progress' then 'on_service'
      else 'online_idle'
    end;
  end if;

  insert into public.hero_locations(professional_id, latitude, longitude, heading, speed_mps, battery_level, active_booking_id, status, updated_at)
  values (actor, p_latitude, p_longitude, p_heading, p_speed_mps, p_battery_level, p_active_booking_id, derived_status, now())
  on conflict (professional_id) do update set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    heading = coalesce(excluded.heading, public.hero_locations.heading),
    speed_mps = excluded.speed_mps,
    battery_level = coalesce(excluded.battery_level, public.hero_locations.battery_level),
    active_booking_id = excluded.active_booking_id,
    status = excluded.status,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.update_hero_location(double precision, double precision, double precision, double precision, smallint, uuid) from public, anon;
grant execute on function public.update_hero_location(double precision, double precision, double precision, double precision, smallint, uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hero_locations') then
    alter publication supabase_realtime add table public.hero_locations;
  end if;
end $$;

commit;
