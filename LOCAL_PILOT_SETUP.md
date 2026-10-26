# Local Phase 7 setup

The generated, git-ignored `apps/web/.env.local` and `apps/mobile/.env` point to `http://127.0.0.1:54321`. Web uses `NEXT_PUBLIC_SUPABASE_*`; Expo requires `EXPO_PUBLIC_SUPABASE_*`. These are local-only values, not hosted credentials.

Start separate terminals from the repository root:

```sh
pnpm dev:mock
pnpm dev:web
# Optional, in another terminal:
pnpm dev:mobile
```

The first command starts a localhost-only Supabase-compatible test service backed by ephemeral PGlite PostgreSQL. It applies all checked-in migrations and seeds the five service categories. Restarting it resets users and data. Its health endpoint is `http://127.0.0.1:54321/health`.

Demo accounts:

- Customer: `customer@tirkha.test`
- Verified professional: `professional@tirkha.test`
- Both passwords: `TirkhaLocal123!`

New signup accounts are confirmed immediately; newly signed-up professionals remain pending verification. The service supports the actual Supabase JS SDK for auth, refresh, logout, profile/category reads and the booking/chat RPCs used by the apps. Passwords are salted and hashed in memory. It is a development fixture, not a replacement for Supabase Auth or PostgREST in production. Use fictional information only.

Mock mode disables Realtime WebSocket connections and uses the existing polling refresh instead. Khalti checkout and Expo push are explicitly disabled with explanatory messages; no fake merchant secrets or EAS IDs are supplied. Real email confirmation, realtime delivery, financial transactions and push receipts need a configured test project.

For Android emulator or USB-connected Android testing, run `adb reverse tcp:54321 tcp:54321` so device localhost reaches the mock server. iOS Simulator shares the Mac host's localhost; this Windows setup cannot run it. A physical iPhone needs a separately configured reachable development backend. Do not replace localhost with a fake hosted URL. The service must remain running while testing auth; otherwise the apps correctly report a connection error.

## Checks

```sh
pnpm check:env
pnpm test
pnpm test:pilot
pnpm typecheck
```

`check:env` checks both app files and verifies their local-mode flags and anon keys match. `check:env:pilot` explicitly checks real Khalti, EAS and push settings and intentionally fails until those credentials are configured. Diagnostic errors name missing variables without printing values.

The test suite creates its own random-port mock server and temporary databases; it does not require the interactive service to be running and does not connect to hosted providers. Tests include all migrations, signup provisioning, category discovery, landmarks, booking transitions, chat access, payment state fixtures, push queue leases, and actual Supabase SDK calls to the local server.

The Windows execution environment used during setup requires a temporary Node standard-realpath compatibility preload for pnpm dependency resolution. That workaround lives outside this repository and is not an application dependency; a normal local terminal should use the commands above directly.

## Production verification limits

Typechecks do not certify native or production bundles. Prior Phase 7 production attempts encountered Windows native filesystem errors: Next.js SWC could not canonicalize the workspace path and Hermes could not write its temporary bytecode file. Those failures are distinct from TypeScript errors. No successful new production bundle is claimed by the local setup checks.

A static-only Next.js export cannot run the Khalti/push server routes added in Phases 6A–6B. Keep the server deployment configuration for the complete app; a separate static frontend would require moving those APIs to a separately deployed backend.
