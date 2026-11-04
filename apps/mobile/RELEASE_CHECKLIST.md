# Tirkha native release checklist

## Before the first EAS build

- Confirm `com.tirkha.app` is available in both store accounts. If not, set `TIRKHA_ANDROID_PACKAGE` and `TIRKHA_IOS_BUNDLE_ID` to the final identifiers before publishing; store identifiers cannot be casually changed after release.
- Run `eas init` in `apps/mobile` and set `EXPO_PUBLIC_EAS_PROJECT_ID` in the development, preview, and production EAS environments.
- Configure `EXPO_PUBLIC_SUPABASE_URL`, the public anon/publishable key, and the HTTPS web API origin in each EAS environment. Never put a Supabase service-role key in a mobile build.
- Map rendering uses MapLibre Native with the public OpenFreeMap style; no Google Maps key is required. OpenFreeMap is a public, best-effort service without an SLA, so keep manual address entry available if tiles are unavailable.
- Confirm Supabase phone auth, redirect scheme `tirkha://auth/callback`, production RLS, and catalog availability on the production project.
- Provide app privacy disclosures, support contact, store listing assets, and reviewer/demo account instructions.

## Build and test sequence

1. `pnpm --filter @tirkha/mobile typecheck`
2. `pnpm --filter @tirkha/shared test`
3. Run `pnpm --filter @tirkha/mobile check:deps` from the repository root. Keep Expo SDK packages aligned with the SDK's expected versions and commit `pnpm-lock.yaml` alongside any package version changes.
4. With production EAS variables loaded locally or in CI, run `pnpm --filter @tirkha/mobile check:release`.
5. `pnpm --filter @tirkha/mobile build:preview`
6. Install the Android APK and iOS internal build on real devices; verify login, Hero trade onboarding, maps, booking, chat, push permission, deep links, offline/error recovery, and sign-out.
7. Complete a production EAS build only after preview sign-off, then submit separately to Play Console and App Store Connect.

## Release-specific notes

- Native Hero registration now collects a trade, operational zone, and private identity document, then submits them through the authenticated `submit_hero_registration` RPC. The Hero remains pending until an admin approves the KYC record; do not bypass that status for store builds.
- Apply the current Supabase migrations, including the latest Hero trade/region registration function and private `hero-kyc-documents` bucket policies, before testing this route against production. Never make the KYC bucket public.
- Store distribution requires EAS credentials, a Play Console account, and an Apple Developer account. CI configuration cannot replace those account and signing steps.
- MapLibre is native code: use an EAS development/preview build or another custom native build. It does not run in Expo Go. Expo SDK 57 uses the New Architecture required by MapLibre v11; rebuild after installing or changing the native map package. Keep map attribution enabled in the app.
- `EXPO_PUBLIC_TIRKHA_LOCAL_MOCK=1` is for a local mock build only. It does not intercept or bypass OTP requests; it must be `0` in store builds.
