begin;

-- Keep customer phone numbers private to the customer and the specific Hero
-- assigned to a job or currently receiving that job's restricted dispatch.
create or replace function public.get_booking_contact(p_booking_id uuid)
returns table(full_name text, phone text)
language sql stable security definer set search_path = '' as $$
  select p.full_name, p.phone
  from public.bookings b
  join public.profiles p on p.id = case
    when b.customer_id = (select auth.uid()) then b.professional_id
    else b.customer_id
  end
  where b.id = p_booking_id
    and (
      (
        (select auth.uid()) in (b.customer_id, b.professional_id)
        and b.status in ('accepted','on_the_way','in_progress','completed')
      )
      or exists (
        select 1
        from public.hero_dispatch_notifications n
        join public.profiles actor on actor.id = n.professional_id and actor.role = 'professional'
        join public.professional_profiles pp on pp.profile_id = actor.id and pp.verification_status = 'verified'
        where n.booking_id = b.id
          and n.professional_id = (select auth.uid())
          and n.status in ('new','seen')
          and b.professional_id is null
          and b.status = 'requested'
      )
    );
$$;

revoke all on function public.get_booking_contact(uuid) from public, anon;
grant execute on function public.get_booking_contact(uuid) to authenticated;

commit;
