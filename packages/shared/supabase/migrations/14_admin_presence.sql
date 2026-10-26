begin;

-- Admin dashboards need an explicit role-gated read path; normal users retain
-- the existing participant-only booking policies.
create function public.is_tirkha_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
$$;
revoke all on function public.is_tirkha_admin() from public, anon;
grant execute on function public.is_tirkha_admin() to authenticated;
create policy profiles_admin_read on public.profiles for select to authenticated
  using ((select public.is_tirkha_admin()));
create policy bookings_admin_read on public.bookings for select to authenticated
  using ((select public.is_tirkha_admin()));

create table public.professional_presence (
  professional_id uuid primary key references public.professional_profiles(profile_id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);
alter table public.professional_presence enable row level security;
revoke all on public.professional_presence from public, anon, authenticated;
grant select on public.professional_presence to authenticated;
grant all on public.professional_presence to service_role;
create policy presence_admin_read on public.professional_presence for select to authenticated
  using ((select public.is_tirkha_admin()));

-- Private WebRTC signaling is scoped to the two participants of one booking.
create policy booking_call_signaling_read on realtime.messages for select to authenticated
  using (exists (select 1 from public.bookings b where realtime.topic() like 'booking-call:' || b.id::text
    and (b.customer_id = (select auth.uid()) or b.professional_id = (select auth.uid()))));
create policy booking_call_signaling_write on realtime.messages for insert to authenticated
  with check (exists (select 1 from public.bookings b where realtime.topic() like 'booking-call:' || b.id::text
    and (b.customer_id = (select auth.uid()) or b.professional_id = (select auth.uid()))
    and b.professional_id is not null and b.status in ('requested','accepted','on_the_way','in_progress')));

create function public.update_professional_presence(p_latitude double precision, p_longitude double precision)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_latitude is null or p_longitude is null
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
     or not exists (select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
       where p.id = actor and p.role = 'professional' and pp.verification_status = 'verified') then
    raise exception using errcode = '42501', message = 'VERIFIED_PROFESSIONAL_REQUIRED';
  end if;
  insert into public.professional_presence(professional_id, latitude, longitude, updated_at)
  values (actor, p_latitude, p_longitude, now())
  on conflict (professional_id) do update set latitude = excluded.latitude,
    longitude = excluded.longitude, updated_at = excluded.updated_at;
end; $$;
revoke all on function public.update_professional_presence(double precision, double precision) from public, anon;
grant execute on function public.update_professional_presence(double precision, double precision) to authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'professional_presence') then
    alter publication supabase_realtime add table public.professional_presence;
  end if;
end $$;
commit;
