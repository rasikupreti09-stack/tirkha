# Phase 6A: Khalti checkout

## Deployment setup

1. Apply migrations 01–04 first, then apply `packages/shared/supabase/migrations/05_khalti_payments.sql` once as the database owner in Supabase. This file has not been applied to a hosted database. Keep the existing category seed and professional enrollment data.
2. Copy the new server settings from `apps/web/.env.example` into your deployment's secret environment configuration:
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key.
   - `KHALTI_ENVIRONMENT=sandbox`: use `production` only with production merchant credentials.
   - `KHALTI_SECRET_KEY`: the merchant secret for the selected Khalti environment. Khalti labels the sandbox merchant secret `live_secret_key` too; obtain it from the sandbox merchant portal.
   - `APP_URL`: canonical public HTTPS origin of the Next.js app, for example `https://tirkha.example.com`. Sandbox local development also permits `http://localhost:3000`; native device testing needs a reachable hosted HTTPS origin.
   - Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` configured for the same project.
3. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the Next.js server origin. Only this public URL belongs in the mobile app. Never copy merchant secrets or the service-role key into `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.
4. Deploy Next.js to a Node-capable host such as Vercel or a Node server. `output: "export"` was removed because payment route handlers need a server. An existing static-only host cannot run these routes. If using `next start` on a Node host, set the same environment variables there.

The two POST routes require a Supabase bearer access token, verified on the server with Auth `getUser`. Browser requests must have the configured `APP_URL` origin. Native HTTP requests use the same API with bearer authorization; no browser CORS wildcard is enabled. Expo web running on another origin is not part of this configuration.

## Routes and flow

- `POST /api/payments/khalti/initiate` with `{ "booking_id": "<uuid>" }` reserves one checkout and calls Khalti.
- `POST /api/payments/khalti/verify` with the same body reconciles the booking's most recent payment using Khalti lookup.
- `GET /api/payments/khalti/callback` receives Khalti's redirect, checks the stored attempt token and pidx, and performs a server lookup. Callback status, amount and transaction ID are not trusted.
- `/payment-result` links to web bookings and `tirkha://bookings`. It never declares payment success based on URL parameters.

Customer booking confirmations and booking cards—including Completed—show checkout and payment-status controls on both platforms. Mobile opens the hosted checkout in the external browser using React Native Linking. Returning to the app refreshes status; the user can also tap **Check payment status**. The app return link works in a build registered for the `tirkha` scheme; in Expo Go, manually return to the app.

An amount is read exclusively from `bookings.total_price_paisa`, snapshotted into the payment record and sent as integer NPR paisa. No client amount or customer ID is accepted. Customers pay the stored booking amount once, either after creation or after completion; these are two entry points for the same obligation. This phase does not introduce deposits, split payments or a separate completion charge. Existing amounts are labour estimates; the UI explains that materials and subsequent adjustments are excluded. Quote-pending requests cannot be charged until a trusted pricing workflow sets a price. Zero-cost bookings need no checkout; amounts below 1,000 paisa are ineligible for this integration.

## Retry and reconciliation behavior

- A transaction locks the booking before reserving checkout. A partial unique index allows only one nonfailed payment attempt per booking. Simultaneous clicks reuse that attempt rather than creating additional checkouts.
- Existing checkouts are looked up before another initiation. Only a definitively failed/cancelled/expired attempt can be replaced. Pending, paid and refund states cannot create a second charge.
- The server matches lookup pidx and total amount to the stored record. Only `Completed` with a transaction ID and no refund flag becomes paid. Pending and unknown responses do not indicate success. Verified payment/refund states cannot regress because an older lookup finishes late.
- A timeout or malformed initiation response leaves an `initiating` record. The provider might have created a checkout, so it is deliberately not retried automatically. Support must reconcile the stored attempt ID (`purchase_order_id`) with Khalti before releasing it or attaching the returned pidx. Do not simply delete unresolved payment rows.
- While a checkout is unresolved or paid, the database prevents customer cancellation and repricing. Check the provider status first; for a paid booking, complete any refund through your merchant process and reconcile it before cancelling. Automatic refunds and professional payouts are outside this phase.
- Payment history is customer-readable through RLS. Only the server service role can mutate it or invoke payment RPCs. Professionally completing a job does not mark it paid.

Reconciliation runs on callback, user status checks, and screen focus/foreground. There is no scheduled reconciliation worker in this phase. For operational recovery, support can use merchant records to investigate an interrupted checkout; add scheduled reconciliation before relying on unattended collection. Do not switch environments while unresolved payments exist; sandbox records must never be treated as live collections.

## Validation performed

`pnpm typecheck` passed for shared, web and mobile. The local Windows runtime needed a temporary standard-realpath compatibility preload because its native resolver returned EPERM for readable workspace dependencies; no TypeScript settings were weakened.

As requested, no static export builds, Hermes bundle checks, SQL execution tests or live Khalti transactions were run for Phase 6A. Before enabling live collection, apply migration 05 in a sandbox project and exercise successful, cancelled, expired and interrupted payments, duplicate clicks, callback replay, mismatched amounts and returning to the native app. Credentials and a hosted callback URL are still required.

Provider reference: [Khalti Web Checkout and lookup](https://docs.khalti.com/khalti-epayment/). Sandbox uses `https://dev.khalti.com/api/v2/epayment/`; production uses `https://khalti.com/api/v2/epayment/`. Both remain server-side.
