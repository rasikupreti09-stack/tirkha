-- Slot 2: Hero onboarding, KYC, zone gating, quote capture and receipts.
-- The platform commission is stored as basis points and never inferred from UI input.
begin;

alter table public.professional_profiles
  add column if not exists trade_code text check (trade_code is null or trade_code in ('PLUMBING','ELECTRICAL')),
  add column if not exists operational_zone text check (operational_zone is null or operational_zone in ('Kathmandu','Lalitpur','Bhaktapur','Baneshwor','Thamel','Kirtipur')),
  add column if not exists citizenship_document_path text,
  add column if not exists suspended_at timestamptz;

create or replace function public.submit_hero_registration(
  p_full_name text,
  p_phone text,
  p_trade_code text,
  p_operational_zone text,
  p_document_path text
) returns public.verification_status
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  selected_category uuid;
  resulting_status public.verification_status;
begin
  if actor is null then raise exception using errcode = '42501', message = 'SIGN_IN_REQUIRED'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100
    or p_phone is null or p_phone !~ '^\+9779[0-9]{9}$'
    or p_trade_code is null or p_trade_code not in ('PLUMBING','ELECTRICAL')
    or p_operational_zone is null or p_operational_zone not in ('Kathmandu','Lalitpur','Bhaktapur','Baneshwor','Thamel','Kirtipur')
    or p_document_path is null or p_document_path !~ ('^' || actor::text || '/[A-Za-z0-9._-]+$') then
    raise exception using errcode = '22023', message = 'INVALID_HERO_REGISTRATION';
  end if;
  if exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then
    raise exception using errcode='42501',message='ADMIN_CANNOT_REGISTER_AS_HERO';
  end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='hero-kyc-documents' and o.name=p_document_path) then
    raise exception using errcode='22023',message='ID_DOCUMENT_UPLOAD_REQUIRED';
  end if;
  if not exists(select 1 from public.profiles p where p.id = actor and p.phone = p_phone) then
    raise exception using errcode = '42501', message = 'VERIFIED_PHONE_MISMATCH';
  end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.suspended_at is not null) then
    raise exception using errcode='42501',message='HERO_SUSPENDED_CONTACT_ADMIN';
  end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.verification_status='verified' and pp.suspended_at is null) then
    raise exception using errcode='42501',message='HERO_ALREADY_VERIFIED';
  end if;
  select id into selected_category from public.service_categories
    where slug = case p_trade_code when 'PLUMBING' then 'plumbing' else 'electrical' end;
  if selected_category is null then raise exception using errcode = '22023', message = 'TRADE_UNAVAILABLE'; end if;

  update public.profiles set full_name = btrim(p_full_name), role = 'professional' where id = actor;
  insert into public.professional_profiles(profile_id, verification_status, trade_code, operational_zone, citizenship_document_path, suspended_at)
    values(actor, 'pending', p_trade_code, p_operational_zone, p_document_path, null)
  on conflict(profile_id) do update set
    verification_status = 'pending'::public.verification_status,
    trade_code = excluded.trade_code,
    operational_zone = excluded.operational_zone,
    citizenship_document_path = excluded.citizenship_document_path,
    suspended_at = null;
  delete from public.professional_service_categories where professional_id = actor;
  insert into public.professional_service_categories(professional_id, category_id) values(actor, selected_category);
  select verification_status into resulting_status from public.professional_profiles where profile_id = actor;
  return resulting_status;
end; $$;
revoke all on function public.submit_hero_registration(text,text,text,text,text) from public, anon;
grant execute on function public.submit_hero_registration(text,text,text,text,text) to authenticated;

