import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { coordinatesSchema, reverseGeocode, NOMINATIM_REVERSE_URL, supabaseSettings, ConfigurationError, type Database } from "@tirkha/shared";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers: { ...headers, ...(status === 429 ? { "Retry-After": "2" } : {}) } });
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(process.env.APP_URL || request.url).origin) return failure("This origin is not allowed.", 403);
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token || token.length > 8192) return failure("Sign in to resolve your service location.", 401);
    const config = supabaseSettings(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC");
    const auth = createClient(config.url, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const user = await auth.auth.getUser(token);
    if (user.error || !user.data.user) return failure("Your session expired. Sign in again.", 401);
    const raw = await request.text();
    if (raw.length > 1024) return failure("Invalid location request.", 400);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return failure("Invalid location request.", 400); }
    const point = coordinatesSchema.safeParse(body);
    if (!point.success) return failure("Enter valid latitude and longitude.", 400);
    const { latitude, longitude } = point.data;

    // Offline auth pilot: clearly labelled fixture data, never masquerading as
    // a live geocoder and never sending demo coordinates to the public service.
    if (process.env.TIRKHA_LOCAL_MOCK === "1") {
      if (latitude < 27.5 || latitude > 27.9 || longitude < 85.1 || longitude > 85.6) return failure("Local demo lookup covers Kathmandu only. Enter the area manually.", 422);
      return Response.json({ ...point.data, resolved_address: "Kathmandu (local demo)" }, { headers });
    }
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey || serviceKey.startsWith("YOUR_")) return failure("Address lookup needs SUPABASE_SERVICE_ROLE_KEY on the web server and migration 07. You can enter your landmark manually.", 503);
    const db = createClient<Database>(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const endpoint = process.env.NOMINATIM_REVERSE_URL || NOMINATIM_REVERSE_URL;
    // Approx. 11 m cache cells; the pin itself retains its original precision.
    const lat = Number(latitude.toFixed(4)), lon = Number(longitude.toFixed(4));
    const key = `${endpoint}|en|14|${lat},${lon}`;
    const cached = await db.from("geocoding_cache").select("area").eq("key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (cached.error) return failure("Address cache is unavailable. Apply migration 07 or enter your landmark manually.", 503);
    if (cached.data) return Response.json({ ...point.data, resolved_address: cached.data.area }, { headers });

    const lease = randomUUID();
    const signal = AbortSignal.timeout(10000);
    const claim = await db.rpc("claim_geocoding", { p_lease_id: lease });
    if (claim.error) return failure("Address lookup is unavailable. Check migration 07.", 503);
    if (!claim.data) return failure("Address lookup is busy. Wait a moment, then tap Resolve area again.", 429);
    try {
      signal.throwIfAborted();
      const area = await reverseGeocode(lat, lon, {
        endpoint, userAgent: process.env.NOMINATIM_USER_AGENT || "Tirkha/0.1 (Nepal service booking)", signal,
      });
      const saved = await db.from("geocoding_cache").upsert({ key, area, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
      if (saved.error) return failure("Address cache is unavailable. Enter the area manually.", 503);
      return Response.json({ ...point.data, resolved_address: area }, { headers });
    } catch (error) {
      const message = error instanceof Error && /^(Choose a service location|No area found|Address lookup)/.test(error.message)
        ? error.message : "Address lookup is unavailable. Enter your municipality and landmark manually.";
      return failure(message, 502);
    } finally {
      // Failed release leaves the conservative 30-second lease in place.
      await db.rpc("release_geocoding", { p_lease_id: lease });
    }
  } catch (error) {
    return failure(error instanceof ConfigurationError ? error.message : "Address lookup is unavailable. Enter your municipality and landmark manually.", 503);
  }
}
