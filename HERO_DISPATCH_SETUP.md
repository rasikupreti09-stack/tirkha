# Hero dispatch and AI booking diagnostics

## Apply the migration

Apply `packages/shared/supabase/migrations/20_hero_dispatch.sql` after migrations 01–19. The SQL migration is not applied to the hosted Supabase project by this local change. It adds structured diagnostic fields to bookings, a customer-authenticated booking RPC, recipient-scoped dispatch records, database triggers, RLS, and the `hero_dispatch_notifications` Realtime publication entry.

## Dispatch eligibility

For unassigned requests, a notification is created for each verified professional who:

- supports the request's service category;
- is marked `online_idle` by the live Hero GPS update;
- has a GPS ping from the last five minutes; and
- is within 20 km of the customer's pinned coordinates.

Only the explicitly selected professional receives an assigned request. A Hero's request inbox and the available-booking RLS policy use the same verified, specialty, fresh-location and proximity checks. Accepting one request marks that Hero's alert accepted and expires the other offers. Cancelling or otherwise progressing a job closes its outstanding offers.

The web Hero Jobs page starts GPS sharing while open when the Hero is verified and grants permission. Location is sent through the existing authenticated `update_hero_location` RPC. The mobile app includes the dispatch inbox and can open the customer's coordinate in Maps; mobile native GPS broadcasting still requires the SDK's `expo-location` dependency and a rebuilt native app. Background location is not requested.

## Live and device notifications

The browser and mobile inbox subscribe to `hero_dispatch_notifications` with an authenticated, per-Hero Postgres Changes filter and also refresh when the app regains focus/foreground and every 30 seconds. Supabase Realtime enforces the recipient-only RLS policy. Expo push outbox records use generic lock-screen text; service address, customer data, symptoms and diagnostic details stay in the signed-in app.

For Expo delivery, configure the existing server-only variables documented in `CHAT_PUSH_SETUP.md` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `PUSH_DISPATCH_SECRET`; `EXPO_ACCESS_TOKEN` is optional). Configure the documented trusted scheduler or Supabase database webhook to POST to `/api/notifications/dispatch`. In-app Realtime alerts do not depend on that scheduler. Missing AI vision API credentials should remain unset in development: `/api/diagnostics` returns an explicit unavailable message and customers can still use text-based triage.

## AI diagnostic boundaries

Customer-confirmed diagnostic summaries, urgency/severity and a capped list of possible parts travel with the booking and alert. Parts are unconfirmed, unpriced suggestions to verify on site. A photo itself is never attached to the booking. The AI is a symptom triage aid, not a confirmed repair diagnosis or emergency response service.