create or replace function public.admin_set_hero_status(p_profile_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_tirkha_admin() then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if p_status is null or p_status not in ('verified','rejected','suspended') then raise exception using errcode = '22023', message = 'INVALID_HERO_STATUS'; end if;
  if p_status='verified' and not exists(select 1 from public.professional_profiles pp join storage.objects o
      on o.bucket_id='hero-kyc-documents' and o.name=pp.citizenship_document_path
      where pp.profile_id=p_profile_id and pp.trade_code is not null and pp.operational_zone is not null
        and pp.citizenship_document_path is not null) then
    raise exception using errcode='22023',message='HERO_REGISTRATION_INCOMPLETE';
  end if;
  update public.professional_profiles set
    verification_status = case when p_status = 'suspended' then 'verified'::public.verification_status else p_status::public.verification_status end,
    suspended_at = case when p_status = 'suspended' then now() else null end
  where profile_id = p_profile_id;
  if not found then raise exception using errcode = '22023', message = 'HERO_NOT_FOUND'; end if;
  if p_status <> 'verified' then delete from public.hero_locations where professional_id = p_profile_id; end if;
end; $$;
revoke all on function public.admin_set_hero_status(uuid,text) from public, anon;
grant execute on function public.admin_set_hero_status(uuid,text) to authenticated;

create or replace function public.hero_zone_matches_booking(p_professional_id uuid, p_address text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_profiles pp
    where pp.profile_id = p_professional_id and pp.operational_zone is not null
      and lower(coalesce(p_address,'')) like '%' || lower(pp.operational_zone) || '%'
  );
$$;
revoke all on function public.hero_zone_matches_booking(uuid,text) from public, anon;
grant execute on function public.hero_zone_matches_booking(uuid,text) to authenticated;

-- Available requests are only visible within the Hero's approved trade, chosen zone and dispatch radius.
drop policy if exists bookings_professional_read on public.bookings;
create policy bookings_professional_read on public.bookings
for select to authenticated
using (
  exists (select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id = p.id
    where p.id = (select auth.uid()) and p.role = 'professional'
      and pp.verification_status = 'verified' and pp.suspended_at is null
      and pp.trade_code is not null and pp.operational_zone is not null and pp.citizenship_document_path is not null)
  and (
    professional_id = (select auth.uid())
    or (
      professional_id is null and status = 'requested' and scheduled_at > now()
      and exists (select 1 from public.professional_service_categories pc
        where pc.professional_id = (select auth.uid()) and pc.category_id = bookings.category_id)
      and public.hero_zone_matches_booking((select auth.uid()), coalesce(resolved_address, service_address))
      and latitude is not null and longitude is not null
      and public.hero_is_near_booking((select auth.uid()), bookings.latitude, bookings.longitude)
    )
  )
);

-- Dispatch alerts use the same zone boundary as the job-board RLS policy.
create or replace function public.dispatch_new_booking_to_heroes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare radius_meters double precision := 20000;
begin
  if new.status <> 'requested' then return new; end if;
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
  join public.professional_profiles pp on pp.profile_id = pc.professional_id
    and pp.verification_status = 'verified' and pp.suspended_at is null
    and pp.trade_code is not null and pp.operational_zone is not null and pp.citizenship_document_path is not null
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
end; $$;

-- Quotes are a separate, immutable customer-facing record, never a chat/photo store.
create table if not exists public.professional_job_quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(profile_id) on delete restrict,
  labor_paisa integer not null check (labor_paisa >= 0),
  materials_paisa integer not null check (materials_paisa >= 0),
  total_paisa bigint generated always as (labor_paisa::bigint + materials_paisa::bigint) stored,
  materials_breakdown text not null check (char_length(btrim(materials_breakdown)) between 1 and 2000),
  scope text not null check (char_length(btrim(scope)) between 10 and 2000),
  created_at timestamptz not null default now()
);
alter table public.professional_job_quotes enable row level security;
revoke all on public.professional_job_quotes from public, anon, authenticated;
grant select on public.professional_job_quotes to authenticated, service_role;
create policy professional_job_quotes_participant_read on public.professional_job_quotes for select to authenticated
  using (professional_id = (select auth.uid()) or exists(
    select 1 from public.bookings b where b.id = booking_id
      and (b.customer_id = (select auth.uid()) or public.is_tirkha_admin())
  ));
