begin;
-- Preserve authorization, row locks, retry safety, history and push triggers.
create or replace function public.transition_booking(p_booking_id uuid, p_action text)
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
  if p_action is null or p_action not in ('accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled') then
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
          and other.status in ('accepted', 'on_the_way', 'in_progress')
          and other.scheduled_at < result.scheduled_at + pg_catalog.make_interval(mins => result.duration_minutes)
          and other.scheduled_at + pg_catalog.make_interval(mins => other.duration_minutes) > result.scheduled_at
      ) then
        raise exception using errcode = '22023', message = 'SCHEDULE_CONFLICT';
      end if;
    elsif p_action = 'on_the_way' then
      if result.professional_id is distinct from actor or result.status <> 'accepted' then
        raise exception using errcode = '22023', message = 'INVALID_TRANSITION';
      end if;
    elsif p_action = 'in_progress' then
      if result.professional_id is distinct from actor or result.status <> 'on_the_way' then
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

create or replace function public.send_booking_message(p_booking_id uuid,p_client_message_id uuid,p_body text)
returns setof public.booking_messages language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); b public.bookings; result public.booking_messages;
begin
  if actor is null then raise exception 'SIGN_IN_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat:'||actor::text,0));
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or (actor is distinct from b.customer_id and actor is distinct from b.professional_id) then raise exception 'CHAT_UNAVAILABLE'; end if;
  if p_client_message_id is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'INVALID_MESSAGE'; end if;
  select * into result from public.booking_messages where sender_id=actor and client_message_id=p_client_message_id;
  if found then
    if result.booking_id<>p_booking_id or result.body<>btrim(p_body) then raise exception 'MESSAGE_ID_REUSED'; end if;
    return next result; return;
  end if;
  if b.professional_id is null or b.status not in ('requested','accepted','on_the_way','in_progress') then raise exception 'CHAT_CLOSED'; end if;
  if exists(select 1 from public.booking_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 second') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  insert into public.booking_messages(booking_id,sender_id,client_message_id,body)
    values(b.id,actor,p_client_message_id,btrim(p_body)) returning * into result;
  return next result;
end; $$;

commit;
