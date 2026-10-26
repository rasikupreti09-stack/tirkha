# Phase 9 — live booking status tracking

## Rollout

Apply migrations 01–07 first, then apply
`08_on_the_way_status.sql` and **commit it separately** before running
`09_provider_tracking.sql`. PostgreSQL cannot use a newly added enum value in
the same transaction that added it. Deploy the web and mobile clients with the
new workflow; older clients cannot skip directly from Accepted to In Progress.

The customer-facing label **Pending** maps to the existing database value
`requested`. Progression is:

`requested → accepted → on_the_way → in_progress → completed`.

Customers can cancel pending requests. Verified, assigned professionals perform
the later transitions. The RPC retains row locking, ownership checks, schedule
conflict prevention, idempotent retries, status history and push notifications.
Chat stays open while the professional is on the way.

## Shared utilities and UI

- `subscribeToBookings(client, target, options)` in `@tirkha/shared` listens
  for booking INSERT/UPDATE events, supporting `{ booking_id }`,
  `{ user_id, role }`, or `{ available: true }`. It returns an idempotent
  cleanup function, reports connection status, and invalidates data after
  reconnection. Filters narrow events; database RLS remains the authorization
  boundary.
- `nextBookingStatus`, `bookingActions` and `transitionBookingStatus`
  share the step order, action availability and authenticated RPC call.
  App adapters validate returned rows with `workflowBookingSchema`.
- Both booking feeds use one subscription per mounted list, re-fetch authorized
  rows on events, and update tracking cards without navigating or refreshing
  the page. Provider controls live in the existing jobs / Assigned screens.
  Customer cards in My bookings show accessible progress bars and status text.
- Thirty-second polling, focus/foreground refresh and manual Refresh remain.
  Polling also removes requests claimed by another provider: RLS may prevent a
  viewer from receiving the update after access is lost. Completed jobs appear
  in the Completed tab. No GPS movement or arrival-time estimate is implied.

Migration 04 already adds `bookings` to the `supabase_realtime` publication.
Verify that it is still enabled in the hosted project. Both clients must use
that same project and authenticated sessions. See
[Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

The local mock has no WebSocket server. Restart `pnpm dev:mock` after adding
these migrations; it uses labelled polling updates. For a live pilot, disable
mock flags and open customer and verified-provider sessions in separate
browsers/devices. Accept a pending job, then advance each step and verify the
customer card, disconnect/reconnect, and check completed history.

## Verification

`pnpm typecheck` checks shared, web and mobile. `pnpm test` covers subscription
filters/reconnection/cleanup using a fake transport, actual PostgreSQL workflow
rules, unauthorized and out-of-order transitions, travel-stage chat, notification
deduplication, and Supabase SDK calls against the local HTTP fixture.
These tests do not establish hosted WebSocket delivery or high-volume capacity;
measure those against the configured pilot deployment.