create or replace function public.submit_professional_job_quote(
  p_booking_id uuid, p_labor_paisa integer, p_materials_paisa integer,
  p_materials_breakdown text, p_scope text
) returns public.professional_job_quotes
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result public.professional_job_quotes;
begin
  if actor is null or p_labor_paisa is null or p_labor_paisa < 0 or p_materials_paisa is null or p_materials_paisa < 0
    or p_labor_paisa::bigint + p_materials_paisa::bigint > 2147483647
    or p_materials_breakdown is null or char_length(btrim(p_materials_breakdown)) not between 1 and 2000
    or p_scope is null or char_length(btrim(p_scope)) not between 10 and 2000 then
    raise exception using errcode = '22023', message = 'INVALID_JOB_QUOTE';
  end if;
  if not exists(select 1 from public.bookings b join public.professional_profiles pp on pp.profile_id = b.professional_id
    where b.id = p_booking_id and b.professional_id = actor and b.status = 'in_progress'
      and pp.verification_status = 'verified' and pp.suspended_at is null) then
    raise exception using errcode = '42501', message = 'ON_SITE_INSPECTION_REQUIRED';
  end if;
  insert into public.professional_job_quotes(booking_id,professional_id,labor_paisa,materials_paisa,materials_breakdown,scope)
  values(p_booking_id,actor,p_labor_paisa,p_materials_paisa,btrim(p_materials_breakdown),btrim(p_scope))
  returning * into result;
  return result;
end; $$;
revoke all on function public.submit_professional_job_quote(uuid,integer,integer,text,text) from public, anon;
grant execute on function public.submit_professional_job_quote(uuid,integer,integer,text,text) to authenticated;

-- Financial history stores completed paid/COD receipts only. No transient messages or images.
create table if not exists public.hero_completed_receipts (
  booking_id uuid primary key references public.bookings(id) on delete restrict,
  professional_id uuid not null references public.professional_profiles(profile_id) on delete restrict,
  service_name text not null,
  payment_method text not null check (payment_method in ('COD','ESEWA','KHALTI')),
  gross_paisa integer not null check (gross_paisa > 0),
  commission_rate_basis_points integer not null check (commission_rate_basis_points between 1000 and 1500),
  commission_paisa integer not null check (commission_paisa >= 0),
  net_paisa integer not null check (net_paisa >= 0),
  created_at timestamptz not null default now(),
  check (gross_paisa = commission_paisa + net_paisa)
);
create index if not exists hero_completed_receipts_owner_time_idx on public.hero_completed_receipts(professional_id,created_at desc);
alter table public.hero_completed_receipts enable row level security;
revoke all on public.hero_completed_receipts from public, anon, authenticated;
grant select on public.hero_completed_receipts to authenticated, service_role;
create policy hero_completed_receipts_owner_admin_read on public.hero_completed_receipts for select to authenticated
  using (professional_id = (select auth.uid()) or (select public.is_tirkha_admin()));
