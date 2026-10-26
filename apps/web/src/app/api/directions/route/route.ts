import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { coordinatesSchema } from "@tirkha/shared";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Road routing is not configured. Set GOOGLE_MAPS_API_KEY on the server." }, { status: 503 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !bearer) return NextResponse.json({ error: "Sign in to calculate a route." }, { status: 401 });
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: user, error: authError } = await auth.auth.getUser(bearer);
  if (authError || !user.user) return NextResponse.json({ error: "Sign in to calculate a route." }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: "Invalid route request." }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Invalid route request." }, { status: 400 });
  const record = input as Record<string, unknown>;
  const origin = coordinatesSchema.safeParse(record.origin);
  const destination = coordinatesSchema.safeParse(record.destination);
  if (!origin.success || !destination.success) return NextResponse.json({ error: "Route requires valid origin and destination coordinates." }, { status: 400 });
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
      body: JSON.stringify({ origin: { location: { latLng: { latitude: origin.data.latitude, longitude: origin.data.longitude } } }, destination: { location: { latLng: { latitude: destination.data.latitude, longitude: destination.data.longitude } } }, travelMode: "DRIVE", routingPreference: "TRAFFIC_AWARE" }),
    });
    if (!response.ok) return NextResponse.json({ error: "The road-routing provider could not calculate a route." }, { status: 502 });
    const body = await response.json() as { routes?: Array<{ duration?: string; distanceMeters?: number; polyline?: { encodedPolyline?: string } }> };
    const route = body.routes?.[0];
    if (!route?.polyline?.encodedPolyline || !route.duration) return NextResponse.json({ error: "No driving route was found between these points." }, { status: 404 });
    return NextResponse.json({ encodedPolyline: route.polyline.encodedPolyline, durationSeconds: Number.parseInt(route.duration, 10), distanceMeters: route.distanceMeters });
  } catch { return NextResponse.json({ error: "Road-routing service is temporarily unavailable." }, { status: 502 }); }
}
