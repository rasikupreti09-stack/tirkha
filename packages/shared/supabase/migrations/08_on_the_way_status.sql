-- Commit this migration before migration 09 uses the new enum value.
alter type public.booking_status add value if not exists 'on_the_way' after 'accepted';