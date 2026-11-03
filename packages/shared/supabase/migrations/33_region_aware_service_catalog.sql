begin;

create table public.service_regions (
  id text primary key check (id ~ '^[a-z][a-z0-9-]{1,39}$'),
  display_name text not null unique,
  hero_operational_zone text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_region_aliases (
  map_region_key text primary key,
  service_region_id text not null references public.service_regions(id) on delete restrict,
  display_name text not null,
  constraint service_region_aliases_key_check check (map_region_key in (
    'Kathmandu Valley','Kathmandu','Lalitpur','Bhaktapur','Kirtipur','Pokhara',
    'Hetauda','Simara','Chitwan','Jhapa','Sunsari'
  ))
);

insert into public.service_regions(id,display_name,hero_operational_zone) values
 ('kathmandu-valley','Kathmandu Valley','Kathmandu Valley'),
 ('pokhara','Pokhara','Pokhara'),
 ('hetauda','Hetauda','Hetauda'),
 ('simara','Simara','Simara'),
 ('chitwan','Chitwan',null),
 ('jhapa','Jhapa',null),
 ('sunsari','Sunsari',null);

insert into public.service_region_aliases(map_region_key,service_region_id,display_name) values
 ('Kathmandu Valley','kathmandu-valley','Kathmandu Valley'),
 ('Kathmandu','kathmandu-valley','Kathmandu'),
 ('Lalitpur','kathmandu-valley','Lalitpur'),
 ('Bhaktapur','kathmandu-valley','Bhaktapur'),
 ('Kirtipur','kathmandu-valley','Kirtipur'),
 ('Pokhara','pokhara','Pokhara'),('Hetauda','hetauda','Hetauda'),('Simara','simara','Simara'),
 ('Chitwan','chitwan','Chitwan'),('Jhapa','jhapa','Jhapa'),('Sunsari','sunsari','Sunsari');

create table public.service_region_availability (
  service_offering_id text not null references public.service_offerings(id) on delete cascade,
  service_region_id text not null references public.service_regions(id) on delete restrict,
  status text not null check (status in ('available','coming_soon','paused')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key(service_offering_id,service_region_id)
);
create index service_region_availability_region_status_idx on public.service_region_availability(service_region_id,status,service_offering_id);

-- Treat the legacy array as evidence only for pairs explicitly listed before the
-- Hetauda/Simara blanket update. Those two additions are deliberately ignored.
insert into public.service_region_availability(service_offering_id,service_region_id,status)
select so.id, sr.id,
  case
    when sr.id='kathmandu-valley' and so.regions && array['Kathmandu','Lalitpur','Bhaktapur','Kirtipur','Kathmandu Valley']::text[] then 'available'
    when sr.id='pokhara' and 'Pokhara'=any(so.regions) then 'available'
    else 'coming_soon'
  end
from public.service_offerings so cross join public.service_regions sr
on conflict(service_offering_id,service_region_id) do nothing;

comment on table public.service_region_availability is
  'Admin-managed source of truth for whether each service offering may be booked in each region. Missing rows always behave as coming_soon.';
create function public.initialize_service_region_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.service_region_availability(service_offering_id,service_region_id,status)
  select new.id,r.id,'coming_soon' from public.service_regions r where r.enabled
  on conflict(service_offering_id,service_region_id) do nothing;
  return new;
end;
$$;
revoke all on function public.initialize_service_region_availability() from public,anon,authenticated;
create trigger service_offering_default_region_availability after insert on public.service_offerings
for each row execute function public.initialize_service_region_availability();

alter table public.service_regions enable row level security;
alter table public.service_region_aliases enable row level security;
alter table public.service_region_availability enable row level security;
revoke all on public.service_regions,public.service_region_aliases,public.service_region_availability from public,anon,authenticated;
grant select on public.service_regions,public.service_region_aliases to anon,authenticated;
grant select,insert,update,delete on public.service_regions,public.service_region_aliases,public.service_region_availability to authenticated;
grant all on public.service_regions,public.service_region_aliases,public.service_region_availability to service_role;
create policy service_regions_public_read on public.service_regions for select to anon,authenticated using(enabled);
create policy service_region_aliases_public_read on public.service_region_aliases for select to anon,authenticated using(true);
create policy service_region_admin_write on public.service_regions for all to authenticated using((select public.is_tirkha_admin())) with check((select public.is_tirkha_admin()));
create policy service_region_alias_admin_write on public.service_region_aliases for all to authenticated using((select public.is_tirkha_admin())) with check((select public.is_tirkha_admin()));
create policy service_availability_admin_read on public.service_region_availability for select to authenticated using((select public.is_tirkha_admin()));
create policy service_availability_admin_write on public.service_region_availability for all to authenticated using((select public.is_tirkha_admin())) with check((select public.is_tirkha_admin()));

create function public.get_regional_service_catalog(p_map_region_key text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  selected_region text;
  selected_display text;
  result jsonb;
begin
  select a.service_region_id,a.display_name into selected_region,selected_display
    from public.service_region_aliases a
    join public.service_regions r on r.id=a.service_region_id and r.enabled
    where a.map_region_key=p_map_region_key;
  if selected_region is null then raise exception using errcode='22023',message='INVALID_SERVICE_REGION'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'service',to_jsonb(so),'availability_status',case when sr.hero_operational_zone is null and coalesce(a.status,'coming_soon')='available' then 'coming_soon' else coalesce(a.status,'coming_soon') end,'region_id',selected_region,'region_name',selected_display
  ) order by so.sort_order,so.id),'[]'::jsonb)
  into result
  from public.service_offerings so
  left join public.service_region_availability a on a.service_offering_id=so.id and a.service_region_id=selected_region
  join public.service_regions sr on sr.id=selected_region
  where so.active;
  return result;
