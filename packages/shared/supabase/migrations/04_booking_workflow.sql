begin;

alter table public.bookings
  add column job_details text not null default '' check (char_length(job_details) <= 2000),
  add column duration_minutes integer not null default 60 check (duration_minutes between 30 and 480 and duration_minutes % 30 = 0),
  add column hourly_rate_paisa integer check (hourly_rate_paisa >= 0),
  add column client_request_id uuid,
  add column updated_at timestamptz not null default now(),
  add constraint bookings_request_unique unique (customer_id, client_request_id);

comment on column public.bookings.total_price_paisa is
  'Estimated labour total in integer NPR paisa, snapshotted at request time. NULL means quote pending, not free.';
comment on column public.bookings.hourly_rate_paisa is
  'Hourly rate snapshot for customer-selected professionals. Acceptance never silently reprices a request.';

-- New writes use authenticated, narrowly scoped RPCs, never direct client writes.
revoke insert (customer_id, category_id, service_address, scheduled_at) on public.bookings from authenticated;
revoke insert, update, delete on public.bookings from anon, authenticated;
drop policy bookings_customer_create_own on public.bookings;

drop policy bookings_professional_read on public.bookings;
create policy bookings_professional_read on public.bookings
for select to authenticated
using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'professional')
  and (
    professional_id = (select auth.uid())
    or (
      professional_id is null and status = 'requested' and scheduled_at > now()
      and exists (select 1 from public.professional_profiles pp
        where pp.profile_id = (select auth.uid()) and pp.verification_status = 'verified')
      and exists (select 1 from public.professional_service_categories pc
        where pc.professional_id = (select auth.uid()) and pc.category_id = bookings.category_id)
    )
  )
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status public.booking_status,
  to_status public.booking_status not null,
  created_at timestamptz not null default now()
);
create index booking_status_history_booking_idx on public.booking_status_history(booking_id, created_at);
alter table public.booking_status_history enable row level security;
revoke all on public.booking_status_history from public, anon, authenticated;
grant select on public.booking_status_history to authenticated;
grant all on public.booking_status_history to service_role;
create policy booking_history_participants_read on public.booking_status_history
for select to authenticated
using (exists (select 1 from public.bookings b where b.id = booking_id
  and (b.customer_id = (select auth.uid()) or b.professional_id = (select auth.uid()))));

create function public.create_booking_request(
  p_request_id uuid,
  p_category_id uuid,
  p_professional_id uuid,
  p_service_address text,
  p_job_details text,
  p_scheduled_at timestamptz,
  p_duration_minutes integer
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
    hourly_rate_paisa, service_address, job_details, scheduled_at, duration_minutes, client_request_id
  ) values (
    actor, p_professional_id, p_category_id, 'requested', total::integer,
    rate, btrim(p_service_address), btrim(p_job_details), p_scheduled_at, p_duration_minutes, p_request_id
  ) returning * into result;
  insert into public.booking_request_keys(booking_id, initial_professional_id) values (result.id, p_professional_id);
  insert into public.booking_status_history(booking_id, actor_id, to_status) values (result.id, actor, 'requested');
  return next result;
end;
$$;

-- Private immutable request metadata supports safe retries after assignment.
create table public.booking_request_keys (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  initial_professional_id uuid
);
alter table public.booking_request_keys enable row level security;
revoke all on public.booking_request_keys from public, anon, authenticated;
grant all on public.booking_request_keys to service_role;

create function public.transition_booking(p_booking_id uuid, p_action text)
returns setof public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result public.bookings;
  previous_status public.booking_status;
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED';
  end if;
  if p_action is null or p_action not in ('accepted', 'in_progress', 'completed', 'cancelled') then
    raise exception using errcode = '22023', message = 'INVALID_TRANSITION';
  end if;

  -- Row locks serialize acceptance vs acceptance and acceptance vs cancellation.
  select * into result from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'BOOKING_UNAVAILABLE';
  end if;
  previous_status := result.status;

  if p_action = 'cancelled' then
    if result.customer_id <> actor then
      raise exception using errcode = '42501', message = 'BOOKING_UNAVAILABLE';
    end if;
    if result.status = 'cancelled' then return next result; return; end if;
    if result.status <> 'requested' then
      raise exception using errcode = '22023', message = 'REQUEST_NO_LONGER_PENDING';
    end if;
  else
    perform 1 from public.professional_profiles pp join public.profiles p on p.id = pp.profile_id
      where pp.profile_id = actor and pp.verification_status = 'verified' and p.role = 'professional'
      for share of pp, p;
    if not found then
      raise exception using errcode = '42501', message = 'VERIFIED_PROFESSIONAL_REQUIRED';
    end if;
    if result.customer_id = actor or (result.professional_id is not null and result.professional_id <> actor) then
      raise exception using errcode = '42501', message = 'BOOKING_UNAVAILABLE';
    end if;
    if result.professional_id = actor and result.status::text = p_action then
      return next result; return;
    end if;
    if p_action = 'accepted' then
      if result.status <> 'requested' then
        raise exception using errcode = '22023', message = 'REQUEST_NO_LONGER_PENDING';
      end if;
      perform 1 from public.professional_service_categories
        where professional_id = actor and category_id = result.category_id for share;
      if not found then
        raise exception using errcode = '42501', message = 'CATEGORY_NOT_SUPPORTED';
      end if;
      if result.scheduled_at <= now() then
        raise exception using errcode = '22023', message = 'SCHEDULE_EXPIRED';
      end if;
      -- Also serialize different jobs accepted by the same professional.
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tirkha-pro:' || actor::text, 0));
      if exists (
        select 1 from public.bookings other
        where other.id <> result.id and other.professional_id = actor
          and other.status in ('accepted', 'in_progress')
          and other.scheduled_at < result.scheduled_at + pg_catalog.make_interval(mins => result.duration_minutes)
          and other.scheduled_at + pg_catalog.make_interval(mins => other.duration_minutes) > result.scheduled_at
      ) then
        raise exception using errcode = '22023', message = 'SCHEDULE_CONFLICT';
      end if;
    elsif p_action = 'in_progress' then
      if result.professional_id is distinct from actor or result.status <> 'accepted' then
        raise exception using errcode = '22023', message = 'INVALID_TRANSITION';
      end if;
    elsif p_action = 'completed' then
      if result.professional_id is distinct from actor or result.status <> 'in_progress' then
        raise exception using errcode = '22023', message = 'INVALID_TRANSITION';
      end if;
    end if;
  end if;

  update public.bookings set
    status = p_action::public.booking_status,
    professional_id = case when p_action = 'accepted' then actor else professional_id end,
    updated_at = now()
  where id = result.id returning * into result;
  insert into public.booking_status_history(booking_id, actor_id, from_status, to_status)
    values (result.id, actor, previous_status, result.status);
  return next result;
end;
$$;

revoke all on function public.create_booking_request(uuid, uuid, uuid, text, text, timestamptz, integer) from public, anon, authenticated;
revoke all on function public.transition_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.create_booking_request(uuid, uuid, uuid, text, text, timestamptz, integer) to authenticated;
grant execute on function public.transition_booking(uuid, text) to authenticated;

-- Hosted Supabase already has this publication; test databases may not.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then
    alter publication supabase_realtime add table public.bookings;
  end if;
end;
$$;
commit;
