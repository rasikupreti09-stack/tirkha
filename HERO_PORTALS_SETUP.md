# Hero portals and operations setup

Apply `packages/shared/supabase/migrations/21_hero_portals.sql` after migrations 01–20. This local change does not apply the migration to the hosted Supabase project.

## Registration and identity review

- A Hero must be signed in with a verified `+977` phone number.
- Applications choose Plumbing or Electrical and one operational zone: Kathmandu, Lalitpur, Bhaktapur, Baneshwor, Thamel, or Kirtipur.
- Identity documents are uploaded into the private `hero-kyc-documents` bucket. Only the document owner and Tirkha admins can create a short-lived signed read URL.
- New applications are pending and cannot receive jobs or publish GPS. Admin approval enables the verified profile; suspension removes its live location and blocks new work.

## Job dispatch and quotes

- Unassigned jobs are visible only to verified, non-suspended Heroes with the matching service-category trade, a booking address containing their selected zone, a recent online location and the existing 20 km dispatch eligibility.
- The same boundary applies to realtime dispatch notices and direct booking reads.
- A written quote can be submitted once per assigned booking after its status is `in_progress`. Labour and materials are separate paisa amounts; itemization and work scope are required. The RPC rejects a quote total above the supported integer-paisa limit.

## Receipts and wallet

- Receipt rows contain only completed booking payment totals and a fixed 12.5% platform commission, calculated server-side.
- COD receipts require confirmed COD checkout; eSewa/Khalti receipts require verified paid checkout. Refunds remove a previously eligible receipt from the Hero wallet summary.
- Cash commission receivable is the sum of commission on completed COD receipts. This records the amount due to Tirkha; no cash collection or remittance is initiated by the portal.
- The portal does not copy chat transcripts, diagnostic photos, or location trails into financial history.
