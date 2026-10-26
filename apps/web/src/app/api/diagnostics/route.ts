import { NextResponse } from "next/server";
import { diagnosticLanguageForText } from "@tirkha/shared";
import { TRIAGE_RESPONSE_FORMAT, TRIAGE_SYSTEM_PROMPT } from "@/lib/ai/triage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rateWindowMs = 10 * 60_000;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
function takeRateLimit(ip: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.startedAt >= rateWindowMs) { rateBuckets.set(ip, { startedAt: now, count: 1 }); return true; }
  if (bucket.count >= 5) return false;
  bucket.count += 1;
  return true;
}
const languageNames = { english: "English", nepali_devanagari: "Nepali written in Devanagari script", nepali_romanized: "Romanized Nepali written in Latin script" } as const;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Photo assessment must be sent from this site." }, { status: 403 });
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!takeRateLimit(clientIp)) return NextResponse.json({ error: "You’ve reached the photo-assessment limit. Please try again later." }, { status: 429 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Visual AI is not configured. You can continue with the text-based safety and clarification flow." }, { status: 503 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Could not read the assessment request." }, { status: 400 }); }
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid assessment request." }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const symptom = typeof body.symptom === "string" ? body.symptom.trim().slice(0, 1200) : "";
  const imageDataUrl = body.imageDataUrl;
  if (!symptom && !imageDataUrl) return NextResponse.json({ error: "Describe the issue or attach a photo." }, { status: 400 });
  if (imageDataUrl !== undefined && (typeof imageDataUrl !== "string" || imageDataUrl.length > 4_400_000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl))) return NextResponse.json({ error: "Use a JPG, PNG or WebP image under 3 MB." }, { status: 400 });

  const requestedLanguage = body.language;
  const language = requestedLanguage === "english" || requestedLanguage === "nepali_devanagari" || requestedLanguage === "nepali_romanized" ? requestedLanguage : diagnosticLanguageForText(symptom);
  const userContent: Array<Record<string, string>> = [{ type: "input_text", text: `Customer description: ${symptom || "No written description supplied."}\nRespond in ${languageNames[language]}.` }];
  if (typeof imageDataUrl === "string") userContent.push({ type: "input_image", image_url: imageDataUrl, detail: "high" });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini",
        instructions: TRIAGE_SYSTEM_PROMPT,
        input: [{ role: "user", content: userContent }],
        text: { format: TRIAGE_RESPONSE_FORMAT },
        max_output_tokens: 500,
        store: false,
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Visual assessment is temporarily unavailable. The text-based triage is still available." }, { status: 502 });
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const output = result.output_text ?? result.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
    if (!output) throw new Error("The model returned no structured assessment.");
    const assessment = JSON.parse(output) as Record<string, unknown>;
    const confidence = Number(assessment.visual_confidence_pct);
    const evidence = Array.isArray(assessment.visual_evidence) ? assessment.visual_evidence.filter((entry): entry is string => typeof entry === "string").slice(0, 6).map(entry => entry.slice(0, 160)) : [];
    const safeText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    return NextResponse.json({
      issue_title: safeText(assessment.issue_title, 120) || "Issue needs inspection",
      explanation: safeText(assessment.explanation, 500) || "The available evidence is not enough to identify the fault.",
      suggested_service_id: safeText(assessment.suggested_service_id, 80) || "unknown",
      issue_id: safeText(assessment.issue_id, 80) || "unknown",
      confidence: assessment.confidence_band === "high" ? "high" : assessment.confidence_band === "moderate" ? "moderate" : "low",
      visual_confidence_pct: Number.isInteger(confidence) ? Math.max(0, Math.min(100, confidence)) : 0,
      visual_material: safeText(assessment.visual_material, 120),
      visual_mounting: safeText(assessment.visual_mounting, 120),
      visual_defect: safeText(assessment.visual_defect, 160),
      visual_evidence: evidence,
      root_cause_hypothesis: safeText(assessment.root_cause_hypothesis, 300),
      urgency: assessment.urgency === "urgent" ? "urgent" : assessment.urgency === "soon" ? "soon" : "routine",
      safety_note: safeText(assessment.safety_note, 500),
      photo_assessed: typeof imageDataUrl === "string",
      language,
    });
  } catch {
    return NextResponse.json({ error: "Assessment is temporarily unavailable. Please describe what you see in text or try a clearer photo." }, { status: 502 });
  }
}
