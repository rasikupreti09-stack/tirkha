begin;

-- Explicit specialties prevent showing every professional in every category.
create table public.professional_service_categories (
  professional_id uuid not null references public.professional_profiles(profile_id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete cascade,
  primary key (professional_id, category_id)
);
create index professional_service_categories_category_idx
  on public.professional_service_categories(category_id, professional_id);

alter table public.professional_service_categories enable row level security;
revoke all on public.professional_service_categories from public, anon, authenticated;
grant select on public.professional_service_categories to authenticated;
grant all on public.professional_service_categories to service_role;
create policy professional_service_categories_read_own
on public.professional_service_categories for select to authenticated
using (professional_id = (select auth.uid()));

-- A narrowly scoped public projection. Private profiles, phone numbers and
-- verification documents remain protected by the original table policies.
create function public.list_verified_professionals(
  p_category_slug text,
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  profile_id uuid,
  full_name text,
  bio text,
  rating numeric,
  hourly_rate_paisa integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, pp.bio, pp.rating, pp.hourly_rate_paisa
  from public.professional_service_categories pc
  join public.service_categories c on c.id = pc.category_id
  join public.professional_profiles pp on pp.profile_id = pc.professional_id
  join public.profiles p on p.id = pp.profile_id
  where c.slug = p_category_slug
    and p.role = 'professional'
    and pp.verification_status = 'verified'
  order by pp.rating desc, p.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
$$;
revoke all on function public.list_verified_professionals(text, integer, integer) from public;
grant execute on function public.list_verified_professionals(text, integer, integer)
  to anon, authenticated, service_role;

comment on function public.list_verified_professionals(text, integer, integer) is
  'Public directory of verified professionals in a category. Does not imply geographic coverage or current availability.';
commit;
