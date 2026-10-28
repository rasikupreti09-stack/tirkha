begin;

-- Chat history is visible only to the two participants on its booking.
-- Inserts remain RPC-only: send_booking_message performs the same participant,
-- booking-state, validation, rate-limit, and idempotency checks.
alter table public.booking_messages enable row level security;
revoke all on public.booking_messages from public, anon, authenticated;
grant select on public.booking_messages to authenticated;
grant all on public.booking_messages to service_role;

drop policy if exists booking_messages_participants on public.booking_messages;
create policy booking_messages_participants
  on public.booking_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_id
        and ((select auth.uid()) = b.customer_id or (select auth.uid()) = b.professional_id)
    )
  );

create or replace function public.purge_completed_booking_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and new.status::text in ('completed', 'cancelled') then
    delete from public.booking_messages where booking_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.purge_completed_booking_messages() from public, anon, authenticated;
drop trigger if exists purge_completed_booking_messages on public.bookings;
create trigger purge_completed_booking_messages
  after update of status on public.bookings
  for each row
  execute function public.purge_completed_booking_messages();

commit;
