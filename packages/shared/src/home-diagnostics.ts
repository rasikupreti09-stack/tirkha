import { z } from "zod";

/** Symptom matching routes a request; it is not a confirmed fault. */
export const HOME_ISSUES = [
  { id: "tap-leak", title: "Tap or under-sink leak", trade: "plumbing", serviceId: "sink-leak", patterns: [/\b(tap|dhara|faucet|sink)\b.*\b(leak|leaking|drip|chuh|leek)\b/, /\b(leak|leaking|drip|chuh|leek)\b.*\b(tap|dhara|faucet|sink)\b/, /धारा.*(बगे|चुह|टप्के)/u] },
  { id: "pipe-leak", title: "Pipe or joint leak", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(pipe|joint|fitting|connection)\b.*\b(leak|burst|crack|chuh)\b/, /\b(burst|cracked)\s+pipe\b/, /पाइप.*(चुह|फुट|चिरा)/u] },
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
  { id: "pipe-noise", title: "Banging or vibrating water pipes", trade: "plumbing", serviceId: null, patterns: [/\b(pipe|pipes|water line|water pipes)\b.*\b(banging|vibrating|hammering|knocking|awaz)\b/] },  { id: "no-power", title: "Power loss in a room or circuit", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(no|not|loss of|without)\s+(power|electricity|bijuli)\b/, /\b(batti|bijuli|light)\b.*\b(na-aako|naako|not working|gako|aaena|chaina|chhaina|off)\b/, /बत्ती.*(नआएको|नबलेको|बलेन)|बिजुली.*(गएको|आएन)/u] },
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

export const SUPPORTED_DIAGNOSTIC_CODES = ["PL-TAP-CLOSURE-LEAK", "PL-TAP-BASE-LEAK", "PL-UNDER-SINK-JOINT-LEAK", "PL-EXPOSED-JOINT-LEAK", "PL-EXPOSED-PIPE-LEAK"] as const;
export type SupportedDiagnosticCode = (typeof SUPPORTED_DIAGNOSTIC_CODES)[number];
export const diagnosticDraftSchema = z.object({
  symptom: z.string().trim().min(1).max(1200), issue_title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500), confidence: z.enum(["low", "moderate", "high"]).default("low"),
  diagnostic_code: z.enum(SUPPORTED_DIAGNOSTIC_CODES).optional(),
  diagnostic_basis: z.enum(["text_and_answers", "photo_and_answers", "professional_confirmed"]).optional(),
  visual_confidence_pct: z.number().int().min(0).max(100).optional(),
  visual_material: z.string().trim().max(120).optional(), visual_mounting: z.string().trim().max(120).optional(),
  visual_defect: z.string().trim().max(160).optional(), visual_evidence: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  root_cause_hypothesis: z.string().trim().max(300).optional(),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine"), severity: z.string().trim().max(300).optional(),
  area: z.string().trim().max(180).optional(), preferred_time: z.string().trim().max(180).optional(),
  photo_assessed: z.boolean().default(false), safety_note: z.string().trim().max(500).optional(),
  suggested_parts: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
  catalog_service_paisa: z.number().int().nonnegative().optional(), catalog_visit_paisa: z.number().int().nonnegative().optional(), catalog_total_paisa: z.number().int().nonnegative().optional(),
}).superRefine((draft, context) => {
  const hasCatalogAmount = draft.catalog_service_paisa !== undefined || draft.catalog_visit_paisa !== undefined || draft.catalog_total_paisa !== undefined;
  if (hasCatalogAmount && !draft.diagnostic_code) context.addIssue({ code: "custom", path: ["diagnostic_code"], message: "A supported diagnostic code is required before catalog pricing can be attached." });
});
export type DiagnosticDraft = z.infer<typeof diagnosticDraftSchema>;
export function matchHomeIssue(text: string): HomeIssue | null {
  const normalized = text.toLocaleLowerCase("ne-NP").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return HOME_ISSUES.find(issue => issue.patterns.some(pattern => pattern.test(normalized))) ?? null;
}
export type DiagnosticLanguage = "english" | "nepali_devanagari" | "nepali_romanized";
export function diagnosticLanguageForText(text: string): DiagnosticLanguage {
  if (/[\u0900-\u097f]/u.test(text)) return "nepali_devanagari";
  if (/\b(dhara|bhairacha|bhairako|chha|cha|fohor|safa|batti|bijuli|garnu|chahiyo|tapai|mero|na-aako|jyotish|inar|pani|chuhiyo|chuhirako)\b/i.test(text)) return "nepali_romanized";
  return "english";
}

