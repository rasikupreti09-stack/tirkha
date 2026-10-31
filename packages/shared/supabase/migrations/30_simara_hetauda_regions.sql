-- Add Hetauda and Simara as independent Hero dispatch/service regions.
begin;

update public.service_offerings so
set regions = ARRAY(
  select distinct r from unnest(coalesce(so.regions,'{}'::text[]) || array['Hetauda','Simara']::text[]) as regions(r)
  order by r
);

alter table public.professional_profiles
  drop constraint if exists professional_profiles_operational_zone_check;
alter table public.professional_profiles
  add constraint professional_profiles_operational_zone_check
  check (operational_zone is null or operational_zone in ('Kathmandu Valley','Pokhara','Hetauda','Simara'));

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
    or p_operational_zone is null or p_operational_zone not in ('Kathmandu Valley','Pokhara','Hetauda','Simara')
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

-- Keep dispatch geographically scoped even though the eligibility radius covers
-- a broad service zone. Use the district/city and familiar local area names.
create or replace function public.hero_zone_matches_booking(p_professional_id uuid,p_address text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professional_profiles pp
    where pp.profile_id=p_professional_id and case pp.operational_zone
      when 'Kathmandu Valley' then
        lower(coalesce(p_address,'')) ~ '(kathmandu|ktm|lalitpur|patan|bhaktapur|thimi|kirtipur|baneshwor|baneshwar|thamel|kupondole|jhamsikhel|jawalakhel|koteshwor|kalanki|chabahil|boudha|boudhanath|maharajgunj|budhanilkantha|tokha|balkhu|imadol|satdobato|gwarko|lubhu|suryabinayak|काठमाडौं|ललितपुर|पाटन|भक्तपुर|थिमी|कीर्तिपुर|बानेश्वर|ठमेल|कोटेश्वर)'
      when 'Pokhara' then
        lower(coalesce(p_address,'')) ~ '(pokhara|lakeside|phewa|mahendrapul|chipledhunga|baglung bus park|prithvi chowk|birauta|hemja|lekhnath|पोखरा|लेकसाइड)'
      when 'Hetauda' then
        lower(coalesce(p_address,'')) ~ '(hetauda|makwanpur|buddha chowk|bus park|sanopokhara|rapti road|basamadi|kamane|chisapani|hatiya|padampokhari|hurnamadi|हेटौंडा|हेटौँडा|मकवानपुर|बुद्ध चोक|कमाने|चिसापानी)'
      when 'Simara' then
        lower(coalesce(p_address,'')) ~ '(simara|jitpur|jeetpur|pathlaiya|amlekhgunj|parwanipur|bara|simara airport|जीतपुर|जितपुर|सिमरा|पथलैया|अमलेखगञ्ज|बारा)'
      else false end
  );
$$;
revoke all on function public.hero_zone_matches_booking(uuid,text) from public,anon;
grant execute on function public.hero_zone_matches_booking(uuid,text) to authenticated;

commit;
