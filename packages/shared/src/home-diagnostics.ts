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
export type DiagnosticQuestionIndex = 0 | 1 | 2 | 3 | 4;
type QuestionPair = [DiagnosticQuestion, DiagnosticQuestion];
const ENGLISH_FLOWS: Readonly<Record<string, QuestionPair>> = {
  "tap-leak": [
    { prompt: "Where do you first see the leak?", choices: ["At the tap spout", "Around the tap base", "At a visible connector under the sink", "At a wall/floor or I cannot tell"] },
    { prompt: "When does water appear?", choices: ["It continues after the tap is fully closed", "Only while water is running", "At a visible joint/connector", "The source is hidden or uncertain"] },
  ],
  "pipe-leak": [
    { prompt: "Which line seems to be leaking? Do not open anything to check.", choices: ["Pressurised supply line", "Drain line while water is flowing", "Both / more than one", "I cannot tell"] },
    { prompt: "Can you see the pipe without moving fixtures or opening a wall/floor?", choices: ["Yes, exposed", "No, concealed", "Partly visible", "I cannot tell"] },
  ],
  "blocked-drain": [
    { prompt: "Which drain is affected?", choices: ["Sink/basin", "Shower/floor drain", "Toilet", "More than one"] },
    { prompt: "What happens when water is used?", choices: ["It drains slowly", "It backs up at the same fixture", "Another drain bubbles/backflows", "I am not sure"] },
  ],
  "low-pressure": [
    { prompt: "Where is water pressure low?", choices: ["One tap/shower", "Several fixtures in one room", "Most of the home", "I cannot tell"] },
    { prompt: "Which supply is affected?", choices: ["Cold only", "Hot only", "Both hot and cold", "I am not sure"] },
  ],
  "air-in-line": [
    { prompt: "Where do you hear sputtering or see air?", choices: ["One tap", "Several taps", "Only after the pump starts", "I cannot tell"] },
    { prompt: "When did it begin?", choices: ["After supply/pump interruption", "After plumbing work", "It happens regularly", "I am not sure"] },
  ],
  "muddy-water": [
    { prompt: "Where is the discoloured water visible?", choices: ["One tap", "Several taps", "Hot water only", "I cannot tell"] },
    { prompt: "When is it most noticeable?", choices: ["After supply resumes", "After water sits in storage", "All the time", "I am not sure"] },
  ],
  "no-water": [
    { prompt: "Where is water unavailable?", choices: ["One fixture", "One floor/area", "The whole home", "I cannot tell"] },
    { prompt: "What does the supply or pump do, if known?", choices: ["Pump does not start", "Pump runs but water does not arrive", "Supply is intermittent", "I am not sure"] },
  ],
  "breaker-trip": [
    { prompt: "When does the protective device trip? Do not reset it repeatedly.", choices: ["Immediately when switched on", "When one appliance runs", "After several appliances run", "At random / I am not sure"] },
    { prompt: "If you already know the label without approaching/opening the panel, which device trips?", choices: ["MCB", "RCD/ELCB", "Both / more than one", "I do not know"] },
  ],
  "no-power": [
    { prompt: "What has lost power?", choices: ["One appliance/light", "One room/circuit", "Most of the home", "I am not sure"] },
    { prompt: "If you already know without touching the panel, what happened?", choices: ["An MCB tripped", "An RCD/ELCB tripped", "No device appears tripped", "I am not sure"] },
  ],
  "flicker": [
    { prompt: "How widely do lights flicker?", choices: ["One light", "Several in one room", "Several rooms / whole home", "I am not sure"] },
    { prompt: "What happens at the same time?", choices: ["A high-load appliance starts", "No clear trigger", "It follows rain/moisture", "I am not sure"] },
  ],
  "overload": [
    { prompt: "When does power loss or tripping occur?", choices: ["Several appliances run together", "One specific appliance runs", "Even with few appliances", "I am not sure"] },
    { prompt: "How many circuits or rooms are affected?", choices: ["One circuit/room", "Several circuits", "Whole home", "I am not sure"] },
  ],
  "hot-outlet": [
    { prompt: "What do you notice at the outlet/switch? Do not touch it.", choices: ["It feels hot / has a burning smell", "Buzzing/crackling sound", "Visible discoloration", "Not sure"] },
    { prompt: "When is it noticeable?", choices: ["When one appliance is connected", "During heavy use", "Even when unused", "I have moved away and cannot tell"] },
  ],
  "sparks-burning": [
    { prompt: "Where did you observe the spark/smoke? Keep away from it.", choices: ["Outlet or switch", "Appliance plug/body", "Distribution board area", "I cannot safely tell"] },
    { prompt: "Was the affected equipment in use when it happened? Do not approach to inspect.", choices: ["Yes, one appliance was running", "Several appliances were running", "No / not sure", "I already moved away"] },
  ],
};
const NEPALI_FLOWS: Readonly<Record<string, QuestionPair>> = {
  "tap-leak": [
    { prompt: "पानी सबैभन्दा पहिले कहाँ चुहिएको देखिन्छ?", choices: ["धाराको मुखमा", "धाराको फेद वरिपरि", "सिङ्कमुनिको देखिने जोडमा", "भित्ता/भुइँमा वा निश्चित छैन"] },
    { prompt: "पानी कहिले देखिन्छ?", choices: ["धारा पूरै बन्द गरेपछि पनि बगिरहन्छ", "पानी चलाउँदा मात्र", "देखिने जोड/कनेक्टरमा", "स्रोत लुकेको छ वा निश्चित छैन"] },
  ],
  "pipe-leak": [
    { prompt: "कुन पाइपबाट चुहावट भएको जस्तो देखिन्छ? जाँच्न केही नखोल्नुहोस्।", choices: ["चापयुक्त आपूर्ति पाइप", "पानी बग्दा मात्र नालीको पाइप", "दुवै वा एकभन्दा बढी", "निश्चित छैन"] },
    { prompt: "फिक्स्चर नहटाई वा भित्ता/भुइँ नखोली पाइप देख्न सक्नुहुन्छ?", choices: ["सक्छु, पाइप खुला छ", "सक्दिनँ, पाइप लुकेको छ", "केही भाग मात्र देखिन्छ", "निश्चित छैन"] },
  ],
  "blocked-drain": [
    { prompt: "कुन नाली प्रभावित छ?", choices: ["सिङ्क/बेसिन", "नुहाउने ठाउँ/भुइँको नाली", "शौचालय", "एकभन्दा बढी"] },
    { prompt: "पानी चलाउँदा के हुन्छ?", choices: ["ढिलो बग्छ", "त्यही ठाउँमा फर्किन्छ", "अर्को नालीमा बुलबुला वा पानी फर्किन्छ", "निश्चित छैन"] },
  ],
  "low-pressure": [
    { prompt: "पानीको चाप कहाँ कम छ?", choices: ["एउटा धारा/शावर", "एउटै कोठाका धेरै फिक्स्चर", "घरका धेरैजसो ठाउँमा", "निश्चित छैन"] },
    { prompt: "कुन आपूर्तिमा समस्या छ?", choices: ["चिसो पानी मात्र", "तातो पानी मात्र", "दुवै", "निश्चित छैन"] },
  ],
  "air-in-line": [
    { prompt: "पानीमा हावा वा फोका कहाँ देखिन्छ/आवाज कहाँ आउँछ?", choices: ["एउटा धारामा", "धेरै धारामा", "पम्प सुरु भएपछि मात्र", "निश्चित छैन"] },
    { prompt: "यो कहिलेदेखि सुरु भयो?", choices: ["आपूर्ति/पम्प रोकिएपछि", "पाइपको कामपछि", "नियमित रूपमा", "निश्चित छैन"] },
  ],
  "muddy-water": [
    { prompt: "रङ बदलिएको वा मैलो पानी कहाँ देखिन्छ?", choices: ["एउटा धारामा", "धेरै धारामा", "तातो पानीमा मात्र", "निश्चित छैन"] },
    { prompt: "कहिले बढी देखिन्छ?", choices: ["आपूर्ति फेरि आएपछि", "भण्डारणमा केही समय बसेपछि", "सधैँ", "निश्चित छैन"] },
  ],
  "no-water": [
    { prompt: "कहाँ पानी आएको छैन?", choices: ["एउटा फिक्स्चर", "एउटा तला/क्षेत्र", "पूरै घर", "निश्चित छैन"] },
    { prompt: "आपूर्ति वा पम्पले के गर्छ, थाहा भए?", choices: ["पम्प सुरु हुँदैन", "पम्प चल्छ तर पानी आउँदैन", "आपूर्ति बीचबीचमा रोकिन्छ", "निश्चित छैन"] },
  ],
  "breaker-trip": [
    { prompt: "सुरक्षा स्विच कहिले ट्रिप हुन्छ? बारम्बार रिसेट नगर्नुहोस्।", choices: ["स्विच गर्दा तुरुन्तै", "एउटा उपकरण चलाउँदा", "धेरै उपकरण चलेपछि", "अनियमित वा निश्चित छैन"] },
    { prompt: "प्यानल नजिक नजाइकन/नखोली लेबल थाहा भए कुन उपकरण ट्रिप हुन्छ?", choices: ["MCB", "RCD/ELCB", "दुवै वा धेरै", "थाहा छैन"] },
  ],
  "no-power": [
    { prompt: "कहाँ बिजुली गएको छ?", choices: ["एउटा उपकरण/बत्ती", "एउटा कोठा/सर्किट", "घरको धेरैजसो भाग", "निश्चित छैन"] },
    { prompt: "प्यानल नछोई थाहा भए के भयो?", choices: ["MCB ट्रिप भयो", "RCD/ELCB ट्रिप भयो", "कुनै स्विच ट्रिप भएको देखिएन", "निश्चित छैन"] },
  ],
  "flicker": [
    { prompt: "कति ठाउँका बत्ती झिम्किन्छन्?", choices: ["एउटा बत्ती", "एउटै कोठाका धेरै बत्ती", "धेरै कोठा वा पूरै घर", "निश्चित छैन"] },
    { prompt: "त्यही बेला के हुन्छ?", choices: ["धेरै भारको उपकरण सुरु हुन्छ", "स्पष्ट कारण देखिँदैन", "वर्षा/ओससँगै हुन्छ", "निश्चित छैन"] },
  ],
  "overload": [
    { prompt: "बिजुली जाने वा ट्रिप हुने अवस्था कहिले हुन्छ?", choices: ["धेरै उपकरण सँगै चल्दा", "एउटा निश्चित उपकरण चलाउँदा", "थोरै उपकरण हुँदा पनि", "निश्चित छैन"] },
    { prompt: "कति सर्किट वा कोठा प्रभावित छन्?", choices: ["एउटा", "धेरै", "पूरै घर", "निश्चित छैन"] },
  ],
  "hot-outlet": [
    { prompt: "सकेट/स्विचमा के देखिएको छ? नछुनुहोस्।", choices: ["तातो वा जलेको गन्ध", "भुनभुन/चटचट आवाज", "रङ बदलिएको", "निश्चित छैन"] },
    { prompt: "यो कहिले देखिन्छ?", choices: ["एउटा उपकरण जोड्दा", "धेरै भार हुँदा", "चलाएको नभए पनि", "टाढा हटिसकेँ, थाहा छैन"] },
  ],
  "sparks-burning": [
    { prompt: "झिल्का/धुवाँ कहाँ देखियो? त्यसबाट टाढा रहनुहोस्।", choices: ["सकेट वा स्विच", "उपकरणको प्लग/बडी", "वितरण प्यानल वरिपरि", "सुरक्षित रूपमा भन्न सक्दिनँ"] },
    { prompt: "घटना हुँदा उपकरण चलिरहेको थियो? जाँच्न नजिक नजानुहोस्।", choices: ["एउटा उपकरण चलिरहेको थियो", "धेरै उपकरण चलिरहेका थिए", "चलिरहेको थिएन/थाहा छैन", "म टाढा हटिसकेको छु"] },
  ],
};
const ENGLISH_TRADE_FOLLOWUPS: Readonly<Record<"plumbing" | "electrical", [DiagnosticQuestion, DiagnosticQuestion, DiagnosticQuestion]>> = {
  plumbing: [
    { prompt: "Which situation best matches the timing?", choices: ["When the supply/pump is on", "Only while a fixture drains", "Both situations", "I cannot tell"] },
    { prompt: "How widespread is the symptom?", choices: ["One fixture/one point", "Several fixtures in one area", "Several floors / most of home", "I cannot tell"] },
    { prompt: "If already visible without touching or moving anything, what pipe marking/material do you know?", choices: ["PPR / plastic", "PVC", "GI / metal", "Not visible or not known"] },
  ],
  electrical: [
    { prompt: "What was already running when the fault occurred? Do not switch equipment on to test.", choices: ["Water pump", "Water heater/geyser", "Another heavy-load appliance", "Nothing known"] },
    { prompt: "What area lost power or showed the symptom?", choices: ["One outlet/light", "One room/circuit", "Several rooms / most of home", "I cannot tell"] },
    { prompt: "If you already know the breaker marking without approaching/opening the panel, which range is printed?", choices: ["6–10 A", "13–20 A", "25 A or more", "Not known / do not check"] },
  ],
};
const ENGLISH_PIPE_FOLLOWUPS: [DiagnosticQuestion, DiagnosticQuestion, DiagnosticQuestion] = [
  { prompt: "On the visible section, where is the leak point?", choices: ["At a joint/coupling", "Through the pipe body", "Both / unclear", "No exposed point"] },
  { prompt: "When is the leak present? Do not turn valves or pumps to test.", choices: ["When supply/pump is already running", "Only while a fixture drains", "At other times too", "I cannot tell"] },
  { prompt: "If already visible without touching/moving anything, what pipe marking/material do you know?", choices: ["PPR / plastic", "PVC", "GI / metal", "Not visible or not known"] },
];
const NEPALI_PIPE_FOLLOWUPS: [DiagnosticQuestion, DiagnosticQuestion, DiagnosticQuestion] = [
  { prompt: "देखिने पाइपमा पानी कहाँबाट चुहिएको छ?", choices: ["जोड/कपलिङबाट", "पाइपको बीचको भागबाट", "दुवै वा स्पष्ट छैन", "खुला पाइप देखिँदैन"] },
  { prompt: "चुहावट कहिले देखिन्छ? जाँच्न भल्भ वा पम्प नचलाउनुहोस्।", choices: ["आपूर्ति/पम्प पहिलेबाट चलिरहेको बेला", "फिक्स्चरबाट पानी नालीमा बग्दा मात्र", "अरू बेला पनि", "निश्चित छैन"] },
  { prompt: "नछोईकन/नसारी देख्न सकिने पाइपको चिन्ह वा सामग्री थाहा छ?", choices: ["PPR / प्लास्टिक", "PVC", "GI / धातु", "देखिँदैन वा थाहा छैन"] },
];
const NEPALI_TRADE_FOLLOWUPS: Readonly<Record<"plumbing" | "electrical", [DiagnosticQuestion, DiagnosticQuestion, DiagnosticQuestion]>> = {
  plumbing: [
    { prompt: "समस्या कुन अवस्थामा देखिन्छ?", choices: ["आपूर्ति/पम्प चलेको बेला", "फिक्स्चरबाट पानी नालीमा बग्दा मात्र", "दुवै अवस्थामा", "निश्चित छैन"] },
    { prompt: "लक्षण कति क्षेत्रमा फैलिएको छ?", choices: ["एउटा फिक्स्चर/एउटा ठाउँ", "एउटै क्षेत्रमा धेरै फिक्स्चर", "धेरै तला/घरको धेरै भाग", "निश्चित छैन"] },
    { prompt: "नछोईकन/नसारी देख्न सकिने पाइपको चिन्ह वा सामग्री थाहा छ?", choices: ["PPR / प्लास्टिक", "PVC", "GI / धातु", "देखिँदैन वा थाहा छैन"] },
  ],
  electrical: [
    { prompt: "समस्या हुँदा कुन उपकरण पहिले नै चलिरहेको थियो? जाँच्न उपकरण नचलाउनुहोस्।", choices: ["पानीको पम्प", "पानी तताउने गिजर", "अर्को धेरै भारको उपकरण", "थाहा छैन"] },
    { prompt: "कुन क्षेत्रमा बिजुली गएको वा समस्या देखिएको छ?", choices: ["एउटा सकेट/बत्ती", "एउटा कोठा/सर्किट", "धेरै कोठा/घरको धेरै भाग", "निश्चित छैन"] },
    { prompt: "प्यानल नजिक नगई/नखोली पहिलेबाट थाहा भए ब्रेकरमा कुन दायरा लेखिएको छ?", choices: ["६–१० A", "१३–२० A", "२५ A वा बढी", "थाहा छैन / जाँच्न नजानुहोस्"] },
  ],
};
function tradeForIssue(issueId: string): "plumbing" | "electrical" | null {
  const trade = HOME_ISSUES.find(issue => issue.id === issueId)?.trade;
  return trade === "plumbing" || trade === "electrical" ? trade : null;
}
export function diagnosticQuestion(issueId: string, index: number, language: DiagnosticLanguage, previousAnswers: readonly number[] = []): DiagnosticQuestion | null {
  if (!Number.isInteger(index) || index < 0 || index > 4) return null;
  const trade = tradeForIssue(issueId);
  if (!trade) return null;
  const flows = language === "english" ? ENGLISH_FLOWS : NEPALI_FLOWS;
  if (issueId === "pipe-leak" && index === 1 && previousAnswers[0] === 1) {
    return language === "english"
      ? { prompt: "You identified a gravity drain. When is the leak visible? Do not run water to test.", choices: ["Only while water is already draining", "Even when the drain is unused", "At the trap or fixture connection", "I cannot tell"] }
      : { prompt: "तपाईंले ढल्केको निकास नाली पहिचान गर्नुभयो। पानी पहिलेबाट बगिरहेको बेला मात्र चुहावट देखिन्छ? जाँच्न पानी नचलाउनुहोस्।", choices: ["पहिलेबाट पानी बग्दा मात्र", "नाली प्रयोग नभए पनि", "ट्र्याप वा फिक्स्चरको जोडमा", "निश्चित छैन"] };
  }
  if (index < 2) {
    const issueQuestion = flows[issueId]?.[index as 0 | 1];
    if (issueQuestion) return issueQuestion;
    if (trade === "electrical") return language === "english"
      ? (index === 0 ? { prompt: "Which electrical part is affected? Do not touch it.", choices: ["One light or outlet", "A switch or breaker", "A household appliance", "I cannot tell"] } : { prompt: "When does the electrical symptom occur? Do not switch anything on to test.", choices: ["Continuously", "When one known appliance is already running", "Intermittently", "I cannot tell"] })
      : (index === 0 ? { prompt: "कुन विद्युतीय भागमा समस्या देखिएको छ? नछुनुहोस्।", choices: ["एउटा बत्ती वा सकेट", "स्विच वा ब्रेकर", "घरायसी उपकरण", "निश्चित छैन"] } : { prompt: "विद्युतीय समस्या कहिले देखिन्छ? जाँच्न कुनै उपकरण नचलाउनुहोस्।", choices: ["निरन्तर", "पहिलेबाट चलिरहेको उपकरण हुँदा", "बीचबीचमा", "निश्चित छैन"] });
    return language === "english"
      ? (index === 0 ? { prompt: "Which part of the water system is affected?", choices: ["Tap/fixture", "Supply pipe", "Drain/tank/pump", "I cannot tell"] } : { prompt: "When is the symptom present?", choices: ["Continuously", "Only while water is used", "When supply/pump runs", "I cannot tell"] })
      : (index === 0 ? { prompt: "पानी प्रणालीको कुन भाग प्रभावित छ?", choices: ["धारा/फिक्स्चर", "आपूर्ति पाइप", "नाली/ट्याङ्की/पम्प", "निश्चित छैन"] } : { prompt: "लक्षण कहिले देखिन्छ?", choices: ["निरन्तर", "पानी चलाउँदा मात्र", "आपूर्ति/पम्प चल्दा", "निश्चित छैन"] });
  }
  if (issueId === "pipe-leak") {
    const pipeFollowups = language === "english" ? ENGLISH_PIPE_FOLLOWUPS : NEPALI_PIPE_FOLLOWUPS;
    return pipeFollowups[index - 2] ?? null;
  }
  const followups = language === "english" ? ENGLISH_TRADE_FOLLOWUPS[trade] : NEPALI_TRADE_FOLLOWUPS[trade];
  return followups[index - 2] ?? null;
}export function resolveDiagnosticCode(issueId: string, answers: number[]): SupportedDiagnosticCode | null {
  if (answers.length !== 5 || answers.some(answer => answer < 0)) return null;
  if (issueId === "tap-leak") {
    if (answers[0] === 0 && answers[1] === 0) return "PL-TAP-CLOSURE-LEAK";
    if (answers[0] === 1 && answers[1] === 1) return "PL-TAP-BASE-LEAK";
    if (answers[0] === 2 && answers[1] === 2) return "PL-UNDER-SINK-JOINT-LEAK";
  }
  if (["breaker-trip", "no-power", "flicker", "overload", "hot-outlet", "sparks-burning", "electric-shock", "voltage", "inverter", "earthing"].includes(issueId)) return "EL-SITE-INSPECTION";
  if (issueId === "pipe-leak" && answers[0] === 0 && answers[1] === 0) {
    if (answers[2] === 0) return "PL-EXPOSED-JOINT-LEAK";
    if (answers[2] === 1) return "PL-EXPOSED-PIPE-LEAK";
  }
  return null;
}export function serviceIdForDiagnosticCode(code: string): string | null {
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











