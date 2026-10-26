begin;
alter table public.bookings
  add column payment_method text check (payment_method in ('COD','ESEWA','KHALTI')),
  add column checkout_status text not null default 'unpaid' check (checkout_status in ('unpaid','pending','confirmed','paid','refunded','partially_refunded'));
alter table public.booking_payments
  add column method text not null default 'KHALTI' check (method in ('COD','ESEWA','KHALTI'));
alter table public.booking_payments drop constraint booking_payments_amount_paisa_check;
alter table public.booking_payments drop constraint booking_payments_status_check;
alter table public.booking_payments add constraint payment_amount_by_method check (
  (method='COD' and amount_paisa>=0) or (method='ESEWA' and amount_paisa>=1) or (method='KHALTI' and amount_paisa>=1000));
alter table public.booking_payments add constraint payment_status_values check (
  status in ('initiating','initiated','pending','confirmed','paid','failed','refunded','partially_refunded'));
alter table public.booking_payments add constraint cod_confirmation_only check (
  (method='COD' and status in ('confirmed','failed')) or (method<>'COD' and status<>'confirmed'));

create function public.reserve_gateway_payment(p_booking_id uuid,p_customer_id uuid,p_attempt_id uuid,p_environment text,p_method text)
returns setof public.booking_payments language plpgsql security definer set search_path='' as $$
declare b public.bookings; payment public.booking_payments;
begin
  if p_method is null or p_method not in ('COD','ESEWA','KHALTI') then raise exception 'INVALID_PAYMENT_METHOD'; end if;
  select * into b from public.bookings where id=p_booking_id for update;
  if not found or b.customer_id is distinct from p_customer_id then raise exception 'BOOKING_UNAVAILABLE'; end if;
  if b.status='cancelled' then raise exception 'BOOKING_CANCELLED'; end if;
  select * into payment from public.booking_payments where booking_id=b.id and status<>'failed';
  if found then
    if payment.method<>p_method then raise exception 'PAYMENT_METHOD_LOCKED'; end if;
    if payment.environment<>p_environment then raise exception 'PAYMENT_ENVIRONMENT_MISMATCH'; end if;
    return next payment; return;
  end if;
  if b.total_price_paisa is null then raise exception 'QUOTE_PENDING'; end if;
  if (p_method='KHALTI' and b.total_price_paisa<1000) or (p_method='ESEWA' and b.total_price_paisa<1) then raise exception 'PAYMENT_MINIMUM'; end if;
  insert into public.booking_payments(id,booking_id,customer_id,amount_paisa,environment,method,status,pidx,expires_at)
    values(p_attempt_id,b.id,b.customer_id,b.total_price_paisa,p_environment,p_method,
      case p_method when 'COD' then 'confirmed' when 'ESEWA' then 'initiated' else 'initiating' end,
      case when p_method='ESEWA' then p_attempt_id::text else null end,
      case when p_method='ESEWA' then now()+interval '20 minutes' else null end)
    returning * into payment;
  return next payment;
end; $$;
-- Keep the Phase 6 server contract while preventing cross-gateway reuse.
create or replace function public.reserve_booking_payment(p_booking_id uuid,p_customer_id uuid,p_attempt_id uuid,p_environment text)
returns setof public.booking_payments language sql security definer set search_path='' as $$
  select * from public.reserve_gateway_payment(p_booking_id,p_customer_id,p_attempt_id,p_environment,'KHALTI');
$$;

create function public.confirm_cod(p_booking_id uuid)
returns setof public.booking_payments language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'SIGN_IN_REQUIRED'; end if;
  return query select * from public.reserve_gateway_payment(p_booking_id,auth.uid(),gen_random_uuid(),'production','COD');
end; $$;

-- Payment changes update a separate booking checkout state, preserving job progress.
create function public.sync_booking_checkout() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.booking_payments;
begin
  select * into p from public.booking_payments where booking_id=new.booking_id
    order by (status<>'failed') desc,created_at desc,id desc limit 1;
  update public.bookings set payment_method=p.method,checkout_status=case
    when p.status in ('confirmed','paid','refunded','partially_refunded') then p.status
    when p.status='failed' then 'unpaid' else 'pending' end
    where id=new.booking_id;
  return new;
