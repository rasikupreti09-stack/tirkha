begin;

-- COD is collected in cash by the Hero. A negative ledger entry records the
-- platform commission owed from that collection once the service is complete.
create table public.professional_settlement_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  professional_id uuid not null references public.profiles(id) on delete restrict,
  gross_amount_paisa integer not null check (gross_amount_paisa > 0),
  commission_rate_basis_points integer not null check (commission_rate_basis_points between 1000 and 1500),
  commission_paisa integer not null check (commission_paisa > 0),
  entry_amount_paisa integer not null check (entry_amount_paisa < 0),
  entry_type text not null default 'cod_platform_commission' check (entry_type = 'cod_platform_commission'),
  created_at timestamptz not null default now(),
  constraint settlement_commission_matches_entry check (entry_amount_paisa = -commission_paisa),
  constraint settlement_commission_within_gross check (commission_paisa <= gross_amount_paisa)
);
create index professional_settlement_ledger_owner_idx
  on public.professional_settlement_ledger(professional_id, created_at desc);
alter table public.professional_settlement_ledger enable row level security;
revoke all on public.professional_settlement_ledger from public, anon, authenticated;
grant select on public.professional_settlement_ledger to authenticated;
grant all on public.professional_settlement_ledger to service_role;
create policy settlement_read_own_or_admin on public.professional_settlement_ledger
  for select to authenticated using (
    professional_id = (select auth.uid())
    or exists(select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );

create function public.record_cod_commission_for_booking(p_booking_id uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.professional_settlement_ledger(
    booking_id, professional_id, gross_amount_paisa,
    commission_rate_basis_points, commission_paisa, entry_amount_paisa
  )
  select b.id, b.professional_id, b.total_price_paisa, 1250,
    round(b.total_price_paisa::numeric * 0.125)::integer,
    -round(b.total_price_paisa::numeric * 0.125)::integer
  from public.bookings b
  where b.id = p_booking_id and b.status = 'completed'
    and b.payment_method = 'COD' and b.checkout_status = 'confirmed'
    and b.professional_id is not null and b.total_price_paisa is not null and b.total_price_paisa > 0
  on conflict (booking_id) do nothing;
$$;
revoke all on function public.record_cod_commission_for_booking(uuid) from public, anon, authenticated;

create function public.record_cod_commission_after_booking_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.record_cod_commission_for_booking(new.id);
  return new;
end;
$$;
revoke all on function public.record_cod_commission_after_booking_update() from public, anon, authenticated;
create trigger bookings_record_cod_commission
  after update of status on public.bookings
  for each row execute function public.record_cod_commission_after_booking_update();

comment on table public.professional_settlement_ledger is
  'Append-only Hero settlement entries. A negative COD commission entry is written once when a COD booking completes.';
comment on column public.professional_settlement_ledger.entry_amount_paisa is
  'Signed Hero settlement change in integer NPR paisa; negative values are deductions.';

commit;
