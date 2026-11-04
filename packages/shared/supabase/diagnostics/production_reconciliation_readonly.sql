-- Read-only production reconciliation for Tirkha's partially applied schema.
-- Run in Supabase SQL Editor. This query returns one result set and performs SELECTs only.

with
expected_relations(name) as (
  values
    ('hero_dispatch_notifications'),
    ('completed_transactions'),
    ('finance_archive_rollup'),
    ('hero_finance_rollup'),
    ('professional_job_quotes'),
    ('booking_artifact_purge_queue'),
    ('spatial_districts'),
    ('spatial_features')
),
expected_columns(table_name, column_name) as (
  values
    ('bookings', 'service_region_id'),
    ('bookings', 'service_offering_id'),
    ('bookings', 'diagnostic_summary'),
    ('bookings', 'diagnostic_severity'),
    ('bookings', 'diagnostic_urgency'),
    ('bookings', 'suggested_parts'),
    ('bookings', 'latitude'),
    ('bookings', 'longitude'),
    ('professional_profiles', 'trade_code'),
    ('professional_profiles', 'operational_zone'),
    ('professional_profiles', 'citizenship_document_path'),
    ('professional_profiles', 'suspended_at'),
    ('booking_messages', 'booking_id'),
    ('booking_messages', 'attachment_path'),
    ('hero_locations', 'active_booking_id'),
    ('spatial_districts', 'boundary'),
    ('spatial_districts', 'bbox'),
    ('spatial_features', 'geom'),
    ('spatial_features', 'district_key'),
    ('spatial_features', 'lod_tier')
),
expected_functions(name, signature) as (
  values
    ('submit_hero_registration', 'public.submit_hero_registration(text,text,text,text,text)'),
    ('admin_set_hero_status', 'public.admin_set_hero_status(uuid,text)'),
    ('dispatch_new_booking_to_heroes', 'public.dispatch_new_booking_to_heroes()'),
    ('get_regional_service_catalog', 'public.get_regional_service_catalog(text)'),
    ('record_cod_commission_for_booking', 'public.record_cod_commission_for_booking(uuid)'),
    ('sync_completed_transaction', 'public.sync_completed_transaction()'),
    ('admin_finance_summary', 'public.admin_finance_summary()'),
    ('hero_wallet_summary', 'public.hero_wallet_summary()'),
    ('purge_completed_booking_messages', 'public.purge_completed_booking_messages()'),
    ('get_booking_contact', 'public.get_booking_contact(uuid)')
),
expected_buckets(name) as (
  values ('hero-kyc-documents'), ('booking-chat-images')
),
inventory(section, object_name, details, present) as (
  select 'migration', m.version || ' ' || m.name, 'schema_migrations ledger entry', true
  from supabase_migrations.schema_migrations m
  where m.version >= '13'

  union all

  select 'table', e.name, 'public relation', to_regclass('public.' || e.name) is not null
  from expected_relations e

  union all

  select 'column', e.table_name || '.' || e.column_name, 'public column', c.column_name is not null
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = e.table_name
   and c.column_name = e.column_name

  union all

  select 'function', e.name || '(' || e.signature || ')',
    'anon=' || has_function_privilege('anon', to_regprocedure(e.signature), 'EXECUTE')::text
      || '; authenticated=' || has_function_privilege('authenticated', to_regprocedure(e.signature), 'EXECUTE')::text
      || '; service_role=' || has_function_privilege('service_role', to_regprocedure(e.signature), 'EXECUTE')::text,
    to_regprocedure(e.signature) is not null
  from expected_functions e

  union all

  select 'trigger', c.relname || '.' || t.tgname,
    pg_get_triggerdef(t.oid, true) || ' -> ' || p.proname,
    true
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where n.nspname = 'public'
    and not t.tgisinternal
    and c.relname in ('bookings','booking_messages','hero_locations','service_offerings','spatial_districts','spatial_features')

  union all

  select 'policy', p.tablename || '.' || p.policyname,
    'roles=' || array_to_string(p.roles, ',') || '; command=' || p.cmd,
    true
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename in ('bookings','booking_messages','hero_dispatch_notifications','completed_transactions',
      'service_regions','service_region_aliases','service_region_availability','spatial_districts','spatial_features')

  union all

  select 'storage bucket', e.name,
    'public=' || b.public::text || '; file_size_limit=' || coalesce(b.file_size_limit::text, 'NULL'),
    b.id is not null
  from expected_buckets e
  left join storage.buckets b on b.id = e.name

  union all

  select 'extension', e.extname, 'version=' || e.extversion, true
  from pg_extension e
  where e.extname in ('postgis','pgcrypto')
)
select section, object_name, details, present
from inventory
order by section, object_name;
