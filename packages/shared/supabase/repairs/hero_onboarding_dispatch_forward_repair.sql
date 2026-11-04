-- Tirkha production repair: Hero onboarding and regional dispatch.
-- Forward-only and additive: preserves bookings and all financial ledger tables.
-- Run manually in Supabase SQL Editor only after reviewing the preflight output.
-- This does not insert a Supabase migration-ledger row.

begin;

do $preflight$
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.professional_profiles') is null
    or to_regclass('public.bookings') is null
    or to_regclass('public.service_categories') is null
    or to_regclass('public.service_regions') is null
    or to_regclass('public.service_offerings') is null
    or to_regclass('public.professional_service_categories') is null
    or to_regclass('public.hero_locations') is null
    or to_regclass('public.push_outbox') is null
    or to_regclass('public.push_devices') is null then
    raise exception 'Hero repair preflight failed: one or more required base tables are missing; no repair was applied.';
  end if;
end;
$preflight$;

-- Add only fields confirmed missing by the read-only production inventory.
alter table public.professional_profiles
  add column if not exists trade_code text,
  add column if not exists trade_category text,
  add column if not exists operational_zone text,
  add column if not exists citizenship_document_path text,
  add column if not exists suspended_at timestamptz;

alter table public.bookings
  add column if not exists diagnostic_summary text,
  add column if not exists diagnostic_severity text,
  add column if not exists diagnostic_urgency text,
  add column if not exists suggested_parts text[] not null default '{}';

alter table public.hero_locations
  add column if not exists active_booking_id uuid references public.bookings(id) on delete set null;

do $constraints$
begin
  -- Migration 21 used a two-trade constraint. Replace the named constraints
  -- before adding the current seven-trade contract from migrations 23/24.
  alter table public.professional_profiles drop constraint if exists professional_profiles_trade_code_check;
  alter table public.professional_profiles drop constraint if exists professional_profiles_trade_category_check;
  alter table public.professional_profiles drop constraint if exists professional_profiles_operational_zone_check;
  alter table public.professional_profiles add constraint professional_profiles_trade_code_check
    check (trade_code is null or trade_code in ('PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN')) not valid;
  alter table public.professional_profiles add constraint professional_profiles_trade_category_check
    check (trade_category is null or trade_category in ('PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN')) not valid;
  alter table public.professional_profiles add constraint professional_profiles_operational_zone_check
    check (operational_zone is null or operational_zone in ('Kathmandu Valley','Pokhara','Hetauda','Simara')) not valid;
  if not exists (select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_diagnostic_summary_check') then
    alter table public.bookings add constraint bookings_diagnostic_summary_check
      check (diagnostic_summary is null or char_length(btrim(diagnostic_summary)) between 1 and 1200) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_diagnostic_severity_check') then
    alter table public.bookings add constraint bookings_diagnostic_severity_check
      check (diagnostic_severity is null or char_length(btrim(diagnostic_severity)) between 1 and 120) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_diagnostic_urgency_check') then
    alter table public.bookings add constraint bookings_diagnostic_urgency_check
      check (diagnostic_urgency is null or diagnostic_urgency in ('routine','soon','urgent')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_suggested_parts_check') then
    alter table public.bookings add constraint bookings_suggested_parts_check
      check (cardinality(suggested_parts) <= 12 and array_position(suggested_parts, null) is null) not valid;
  end if;
end;
$constraints$;

create table if not exists public.hero_dispatch_notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(profile_id) on delete cascade,
  trade_category text,
  status text not null default 'new' check (status in ('new','seen','accepted','expired')),
  service_name text not null,
  diagnostic_summary text,
  diagnostic_severity text,
  diagnostic_urgency text check (diagnostic_urgency is null or diagnostic_urgency in ('routine','soon','urgent')),
  suggested_parts text[] not null default '{}',
  service_address text not null,
  latitude double precision,
  longitude double precision,
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (booking_id, professional_id),
  check (trade_category is null or trade_category in ('PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN'))
);
create index if not exists hero_dispatch_recipient_recent_idx
  on public.hero_dispatch_notifications(professional_id, created_at desc);
create index if not exists hero_dispatch_booking_idx
  on public.hero_dispatch_notifications(booking_id);
create index if not exists hero_dispatch_trade_recipient_idx
  on public.hero_dispatch_notifications(trade_category, professional_id, status, created_at desc);

alter table public.hero_dispatch_notifications enable row level security;
revoke all on public.hero_dispatch_notifications from public, anon, authenticated;
grant select on public.hero_dispatch_notifications to authenticated;
grant all on public.hero_dispatch_notifications to service_role;

drop policy if exists hero_dispatch_recipient_read on public.hero_dispatch_notifications;
create policy hero_dispatch_recipient_read on public.hero_dispatch_notifications
for select to authenticated
using (
  professional_id = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    join public.professional_profiles pp on pp.profile_id=p.id
    where p.id=(select auth.uid()) and p.role='professional'
      and pp.verification_status='verified' and pp.suspended_at is null
      and pp.citizenship_document_path is not null
      and hero_dispatch_notifications.trade_category=coalesce(pp.trade_category,pp.trade_code)
  )
  and exists (
    select 1 from public.bookings b
    join public.professional_service_categories pc
      on pc.professional_id=(select auth.uid()) and pc.category_id=b.category_id
    where b.id=hero_dispatch_notifications.booking_id
      and (b.professional_id=(select auth.uid()) or
        (b.professional_id is null and b.status='requested' and b.scheduled_at>now()
          and b.service_region_id is not null
          and exists (select 1 from public.service_regions sr
            join public.professional_profiles pp on pp.profile_id=(select auth.uid())
            where sr.id=b.service_region_id and sr.hero_operational_zone=pp.operational_zone)
          and b.latitude is not null and b.longitude is not null
          and public.hero_is_near_booking((select auth.uid()),b.latitude,b.longitude)))
  )
);

