begin;

-- Keep structured, customer-approved triage metadata attached to the booking.
alter table public.bookings
  add column diagnostic_summary text check (diagnostic_summary is null or char_length(btrim(diagnostic_summary)) between 1 and 1200),
  add column diagnostic_severity text check (diagnostic_severity is null or char_length(btrim(diagnostic_severity)) between 1 and 120),
  add column diagnostic_urgency text check (diagnostic_urgency is null or diagnostic_urgency in ('routine', 'soon', 'urgent')),
  add column suggested_parts text[] not null default '{}'
    check (cardinality(suggested_parts) <= 12 and array_position(suggested_parts, null) is null);

-- Preserve the existing booking RPC checks and bind retries to their initial
-- diagnostic payload before dispatch starts in the same transaction.
alter table public.booking_request_keys add column diagnostic_payload_hash text;
create function public.create_diagnostic_booking_request(
  p_request_id uuid,
  p_category_id uuid,
  p_professional_id uuid,
  p_service_address text,
  p_job_details text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_resolved_address text default null,
  p_diagnostic_summary text default null,
  p_diagnostic_severity text default null,
  p_diagnostic_urgency text default null,
  p_suggested_parts text[] default '{}'
)
returns setof public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  result public.bookings;
  existing public.bookings;
  stored_hash text;
  input_hash text;
begin
  if actor is null then raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED'; end if;
  if (p_diagnostic_summary is not null and char_length(btrim(p_diagnostic_summary)) not between 1 and 1200)
    or (p_diagnostic_severity is not null and char_length(btrim(p_diagnostic_severity)) > 120)
    or (p_diagnostic_urgency is not null and p_diagnostic_urgency not in ('routine', 'soon', 'urgent'))
    or coalesce(cardinality(p_suggested_parts), 0) > 12
    or array_position(p_suggested_parts, null) is not null
    or exists (select 1 from unnest(coalesce(p_suggested_parts, '{}')) part where char_length(btrim(part)) not between 1 and 100) then
    raise exception using errcode = '22023', message = 'INVALID_DIAGNOSTIC';
  end if;

  input_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'summary', nullif(btrim(p_diagnostic_summary), ''),
    'severity', nullif(btrim(p_diagnostic_severity), ''),
    'urgency', p_diagnostic_urgency,
    'parts', coalesce(p_suggested_parts, '{}')
  )::text);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_request_id::text, 0));
  select * into existing from public.bookings where customer_id = actor and client_request_id = p_request_id;
  if found then
    select diagnostic_payload_hash into stored_hash from public.booking_request_keys where booking_id = existing.id;
    if stored_hash is not null and stored_hash is distinct from input_hash then
      raise exception using errcode = '22023', message = 'REQUEST_ID_REUSED';
    end if;
  end if;
  select * into result from public.create_booking_request(
    p_request_id, p_category_id, p_professional_id, p_service_address,
    p_job_details, p_scheduled_at, p_duration_minutes, p_latitude,
    p_longitude, p_resolved_address
  );

  update public.bookings set
    diagnostic_summary = nullif(btrim(p_diagnostic_summary), ''),
    diagnostic_severity = nullif(btrim(p_diagnostic_severity), ''),
    diagnostic_urgency = p_diagnostic_urgency,
    suggested_parts = coalesce(p_suggested_parts, '{}')
  where id = result.id and customer_id = actor
  returning * into result;
  if not found then raise exception using errcode = '42501', message = 'BOOKING_UNAVAILABLE'; end if;
  update public.booking_request_keys set diagnostic_payload_hash = input_hash where booking_id = result.id;
  return next result;
end;
$$;
revoke all on function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[]) to authenticated;

-- SECURITY DEFINER prevents RLS recursion through hero_locations' customer policies.
create function public.hero_is_near_booking(p_professional_id uuid, p_latitude double precision, p_longitude double precision)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_professional_id = auth.uid() and p_latitude is not null and p_longitude is not null
    and exists (select 1 from public.hero_locations hl
      where hl.professional_id = p_professional_id and hl.status = 'online_idle'
        and hl.updated_at >= now() - interval '5 minutes'
        and 6371000 * 2 * asin(sqrt(least(1::double precision,
          power(sin(radians(p_latitude - hl.latitude) / 2), 2)
          + cos(radians(hl.latitude)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - hl.longitude) / 2), 2)
        ))) <= 20000);
$$;
revoke all on function public.hero_is_near_booking(uuid,double precision,double precision) from public, anon;
grant execute on function public.hero_is_near_booking(uuid,double precision,double precision) to authenticated;

-- The available-job read policy is proximity-gated as well, so the job board cannot
-- reveal customer pins to every professional who selected a category.
drop policy if exists bookings_professional_read on public.bookings;
create policy bookings_professional_read on public.bookings
for select to authenticated
using (
  exists (select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
    where p.id = (select auth.uid()) and p.role = 'professional' and pp.verification_status = 'verified')
  and (
    professional_id = (select auth.uid())
    or (
      professional_id is null and status = 'requested' and scheduled_at > now()
      and exists (select 1 from public.professional_service_categories pc
        where pc.professional_id = (select auth.uid()) and pc.category_id = bookings.category_id)
      and latitude is not null and longitude is not null
      and public.hero_is_near_booking((select auth.uid()), bookings.latitude, bookings.longitude)
    )
  )
);

