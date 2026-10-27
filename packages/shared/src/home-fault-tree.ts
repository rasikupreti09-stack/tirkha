export type FaultTrade = "plumbing" | "electrical";
export const HOME_FAULT_TREE = [
  { code: "PL-PPR-FUSION-JOINT-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "PPR thermal-fusion joint leak", serviceId: "pipe-fitting", patterns: [/\bppr\b.*\b(fusion|joint|leak|leaking|chuh)/i, /\b(fusion|welded)\s+joint\b/i] },
  { code: "PL-GI-THREADED-CORROSION-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "GI threaded-pipe corrosion or thread leak", serviceId: "pipe-fitting", patterns: [/\bgi\b.*\b(thread|corrod|rust|leak)/i, /\b(threaded|galvanized|galvanised|iron)\s+pipe\b.*\b(corrod|rust|leak)/i] },
  { code: "PL-PVC-SOLVENT-WELD-LEAK", issueId: "pipe-leak", trade: "plumbing", group: "pipe", title: "PVC/uPVC solvent-weld leak", serviceId: "pipe-fitting", patterns: [/\b(u?pvc|pvc)\b.*\b(solvent|weld|joint|leak)/i, /\b(solvent[- ]weld|glued\s+joint)\b/i] },
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
  { code: "EL-MCB-THERMAL-SHORT-TRIP", issueId: "breaker-trip", trade: "electrical", group: "protection", title: "MCB thermal or short-circuit trip concern", serviceId: "electrical-wiring", patterns: [/\bmcb\b.*\b(trip|hot|thermal|short|keeps?\s+off)/i, /\b(short\s*circuit|thermal\s+trip|breaker\s+trips?)\b/i] },
  { code: "EL-RCCB-NUISANCE-TRIP", issueId: "breaker-trip", trade: "electrical", group: "protection", title: "RCCB/RCD/ELCB repeated-trip concern", serviceId: "electrical-wiring", patterns: [/\b(rccb|rcd|elcb)\b.*\b(trip|nuisance|keeps?\s+off)/i, /\b(residual\s+current|earth\s+leakage)\b.*\b(trip|breaker)/i] },
  { code: "EL-DB-BUSBAR-LOOSE-TERMINAL", issueId: "hot-outlet", trade: "electrical", group: "distribution", title: "Distribution-board busbar or terminal concern", serviceId: "electrical-wiring", patterns: [/\b(busbar|bus\s+bar|distribution\s+board\s+terminal)\b.*\b(loose|hot|burn|spark|buzz)/i] },
  { code: "EL-PHASE-VOLTAGE-DROP", issueId: "voltage", trade: "electrical", group: "supply", title: "Possible phase-voltage drop or fluctuation", serviceId: "electrical-wiring", patterns: [/\b(phase|voltage|power)\b.*\b(drop|fluctuat|unstable|low|high)/i, /\b(single\s+phase|three\s+phase)\b.*\b(weak|drop|fluctuat)/i] },
  { code: "EL-BURNT-OUTLET-HEAVY-LOAD", issueId: "hot-outlet", trade: "electrical", group: "wiring", title: "Outlet or switch thermal-damage concern under load", serviceId: "electrical-wiring", patterns: [/\b(socket|outlet|switch)\b.*\b(burn|black|melt|hot|heavy\s+load)/i, /\b(burnt|burned|melted)\s+(socket|outlet|switch|plug)/i] },
  { code: "EL-UPS-CHANGEOVER-WIRING", issueId: "inverter", trade: "electrical", group: "backup-power", title: "Inverter/UPS changeover wiring concern", serviceId: "electrical-wiring", patterns: [/\b(inverter|ups|backup)\b.*\b(changeover|backfeed|transfer|switching)/i, /\b(changeover)\b.*\b(inverter|ups|wiring)/i] },
  { code: "EL-NEUTRAL-EARTH-LEAKAGE", issueId: "earthing", trade: "electrical", group: "wiring", title: "Possible neutral-to-earth leakage concern", serviceId: "electrical-wiring", patterns: [/\b(neutral)\b.*\b(earth|ground)\b.*\b(leak|voltage|current|tingle)/i, /\b(earth|ground)\b.*\b(leakage|tingle|current)/i] },
  { code: "EL-WATER-LEVEL-SENSOR-CORROSION", issueId: "appliance", trade: "electrical", group: "controls", title: "Water-level sensor or control wiring corrosion concern", serviceId: "electrical-wiring", patterns: [/\b(water\s+level|tank\s+level)\b.*\b(sensor|probe|corrod|rust|fault)/i, /\b(sensor|probe)\b.*\b(corrod|rust|tank\s+level)/i] },
] as const;
export type HomeFaultNode = (typeof HOME_FAULT_TREE)[number];
export type HomeFaultCode = HomeFaultNode["code"];
export function matchHomeFault(text: string): HomeFaultNode | null {
  const normalized = text.toLocaleLowerCase("ne-NP").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  return HOME_FAULT_TREE.find(node => node.patterns.some(pattern => pattern.test(normalized))) ?? null;
}

export type FaultQuestion = { prompt: string; choices: string[] };
export function faultTreeQuestion(trade: FaultTrade, issueId: string, index: number, language: "english" | "nepali_devanagari" | "nepali_romanized", faultCode?: string): FaultQuestion | null {
  if (!Number.isInteger(index) || index < 0 || index > 2) return null;
  const en = language === "english";
  if (index === 0) {
    if (issueId === "tap-leak") return en ? { prompt: "Where do you first observe the leak?", choices: ["Tap spout", "Tap base", "Visible under-sink joint", "Hidden / not sure"] } : { prompt: "चुहावट पहिलो पटक कहाँ देखिन्छ?", choices: ["धाराको मुख", "धाराको फेद", "सिङ्कमुनिको देखिने जोड", "लुकेको ठाउँ वा निश्चित छैन"] };
    if (issueId === "pipe-leak") return en ? { prompt: "Where is moisture or water visible? Do not open a wall or floor.", choices: ["At a visible pipe joint", "On the pipe body", "On a wall/slab without an exposed pipe", "Not sure"] } : { prompt: "पानी वा ओस कहाँ देखिन्छ? भित्ता वा भुइँ नखोल्नुहोस्।", choices: ["देखिने पाइपको जोडमा", "पाइपको बीचको भागमा", "पाइप नदेखिने भित्ता/स्ल्याबमा", "निश्चित छैन"] };
    return en ? { prompt: trade === "plumbing" ? "Which symptom best matches what you have already observed?" : "Which electrical symptom best matches what you have already observed?", choices: trade === "plumbing" ? ["Leak or dampness", "Low/interrupted water or water quality", "Pump, tank, fixture or heater", "Other / not sure"] : ["Breaker trip or power loss", "Dim/flicker or supply fluctuation", "Distribution board, socket, switch, appliance or backup power", "Other / not sure"] } : { prompt: trade === "plumbing" ? "तपाईंले देख्नुभएको लक्षण कुनसँग बढी मिल्छ?" : "तपाईंले देख्नुभएको विद्युतीय लक्षण कुनसँग बढी मिल्छ?", choices: trade === "plumbing" ? ["चुहावट वा ओस", "कम/अनियमित पानी वा पानीको गुणस्तर", "पम्प, ट्याङ्की, फिक्स्चर वा हिटर", "अर्को समस्या वा निश्चित छैन"] : ["ब्रेकर ट्रिप वा बिजुली बन्द", "बत्ती मधुरो वा झिम्किने", "सकेट, स्विच, उपकरण वा ब्याकअप बिजुली", "अर्को समस्या वा निश्चित छैन"] };
  }
  const node = HOME_FAULT_TREE.find(item => item.code === faultCode);
  if (index === 1) {
    const group = node?.group;
    const groups: Record<string, { en: string[]; ne: string[] }> = {
      pipe: { en: ["PPR fused joint", "GI threaded section", "PVC/uPVC solvent weld", "Concealed / not sure"], ne: ["PPR फ्युजन जोड", "GI थ्रेडेड भाग", "PVC/uPVC सोल्भेन्ट जोड", "लुकेको भाग वा निश्चित छैन"] },
      pump: { en: ["Submersible/well pump", "Booster pump", "Tank float/control", "Not sure"], ne: ["सबमर्सिबल/इनार पम्प", "बुस्टर पम्प", "ट्याङ्की फ्लोट/नियन्त्रण", "निश्चित छैन"] },
      tank: { en: ["Float valve", "Overflow pipe", "Level sensor/control", "Not sure"], ne: ["फ्लोट भल्भ", "ओभरफ्लो पाइप", "लेभल सेन्सर/नियन्त्रण", "निश्चित छैन"] },
      "water-quality": { en: ["Sump/stored water", "RO output", "Several supply taps", "Not sure"], ne: ["सम्प/भण्डारण पानी", "RO आउटपुट", "धेरै आपूर्ति धारा", "निश्चित छैन"] },
      fixture: { en: ["Dual-flush cistern", "Basin/shower mixer", "Tap/connector", "Not sure"], ne: ["डुअल-फ्लस सिस्टर्न", "बेसिन/शावर मिक्सर", "धारा/कनेक्टर", "निश्चित छैन"] },
      heater: { en: ["Solar heater PRV", "Instant gas geyser", "Another water heater", "Not sure"], ne: ["सोलार हिटर PRV", "इन्स्ट्यान्ट ग्यास गिजर", "अर्को पानी हिटर", "निश्चित छैन"] },
      protection: { en: ["MCB", "RCCB/RCD/ELCB", "Both/another device", "Unknown; do not inspect panel"], ne: ["MCB", "RCCB/RCD/ELCB", "दुवै/अर्को उपकरण", "थाहा छैन; प्यानल नजाँच्नुहोस्"] },
      distribution: { en: ["Power loss/trip", "Buzzing", "Visible heat/discoloration", "Not sure; keep away"], ne: ["बिजुली बन्द/ट्रिप", "भनभन आवाज", "पहिलेबाट देखिएको ताप/रङ परिवर्तन", "निश्चित छैन; टाढा रहनुहोस्"] },
      supply: { en: ["One appliance", "Several rooms", "Whole-home supply changes", "Not sure; never measure live voltage"], ne: ["एउटा उपकरण", "धेरै कोठा", "घरभरि आपूर्ति बदलिन्छ", "निश्चित छैन; भोल्टेज ननाप्नुहोस्"] },
      wiring: { en: ["Socket/outlet/switch", "Neutral-earth concern", "Heavy-load appliance connection", "Not sure; do not touch"], ne: ["सकेट/आउटलेट/स्विच", "न्युट्रल-अर्थ समस्या", "धेरै भारको उपकरण जडान", "निश्चित छैन; नछुनुहोस्"] },
      "backup-power": { en: ["UPS/inverter changeover", "Only fails on backup", "Circuit differs on backup", "Not sure; do not open equipment"], ne: ["UPS/इन्भर्टर चेन्जओभर", "ब्याकअपमा मात्र बन्द हुन्छ", "ब्याकअपमा सर्किट फरक चल्छ", "निश्चित छैन; उपकरण नखोल्नुहोस्"] },
      controls: { en: ["Tank level sensor", "Pump control wiring", "Visible corrosion", "Not sure; do not touch"], ne: ["ट्याङ्की लेभल सेन्सर", "पम्प नियन्त्रण तार", "देखिने खिया", "निश्चित छैन; नछुनुहोस्"] },
    };
    const options = groups[group ?? ""] ?? (trade === "plumbing" ? { en: ["Fixture/valve", "Pipe/joint", "Pump/tank/heater", "Not sure"], ne: ["फिक्स्चर/भल्भ", "पाइप/जोड", "पम्प/ट्याङ्की/हिटर", "निश्चित छैन"] } : { en: ["Breaker", "Socket/wiring", "Supply/inverter/appliance", "Not sure; do not touch"], ne: ["ब्रेकर", "सकेट/तार", "आपूर्ति/इन्भर्टर/उपकरण", "निश्चित छैन; नछुनुहोस्"] });
    return { prompt: en ? "Which component or material do you already know? Do not touch, open or move anything." : "कुन भाग वा सामग्री तपाईंलाई पहिलेबाट थाहा छ? केही नछुनुहोस्, नखोल्नुहोस् वा नसार्नुहोस्।", choices: en ? options.en : options.ne };
  }
  return en ? { prompt: "How severe or widespread is the problem so far? Do not recreate the fault.", choices: ["One point; now stopped", "Recurring or worsening", "Several areas affected / major water or power impact", "Not sure"] } : { prompt: "अहिलेसम्म समस्या कति गम्भीर वा फैलिएको छ? जाँच्न समस्या फेरि नदोहोर्‍याउनुहोस्।", choices: ["एउटा ठाउँमा सीमित; अहिले रोकिएको", "दोहोरिन्छ वा बढ्दै गएको", "धेरै ठाउँ प्रभावित / पानी वा बिजुलीमा ठूलो असर", "निश्चित छैन"] };
}
export function resolveHomeFaultCode(trade: FaultTrade, issueId: string, answers: number[], faultCode?: string): string | null {
  if (answers.length !== 3 || answers.some(answer => answer < 0 || answer > 3)) return null;
  if (answers.includes(3)) return trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
  const node = HOME_FAULT_TREE.find(item => item.code === faultCode && item.trade === trade);
  if (node) {
    const component = answers[1]!;
    const symptomChoice = answers[0]!;
    const expectedSymptom: Record<string, number> = { pump: 2, tank: 2, fixture: 2, heater: 2, "water-quality": 1, protection: 0, distribution: 2, supply: 1, wiring: 2, "backup-power": 2, controls: 2 };
    if (expectedSymptom[node.group] !== undefined && expectedSymptom[node.group] !== symptomChoice) return trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
    const byGroup: Record<string, Array<string | null>> = {
      pipe: ["PL-PPR-FUSION-JOINT-LEAK", "PL-GI-THREADED-CORROSION-LEAK", "PL-PVC-SOLVENT-WELD-LEAK", answers[0] === 2 ? "PL-CONCEALED-WALL-SLAB-LEAK" : null],
      pump: ["PL-SUBMERSIBLE-PUMP-MOTOR-FAULT", "PL-BOOSTER-PUMP-SHORT-CYCLE", "PL-TANK-FLOAT-VALVE-OVERFLOW", null],
      tank: ["PL-TANK-FLOAT-VALVE-OVERFLOW", null, null, null],
      "water-quality": ["PL-SUMP-CONTAMINATION", "PL-RO-MEMBRANE-FOULING", null, null],
      fixture: ["PL-DUAL-FLUSH-CISTERN-FAULT", "PL-MIXER-CARTRIDGE-WEAR", null, null],
      heater: ["PL-SOLAR-PRV-DISCHARGE", "PL-GAS-GEYSER-IGNITION-DIAPHRAGM", null, null],
      protection: ["EL-MCB-THERMAL-SHORT-TRIP", "EL-RCCB-NUISANCE-TRIP", null, null],
      distribution: [null, null, "EL-DB-BUSBAR-LOOSE-TERMINAL", null],
      supply: ["EL-PHASE-VOLTAGE-DROP", "EL-PHASE-VOLTAGE-DROP", "EL-PHASE-VOLTAGE-DROP", null],
      wiring: ["EL-BURNT-OUTLET-HEAVY-LOAD", "EL-NEUTRAL-EARTH-LEAKAGE", "EL-BURNT-OUTLET-HEAVY-LOAD", null],
      "backup-power": ["EL-UPS-CHANGEOVER-WIRING", "EL-UPS-CHANGEOVER-WIRING", "EL-UPS-CHANGEOVER-WIRING", null],
      controls: [null, null, "EL-WATER-LEVEL-SENSOR-CORROSION", null],
    };
    const resolved = byGroup[node.group]?.[component];
    return resolved && HOME_FAULT_TREE.some(item => item.code === resolved && item.trade === trade) ? resolved : (trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION");
  }
  if (trade === "electrical") return "EL-SITE-INSPECTION";
  if (issueId === "tap-leak" && answers[0] === 0) return answers[1] === 0 ? "PL-TAP-CLOSURE-LEAK" : "PL-TAP-BASE-LEAK";
  if (issueId === "pipe-leak") return answers[1] === 0 ? "PL-EXPOSED-JOINT-LEAK" : "PL-EXPOSED-PIPE-LEAK";
  return "PL-ONSITE-INSPECTION";
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
