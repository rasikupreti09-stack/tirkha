begin;

create table public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  client_message_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default clock_timestamp(),
  unique(sender_id,client_message_id)
);
create index booking_messages_timeline on public.booking_messages(booking_id,created_at desc,id desc);
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from public,anon,authenticated;
grant select on public.booking_messages to authenticated;
grant all on public.booking_messages to service_role;
create policy booking_messages_participants on public.booking_messages for select to authenticated
using (exists(select 1 from public.bookings b where b.id=booking_id
  and ((select auth.uid())=b.customer_id or (select auth.uid())=b.professional_id)));

create function public.send_booking_message(p_booking_id uuid,p_client_message_id uuid,p_body text)
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
  if b.professional_id is null or b.status not in ('requested','accepted','in_progress') then raise exception 'CHAT_CLOSED'; end if;
  if exists(select 1 from public.booking_messages where sender_id=actor and created_at>clock_timestamp()-interval '1 second') then raise exception 'MESSAGE_RATE_LIMIT'; end if;
  insert into public.booking_messages(booking_id,sender_id,client_message_id,body)
    values(b.id,actor,p_client_message_id,btrim(p_body)) returning * into result;
  return next result;
end; $$;
revoke all on function public.send_booking_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_booking_message(uuid,uuid,text) to authenticated;

create table public.push_devices (
  token text primary key check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null unique,
  updated_at timestamptz not null default now()
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public,anon,authenticated;
grant all on public.push_devices to service_role;
create function public.register_push_device(p_token text,p_installation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or p_installation_id is null or p_token is null or char_length(p_token)>250
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$' then raise exception 'INVALID_PUSH_DEVICE'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('push-owner:'||actor::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('push:'||p_installation_id::text,0));
  delete from public.push_devices where installation_id=p_installation_id and token<>p_token;
  delete from public.push_devices where user_id=actor and updated_at<now()-interval '30 days';
  if (select count(*) from public.push_devices where user_id=actor and token<>p_token)>=10 then raise exception 'PUSH_DEVICE_LIMIT'; end if;
  insert into public.push_devices(token,user_id,installation_id) values(p_token,actor,p_installation_id)
    on conflict(token) do update set user_id=excluded.user_id,installation_id=excluded.installation_id,updated_at=now();
end; $$;
create function public.unregister_push_device(p_installation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  delete from public.push_devices where installation_id=p_installation_id and user_id=auth.uid();
end; $$;
revoke all on function public.register_push_device(text,uuid) from public,anon,authenticated;
revoke all on function public.unregister_push_device(uuid) from public,anon,authenticated;
grant execute on function public.register_push_device(text,uuid) to authenticated;
grant execute on function public.unregister_push_device(uuid) to authenticated;

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  token text not null,
  kind text not null check(kind in ('chat','job_status')),
  booking_status public.booking_status,
  state text not null default 'queued' check(state in ('queued','processing','receipt','delivered','failed','skipped')),
  attempts integer not null default 0,
  ticket_id text,
  last_error text,
  available_at timestamptz not null default now(),
  lease_id uuid,
  created_at timestamptz not null default now(),
  unique(event_key,token)
);
create index push_outbox_due on public.push_outbox(available_at) where state in ('queued','processing','receipt');
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from public,anon,authenticated;
grant all on public.push_outbox to service_role;

create function public.enqueue_booking_notification() returns trigger
language plpgsql security definer set search_path='' as $$
declare b public.bookings; actor uuid; event_kind text; event_status public.booking_status;
begin
  select * into b from public.bookings where id=new.booking_id;
  if tg_table_name='booking_messages' then actor:=new.sender_id; event_kind:='chat';
  else actor:=new.actor_id; event_kind:='job_status'; event_status:=new.to_status; end if;
  insert into public.push_outbox(event_key,recipient_id,booking_id,token,kind,booking_status)
    select event_kind||':'||new.id::text,d.user_id,b.id,d.token,event_kind,event_status
    from public.push_devices d where d.user_id in (b.customer_id,b.professional_id)
      and d.user_id is distinct from actor and d.updated_at>now()-interval '30 days'
    on conflict(event_key,token) do nothing;
  return new;
end; $$;
create trigger booking_message_push after insert on public.booking_messages for each row execute function public.enqueue_booking_notification();
create trigger booking_status_push after insert on public.booking_status_history for each row execute function public.enqueue_booking_notification();
revoke all on function public.enqueue_booking_notification() from public,anon,authenticated;

create function public.claim_push_jobs(p_lease_id uuid)
returns setof public.push_outbox language plpgsql security definer set search_path='' as $$
begin
  update public.push_outbox set state='failed',last_error='Retry window exhausted'
    where state in ('queued','processing','receipt') and available_at<=now()
      and (attempts>=8 or created_at<now()-interval '23 hours');
  return query
    with due as (select id from public.push_outbox where state in ('queued','processing','receipt')
      and available_at<=now() order by available_at limit 20 for update skip locked)
    update public.push_outbox o set state='processing',lease_id=p_lease_id,attempts=o.attempts+1,available_at=now()+interval '5 minutes'
      from due where o.id=due.id returning o.*;
end; $$;
revoke all on function public.claim_push_jobs(uuid) from public,anon,authenticated;
grant execute on function public.claim_push_jobs(uuid) to service_role;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_messages') then
    alter publication supabase_realtime add table public.booking_messages;
  end if;
end; $$;
commit;
