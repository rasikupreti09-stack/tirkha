# Tirkha native release checklist

## Before the first EAS build

- Confirm `com.tirkha.app` is available in both store accounts. If not, set `TIRKHA_ANDROID_PACKAGE` and `TIRKHA_IOS_BUNDLE_ID` to the final identifiers before publishing; store identifiers cannot be casually changed after release.
- Run `eas init` in `apps/mobile` and set `EXPO_PUBLIC_EAS_PROJECT_ID` in the development, preview, and production EAS environments.
- Configure `EXPO_PUBLIC_SUPABASE_URL`, the public anon/publishable key, and the HTTPS web API origin in each EAS environment. Never put a Supabase service-role key in a mobile build.
- Create an Android-restricted Google Maps key (package name + Play signing SHA-1) and set `GOOGLE_MAPS_ANDROID_API_KEY` in EAS. iOS uses the native Apple Maps provider.
- Confirm Supabase phone auth, redirect scheme `tirkha://auth/callback`, production RLS, and catalog availability on the production project.
- Provide app privacy disclosures, support contact, store listing assets, and reviewer/demo account instructions.

## Build and test sequence

1. `pnpm --filter @tirkha/mobile typecheck`
2. `pnpm --filter @tirkha/shared test`
3. Run `expo install --check` from `apps/mobile`; the installed Expo CLI currently reports six Expo package patch versions behind its recommended SDK 57 versions. Update the dependency pins and lockfile together with `expo install --fix` before building.
4. With production EAS variables loaded locally or in CI, run `pnpm --filter @tirkha/mobile check:release`.
5. `pnpm --filter @tirkha/mobile build:preview`
6. Install the Android APK and iOS internal build on real devices; verify login, Hero trade onboarding, maps, booking, chat, push permission, deep links, offline/error recovery, and sign-out.
7. Complete a production EAS build only after preview sign-off, then submit separately to Play Console and App Store Connect.

## Release-specific notes

- The current mobile signup provisions a pending Hero profile and records its trade. It does not yet collect the identity document and operational zone required by the secure Hero registration RPC; do not enable Hero dispatch until that native onboarding step is built and verified.
- Store distribution requires EAS credentials, a Play Console account, and an Apple Developer account. CI configuration cannot replace those account and signing steps.
- `EXPO_PUBLIC_TIRKHA_LOCAL_MOCK=1` is for a local mock build only. It does not intercept or bypass OTP requests; it must be `0` in store builds.
