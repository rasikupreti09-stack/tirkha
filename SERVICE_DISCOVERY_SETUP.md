# Phase 4: service discovery

## Apply SQL in order

1. `packages/shared/supabase/migrations/01_initial_schema.sql` (only on a fresh database).
2. `02_auth_signup_roles.sql` (Phase 3).
3. `03_service_discovery.sql`.
4. `packages/shared/supabase/seed.sql`.

Run migrations only once; the category seed is safe to rerun. It upserts Plumbing, Electrical, Home Cleaning, Appliance Repair, and Painting by slug, preserving category IDs and existing relationships. Seed content is the single source for category names, descriptions, slugs, and icon identifiers. No fabricated professionals are seeded.

## List a professional

Professional category assignments are managed by trusted backend/admin operations through `professional_service_categories`. Add a row connecting the professional's profile ID to a category ID. The professional must have `profiles.role = professional` and `professional_profiles.verification_status = verified` to appear in the directory. The existing backend can set a nonnegative integer hourly rate in paisa.

Use the Supabase dashboard with appropriate administrative access during this phase; there is no client-side verification or category-assignment editor. Do not expose service-role credentials in either app.

The public `list_verified_professionals` RPC returns only profile ID, display name, bio, rating, and hourly rate. Public listing of these fields is intentional. Contact phone numbers, addresses, and verification records remain protected. It checks the category relationship, professional role and verification status on every request and limits page sizes. Revocation disappears from results on the next fetch; the directory is not a realtime availability feed.

## Routes

- Web: `/` displays service categories for visitors; existing users arriving at the root continue to their dashboard.
- Web: `/explore` is available to visitors and signed-in users.
- Web: `/services?category=plumbing` shows category details and verified professionals.
- Mobile: `(app)/categories/index` lists categories and `(app)/categories/[slug]` shows details behind the existing auth guard.
- Both dashboards link to browsing.

The web detail route uses a query parameter so new categories work without rebuilding dynamic pages on the static Next.js host. Categories/professionals come from Supabase at runtime; no fixtures are used in production. Screens distinguish loading, request failures, missing categories, and empty listings, and include retry and pagination.

## Pricing and location

Shared helpers convert integer paisa to NPR with two decimal places: 12,550 paisa becomes NPR 125.50. A null rate is “Price on request”; zero remains NPR 0.00 / hour. Rates are labelled as hourly labour estimates, not fixed booking totals.

The web location picker supports suggested Nepal municipalities and landmarks, optional ward 1–99, and custom free-text areas. It stores a preference in the browser under `tirkha.location.v1`, validates restored values, and provides a clear action. No GPS permission, map API, or third-party geocoding is needed.

This preference is not yet a booking address or a provider availability filter. No geographic coverage has been inferred from professional records. Both the picker and directory disclose this scope. Add service-area data and explicit matching before offering “nearby” filtering. Saved preferences stay on this browser and are not synchronized to the backend or mobile app.

## Validation

```sh
pnpm --filter @tirkha/shared test
pnpm typecheck
pnpm build:web
pnpm --filter @tirkha/mobile run export:native
```

The SQL tests run in embedded PostgreSQL with a minimal Auth stub. Configure actual Supabase credentials and apply the SQL before a live end-to-end test. No cloud project is changed by creating these files.

Validation completed: all 22 shared tests and all workspace type checks pass; Next.js production static export and Android/iOS JavaScript exports pass. Browser smoke tests with mocked Supabase responses cover desktop/phone-width layouts, category links, NPR prices, location persistence, empty/error/not-found states, signup validation and role metadata, login restoration, sign-out, and dashboard guards. Native device behavior and live Supabase email delivery have not been tested.
