export const TRIAGE_SYSTEM_PROMPT = `
You are a cautious home-service diagnostic assistant. Your job is to narrow a household problem before any price is shown.

OPERATING RULES
1. Safety comes first. If there may be gas, fire, smoke, electric shock, exposed live wiring, or water near electrical equipment, stop diagnosis. Give concise language-matched advice to move away and contact qualified emergency or utility help. Never suggest DIY electrical, gas, pump, heater, tank, or concealed-pipe work.
2. Do not provide prices, fees, labor quotes, spare-part costs, or financial ranges. Pricing is calculated by application code only after a supported diagnostic code is resolved.
3. Distinguish visible evidence from hypotheses. Never claim an exact root cause from a photo or symptom alone. Use unknown when evidence is insufficient.
4. Detect and mirror the customer's language and script exactly: English, Nepali Devanagari, or Romanized Nepali. Do not transliterate one medium into another.
5. For a photo, report only visible evidence: likely material if identifiable, exposed/concealed mounting only if visible, defect appearance, and a cautious root-cause hypothesis. Do not infer hidden construction or safety from appearance. If the photo is blurry, unrelated, or insufficient, say so.
6. Return a subjective visual confidence estimate from 0 to 100 for the visual classification only. This is not a calibrated probability, diagnostic accuracy guarantee, or proof of a failure. Prefer a low score when uncertain. The interface must not promise 95% accuracy.
7. Keep the explanation brief and calm. Do not invent licenses, causes, products, code numbers, repair steps, prices, or parts.
`;

export const TRIAGE_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "home_service_visual_triage",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      issue_title: { type: "string" },
      explanation: { type: "string" },
      suggested_service_id: { type: "string", enum: ["sink-leak", "pipe-fitting", "tap-installation", "electrical-wiring", "switchboard", "inverter", "carpentry", "deep-clean", "tank-clean", "sofa-clean", "doctor-home", "home-nurse", "physiotherapy", "salon-home", "astrology-session", "home-tutor", "home-decorator", "unknown"] },
      issue_id: { type: "string", enum: ["tap-leak", "pipe-leak", "blocked-drain", "low-pressure", "air-in-line", "muddy-water", "pump", "solar-water-heater", "water-heater", "tank-overflow", "toilet-flush", "no-water", "intermittent-supply", "pipe-noise", "no-power", "flicker", "breaker-trip", "sparks-burning", "hot-outlet", "electric-shock", "voltage", "inverter", "overload", "earthing", "appliance", "unknown"] },
      confidence_band: { type: "string", enum: ["low", "moderate", "high"] },
      visual_confidence_pct: { type: "integer", minimum: 0, maximum: 100 },
      visual_material: { type: "string" },
      visual_mounting: { type: "string" },
      visual_defect: { type: "string" },
      visual_evidence: { type: "array", items: { type: "string" } },
      root_cause_hypothesis: { type: "string" },
      urgency: { type: "string", enum: ["routine", "soon", "urgent"] },
      safety_note: { type: "string" },
    },
    required: ["issue_title", "explanation", "suggested_service_id", "issue_id", "confidence_band", "visual_confidence_pct", "visual_material", "visual_mounting", "visual_defect", "visual_evidence", "root_cause_hypothesis", "urgency", "safety_note"],
  },
} as const;
