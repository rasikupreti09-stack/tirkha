# Tirkha Auth setup

## 1. Apply the migrations

Apply `packages/shared/supabase/migrations/01_initial_schema.sql` first if it has not already been applied. Then apply `02_auth_signup_roles.sql`. Do not reapply migration 01 on an initialized database.

Migration 02 changes creation-time onboarding only: a customer gets a profile, and a professional gets a profile plus a professional record with pending verification. Only the exact metadata value `requested_role: professional` selects that role; all other values default to customer. Arbitrary admin/verification metadata is ignored. Existing accounts are not reclassified. Changing user metadata after signup cannot change profile roles.

The backend must still control professional verification and admin promotion. Client role updates remain forbidden by column grants and RLS.

## 2. Set client environment variables

Use the templates already in each app:

- Web: `apps/web/.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Mobile: `apps/mobile/.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

Both must refer to the same Supabase project. Use only a public anon key, never a service-role key. Restart development servers after changing values. Hosting and EAS environments need the same variables at build time.

Missing configuration shows an unavailable state rather than breaking static builds. No real credentials are included in this repository.

## 3. Configure Supabase Auth

Enable the Email provider. Keep email confirmation enabled and set the project's password minimum to at least 8 characters (matching the form). Stronger project settings may reject additional passwords, which the UI reports.

Set Auth Site URL to your deployed web URL. Add these exact redirect URLs:

- `http://localhost:3000/login` for local web development.
- `https://YOUR_WEB_DOMAIN/login` for production.
- `tirkha://auth/callback` for native development/production builds using the app's configured scheme.

The mobile app obtains its URL using Expo Linking. Expo Go uses an `exp://...` development URL instead of the stable custom scheme; if testing confirmations through Expo Go, allowlist the exact URL generated for that development session. Prefer a development build for reliable native link testing. Avoid broad production redirect wildcards.

Use Supabase's confirmation email template with `{{ .ConfirmationURL }}`, and configure production SMTP delivery. Supabase's default email delivery is restricted and is unsuitable for a public launch.

Both clients deliberately use the implicit flow for these email/password confirmation redirects. Web handles callback fragments through Supabase Auth at `/login`. Mobile validates its callback route and exchanges the returned access/refresh tokens through `setSession`. No client can select an arbitrary return-to destination. Do not log or share callback URLs containing tokens. If you later adopt SSR/OAuth/PKCE, update the callback implementation as one coordinated change.

With confirmation enabled, a successful signup may have no session: the UI displays a check-email message and does not pretend the user is signed in. Confirming on another device still allows email/password login in the original app. Existing-account responses use neutral confirmation wording because Supabase can intentionally obscure whether an account exists.

## 4. Run

From the repository root:

```sh
pnpm dev:web
pnpm dev:mobile
```

Use separate terminals. Web routes are `/login`, `/signup`, and `/dashboard`. Mobile files are `app/(auth)/login.tsx`, `app/(auth)/signup.tsx`, `app/(app)/dashboard.tsx`, and `app/auth/callback.tsx`.

Sessions persist in browser storage on web and AsyncStorage on mobile. Mobile refresh follows AppState and uses Supabase's process lock. The providers unsubscribe on unmount and do not call asynchronous Supabase methods inside auth change callbacks. Signed-in users leave auth screens automatically; signed-out users are redirected away from dashboards. Local sign-out clears the current device/browser session, not every device.

The dashboard fetches the current profile and professional verification state from RLS-protected database rows, never from user-editable auth metadata. It includes sign-out, loading, retry, and missing-profile error states. Booking features are not part of this phase.

Web remains a static Next.js export. Client redirects are user experience controls; database RLS is the authorization boundary. No middleware or server session cookies are used.

## 5. Validate

```sh
pnpm --filter @tirkha/shared test
pnpm typecheck
pnpm build:web
pnpm --filter @tirkha/mobile run export:native
```

For live acceptance testing with your project:

1. Sign up a customer, confirm the email, and check the customer dashboard.
2. Sign up a professional and verify that their professional row is pending.
3. Try invalid email, short password, mismatched confirmation, and incorrect login.
4. Reload the browser/restart the mobile app; verify the session is restored without flashing the login form.
5. Sign out, navigate back, and verify the dashboard remains protected.
6. Open expired confirmation links and verify an error with a route back to sign-in.
7. On Android and iOS, test confirmation links while the app is closed and while running.
8. Verify the database rejects role/admin promotion, self-verification, and cross-user profile access.

Automated local tests use embedded PostgreSQL and mocked auth events. They do not send email or create real Supabase users.
