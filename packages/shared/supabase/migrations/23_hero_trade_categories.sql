-- Slot 4: four supported Hero trade categories and exact category-based dispatch.
begin;

alter table public.professional_profiles
  add column if not exists trade_category text;
update public.professional_profiles set trade_category = trade_code where trade_category is null and trade_code is not null;
alter table public.professional_profiles drop constraint if exists professional_profiles_trade_code_check;
alter table public.professional_profiles add constraint professional_profiles_trade_code_check
  check (trade_code is null or trade_code in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN'));
alter table public.professional_profiles add constraint professional_profiles_trade_category_check
  check (trade_category is null or trade_category in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN'));

insert into public.service_categories(name,slug,description,icon_name)
values ('Appliance Repair','appliance-repair','Home appliance troubleshooting and repair.','wrench')
on conflict(slug) do update set name=excluded.name,description=excluded.description,icon_name=excluded.icon_name;

-- Preserve trade selected during phone sign-up as profile metadata and keep it
-- synchronized when the Hero completes identity verification onboarding.
create or replace function public.handle_new_tirkha_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  selected_role public.user_role := 'customer';
  selected_trade text;
begin
  -- OTP initiation creates an unconfirmed auth user. Provision only once
  -- Supabase confirms ownership; never trust phone data from user metadata.
  if new.phone_confirmed_at is null or new.phone is null then
    if exists(select 1 from public.profiles where id=new.id) then
      raise exception 'An existing Tirkha profile must retain a verified phone number.';
    end if;
    return new;
  end if;
  if ('+' || ltrim(new.phone,'+')) !~ '^\+9779[0-9]{9}$' then
    raise exception 'Tirkha requires a verified Nepal mobile number (+977).';
  end if;
  if new.raw_user_meta_data ->> 'requested_role'='professional' then selected_role := 'professional'; end if;
  selected_trade := case when new.raw_user_meta_data ->> 'trade_category' in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN') then new.raw_user_meta_data ->> 'trade_category' else null end;
  insert into public.profiles(id,full_name,role,phone,email)
    values(new.id,nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'),100),''),selected_role,
      '+' || ltrim(new.phone,'+'),case when new.email_confirmed_at is not null then nullif(new.email,'') end)
    on conflict(id) do update set phone=excluded.phone,email=excluded.email;
  -- Existing profile roles cannot be changed by edited auth metadata.
  if exists(select 1 from public.profiles where id=new.id and role='professional') then
    insert into public.professional_profiles(profile_id,verification_status,trade_code,trade_category)
      values(new.id,'pending',selected_trade,selected_trade)
      on conflict(profile_id) do update set
        trade_code=coalesce(professional_profiles.trade_code,excluded.trade_code),
        trade_category=coalesce(professional_profiles.trade_category,excluded.trade_category);
  end if;
  return new;
end $$;
revoke all on function public.handle_new_tirkha_user() from public,anon,authenticated;

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
  selected_slug text;
begin
  if actor is null then raise exception using errcode='42501',message='SIGN_IN_REQUIRED'; end if;
  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 100
    or p_phone is null or p_phone !~ '^\+9779[0-9]{9}$'
    or p_trade_code is null or p_trade_code not in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN')
    or p_operational_zone is null or p_operational_zone not in ('Kathmandu','Lalitpur','Bhaktapur','Baneshwor','Thamel','Kirtipur')
    or p_document_path is null or p_document_path !~ ('^' || actor::text || '/[A-Za-z0-9._-]+$') then
    raise exception using errcode='22023',message='INVALID_HERO_REGISTRATION';
  end if;
  if exists(select 1 from public.profiles p where p.id=actor and p.role='admin') then raise exception using errcode='42501',message='ADMIN_CANNOT_REGISTER_AS_HERO'; end if;
  if not exists(select 1 from storage.objects o where o.bucket_id='hero-kyc-documents' and o.name=p_document_path) then raise exception using errcode='22023',message='ID_DOCUMENT_UPLOAD_REQUIRED'; end if;
  if not exists(select 1 from public.profiles p where p.id=actor and p.phone=p_phone) then raise exception using errcode='42501',message='VERIFIED_PHONE_MISMATCH'; end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.suspended_at is not null) then raise exception using errcode='42501',message='HERO_SUSPENDED_CONTACT_ADMIN'; end if;
  if exists(select 1 from public.professional_profiles pp where pp.profile_id=actor and pp.verification_status='verified' and pp.suspended_at is null) then raise exception using errcode='42501',message='HERO_ALREADY_VERIFIED'; end if;
  selected_slug := case p_trade_code when 'PLUMBING' then 'plumbing' when 'ELECTRICAL' then 'electrical' when 'BEAUTICIAN' then 'home-salon' else 'appliance-repair' end;
  select id into selected_category from public.service_categories where slug=selected_slug;
  if selected_category is null then raise exception using errcode='22023',message='TRADE_UNAVAILABLE'; end if;

  update public.profiles set full_name=btrim(p_full_name),role='professional' where id=actor;
  insert into public.professional_profiles(profile_id,verification_status,trade_code,trade_category,operational_zone,citizenship_document_path,suspended_at)
    values(actor,'pending',p_trade_code,p_trade_code,p_operational_zone,p_document_path,null)
  on conflict(profile_id) do update set verification_status='pending'::public.verification_status,
    trade_code=excluded.trade_code,trade_category=excluded.trade_category,operational_zone=excluded.operational_zone,
    citizenship_document_path=excluded.citizenship_document_path,suspended_at=null;
  delete from public.professional_service_categories where professional_id=actor;
  insert into public.professional_service_categories(professional_id,category_id) values(actor,selected_category);
  select verification_status into resulting_status from public.professional_profiles where profile_id=actor;
  return resulting_status;
end; $$;
revoke all on function public.submit_hero_registration(text,text,text,text,text) from public,anon;
grant execute on function public.submit_hero_registration(text,text,text,text,text) to authenticated;

-- Expand the immutable financial receipt trade code to cover the newly supported trades.
alter table public.completed_transactions drop constraint if exists completed_transactions_hero_trade_check;
alter table public.completed_transactions add constraint completed_transactions_hero_trade_check
  check (hero_trade in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN'));

create or replace function public.sync_completed_transaction() returns trigger language plpgsql security definer set search_path='' as $$
declare tr text; hn text; pt text; gross numeric(14,2); fee numeric(14,2);
begin
 if new.status<>'completed' or new.professional_id is null or new.total_price_paisa is null or new.total_price_paisa<=0
   or not ((new.payment_method='COD' and new.checkout_status='confirmed') or (new.payment_method in ('ESEWA','KHALTI','FONEPAY') and new.checkout_status='paid')) then return new; end if;
 select coalesce(pp.trade_category,pp.trade_code),coalesce(nullif(btrim(p.full_name),''),'Hero') into tr,hn
   from public.professional_profiles pp join public.profiles p on p.id=pp.profile_id where pp.profile_id=new.professional_id;
 if tr is null or tr not in ('PLUMBING','ELECTRICAL','BEAUTICIAN','APPLIANCE_TECHNICIAN') then return new; end if;
 gross:=round(new.total_price_paisa::numeric/100,2); fee:=round(gross*0.125,2);
 pt:=case new.payment_method when 'COD' then 'CASH' when 'ESEWA' then 'ESEWA' when 'KHALTI' then 'KHALTI' else 'FONEPAY' end;
 insert into public.completed_transactions(booking_id,"timestamp",hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type)
 values(new.id,coalesce(new.updated_at,now()),new.professional_id,hn,tr,gross,12.5,fee,gross-fee,pt) on conflict(booking_id) do nothing;
 delete from public.booking_messages where booking_id=new.id;
 delete from public.hero_dispatch_notifications where booking_id=new.id;
 delete from public.hero_locations where active_booking_id=new.id;
 update public.bookings set diagnostic_summary=null,diagnostic_severity=null,diagnostic_urgency=null,suggested_parts=null
   where id=new.id and (diagnostic_summary is not null or diagnostic_severity is not null or diagnostic_urgency is not null or suggested_parts is not null);
 return new;
end; $$;
revoke all on function public.sync_completed_transaction() from public,anon,authenticated;
commit;
