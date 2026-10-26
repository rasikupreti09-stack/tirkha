begin;

create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_paisa integer not null check (amount_paisa >= 1000),
  status text not null default 'initiating' check (status in ('initiating','initiated','pending','paid','failed','refunded','partially_refunded')),
  environment text not null check (environment in ('sandbox','production')),
  pidx text unique,
  transaction_id text unique,
  payment_url text,
  expires_at timestamptz,
  callback_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'paid' or (pidx is not null and transaction_id is not null))
);
-- Failed attempts may be replaced; unknown outcomes and refunds require reconciliation.
create unique index booking_payments_one_open on public.booking_payments(booking_id) where status <> 'failed';
create index booking_payments_customer_idx on public.booking_payments(customer_id, created_at desc);
alter table public.booking_payments enable row level security;
revoke all on public.booking_payments from public, anon, authenticated;
grant select on public.booking_payments to authenticated;
grant all on public.booking_payments to service_role;
create policy payments_customer_read on public.booking_payments for select to authenticated
using (customer_id = (select auth.uid()));

-- All payment mutation functions are callable by the server's service role only.
create function public.reserve_booking_payment(p_booking_id uuid, p_customer_id uuid, p_attempt_id uuid, p_environment text)
returns setof public.booking_payments language plpgsql security definer set search_path = '' as $$
declare b public.bookings; payment public.booking_payments;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.customer_id <> p_customer_id then raise exception 'BOOKING_UNAVAILABLE'; end if;
  if b.status = 'cancelled' then raise exception 'BOOKING_CANCELLED'; end if;
  select * into payment from public.booking_payments where booking_id = b.id and status <> 'failed';
  if found then return next payment; return; end if;
  if b.total_price_paisa is null then raise exception 'QUOTE_PENDING'; end if;
  if b.total_price_paisa < 1000 then raise exception 'PAYMENT_MINIMUM'; end if;
  insert into public.booking_payments(id,booking_id,customer_id,amount_paisa,environment)
    values(p_attempt_id,b.id,b.customer_id,b.total_price_paisa,p_environment) returning * into payment;
  return next payment;
end; $$;

create function public.attach_khalti_checkout(p_attempt_id uuid,p_pidx text,p_url text,p_expires_at timestamptz)
returns setof public.booking_payments language plpgsql security definer set search_path = '' as $$
declare payment public.booking_payments;
begin
  select * into payment from public.booking_payments where id=p_attempt_id for update;
  if not found or payment.status <> 'initiating' or p_pidx is null or p_url is null or p_expires_at is null then raise exception 'PAYMENT_CONFLICT'; end if;
  update public.booking_payments set pidx=p_pidx,payment_url=p_url,expires_at=p_expires_at,status='initiated',updated_at=now()
    where id=p_attempt_id returning * into payment;
  return next payment;
end; $$;

create function public.record_khalti_lookup(p_attempt_id uuid,p_pidx text,p_amount integer,p_status text,p_transaction_id text)
returns setof public.booking_payments language plpgsql security definer set search_path = '' as $$
declare payment public.booking_payments;
begin
  select * into payment from public.booking_payments where id=p_attempt_id for update;
  if not found or payment.pidx is distinct from p_pidx or payment.amount_paisa is distinct from p_amount then raise exception 'PAYMENT_MISMATCH'; end if;
  if p_status is null or p_status not in ('initiated','pending','paid','failed','refunded','partially_refunded') then raise exception 'PAYMENT_UNKNOWN'; end if;
  if p_status in ('paid','refunded','partially_refunded') and nullif(p_transaction_id,'') is null then raise exception 'PAYMENT_MISMATCH'; end if;
  if payment.transaction_id is not null and payment.transaction_id is distinct from p_transaction_id and p_status in ('paid','refunded','partially_refunded') then raise exception 'PAYMENT_MISMATCH'; end if;
  -- Late pending/cancel responses cannot erase a verified payment or refund.
  if payment.status='refunded'
    or (payment.status='partially_refunded' and p_status <> 'refunded')
    or (payment.status='paid' and p_status not in ('refunded','partially_refunded'))
    or (payment.status='failed' and p_status in ('initiated','pending')) then
    return next payment; return;
  end if;
  update public.booking_payments set status=p_status,transaction_id=coalesce(p_transaction_id,transaction_id),updated_at=now()
    where id=p_attempt_id returning * into payment;
  return next payment;
end; $$;

create function public.guard_booking_payment() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.booking_payments where booking_id=old.id and status not in ('failed','refunded')) then
    if new.status='cancelled' and old.status <> 'cancelled' then raise exception 'PAYMENT_REVIEW_REQUIRED'; end if;
    if new.total_price_paisa is distinct from old.total_price_paisa or new.customer_id is distinct from old.customer_id then raise exception 'PAYMENT_AMOUNT_LOCKED'; end if;
  end if;
  return new;
end; $$;
create trigger bookings_payment_guard before update on public.bookings for each row execute function public.guard_booking_payment();

revoke all on function public.reserve_booking_payment(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.attach_khalti_checkout(uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.record_khalti_lookup(uuid,text,integer,text,text) from public,anon,authenticated;
revoke all on function public.guard_booking_payment() from public,anon,authenticated;
grant execute on function public.reserve_booking_payment(uuid,uuid,uuid,text) to service_role;
grant execute on function public.attach_khalti_checkout(uuid,text,text,timestamptz) to service_role;
grant execute on function public.record_khalti_lookup(uuid,text,integer,text,text) to service_role;
commit;
