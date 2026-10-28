import { z } from "zod";
import { detectUniversalLanguage } from "./universal-diagnostics";
import { diagnosticQuestionCount as faultQuestionCount, detectHomeFaultTrade, faultServiceId, faultTreeQuestion, HOME_FAULT_TREE, matchHomeFault, normalizeHomeDiagnosticText, resolveHomeFaultCode, type HomeFaultCode } from "./home-fault-tree";
export { HOME_FAULT_TREE, detectHomeFaultTrade, matchHomeFault, normalizeHomeDiagnosticText };
export type { HomeFaultCode, HomeFaultNode } from "./home-fault-tree";

/** Symptom matching routes a request; it is not a confirmed fault. */
export const HOME_ISSUES = [
  { id: "tap-leak", title: "Tap or under-sink leak", trade: "plumbing", serviceId: "sink-leak", patterns: [/\b(tap|dhara|faucet|sink)\b.*\b(leak|leaking|drip|chuh|leek)\b/, /\b(leak|leaking|drip|chuh|leek)\b.*\b(tap|dhara|faucet|sink)\b/, /धारा.*(बगे|चुह|टप्के)/u] },
  { id: "pipe-leak", title: "Pipe or joint leak", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(pipe|joint|fitting|connection)\b.*\b(leak|burst|crack|chuh)\b/, /\b(burst|cracked)\s+pipe\b/, /पाइप.*(चुह|फुट|चिरा)/u] },
  { id: "blocked-drain", title: "Slow or blocked drain", trade: "plumbing", serviceId: null, patterns: [/\b(blocked|clogged|slow|jammed)\b.*\b(drain|sink|pipe|toilet)\b/, /\b(drain|sink)\b.*\b(blocked|clogged|slow)\b/] },
  { id: "low-pressure", title: "Low or uneven water pressure", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(low|weak|uneven)\b.*\b(water\s+)?pressure\b/, /\bwater\s+flow\b.*\b(low|weak)\b/] },
  { id: "air-in-line", title: "Air or sputtering in the water line", trade: "plumbing", serviceId: null, patterns: [/\b(air|sputter|spitting|khokro)\b.*\b(water|line|pipe|tap)\b/, /\b(tap|dhara)\b.*\b(sputter|air|hawa)\b/] },
  { id: "muddy-water", title: "Muddy, cloudy or discoloured water", trade: "plumbing", serviceId: null, patterns: [/\b(muddy|dirty|fohor|mailo|brown|rusty|iron|discolou?red|cloudy)\b.*\b(water|pani)\b/, /\b(water|pani)\b.*\b(muddy|dirty|fohor|mailo|brown|rusty|iron|cloudy)\b/] },
  { id: "pump", title: "Water pump or well-pump concern", trade: "plumbing", serviceId: null, patterns: [/\b(pump|well|inar|borewell|groundwater)\b.*\b(water|work|start|stop|pressure|awaz|noise|not)\b/, /\b(water|pani)\b.*\b(pump|well|inar)\b/] },
  { id: "solar-water-heater", title: "Solar water-heater concern", trade: "plumbing", serviceId: null, patterns: [/\b(solar|sun)\b.*\b(heater|hot\s+water|water\s+heater)\b/, /\b(heater|hot\s+water)\b.*\b(solar)\b/] },
  { id: "water-heater", title: "Water heater concern", trade: "plumbing", serviceId: null, patterns: [/\b(water\s+heater|geyser|hot\s+water)\b/] },
  { id: "tank-overflow", title: "Tank overflow or float-valve concern", trade: "plumbing", serviceId: null, patterns: [/\b(tank|reservoir)\b.*\b(overflow|overflows|spill|float|valve)\b/] },
  { id: "toilet-flush", title: "Toilet flush or cistern concern", trade: "plumbing", serviceId: null, patterns: [/\b(toilet|flush|cistern|commode)\b.*\b(leak|run|running|broken|block|weak|not)\b/] },
  { id: "no-water", title: "No water at the tap", trade: "plumbing", serviceId: null, patterns: [/\b(no|not|zero)\s+(water|pani)\b/, /\b(water|pani)\b.*\b(not coming|stopped|aayena|chaina)\b/] },
  { id: "intermittent-supply", title: "Intermittent household water supply", trade: "plumbing", serviceId: null, patterns: [/\b(intermittent|comes and goes|supply stops|water cuts|pani aaune jane)\b.*\b(water|supply|pani|tap)\b/] },
  { id: "pipe-noise", title: "Banging or vibrating water pipes", trade: "plumbing", serviceId: null, patterns: [/\b(pipe|pipes|water line|water pipes)\b.*\b(banging|vibrating|hammering|knocking|awaz)\b/] },
  { id: "sewer-odor", title: "Drain or sewer odour", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(sewer|drain|dhal|sink|bathroom|toilet)\b.*\b(odor|odour|smell|gandha)/i, /\b(odor|odour|gandha)\b.*\b(sewer|drain|dhal|sink|bathroom|toilet)/i] },
  { id: "diverter-valve", title: "Shower diverter or concealed valve concern", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(diverter|concealed shower valve)\b/i] },
  { id: "seepage", title: "Wall, ceiling or floor seepage", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(seepage|dampness|wet patch|wall leak|ceiling leak)\b/i] },
  { id: "no-power", title: "Power loss in a room or circuit", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(no|not|loss of|without)\s+(power|electricity|bijuli)\b/, /\b(batti|bijuli|light)\b.*\b(na-aako|naako|not working|gako|aaena|chaina|chhaina|off)\b/, /बत्ती.*(नआएको|नबलेको|बलेन)|बिजुली.*(गएको|आएन)/u] },
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
  { id: "plumbing-general", title: "General plumbing request", trade: "plumbing", serviceId: "pipe-fitting", patterns: [/\b(plumbing|plumber|water leak|leaking|pipework)\b/i, /पानी.*(चुह|चुग|बग)/u] },
  { id: "electrical-general", title: "General electrical request", trade: "electrical", serviceId: "electrical-wiring", patterns: [/\b(electrical|electrician|short circuit|bijuli short|mcb tripped)\b/i, /बिजुली.*(सर्ट|छैन|गयो|गएन)/u] },] as const;

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

