import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@tirkha/shared";

type Transaction = Database["public"]["Tables"]["completed_transactions"]["Row"];
const BATCH_SIZE = 100;

function sameSecret(value: string | null, expected: string) {
  if (!value) return false;
  const left = Buffer.from(value), right = Buffer.from(`Bearer ${expected}`);
  return left.length === right.length && timingSafeEqual(left, right);
}
function dbClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Archive requires NEXT_PUBLIC_SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY.");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
function sameIds(actual: unknown, expected: string[]) {
  if (!Array.isArray(actual) || actual.length !== expected.length || !actual.every((id) => typeof id === "string")) return false;
  return [...actual].sort().every((id, index) => id === [...expected].sort()[index]);
}

export async function POST(request: Request) {
  const secrets = [process.env.FINANCE_ARCHIVE_CRON_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!secrets.length) return Response.json({ error: "Set FINANCE_ARCHIVE_CRON_SECRET or Vercel CRON_SECRET to protect the archive route." }, { status: 503 });
  if (!secrets.some((secret) => sameSecret(request.headers.get("authorization"), secret))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = dbClient();
    // Remove Storage files through the API; never delete object metadata directly.
    const { data: purgeRows, error: purgeReadError } = await db.from("booking_artifact_purge_queue").select("id,bucket_id,object_path").limit(BATCH_SIZE);
    if (purgeReadError) throw purgeReadError;
    if (purgeRows?.length) {
      if (purgeRows.some((row) => row.bucket_id !== "booking-chat-images")) throw new Error("Unexpected storage bucket in purge queue.");
      const { error: storageError } = await db.storage.from("booking-chat-images").remove(purgeRows.map((row) => row.object_path));
      if (storageError) return Response.json({ error: "Transient chat attachments could not be purged; retry is queued." }, { status: 503 });
      const { error: purgeDeleteError } = await db.from("booking_artifact_purge_queue").delete().in("id", purgeRows.map((row) => row.id));
      if (purgeDeleteError) throw purgeDeleteError;
    }
    const archiveUrl = process.env.FINANCE_ARCHIVE_URL;
    const archiveSecret = process.env.FINANCE_ARCHIVE_SECRET;
    if (!archiveUrl || !archiveSecret) return Response.json({ error: "Cold ledger is not configured. Set FINANCE_ARCHIVE_URL and FINANCE_ARCHIVE_SECRET." }, { status: 503 });
    const destination = new URL(archiveUrl);
    if (destination.protocol !== "https:") return Response.json({ error: "FINANCE_ARCHIVE_URL must use HTTPS." }, { status: 503 });
    const { data, error } = await db.from("completed_transactions").select("transaction_id,booking_id,timestamp,hero_id,hero_name,hero_trade,gross_amount,commission_rate,company_income,hero_payout,payment_type").order("timestamp", { ascending: true }).limit(BATCH_SIZE);
    if (error) throw error;
    const transactions = (data || []) as Transaction[];
    if (!transactions.length) return Response.json({ archived: 0, message: "No pending financial rows." }, { headers: { "Cache-Control": "no-store" } });
    const ids = transactions.map((row) => row.transaction_id).sort();
    const idempotencyKey = createHash("sha256").update(ids.join("\n")).digest("hex");
    const destinationResponse = await fetch(destination, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
      headers: { Authorization: `Bearer ${archiveSecret}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ schema: "tirkha.finance.archive.v1", idempotency_key: idempotencyKey, transactions }),
    });
    if (!destinationResponse.ok) return Response.json({ error: "Cold ledger did not accept the batch; primary records were retained." }, { status: 502 });
    const acknowledgement: unknown = await destinationResponse.json().catch(() => null);
    const acceptedIds = acknowledgement && typeof acknowledgement === "object" && "accepted_transaction_ids" in acknowledgement
      ? (acknowledgement as { accepted_transaction_ids?: unknown }).accepted_transaction_ids : null;
    if (!sameIds(acceptedIds, ids)) return Response.json({ error: "Cold ledger acknowledgement did not match the batch; primary records were retained." }, { status: 502 });
    const { data: archived, error: finalizeError } = await db.rpc("finalize_finance_archive", { p_transaction_ids: ids });
    if (finalizeError) throw finalizeError;
    return Response.json({ archived: archived || 0, batch_id: idempotencyKey }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Archive failed safely; unconfirmed financial rows remain available for retry." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) { return POST(request); }