create or replace function public.record_hero_completed_receipt(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.hero_completed_receipts r where r.booking_id=p_booking_id and not exists(
    select 1 from public.bookings b where b.id=p_booking_id and b.status='completed' and b.professional_id is not null
      and b.total_price_paisa>0 and ((b.payment_method='COD' and b.checkout_status='confirmed')
        or (b.payment_method in ('ESEWA','KHALTI') and b.checkout_status='paid'))
  );
  insert into public.hero_completed_receipts(booking_id,professional_id,service_name,payment_method,gross_paisa,commission_rate_basis_points,commission_paisa,net_paisa,created_at)
  select b.id,b.professional_id,c.name,b.payment_method,b.total_price_paisa,1250,
    round(b.total_price_paisa::numeric*0.125)::integer,b.total_price_paisa-round(b.total_price_paisa::numeric*0.125)::integer,b.updated_at
  from public.bookings b join public.service_categories c on c.id=b.category_id
  where b.id=p_booking_id and b.status='completed' and b.professional_id is not null
    and b.total_price_paisa > 0
    and ((b.payment_method='COD' and b.checkout_status='confirmed') or
      (b.payment_method in ('ESEWA','KHALTI') and b.checkout_status='paid'))
  on conflict (booking_id) do nothing;
end; $$;
revoke all on function public.record_hero_completed_receipt(uuid) from public, anon, authenticated;
create or replace function public.sync_hero_completed_receipt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_hero_completed_receipt(new.id);
  return new;
end; $$;
revoke all on function public.sync_hero_completed_receipt() from public, anon, authenticated;
create trigger booking_completed_receipt_sync after update of status,checkout_status on public.bookings
  for each row execute function public.sync_hero_completed_receipt();

create or replace function public.set_hero_availability(p_online boolean,p_latitude double precision default null,p_longitude double precision default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id
    where p.id=actor and p.role='professional' and pp.verification_status='verified' and pp.suspended_at is null
      and pp.trade_code is not null and pp.operational_zone is not null and pp.citizenship_document_path is not null) then
    raise exception using errcode='42501',message='VERIFIED_PROFESSIONAL_REQUIRED';
  end if;
  if p_online is null then raise exception using errcode='22023',message='AVAILABILITY_REQUIRED'; end if;
  if p_online then
    if p_latitude is null or p_longitude is null then raise exception using errcode='22023',message='GPS_REQUIRED'; end if;
    perform public.update_hero_location(p_latitude,p_longitude,null,null,null,null);
  else
    if exists(select 1 from public.bookings where professional_id=actor and status in ('accepted','on_the_way','in_progress')) then
      raise exception using errcode='22023',message='ACTIVE_JOB_MUST_REMAIN_ONLINE';
    end if;
    delete from public.hero_locations where professional_id=actor;
  end if;
end; $$;
revoke all on function public.set_hero_availability(boolean,double precision,double precision) from public, anon;
grant execute on function public.set_hero_availability(boolean,double precision,double precision) to authenticated;

-- Do not allow suspended accounts to start/accept additional work; allow an existing job to be completed.
create or replace function public.guard_suspended_hero_booking()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.professional_id is not null and new.status in ('accepted','in_progress')
    and exists(select 1 from public.professional_profiles pp where pp.profile_id=new.professional_id and pp.suspended_at is not null)
    and (old.professional_id is distinct from new.professional_id or old.status is distinct from new.status) then
    raise exception using errcode='42501',message='HERO_SUSPENDED';
  end if;
  return new;
end; $$;
revoke all on function public.guard_suspended_hero_booking() from public, anon, authenticated;
create trigger bookings_guard_suspended_hero before update of status,professional_id on public.bookings
  for each row execute function public.guard_suspended_hero_booking();

-- Private KYC bucket; object names are scoped to the authenticated profile UUID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hero-kyc-documents','hero-kyc-documents',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists hero_kyc_insert_own on storage.objects;
create policy hero_kyc_insert_own on storage.objects for insert to authenticated
  with check (bucket_id='hero-kyc-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists(select 1 from public.profiles p where p.id=(select auth.uid())));
drop policy if exists hero_kyc_read_own_admin on storage.objects;
create policy hero_kyc_read_own_admin on storage.objects for select to authenticated
  using (bucket_id='hero-kyc-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_tirkha_admin())));
drop policy if exists hero_kyc_delete_own on storage.objects;
create policy hero_kyc_delete_own on storage.objects for delete to authenticated
  using (bucket_id='hero-kyc-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

commit;
begin;
-- Add bounded aggregate wallet metrics without reading or materializing sensitive booking content.
create or replace function public.hero_wallet_summary()
returns table(gross_paisa bigint,commission_paisa bigint,net_paisa bigint,cod_commission_receivable_paisa bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(r.gross_paisa),0)::bigint,
    coalesce(sum(r.commission_paisa),0)::bigint,
    coalesce(sum(r.net_paisa),0)::bigint,
    coalesce(sum(r.commission_paisa) filter(where r.payment_method='COD'),0)::bigint
  from public.hero_completed_receipts r
  where r.professional_id=auth.uid()
    and exists(select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id
      where p.id=auth.uid() and p.role='professional' and pp.verification_status='verified' and pp.suspended_at is null);
$$;
revoke all on function public.hero_wallet_summary() from public,anon;
grant execute on function public.hero_wallet_summary() to authenticated;
drop policy if exists hero_dispatch_recipient_read on public.hero_dispatch_notifications;
create policy hero_dispatch_recipient_read on public.hero_dispatch_notifications for select to authenticated
using (
  professional_id=(select auth.uid())
  and exists(select 1 from public.profiles p join public.professional_profiles pp on pp.profile_id=p.id
    where p.id=(select auth.uid()) and p.role='professional' and pp.verification_status='verified' and pp.suspended_at is null
      and pp.trade_code is not null and pp.operational_zone is not null and pp.citizenship_document_path is not null)
  and exists(select 1 from public.bookings b join public.professional_service_categories pc
      on pc.professional_id=(select auth.uid()) and pc.category_id=b.category_id
    where b.id=hero_dispatch_notifications.booking_id
      and (b.professional_id=(select auth.uid()) or (
        b.professional_id is null and b.status='requested' and b.scheduled_at>now()
        and public.hero_zone_matches_booking((select auth.uid()),coalesce(b.resolved_address,b.service_address))
        and b.latitude is not null and b.longitude is not null
        and public.hero_is_near_booking((select auth.uid()),b.latitude,b.longitude)
      )))
);
commit;
begin;
create or replace function public.list_verified_professionals(
  p_category_slug text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table(profile_id uuid,full_name text,bio text,rating numeric,hourly_rate_paisa integer)
language sql stable security definer set search_path = '' as $$
  select p.id,p.full_name,pp.bio,pp.rating,pp.hourly_rate_paisa
  from public.professional_service_categories pc
  join public.service_categories c on c.id=pc.category_id
  join public.professional_profiles pp on pp.profile_id=pc.professional_id
  join public.profiles p on p.id=pp.profile_id
  where c.slug=p_category_slug and p.role='professional'
    and pp.verification_status='verified' and pp.suspended_at is null
    and pp.trade_code is not null and pp.operational_zone is not null and pp.citizenship_document_path is not null
  order by pp.rating desc,p.id
  limit least(greatest(coalesce(p_limit,12),1),50)
  offset least(greatest(coalesce(p_offset,0),0),10000);
$$;
create or replace function public.guard_suspended_hero_location()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=new.professional_id
    and (pp.suspended_at is not null or pp.trade_code is null or pp.operational_zone is null or pp.citizenship_document_path is null)) then
    raise exception using errcode='42501',message='HERO_SUSPENDED';
  end if;
  return new;
end; $$;
revoke all on function public.guard_suspended_hero_location() from public,anon,authenticated;
create trigger hero_locations_guard_suspended before insert or update on public.hero_locations
  for each row execute function public.guard_suspended_hero_location();
commit;
begin;
create or replace function public.guard_booking_hero_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.professional_id is not null and exists(
    select 1 from public.professional_profiles pp
    where pp.profile_id=new.professional_id and (pp.verification_status<>'verified' or pp.suspended_at is not null)
  ) then
    raise exception using errcode='42501',message='HERO_UNAVAILABLE';
  end if;
  return new;
end; $$;
revoke all on function public.guard_booking_hero_assignment() from public,anon,authenticated;
create trigger bookings_guard_hero_assignment before insert or update of professional_id on public.bookings
  for each row execute function public.guard_booking_hero_assignment();
commit;
