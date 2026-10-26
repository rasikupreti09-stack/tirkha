import { z } from "zod";

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

export const SUPPORTED_DIAGNOSTIC_CODES = ["PL-TAP-CLOSURE-LEAK", "PL-TAP-BASE-LEAK", "PL-UNDER-SINK-JOINT-LEAK", "PL-EXPOSED-JOINT-LEAK", "PL-EXPOSED-PIPE-LEAK", "EL-SITE-INSPECTION"] as const;
export type SupportedDiagnosticCode = (typeof SUPPORTED_DIAGNOSTIC_CODES)[number];
export const diagnosticDraftSchema = z.object({
  symptom: z.string().trim().min(1).max(1200), issue_title: z.string().trim().min(1).max(120),
  explanation: z.string().trim().min(1).max(500),
  diagnostic_code: z.enum(SUPPORTED_DIAGNOSTIC_CODES).optional(),
  diagnostic_basis: z.enum(["text_and_answers", "photo_and_answers", "professional_confirmed"]).optional(),
  visual_material: z.string().trim().max(120).optional(), visual_mounting: z.string().trim().max(120).optional(),
  visual_defect: z.string().trim().max(160).optional(), visual_evidence: z.array(z.string().trim().min(1).max(160)).max(6).default([]),
  root_cause_hypothesis: z.string().trim().max(300).optional(),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine"), severity: z.string().trim().max(300).optional(),
  area: z.string().trim().max(180).optional(), preferred_time: z.string().trim().max(180).optional(),
  photo_assessed: z.boolean().default(false), safety_note: z.string().trim().max(500).optional(),
  suggested_parts: z.array(z.string().trim().min(1).max(100)).max(12).default([]),
});
export type DiagnosticDraft = z.infer<typeof diagnosticDraftSchema>;
export function matchHomeIssue(text: string): HomeIssue | null {
  const normalized = text.toLocaleLowerCase("ne-NP").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return HOME_ISSUES.find(issue => issue.patterns.some(pattern => pattern.test(normalized))) ?? null;
}
export type DiagnosticLanguage = "english" | "nepali_devanagari" | "nepali_romanized";
export function diagnosticLanguageForText(text: string): DiagnosticLanguage {
  if (/[\u0900-\u097f]/u.test(text)) return "nepali_devanagari";
  if (/\b(dhara|bhairacha|bhairako|chha|cha|fohor|safa|batti|bijuli|garnu|chahiyo|tapai|mero|na-aako|jyotish|inar|pani|chuhiyo|chuhirako|aairacha|aairako|bhayeko|gayo|bhayo)\b/i.test(text)) return "nepali_devanagari";
  return "english";
}

