import { z } from "zod";

/** Symptom matching routes a request; it is not a confirmed fault. */
export const HOME_ISSUES = [
  { id: "tap-leak", title: "Tap or under-sink leak", trade: "plumbing", serviceId: "sink-leak", patterns: [/\b(tap|dhara|faucet|sink)\b.*\b(leak|leaking|drip|chuh|leek)\b/, /\b(leak|leaking|drip|chuh|leek)\b.*\b(tap|dhara|faucet|sink)\b/] },
  { id: "pipe-leak", title: "Pipe or joint leak", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(pipe|joint|fitting|connection)\b.*\b(leak|burst|crack|chuh)\b/, /\b(burst|cracked)\s+pipe\b/] },
  { id: "blocked-drain", title: "Slow or blocked drain", trade: "plumbing", serviceId: null, patterns: [/\b(blocked|clogged|slow|jammed)\b.*\b(drain|sink|pipe|toilet)\b/, /\b(drain|sink)\b.*\b(blocked|clogged|slow)\b/] },
  { id: "low-pressure", title: "Low or uneven water pressure", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(low|weak|uneven)\b.*\b(water\s+)?pressure\b/, /\bwater\s+flow\b.*\b(low|weak)\b/] },
  { id: "air-in-line", title: "Air or sputtering in the water line", trade: "plumbing", serviceId: null, patterns: [/\b(air|sputter|spitting|khokro)\b.*\b(water|line|pipe|tap)\b/, /\b(tap|dhara)\b.*\b(sputter|air|hawa)\b/] },
  { id: "muddy-water", title: "Muddy, cloudy or discoloured water", trade: "plumbing", serviceId: null, patterns: [/\b(muddy|dirty|brown|rusty|iron|discolou?red|cloudy)\b.*\b(water|pani)\b/, /\b(water|pani)\b.*\b(muddy|dirty|brown|rusty|iron|cloudy)\b/] },
  { id: "pump", title: "Water pump or well-pump concern", trade: "plumbing", serviceId: null, patterns: [/\b(pump|well|inar|borewell|groundwater)\b.*\b(water|work|start|stop|pressure|awaz|noise|not)\b/, /\b(water|pani)\b.*\b(pump|well|inar)\b/] },
  { id: "solar-water-heater", title: "Solar water-heater concern", trade: "plumbing", serviceId: null, patterns: [/\b(solar|sun)\b.*\b(heater|hot\s+water|water\s+heater)\b/, /\b(heater|hot\s+water)\b.*\b(solar)\b/] },
  { id: "water-heater", title: "Water heater concern", trade: "plumbing", serviceId: null, patterns: [/\b(water\s+heater|geyser|hot\s+water)\b/] },
  { id: "tank-overflow", title: "Tank overflow or float-valve concern", trade: "plumbing", serviceId: null, patterns: [/\b(tank|reservoir)\b.*\b(overflow|overflows|spill|float|valve)\b/] },
  { id: "toilet-flush", title: "Toilet flush or cistern concern", trade: "plumbing", serviceId: null, patterns: [/\b(toilet|flush|cistern|commode)\b.*\b(leak|run|running|broken|block|weak|not)\b/] },
  { id: "no-water", title: "No water at the tap", trade: "plumbing", serviceId: null, patterns: [/\b(no|not|zero)\s+(water|pani)\b/, /\b(water|pani)\b.*\b(not coming|stopped|aayena|chaina)\b/] },
  { id: "intermittent-supply", title: "Intermittent household water supply", trade: "plumbing", serviceId: null, patterns: [/\b(intermittent|comes and goes|supply stops|water cuts|pani aaune jane)\b.*\b(water|supply|pani|tap)\b/] },
  { id: "pipe-noise", title: "Banging or vibrating water pipes", trade: "plumbing", serviceId: null, patterns: [/\b(pipe|pipes|water line|water pipes)\b.*\b(banging|vibrating|hammering|knocking|awaz)\b/] },  { id: "no-power", title: "Power loss in a room or circuit", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(no|not|loss of|without)\s+(power|electricity|bijuli)\b/, /\b(batti|bijuli|light)\b.*\b(na-aako|naako|not working|gako|aaena|chaina|chhaina|off)\b/] },
  { id: "flicker", title: "Flickering or dim lights", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(flicker|flickering|dim|unstable)\b.*\b(light|power|voltage|batti)\b/] },
  { id: "breaker-trip", title: "Breaker repeatedly trips", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(breaker|mcb|fuse|trip|tripping)\b/] },
  { id: "sparks-burning", title: "Sparking, burning smell or smoke", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(spark|sparking|burning smell|smoke|fire|burnt wire)\b/] },
  { id: "hot-outlet", title: "Hot, buzzing or damaged outlet", trade: "electrical", serviceId: "switchboard", patterns: [/\b(socket|outlet|switch|switchboard)\b.*\b(hot|warm|buzz|crack|loose|broken)\b/] },
  { id: "electric-shock", title: "Shock or tingling from an appliance", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(shock|tingle|current|current lag|jhatka)\b.*\b(appliance|tap|body|metal|fridge|geyser|switch|lag)\b/, /\b(electric shock|current lagyo)\b/] },
  { id: "voltage", title: "Possible high or low voltage", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(voltage|volt)\b.*\b(high|low|fluctuat|unstable|up|down)\b/, /\b(high|low|fluctuating)\s+voltage\b/] },
  { id: "inverter", title: "Inverter or backup-power concern", trade: "electrical", serviceId: "inverter", patterns: [/\b(inverter|backup power|battery backup|ups)\b/] },
  { id: "overload", title: "Possible circuit overload", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(overload|too many appliances|breaker trips when)\b/] },
  { id: "earthing", title: "Possible earthing or leakage concern", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(earthing|grounding|earth leakage|tingle from|electric tingling)\b/] },
  { id: "appliance", title: "Home appliance fault", trade: "electrical", serviceId: null, patterns: [/\b(fridge|refrigerator|washing machine|washer|microwave|induction|appliance)\b.*\b(not working|fault|broken|noise|leak|power)\b/] },
] as const;

