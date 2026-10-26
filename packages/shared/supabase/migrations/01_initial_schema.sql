-- Apply once to a Supabase project as the migration owner (postgres).
-- Client writes are intentionally narrower than the complete row schemas.
begin;

create type public.user_role as enum ('customer', 'professional', 'admin');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.booking_status as enum ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone_number text,
  avatar_url text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.professional_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  verification_status public.verification_status not null default 'pending',
  rating numeric(3,2) not null default 0 check (rating >= 0 and rating <= 5),
  hourly_rate_paisa integer check (hourly_rate_paisa >= 0)
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  icon_name text
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  professional_id uuid references public.professional_profiles(profile_id) on delete restrict,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  status public.booking_status not null default 'requested',
  total_price_paisa integer check (total_price_paisa >= 0),
  service_address text not null check (length(btrim(service_address)) > 0),
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint bookings_no_self_assignment check (professional_id is distinct from customer_id),
  constraint bookings_active_assignment check (
    status in ('requested', 'cancelled') or professional_id is not null
  )
);

create index bookings_customer_id_idx on public.bookings(customer_id);
create index bookings_professional_id_idx on public.bookings(professional_id);
create index bookings_category_id_idx on public.bookings(category_id);
create index bookings_available_idx on public.bookings(scheduled_at)
  where status = 'requested' and professional_id is null;

-- Never derive a role from user-editable signup metadata.
create function public.handle_new_tirkha_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_tirkha_user() from public, anon, authenticated;

create trigger on_auth_user_created_tirkha
after insert on auth.users
for each row execute function public.handle_new_tirkha_user();

-- Include accounts created before the migration.
insert into public.profiles(id)
select id from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.service_categories enable row level security;
alter table public.bookings enable row level security;

-- RLS controls rows; explicit grants also protect privileged columns.
revoke all on public.profiles, public.professional_profiles,
  public.service_categories, public.bookings from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.service_categories to anon, authenticated;
grant select on public.profiles, public.professional_profiles, public.bookings to authenticated;
grant update (full_name, phone_number, avatar_url) on public.profiles to authenticated;
grant insert (customer_id, category_id, service_address, scheduled_at)
  on public.bookings to authenticated;
grant all on public.profiles, public.professional_profiles,
  public.service_categories, public.bookings to service_role;

create policy profiles_read_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy professional_profiles_read_own on public.professional_profiles
for select to authenticated
using (profile_id = (select auth.uid()));

create policy service_categories_read_all on public.service_categories
for select to anon, authenticated
using (true);

create policy bookings_customer_read_own on public.bookings
for select to authenticated
using (customer_id = (select auth.uid()));

create policy bookings_customer_create_own on public.bookings
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'requested'
  and professional_id is null
  and total_price_paisa is null
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'customer'
  )
);

create policy bookings_professional_read on public.bookings
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'professional'
  )
  and (
    professional_id = (select auth.uid())
    or (
      professional_id is null and status = 'requested'
      and exists (
        select 1 from public.professional_profiles pp
        where pp.profile_id = (select auth.uid())
          and pp.verification_status = 'verified'
      )
    )
  )
);

comment on column public.profiles.phone_number is
  'User-editable contact number; not proof of phone verification.';
comment on column public.bookings.total_price_paisa is
  'NULL until priced by trusted backend; zero means free. Integer NPR paisa.';
comment on table public.bookings is
  'Available = requested and unassigned. Verified professionals can read the full available row, including address.';

commit;
