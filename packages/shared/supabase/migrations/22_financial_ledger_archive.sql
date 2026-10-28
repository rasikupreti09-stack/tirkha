-- Slot 3: immutable completed transaction details are archived and removed from the primary DB.
-- Booking and payment rows are preserved.
begin;
create table if not exists public.completed_transactions (
 transaction_id uuid primary key default gen_random_uuid(), booking_id uuid not null unique references public.bookings(id) on delete restrict,
 "timestamp" timestamptz not null, hero_id uuid not null references public.profiles(id) on delete restrict,
 hero_name text not null check(char_length(btrim(hero_name)) between 1 and 200), hero_trade text not null check(hero_trade in ('PLUMBING','ELECTRICAL')),
 gross_amount numeric(14,2) not null check(gross_amount>0), commission_rate numeric(5,2) not null default 12.5 check(commission_rate between 0 and 100),
 company_income numeric(14,2) not null check(company_income>=0), hero_payout numeric(14,2) not null check(hero_payout>=0),
 payment_type text not null check(payment_type in ('CASH','ESEWA','KHALTI','FONEPAY')), check(gross_amount=company_income+hero_payout)
);
create index if not exists completed_transactions_timestamp_idx on public.completed_transactions("timestamp" desc,transaction_id);
create index if not exists completed_transactions_hero_timestamp_idx on public.completed_transactions(hero_id,"timestamp" desc);
alter table public.completed_transactions enable row level security;
revoke all on public.completed_transactions from public,anon,authenticated;
grant select on public.completed_transactions to authenticated;
grant all on public.completed_transactions to service_role;
create policy completed_transactions_admin_or_owner_read on public.completed_transactions for select to authenticated using(hero_id=(select auth.uid()) or (select public.is_tirkha_admin()));

-- Compact permanent rollups keep storage bounded while preserving all-time accounting.
create table if not exists public.finance_archive_rollup(singleton boolean primary key default true check(singleton),transaction_count bigint not null default 0,gmv_npr numeric(18,2) not null default 0,company_income_npr numeric(18,2) not null default 0,hero_payout_npr numeric(18,2) not null default 0,cash_receivables_npr numeric(18,2) not null default 0,updated_at timestamptz not null default now());
insert into public.finance_archive_rollup(singleton) values(true) on conflict do nothing;
create table if not exists public.hero_finance_rollup(hero_id uuid primary key references public.profiles(id) on delete restrict,transaction_count bigint not null default 0,gmv_npr numeric(18,2) not null default 0,company_income_npr numeric(18,2) not null default 0,hero_payout_npr numeric(18,2) not null default 0,cash_receivables_npr numeric(18,2) not null default 0,updated_at timestamptz not null default now());
alter table public.finance_archive_rollup enable row level security; alter table public.hero_finance_rollup enable row level security;
revoke all on public.finance_archive_rollup,public.hero_finance_rollup from public,anon,authenticated;
grant select on public.finance_archive_rollup,public.hero_finance_rollup to authenticated; grant all on public.finance_archive_rollup,public.hero_finance_rollup to service_role;
create policy finance_archive_rollup_admin_read on public.finance_archive_rollup for select to authenticated using((select public.is_tirkha_admin()));
create policy hero_finance_rollup_owner_admin_read on public.hero_finance_rollup for select to authenticated using(hero_id=(select auth.uid()) or (select public.is_tirkha_admin()));

-- Migrate existing receipt rows before retiring the former unbounded receipt table.
insert into public.completed_transactions(booking_id,"timestamp",hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type)
select r.booking_id,r.created_at,r.professional_id,coalesce(nullif(btrim(p.full_name),''),'Hero'),pp.trade_code,round(r.gross_paisa::numeric/100,2),r.commission_rate_basis_points::numeric/100,round(r.commission_paisa::numeric/100,2),round(r.net_paisa::numeric/100,2),case r.payment_method when 'COD' then 'CASH' when 'ESEWA' then 'ESEWA' else 'KHALTI' end
from public.hero_completed_receipts r join public.profiles p on p.id=r.professional_id join public.professional_profiles pp on pp.profile_id=r.professional_id where pp.trade_code in ('PLUMBING','ELECTRICAL') on conflict(booking_id) do nothing;
drop trigger if exists booking_completed_receipt_sync on public.bookings;
drop function if exists public.sync_hero_completed_receipt(); drop function if exists public.record_hero_completed_receipt(uuid); drop function if exists public.hero_wallet_summary();
drop table if exists public.hero_completed_receipts;
-- Fold the previous COD-only ledger into the new source before removing its per-job rows.
insert into public.completed_transactions(booking_id,"timestamp",hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type)
select l.booking_id,l.created_at,l.professional_id,coalesce(nullif(btrim(p.full_name),''),'Hero'),pp.trade_code,
  round(l.gross_amount_paisa::numeric/100,2),l.commission_rate_basis_points::numeric/100,
  round(l.commission_paisa::numeric/100,2),round((l.gross_amount_paisa-l.commission_paisa)::numeric/100,2),'CASH'
