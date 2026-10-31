-- Heroes choose one dispatch region: the full Kathmandu Valley or Pokhara.
-- Legacy city-level Hero zones are migrated into their shared Valley region.
begin;

alter table public.professional_profiles
  drop constraint if exists professional_profiles_operational_zone_check;
update public.professional_profiles
set operational_zone = 'Kathmandu Valley'
where operational_zone in ('Kathmandu','Lalitpur','Bhaktapur','Baneshwor','Thamel','Kirtipur');
alter table public.professional_profiles
  add constraint professional_profiles_operational_zone_check
  check (operational_zone is null or operational_zone in ('Kathmandu Valley','Pokhara'));

create or replace function public.submit_hero_registration(
  p_full_name text, p_phone text, p_trade_code text, p_operational_zone text, p_document_path text
) returns public.verification_status
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); selected_categories uuid[]; resulting_status public.verification_status; selected_slugs text[];
begin
  if actor is null then raise exception using errcode='42501',message='SIGN_IN_REQUIRED'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100
    or p_phone is null or p_phone !~ '^\+9779[0-9]{9}$'
    or p_trade_code is null or p_trade_code not in ('PLUMBING','ELECTRICAL','APPLIANCE_TECHNICIAN','BEAUTICIAN','PAINTER','CLEANER','HANDYMAN')
    or p_operational_zone is null or p_operational_zone not in ('Kathmandu Valley','Pokhara')
    or p_document_path is null or p_document_path !~ ('^' || actor::text || '/[A-Za-z0-9._-]+$') then
    raise exception using errcode='22023',message='INVALID_HERO_REGISTRATION';
  end if;
  if exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then raise exception using errcode='42501',message='ADMIN_CANNOT_REGISTER_AS_HERO'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='hero-kyc-documents' and o.name=p_document_path) then raise exception using errcode='22023',message='ID_DOCUMENT_UPLOAD_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=actor and p.phone=p_phone) then raise exception using errcode='42501',message='VERIFIED_PHONE_MISMATCH'; end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.suspended_at is not null) then raise exception using errcode='42501',message='HERO_SUSPENDED_CONTACT_ADMIN'; end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.verification_status='verified' and pp.suspended_at is null) then raise exception using errcode='42501',message='HERO_ALREADY_VERIFIED'; end if;
  selected_slugs := case p_trade_code
    when 'PLUMBING' then array['plumbing']
    when 'ELECTRICAL' then array['electrical']
    when 'APPLIANCE_TECHNICIAN' then array['appliance-repair']
    when 'BEAUTICIAN' then array['home-salon']
    when 'PAINTER' then array['painting']
    when 'CLEANER' then array['home-cleaning','water-tank-cleaning','sofa-carpet-cleaning']
    else array['general-handyman','carpentry'] end;
  select array_agg(id) into selected_categories from public.service_categories where slug=any(selected_slugs);
  if coalesce(cardinality(selected_categories),0)<>cardinality(selected_slugs) then raise exception using errcode='22023',message='TRADE_UNAVAILABLE'; end if;
  update public.profiles set full_name=btrim(p_full_name),role='professional' where id=actor;
  insert into public.professional_profiles(profile_id,verification_status,trade_code,trade_category,operational_zone,citizenship_document_path,suspended_at)
    values(actor,'pending',p_trade_code,p_trade_code,p_operational_zone,p_document_path,null)
  on conflict(profile_id) do update set verification_status='pending'::public.verification_status,trade_code=excluded.trade_code,trade_category=excluded.trade_category,operational_zone=excluded.operational_zone,citizenship_document_path=excluded.citizenship_document_path,suspended_at=null;
  delete from public.professional_service_categories where professional_id=actor;
  insert into public.professional_service_categories(professional_id,category_id) select actor,category_id from unnest(selected_categories) as category_ids(category_id);
  select verification_status into resulting_status from public.professional_profiles where profile_id=actor;
  return resulting_status;
end; $$;
revoke all on function public.submit_hero_registration(text,text,text,text,text) from public,anon;
grant execute on function public.submit_hero_registration(text,text,text,text,text) to authenticated;

-- Permit Valley-wide assignment while keeping Pokhara in its own boundary.
create or replace function public.hero_zone_matches_booking(p_professional_id uuid,p_address text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_profiles pp
    where pp.profile_id=p_professional_id and case pp.operational_zone
      when 'Kathmandu Valley' then
        lower(coalesce(p_address,'')) ~ '(kathmandu|ktm|lalitpur|patan|bhaktapur|thimi|kirtipur|baneshwor|baneshwar|thamel|kupondole|jhamsikhel|jawalakhel|koteshwor|kalanki|chabahil|boudha|boudhanath|maharajgunj|budhanilkantha|tokha|balkhu|imadol|satdobato|gwarko|lubhu|suryabinayak|काठमाडौं|ललितपुर|पाटन|भक्तपुर|थिमी|कीर्तिपुर|बानेश्वर|ठमेल|कोटेश्वर)'
      when 'Pokhara' then
        lower(coalesce(p_address,'')) ~ '(pokhara|lakeside|phewa|mahendrapul|chipledhunga|baglung bus park|prithvi chowk|birauta|hemja|lekhnath|पोखरा|लेकसाइड)'
      else false end
  );
$$;
revoke all on function public.hero_zone_matches_booking(uuid,text) from public,anon;
grant execute on function public.hero_zone_matches_booking(uuid,text) to authenticated;

-- Keep an entire Valley eligible at realistic city-to-city distances. The area
-- matcher above prevents this larger radius from crossing into Pokhara.
create or replace function public.hero_is_near_booking(p_professional_id uuid,p_latitude double precision,p_longitude double precision)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_professional_id=auth.uid() and p_latitude is not null and p_longitude is not null
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

create or replace function public.dispatch_new_booking_to_heroes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare radius_meters double precision := 30000;
begin
  if new.status<>'requested' then return new; end if;
  insert into public.hero_dispatch_notifications(
    booking_id,professional_id,trade_category,service_name,diagnostic_summary,diagnostic_severity,
    diagnostic_urgency,suggested_parts,service_address,latitude,longitude,distance_meters,scheduled_at
  )
  select new.id,p.id,coalesce(pp.trade_category,pp.trade_code),category.name,
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

commit;
