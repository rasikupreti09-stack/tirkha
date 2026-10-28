begin;

-- Store the recipient's verified specialization on each private dispatch row so
-- both PostgREST and Realtime can filter by trade without scanning other jobs.
alter table public.hero_dispatch_notifications
  add column if not exists trade_category text;

update public.hero_dispatch_notifications n
set trade_category = coalesce(pp.trade_category, pp.trade_code)
from public.professional_profiles pp
where pp.profile_id = n.professional_id
  and n.trade_category is distinct from coalesce(pp.trade_category, pp.trade_code);

alter table public.hero_dispatch_notifications
  drop constraint if exists hero_dispatch_notifications_trade_category_check;
alter table public.hero_dispatch_notifications
  add constraint hero_dispatch_notifications_trade_category_check
  check (trade_category is null or trade_category in (
    'PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN'
  ));

create index if not exists hero_dispatch_trade_recipient_idx
  on public.hero_dispatch_notifications(trade_category, professional_id, status, created_at desc);

create or replace function public.dispatch_new_booking_to_heroes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare radius_meters double precision := 20000;
begin
  if new.status <> 'requested' then return new; end if;

  insert into public.hero_dispatch_notifications (
    booking_id, professional_id, trade_category, service_name, diagnostic_summary,
    diagnostic_severity, diagnostic_urgency, suggested_parts, service_address,
    latitude, longitude, distance_meters, scheduled_at
  )
  select new.id, p.id, coalesce(pp.trade_category, pp.trade_code), category.name,
    new.diagnostic_summary, new.diagnostic_severity, new.diagnostic_urgency,
    new.suggested_parts, new.service_address, new.latitude, new.longitude,
    case when hl.latitude is null or new.latitude is null then null else round(6371000 * 2 * asin(sqrt(least(1::double precision,
      power(sin(radians(new.latitude - hl.latitude) / 2), 2)
      + cos(radians(hl.latitude)) * cos(radians(new.latitude)) * power(sin(radians(new.longitude - hl.longitude) / 2), 2)
    ))))::integer end,
    new.scheduled_at
  from public.professional_service_categories pc
  join public.professional_profiles pp on pp.profile_id = pc.professional_id
    and pp.verification_status = 'verified' and pp.suspended_at is null
    and coalesce(pp.trade_category, pp.trade_code) is not null
    and pp.operational_zone is not null and pp.citizenship_document_path is not null
  join public.profiles p on p.id = pp.profile_id and p.role = 'professional'
  join public.service_categories category on category.id = pc.category_id
  left join public.hero_locations hl on hl.professional_id = p.id
  where pc.category_id = new.category_id
    and (new.professional_id is null or p.id = new.professional_id)
    and public.hero_zone_matches_booking(p.id, coalesce(new.resolved_address, new.service_address))
    and (
      (new.professional_id is not null)
      or (new.latitude is not null and new.longitude is not null
        and hl.status = 'online_idle' and hl.updated_at >= now() - interval '5 minutes'
        and 6371000 * 2 * asin(sqrt(least(1::double precision,
          power(sin(radians(new.latitude - hl.latitude) / 2), 2)
          + cos(radians(hl.latitude)) * cos(radians(new.latitude)) * power(sin(radians(new.longitude - hl.longitude) / 2), 2)
        ))) <= radius_meters)
    )
  on conflict (booking_id, professional_id) do nothing;

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

drop policy if exists hero_dispatch_recipient_read on public.hero_dispatch_notifications;
create policy hero_dispatch_recipient_read on public.hero_dispatch_notifications
for select to authenticated
using (
  professional_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.professional_profiles pp on pp.profile_id = p.id
    where p.id = (select auth.uid()) and p.role = 'professional'
      and pp.verification_status = 'verified' and pp.suspended_at is null
      and pp.trade_code is not null and pp.operational_zone is not null
      and pp.citizenship_document_path is not null
      and hero_dispatch_notifications.trade_category = coalesce(pp.trade_category, pp.trade_code)
  )
  and exists (
    select 1 from public.bookings b
    join public.professional_service_categories pc
      on pc.professional_id = (select auth.uid()) and pc.category_id = b.category_id
    where b.id = hero_dispatch_notifications.booking_id
      and (
        b.professional_id = (select auth.uid())
        or (
          b.professional_id is null and b.status = 'requested' and b.scheduled_at > now()
          and public.hero_zone_matches_booking((select auth.uid()), coalesce(b.resolved_address, b.service_address))
          and b.latitude is not null and b.longitude is not null
          and public.hero_is_near_booking((select auth.uid()), b.latitude, b.longitude)
        )
      )
  )
);

commit;
