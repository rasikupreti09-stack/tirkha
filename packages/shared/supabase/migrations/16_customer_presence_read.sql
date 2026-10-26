begin;
create policy presence_assigned_customer_read on public.professional_presence for select to authenticated
using (exists (
  select 1 from public.bookings b
  where b.professional_id = professional_presence.professional_id
    and b.customer_id = (select auth.uid())
    and b.status in ('accepted','on_the_way','in_progress')
));
commit;
