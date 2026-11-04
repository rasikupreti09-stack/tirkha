# Tirkha

Tirkha is a Nepal-focused home-services marketplace with a Next.js web app, an Expo/React Native app, and a shared TypeScript domain package. The workspace includes customer discovery and booking, Hero onboarding and dispatch, Supabase-backed chat and tracking, payments, regional service availability, and an admin operations surface.

## Workspace

```text
apps/web       Next.js App Router, Tailwind CSS, web marketplace and operations UI
apps/mobile    Expo Router, React Native, NativeWind; Android, iOS and web export
packages/shared  Zod contracts, TypeScript types, catalog/pricing, design tokens and Supabase migrations
```

## Prerequisites and install

- Node.js 24 (see `.node-version`)
- pnpm 11.19.0
- Git

From the repository root:

```powershell
pnpm install --frozen-lockfile
```

The workspace is configured for pnpm's isolated dependency linker. Keep `pnpm-lock.yaml` in sync with every manifest change; do not install app dependencies from inside `apps/web` or `apps/mobile` with npm.

## Environment configuration

Copy the examples only when the local environment files do not already exist, so existing credentials are not overwritten:

```powershell
if (-not (Test-Path apps/web/.env.local)) { Copy-Item apps/web/.env.example apps/web/.env.local }
if (-not (Test-Path apps/mobile/.env)) { Copy-Item apps/mobile/.env.example apps/mobile/.env }
```

Configure the Supabase URL and public anon/publishable key for each app. Mobile also needs the deployed HTTPS API origin. Android native maps need a restricted Google Maps key for production builds; iOS uses Apple Maps. See `apps/mobile/RELEASE_CHECKLIST.md` for EAS setup.

`NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are bundled into client applications. Never put a Supabase service-role key, payment secret, signing key, or other server secret in a web or mobile environment file. Local mock mode is for local development only and must be disabled for production.

## Run locally

```powershell
pnpm dev:web
pnpm dev:mobile
```

The web app runs at `http://localhost:3000`. Expo can launch an Android emulator or a development build on a physical device. Expo Go may not support every native module in this app; use an EAS development build when needed.

## Quality gates

Run before committing:

```powershell
pnpm theme:check
pnpm typecheck
pnpm test
pnpm check:expo
pnpm build:web
pnpm --filter @tirkha/mobile export:native
```

The shared suite uses PGlite to exercise database migrations, row-level security, RPC contracts, booking/payment flows, and pilot journeys. Native export validates Android/iOS JavaScript bundling; it does not replace signed EAS builds or testing on real devices.

GitHub Actions runs the repository quality gate on pushes and pull requests to `master`.

## Database change discipline

Shared database SQL currently lives in `packages/shared/supabase/migrations/` and is applied in sequence in the PGlite suite. The migration history contains two files with the `29_` version prefix, and the production database's migration-ledger state has not been verified in this workspace. **Do not run `supabase db push` against production until those two facts are reconciled.** For now, review and test SQL locally, capture a production schema/history backup, and deploy only after confirming which migrations were actually applied. Future production schema changes should use unique, timestamped migration versions and one tracked deployment path.

RLS is the authorization boundary: do not rely on UI role checks to protect customer, Hero, admin, payment, or KYC data. KYC documents must remain in the private `hero-kyc-documents` bucket.

## Mobile store release

Before preview or production builds, configure a real EAS project, production EAS environment variables, final Android/iOS bundle identifiers, a restricted Android Maps key, and store signing credentials. Keep local mock mode off. Obtain internal-build sign-off on Android and iOS before submitting to Google Play or App Store Connect. The remaining account and device checks are listed in `apps/mobile/RELEASE_CHECKLIST.md`.
