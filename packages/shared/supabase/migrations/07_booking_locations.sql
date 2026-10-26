begin;
alter table public.bookings
  add column latitude double precision,
  add column longitude double precision,
  add column resolved_address text,
  add constraint booking_coordinate_pair check ((latitude is null) = (longitude is null)),
  add constraint booking_latitude_range check (latitude between -90 and 90),
  add constraint booking_longitude_range check (longitude between -180 and 180),
  add constraint booking_resolved_address check (resolved_address is null or (latitude is not null and char_length(btrim(resolved_address)) between 2 and 200));

-- Replace the old signature: trailing defaults preserve legacy/manual bookings
-- without creating ambiguous overloads in PostgREST. Retries compare the pin too.
drop function public.create_booking_request(uuid, uuid, uuid, text, text, timestamptz, integer);
create function public.create_booking_request(
  p_request_id uuid,
  p_category_id uuid,
  p_professional_id uuid,
  p_service_address text,
  p_job_details text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_resolved_address text default null
)
returns setof public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.bookings;
  rate integer;
  total numeric;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'customer') then
    raise exception using errcode = '42501', message = 'CUSTOMER_REQUIRED';
  end if;
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'REQUEST_ID_REQUIRED';
  end if;

  -- Serialize duplicate network retries for this customer and request ID.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_request_id::text, 0));
  select * into result from public.bookings where customer_id = actor and client_request_id = p_request_id;
  if found then
    if result.category_id is distinct from p_category_id
      or result.service_address is distinct from btrim(p_service_address)
      or result.job_details is distinct from btrim(p_job_details)
      or result.scheduled_at is distinct from p_scheduled_at
      or result.latitude is distinct from p_latitude
      or result.longitude is distinct from p_longitude
      or result.resolved_address is distinct from nullif(btrim(p_resolved_address), '')
      or result.duration_minutes is distinct from p_duration_minutes then
      raise exception using errcode = '22023', message = 'REQUEST_ID_REUSED';
    end if;
    -- The professional may have accepted an originally unassigned request.
    -- Record the original assignment separately below for retry comparisons.
    if (select initial_professional_id from public.booking_request_keys
        where booking_id = result.id) is distinct from p_professional_id then
      raise exception using errcode = '22023', message = 'REQUEST_ID_REUSED';
    end if;
    return next result; return;
  end if;

  if p_scheduled_at is null or not isfinite(p_scheduled_at)
    or p_scheduled_at <= now() or p_scheduled_at > now() + interval '365 days' then
    raise exception using errcode = '22023', message = 'INVALID_SCHEDULE';
  end if;
  if p_duration_minutes is null or p_duration_minutes < 30 or p_duration_minutes > 480 or p_duration_minutes % 30 <> 0 then
    raise exception using errcode = '22023', message = 'INVALID_DURATION';
  end if;
  if p_service_address is null or char_length(btrim(p_service_address)) not between 5 and 500
    or p_job_details is null or char_length(btrim(p_job_details)) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_JOB_DETAILS';
  end if;
  if not exists (select 1 from public.service_categories where id = p_category_id) then
    raise exception using errcode = '22023', message = 'CATEGORY_UNAVAILABLE';
  end if;

  if p_professional_id is not null then
    if p_professional_id = actor then
      raise exception using errcode = '42501', message = 'PROFESSIONAL_UNAVAILABLE';
    end if;
    select pp.hourly_rate_paisa into rate
      from public.professional_profiles pp
      join public.profiles p on p.id = pp.profile_id
      join public.professional_service_categories pc on pc.professional_id = pp.profile_id
      where pp.profile_id = p_professional_id and p.role = 'professional'
        and pp.verification_status = 'verified' and pc.category_id = p_category_id
      for share of pp, p, pc;
    if not found then
      raise exception using errcode = '42501', message = 'PROFESSIONAL_UNAVAILABLE';
    end if;
  end if;
  total := round(rate::numeric * p_duration_minutes / 60);
  if total > 2147483647 then
    raise exception using errcode = '22003', message = 'PRICE_TOO_LARGE';
  end if;

  insert into public.bookings (
    customer_id, professional_id, category_id, status, total_price_paisa,
    hourly_rate_paisa, service_address, job_details, scheduled_at, duration_minutes, client_request_id, latitude, longitude, resolved_address
  ) values (
    actor, p_professional_id, p_category_id, 'requested', total::integer,
    rate, btrim(p_service_address), btrim(p_job_details), p_scheduled_at, p_duration_minutes, p_request_id, p_latitude, p_longitude, nullif(btrim(p_resolved_address), '')
  ) returning * into result;
  insert into public.booking_request_keys(booking_id, initial_professional_id) values (result.id, p_professional_id);
  insert into public.booking_status_history(booking_id, actor_id, to_status) values (result.id, actor, 'requested');
  return next result;
end;
$$;

revoke all on function public.create_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.create_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text) to authenticated;

-- A single gate shared by every web worker and mobile caller. Hold until the
-- provider request finishes, then leave a cooldown; a crashed worker expires.
create table public.geocoding_gate (
  id boolean primary key default true check (id),
  lease_id uuid,
  next_allowed_at timestamptz not null default '-infinity'
);
insert into public.geocoding_gate(id) values (true);
create table public.geocoding_cache (
  key text primary key,
  area text not null check (char_length(area) between 2 and 200),
  expires_at timestamptz not null
);
alter table public.geocoding_gate enable row level security;
alter table public.geocoding_cache enable row level security;
revoke all on public.geocoding_gate, public.geocoding_cache from public,anon,authenticated;
grant all on public.geocoding_gate, public.geocoding_cache to service_role;

create function public.claim_geocoding(p_lease_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_lease_id is null then return false; end if;
  update public.geocoding_gate set lease_id = p_lease_id, next_allowed_at = clock_timestamp() + interval '30 seconds'
    where id and next_allowed_at <= clock_timestamp();
  return found;
end;
$$;
create function public.release_geocoding(p_lease_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.geocoding_gate set lease_id = null, next_allowed_at = clock_timestamp() + interval '1100 milliseconds'
    where id and lease_id = p_lease_id;
$$;
revoke all on function public.claim_geocoding(uuid), public.release_geocoding(uuid) from public,anon,authenticated;
grant execute on function public.claim_geocoding(uuid), public.release_geocoding(uuid) to service_role;
commit;
