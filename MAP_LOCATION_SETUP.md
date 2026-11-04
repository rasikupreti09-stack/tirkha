# Phase 8 — booking map locations

Web bookings use Leaflet / React Leaflet, loaded with SSR disabled. Native
bookings use MapLibre Native (`@maplibre/maplibre-react-native` 11.5.1) with the
public OpenFreeMap style. Both have controlled location pickers, draggable pins,
manual address fallback and optional area lookup. The initial Kathmandu camera
center is not saved as a selection until the customer picks a pin.

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
Native maps use the OpenFreeMap style with MapLibre attribution enabled.

## Native map and build configuration

The native app uses MapLibre Native and OpenFreeMap; the current setup does not
require a Google Maps API key, Google Cloud billing, or `GOOGLE_MAPS_ANDROID_API_KEY`.
Do not create or add that variable for this map implementation. The public map
style is best-effort and has no service-level guarantee; map tiles need internet,
so keep address entry available when tiles or GPS are unavailable. Preserve map
attribution in the app.

MapLibre contains native code, so use an EAS development/preview build or another
custom native build. Expo Go cannot load this native module. After changing
MapLibre or its native configuration, create a new native build; a JavaScript
update alone cannot install native code. The complete browser map remains in
`apps/web`.

## Local pilot and verification

With the existing local mock environment and `pnpm dev:mock` + `pnpm dev:web`,
the local booking service applies migration 07 automatically. The geocoding
route returns **Kathmandu (local demo)** for pins in the Kathmandu pilot area.
This is explicit fixture data, not a live reverse-geocoding result. Outside
that area, enter the address manually. Map tiles themselves still need internet.

Run `pnpm typecheck` and the relevant shared package tests. Tests cover label
parsing/provider errors using a fake fetch transport, saved pins, database
coordinate constraints, idempotent retries, private rate-limit/cache
permissions and Supabase SDK booking round-trips against the local service.
Tests do not query public OSM.

Before a device pilot, verify tap/drag, manual coordinates, saved-pin restoration,
lookup failure and retry, moving a pin during lookup, and the returned booking
fields on a configured web server and native build. Typechecks and database
tests do not establish native map rendering or live-provider availability.
