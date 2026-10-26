import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database, PushJob } from "@tirkha/shared";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Push server is not configured");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
type Client = ReturnType<typeof client>;
type ExpoResult = { status?: string; id?: string; details?: { error?: string } };
async function expo(endpoint: "send" | "getReceipts", body: unknown) {
  const token = process.env.EXPO_ACCESS_TOKEN;
  const result = await fetch("https://exp.host/--/api/v2/push/" + endpoint, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000), cache: "no-store", redirect: "error",
  });
  if (!result.ok) throw new Error("Expo HTTP " + result.status);
  return await result.json() as { data?: ExpoResult[] | Record<string, ExpoResult> };
}
// Never put chat text, names, addresses or job details in lock-screen payloads.
export async function sendExpoAlert(job: PushJob) {
  const response = await expo("send", [{
    to: job.token, title: "Tirkha", body: job.kind === "chat" ? "You have a new booking message." : job.kind === "hero_dispatch" ? "A nearby service request matches your skills. Open Tirkha to review it." : "Your booking status has changed. Open Tirkha for details.",
    sound: "default", channelId: "bookings", ttl: 3600,
    data: { booking_id: job.booking_id, recipient_id: job.recipient_id, kind: job.kind, route: job.kind === "hero_dispatch" ? "/jobs" : "/bookings" },
  }]);
  if (!Array.isArray(response.data) || !response.data[0]) throw new Error("Invalid Expo ticket");
  return response.data[0];
}
async function update(db: Client, job: PushJob, values: Partial<PushJob>) {
  const { error } = await db.from("push_outbox").update(values).eq("id", job.id).eq("lease_id", job.lease_id!);
  if (error) throw error;
}
async function handle(db: Client, job: PushJob) {
  try {
    // Recheck registration and booking membership immediately before sending.
    const [device, booking, dispatch] = await Promise.all([
      db.from("push_devices").select("user_id").eq("token", job.token).eq("user_id", job.recipient_id).gt("updated_at", new Date(Date.now() - 30 * 86400000).toISOString()).maybeSingle(),
      db.from("bookings").select("customer_id,professional_id,status").eq("id", job.booking_id).maybeSingle(),
      job.kind === "hero_dispatch" ? db.from("hero_dispatch_notifications").select("id").eq("booking_id", job.booking_id).eq("professional_id", job.recipient_id).in("status", ["new", "seen"]).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    if (device.error || booking.error || dispatch.error) throw new Error("Recipient lookup failed");
    const eligible = job.kind === "hero_dispatch"
      ? !!dispatch.data && booking.data?.status === "requested"
      : !!booking.data && [booking.data.customer_id, booking.data.professional_id].includes(job.recipient_id);
    if (!device.data || !booking.data || !eligible) {
      await update(db, job, { state: "skipped", last_error: "Recipient no longer eligible" }); return;
    }
    let result: ExpoResult | undefined;
    if (job.ticket_id) {
      const receipts = await expo("getReceipts", { ids: [job.ticket_id] });
      if (receipts.data && !Array.isArray(receipts.data)) result = receipts.data[job.ticket_id];
      if (!result) { await update(db, job, { state: "receipt", available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: "Receipt not available yet" }); return; }
    } else result = await sendExpoAlert(job);
    if (result.status === "ok") {
      if (job.ticket_id) await update(db, job, { state: "delivered", last_error: null });
      else if (typeof result.id === "string" && result.id) await update(db, job, { state: "receipt", ticket_id: result.id, available_at: new Date(Date.now() + 15 * 60000).toISOString(), last_error: null });
      else throw new Error("Missing Expo ticket");
      return;
    }
    const code = result.details?.error || "UnknownExpoError";
    if (code === "DeviceNotRegistered") {
      const { error } = await db.from("push_devices").delete().eq("token", job.token).eq("user_id", job.recipient_id);
      if (error) throw error;
    }
    if (code === "MessageRateExceeded") throw new Error(code);
    await update(db, job, { state: "failed", last_error: code.slice(0, 100) });
  } catch {
    // A network interruption after Expo accepts a request may produce a duplicate
    // on retry. Delivery is at-least-once; ticket receipts never cause a resend.
    await update(db, job, { state: job.ticket_id ? "receipt" : "queued", available_at: new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000).toISOString(), last_error: "Delivery request failed; retry scheduled" });
  }
}
export async function dispatchPush(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  if (!secret || secret.length < 32) return Response.json({ error: "Push dispatcher is not configured" }, { status: 503 });
  const provided = Buffer.from(request.headers.get("authorization") || ""), expected = Buffer.from("Bearer " + secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = client();
    const { data, error } = await db.rpc("claim_push_jobs", { p_lease_id: randomUUID() });
    if (error) throw error;
    // Four connections, at most twenty deliveries per invocation.
    const jobs = data || [];
    for (let start = 0; start < jobs.length; start += 4) await Promise.all(jobs.slice(start, start + 4).map((job) => handle(db, job)));
    return Response.json({ processed: jobs.length }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Dispatcher failed; queued jobs will retry after their lease expires" }, { status: 503 }); }
}
