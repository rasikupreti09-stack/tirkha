import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedServiceIds = ["sink-leak", "pipe-fitting", "tap-installation", "electrical-wiring", "switchboard", "inverter", "carpentry", "deep-clean", "tank-clean", "sofa-clean", "doctor-home", "home-nurse", "physiotherapy", "salon-home", "astrology-session", "home-tutor", "home-decorator", "unknown"] as const;
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
const responseFormat = {
  type: "json_schema",
  name: "tirkha_home_symptom_triage",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      issue_title: { type: "string" }, explanation: { type: "string" },
      suggested_service_id: { type: "string", enum: allowedServiceIds },
      confidence: { type: "string", enum: ["low", "moderate"] },
      urgency: { type: "string", enum: ["routine", "soon", "urgent"] },
      safety_note: { type: "string" },
    },
    required: ["issue_title", "explanation", "suggested_service_id", "confidence", "urgency", "safety_note"],
  },
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Photo assessment must be sent from Tirkha." }, { status: 403 });
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!takeRateLimit(clientIp)) return NextResponse.json({ error: "You’ve reached the photo-assessment limit. Please describe the issue in text or try again later." }, { status: 429 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Photo assessment is not configured yet. You can still describe the issue in text and get a catalog-based service suggestion." }, { status: 503 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Could not read the photo request." }, { status: 400 }); }
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "Invalid photo request." }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const symptom = typeof body.symptom === "string" ? body.symptom.trim().slice(0, 1200) : "The customer uploaded a photo and has not added a written description.";
  const imageDataUrl = body.imageDataUrl;
  if (typeof imageDataUrl !== "string" || imageDataUrl.length > 4_400_000 || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) return NextResponse.json({ error: "Use a JPG, PNG or WebP image under 3 MB." }, { status: 400 });

  const romanizedNepali = /\b(dhara|bhairako|chha|cha|fohor|safa|batti|bijuli|garna|garnu|chahiyo|tapai|mero|na-aako|jyotish|inar|pani)\b/i.test(symptom);
  const instructions = [
    "You are Tirkha's home-service symptom triage assistant for Nepal. Use the photo and customer description only to suggest a service category; never claim a confirmed diagnosis or exact cause.",
    `Describe visible evidence in calm, plain language. If the image is unclear or unrelated, say so and choose unknown with low confidence. Reply in ${romanizedNepali ? "warm, polite Romanized Nepali" : "plain English"}.`,
    "Choose a listed service only when it is a reasonable first match: sink-leak for visible tap/under-sink leaks; pipe-fitting for accessible plumbing concerns; electrical-wiring for wiring, power, voltage or breaker concerns; switchboard for outlet/switch concerns; inverter for backup power. Muddy/iron-colored water needs water testing; do not diagnose safety from appearance. Use unknown for water-quality, well-pump or solar-heater concerns without a direct catalog service.",
    "Safety: sparking, smoke, burning, exposed wires, electric shock or water near electrical equipment means urgent. Tell the customer to keep away and contact qualified emergency/utility help; do not tell them to touch equipment or perform electrical repairs. For gas smell, leave the area, avoid flames and switches, and contact emergency help. Never recommend opening a pump, heater, electrical panel, or entering a tank/well.",
    "Do not invent prices, parts costs, licenses, causes, or repair instructions. Confidence must be low or moderate; never use a numeric accuracy percentage. Keep explanation to two short sentences. safety_note may be empty when no immediate hazard is evident.",
  ].join(" ");
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini", instructions,
        input: [{ role: "user", content: [
          { type: "input_text", text: `Customer description: ${symptom}` },
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
        ] }],
        text: { format: responseFormat }, max_output_tokens: 260,
      }),
    });
    if (!response.ok) return NextResponse.json({ error: "Photo assessment is temporarily unavailable. Text-based service matching is still available." }, { status: 502 });
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const output = result.output_text ?? result.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
    if (!output) return NextResponse.json({ error: "The photo could not be assessed. Please describe the issue in text." }, { status: 502 });
    const assessment = JSON.parse(output) as Record<string, unknown>;
    const valid = typeof assessment.issue_title === "string" && assessment.issue_title.trim().length > 0
      && typeof assessment.explanation === "string" && assessment.explanation.trim().length > 0
      && typeof assessment.suggested_service_id === "string" && (allowedServiceIds as readonly string[]).includes(assessment.suggested_service_id)
      && (assessment.confidence === "low" || assessment.confidence === "moderate")
      && (assessment.urgency === "routine" || assessment.urgency === "soon" || assessment.urgency === "urgent")
      && typeof assessment.safety_note === "string";
    if (!valid) return NextResponse.json({ error: "The photo assessment was incomplete. Please describe the issue in text." }, { status: 502 });
    return NextResponse.json({
      issue_title: (assessment.issue_title as string).trim().slice(0, 120),
      explanation: (assessment.explanation as string).trim().slice(0, 500),
      suggested_service_id: assessment.suggested_service_id,
      confidence: assessment.confidence, urgency: assessment.urgency,
      safety_note: (assessment.safety_note as string).trim().slice(0, 500), photo_assessed: true,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Photo assessment timed out or could not connect. Please describe the issue in text." }, { status: 502 });
  }
}

