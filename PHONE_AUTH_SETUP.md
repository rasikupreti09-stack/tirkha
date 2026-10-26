# Phone authentication and booking communications

## Deployment
1. Back up the database and apply migrations 01–10 first. Enable the Supabase Phone provider and configure an SMS provider that delivers to Nepal (+977). Configure the SMS template to include the token, and use a six-digit OTP configuration. Keep SMS credentials in Supabase, never in public web or mobile environment variables.
2. Existing profiles must have a verified Nepal mobile number in Auth before migration 11. While the previous email login remains deployed, use Supabase's authenticated phone-change flow: updateUser with the new phone, then verifyOtp with type phone_change. Ownership must be proven through SMS; do not copy arbitrary profile metadata or fabricate numbers. Preserve the same Auth user ID to preserve bookings. Arrange this enrollment before switching the login screens.
3. Apply packages/shared/supabase/migrations/11_phone_auth.sql. It runs transactionally and stops with a diagnostic if any existing profile has a missing or invalid verified phone; duplicate normalized phones also fail. Resolve the identified accounts, then retry. No accounts or bookings are removed.
4. Deploy the updated clients after the migration succeeds. New phone signups receive no profile until Supabase verifies their SMS code. Customers can sign in without email. Professional signups remain pending professional verification.
5. Test real SMS delivery with your configured provider in staging, including invalid codes, expiry, resend limits, new signup, existing-user sign-in and session restoration. No live SMS delivery was exercised by the automated tests.

The canonical profiles.phone is required, unique and stored as +977 followed by ten digits starting with 9. profiles.email is optional and synchronized only from confirmed Auth email. The old phone_number field remains for database compatibility, is read-only to clients, and is never used for calls. Phone changes must use Auth verification. Profile metadata cannot grant admin status or modify an existing user's role.

The shared createPhoneAuth(client) returns signInWithPhone(phone, signup?) and verifyPhoneOtp(phone, token). Login uses shouldCreateUser:false; signup allowlists customer/professional and full name. Supabase manages session persistence through the existing app providers. Client resend cooldown is 60 seconds; server rate limits remain authoritative.

## Local demo
Run pnpm dev:mock, then pnpm dev:web or pnpm dev:mobile with the existing local environment configuration. Restart the mock after upgrading: its database is ephemeral.

- Customer: +9779800000001
- Verified professional: +9779800000002
- Fixed local SMS code: 123456
- New phone numbers can sign up locally; codes expire after five minutes, allow five attempts and cannot be reused.
- No real SMS is sent. The fixed code exists only in the loopback mock server, never in production verification.
- Legacy email fixture accounts remain available to automated tests. Their generated test numbers exist only in the ephemeral fixture.

## Calls and receipts
get_booking_contact is available only to authenticated participants of an assigned booking after acceptance. Incoming open requests and unrelated users never receive a phone number. Web tracking and provider controls use tel links; mobile uses the device dialer after a tap.

Checkout continues to support eSewa, Khalti and COD. Receipts include the labour subtotal, additional fees charged, total NPR, payment status and gateway reference; COD explicitly shows the amount due and is not proof of payment. Materials and taxes are not itemized, and this record is not a tax invoice. Sandbox receipts are labelled. Payment status is separate from the job's progress.

See PAYMENT_GATEWAYS_SETUP.md for server-only gateway secrets, callback URLs and settlement verification. Real gateway settlement still needs staging credentials and testing.

## Verification
pnpm typecheck checks shared, web and mobile. pnpm test covers schema validation, verified phone provisioning, uniqueness, role protection, OTP SDK flows, contact isolation, booking lifecycle and gateway verification. Tests use an ephemeral PostgreSQL-compatible database and a loopback HTTP server, not hosted accounts.

References:
- [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp)

