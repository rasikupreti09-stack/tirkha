# Phase 5: booking journey and job workflow

## Apply the database change

Apply `packages/shared/supabase/migrations/04_booking_workflow.sql` once in the Supabase SQL editor as the database owner, after migrations 01–03. Keep the existing `seed.sql` categories. This migration has been tested locally; it has not been applied to your hosted project.

The migration adds job details, duration, rate snapshots, retry keys, update timestamps and status history. Existing bookings retain their prices and gain a 60-minute default duration and empty details. It removes the old direct booking insert grant and replaces writes with authenticated RPCs. Deploy the migration before these app versions; older clients using direct inserts must be upgraded.

Use the existing public Supabase URL and anon key environment variables. Never put a service-role key in either app. Customer accounts can request services; professional accounts must be verified and have rows in `professional_service_categories` to accept matching requests. See `SERVICE_DISCOVERY_SETUP.md` for trusted enrollment setup.

## Screens

- Web: `/book?category=plumbing`, `/bookings`, `/jobs`.
- Mobile: `(app)/book`, `(app)/bookings`, `(app)/jobs`.
- Dashboards link to the relevant role's workspace. Category detail pages link to a preselected booking category.

Customers choose an unassigned request or a verified professional, duration, Nepal date/time, landmark and job details. The device's saved discovery landmark is prefilled and selectable. A successful submission saves that landmark locally; saved locations do not sync between devices or accounts. Native date/time fields accept `YYYY-MM-DD` and 24-hour `HH:mm`. Both apps interpret appointments in Nepal time, independent of the device timezone.

## Server rules

`create_booking_request` derives customer identity from `auth.uid()`, validates category and professional eligibility, and always inserts `requested`. It reads the current hourly rate on the server and rounds `rate_paisa × duration_minutes / 60` to integer paisa. The UI estimate is advisory; the confirmation uses the server result. Duration is 30–480 minutes in 30-minute steps; appointments must be future dates within 365 days.

Unassigned requests and professionals without a rate store a null price, shown as **Quote pending**. Null never means free. Acceptance preserves the original estimate; quote negotiation, materials, payment collection, final billing and refunds are not part of this phase.

`transition_booking` permits:

- The owning customer: `requested → cancelled`.
- The verified assigned professional, or an eligible verified professional claiming an unassigned request: `requested → accepted`.
- The verified assigned professional: `accepted → in_progress → completed`.

Other transitions are rejected, even if a client bypasses its UI. A booking row lock serializes claim/cancel attempts. A professional-specific transaction lock and overlap check prevent accepting overlapping active appointments. Request UUIDs make identical submission retries on the same open form idempotent; reusing a key with different inputs fails. Reloading the form starts a new request, so inspect My bookings after an uncertain network result. Repeated same-state actions do not add duplicate history entries.

RLS limits customer reads to their own bookings. Professionals can read their assigned history; available requests require verification, matching specialty and a future appointment. Available requests include the entered landmark and job details; there is no geographic eligibility filter. History is readable only by the customer and assigned professional. Private retry metadata is inaccessible to client roles.

## Live updates

The migration adds `bookings` to the existing `supabase_realtime` publication. Confirm this table is enabled under Supabase Replication if the project uses a different publication setup. Both apps subscribe to booking inserts/updates, reload after actions and reconnects, and poll every 30 seconds. Browser focus and native foreground events also refresh. Polling remains necessary because RLS may hide a request immediately after another professional claims it, preventing delivery of that update to the former viewer.

## Run and verify

```sh
pnpm install
pnpm typecheck
pnpm --filter @tirkha/shared test
pnpm build:web
pnpm --filter @tirkha/mobile run export:native
```

Mobile now uses `expo-crypto` for request UUIDs. Rebuild an existing custom development client to include that native module.

Local PostgreSQL tests cover grants, RLS, rate rounding, validation, retries, ownership, sequential competing claims, overlap rejection and status history. Browser smoke checks use mocked Supabase responses. Android/iOS exports verify bundling, not native device interaction. Before release, test two simultaneous professional sessions and a customer session against the hosted Supabase project, including actual realtime delivery, offline retries and native confirmation dialogs.