export type DiagnosticQuestion = { prompt: string; choices: string[] };
type QuestionPair = [DiagnosticQuestion, DiagnosticQuestion];
const ENGLISH_FLOWS: Readonly<Record<string, QuestionPair>> = {
  "tap-leak": [
    { prompt: "Where do you see the water first?", choices: ["From the tap spout", "Around the tap base", "At a visible connector under the sink", "From a wall/floor or I cannot tell"] },
    { prompt: "Which description matches?", choices: ["It continues after fully closing the tap", "It leaks only while water is running", "The visible connector/joint is wet", "The source is hidden or uncertain"] },
  ],
  "pipe-leak": [
    { prompt: "Can you see the leaking pipe without opening a wall or floor?", choices: ["Yes, the pipe is exposed", "No, it seems concealed", "I am not sure"] },
    { prompt: "On the exposed section, where is water visible?", choices: ["At a visible joint/coupling", "Through a crack in the pipe body", "There is no exposed pipe / I cannot tell"] },
  ],
  "blocked-drain": [
    { prompt: "Which fixture drains slowly or backs up?", choices: ["Sink/basin", "Shower/floor drain", "Toilet", "More than one fixture"] },
    { prompt: "What happens when water runs?", choices: ["It drains slowly", "Water backs up at the same fixture", "Another nearby drain bubbles/backflows", "I am not sure"] },
  ],
  "low-pressure": [
    { prompt: "Where is pressure low?", choices: ["One tap/shower only", "Several fixtures in one room", "Most or all of the home", "I am not sure"] },
    { prompt: "Which water supply is affected?", choices: ["Cold only", "Hot only", "Both hot and cold", "I am not sure"] },
  ],
  "air-in-line": [
    { prompt: "Where do you hear sputtering or see air?", choices: ["One tap only", "Several taps", "Only after the pump starts", "I am not sure"] },
    { prompt: "When did it begin?", choices: ["After supply/pump interruption", "After plumbing work", "It happens regularly", "I am not sure"] },
  ],
  "muddy-water": [
    { prompt: "Where is the discolored water visible?", choices: ["One tap only", "Several taps", "Only hot water", "I am not sure"] },
    { prompt: "When is it most noticeable?", choices: ["After supply resumes", "After water sits in storage", "All the time", "I am not sure"] },
  ],
  "no-water": [
    { prompt: "Where is water unavailable?", choices: ["One tap/fixture", "One floor/area", "The whole home", "I am not sure"] },
    { prompt: "What does the supply or pump do?", choices: ["Pump does not start", "Pump runs but water does not arrive", "Supply is scheduled/intermittent", "I am not sure"] },
  ],
  "breaker-trip": [
    { prompt: "When does the protective device trip? Do not reset it repeatedly.", choices: ["Immediately when switched on", "When one appliance is used", "After several appliances run", "At random / I am not sure"] },
    { prompt: "If you already know the label, which device trips? Do not open or touch the panel.", choices: ["MCB", "RCD/ELCB", "Both / more than one", "I do not know"] },
  ],
  "no-power": [
    { prompt: "What has lost power?", choices: ["One appliance/light", "One room or circuit", "Most or all of the home", "I am not sure"] },
    { prompt: "If you already know without touching the panel, what happened?", choices: ["An MCB tripped", "An RCD/ELCB tripped", "No device appears tripped", "I am not sure"] },
  ],
  "flicker": [
    { prompt: "How widely do the lights flicker?", choices: ["One light", "Several lights in one room", "Several rooms / whole home", "I am not sure"] },
    { prompt: "What is happening at the same time?", choices: ["A high-load appliance starts", "It happens without an obvious trigger", "It follows rain/moisture", "I am not sure"] },
  ],
  "overload": [
    { prompt: "When does power loss or tripping occur?", choices: ["When several appliances run", "When one specific appliance runs", "Even with few appliances", "I am not sure"] },
    { prompt: "How many circuits or rooms are affected?", choices: ["One circuit/room", "Several circuits", "Whole home", "I am not sure"] },
  ],
};
const NEPALI_FLOWS: Readonly<Record<string, QuestionPair>> = {
  "tap-leak": [
    { prompt: "पानी सबैभन्दा पहिले कहाँ देखिन्छ?", choices: ["धाराको मुखबाट", "धाराको फेद वरिपरि", "सिङ्कमुनिको देखिने जोडमा", "भित्ता/भुइँबाट वा थाहा छैन"] },
    { prompt: "कुन विवरण मिल्छ?", choices: ["धारा पूरै बन्द गरेपछि पनि बगिरहन्छ", "पानी चलाउँदा मात्र चुहिन्छ", "देखिने जोड भिजेको छ", "स्रोत लुकेको छ वा निश्चित छैन"] },
  ],
  "pipe-leak": [
    { prompt: "भित्ता वा भुइँ नखोली चुहिएको पाइप देख्न सक्नुहुन्छ?", choices: ["सक्छु, पाइप खुला छ", "सक्दिनँ, लुकेको जस्तो छ", "निश्चित छैन"] },
    { prompt: "खुला पाइपमा पानी कहाँ देखिन्छ?", choices: ["देखिने जोड/कपलिङमा", "पाइपको बीचमा चिरा परेको ठाउँमा", "खुला पाइप छैन वा थाहा छैन"] },
  ],
  "blocked-drain": [
    { prompt: "कुन ठाउँको पानी ढिलो बग्छ वा फर्केर आउँछ?", choices: ["सिङ्क/बेसिन", "नुहाउने ठाउँ/भुइँको नाली", "शौचालय", "एकभन्दा बढी ठाउँ"] },
    { prompt: "पानी चलाउँदा के हुन्छ?", choices: ["ढिलो बग्छ", "त्यही ठाउँमा फर्केर आउँछ", "अर्को नालीमा बुलबुला वा पानी फर्किन्छ", "निश्चित छैन"] },
  ],
  "low-pressure": [
    { prompt: "पानीको चाप कहाँ कम छ?", choices: ["एउटा धारा/शावरमा", "एउटै कोठाका धेरै धारामा", "घरका धेरैजसो ठाउँमा", "निश्चित छैन"] },
    { prompt: "कुन पानीमा समस्या छ?", choices: ["चिसो पानी मात्र", "तातो पानी मात्र", "दुवै", "निश्चित छैन"] },
  ],
  "muddy-water": [
    { prompt: "फोहोर वा रङ बदलिएको पानी कहाँ देखिन्छ?", choices: ["एउटा धारामा", "धेरै धारामा", "तातो पानीमा मात्र", "निश्चित छैन"] },
    { prompt: "कहिले बढी देखिन्छ?", choices: ["आपूर्ति फेरि आएपछि", "ट्याङ्कीको पानी केही समय बसेपछि", "सधैँ", "निश्चित छैन"] },
  ],
  "breaker-trip": [
    { prompt: "सुरक्षा स्विच कहिले ट्रिप हुन्छ? बारम्बार रिसेट नगर्नुहोस्।", choices: ["स्विच गर्दा तुरुन्तै", "एउटा उपकरण चलाउँदा", "धेरै उपकरण चलेपछि", "अनियमित वा निश्चित छैन"] },
    { prompt: "प्यानल नखोली लेबल थाहा छ भने कुन उपकरण हो? छोएर जाँच नगर्नुहोस्।", choices: ["MCB", "RCD/ELCB", "दुवै वा धेरै", "थाहा छैन"] },
  ],
  "no-power": [
    { prompt: "कहाँ बिजुली गएको छ?", choices: ["एउटा उपकरण/बत्ती", "एउटा कोठा वा सर्किट", "घरको धेरैजसो भाग", "निश्चित छैन"] },
    { prompt: "प्यानल नछोई थाहा भए के भयो?", choices: ["MCB ट्रिप भयो", "RCD/ELCB ट्रिप भयो", "कुनै स्विच ट्रिप भएको देखिएन", "निश्चित छैन"] },
  ],
  "flicker": [
    { prompt: "कति ठाउँका बत्ती झिम्किन्छन्?", choices: ["एउटा बत्ती", "एउटै कोठाका धेरै बत्ती", "धेरै कोठा वा पूरै घर", "निश्चित छैन"] },
    { prompt: "त्यही बेला के हुन्छ?", choices: ["धेरै बिजुली खाने उपकरण सुरु हुन्छ", "स्पष्ट कारण देखिँदैन", "वर्षा वा ओससँगै हुन्छ", "निश्चित छैन"] },
  ],
  "overload": [
    { prompt: "बिजुली जाने वा ट्रिप हुने अवस्था कहिले हुन्छ?", choices: ["धेरै उपकरण चल्दा", "एउटा निश्चित उपकरण चलाउँदा", "थोरै उपकरण हुँदा पनि", "निश्चित छैन"] },
    { prompt: "कति सर्किट वा कोठा प्रभावित छन्?", choices: ["एउटा", "धेरै", "पूरै घर", "निश्चित छैन"] },
  ],
};
export function diagnosticQuestion(issueId: string, index: 0 | 1, language: DiagnosticLanguage): DiagnosticQuestion | null {
  const flows = language === "english" ? ENGLISH_FLOWS : NEPALI_FLOWS;
  return flows[issueId]?.[index] ?? null;
}
export function resolveDiagnosticCode(issueId: string, answers: number[]): SupportedDiagnosticCode | null {
  if (answers.length !== 2) return null;
  if (issueId === "tap-leak") {
    if (answers[0] === 0 && answers[1] === 0) return "PL-TAP-CLOSURE-LEAK";
    if (answers[0] === 1 && answers[1] === 1) return "PL-TAP-BASE-LEAK";
    if (answers[0] === 2 && answers[1] === 2) return "PL-UNDER-SINK-JOINT-LEAK";
  }
  if (["breaker-trip", "no-power", "flicker", "overload", "hot-outlet", "sparks-burning", "electric-shock", "voltage", "inverter", "earthing"].includes(issueId) && answers.every(answer => answer >= 0)) return "EL-SITE-INSPECTION";
  if (issueId === "pipe-leak" && answers[0] === 0) {
    if (answers[1] === 0) return "PL-EXPOSED-JOINT-LEAK";
    if (answers[1] === 1) return "PL-EXPOSED-PIPE-LEAK";
  }
  return null;
}
export function serviceIdForDiagnosticCode(code: string): string | null {
  if (/^PL-TAP-(CLOSURE|BASE)-LEAK$/.test(code)) return "sink-leak";
  if (/^PL-(UNDER-SINK-JOINT|EXPOSED-JOINT|EXPOSED-PIPE)-LEAK$/.test(code)) return "pipe-fitting";
  if (code === "EL-SITE-INSPECTION") return "electrical-wiring";
  return null;
}
export function detectHomeSafetyRisk(text: string): "electric" | "water-electric" | "gas" | null {
  const q = text.toLowerCase();
  if (/gas (leak|smell|gandha)|smell(s|ing)? of gas|gas gandha|gas ko gandha|ग्यास.*(गन्ध|चुहावट)/u.test(q)) return "gas";
  if (/electric shock|electric tingling|earth leakage|current lagyo|tingle.*tap|shock.*water|water.*(socket|wire|switch)|flood.*electric|electric.*flood|pani.*(bijuli|wire|tar|switch|socket)|bijuli.*pani|dhara.*current|करेन्ट.*(लाग|झट्का)|पानी.*(तार|स्विच|सकेट|बिजुली)/u.test(q)) return "water-electric";
  if (/sparking|smoke|burning smell|burnt plastic|hot outlet|hot switchboard|fire|exposed live wire|bare wire|spark|chingaari|jaleko plastic|jaleko gandha|dhuwa|आगो|धुवाँ|जलेको गन्ध|बोर्ड.*तातो|स्विच.*तातो|तार.*(खुला|चुँडिएको)/u.test(q)) return "electric";
  return null;
}








export const DIAGNOSTIC_PREFILL_STORAGE_KEY = "tirkha.booking-diagnostic.v1";
export const diagnosticBookingPrefillSchema = z.object({
  category_slug: z.string().trim().min(1).max(80),
  duration_minutes: z.number().int().min(15).max(480),
  diagnostic: diagnosticDraftSchema,
});
export type DiagnosticBookingPrefill = z.infer<typeof diagnosticBookingPrefillSchema>;







