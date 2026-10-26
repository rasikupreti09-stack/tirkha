begin;

alter table public.professional_presence
  add column heading double precision check (heading is null or heading >= 0 and heading < 360);

drop function public.update_professional_presence(double precision, double precision);

create function public.update_professional_presence(
  p_latitude double precision,
  p_longitude double precision,
  p_heading double precision default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or (p_heading is not null and (p_heading < 0 or p_heading >= 360))
     or not exists (select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
       where p.id = actor and p.role = 'professional' and pp.verification_status = 'verified') then
    raise exception using errcode = '42501', message = 'VERIFIED_PROFESSIONAL_REQUIRED';
  end if;
  insert into public.professional_presence(professional_id, latitude, longitude, heading, updated_at)
  values (actor, p_latitude, p_longitude, p_heading, now())
  on conflict (professional_id) do update set latitude = excluded.latitude,
    longitude = excluded.longitude, heading = coalesce(excluded.heading, public.professional_presence.heading),
    updated_at = excluded.updated_at;
end; $$;

revoke all on function public.update_professional_presence(double precision, double precision, double precision) from public, anon;
grant execute on function public.update_professional_presence(double precision, double precision, double precision) to authenticated;

commit;
