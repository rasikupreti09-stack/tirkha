-- Back up before applying. Existing users must first verify their Nepal phone
-- through Supabase Auth. This transaction refuses to fabricate contact numbers.
begin;
alter table public.profiles add column phone text;
alter table public.profiles add column email text;
update public.profiles p set
  phone = '+' || ltrim(u.phone, '+'), email = case when u.email_confirmed_at is not null then nullif(u.email, '') end
from auth.users u where u.id = p.id and u.phone_confirmed_at is not null;
do $$
begin
  if exists (select 1 from public.profiles where phone is null or phone !~ '^\+9779[0-9]{9}$') then
    raise exception 'Phone migration blocked: existing profiles need a verified +977 mobile number in auth.users. Verify ownership through Supabase Auth, then retry migration 11.';
  end if;
end $$;
alter table public.profiles alter column phone set not null;
alter table public.profiles add constraint profiles_phone_format check (phone ~ '^\+9779[0-9]{9}$');
alter table public.profiles add constraint profiles_phone_unique unique (phone);
-- Legacy contact field remains read-only for compatibility; never used for calls.
revoke update(phone_number) on public.profiles from authenticated;

create or replace function public.handle_new_tirkha_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_role public.user_role := 'customer';
begin
  -- OTP initiation can insert an unconfirmed auth user. Provision only after
  -- Supabase confirms ownership; raw_user_meta_data.phone is never trusted.
  if new.phone_confirmed_at is null or new.phone is null then
    if exists (select 1 from public.profiles where id = new.id) then
      raise exception 'An existing Tirkha profile must retain a verified phone number.';
    end if;
    return new;
  end if;
  if ('+' || ltrim(new.phone, '+')) !~ '^\+9779[0-9]{9}$' then
    raise exception 'Tirkha requires a verified Nepal mobile number (+977).';
  end if;
  if new.raw_user_meta_data ->> 'requested_role' = 'professional' then selected_role := 'professional'; end if;
  insert into public.profiles (id, full_name, role, phone, email)
  values (new.id, nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100), ''), selected_role,
    '+' || ltrim(new.phone, '+'), case when new.email_confirmed_at is not null then nullif(new.email, '') end)
  on conflict (id) do update set phone = excluded.phone, email = excluded.email;
  -- Existing roles cannot be changed by editing auth metadata.
  if exists (select 1 from public.profiles where id = new.id and role = 'professional') then
    insert into public.professional_profiles(profile_id, verification_status) values(new.id, 'pending')
    on conflict (profile_id) do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_phone_verified_tirkha
after update of phone, phone_confirmed_at, email, email_confirmed_at on auth.users
for each row execute function public.handle_new_tirkha_user();

create function public.get_booking_contact(p_booking_id uuid)
returns table(full_name text, phone text)
language sql stable security definer set search_path = '' as $$
  select p.full_name, p.phone from public.bookings b
  join public.profiles p on p.id = case when b.customer_id = auth.uid() then b.professional_id else b.customer_id end
  where b.id = p_booking_id and auth.uid() in (b.customer_id, b.professional_id)
    and b.status in ('accepted','on_the_way','in_progress','completed');
$$;
revoke all on function public.get_booking_contact(uuid) from public, anon;
grant execute on function public.get_booking_contact(uuid) to authenticated;
commit;