from public.professional_settlement_ledger l join public.profiles p on p.id=l.professional_id
join public.professional_profiles pp on pp.profile_id=l.professional_id where pp.trade_code in ('PLUMBING','ELECTRICAL')
on conflict(booking_id) do nothing;
drop trigger if exists bookings_record_cod_commission on public.bookings;
drop function if exists public.record_cod_commission_after_booking_update();
drop function if exists public.record_cod_commission_for_booking(uuid);
drop table if exists public.professional_settlement_ledger;

-- Object deletion must use Supabase Storage API; this private queue carries only opaque paths.
create table if not exists public.booking_artifact_purge_queue(id uuid primary key default gen_random_uuid(),bucket_id text not null,object_path text not null unique,created_at timestamptz not null default now());
alter table public.booking_artifact_purge_queue enable row level security;
revoke all on public.booking_artifact_purge_queue from public,anon,authenticated;
grant all on public.booking_artifact_purge_queue to service_role;
create or replace function public.queue_chat_attachment_purge() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.attachment_path is not null then insert into public.booking_artifact_purge_queue(bucket_id,object_path) values('booking-chat-images',old.attachment_path) on conflict(object_path) do nothing; end if;
 return old;
end; $$;
revoke all on function public.queue_chat_attachment_purge() from public,anon,authenticated;
create trigger booking_chat_attachment_purge after delete on public.booking_messages for each row execute function public.queue_chat_attachment_purge();

create or replace function public.sync_completed_transaction() returns trigger language plpgsql security definer set search_path='' as $$
declare tr text; hn text; pt text; gross numeric(14,2); fee numeric(14,2);
begin
 if new.status<>'completed' or new.professional_id is null or new.total_price_paisa is null or new.total_price_paisa<=0 or not ((new.payment_method='COD' and new.checkout_status='confirmed') or (new.payment_method in ('ESEWA','KHALTI','FONEPAY') and new.checkout_status='paid')) then return new; end if;
 select pp.trade_code,coalesce(nullif(btrim(p.full_name),''),'Hero') into tr,hn from public.professional_profiles pp join public.profiles p on p.id=pp.profile_id where pp.profile_id=new.professional_id;
 if tr is null or tr not in ('PLUMBING','ELECTRICAL') then return new; end if;
 gross:=round(new.total_price_paisa::numeric/100,2); fee:=round(gross*0.125,2); pt:=case new.payment_method when 'COD' then 'CASH' when 'ESEWA' then 'ESEWA' when 'KHALTI' then 'KHALTI' else 'FONEPAY' end;
 insert into public.completed_transactions(booking_id,"timestamp",hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type) values(new.id,coalesce(new.updated_at,now()),new.professional_id,hn,tr,gross,12.5,fee,gross-fee,pt) on conflict(booking_id) do nothing;
 -- Purge transient artifacts only; bookings and payments remain.
 delete from public.booking_messages where booking_id=new.id; delete from public.hero_dispatch_notifications where booking_id=new.id; delete from public.hero_locations where active_booking_id=new.id;
 update public.bookings set diagnostic_summary=null,diagnostic_severity=null,diagnostic_urgency=null,suggested_parts='{}'::text[] where id=new.id and (diagnostic_summary is not null or diagnostic_severity is not null or diagnostic_urgency is not null or cardinality(suggested_parts)>0);
 return new;
end; $$;
revoke all on function public.sync_completed_transaction() from public,anon,authenticated;
create trigger booking_completed_transaction_sync after update of status,checkout_status on public.bookings for each row execute function public.sync_completed_transaction();

create or replace function public.guard_completed_transaction_immutable() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then raise exception using errcode='55000',message='FINANCIAL_TRANSACTION_IMMUTABLE'; end if;
 if tg_op='DELETE' and current_user not in ('postgres','service_role','supabase_admin') then raise exception using errcode='42501',message='FINANCIAL_ARCHIVE_REQUIRED'; end if;
 return old;
end; $$;
revoke all on function public.guard_completed_transaction_immutable() from public,anon,authenticated;
create trigger completed_transactions_immutable before update or delete on public.completed_transactions for each row execute function public.guard_completed_transaction_immutable();

create or replace function public.admin_finance_summary() returns table(gmv_npr numeric,company_income_npr numeric,hero_cash_receivables_npr numeric,transaction_count bigint,pending_archive_count bigint,pending_archive_gmv_npr numeric) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_tirkha_admin() then raise exception using errcode='42501',message='ADMIN_REQUIRED'; end if;
 return query select a.gmv_npr+coalesce(p.gmv,0),a.company_income_npr+coalesce(p.fee,0),a.cash_receivables_npr+coalesce(p.cash_due,0),a.transaction_count+coalesce(p.n,0),coalesce(p.n,0),coalesce(p.gmv,0) from public.finance_archive_rollup a cross join lateral(select count(*)::bigint n,coalesce(sum(t.gross_amount),0)::numeric gmv,coalesce(sum(t.company_income),0)::numeric fee,coalesce(sum(t.company_income) filter(where t.payment_type='CASH'),0)::numeric cash_due from public.completed_transactions t) p where a.singleton=true;