create table public.hero_dispatch_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(profile_id) on delete cascade,
  status text not null default 'new' check (status in ('new', 'seen', 'accepted', 'expired')),
  service_name text not null,
  diagnostic_summary text,
  diagnostic_severity text,
  diagnostic_urgency text check (diagnostic_urgency is null or diagnostic_urgency in ('routine', 'soon', 'urgent')),
  suggested_parts text[] not null default '{}',
  service_address text not null,
  latitude double precision,
  longitude double precision,
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (booking_id, professional_id)
);
create index hero_dispatch_recipient_recent_idx on public.hero_dispatch_notifications(professional_id, created_at desc);
create index hero_dispatch_booking_idx on public.hero_dispatch_notifications(booking_id);
alter table public.hero_dispatch_notifications enable row level security;
revoke all on public.hero_dispatch_notifications from public, anon, authenticated;
grant select on public.hero_dispatch_notifications to authenticated;
grant all on public.hero_dispatch_notifications to service_role;
create policy hero_dispatch_recipient_read on public.hero_dispatch_notifications
for select to authenticated
using (
  professional_id = (select auth.uid())
  and exists (select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
    where p.id = (select auth.uid()) and p.role = 'professional' and pp.verification_status = 'verified')
);

create function public.mark_hero_dispatch_seen(p_notification_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.hero_dispatch_notifications set status = 'seen'
    where id = p_notification_id and professional_id = auth.uid() and status = 'new';
  if not found then raise exception using errcode = '42501', message = 'DISPATCH_UNAVAILABLE'; end if;
end;
$$;
revoke all on function public.mark_hero_dispatch_seen(uuid) from public, anon, authenticated;
grant execute on function public.mark_hero_dispatch_seen(uuid) to authenticated;

alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check check (kind in ('chat', 'job_status', 'hero_dispatch'));

create function public.dispatch_new_booking_to_heroes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  radius_meters double precision := 20000;
begin
  if new.status <> 'requested' then return new; end if;
  -- The pin is private to verified, matching Heroes who are online and within
  -- 20 km. An explicitly selected professional is the sole recipient.
  insert into public.hero_dispatch_notifications (
    booking_id, professional_id, service_name, diagnostic_summary,
    diagnostic_severity, diagnostic_urgency, suggested_parts, service_address,
    latitude, longitude, distance_meters, scheduled_at
  )
  select new.id, p.id, category.name, new.diagnostic_summary,
    new.diagnostic_severity, new.diagnostic_urgency, new.suggested_parts,
    new.service_address, new.latitude, new.longitude,
    case when hl.latitude is null or new.latitude is null then null else round(6371000 * 2 * asin(sqrt(least(1::double precision,
      power(sin(radians(new.latitude - hl.latitude) / 2), 2)
      + cos(radians(hl.latitude)) * cos(radians(new.latitude)) * power(sin(radians(new.longitude - hl.longitude) / 2), 2)
    ))))::integer end,
    new.scheduled_at
  from public.professional_service_categories pc
  join public.professional_profiles pp on pp.profile_id = pc.professional_id and pp.verification_status = 'verified'
  join public.profiles p on p.id = pp.profile_id and p.role = 'professional'
  join public.service_categories category on category.id = pc.category_id
  left join public.hero_locations hl on hl.professional_id = p.id
  where pc.category_id = new.category_id
    and (new.professional_id is null or p.id = new.professional_id)
    and (
      (new.professional_id is not null)
      or (
        new.latitude is not null and new.longitude is not null
        and hl.status = 'online_idle' and hl.updated_at >= now() - interval '5 minutes'
        and 6371000 * 2 * asin(sqrt(least(1::double precision,
          power(sin(radians(new.latitude - hl.latitude) / 2), 2)
          + cos(radians(hl.latitude)) * cos(radians(new.latitude)) * power(sin(radians(new.longitude - hl.longitude) / 2), 2)
        ))) <= radius_meters
      )
    )
  on conflict (booking_id, professional_id) do nothing;

  -- Push content is intentionally generic; location and problem details are
  -- available only after the recipient signs in and loads the secured inbox.
  insert into public.push_outbox(event_key, recipient_id, booking_id, token, kind, booking_status)
  select 'hero_dispatch:' || n.booking_id::text || ':' || n.professional_id::text,
    n.professional_id, n.booking_id, d.token, 'hero_dispatch', null
  from public.hero_dispatch_notifications n
  join public.push_devices d on d.user_id = n.professional_id and d.updated_at > now() - interval '30 days'
  where n.booking_id = new.id and n.status = 'new'
  on conflict (event_key, token) do nothing;

  return new;
end;
$$;
revoke all on function public.dispatch_new_booking_to_heroes() from public, anon, authenticated;
create trigger booking_hero_dispatch after update of diagnostic_summary on public.bookings
for each row when (new.status = 'requested' and old.status = 'requested')
execute function public.dispatch_new_booking_to_heroes();

create function public.expire_hero_dispatch_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> old.status or new.professional_id is distinct from old.professional_id then
    update public.hero_dispatch_notifications set status = case
      when new.professional_id = hero_dispatch_notifications.professional_id and new.status in ('accepted', 'on_the_way', 'in_progress', 'completed') then 'accepted'
      else 'expired' end
    where booking_id = new.id and status in ('new', 'seen');
  end if;
  return new;
end;
$$;
revoke all on function public.expire_hero_dispatch_notifications() from public, anon, authenticated;
create trigger booking_dispatch_close after update of status, professional_id on public.bookings
for each row execute function public.expire_hero_dispatch_notifications();

-- Supabase Realtime enforces the recipient RLS policy for row-change events.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hero_dispatch_notifications') then
    alter publication supabase_realtime add table public.hero_dispatch_notifications;
  end if;
end; $$;

commit;
