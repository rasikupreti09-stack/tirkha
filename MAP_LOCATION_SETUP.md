# Phase 8 — booking map locations

Web bookings use Leaflet 1.9.4 / React Leaflet 5.0.0, loaded with SSR disabled.
Native bookings use Expo 57's compatible react-native-maps 1.27.2. Both have
reusable controlled `LocationPicker` components, manual coordinate entry,
draggable pins, optional area lookup and a landmark fallback. The initial
Kathmandu map center is not saved as a selection until the customer picks a pin.

## Database and server setup

1. Apply `packages/shared/supabase/migrations/07_booking_locations.sql` after
   migrations 01–06, before releasing either client. Existing bookings remain
   valid with null map fields; old seven-argument booking requests still work.
2. Configure the web server's existing `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL`.
   The service role key must remain server-only. Both clients authenticate with
   their Supabase bearer session at `POST /api/geocoding/reverse`.
3. For live area lookup, turn off `TIRKHA_LOCAL_MOCK` on the web server and use
   the same live Supabase project in both apps. Optional server variables:
   `NOMINATIM_REVERSE_URL` (defaults to the public OSM reverse endpoint), and
   `NOMINATIM_USER_AGENT` (defaults to a Tirkha application identifier; add your
   actual deployment contact URL/email when available). Restart after changes.
4. Mobile must set `EXPO_PUBLIC_API_URL` to that Next.js server's origin. On a
   physical phone, a development server requires a reachable LAN address;
   `127.0.0.1` refers to the phone itself. Hosted origins must use HTTPS.

The booking RPC persists `latitude`, `longitude` and `resolved_address` alongside
the landmark-based `service_address`. Database checks reject partial or invalid
coordinates and address labels without a pin. Request IDs compare all map fields
on retries. The saved location on the device also retains the pin. Moving the
pin clears its resolved label and any municipality autofilled from that label;
late lookup responses cannot overwrite a newer pin.

## Provider usage

Address resolution happens only after pressing **Resolve area**, never on each
drag or keystroke. The server sends area-level coordinates and an application
identifier, caches labels for seven days in approximately 11-metre cells, and
uses a PostgreSQL gate shared across instances. A provider request has a
10-second timeout, a 30-second recovery lease and a 1.1-second cooldown after
completion. Busy requests return HTTP 429 without automatic retries. All web
and mobile deployments sharing the public provider must use this same gate;
independent projects need a shared gateway or a different provider.

The public Nominatim service permits a maximum of one request per second for
the entire application and is suitable only for moderate, user-driven traffic.
Switch the server endpoint to a compatible hosted/self-hosted provider before
scaling. See the [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
and [reverse API](https://nominatim.org/release-docs/latest/api/Reverse/).

Only coordinates are sent to the geocoder, not landmark text, names or job
details. Returned labels are approximate, and non-Nepal results are rejected.
Pin coordinates remain at their original precision. OpenStreetMap attribution
is visible on both pickers. The web map uses normal browser-cached OSM tiles,
with no prefetch/offline-download feature; preserve its attribution and browser
Referer headers per the [tile policy](https://operations.osmfoundation.org/policies/tiles/).
Native maps use the platform provider and its built-in attribution.

## Native build configuration

`apps/mobile/app.config.ts` registers the react-native-maps config plugin.
For Android development/production builds, enable Maps SDK for Android and set
`GOOGLE_MAPS_ANDROID_API_KEY` in the build environment. Restrict the key to the
application package and signing certificate. Rebuild the native binary after
changing the key or adding the native dependency; a JavaScript update alone
does not install it. Do not commit a key. iOS uses Apple Maps by default and
does not need a Google Maps key. See [Expo maps setup](https://docs.expo.dev/versions/latest/sdk/map-view/).

Expo Go uses its own map configuration. Expo's web renderer falls back to
coordinate entry; the full browser map is in `apps/web`.

## Local pilot and verification

With the existing local mock environment and `pnpm dev:mock` + `pnpm dev:web`,
the local booking service applies migration 07 automatically. The geocoding
route returns **Kathmandu (local demo)** for pins in the Kathmandu pilot area.
This is explicit fixture data, not a live reverse-geocoding result. Outside
that area, enter the address manually. Map tiles themselves still need internet.

Run `pnpm typecheck` and `pnpm test`. Tests cover label parsing/provider errors
using a fake fetch transport, saved pins, database coordinate constraints,
idempotent retries, private rate-limit/cache permissions and actual Supabase SDK
booking round-trips against the local service. Tests do not query public OSM.

Before a device pilot, verify tap/drag, manual coordinates, saved-pin restoration,
lookup failure and retry, moving a pin during lookup, and the returned booking
fields on a configured web server and native build. Typechecks and database
tests do not establish native map rendering or live-provider availability.
