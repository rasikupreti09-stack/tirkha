# Initial Supabase data model

This document describes migration 01. Later migrations supersede its direct booking inserts and marketplace visibility rules: migration 04 implements the booking RPC workflow; migration 05 adds server-only Khalti payment writes and payment-aware cancellation guards. Apply migrations in numeric order. See the root `BOOKING_WORKFLOW_SETUP.md` and `KHALTI_SETUP.md` for current behavior. Use `BookingRequest` / `WorkflowBooking` for current app booking flows; `BookingCreate` is retained for the historical initial migration contract only.

Apply `migrations/01_initial_schema.sql` once to a fresh Supabase project using its SQL editor or a PostgreSQL migration runner as the migration owner. It is transactional and intentionally not rerunnable. Do not apply to production without reviewing existing tables and auth triggers. No cloud database has been changed by generating this file.

## Data contract

- UUID identifiers; all timestamps are timezone-aware and should be serialized as ISO strings with an offset.
- Money uses nonnegative PostgreSQL integers in NPR paisa, up to 2,147,483,647. Unknown rates/prices are null; zero means free.
- Profile contact fields and professional bio may be null while onboarding.
- Professional rating is 0–5, stored to two decimal places; zero is the initial unrated value.
- Professional IDs in bookings reference `professional_profiles.profile_id`, not arbitrary profiles.
- Accepted, in-progress, and completed bookings need an assigned professional.
- Booking references restrict deletion to preserve history. An account with booking history requires a future anonymization/deletion workflow rather than a blind Auth delete.

## Permissions

- New and pre-existing Auth accounts receive a customer profile automatically. Signup metadata cannot set privileged roles.
- Users can read their own profile and update only name, contact phone, and avatar. The contact phone is not a verified authentication phone.
- A professional can read their own professional record. Only trusted backend code manages professional enrollment, verification, ratings, role promotion, and rates in this initial migration.
- Anyone, including anonymous visitors, can read categories. Only the trusted backend writes them.
- Customers create requests using only customer ID, category ID, address, and scheduled time. RLS verifies ownership and customer role. The database generates ID/time/status; assignment and price start null.
- Booking owners retain read access regardless of later role changes.
- Professionals can read their assigned bookings in any status. Verified professionals can additionally read requested, unassigned bookings.
- There is no specialty or geographic eligibility model yet: every verified professional can see every available request, including its full service address. Before a public marketplace launch, add eligibility and an address-redacted discovery endpoint if exact addresses should be withheld until assignment.
- No client update/delete policies exist for bookings. A future trusted API must handle assignment, price calculation, status transitions, and concurrent acceptance.
- An `admin` profile does not automatically bypass RLS. Admin operations must use authenticated/authorized backend code with server-only credentials.

RLS and column grants enforce access even if client validation is bypassed. Do not send a whole `Profile` or `Booking` row as a client mutation; use `ProfileUpdate` and `BookingCreate` respectively.

Schemas and inferred types are exported from `@tirkha/shared`. Foreign keys, uniqueness, ownership, and role authorization are enforced by SQL, not Zod. Validation does not contact the database. The shared package also contains a hand-maintained Supabase `Database` contract for these tables and the directory RPC; regenerate it from the deployed project as the schema grows.

Follow-up migrations: `02_auth_signup_roles.sql` allows creation-time customer/professional selection while leaving verification pending. `03_service_discovery.sql` adds category assignments and a narrowly scoped public verified-professional directory. Apply them in order, followed by `seed.sql` for the core service categories. The rules below describe the initial migration; the follow-up migrations extend its onboarding and discovery behavior.

## Local validation

From the repository root, run:

```sh
pnpm --filter @tirkha/shared test
pnpm typecheck
```

Tests execute the actual migration in PGlite (embedded PostgreSQL) with a minimal local stub of Supabase's Auth schema, roles, and `auth.uid()` function. They check real RLS/grants, profile provisioning/backfill, client write restrictions, database constraints, and SQL JSON compatibility with Zod. PGlite is a development-only dependency and is not exported into either app. These tests do not replace validation against the target Supabase project's Auth and PostgREST configuration.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [column permissions](https://supabase.com/docs/guides/database/postgres/column-level-security), [Auth profile triggers](https://supabase.com/docs/guides/auth/managing-user-data).