export type DiagnosticQuestion = { prompt: string; choices: string[] };
const ENGLISH_FLOWS: Readonly<Record<string, [DiagnosticQuestion, DiagnosticQuestion]>> = {
  "tap-leak": [
    { prompt: "Where do you see the water first?", choices: ["From the tap spout", "Around the tap base", "At a visible connector under the sink", "From the wall/floor or I cannot tell"] },
    { prompt: "Which description best matches it?", choices: ["It continues after the tap is fully closed", "It leaks only while water is running", "The visible connector/joint is wet", "The source is hidden or uncertain"] },
  ],
  "pipe-leak": [
    { prompt: "Can you see the leaking pipe without opening a wall or floor?", choices: ["Yes, the pipe is exposed", "No, it seems concealed", "I am not sure"] },
    { prompt: "On the exposed section, where is water visible?", choices: ["At a visible joint/coupling", "Through a crack in the pipe body", "There is no exposed pipe / I cannot tell"] },
  ],
};
const NEPALI_FLOWS: Readonly<Record<string, [DiagnosticQuestion, DiagnosticQuestion]>> = {
  "tap-leak": [
    { prompt: "पानी सबैभन्दा पहिले कहाँ देखिन्छ?", choices: ["धाराको मुखबाट", "धाराको फेद वरिपरि", "सिङ्कमुनिको देखिने जोडमा", "भित्ता/भुइँबाट वा थाहा छैन"] },
    { prompt: "कुन विवरण मिल्छ?", choices: ["धारा बन्द गरेपछि पनि बगिरहन्छ", "पानी चलाउँदा मात्र चुहिन्छ", "देखिने जोड/ज्वाइन्ट भिजेको छ", "स्रोत लुकेको छ वा निश्चित छैन"] },
  ],
  "pipe-leak": [
    { prompt: "भित्ता वा भुइँ नखोली चुहिएको पाइप देख्न सक्नुहुन्छ?", choices: ["सक्छु, पाइप खुला छ", "सक्दिनँ, लुकेको जस्तो छ", "निश्चित छैन"] },
    { prompt: "खुला पाइपमा पानी कहाँ देखिन्छ?", choices: ["देखिने जोड/कपलिङमा", "पाइपको बीचमा चिरा परेको ठाउँमा", "खुला पाइप छैन वा थाहा छैन"] },
  ],
};
const ROMAN_FLOWS: Readonly<Record<string, [DiagnosticQuestion, DiagnosticQuestion]>> = {
  "tap-leak": [
    { prompt: "Pani sabai bhanda pahile kata dekhincha?", choices: ["Dharako mukh bata", "Dharako base waripari", "Sink muniko dekhinay joint ma", "Bhitta/floor bata wa thaha chaina"] },
    { prompt: "Kun barnan milcha?", choices: ["Dhara banda garepachi pani bagirahancha", "Pani chaleko bela matra chuhincha", "Dekhinay joint bhijeko cha", "Source lukeko cha wa nischit chaina"] },
  ],
  "pipe-leak": [
    { prompt: "Bhitta wa floor nakholi chuhiyeko pipe dekhna saknuhuncha?", choices: ["Sakchu, pipe khulla cha", "Sakdina, lukeko jasto cha", "Nischit chaina"] },
    { prompt: "Khulla pipe ma pani kata dekhincha?", choices: ["Dekhinay joint/coupling ma", "Pipe ko body ma crack bata", "Khulla pipe chaina wa thaha chaina"] },
  ],
};
export function diagnosticQuestion(issueId: string, index: 0 | 1, language: DiagnosticLanguage): DiagnosticQuestion | null {
  const localized = language === "nepali_devanagari" ? NEPALI_FLOWS : language === "nepali_romanized" ? ROMAN_FLOWS : ENGLISH_FLOWS;
  return localized[issueId]?.[index] ?? ENGLISH_FLOWS[issueId]?.[index] ?? null;
}
export function resolveDiagnosticCode(issueId: string, answers: number[]): SupportedDiagnosticCode | null {
  if (answers.length !== 2) return null;
  if (issueId === "tap-leak") {
    if (answers[0] === 0 && answers[1] === 0) return "PL-TAP-CLOSURE-LEAK";
    if (answers[0] === 1 && answers[1] === 1) return "PL-TAP-BASE-LEAK";
    if (answers[0] === 2 && answers[1] === 2) return "PL-UNDER-SINK-JOINT-LEAK";
  }
  if (issueId === "pipe-leak" && answers[0] === 0) {
    if (answers[1] === 0) return "PL-EXPOSED-JOINT-LEAK";
    if (answers[1] === 1) return "PL-EXPOSED-PIPE-LEAK";
  }
  return null;
}
export function serviceIdForDiagnosticCode(code: string): string | null {
  if (/^PL-TAP-(CLOSURE|BASE)-LEAK$/.test(code)) return "sink-leak";
  if (/^PL-(UNDER-SINK-JOINT|EXPOSED-JOINT|EXPOSED-PIPE)-LEAK$/.test(code)) return "pipe-fitting";
  return null;
}
export function detectHomeSafetyRisk(text: string): "electric" | "water-electric" | "gas" | null {
  const q = text.toLowerCase();
  if (/gas (leak|smell|gandha)|smell(s|ing)? of gas|gas gandha|ग्यास.*(गन्ध|चुहावट)/u.test(q)) return "gas";
  if (/electric shock|electric tingling|earth leakage|current lagyo|tingle.*tap|shock.*water|water.*(socket|wire|switch)|flood.*electric|electric.*flood|करेन्ट.*(लाग|झट्का)|पानी.*(तार|स्विच|सकेट)/u.test(q)) return "water-electric";
  if (/sparking|smoke|burning smell|fire|exposed live wire|bare wire|आगो|धुवाँ|जलेको गन्ध|तार.*(खुला|चुँडिएको)/u.test(q)) return "electric";
  return null;
}








export const DIAGNOSTIC_PREFILL_STORAGE_KEY = "tirkha.booking-diagnostic.v1";
export const diagnosticBookingPrefillSchema = z.object({
  category_slug: z.string().trim().min(1).max(80),
  duration_minutes: z.number().int().min(15).max(480),
  diagnostic: diagnosticDraftSchema,
});
export type DiagnosticBookingPrefill = z.infer<typeof diagnosticBookingPrefillSchema>;

