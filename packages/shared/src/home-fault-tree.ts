import { normalizeDiagnosticText } from "./universal-diagnostics.ts";

export type FaultTrade = "plumbing" | "electrical";
export const HOME_FAULT_TREE = [
  { code: "PL-PPR-FUSION-JOINT-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "PPR thermal-fusion joint leak", serviceId: "pipe-fitting", patterns: [/\bppr\b.*\b(fusion|joint|leak|leaking|chuh)/i, /\b(fusion|welded)\s+joint\b/i] },
  { code: "PL-GI-THREADED-CORROSION-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "GI threaded-pipe corrosion or thread leak", serviceId: "pipe-fitting", patterns: [/\bgi\b.*\b(thread|corrod|rust|leak)/i, /\b(threaded|galvanized|galvanised|iron)\s+pipe\b.*\b(corrod|rust|leak)/i] },
  { code: "PL-PVC-SOLVENT-WELD-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "PVC/uPVC solvent-weld leak", serviceId: "pipe-fitting", patterns: [/\b(u?pvc|pvc)\b.*\b(solvent|weld|joint|leak)/i, /\b(solvent[- ]weld|glued\s+joint)\b/i] },
  { code: "PL-SEEPAGE-DAMPNESS", issueId: "seepage", trade: "plumbing", group: "pipe", title: "Wall, ceiling or floor seepage/dampness concern", serviceId: "pipe-fitting", patterns: [/\b(seepage|damp|wet\s+patch|water\s+stain|wall\s+leak|ceiling\s+leak)\b/i, /\b(wall|ceiling|floor|slab)\b.*\b(damp|seep|wet|stain|moisture)/i, /भित्ता.*(ओस|चिसो|चुह)|छत.*(चुह|ओस)/u] },
  { code: "PL-CONCEALED-WALL-SLAB-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "Possible concealed wall or slab leak", serviceId: "pipe-fitting", patterns: [/\b(concealed|hidden|inside\s+(the\s+)?(wall|slab|floor))\b.*\b(pipe|leak|damp|seep)/i, /\b(wall|slab|floor)\b.*\b(damp|seepage|leak|wet\s+patch)/i] },
  { code: "PL-SUBMERSIBLE-PUMP-MOTOR-FAULT", issueId: "pump", trade: "plumbing", group: "pump", title: "Submersible pump or motor concern", serviceId: "pipe-fitting", patterns: [/\b(submersible|borewell|well\s+pump|inar\s+pump)\b/i, /\bpump\b.*\b(motor|not\s+start|silent|overheat|hum)/i] },
  { code: "PL-BOOSTER-PUMP-SHORT-CYCLE", issueId: "pump", trade: "plumbing", group: "pump", title: "Pressure booster pump short-cycling", serviceId: "pipe-fitting", patterns: [/\b(booster|pressure)\s+pump\b.*\b(short\s*cycl|frequent|keeps?\s+(starting|stopping)|on\s+off)/i, /\bpump\b.*\b(starts?\s+and\s+stops?|cycles?\s+often)/i] },
  { code: "PL-TANK-FLOAT-VALVE-OVERFLOW", issueId: "tank-overflow", trade: "plumbing", group: "tank", title: "Overhead tank float-valve overflow", serviceId: "pipe-fitting", patterns: [/\b(overhead|roof|water)\s+tank\b.*\b(float|overflow|overfill|spill)/i, /\b(float\s+valve|ball\s+valve)\b.*\b(stuck|overflow|not\s+stop)/i] },
  { code: "PL-SUMP-CONTAMINATION", issueId: "muddy-water", trade: "plumbing", group: "water-quality", title: "Sump or stored-water contamination concern", serviceId: "pipe-fitting", patterns: [/\b(sump|underground\s+tank|reservoir)\b.*\b(contamin|dirty|muddy|smell|fohor)/i, /\b(contaminated|foul|bad)\s+(sump|stored\s+water|tank\s+water)/i] },
  { code: "PL-DUAL-FLUSH-CISTERN-FAULT", issueId: "toilet-flush", trade: "plumbing", group: "fixture", title: "Dual-flush cistern mechanism concern", serviceId: "pipe-fitting", patterns: [/\b(dual\s*flush|dual[- ]flush|cistern)\b.*\b(button|mechanism|keeps?\s+running|leak|flush)/i, /\btoilet\b.*\b(flush\s+button|cistern\s+keeps?\s+running)/i] },
  { code: "PL-MIXER-CARTRIDGE-WEAR", issueId: "low-pressure", trade: "plumbing", group: "fixture", title: "Basin or shower mixer cartridge concern", serviceId: "sink-leak", patterns: [/\b(basin|shower|mixer|mixing\s+tap)\b.*\b(cartridge|handle|temperature|drip|stiff)/i, /\bmixer\s+cartridge\b/i] },
  { code: "PL-SOLAR-PRV-DISCHARGE", issueId: "solar-water-heater", trade: "plumbing", group: "heater", title: "Solar heater pressure-relief discharge concern", serviceId: "pipe-fitting", patterns: [/\bsolar\b.*\b(prv|pressure\s+relief|relief\s+valve)\b.*\b(discharge|drip|continuous|leak)/i, /\b(prv|pressure\s+relief)\b.*\b(continuous|always|discharge|drip)/i] },
  { code: "PL-GAS-GEYSER-IGNITION-DIAPHRAGM", issueId: "water-heater", trade: "plumbing", group: "heater", title: "Instant gas geyser ignition or diaphragm concern", serviceId: "pipe-fitting", patterns: [/\b(gas\s+geyser|instant\s+(gas\s+)?water\s+heater)\b.*\b(ignite|ignition|diaphragm|not\s+light|click)/i, /\bgeyser\b.*\b(not\s+ignite|not\s+light|diaphragm)/i] },
  { code: "PL-RO-MEMBRANE-FOULING", issueId: "muddy-water", trade: "plumbing", group: "water-quality", title: "RO membrane or filtration performance concern", serviceId: "pipe-fitting", patterns: [/\b(ro|reverse\s+osmosis)\b.*\b(membrane|low\s+output|taste|slow|foul|filter)/i, /\bmembrane\b.*\b(ro|water\s+filter)/i] },
  { code: "PL-SUPPLY-LINE-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "Pressurized water-supply line leak concern", serviceId: "pipe-fitting", patterns: [/\b(supply|pressuri[sz]ed|main)\s+(water\s+)?(line|pipe)\b.*\b(leak|drip|burst|crack|chuh)/i, /\b(water|paani)\b.*\b(line|pipe)\b.*\b(leak|chuh)/i] },
  { code: "PL-SUMP-PUMP-NO-WATER", issueId: "pump", trade: "plumbing", group: "pump", title: "Sump pump or water-pump delivery concern", serviceId: "pipe-fitting", patterns: [/\b(sump\s+pump|motor)\b.*\b(paani|water|not\s+coming|aayena|chaina|no\s+water)/i, /\b(motor|pump)\b.*\b(paani|water)\b.*\b(aayena|aaena|not\s+coming|chaina|stopped)/i, /\bmotor\s+paani\s+aayena\b/i, /\bsump\s+pump\b/i] },
  { code: "PL-DRAIN-DHAL-BLOCKAGE", issueId: "blocked-drain", trade: "plumbing", group: "drainage", title: "Drain or dhal blockage concern", serviceId: "pipe-fitting", patterns: [/\b(drain|dhal|nali|sewer|sink|floor\s+trap)\b.*\b(block|blocked|clog|jam|jammed|bujh|backflow|slow|overflow)/i, /\b(sink|drain|dhal)\s+(jam|blocked|bujhyo|bujhiyo)\b/i, /\bdhal\s+bujhyo\b/i, /नाली.*(थुन|जाम|बन्द|ढल)/u] },
  { code: "PL-SEWER-GAS-ODOR", issueId: "sewer-odor", trade: "plumbing", group: "drainage", title: "Drain or sewer odour concern", serviceId: "pipe-fitting", patterns: [/\b(sewer|drain|dhal|sink|bathroom|toilet)\b.*\b(odor|odour|smell|gandha|bad\s+smell)/i, /\b(odor|odour|smell|gandha)\b.*\b(sewer|drain|dhal|sink|bathroom|toilet)/i, /दुर्गन्ध|गन्ध.*(नाली|ढल|शौचालय)/u] },
  { code: "PL-CONCEALED-DIVERTER-VALVE", issueId: "diverter-valve", trade: "plumbing", group: "fixture", title: "Shower diverter or concealed valve concern", serviceId: "pipe-fitting", patterns: [/\b(diverter|concealed\s+valve|shower\s+valve)\b.*\b(leak|stuck|jam|flow|switch|tap|shower)/i, /\b(shower|tap)\b.*\bdiverter\b/i, /\bdiverter\b/i] },
  { code: "PL-FLUSH-MECHANISM-FAULT", issueId: "toilet-flush", trade: "plumbing", group: "fixture", title: "Toilet flush-tank or cistern mechanism concern", serviceId: "pipe-fitting", patterns: [/\b(flush\s*(tank|button|mechanism)|cistern|toilet\s+flush)\b.*\b(leak|run|running|weak|not\s+work|broken|stuck|flush)/i, /\bflush\s+tank\b/i, /फ्लस.*(ट्याङ्की|नचल्ने|चुह)/u] },
  { code: "PL-SOLAR-GEYSER-PIPE-LEAK", issueId: "water-heater", trade: "plumbing", group: "heater", title: "Solar or geyser water-pipe connection concern", serviceId: "pipe-fitting", patterns: [/\b(solar|geyser|geiser|water\s+heater)\b.*\b(pipe|line|connection|joint)\b.*\b(leak|drip|chuh)/i, /\b(geyser\s+pipe|solar\s+pipe)\b/i, /\b(solar\s+heater)\b.*\b(pipe|leak|chuh)/i] },
  { code: "EL-MCB-THERMAL-SHORT-TRIP", issueId: "breaker-trip", trade: "electrical", group: "protection", title: "MCB thermal or short-circuit trip concern", serviceId: "electrical-wiring", patterns: [/\bmcb\b.*\b(trip|hot|thermal|short|keeps?\s+off)/i, /\b(short\s*circuit|thermal\s+trip|breaker\s+trips?)\b/i] },
  { code: "EL-RCCB-NUISANCE-TRIP", issueId: "breaker-trip", trade: "electrical", group: "protection", title: "RCCB/RCD/ELCB repeated-trip concern", serviceId: "electrical-wiring", patterns: [/\b(rccb|rcd|elcb)\b.*\b(trip|nuisance|keeps?\s+off)/i, /\b(residual\s+current|earth\s+leakage)\b.*\b(trip|breaker)/i, /\brccb\b/i] },
  { code: "EL-DB-BUSBAR-LOOSE-TERMINAL", issueId: "hot-outlet", trade: "electrical", group: "distribution", title: "Distribution-board busbar or terminal concern", serviceId: "electrical-wiring", patterns: [/\b(busbar|bus\s+bar|distribution\s+board\s+terminal)\b.*\b(loose|hot|burn|spark|buzz)/i] },
  { code: "EL-PHASE-VOLTAGE-DROP", issueId: "voltage", trade: "electrical", group: "supply", title: "Possible phase-voltage drop or fluctuation", serviceId: "electrical-wiring", patterns: [/\b(phase|voltage|power)\b.*\b(drop|fluctuat|unstable|low|high)/i, /\b(single\s+phase|three\s+phase)\b.*\b(weak|drop|fluctuat)/i] },
  { code: "EL-BURNT-OUTLET-HEAVY-LOAD", issueId: "hot-outlet", trade: "electrical", group: "wiring", title: "Outlet or switch thermal-damage concern under load", serviceId: "electrical-wiring", patterns: [/\b(socket|outlet|switch)\b.*\b(burn|black|melt|hot|heavy\s+load)/i, /\b(burnt|burned|melted)\s+(socket|outlet|switch|plug)/i] },
  { code: "EL-UPS-CHANGEOVER-WIRING", issueId: "inverter", trade: "electrical", group: "backup-power", title: "Inverter/UPS changeover wiring concern", serviceId: "electrical-wiring", patterns: [/\b(inverter|ups|backup)\b.*\b(changeover|backfeed|transfer|switching)/i, /\b(changeover)\b.*\b(inverter|ups|wiring)/i] },
  { code: "EL-NEUTRAL-EARTH-LEAKAGE", issueId: "earthing", trade: "electrical", group: "wiring", title: "Possible neutral-to-earth leakage concern", serviceId: "electrical-wiring", patterns: [/\b(neutral)\b.*\b(earth|ground)\b.*\b(leak|voltage|current|tingle)/i, /\b(earth|ground)\b.*\b(leakage|tingle|current)/i] },
  { code: "EL-WATER-LEVEL-SENSOR-CORROSION", issueId: "appliance", trade: "electrical", group: "controls", title: "Water-level sensor or control wiring corrosion concern", serviceId: "electrical-wiring", patterns: [/\b(water\s+level|tank\s+level)\b.*\b(sensor|probe|corrod|rust|fault)/i, /\b(sensor|probe)\b.*\b(corrod|rust|tank\s+level)/i] },
  { code: "EL-MCB-RCCB-TRIPPING", issueId: "breaker-trip", trade: "electrical", group: "protection", title: "MCB/RCCB repeated-tripping concern", serviceId: "electrical-wiring", patterns: [/\b(mcb|rccb|rcd|elcb|breaker)\b.*\b(trip|tripped|tripping|off|cut)/i, /\b(mcb\s+trip|rccb\s+trip)\b/i] },
  { code: "EL-BURNING-WIRE-SMELL", issueId: "sparks-burning", trade: "electrical", group: "wiring", title: "Burning wire or electrical-smell hazard", serviceId: "electrical-wiring", patterns: [/\b(wire|wiring|socket|switch|plastic)\b.*\b(burn|burnt|burned|jal|jaleyo|smell|gandha|odor|odour)/i, /\b(smell|gandha|odor|odour)\b.*\b(burning|wire|socket|electrical|jaleko)/i, /\b(wire\s+jaleyo|jaleko\s+wire)\b/i, /जलेको.*(तार|गन्ध)|तार.*जलेको/u] },
  { code: "EL-ELECTRIC-SHOCK-EARTHING", issueId: "electric-shock", trade: "electrical", group: "wiring", title: "Electric shock or earthing fault concern", serviceId: "electrical-wiring", patterns: [/\b(shock|jhatka|current)\b.*\b(lagyo|aayo|coming|tap|body|metal|appliance|person)/i, /\b(shock\s+lagyo|current\s+aayo|current\s+lagyo)\b/i, /\b(earthing|grounding)\b.*\b(fault|problem|leak|shock|current)/i, /करेन्ट.*(लाग|आयो)|झट्का.*लाग/u] },
  { code: "EL-FLOATING-NEUTRAL", issueId: "voltage", trade: "electrical", group: "supply", title: "Possible floating-neutral or unstable-supply concern", serviceId: "electrical-wiring", patterns: [/\b(floating|loose|open)\s+neutral\b/i, /\b(neutral)\b.*\b(float|loose|open|phase|voltage|flicker)/i, /\b(phase\s+loss|lost\s+phase|phase\s+gone)\b/i] },
  { code: "EL-MAIN-DB-SPARKING", issueId: "sparks-burning", trade: "electrical", group: "distribution", title: "Main distribution-board sparking concern", serviceId: "electrical-wiring", patterns: [/\b(main\s+)?(db|distribution\s+board|panel)\b.*\b(spark|sparking|chingaari|burn|buzz)/i, /\b(spark|sparking|chingaari)\b.*\b(db|distribution\s+board|panel|board)/i, /बोर्ड.*(झिल्का|चिङ्गारी|आगो)/u] },
  { code: "EL-INVERTER-BYPASS-SWITCH", issueId: "inverter", trade: "electrical", group: "backup-power", title: "Inverter bypass or transfer-switch concern", serviceId: "electrical-wiring", patterns: [/\b(inverter|ups|backup)\b.*\b(bypass|manual\s+switch|transfer\s+switch|changeover)/i, /\b(inverter\s+switch|bypass\s+switch)\b/i] },
  { code: "EL-MOTOR-STARTER-FAULT", issueId: "appliance", trade: "electrical", group: "controls", title: "Motor starter or pump-control concern", serviceId: "electrical-wiring", patterns: [/\b(motor\s+starter|starter|contactor|overload\s+relay)\b.*\b(motor|pump|trip|fault|start|stop|burn)/i, /\bmotor\s+starter\b/i] },
  { code: "EL-REGULATOR-LIGHT-FLICKER", issueId: "flicker", trade: "electrical", group: "supply", title: "Light flicker or regulator concern", serviceId: "electrical-wiring", patterns: [/\b(regulator|dimmer|light|batti)\b.*\b(flicker|flickering|blink|dim|unstable|fault|not\s+working)/i, /\bregulator\b/i, /बत्ती.*(झिम्क|मधुरो)|रेगुलेटर/u] },
] as const;
export type HomeFaultNode = (typeof HOME_FAULT_TREE)[number];
export type HomeFaultCode = HomeFaultNode["code"];

/** Normalize common spelling variants before deterministic local fault-tree matching. */
export function normalizeHomeDiagnosticText(text: string): string {
  return normalizeDiagnosticText(text);
}
const PLUMBING_INTENT_TERMS = ["plumb", "leak", "pipe", "tap", "dhara", "pani", "tank", "drain", "sewage", "fohor", "dirty", "dirt", "muddy", "sewer", "drain", "odor", "odour", "smell", "dhal", "sump", "diverter", "flush", "seepage", "geyser", "solar", "पानी", "धारा", "पाइप", "ढल", "नाली", "चुह"];
const ELECTRICAL_INTENT_TERMS = ["electr", "light", "spark", "mcb", "rccb", "rcd", "elcb", "fuse", "wire", "bijuli", "short", "shock", "power", "burn", "burning", "jaleyo", "current", "neutral", "phase", "inverter", "bypass", "starter", "regulator", "बिजुली", "बत्ती", "झिल्का", "तार", "करेन्ट"];
function intentScore(tokens: string[], terms: readonly string[]) {
  return tokens.reduce((score, token) => score + (terms.some(term => token === term || (term.length >= 4 && token.startsWith(term))) ? 1 : 0), 0);
}

/** Identify a primary trade from generic or imperfect text; ties remain unclassified. */
export function detectHomeFaultTrade(text: string): FaultTrade | null {
  const tokens = normalizeHomeDiagnosticText(text).split(" ").filter(Boolean);
  const plumbing = intentScore(tokens, PLUMBING_INTENT_TERMS);
  const electrical = intentScore(tokens, ELECTRICAL_INTENT_TERMS);
  if (plumbing === electrical || plumbing === 0 && electrical === 0) return null;
  return plumbing > electrical ? "plumbing" : "electrical";
}

export function matchHomeFault(text: string): HomeFaultNode | null {
  const normalized = normalizeHomeDiagnosticText(text);
  return HOME_FAULT_TREE.find(node => node.patterns.some(pattern => pattern.test(normalized))) ?? null;
}

export type FaultQuestion = { prompt: string; choices: string[] };
type DiagnosticStep = "symptom" | "component" | "material" | "pressure" | "duration" | "environment" | "severity";
const DEEP_FAULT_GROUPS = new Set(["pipe", "pump", "drainage", "protection", "distribution", "supply", "wiring", "backup-power", "controls"]);
const MEDIUM_FAULT_GROUPS = new Set(["tank", "water-quality", "fixture", "heater"]);
function diagnosticPlan(trade: FaultTrade, issueId: string, faultCode?: string): DiagnosticStep[] {
  const group = HOME_FAULT_TREE.find(node => node.code === faultCode)?.group;
  if (DEEP_FAULT_GROUPS.has(group ?? "") || ["pipe-leak", "pump", "breaker-trip", "voltage", "low-pressure", "no-water", "no-power", "flicker", "hot-outlet", "inverter"].includes(issueId)) {
    return ["symptom", "component", "material", "pressure", "duration", "environment", "severity"];
  }
  if (MEDIUM_FAULT_GROUPS.has(group ?? "") || ["muddy-water", "toilet-flush", "water-heater", "solar-water-heater", "tank-overflow", "intermittent-supply", "blocked-drain"].includes(issueId)) {
    return ["symptom", "component", "material", "duration", "severity"];
  }
  return ["symptom", "component", "severity"];
}
export function diagnosticQuestionCount(trade: FaultTrade, issueId: string, faultCode?: string): number {
  return diagnosticPlan(trade, issueId, faultCode).length;
}
export function faultTreeQuestion(trade: FaultTrade, issueId: string, index: number, language: "english" | "nepali_devanagari" | "nepali_romanized", previousAnswers: readonly number[] = [], faultCode?: string): FaultQuestion | null {
  const plan = diagnosticPlan(trade, issueId, faultCode);
  if (!Number.isInteger(index) || index < 0 || index >= plan.length) return null;
  const en = language === "english";
  const node = HOME_FAULT_TREE.find(item => item.code === faultCode);
  const componentOptions: Record<string, { en: string[]; ne: string[] }> = {
    pipe: { en: ["A visible joint/fitting", "The pipe body", "A wall/slab with no exposed pipe", "Other / not sure"], ne: ["देखिने जोड/फिटिङ", "पाइपको बीचको भाग", "खुला पाइप नभएको भित्ता/स्ल्याब", "अर्को वा निश्चित छैन"] },
    pump: { en: ["Submersible/centrifugal pump", "Booster pump", "Tank float/level control", "Other / not sure"], ne: ["सबमर्सिबल/सेन्ट्रिफ्युगल पम्प", "बुस्टर पम्प", "ट्याङ्की फ्लोट/लेभल नियन्त्रण", "अर्को वा निश्चित छैन"] },
    tank: { en: ["Float valve", "Overflow outlet", "Level sensor/control", "Other / not sure"], ne: ["फ्लोट भल्भ", "ओभरफ्लो निकास", "लेभल सेन्सर/नियन्त्रण", "अर्को वा निश्चित छैन"] },
    "water-quality": { en: ["Sump/stored water", "RO filtration", "Several supply taps", "Other / not sure"], ne: ["सम्प/भण्डारणको पानी", "RO फिल्टर प्रणाली", "धेरै आपूर्ति धारा", "अर्को वा निश्चित छैन"] },
    fixture: { en: ["Dual-flush cistern", "Basin/shower mixer", "Tap/connector", "Other / not sure"], ne: ["डुअल-फ्लस सिस्टर्न", "बेसिन/शावर मिक्सर", "धारा/कनेक्टर", "अर्को वा निश्चित छैन"] },
    heater: { en: ["Solar heater relief valve", "Instant gas geyser", "Geyser/solar pipe connection", "Other / not sure"], ne: ["सोलार हिटरको प्रेसर रिलिफ भल्भ", "इन्स्ट्यान्ट ग्यास गिजर", "गिजर/सोलार पाइप जोड", "अर्को वा निश्चित छैन"] },
    protection: { en: ["MCB", "RCCB/RCD/ELCB", "Both / another device", "Not sure; do not inspect the panel"], ne: ["MCB", "RCCB/RCD/ELCB", "दुवै वा अर्को उपकरण", "निश्चित छैन; प्यानल नजाँच्नुहोस्"] },
    distribution: { en: ["Distribution board/terminal area", "Buzzing near the board", "Visible heat/discoloration from a distance", "Other / not sure; keep away"], ne: ["वितरण बोर्ड/टर्मिनल क्षेत्र", "बोर्डनजिक भनभन आवाज", "टाढैबाट देखिने ताप/रङ परिवर्तन", "अर्को वा निश्चित छैन; टाढा रहनुहोस्"] },
    supply: { en: ["One appliance is affected", "Several rooms are affected", "Whole-home supply changes", "Not sure; do not measure voltage"], ne: ["एउटा उपकरण प्रभावित", "धेरै कोठा प्रभावित", "घरभरि आपूर्ति बदलिन्छ", "निश्चित छैन; भोल्टेज ननाप्नुहोस्"] },
    wiring: { en: ["Socket/outlet/switch", "Neutral-earth concern", "Heavy-load appliance connection", "Other / not sure; do not touch"], ne: ["सकेट/आउटलेट/स्विच", "न्युट्रल-अर्थसम्बन्धी समस्या", "धेरै भारको उपकरण जडान", "अर्को वा निश्चित छैन; नछुनुहोस्"] },
    "backup-power": { en: ["UPS/inverter changeover", "Only fails on backup", "Circuit differs on backup", "Other / not sure; do not open equipment"], ne: ["UPS/इन्भर्टर चेन्जओभर", "ब्याकअपमा मात्र बन्द हुन्छ", "ब्याकअपमा सर्किट फरक चल्छ", "अर्को वा निश्चित छैन; उपकरण नखोल्नुहोस्"] },
    controls: { en: ["Tank level sensor", "Pump control or motor starter", "Visible corrosion from a distance", "Other / not sure; do not touch"], ne: ["ट्याङ्की लेभल सेन्सर", "पम्प नियन्त्रण वा मोटर स्टार्टर", "टाढैबाट देखिने खिया", "अर्को वा निश्चित छैन; नछुनुहोस्"] },
    drainage: { en: ["Sink/basin drain", "Floor trap or bathroom drain", "Sewer/vent or recurring odour", "Other / not sure"], ne: ["सिङ्क/बेसिनको नाली", "भुइँको ट्र्याप वा बाथरूम नाली", "ढल/भेन्ट वा दोहोरिने गन्ध", "अर्को वा निश्चित छैन"] },
  };
  const materialOptions: Record<string, { en: string[]; ne: string[] }> = {
    pipe: { en: ["PPR", "GI/threaded metal", "PVC/uPVC solvent-weld", "Not visible / not sure"], ne: ["PPR", "GI/थ्रेडेड धातु", "PVC/uPVC सोल्भेन्ट-जोड", "देखिँदैन वा निश्चित छैन"] },
    pump: { en: ["Motor/jam concern", "Pressure control/short cycling", "Float/level control", "Not sure"], ne: ["मोटर/जाम समस्या", "प्रेसर नियन्त्रण/बारम्बार चल्ने", "फ्लोट/लेभल नियन्त्रण", "निश्चित छैन"] },
    tank: { en: ["Mechanical float", "Overflow pipe", "Electrical level sensor", "Not sure"], ne: ["मेकानिकल फ्लोट", "ओभरफ्लो पाइप", "विद्युतीय लेभल सेन्सर", "निश्चित छैन"] },
    "water-quality": { en: ["Stored/sump water", "RO membrane/filter", "Several taps/source water", "Not sure"], ne: ["भण्डारण/सम्पको पानी", "RO मेम्ब्रेन/फिल्टर", "धेरै धारा/स्रोतको पानी", "निश्चित छैन"] },
    drainage: { en: ["PVC/uPVC drain or trap", "GI/metal sewer line", "Vent/trap seal concern", "Not sure / not visible"], ne: ["PVC/uPVC नाली वा ट्र्याप", "GI/धातुको ढल पाइप", "भेन्ट/ट्र्यापको पानीको तह", "थाहा छैन वा देखिँदैन"] },
    fixture: { en: ["Flush mechanism", "Mixer cartridge", "Shower diverter valve", "Not sure"], ne: ["फ्लस मेकानिजम", "मिक्सर कार्ट्रिज", "शावर डाइभर्टर भल्भ", "निश्चित छैन"] },
    heater: { en: ["Solar PRV/relief outlet", "Gas ignition/diaphragm", "Geyser or solar pipe connection", "Not sure"], ne: ["सोलार PRV/रिलिफ निकास", "ग्यास इग्निसन/डायाफ्राम", "गिजर वा सोलार पाइप जोड", "निश्चित छैन"] },
    protection: { en: ["Thermal/load-related trip pattern", "Immediate trip pattern", "Dampness-related trip already observed", "Not sure; do not reset or inspect"] , ne: ["ताप/भारसँग सम्बन्धित ट्रिप", "तुरुन्त ट्रिप हुने अवस्था", "पहिलेबाट देखिएको ओससँगको ट्रिप", "निश्चित छैन; रिसेट वा जाँच नगर्नुहोस्"] },
    distribution: { en: ["Loose-terminal concern", "Busbar concern", "Burnt/discoloured faceplate nearby", "Not sure; keep away"], ne: ["टर्मिनल खुकुलो भएको आशङ्का", "बसबारसम्बन्धी आशङ्का", "नजिकै जलेको/रङ बदलिएको कभर", "निश्चित छैन; टाढा रहनुहोस्"] },
    supply: { en: ["Low/dropped supply", "Fluctuating supply", "Phase imbalance suspected from existing symptoms", "Not sure; never measure live voltage"], ne: ["कम/घटेको आपूर्ति", "घटबढ हुने आपूर्ति", "पहिलेका लक्षणबाट फेज असन्तुलनको आशङ्का", "निश्चित छैन; करेन्ट भएको भोल्टेज ननाप्नुहोस्"] },
    wiring: { en: ["Burnt socket/switch faceplate", "Neutral/earth symptom", "Heavy-load connection", "Not sure; do not touch"] , ne: ["जलेको सकेट/स्विच कभर", "न्युट्रल/अर्थ लक्षण", "धेरै भारको जडान", "निश्चित छैन; नछुनुहोस्"] },
    "backup-power": { en: ["Automatic changeover", "Manual transfer", "Backfeed/transfer concern already observed", "Not sure; do not open"] , ne: ["स्वचालित चेन्जओभर", "म्यानुअल ट्रान्सफर", "पहिलेबाट देखिएको ब्याकफिड/ट्रान्सफर समस्या", "निश्चित छैन; नखोल्नुहोस्"] },
    controls: { en: ["Tank level sensor", "Pump control or motor starter", "Corrosion on exposed sensor/control", "Not sure; do not touch"] , ne: ["ट्याङ्की लेभल सेन्सर", "पम्प नियन्त्रण वा मोटर स्टार्टर", "देखिने सेन्सर/नियन्त्रणमा खिया", "निश्चित छैन; नछुनुहोस्"] },
  };
  const step = plan[index]!;
  if (step === "symptom") {
    const targeted: Record<string, { en: FaultQuestion; ne: FaultQuestion }> = {
      "PL-PPR-FUSION-JOINT-LEAK": { en: { prompt: "At the suspected PPR fusion joint, where does water first appear? Do not touch or dismantle it.", choices: ["Around the fused socket/bead", "Along the pipe body", "Only when the line is pressurized", "Not sure; keep the area as-is"] }, ne: { prompt: "शङ्कास्पद PPR जोडमा पानी पहिलो पटक कहाँ देखिन्छ? नछुनुहोस् वा नखोल्नुहोस्।", choices: ["फ्युजन जोड/बिडको वरिपरि", "पाइपको बीचमा", "लाइनमा चाप हुँदा मात्र", "निश्चित छैन; अहिलेको अवस्थामै छोड्नुहोस्"] } },
      "PL-GI-THREADED-CORROSION-LEAK": { en: { prompt: "What is visible around the GI threaded connection? Do not scrape rust or tighten it.", choices: ["Moisture at the threaded coupling", "Rust or scaling on the pipe body", "Water appears only during supply", "Not sure"] }, ne: { prompt: "GI थ्रेडेड जोड वरिपरि के देखिन्छ? खिया नखोतल्नुहोस् वा कस्ने प्रयास नगर्नुहोस्।", choices: ["थ्रेडेड कपलिङमा ओस", "पाइपमा खिया वा पत्र", "आपूर्ति हुँदा मात्र पानी", "निश्चित छैन"] } },
      "PL-PVC-SOLVENT-WELD-LEAK": { en: { prompt: "At the PVC/uPVC solvent-weld line, where is the wetness visible? Do not handle the joint.", choices: ["At the glued socket edge", "On the pipe body", "At another nearby fitting", "Not sure"] }, ne: { prompt: "PVC/uPVC सोल्भेन्ट-जोडिएको पाइपमा ओस कहाँ देखिन्छ? जोड नचलाउनुहोस्।", choices: ["ग्लु गरिएको सकेटको किनारमा", "पाइपको बीचमा", "नजिकको अर्को फिटिङमा", "निश्चित छैन"] } },
      "EL-MCB-THERMAL-SHORT-TRIP": { en: { prompt: "What had already happened immediately before the MCB tripped? Do not reset it or open the panel.", choices: ["A high-load appliance was being used", "It tripped immediately when power returned", "There was a spark, burning smell, or heat", "Not sure; leave the breaker off"] }, ne: { prompt: "MCB ट्रिप हुनुअघि के भइरहेको थियो? रिसेट वा प्यानल नखोल्नुहोस्।", choices: ["धेरै भारको उपकरण चलिरहेको थियो", "बिजुली आएलगत्तै ट्रिप भयो", "झिल्का, जलेको गन्ध वा ताप देखियो", "निश्चित छैन; ब्रेकर बन्द नै छोड्नुहोस्"] } },
      "EL-RCCB-NUISANCE-TRIP": { en: { prompt: "When was the RCCB/RCD trip first noticed? Do not reset it to test.", choices: ["During normal use of one appliance", "After rain or dampness was noticed", "Without a clear appliance or weather pattern", "Not sure; leave it off"] }, ne: { prompt: "RCCB/RCD ट्रिप भएको कुन अवस्थामा देखियो? जाँच्न रिसेट नगर्नुहोस्।", choices: ["एउटा उपकरण सामान्य रूपमा चलाउँदा", "वर्षा वा ओस देखिएपछि", "उपकरण वा मौसमसँग स्पष्ट सम्बन्ध नभई", "निश्चित छैन; बन्द नै छोड्नुहोस्"] } },
      "EL-PHASE-VOLTAGE-DROP": { en: { prompt: "Based only on normal use, what changed when the voltage seemed low? Do not measure or test live wiring.", choices: ["Lights dimmed across several rooms", "A motor/pump struggled or stopped", "Only one appliance behaved abnormally", "Not sure"] }, ne: { prompt: "सामान्य प्रयोगमा भोल्टेज कम हुँदा के परिवर्तन देखियो? भोल्टेज ननाप्नुहोस् वा तार नजाँच्नुहोस्।", choices: ["धेरै कोठाका बत्ती मधुरो भए", "मोटर/पम्प कमजोर भयो वा रोकियो", "एउटा उपकरण मात्र असामान्य भयो", "निश्चित छैन"] } },
      "EL-BURNT-OUTLET-HEAVY-LOAD": { en: { prompt: "From a safe distance, what is the clearest sign at the socket or switch? Do not touch or unplug it.", choices: ["Brown/black marks or melted plastic", "Heat or burning smell", "The issue occurs with one heavy-load appliance", "Not sure; keep away"] }, ne: { prompt: "सुरक्षित दूरीबाट सकेट वा स्विचमा सबैभन्दा स्पष्ट संकेत के छ? नछुनुहोस् वा प्लग ननिकाल्नुहोस्।", choices: ["खैरो/कालो दाग वा पग्लिएको प्लास्टिक", "ताप वा जलेको गन्ध", "एउटा धेरै भारको उपकरण चलाउँदा समस्या", "निश्चित छैन; टाढा रहनुहोस्"] } },
    };
    const targetedQuestion = faultCode ? targeted[faultCode] : undefined;
    if (targetedQuestion) return en ? targetedQuestion.en : targetedQuestion.ne;
    if (issueId === "tap-leak") return en ? { prompt: "Where do you first observe the leak?", choices: ["Tap spout", "Tap base", "Visible under-sink joint", "Hidden / not sure"] } : { prompt: "चुहावट पहिलो पटक कहाँ देखिन्छ?", choices: ["धाराको मुख", "धाराको फेद", "सिङ्कमुनिको देखिने जोड", "लुकेको ठाउँ वा निश्चित छैन"] };
    if (issueId === "pipe-leak" || issueId === "seepage") return en ? { prompt: "Where is moisture or water visible? Do not open a wall or floor.", choices: ["At a visible pipe joint", "On the pipe body", "On a wall/slab without an exposed pipe", "Not sure"] } : { prompt: "पानी वा ओस कहाँ देखिन्छ? भित्ता वा भुइँ नखोल्नुहोस्।", choices: ["देखिने पाइपको जोडमा", "पाइपको बीचको भागमा", "खुला पाइप नभएको भित्ता/स्ल्याबमा", "निश्चित छैन"] };
    if (issueId === "blocked-drain" || issueId === "sewer-odor") return en ? { prompt: "Which drain symptom have you already noticed? Do not open a drain or use chemicals.", choices: ["Sink/basin drains slowly", "Floor trap or bathroom drain is blocked", "Recurring sewer odour / gurgling", "Other / not sure"] } : { prompt: "नालीमा पहिलेबाट कुन लक्षण देख्नुभएको छ? नाली नखोल्नुहोस् वा रसायन नहाल्नुहोस्।", choices: ["सिङ्क/बेसिनको पानी ढिलो बग्छ", "भुइँको ट्र्याप वा बाथरूम नाली थुनिएको छ", "ढलको गन्ध/गडगड आवाज दोहोरिन्छ", "अर्को वा निश्चित छैन"] };
    if (trade === "electrical" && issueId === "breaker-trip") return en ? { prompt: "What trip pattern have you already observed? Do not reset the breaker or recreate the fault.", choices: ["Trip follows an appliance already being used", "Trips immediately or with no clear load", "Trip has coincided with damp/rainy conditions", "Not sure; leave the panel alone"] } : { prompt: "ब्रेकर ट्रिप भएको कुन ढाँचा पहिलेबाट देख्नुभएको छ? रिसेट वा समस्या दोहोर्‍याएर नजाँच्नुहोस्।", choices: ["उपकरण चलिरहेको बेला ट्रिप हुन्छ", "तुरुन्त वा भार स्पष्ट नभई ट्रिप हुन्छ", "ओस/वर्षासँगै ट्रिप भएको देखिएको छ", "निश्चित छैन; प्यानल नछुनुहोस्"] };
    if (trade === "electrical" && issueId === "flicker") return en ? { prompt: "How widespread is the flicker based on what you have already seen? Do not measure voltage.", choices: ["One lamp or one known circuit", "Several rooms or multiple lights", "Other appliances also change or restart", "Not sure; do not test"] } : { prompt: "भोल्टेज ननापी, पहिलेबाट देखिएको झिम्काइ कति ठाउँमा छ?", choices: ["एउटा बत्ती वा थाहा भएको एउटा सर्किट", "धेरै कोठा वा धेरै बत्ती", "अन्य उपकरण पनि बदलिन्छन् वा बन्द/सुरु हुन्छन्", "निश्चित छैन; जाँच नगर्नुहोस्"] };
    if (trade === "electrical" && issueId === "hot-outlet") return en ? { prompt: "What have you noticed from a safe distance? Do not touch the outlet or unplug a hot/damaged plug.", choices: ["Faceplate is warm or discoloured", "Buzzing/crackling is audible", "A specific appliance is usually connected", "Not sure; keep away"] } : { prompt: "सुरक्षित दूरीबाट के देख्नुभएको छ? तातो वा बिग्रिएको सकेट/प्लग नछुनुहोस्।", choices: ["कभर तातो वा रङ बदलिएको छ", "भनभन वा चटचट आवाज आउँछ", "प्रायः एउटा निश्चित उपकरण जोडिएको हुन्छ", "निश्चित छैन; टाढा रहनुहोस्"] };
    if (trade === "plumbing" && issueId === "pump") return en ? { prompt: "Which water-pump symptom is already happening? Do not switch the pump on/off to test it.", choices: ["Pump runs but little or no water arrives", "Pump is silent or stops before delivery", "Pump repeatedly starts/stops or tank overflows", "Not sure; do not operate it"] } : { prompt: "पानीको पम्पमा पहिलेबाट कुन लक्षण देखिएको छ? जाँच्न पम्प नचलाउनुहोस्।", choices: ["पम्प चले पनि पानी कम वा आउँदैन", "पम्प नचलेको वा पानी आउनुअघि बन्द हुन्छ", "पम्प बारम्बार चल्छ/रोकिन्छ वा ट्याङ्की पोखिन्छ", "निश्चित छैन; नचलाउनुहोस्"] };
    if (trade === "plumbing" && ["low-pressure", "no-water", "intermittent-supply"].includes(issueId)) return en ? { prompt: "Where does the supply problem occur, based only on normal use? Do not operate valves or pumps to test.", choices: ["One tap or one fixture", "Several taps but not the whole home", "Most or all of the home", "Not sure; do not test"] } : { prompt: "सामान्य प्रयोगमा पानीको समस्या कहाँ देखिन्छ? जाँच्न भल्भ वा पम्प नचलाउनुहोस्।", choices: ["एउटा धारा वा फिक्स्चरमा", "धेरै धारामा तर पूरै घरमा होइन", "धेरैजसो वा पूरै घरमा", "निश्चित छैन; जाँच नगर्नुहोस्"] };
    if (trade === "electrical" && ["no-power", "voltage", "inverter", "appliance"].includes(issueId)) return en ? { prompt: "Which equipment or area is affected, based only on normal use? Do not open equipment or measure voltage.", choices: ["One known appliance", "One room or circuit", "Several rooms or whole-home supply", "Not sure; do not test"] } : { prompt: "सामान्य प्रयोगमा कुन उपकरण वा क्षेत्र प्रभावित छ? उपकरण नखोल्नुहोस् र भोल्टेज ननाप्नुहोस्।", choices: ["पहिलेबाट थाहा भएको एउटा उपकरण", "एउटा कोठा वा सर्किट", "धेरै कोठा वा पूरै घरको आपूर्ति", "निश्चित छैन; जाँच नगर्नुहोस्"] };
    return en ? { prompt: `Which ${trade} symptom best matches what you have already observed?`, choices: trade === "plumbing" ? ["Leak or dampness", "Low/interrupted water or water quality", "Pump, tank, fixture or heater", "Other / not sure"] : ["Breaker trip or power loss", "Dim/flicker or supply fluctuation", "Distribution board, socket, switch, appliance or backup power", "Other / not sure"] } : { prompt: trade === "plumbing" ? "तपाईंले देख्नुभएको लक्षण कुनसँग बढी मिल्छ?" : "तपाईंले देख्नुभएको विद्युतीय लक्षण कुनसँग बढी मिल्छ?", choices: trade === "plumbing" ? ["चुहावट वा ओस", "कम/अनियमित पानी वा पानीको गुणस्तर", "पम्प, ट्याङ्की, फिक्स्चर वा हिटर", "अर्को वा निश्चित छैन"] : ["ब्रेकर ट्रिप वा बिजुली बन्द", "बत्ती मधुरो वा झिम्किने", "बोर्ड, सकेट, स्विच, उपकरण वा ब्याकअप बिजुली", "अर्को वा निश्चित छैन"] };
  }
  if (step === "component") {
    const issueChoices = issueId === "tap-leak"
      ? { en: ["Tap spout/internal valve", "Tap base", "Under-sink connector", "Other / not sure"], ne: ["धाराको मुख/भित्री भल्भ", "धाराको फेद", "सिङ्कमुनिको कनेक्टर", "अर्को वा निश्चित छैन"] }
      : issueId === "pipe-leak"
        ? { en: ["Visible joint/fitting", "Pipe body", "Concealed wall/slab line", "Other / not sure"], ne: ["देखिने जोड/फिटिङ", "पाइपको बीचको भाग", "लुकेको भित्ता/स्ल्याब पाइप", "अर्को वा निश्चित छैन"] }
        : null;
    const choices = issueChoices ?? componentOptions[node?.group ?? ""] ?? (trade === "plumbing" ? { en: ["Tap/fixture", "Supply pipe/joint", "Pump/tank/heater", "Other / not sure"], ne: ["धारा/फिक्स्चर", "आपूर्ति पाइप/जोड", "पम्प/ट्याङ्की/हिटर", "अर्को वा निश्चित छैन"] } : { en: ["Breaker/protection", "Socket/wiring", "Supply/inverter/appliance", "Other / not sure; do not touch"], ne: ["ब्रेकर/सुरक्षा उपकरण", "सकेट/तार", "आपूर्ति/इन्भर्टर/उपकरण", "अर्को वा निश्चित छैन; नछुनुहोस्"] });
    const narrowed = node?.group === "pipe" && previousAnswers[0] === 2
      ? (en ? "Since the wet patch has no exposed pipe, which visible area best matches it? Do not open a wall or floor." : "खुला पाइप नभएको ओसको दागका लागि, देखिएको कुन क्षेत्र बढी मिल्छ? भित्ता वा भुइँ नखोल्नुहोस्।")
      : node?.group === "protection" && previousAnswers[0] === 0
        ? (en ? "For the trip pattern you selected, which protection device label is already known? Do not inspect the panel." : "तपाईंले छानेको ट्रिप ढाँचामा, पहिलेबाट थाहा भएको सुरक्षा उपकरणको लेबल कुन हो? प्यानल नजाँच्नुहोस्।")
        : node?.group === "wiring" && previousAnswers[0] === 2
          ? (en ? "For the outlet/appliance symptom you selected, which part is involved based only on what you can see from a safe distance?" : "सकेट/उपकरणसम्बन्धी छानिएको लक्षणमा, सुरक्षित दूरीबाट देखिने कुन भाग प्रभावित छ?")
          : null;
    return en ? { prompt: narrowed ?? "Which component or sub-component is involved, based only on what you can already see or know? Do not touch or open anything.", choices: choices.en } : { prompt: narrowed ?? "पहिलेबाट देखिएको वा थाहा भएको कुन भाग प्रभावित छ? केही नछुनुहोस् वा नखोल्नुहोस्।", choices: choices.ne };
  }
  if (step === "material") {
    const choices = materialOptions[node?.group ?? ""] ?? (trade === "plumbing" ? { en: ["PPR/plastic", "GI/metal", "PVC/uPVC", "Not visible / not sure"] , ne: ["PPR/प्लास्टिक", "GI/धातु", "PVC/uPVC", "देखिँदैन वा निश्चित छैन"] } : { en: ["MCB/RCCB label already known", "Socket/switch type already known", "UPS/inverter type already known", "Not known; do not inspect"] , ne: ["पहिलेबाट थाहा भएको MCB/RCCB लेबल", "पहिलेबाट थाहा भएको सकेट/स्विच प्रकार", "पहिलेबाट थाहा भएको UPS/इन्भर्टर प्रकार", "थाहा छैन; जाँच नगर्नुहोस्"] });
    const materialPrompt = node?.group === "pipe" && previousAnswers[1] === 2
      ? (en ? "The line is concealed. Is its pipe material already known from records or prior work? Do not expose it." : "पाइप लुकेको छ। पुरानो अभिलेख वा कामबाट यसको सामग्री पहिले नै थाहा छ? खोल्ने काम नगर्नुहोस्।")
      : trade === "electrical"
        ? (en ? "Which device/type is already known from its label or normal use? Do not open a cover or inspect live wiring." : "लेबल वा सामान्य प्रयोगबाट पहिले नै थाहा भएको उपकरण/प्रकार कुन हो? कभर नखोल्नुहोस् वा तार नजाँच्नुहोस्।")
        : (en ? "Which pipe or fitting material is already known? Do not scrape, uncover, or dismantle it." : "पहिलेबाट थाहा भएको पाइप वा फिटिङको सामग्री कुन हो? नखोतल्नुहोस् वा खोल्नुहोस्।");
    return { prompt: materialPrompt, choices: en ? choices.en : choices.ne };
  }
  if (step === "pressure") return en ? { prompt: trade === "plumbing" ? "What water-flow pattern have you already noticed? Do not operate valves or pumps to test." : "What power pattern have you already noticed? Do not measure voltage or recreate the fault.", choices: trade === "plumbing" ? ["Only while supply/pump is running", "Only while a fixture drains", "At other times too", "Cannot tell; do not test"] : ["One known appliance", "Several rooms or whole home", "Only when backup supply is active", "Cannot tell; do not measure"] } : { prompt: trade === "plumbing" ? "पानीको बहावमा पहिलेबाट कस्तो अवस्था देख्नुभएको छ? जाँच्न भल्भ वा पम्प नचलाउनुहोस्।" : "बिजुलीमा पहिलेबाट कस्तो अवस्था देख्नुभएको छ? भोल्टेज ननाप्नुहोस् वा समस्या दोहोर्‍याएर नजाँच्नुहोस्।", choices: trade === "plumbing" ? ["आपूर्ति/पम्प चलेको बेला मात्र", "फिक्स्चरबाट पानी नालीमा बग्दा मात्र", "अन्य समयमा पनि", "थाहा छैन; जाँच नगर्नुहोस्"] : ["पहिलेबाट थाहा भएको एउटा उपकरण", "धेरै कोठा वा पूरै घर", "ब्याकअप आपूर्ति चलेको बेला मात्र", "थाहा छैन; ननाप्नुहोस्"] };
  if (step === "duration") return en ? { prompt: "How often and for how long has this been happening?", choices: ["Started today / once", "Repeats occasionally", "Frequent or ongoing", "Not sure"] } : { prompt: "यो समस्या कति पटक र कति समयदेखि भइरहेको छ?", choices: ["आज सुरु भयो/एक पटक", "बीचबीचमा दोहोरिन्छ", "बारम्बार वा निरन्तर", "निश्चित छैन"] };
  if (step === "environment") return en ? { prompt: "What condition has been present when it occurs? Do not recreate the issue.", choices: trade === "plumbing" ? ["After supply resumes", "After stored-tank use", "Rain/damp conditions", "No clear pattern / not sure"] : ["A heavy-load appliance was already running", "Damp/rainy conditions", "Only on backup supply", "No clear pattern / not sure"] } : { prompt: "समस्या हुँदा कुन अवस्था पहिलेबाट देखिएको छ? जाँच्न समस्या नदोहोर्‍याउनुहोस्।", choices: trade === "plumbing" ? ["आपूर्ति फेरि आएपछि", "भण्डारण ट्याङ्की प्रयोगपछि", "वर्षा/ओस भएको बेला", "स्पष्ट ढाँचा छैन/निश्चित छैन"] : ["धेरै भारको उपकरण पहिलेबाट चलेको थियो", "ओस/वर्षा भएको बेला", "ब्याकअप आपूर्तिमा मात्र", "स्पष्ट ढाँचा छैन/निश्चित छैन"] };
  return en ? { prompt: "How severe or widespread is the problem so far? Do not recreate the fault.", choices: ["One point; now stopped", "Recurring or worsening", "Several areas affected / major water or power impact", "Not sure"] } : { prompt: "अहिलेसम्म समस्या कति गम्भीर वा फैलिएको छ? जाँच्न समस्या फेरि नदोहोर्‍याउनुहोस्।", choices: ["एउटा ठाउँमा सीमित; अहिले रोकिएको", "दोहोरिन्छ वा बढ्दै गएको", "धेरै ठाउँ प्रभावित/सेवामा ठूलो असर", "निश्चित छैन"] };
}

export function resolveHomeFaultCode(trade: FaultTrade, issueId: string, answers: number[], faultCode?: string): string | null {
  if (answers.length < 3 || answers.length > 7 || answers.some(answer => answer < 0 || answer > 3)) return null;
  if (answers.includes(3)) return trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
  const node = HOME_FAULT_TREE.find(item => item.code === faultCode && item.trade === trade);
  if (node) {
    const component = answers[1]!;
    const type = answers[2]!;
    const symptomChoice = answers[0]!;
    const expectedSymptom: Record<string, number> = { pump: 2, tank: 2, fixture: 2, heater: 2, "water-quality": 1, drainage: 1, protection: 0, distribution: 2, supply: 1, wiring: 2, "backup-power": 2, controls: 2 };
    const expectedChoice = node.code === "PL-SEWER-GAS-ODOR" ? 2 : node.group === "drainage" ? undefined : expectedSymptom[node.group];
    if (expectedChoice !== undefined && expectedChoice !== symptomChoice) return trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
    const routeByGroup: Record<string, string | null> = {
      pipe: node.code === "PL-SEEPAGE-DAMPNESS" && component === 2 ? node.code : component === 2 && symptomChoice === 2 ? "PL-CONCEALED-WALL-SLAB-LEAK"
        : component === 0 && symptomChoice === 0 ? ["PL-PPR-FUSION-JOINT-LEAK", "PL-GI-THREADED-CORROSION-LEAK", "PL-PVC-SOLVENT-WELD-LEAK"][type] ?? null
          : null,
      pump: component === 0 && type === 0 ? "PL-SUBMERSIBLE-PUMP-MOTOR-FAULT" : component === 1 && type === 1 ? "PL-BOOSTER-PUMP-SHORT-CYCLE" : component === 2 && type === 2 ? "PL-TANK-FLOAT-VALVE-OVERFLOW" : null,
      tank: component === 0 && type === 0 ? "PL-TANK-FLOAT-VALVE-OVERFLOW" : null,
      "water-quality": component === 0 && type === 0 ? "PL-SUMP-CONTAMINATION" : component === 1 && type === 1 ? "PL-RO-MEMBRANE-FOULING" : null,
      fixture: component === 0 && type === 0 ? (node.code === "PL-FLUSH-MECHANISM-FAULT" ? node.code : "PL-DUAL-FLUSH-CISTERN-FAULT") : component === 1 && type === 1 ? "PL-MIXER-CARTRIDGE-WEAR" : component === 2 && type === 2 ? "PL-CONCEALED-DIVERTER-VALVE" : null,
      heater: component === 0 && type === 0 ? "PL-SOLAR-PRV-DISCHARGE" : component === 1 && type === 1 ? "PL-GAS-GEYSER-IGNITION-DIAPHRAGM" : component === 2 && type === 2 ? "PL-SOLAR-GEYSER-PIPE-LEAK" : null,
      protection: component === 0 && type < 2 ? (node.code === "EL-MCB-RCCB-TRIPPING" ? node.code : "EL-MCB-THERMAL-SHORT-TRIP") : component === 1 ? "EL-RCCB-NUISANCE-TRIP" : null,
      distribution: component === 0 && type < 2 ? (node.code === "EL-MAIN-DB-SPARKING" ? node.code : "EL-DB-BUSBAR-LOOSE-TERMINAL") : null,
      supply: component < 3 && type < 3 ? (node.code === "EL-FLOATING-NEUTRAL" || node.code === "EL-REGULATOR-LIGHT-FLICKER" ? node.code : "EL-PHASE-VOLTAGE-DROP") : null,
      wiring: component === 0 && type === 0 ? (node.code === "EL-BURNING-WIRE-SMELL" ? node.code : "EL-BURNT-OUTLET-HEAVY-LOAD") : component === 1 && type === 1 ? (node.code === "EL-ELECTRIC-SHOCK-EARTHING" ? node.code : "EL-NEUTRAL-EARTH-LEAKAGE") : component === 2 && type === 2 ? "EL-BURNT-OUTLET-HEAVY-LOAD" : null,
      "backup-power": component < 3 && type < 3 ? (node.code === "EL-INVERTER-BYPASS-SWITCH" ? node.code : "EL-UPS-CHANGEOVER-WIRING") : null,
      controls: component === 0 && type === 0 ? "EL-WATER-LEVEL-SENSOR-CORROSION" : component === 1 && type === 1 ? "EL-MOTOR-STARTER-FAULT" : null,
      drainage: component < 3 && type < 3 ? node.code : null,
    };
    const resolved = routeByGroup[node.group];
    return resolved && HOME_FAULT_TREE.some(item => item.code === resolved && item.trade === trade) ? resolved : (trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION");
  }
  if (trade === "electrical") return "EL-SITE-INSPECTION";
  if (issueId === "tap-leak") {
    if (answers[0] === 0 && answers[1] === 0) return "PL-TAP-CLOSURE-LEAK";
    if (answers[0] === 1 && answers[1] === 1) return "PL-TAP-BASE-LEAK";
    if (answers[0] === 2 && answers[1] === 2) return "PL-UNDER-SINK-JOINT-LEAK";
  }
  if (issueId === "pipe-leak") {
    if (answers[0] === 2 && answers[1] === 2) return "PL-CONCEALED-WALL-SLAB-LEAK";
    if (answers[0] === 0 && answers[1] === 0 && answers[2] === 0) return "PL-PPR-FUSION-JOINT-LEAK";
    if (answers[0] === 0 && answers[1] === 0 && answers[2] === 1) return "PL-GI-THREADED-CORROSION-LEAK";
    if (answers[0] === 0 && answers[1] === 0 && answers[2] === 2) return "PL-PVC-SOLVENT-WELD-LEAK";
    if (answers[0] === 1 && answers[1] === 1) return "PL-EXPOSED-PIPE-LEAK";
  }
  return trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
}

export function faultServiceId(code: string): string | null {
  const node = HOME_FAULT_TREE.find(item => item.code === code);
  if (node) return node.serviceId;
  if (code === "PL-ONSITE-INSPECTION") return "pipe-fitting";
  if (code === "EL-ONSITE-INSPECTION" || code === "EL-SITE-INSPECTION") return "electrical-wiring";
  if (/^PL-TAP-(CLOSURE|BASE)-LEAK$/.test(code)) return "sink-leak";
  if (/^PL-(UNDER-SINK-JOINT|EXPOSED-JOINT|EXPOSED-PIPE)-LEAK$/.test(code)) return "pipe-fitting";
  return null;
}
