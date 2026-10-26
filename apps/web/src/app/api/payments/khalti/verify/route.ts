import { paymentPost } from "@/lib/khalti-server";
export const runtime = "nodejs";
export async function POST(request: Request) { return paymentPost(request, "verify"); }
