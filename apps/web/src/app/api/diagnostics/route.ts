import { NextResponse } from "next/server";
import { diagnosticLanguageForText } from "@tirkha/shared";
import { TRIAGE_RESPONSE_FORMAT, TRIAGE_SYSTEM_PROMPT } from "@/lib/ai/triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rateWindowMs = 10 * 60_000;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
function takeRateLimit(ip: string) {
  const now = Date.now(), bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= rateWindowMs) { rateBuckets.set(ip, { startedAt: now, count: 1 }); return true; }
  if (bucket.count >= 5) return false;
  bucket.count += 1;
  return true;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Assessment must be sent from this site." }, { status: 403 });
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!takeRateLimit(clientIp)) return NextResponse.json({ error: "Assessment limit reached. Try again later." }, { status: 429 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Visual AI is not configured. Text safety checks and clarification remain available." }, { status: 503 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Could not read the assessment request." }, { status: 400 }); }
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid assessment request." }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const symptom = typeof body.symptom === "string" ? body.symptom.trim().slice(0, 1200) : "";
  const imageDataUrl = body.imageDataUrl;
  if (!symptom && !imageDataUrl) return NextResponse.json({ error: "Describe the issue or attach a photo." }, { status: 400 });
  if (imageDataUrl !== undefined && (typeof imageDataUrl !== "string" || imageDataUrl.length > 4_400_000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl))) return NextResponse.json({ error: "Use a JPG, PNG or WebP image under 3 MB." }, { status: 400 });

  const requestedLanguage = body.language;
  const detectedLanguage = requestedLanguage === "english" || requestedLanguage === "nepali_devanagari" || requestedLanguage === "nepali_romanized" ? requestedLanguage : diagnosticLanguageForText(symptom);
  const language = detectedLanguage === "english" ? "english" : "nepali_devanagari";
  const languageName = language === "english" ? "professional English" : "authentic Nepali written entirely in Devanagari script";
  const content: Array<Record<string, string>> = [{ type: "input_text", text: `Customer description: ${symptom || "No written description supplied."}\nReply in ${languageName}.` }];
  if (typeof imageDataUrl === "string") content.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini", instructions: TRIAGE_SYSTEM_PROMPT, input: [{ role: "user", content }], text: { format: TRIAGE_RESPONSE_FORMAT }, max_output_tokens: 600, store: false }),
    });
    if (!response.ok) return NextResponse.json({ error: "Visual assessment is unavailable. Use the safety and text clarification flow." }, { status: 502 });
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const output = result.output_text ?? result.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
    if (!output) throw new Error("The model returned no structured assessment.");
    const assessment = JSON.parse(output) as Record<string, unknown>;
    const safeText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const evidence = Array.isArray(assessment.visual_evidence) ? assessment.visual_evidence.filter((entry): entry is string => typeof entry === "string").slice(0, 6).map(entry => entry.slice(0, 160)) : [];
    const choices = Array.isArray(assessment.clarification_choices) ? assessment.clarification_choices.filter((entry): entry is string => typeof entry === "string").slice(0, 4).map(entry => entry.slice(0, 100)) : [];
    const allowedIssueIds = new Set(["tap-leak", "pipe-leak", "blocked-drain", "low-pressure", "air-in-line", "muddy-water", "pump", "solar-water-heater", "water-heater", "tank-overflow", "toilet-flush", "no-water", "intermittent-supply", "pipe-noise", "no-power", "flicker", "breaker-trip", "sparks-burning", "hot-outlet", "electric-shock", "voltage", "inverter", "overload", "earthing", "appliance", "unknown"]);
    return NextResponse.json({
      issue_title: safeText(assessment.issue_title, 120) || "Unclassified issue",
      explanation: safeText(assessment.explanation, 500) || "The evidence is insufficient to classify the fault.",
      issue_id: typeof assessment.issue_id === "string" && allowedIssueIds.has(assessment.issue_id) ? assessment.issue_id : "unknown",
      visual_clarity: assessment.visual_clarity === "clear" || assessment.visual_clarity === "limited" || assessment.visual_clarity === "not_applicable" ? assessment.visual_clarity : "poor",
      visual_material: safeText(assessment.visual_material, 120),
      visual_mounting: safeText(assessment.visual_mounting, 120),
      visual_defect: safeText(assessment.visual_defect, 160),
      visual_evidence: evidence,
      root_cause_hypothesis: safeText(assessment.root_cause_hypothesis, 300),
      urgency: assessment.urgency === "urgent" ? "urgent" : assessment.urgency === "soon" ? "soon" : "routine",
      safety_note: safeText(assessment.safety_note, 500),
      photo_assessed: typeof imageDataUrl === "string",
      request_closer_photo: assessment.request_closer_photo === true,
      clarification_question: safeText(assessment.clarification_question, 300),
      clarification_choices: choices,
      language,
    });
  } catch {
    return NextResponse.json({ error: "Assessment is unavailable. Describe the visible issue or try a closer photo." }, { status: 502 });
  }
}


