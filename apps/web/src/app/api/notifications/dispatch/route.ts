import { dispatchPush } from "@/lib/push-server";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) { return dispatchPush(request); }
