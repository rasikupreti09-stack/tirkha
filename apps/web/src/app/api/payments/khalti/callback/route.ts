import { paymentCallback } from "@/lib/khalti-server";
export const runtime = "nodejs";
export async function GET(request: Request) { return paymentCallback(request); }