end; $$;
create trigger payments_sync_booking after insert or update on public.booking_payments
for each row execute function public.sync_booking_checkout();

create or replace function public.guard_booking_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.booking_payments where booking_id=old.id and status not in ('failed','refunded')) then
    if new.status='cancelled' and old.status<>'cancelled' and exists(
      select 1 from public.booking_payments where booking_id=old.id and status not in ('failed','refunded') and method<>'COD'
    ) then raise exception 'PAYMENT_REVIEW_REQUIRED'; end if;
    if new.total_price_paisa is distinct from old.total_price_paisa or new.customer_id is distinct from old.customer_id then raise exception 'PAYMENT_AMOUNT_LOCKED'; end if;
  end if;
  return new;
end; $$;
create function public.cancel_cod_confirmation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='cancelled' and old.status<>'cancelled' then
    update public.booking_payments set status='failed',updated_at=now() where booking_id=new.id and method='COD' and status='confirmed';
  end if;
  return new;
end; $$;
create trigger bookings_cancel_cod after update of status on public.bookings for each row execute function public.cancel_cod_confirmation();

create function public.record_gateway_lookup(p_attempt_id uuid,p_pidx text,p_amount integer,p_status text,p_transaction_id text,p_method text)
returns setof public.booking_payments language plpgsql security definer set search_path='' as $$
declare payment public.booking_payments;
begin
  -- Consistent booking -> payment lock order for reservation and reconciliation.
  perform 1 from public.bookings where id=(select booking_id from public.booking_payments where id=p_attempt_id) for update;
  select * into payment from public.booking_payments where id=p_attempt_id for update;
  if not found or p_method not in ('ESEWA','KHALTI') or payment.method is distinct from p_method
    or payment.pidx is distinct from p_pidx or payment.amount_paisa is distinct from p_amount then raise exception 'PAYMENT_MISMATCH'; end if;
  if p_status is null or p_status not in ('initiated','pending','paid','failed','refunded','partially_refunded') then raise exception 'PAYMENT_UNKNOWN'; end if;
  if p_status in ('paid','refunded','partially_refunded') and nullif(p_transaction_id,'') is null then raise exception 'PAYMENT_MISMATCH'; end if;
  if payment.transaction_id is not null and payment.transaction_id is distinct from p_transaction_id and p_status in ('paid','refunded','partially_refunded') then raise exception 'PAYMENT_MISMATCH'; end if;
  if payment.status='refunded' or (payment.status='partially_refunded' and p_status<>'refunded')
    or (payment.status='paid' and p_status not in ('refunded','partially_refunded'))
    or (payment.status='failed' and p_status in ('initiated','pending')) then return next payment; return; end if;
  update public.booking_payments set status=p_status,transaction_id=coalesce(p_transaction_id,transaction_id),updated_at=now()
    where id=p_attempt_id returning * into payment;
  return next payment;
end; $$;
create or replace function public.record_khalti_lookup(p_attempt_id uuid,p_pidx text,p_amount integer,p_status text,p_transaction_id text)
returns setof public.booking_payments language sql security definer set search_path='' as $$
  select * from public.record_gateway_lookup(p_attempt_id,p_pidx,p_amount,p_status,p_transaction_id,'KHALTI');
$$;

revoke all on function public.reserve_gateway_payment(uuid,uuid,uuid,text,text), public.record_gateway_lookup(uuid,text,integer,text,text,text),
  public.confirm_cod(uuid), public.sync_booking_checkout(), public.cancel_cod_confirmation() from public,anon,authenticated;
grant execute on function public.reserve_gateway_payment(uuid,uuid,uuid,text,text), public.record_gateway_lookup(uuid,text,integer,text,text,text) to service_role;
grant execute on function public.confirm_cod(uuid) to authenticated;
-- Backfill existing verified Khalti payment states without rewriting job status.
update public.booking_payments set updated_at=updated_at;
commit;