export const SUPPORTED_DIAGNOSTIC_CODES = ["PL-TAP-CLOSURE-LEAK", "PL-TAP-BASE-LEAK", "PL-UNDER-SINK-JOINT-LEAK", "PL-EXPOSED-JOINT-LEAK", "PL-EXPOSED-PIPE-LEAK", "PL-ONSITE-INSPECTION", "EL-SITE-INSPECTION", "EL-ONSITE-INSPECTION", "PL-PPR-FUSION-JOINT-LEAK", "PL-GI-THREADED-CORROSION-LEAK", "PL-PVC-SOLVENT-WELD-LEAK", "PL-CONCEALED-WALL-SLAB-LEAK", "PL-SUBMERSIBLE-PUMP-MOTOR-FAULT", "PL-BOOSTER-PUMP-SHORT-CYCLE", "PL-TANK-FLOAT-VALVE-OVERFLOW", "PL-SUMP-CONTAMINATION", "PL-DUAL-FLUSH-CISTERN-FAULT", "PL-MIXER-CARTRIDGE-WEAR", "PL-SOLAR-PRV-DISCHARGE", "PL-GAS-GEYSER-IGNITION-DIAPHRAGM", "PL-RO-MEMBRANE-FOULING", "PL-SUPPLY-LINE-LEAK", "PL-SUMP-PUMP-NO-WATER", "PL-DRAIN-DHAL-BLOCKAGE", "PL-SEWER-GAS-ODOR", "PL-CONCEALED-DIVERTER-VALVE", "PL-FLUSH-MECHANISM-FAULT", "PL-SEEPAGE-DAMPNESS", "PL-SOLAR-GEYSER-PIPE-LEAK", "EL-MCB-THERMAL-SHORT-TRIP", "EL-RCCB-NUISANCE-TRIP", "EL-DB-BUSBAR-LOOSE-TERMINAL", "EL-PHASE-VOLTAGE-DROP", "EL-BURNT-OUTLET-HEAVY-LOAD", "EL-UPS-CHANGEOVER-WIRING", "EL-NEUTRAL-EARTH-LEAKAGE", "EL-WATER-LEVEL-SENSOR-CORROSION", "EL-MCB-RCCB-TRIPPING", "EL-BURNING-WIRE-SMELL", "EL-ELECTRIC-SHOCK-EARTHING", "EL-FLOATING-NEUTRAL", "EL-MAIN-DB-SPARKING", "EL-INVERTER-BYPASS-SWITCH", "EL-MOTOR-STARTER-FAULT", "EL-REGULATOR-LIGHT-FLICKER"] as const;
export type SupportedDiagnosticCode = (typeof SUPPORTED_DIAGNOSTIC_CODES)[number];
export const diagnosticDraftSchema = z.object({
  symptom: z.string().trim().min(1).max(1200), issue_title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500),
  diagnostic_code: z.enum(SUPPORTED_DIAGNOSTIC_CODES).optional(),
  diagnostic_basis: z.enum(["text_and_answers", "photo_and_answers", "professional_confirmed"]).optional(),
  visual_material: z.string().trim().max(120).optional(), visual_mounting: z.string().trim().max(120).optional(),
  visual_defect: z.string().trim().max(160).optional(), visual_evidence: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  root_cause_hypothesis: z.string().trim().max(300).optional(),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine"), severity: z.string().trim().max(300).optional(), trade: z.enum(["plumbing", "electrical"]).optional(), triage_answers: z.array(z.string().trim().min(1).max(180)).max(7).default([]),
  area: z.string().trim().max(180).optional(), preferred_time: z.string().trim().max(180).optional(),
  photo_assessed: z.boolean().default(false), safety_note: z.string().trim().max(500).optional(),
  suggested_parts: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
});
export type DiagnosticDraft = z.infer<typeof diagnosticDraftSchema>;
export function matchHomeIssue(text: string): HomeIssue | null {
  const normalized = normalizeHomeDiagnosticText(text);
  const fault = matchHomeFault(normalized);
  if (fault) return HOME_ISSUES.find(issue => issue.id === fault.issueId) ?? null;
  const matched = HOME_ISSUES.find(issue => issue.patterns.some(pattern => pattern.test(normalized)));
  if (matched) return matched;
  const trade = detectHomeFaultTrade(normalized);
  if (!trade) return null;
  if (trade === "plumbing" && /\b(drain|sewage|dhal|ढल|नाली)\b/u.test(normalized)) return HOME_ISSUES.find(issue => issue.id === "blocked-drain") ?? null;
  return HOME_ISSUES.find(issue => issue.id === (trade === "plumbing" ? "plumbing-general" : "electrical-general")) ?? null;
}
export type DiagnosticLanguage = "english" | "nepali_devanagari" | "nepali_romanized";
export function diagnosticLanguageForText(text: string): DiagnosticLanguage {
  return detectUniversalLanguage(text);
}

