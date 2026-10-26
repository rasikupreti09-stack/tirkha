-- Creation-time role selection only. Existing users and RLS grants stay unchanged.
begin;
create or replace function public.handle_new_tirkha_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.user_role := 'customer';
begin
  -- Metadata is untrusted. Only this explicit choice can create a professional.
  if new.raw_user_meta_data ->> 'requested_role' = 'professional' then
    selected_role := 'professional';
  end if;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 100), ''),
    selected_role
  );

  if selected_role = 'professional' then
    insert into public.professional_profiles (profile_id, verification_status)
    values (new.id, 'pending');
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_tirkha_user() from public, anon, authenticated;
commit;
