-- Keep persisted Hero GPS inside both Nepal's safety envelope and the Hero's
-- registered operating region. Customer reads are tied to the active booking.
begin;

create or replace function public.guard_hero_location_region()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  hero_zone text;
begin
  if new.latitude not between 26.33 and 30.45
    or new.longitude not between 80.05 and 88.20 then
    raise exception using errcode = '22023', message = 'HERO_LOCATION_OUTSIDE_NEPAL';
  end if;

  select pp.operational_zone into hero_zone
  from public.professional_profiles pp
  where pp.profile_id = new.professional_id
    and pp.verification_status = 'verified'
    and pp.suspended_at is null;

  if not found or not (
    (hero_zone = 'Kathmandu Valley' and new.latitude between 27.625 and 27.755
      and new.longitude between 85.245 and 85.465)
    or (hero_zone = 'Pokhara' and new.latitude between 28.175 and 28.255
      and new.longitude between 83.940 and 84.035)
    or (hero_zone = 'Hetauda' and new.latitude between 27.350 and 27.500
      and new.longitude between 84.970 and 85.120)
    or (hero_zone = 'Simara' and new.latitude between 27.120 and 27.240
      and new.longitude between 84.910 and 85.080)
  ) then
    raise exception using errcode = '22023', message = 'HERO_LOCATION_OUTSIDE_OPERATIONAL_REGION';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_hero_location_region() from public, anon, authenticated;
drop trigger if exists hero_location_region_guard on public.hero_locations;
create trigger hero_location_region_guard
  before insert or update of professional_id, latitude, longitude
  on public.hero_locations
  for each row execute function public.guard_hero_location_region();

drop policy if exists hero_locations_assigned_customer_read on public.hero_locations;
create policy hero_locations_assigned_customer_read on public.hero_locations
  for select to authenticated
  using (
    active_booking_id is not null
    and exists (
      select 1 from public.bookings b
      where b.id = hero_locations.active_booking_id
        and b.professional_id = hero_locations.professional_id
        and b.customer_id = (select auth.uid())
        and b.status in ('accepted', 'on_the_way', 'in_progress')
    )
  );

commit;