export type DiagnosticQuestion = { prompt: string; choices: string[] };
export type DiagnosticQuestionIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
function tradeForIssue(issueId: string): "plumbing" | "electrical" | null {
  const trade = HOME_ISSUES.find(issue => issue.id === issueId)?.trade;
  return trade === "plumbing" || trade === "electrical" ? trade : null;
}
export function diagnosticQuestion(issueId: string, index: number, language: DiagnosticLanguage, previousAnswers: readonly number[] = [], faultCode?: string): DiagnosticQuestion | null {
  const trade = tradeForIssue(issueId);
  return trade ? faultTreeQuestion(trade, issueId, index, language, previousAnswers, faultCode) : null;
}
export function diagnosticQuestionCount(issueId: string, faultCode?: string): number {
  const trade = tradeForIssue(issueId);
  return trade ? faultQuestionCount(trade, issueId, faultCode) : 0;
}
export function diagnosticSeverityLabel(answer: number, language: DiagnosticLanguage): string {
  const labels = language === "english" ? ["Contained / currently stopped", "Recurring or worsening", "Widespread or significant service impact", "Unclear; Hero to assess on site"] : ["सीमित / अहिले रोकिएको", "दोहोरिने वा बढ्दै गएको", "धेरै क्षेत्रमा फैलिएको वा सेवामा ठूलो असर", "स्पष्ट छैन; Hero ले स्थलमै जाँच गर्ने"];
  return labels[answer] ?? labels[3]!;
}
export function resolveDiagnosticCode(issueId: string, answers: number[], faultCode?: string): SupportedDiagnosticCode | null {
  const trade = tradeForIssue(issueId);
  if (!trade) return null;
  const code = resolveHomeFaultCode(trade, issueId, answers, faultCode);
  return code && SUPPORTED_DIAGNOSTIC_CODES.includes(code as SupportedDiagnosticCode) ? code as SupportedDiagnosticCode : null;
}
export function serviceIdForDiagnosticCode(code: string): string | null {
  return faultServiceId(code);
}
export function detectHomeSafetyRisk(text: string): "electric" | "water-electric" | "gas" | null {
  const q = normalizeHomeDiagnosticText(text);
  if (/\bgas\b.*\b(leak|smell|gandha|odor|odour)\b|\b(leak|smell|gandha|odor|odour)\b.*\bgas\b|ग्यास.*(गन्ध|चुहावट)/u.test(q)) return "gas";
  if (/electric shock|shock lagyo|jhatka lagyo|electric tingling|earth leakage|current lagyo|current aayo|tingle.*tap|shock.*water|water.*(socket|wire|switch)|flood.*electric|electric.*flood|pani.*(bijuli|wire|tar|switch|socket)|bijuli.*pani|dhara.*current|करेन्ट.*(लाग|झट्का|आयो)|पानी.*(तार|स्विच|सकेट|बिजुली)/u.test(q)) return "water-electric";
  if (/sparking|smoke|burning smell|burnt plastic|burned socket|burnt socket|socket burned|wire jaleyo|jaleko wire|wire burn|hot outlet|hot switchboard|fire|exposed live wire|bare wire|spark|chingaari|jaleko plastic|jaleko gandha|dhuwa|आगो|धुवाँ|जलेको गन्ध|बोर्ड.*तातो|स्विच.*तातो|तार.*(खुला|चुँडिएको|जलेको)/u.test(q)) return "electric";
  return null;
}








export const DIAGNOSTIC_PREFILL_STORAGE_KEY = "tirkha.booking-diagnostic.v1";
export const diagnosticBookingPrefillSchema = z.object({
  category_slug: z.string().trim().min(1).max(80),
  duration_minutes: z.number().int().min(15).max(480),
  diagnostic: diagnosticDraftSchema,
});
export type DiagnosticBookingPrefill = z.infer<typeof diagnosticBookingPrefillSchema>;
