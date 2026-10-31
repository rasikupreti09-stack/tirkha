# Hero portals and operations setup

Apply the migrations in order, including `packages/shared/supabase/migrations/29_hero_service_regions.sql` after migrations 01–28. Local schema changes do not apply themselves to the hosted Supabase project.

## Registration and identity review

- A Hero must be signed in with a verified `+977` phone number.
- Applications choose a trade and one service region: **Kathmandu Valley** (Kathmandu, Lalitpur, Bhaktapur and nearby neighborhoods) or **Pokhara**. Existing city-level Valley Hero registrations are migrated to Kathmandu Valley.
- Identity documents are uploaded into the private `hero-kyc-documents` bucket. Only the document owner and Tirkha admins can create a short-lived signed read URL.
- New applications are pending and cannot receive jobs or publish GPS. Admin approval enables the verified profile; suspension removes its live location and blocks new work.

## Job dispatch and quotes

- Unassigned jobs are visible only to verified, non-suspended Heroes with the matching service-category trade, a booking address in their selected region, a recent online location and dispatch eligibility (30 km for Valley-wide coverage). Pokhara remains a separate region.
- The same boundary applies to realtime dispatch notices and direct booking reads.
- A written quote can be submitted once per assigned booking after its status is `in_progress`. Labour and materials are separate paisa amounts; itemization and work scope are required. The RPC rejects a quote total above the supported integer-paisa limit.

## Receipts and wallet

- Receipt rows contain only completed booking payment totals and a fixed 12.5% platform commission, calculated server-side.
- COD receipts require confirmed COD checkout; eSewa/Khalti receipts require verified paid checkout. Refunds remove a previously eligible receipt from the Hero wallet summary.
- Cash commission receivable is the sum of commission on completed COD receipts. This records the amount due to Tirkha; no cash collection or remittance is initiated by the portal.
- The portal does not copy chat transcripts, diagnostic photos, or location trails into financial history.