end;
$$;
revoke all on function public.get_regional_service_catalog(text) from public,anon,authenticated;
grant execute on function public.get_regional_service_catalog(text) to anon,authenticated;

alter table public.bookings add column service_region_id text references public.service_regions(id) on delete restrict;
alter table public.bookings add column service_offering_id text references public.service_offerings(id) on delete restrict;
create index bookings_service_region_status_idx on public.bookings(service_region_id,status,scheduled_at desc);
create index bookings_service_offering_status_idx on public.bookings(service_offering_id,status,scheduled_at desc);
create function public.apply_booking_region_context() returns trigger
language plpgsql set search_path = '' as $$
declare selected_region text := nullif(pg_catalog.current_setting('tirkha.service_region_id',true),'');
begin
  if selected_region is not null then
    if not exists(select 1 from public.service_regions where id=selected_region and enabled) then
      raise exception using errcode='22023',message='INVALID_SERVICE_REGION';
    end if;
    new.service_region_id := selected_region;
  end if;
  return new;
end;
$$;
create trigger bookings_set_region_context before insert on public.bookings
for each row execute function public.apply_booking_region_context();
revoke all on function public.apply_booking_region_context() from public,anon,authenticated;

-- Prevent legacy RPCs from bypassing the regional availability gateway.
revoke all on function public.create_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text) from public,anon,authenticated;

create or replace function public.dispatch_new_booking_to_heroes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare radius_meters double precision := 30000;
begin
  if new.status<>'requested' then return new; end if;
  if new.service_region_id is null then return new; end if;
  insert into public.hero_dispatch_notifications(
    booking_id,professional_id,trade_category,service_name,diagnostic_summary,diagnostic_severity,
    diagnostic_urgency,suggested_parts,service_address,latitude,longitude,distance_meters,scheduled_at
  )
  select new.id,p.id,coalesce(pp.trade_category,pp.trade_code),coalesce(offering.title,category.name),
    new.diagnostic_summary,new.diagnostic_severity,new.diagnostic_urgency,new.suggested_parts,
    new.service_address,new.latitude,new.longitude,
    case when hl.latitude is null or new.latitude is null then null else round(6371000*2*asin(sqrt(least(1::double precision,
      power(sin(radians(new.latitude-hl.latitude)/2),2)
      +cos(radians(hl.latitude))*cos(radians(new.latitude))*power(sin(radians(new.longitude-hl.longitude)/2),2)
    ))))::integer end,new.scheduled_at
  from public.professional_service_categories pc
  join public.professional_profiles pp on pp.profile_id=pc.professional_id
    and pp.verification_status='verified' and pp.suspended_at is null
    and coalesce(pp.trade_category,pp.trade_code) is not null and pp.operational_zone is not null
    and pp.citizenship_document_path is not null
  join public.profiles p on p.id=pp.profile_id and p.role='professional'
  join public.service_categories category on category.id=pc.category_id
  left join public.service_offerings offering on offering.id=new.service_offering_id
  join public.service_regions sr on sr.id=new.service_region_id and sr.hero_operational_zone=pp.operational_zone
  left join public.hero_locations hl on hl.professional_id=p.id
  where pc.category_id=new.category_id and (new.professional_id is null or p.id=new.professional_id)
    and public.hero_zone_matches_booking(p.id,coalesce(new.resolved_address,new.service_address))
    and ((new.professional_id is not null) or (new.latitude is not null and new.longitude is not null
      and hl.status='online_idle' and hl.updated_at>=now()-interval '5 minutes'
      and 6371000*2*asin(sqrt(least(1::double precision,
        power(sin(radians(new.latitude-hl.latitude)/2),2)
        +cos(radians(hl.latitude))*cos(radians(new.latitude))*power(sin(radians(new.longitude-hl.longitude)/2),2)
      )))<=radius_meters))
  on conflict(booking_id,professional_id) do nothing;

  insert into public.push_outbox(event_key,recipient_id,booking_id,token,kind,booking_status)
  select 'hero_dispatch:'||n.booking_id::text||':'||n.professional_id::text,n.professional_id,n.booking_id,d.token,'hero_dispatch',null
  from public.hero_dispatch_notifications n
  join public.push_devices d on d.user_id=n.professional_id and d.updated_at>now()-interval '30 days'
  where n.booking_id=new.id and n.status='new'
  on conflict(event_key,token) do nothing;
  return new;