-- Private KYC storage; each Hero can upload/read/delete only their own object path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('hero-kyc-documents','hero-kyc-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists hero_kyc_insert_own on storage.objects;
create policy hero_kyc_insert_own on storage.objects for insert to authenticated
with check (bucket_id='hero-kyc-documents'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.profiles p where p.id=(select auth.uid())));
drop policy if exists hero_kyc_read_own_admin on storage.objects;
create policy hero_kyc_read_own_admin on storage.objects for select to authenticated
using (bucket_id='hero-kyc-documents'
  and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_tirkha_admin())));
drop policy if exists hero_kyc_delete_own on storage.objects;
create policy hero_kyc_delete_own on storage.objects for delete to authenticated
using (bucket_id='hero-kyc-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- These helpers scope availability and row-level access to the Hero's verified service region.
create or replace function public.hero_zone_matches_booking(p_professional_id uuid,p_address text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_profiles pp
    where pp.profile_id=p_professional_id and case pp.operational_zone
      when 'Kathmandu Valley' then lower(coalesce(p_address,'')) ~ '(kathmandu|ktm|lalitpur|patan|bhaktapur|thimi|kirtipur|baneshwor|baneshwar|thamel|kupondole|jhamsikhel|jawalakhel|koteshwor|kalanki|chabahil|boudha|boudhanath|maharajgunj|budhanilkantha|tokha|balkhu|imadol|satdobato|gwarko|lubhu|suryabinayak|काठमाडौं|ललितपुर|पाटन|भक्तपुर|थिमी|कीर्तिपुर|बानेश्वर|ठमेल|कोटेश्वर)'
      when 'Pokhara' then lower(coalesce(p_address,'')) ~ '(pokhara|lakeside|phewa|mahendrapul|chipledhunga|baglung bus park|prithvi chowk|birauta|hemja|lekhnath|पोखरा|लेकसाइड)'
      when 'Hetauda' then lower(coalesce(p_address,'')) ~ '(hetauda|makwanpur|buddha chowk|bus park|sanopokhara|rapti road|basamadi|kamane|chisapani|hatiya|padampokhari|hurnamadi|हेटौंडा|हेटौँडा|मकवानपुर|बुद्ध चोक|कमाने|चिसापानी)'
      when 'Simara' then lower(coalesce(p_address,'')) ~ '(simara|jitpur|jeetpur|pathlaiya|amlekhgunj|parwanipur|bara|simara airport|जीतपुर|जितपुर|सिमरा|पथलैया|अमलेखगञ्ज|बारा)'
      else false end
  );
$$;
revoke all on function public.hero_zone_matches_booking(uuid,text) from public,anon;
grant execute on function public.hero_zone_matches_booking(uuid,text) to authenticated;

create or replace function public.hero_is_near_booking(p_professional_id uuid,p_latitude double precision,p_longitude double precision)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_professional_id=(select auth.uid()) and p_latitude is not null and p_longitude is not null
    and exists(select 1 from public.hero_locations hl
      where hl.professional_id=p_professional_id and hl.status='online_idle'
        and hl.updated_at>=now()-interval '5 minutes'
        and 6371000*2*asin(sqrt(least(1::double precision,
          power(sin(radians(p_latitude-hl.latitude)/2),2)
          +cos(radians(hl.latitude))*cos(radians(p_latitude))*power(sin(radians(p_longitude-hl.longitude)/2),2)
        )))<=30000);
$$;
revoke all on function public.hero_is_near_booking(uuid,double precision,double precision) from public,anon;
grant execute on function public.hero_is_near_booking(uuid,double precision,double precision) to authenticated;

-- Latest registration contract used by the web and mobile Hero portals.
create or replace function public.submit_hero_registration(
  p_full_name text,p_phone text,p_trade_code text,p_operational_zone text,p_document_path text
) returns public.verification_status
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  selected_categories uuid[];
  selected_slugs text[];
  resulting_status public.verification_status;
begin
  if actor is null then raise exception using errcode='42501',message='SIGN_IN_REQUIRED'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100
    or p_phone is null or p_phone !~ '^\+9779[0-9]{9}$'
    or p_trade_code is null or p_trade_code not in ('PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN')
    or p_operational_zone is null or p_operational_zone not in ('Kathmandu Valley','Pokhara','Hetauda','Simara')
    or p_document_path is null or p_document_path !~ ('^' || actor::text || '/[A-Za-z0-9._-]+$') then
    raise exception using errcode='22023',message='INVALID_HERO_REGISTRATION';
  end if;
  if exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then
    raise exception using errcode='42501',message='ADMIN_CANNOT_REGISTER_AS_HERO';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='hero-kyc-documents' and o.name=p_document_path) then
    raise exception using errcode='22023',message='ID_DOCUMENT_UPLOAD_REQUIRED';
  end if;
  if not exists(select 1 from public.profiles p where p.id=actor and p.phone=p_phone) then
    raise exception using errcode='42501',message='VERIFIED_PHONE_MISMATCH';
  end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.suspended_at is not null) then
    raise exception using errcode='42501',message='HERO_SUSPENDED_CONTACT_ADMIN';
  end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.verification_status='verified' and pp.suspended_at is null) then
    raise exception using errcode='42501',message='HERO_ALREADY_VERIFIED';
  end if;
  selected_slugs := case p_trade_code
    when 'PLUMBING' then array['plumbing']
    when 'ELECTRICAL' then array['electrical']
    when 'APPLIANCE_TECHNICIAN' then array['appliance-repair']
    when 'BEAUTICIAN' then array['home-salon']
    when 'PAINTER' then array['painting']
    when 'CLEANER' then array['home-cleaning','water-tank-cleaning','sofa-carpet-cleaning']
    else array['general-handyman','carpentry'] end;
  select array_agg(id) into selected_categories from public.service_categories where slug=any(selected_slugs);
  if coalesce(cardinality(selected_categories),0)<>cardinality(selected_slugs) then
    raise exception using errcode='22023',message='TRADE_UNAVAILABLE';
  end if;
  update public.profiles set full_name=btrim(p_full_name),role='professional' where id=actor;
  insert into public.professional_profiles(profile_id,verification_status,trade_code,trade_category,operational_zone,citizenship_document_path,suspended_at)
    values(actor,'pending',p_trade_code,p_trade_code,p_operational_zone,p_document_path,null)
  on conflict(profile_id) do update set
    verification_status='pending'::public.verification_status,
    trade_code=excluded.trade_code,trade_category=excluded.trade_category,
    operational_zone=excluded.operational_zone,citizenship_document_path=excluded.citizenship_document_path,suspended_at=null;
  delete from public.professional_service_categories where professional_id=actor;
  insert into public.professional_service_categories(professional_id,category_id)
    select actor,category_id from unnest(selected_categories) as category_ids(category_id);
  select verification_status into resulting_status from public.professional_profiles where profile_id=actor;
  return resulting_status;