end; $$;
revoke all on function public.admin_finance_summary() from public,anon; grant execute on function public.admin_finance_summary() to authenticated;

-- External endpoint confirms the batch before this atomic rollup-and-delete operation.
create or replace function public.finalize_finance_archive(p_transaction_ids uuid[]) returns bigint language plpgsql security definer set search_path='' as $$
declare rows_json jsonb; removed_count bigint;
begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='SERVICE_ROLE_REQUIRED'; end if;
 if p_transaction_ids is null or cardinality(p_transaction_ids)<1 or cardinality(p_transaction_ids)>100 then raise exception using errcode='22023',message='INVALID_ARCHIVE_BATCH'; end if;
 with d as(delete from public.completed_transactions where transaction_id=any(p_transaction_ids) returning to_jsonb(completed_transactions.*) item) select coalesce(jsonb_agg(item),'[]'::jsonb),count(*) into rows_json,removed_count from d;
 if removed_count=0 then return 0; end if;
 with b as(select * from jsonb_to_recordset(rows_json) as x(hero_id uuid,gross_amount numeric,company_income numeric,hero_payout numeric,payment_type text)),s as(select hero_id,count(*)::bigint n,sum(gross_amount) g,sum(company_income) c,sum(hero_payout) h,sum(company_income) filter(where payment_type='CASH') due from b group by hero_id)
 insert into public.hero_finance_rollup(hero_id,transaction_count,gmv_npr,company_income_npr,hero_payout_npr,cash_receivables_npr) select hero_id,n,g,c,h,coalesce(due,0) from s on conflict(hero_id) do update set transaction_count=public.hero_finance_rollup.transaction_count+excluded.transaction_count,gmv_npr=public.hero_finance_rollup.gmv_npr+excluded.gmv_npr,company_income_npr=public.hero_finance_rollup.company_income_npr+excluded.company_income_npr,hero_payout_npr=public.hero_finance_rollup.hero_payout_npr+excluded.hero_payout_npr,cash_receivables_npr=public.hero_finance_rollup.cash_receivables_npr+excluded.cash_receivables_npr,updated_at=now();
 with b as(select * from jsonb_to_recordset(rows_json) as x(gross_amount numeric,company_income numeric,hero_payout numeric,payment_type text)) update public.finance_archive_rollup set transaction_count=transaction_count+removed_count,gmv_npr=gmv_npr+coalesce((select sum(gross_amount) from b),0),company_income_npr=company_income_npr+coalesce((select sum(company_income) from b),0),hero_payout_npr=hero_payout_npr+coalesce((select sum(hero_payout) from b),0),cash_receivables_npr=cash_receivables_npr+coalesce((select sum(company_income) from b where payment_type='CASH'),0),updated_at=now() where singleton=true;
 return removed_count;
end; $$;
revoke all on function public.finalize_finance_archive(uuid[]) from public,anon,authenticated; grant execute on function public.finalize_finance_archive(uuid[]) to service_role;

create or replace function public.hero_wallet_summary() returns table(gross_paisa bigint,commission_paisa bigint,net_paisa bigint,cod_commission_receivable_paisa bigint) language sql stable security definer set search_path='' as $$
 select round((coalesce(a.gmv_npr,0)+p.g)*100)::bigint,round((coalesce(a.company_income_npr,0)+p.c)*100)::bigint,round((coalesce(a.hero_payout_npr,0)+p.h)*100)::bigint,round((coalesce(a.cash_receivables_npr,0)+p.due)*100)::bigint from (select 1) seed left join public.hero_finance_rollup a on a.hero_id=auth.uid() cross join lateral(select coalesce(sum(t.gross_amount),0)::numeric g,coalesce(sum(t.company_income),0)::numeric c,coalesce(sum(t.hero_payout),0)::numeric h,coalesce(sum(t.company_income) filter(where t.payment_type='CASH'),0)::numeric due from public.completed_transactions t where t.hero_id=auth.uid()) p where exists(select 1 from public.profiles x join public.professional_profiles pp on pp.profile_id=x.id where x.id=auth.uid() and x.role='professional' and pp.verification_status='verified' and pp.suspended_at is null);
$$;
revoke all on function public.hero_wallet_summary() from public,anon; grant execute on function public.hero_wallet_summary() to authenticated;
commit;




do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='completed_transactions') then
    alter publication supabase_realtime add table public.completed_transactions;
  end if;
exception when undefined_object then null;
end $$;