end;
$$;
create trigger booking_region_dispatch after update of service_region_id,service_offering_id on public.bookings
for each row when (new.status='requested' and old.service_region_id is null and new.service_region_id is not null)
execute function public.dispatch_new_booking_to_heroes();

-- The older signature is no longer executable by clients. This wrapper validates
-- availability and region before delegating to the established booking logic.
revoke all on function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[]) from public,anon,authenticated;
alter function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[]) rename to create_diagnostic_booking_request_unchecked;
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
  p_suggested_parts text[] default '{}',
  p_map_region_key text default null,
  p_service_offering_id text default null
)
returns setof public.bookings language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  v_region_id text;
  v_region_display text;
  result public.bookings;
  existing public.bookings;
  availability text;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='customer') then
    raise exception using errcode='42501',message='CUSTOMER_REQUIRED';
  end if;
  if p_map_region_key is null then raise exception using errcode='22023',message='SERVICE_REGION_REQUIRED'; end if;
  if p_service_offering_id is null then raise exception using errcode='22023',message='SERVICE_OFFERING_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':'||p_request_id::text,0));
  select a.service_region_id,a.display_name into v_region_id,v_region_display
    from public.service_region_aliases a join public.service_regions r on r.id=a.service_region_id and r.enabled
    where a.map_region_key=p_map_region_key;
  if v_region_id is null then raise exception using errcode='22023',message='INVALID_SERVICE_REGION'; end if;

  select * into existing from public.bookings where customer_id=actor and client_request_id=p_request_id;
  if found then
    if existing.service_region_id is distinct from v_region_id or existing.service_offering_id is distinct from p_service_offering_id then
      raise exception using errcode='22023',message='REQUEST_ID_REUSED';
    end if;
    select * into result from public.create_diagnostic_booking_request_unchecked(
      p_request_id,p_category_id,p_professional_id,p_service_address,p_job_details,p_scheduled_at,p_duration_minutes,
      p_latitude,p_longitude,p_resolved_address,p_diagnostic_summary,p_diagnostic_severity,p_diagnostic_urgency,p_suggested_parts
    );
    return next result;
    return;
  end if;

  select a.status into availability
  from public.service_categories c
  join public.service_offerings so on so.category_slug=c.slug and so.active and so.id=p_service_offering_id
  join public.service_region_availability a on a.service_offering_id=so.id and a.service_region_id=v_region_id
  join public.service_regions sr on sr.id=v_region_id and sr.hero_operational_zone is not null
  where c.id=p_category_id and a.status='available'
  order by so.sort_order limit 1 for share of a;
  if not found then
    raise exception using errcode='22023',message='SERVICE_NOT_AVAILABLE_IN_REGION',detail=v_region_display;
  end if;

  perform pg_catalog.set_config('tirkha.service_region_id',v_region_id,true);
  select * into result from public.create_diagnostic_booking_request_unchecked(
    p_request_id,p_category_id,p_professional_id,p_service_address,p_job_details,p_scheduled_at,p_duration_minutes,
    p_latitude,p_longitude,p_resolved_address,p_diagnostic_summary,p_diagnostic_severity,p_diagnostic_urgency,p_suggested_parts
  );
  update public.bookings set service_region_id=v_region_id,service_offering_id=p_service_offering_id
    where id=result.id and customer_id=actor returning * into result;
  if not found then raise exception using errcode='42501',message='BOOKING_UNAVAILABLE'; end if;
  return next result;
end;
$$;
revoke all on function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.create_diagnostic_booking_request(uuid,uuid,uuid,text,text,timestamptz,integer,double precision,double precision,text,text,text,text,text[],text,text) to authenticated;

commit;
