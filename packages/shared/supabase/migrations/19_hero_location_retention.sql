begin;

-- Keep only recent GPS presence. No booking, payment, or chat rows are modified.
do $$
begin
  execute 'create extension if not exists pg_cron with schema pg_catalog';
exception
  when feature_not_supported or undefined_file then
    -- Lightweight PostgreSQL test harnesses may not ship optional extensions.
    raise notice 'pg_cron is unavailable; stale-location cleanup function was installed without a schedule';
end;
$$;

create or replace function public.purge_stale_hero_locations()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.hero_locations
  where updated_at < now() - interval '5 minutes';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_stale_hero_locations() from public, anon, authenticated;
grant execute on function public.purge_stale_hero_locations() to service_role;

-- Re-running the migration replaces the named job instead of creating duplicates.
do $$
declare
  existing_job record;
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron is unavailable; schedule purge_stale_hero_locations() after enabling pg_cron';
    return;
  end if;

  for existing_job in
    select jobid from cron.job where jobname = 'purge-stale-hero-locations'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;

  perform cron.schedule(
    'purge-stale-hero-locations',
    '* * * * *',
    $job$select public.purge_stale_hero_locations();$job$
  );
end;
$$;

commit;
