# Phase 10 — eSewa, Khalti, COD and receipts

Apply `10_payment_methods.sql` after migrations 01–09 before deploying the
clients/server. Restart the local mock service so its ephemeral database also
includes this migration.

## Booking state

The database keeps service progress in `bookings.status` (Pending/Accepted/
On the Way/In Progress/Completed). Payment confirmation is independent:

- COD sets `payment_method='COD'` and `checkout_status='confirmed'`.
  This is a confirmation of cash due, never a claim that money was collected.
- Verified eSewa/Khalti payments set `checkout_status='paid'` with the
  corresponding method. Provider progress is preserved even when paying after
  job completion.
- Refunds update the checkout state; cancellation voids an unpaid COD
  confirmation. Pending online attempts still require payment review.

This separation prevents a payment callback from resetting an active or
completed job to a new workflow status. The checkout UI displays Confirmed or
Paid and retains the Phase 9 job tracking UI.

## Configuration

Set these **server-only** variables in `apps/web/.env.local` / hosting settings:

- `SUPABASE_SERVICE_ROLE_KEY`, existing public Supabase URL/key, and `APP_URL`.
- `ESEWA_ENVIRONMENT=sandbox` (or `production`),
  `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`.
- Existing `KHALTI_ENVIRONMENT` and `KHALTI_SECRET_KEY`.

Use merchant-issued credentials for the selected environment. No keys are
included in mobile or public-prefixed variables. Production requires an HTTPS
`APP_URL`. eSewa form/status hosts and Khalti checkout hosts are allowlisted.
Mobile uses `EXPO_PUBLIC_API_URL` pointing at the Next.js server.

Configure the reachable merchant callbacks:

- `/api/payments/esewa/callback`
- `/api/payments/khalti/callback`

The eSewa initiation API returns a short-lived, opaque-token checkout link.
Its server-rendered form computes HMAC-SHA256, posts to ePay v2, and offers a
manual Continue button if JavaScript is disabled. Callback state, signature,
merchant, attempt, amount and server status are verified before settlement.
Khalti uses the persisted pidx and an authenticated server lookup, ignoring
untrusted redirect status/amount claims.

`@tirkha/shared/payments-server` exports eSewa signing/callback functions for
trusted server use. The regular shared entry exports integer-paisa conversion,
Khalti initiation and lookup helpers, eSewa lookup validation and receipt text.
eSewa decimal rupees are converted exactly; no floating-point multiplication
is used for payment amounts.

## Customer flow

The booking confirmation, booking history and completion views use
`PaymentCheckout` on web/mobile. Customers choose eSewa, Khalti or COD. Price
comes from the booking in PostgreSQL; the client cannot submit an amount.
COD works via an authenticated RPC without merchant credentials.

Only one unresolved/successful attempt is allowed per booking. Unknown outcomes
remain reserved. Expired eSewa links/NOT_FOUND responses do not automatically
create another chargeable attempt; use verification or support reconciliation.
Once reserved, a different gateway cannot be selected until a terminal failed
attempt is established. These are deliberate duplicate-payment protections.

Online callbacks return to `/payment-result?booking=…`. Signed-in web customers
see the verified record and receipt there. Mobile customers return through
`tirkha://bookings` or switch back to the app; foregrounding checks payment.
Failed verification never renders an unverified success receipt.

Web receipts download as text; mobile uses the native share sheet or selectable
text. Records contain booking/attempt IDs, method, amount, gateway reference,
status and timestamp. COD records explicitly say cash is due; sandbox records
are labelled; these are payment confirmations, not tax invoices. Recording COD
cash collection or issuing statutory tax invoices is outside this phase.

## Local verification and rollout

Local mock mode supports COD and private receipt reads. Online gateways remain
disabled; real checkout needs configured sandbox credentials and reachable
callbacks. No live charges or merchant account changes are performed by tests.

Run `pnpm typecheck` and `pnpm test`. Tests cover HMAC tampering, unsigned
fields, invalid amounts/references, COD ownership and cancellation, reservation
locking, authenticated-only writes, idempotent settlement and preserving job
progress. Before production, run sandbox payments/cancellations and late-callback
reconciliation on both platforms with the merchant's issued credentials.

References:
[eSewa ePay v2](https://developer.esewa.com.np/pages/Epay) and
[Khalti ePayment](https://docs.khalti.com/khalti-epayment/).