end;
$$;
revoke all on function public.submit_hero_registration(text,text,text,text,text) from public,anon;
grant execute on function public.submit_hero_registration(text,text,text,text,text) to authenticated;

create or replace function public.admin_set_hero_status(p_profile_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_tirkha_admin() then raise exception using errcode='42501',message='ADMIN_REQUIRED'; end if;
  if p_status is null or p_status not in ('verified','rejected','suspended') then raise exception using errcode='22023',message='INVALID_HERO_STATUS'; end if;
  if p_status='verified' and not exists(
    select 1 from public.professional_profiles pp join storage.objects o
      on o.bucket_id='hero-kyc-documents' and o.name=pp.citizenship_document_path
    where pp.profile_id=p_profile_id and coalesce(pp.trade_category,pp.trade_code) is not null
      and pp.operational_zone is not null and pp.citizenship_document_path is not null
  ) then raise exception using errcode='22023',message='HERO_REGISTRATION_INCOMPLETE'; end if;
  update public.professional_profiles set
    verification_status=case when p_status='suspended' then 'verified'::public.verification_status else p_status::public.verification_status end,
    suspended_at=case when p_status='suspended' then now() else null end
  where profile_id=p_profile_id;
  if not found then raise exception using errcode='22023',message='HERO_NOT_FOUND'; end if;
  if p_status<>'verified' then delete from public.hero_locations where professional_id=p_profile_id; end if;
end;
$$;
revoke all on function public.admin_set_hero_status(uuid,text) from public,anon;
grant execute on function public.admin_set_hero_status(uuid,text) to authenticated;

-- Region-aware dispatch function. Its grants are intentionally trigger-only.
create or replace function public.dispatch_new_booking_to_heroes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare radius_meters double precision := 30000;
begin
  if new.status<>'requested' or new.service_region_id is null then return new; end if;
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
    and coalesce(pp.trade_category,pp.trade_code) is not null
    and pp.operational_zone is not null and pp.citizenship_document_path is not null
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
revoke all on function public.dispatch_new_booking_to_heroes() from public,anon,authenticated;

create or replace function public.expire_hero_dispatch_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status or new.professional_id is distinct from old.professional_id then
    update public.hero_dispatch_notifications set status=case
      when new.professional_id=hero_dispatch_notifications.professional_id
        and new.status in ('accepted','on_the_way','in_progress','completed') then 'accepted'
      else 'expired' end
    where booking_id=new.id and status in ('new','seen');
  end if;
  return new;
end;
$$;
revoke all on function public.expire_hero_dispatch_notifications() from public,anon,authenticated;
drop trigger if exists booking_dispatch_close on public.bookings;
create trigger booking_dispatch_close after update of status,professional_id on public.bookings
for each row execute function public.expire_hero_dispatch_notifications();

create or replace function public.mark_hero_dispatch_seen(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.hero_dispatch_notifications set status='seen'
  where id=p_notification_id and professional_id=(select auth.uid()) and status='new';
  if not found then raise exception using errcode='42501',message='DISPATCH_UNAVAILABLE'; end if;
end;
$$;
revoke all on function public.mark_hero_dispatch_seen(uuid) from public,anon;
grant execute on function public.mark_hero_dispatch_seen(uuid) to authenticated;

-- Rebuild the professional read policy with trade, region, verification and GPS gates.
drop policy if exists bookings_professional_read on public.bookings;
create policy bookings_professional_read on public.bookings for select to authenticated
using (
  exists(select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id
    where p.id=(select auth.uid()) and p.role='professional'
      and pp.verification_status='verified' and pp.suspended_at is null
      and coalesce(pp.trade_category,pp.trade_code) is not null
      and pp.operational_zone is not null and pp.citizenship_document_path is not null)
  and (professional_id=(select auth.uid()) or (
    professional_id is null and status='requested' and scheduled_at>now()
    and exists(select 1 from public.professional_service_categories pc
      where pc.professional_id=(select auth.uid()) and pc.category_id=bookings.category_id)
    and exists(select 1 from public.service_regions sr join public.professional_profiles pp on pp.profile_id=(select auth.uid())
      where sr.id=bookings.service_region_id and sr.hero_operational_zone=pp.operational_zone)
    and public.hero_zone_matches_booking((select auth.uid()),coalesce(resolved_address,service_address))
    and latitude is not null and longitude is not null
    and public.hero_is_near_booking((select auth.uid()),bookings.latitude,bookings.longitude)
  ))
);

-- Dispatch event subscriptions are recipient-scoped by the policy above.
drop trigger if exists booking_hero_dispatch on public.bookings;
create trigger booking_hero_dispatch after update of diagnostic_summary on public.bookings
for each row when (new.status='requested' and old.status='requested')
execute function public.dispatch_new_booking_to_heroes();

drop trigger if exists booking_region_dispatch on public.bookings;
create trigger booking_region_dispatch after update of service_region_id,service_offering_id on public.bookings
for each row when (new.status='requested' and old.service_region_id is null and new.service_region_id is not null)
execute function public.dispatch_new_booking_to_heroes();

-- Preserve the existing push kinds while allowing the Hero dispatch event.
alter table public.push_outbox drop constraint if exists push_outbox_kind_check;
alter table public.push_outbox add constraint push_outbox_kind_check
  check (kind in ('chat','job_status','hero_dispatch')) not valid;

do $realtime$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
      and schemaname='public' and tablename='hero_dispatch_notifications') then
    alter publication supabase_realtime add table public.hero_dispatch_notifications;
  end if;
end;
$realtime$;

commit;
