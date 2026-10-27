# Tirkha finance archive setup

Migration: `packages/shared/supabase/migrations/22_financial_ledger_archive.sql`.

## Server environment

Configure these as server-side Vercel environment variables (never `NEXT_PUBLIC_*`):

- `NEXT_PUBLIC_SUPABASE_URL`: existing Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only service-role key; never expose it to a browser or mobile app.
- `FINANCE_ARCHIVE_CRON_SECRET`: strong random bearer secret used to protect manual archive calls. Vercel Cron can instead use its `CRON_SECRET` setting.
- `FINANCE_ARCHIVE_URL`: HTTPS URL of the cold-ledger receiver.
- `FINANCE_ARCHIVE_SECRET`: bearer credential accepted by that receiver.

The scheduled daily request is declared in `apps/web/vercel.json` (and root `vercel.json` for repository-root deployments). The route is `POST`/cron `GET /api/finance/archive`.

## Receiver contract

The route sends a JSON object with `schema: "tirkha.finance.archive.v1"`, `idempotency_key`, and up to 100 rows containing only the financial compliance fields. It sends `Idempotency-Key` and `Authorization: Bearer ...` headers. The receiver must durably write or upsert each record by `transaction_id` and respond with JSON `{ "accepted_transaction_ids": ["..."] }` containing every ID in the batch. If storage or acknowledgement fails, the primary rows are retained for retry. Only after an exact acknowledgement does the database atomically fold values into compact rollup rows and delete detail rows.

The receiver can be a private serverless JSON backup endpoint or a Google Sheets adapter. Do not point this setting at an unauthenticated public endpoint. On Vercel, configure `CRON_SECRET` if using the scheduled invocation.

## Data retention

A completion trigger creates one immutable transaction only after COD confirmation or verified online payment. It clears diagnostic draft fields and removes booking chat/dispatch rows and the booking-linked current Hero location. Deleted chat attachment paths enter a private purge queue and their storage objects are removed by the scheduled runner through the Supabase Storage API. It does not delete or modify bookings or payment records. The archive finalizer preserves all-time GMV, company income, Hero net payouts, and COD commission receivables in one global row plus one row per Hero, while transaction detail resides in the external archive.

Admin CSV/JSON exports include all-time totals and the detailed rows currently awaiting archive. Historical row-level exports remain available in the external cold ledger.