export type HomeIssue = (typeof HOME_ISSUES)[number];
export const SUGGESTED_PARTS_BY_SERVICE: Readonly<Record<string, readonly string[]>> = {
  "sink-leak": ["Tap washer or cartridge (inspect first)", "Flexible connector or joint seal (if leaking)"],
  "pipe-fitting": ["Compatible pipe coupling (measure on site)", "Joint seal or PTFE tape (if suitable)"],
  "tap-installation": ["Customer-selected tap", "Compatible connector and seal"],
  "electrical-wiring": ["Compatible connector or breaker (only if inspection confirms)", "Correctly rated wire (measure and verify on site)"],
  "switchboard": ["Compatible switch or socket module (verify rating on site)"],
  inverter: ["Compatible fuse or cable (model and load check required)"],
};
export function suggestedPartsForService(serviceId: string): string[] {
  return [...(SUGGESTED_PARTS_BY_SERVICE[serviceId] ?? [])];
}

export const diagnosticDraftSchema = z.object({
  symptom: z.string().trim().min(1).max(1200), issue_title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500), confidence: z.enum(["low", "moderate"]).default("low"),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine"), severity: z.string().trim().max(300).optional(),
  area: z.string().trim().max(180).optional(), preferred_time: z.string().trim().max(180).optional(),
  photo_assessed: z.boolean().default(false), safety_note: z.string().trim().max(500).optional(),
  suggested_parts: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  catalog_service_paisa: z.number().int().nonnegative().optional(), catalog_visit_paisa: z.number().int().nonnegative().optional(), catalog_total_paisa: z.number().int().nonnegative().optional(),
});
export type DiagnosticDraft = z.infer<typeof diagnosticDraftSchema>;
export function matchHomeIssue(text: string): HomeIssue | null {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
  return HOME_ISSUES.find(issue => issue.patterns.some(pattern => pattern.test(normalized))) ?? null;
}
export function detectHomeSafetyRisk(text: string): "electric" | "water-electric" | "gas" | null {
  const q = text.toLowerCase();
  if (/gas (leak|smell|gandha)|smell(s|ing)? of gas|gas gandha/.test(q)) return "gas";
  if (/electric shock|electric tingling|earth leakage|current lagyo|tingle.*tap|shock.*water|water.*(socket|wire|switch)|flood.*electric|electric.*flood/.test(q)) return "water-electric";
  if (/sparking|smoke|burning smell|fire|exposed live wire|bare wire/.test(q)) return "electric";
  return null;
}








export const DIAGNOSTIC_PREFILL_STORAGE_KEY = "tirkha.booking-diagnostic.v1";
export const diagnosticBookingPrefillSchema = z.object({
  category_slug: z.string().trim().min(1).max(80),
  duration_minutes: z.number().int().min(15).max(480),
  diagnostic: diagnosticDraftSchema,
});
export type DiagnosticBookingPrefill = z.infer<typeof diagnosticBookingPrefillSchema>;

