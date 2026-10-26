import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const bookingId = new URL(request.url).searchParams.get("booking_id");
  if (!supabaseUrl || !anonKey || !bearer || !bookingId) return NextResponse.json({ error: "Sign in with an active booking to configure a call." }, { status: 401 });

  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(bearer);
  if (authError || !authData.user) return NextResponse.json({ error: "Your session has expired. Sign in again to call." }, { status: 401 });

  const { data: booking, error: bookingError } = await auth.from("bookings").select("id,customer_id,professional_id,status").eq("id", bookingId).maybeSingle();
  const caller = authData.user.id;
  if (bookingError || !booking || (booking.customer_id !== caller && booking.professional_id !== caller)
      || !["accepted", "on_the_way", "in_progress"].includes(booking.status)) {
    return NextResponse.json({ error: "A voice call is available only to participants in an active booking." }, { status: 403 });
  }

  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [...FALLBACK_ICE_SERVERS];
  const urls = (process.env.NEXT_PUBLIC_TURN_URL || "").split(",").map(value => value.trim()).filter(Boolean);
  const usernamePrefix = process.env.TURN_USERNAME;
  const password = process.env.TURN_PASSWORD;
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  const validTurnUrls = urls.length > 0 && urls.every(url => /^turns?:/i.test(url));
  if (validTurnUrls && usernamePrefix && password) {
    if (sharedSecret) {
      // Coturn REST credentials expire after one hour when TURN_SHARED_SECRET is configured.
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const username = `${expiresAt}:${usernamePrefix}-${caller}`;
      const credential = createHmac("sha1", sharedSecret).update(username).digest("base64");
      iceServers.push({ urls, username, credential });
    } else {
      // Provider-issued credentials are returned only to authenticated booking participants.
      iceServers.push({ urls, username: usernamePrefix, credential: password });
    }
  }

  return NextResponse.json({ iceServers, relayConfigured: iceServers.length > FALLBACK_ICE_SERVERS.length }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
