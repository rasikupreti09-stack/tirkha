export type UniversalLanguage = "english" | "nepali_devanagari" | "nepali_romanized";
export type DiagnosticCatalogEntry = {
  id: string;
  title: string;
  category_slug: string;
  category_name: string;
  description?: string;
  keywords?: readonly string[];
};
export type DiagnosticTarget = { service: DiagnosticCatalogEntry; categorySlug: string; categoryName: string; score: number };
export type UniversalQuestion = { prompt: string; choices: string[] };

const ALIASES: Readonly<Record<string, string>> = {
  paani: "pani", paanee: "pani", pani: "pani", dharaa: "dhara", dhara: "dhara", leak: "leak", leek: "leak", leeking: "leaking",
  bijli: "bijuli", bijuli: "bijuli", batti: "light", bati: "light", dhal: "drain", dhaal: "drain", nali: "drain", fohor: "dirty",
  plumbng: "plumbing", pluming: "plumbing", plumbingg: "plumbing", elctrician: "electrician", electrcian: "electrician", electrican: "electrician",
  carpentery: "carpentry", furnitur: "furniture", machince: "machine", applience: "appliance", elecrical: "electrical", geyser: "geyser",
  bhairacha: "happening", bhairako: "happening", bhairaheko: "happening", chha: "is", cha: "is", chhaina: "not", chaina: "not", naako: "missing",
  aayena: "notcoming", aaena: "notcoming", bigryo: "broken", bigreko: "broken", chuhiyo: "leaking", chuhirako: "leaking", jaleyo: "burned",
  dukheko: "pain", awaz: "noise", awaj: "noise", garmi: "hot", gandha: "smell", mailo: "dirty", safa: "clean", safai: "cleaning",
  ghar: "home", kotha: "room", dhoka: "door", jhyal: "window", palang: "bed", kursi: "chair", chhat: "ceiling", bhitta: "wall",
};

const CATEGORY_TERMS: Readonly<Record<string, readonly string[]>> = {
  plumbing: ["plumbing", "plumber", "water", "pani", "dhara", "tap", "pipe", "leak", "drain", "dhal", "tank", "pump", "geyser", "toilet", "sewer", "नल", "धारा", "पानी", "पाइप", "ढल", "नाली"],
  electrical: ["electrical", "electrician", "electric", "power", "bijuli", "light", "batti", "wire", "spark", "mcb", "switch", "socket", "breaker", "voltage", "बिजुली", "बत्ती", "तार", "स्विच"],
  carpentry: ["carpentry", "carpenter", "furniture", "door", "window", "cabinet", "drawer", "hinge", "wood", "bed", "chair", "table", "काठ", "ढोका", "झ्याल", "फर्निचर"],
  appliance: ["appliance", "machine", "fridge", "refrigerator", "washing", "washer", "microwave", "induction", "oven", "geyser", "motor", "compressor", "उपकरण", "मेसिन"],
  masonry: ["masonry", "brick", "cement", "concrete", "plaster", "tile", "wall", "floor", "crack", "गारा", "इँटा", "सिमेन्ट", "टायल", "भित्ता"],
  solar: ["solar", "panel", "inverter", "battery", "charge", "सौर्य", "सोलार"],
  cleaning: ["cleaning", "cleaner", "maid", "deep clean", "dust", "stain", "sanitation", "सफाइ", "फोहोर"],
  painting: ["painting", "painter", "paint", "wall color", "peeling", "रङ", "पेन्ट"],
  medical: ["doctor", "medical", "nurse", "health", "physio", "physiotherapy", "pain", "दुखाइ", "डाक्टर", "नर्स"],
  beauty: ["beauty", "beautician", "salon", "spa", "makeup", "hair", "nail", "सौन्दर्य"],
  tutor: ["tutor", "tuition", "teacher", "class", "study", "homework", "ट्युसन", "शिक्षक"],
  astrology: ["astrologer", "astrology", "jyotish", "horoscope", "ज्योतिष"],
  pest: ["pest", "termite", "cockroach", "mosquito", "bedbug", "किरा"],
};

const DOMAIN_PROMPTS: Readonly<Record<string, { object: string; component: string; context: string; neObject: string; neComponent: string; neContext: string; romanObject: string; romanComponent: string; romanContext: string }>> = {
  plumbing: { object: "water outlet, pipe, drain, tank, or heater", component: "joint/fitting, pipe body, fixture, pump, or control", context: "Does it happen during supply, use, drainage, or tank/pump operation? Do not operate equipment to test.", neObject: "धारा, पाइप, नाली, ट्याङ्की वा हिटर", neComponent: "जोड/फिटिङ, पाइप, फिक्स्चर, पम्प वा नियन्त्रण भाग", neContext: "यो समस्या पानीको आपूर्ति, प्रयोग, निकास वा ट्याङ्की/पम्प चल्दा देखिन्छ? जाँच्न उपकरण नचलाउनुहोस्।", romanObject: "dhara, pipe, drain, tank, wa heater", romanComponent: "joint/fitting, pipe body, fixture, pump, wa control", romanContext: "Yo samasya pani supply, use, drain, wa tank/pump chalda dekhincha? Check garna equipment nachalaunu." },
  electrical: { object: "light, switch, socket, breaker, appliance, or circuit", component: "one device, one room/circuit, supply, or backup system", context: "Was a heavy-load appliance already running, or did the change affect several rooms? Do not touch/open anything or measure live voltage.", neObject: "बत्ती, स्विच, सकेट, ब्रेकर, उपकरण वा सर्किट", neComponent: "एउटा उपकरण, कोठा/सर्किट, मुख्य आपूर्ति वा ब्याकअप प्रणाली", neContext: "पहिलेदेखि धेरै भारको उपकरण चलिरहेको थियो, वा धेरै कोठा प्रभावित भए? केही नछुनुहोस्/नखोल्नुहोस् र करेन्ट भएको भोल्टेज ननाप्नुहोस्।", romanObject: "light, switch, socket, breaker, appliance, wa circuit", romanComponent: "euta device, room/circuit, supply, wa backup system", romanContext: "Heavy-load appliance chalirako thiyo, ki dherai room affect bhayo? Kehi nachhunu/nakholnu, live voltage namapnu." },
  carpentry: { object: "door, window, cabinet, drawer, bed, or other wooden fitting", component: "hinge/runner, joint, frame, panel, lock, or surface", context: "Does it fail while opening/closing, under load, or continuously? Do not force a jammed fitting.", neObject: "ढोका, झ्याल, क्याबिनेट, दराज, पलङ वा काठको फिटिङ", neComponent: "कब्जा/रनर, जोड, फ्रेम, प्यानल, ताल्चा वा सतह", neContext: "खोल्दा/बन्द गर्दा, भार पर्दा वा निरन्तर समस्या हुन्छ? अड्किएको सामान बलपूर्वक नचलाउनुहोस्।", romanObject: "dhoka, jhyal, cabinet, drawer, bed, wa wooden fitting", romanComponent: "hinge/runner, joint, frame, panel, lock, wa surface", romanContext: "Kholda/banda garda, load huda, ki continuously samasya huncha? Jam bhayeko fitting force nagarnu." },
  appliance: { object: "appliance and its function (cooling, washing, heating, or powering)", component: "power/start-up, control/display, noise/vibration, temperature, or water connection", context: "What changed during normal use: no start, poor output, unusual noise, heat, smell, or a leak? Unplug only if safe and dry.", neObject: "उपकरण र यसको काम (चिस्याउने, धुने, तताउने वा चलाउने)", neComponent: "बिजुली/सुरुआत, नियन्त्रण/डिस्प्ले, आवाज/कम्पन, तापक्रम वा पानीको जोड", neContext: "सामान्य प्रयोगमा के बदलियो: नचल्ने, कमजोर काम, अनौठो आवाज, ताप, गन्ध वा चुहावट? सुरक्षित र सुख्खा भएमा मात्र प्लग निकाल्नुहोस्।", romanObject: "appliance ra tesko kaam (cooling, washing, heating, wa power)", romanComponent: "power/start, control/display, noise/vibration, temperature, wa water connection", romanContext: "Normal use ma ke badliyo: start nahune, output kam, awaz, heat, smell, wa leak? Safe ra sukha bhaye matra unplug garnu." },
  masonry: { object: "wall, floor, ceiling, tile, brickwork, or plaster area", component: "surface finish, grout/joint, crack, hollow tile, or damp patch", context: "Is the defect spreading, loose, damp, or limited to a surface crack? Keep away from unstable material.", neObject: "भित्ता, भुइँ, छत, टायल, इँटा वा प्लास्टर", neComponent: "सतह, ग्राउट/जोड, चिरा, खुकुलो टायल वा ओस भएको भाग", neContext: "खराबी फैलिँदैछ, खुकुलो/ओसिलो छ, वा सतहको चिरामा सीमित छ? अस्थिर भागबाट टाढा रहनुहोस्।", romanObject: "wall, floor, ceiling, tile, brickwork, wa plaster", romanComponent: "surface, grout/joint, crack, loose tile, wa damp patch", romanContext: "Defect failidai cha, loose/damp cha, ki surface crack matra ho? Unstable part bata tada basnu." },
  solar: { object: "solar panel, controller, battery, inverter, or hot-water circuit", component: "panel output, wiring/connector, controller, storage, or pipe/valve", context: "Is the issue with power generation, stored power, backup switching, or hot-water delivery? Do not touch roof or live equipment.", neObject: "सोलार प्यानल, कन्ट्रोलर, ब्याट्री, इन्भर्टर वा तातोपानी सर्किट", neComponent: "प्यानल उत्पादन, तार/जोड, कन्ट्रोलर, भण्डारण वा पाइप/भल्भ", neContext: "समस्या बिजुली उत्पादन, ब्याट्री, ब्याकअप स्विच वा तातोपानीमा छ? छत वा करेन्ट भएको उपकरण नछुनुहोस्।", romanObject: "solar panel, controller, battery, inverter, wa hot-water circuit", romanComponent: "panel output, connector, controller, storage, wa pipe/valve", romanContext: "Samasya power generation, battery, backup switch, ki hot water ma cha? Roof wa live equipment nachhunu." },
  cleaning: { object: "room, surface, fabric, tank, or sanitation area", component: "visible stain, dust/grease buildup, odour, residue, or access constraint", context: "Which surface/material is affected, and is the concern a stain, buildup, odour, or hygiene issue? Do not mix cleaning chemicals.", neObject: "कोठा, सतह, कपडा, ट्याङ्की वा सरसफाइ क्षेत्र", neComponent: "दाग, धुलो/चिल्लो जमेको, गन्ध, अवशेष वा पहुँचको समस्या", neContext: "कुन सतह/सामग्रीमा दाग, जमेको फोहोर, गन्ध वा सरसफाइको समस्या छ? सफाइका रसायन नमिसाउनुहोस्।", romanObject: "room, surface, fabric, tank, wa sanitation area", romanComponent: "visible stain, dust/grease, smell, residue, wa access issue", romanContext: "Kun surface/material ma stain, jameko fohor, smell, wa hygiene samasya cha? Cleaning chemicals namisaunu." },
  painting: { object: "wall, ceiling, door, metal, or previously painted surface", component: "peeling, blistering, crack, damp patch, uneven finish, or colour change", context: "Is the surface dry and sound, or is paint peeling over dampness, a crack, or loose plaster? Do not scrape a suspected hazardous coating.", neObject: "भित्ता, छत, ढोका, धातु वा पहिले रङ लगाइएको सतह", neComponent: "उक्किएको, फोका परेको, चिरा, ओस, असमान फिनिस वा रङ परिवर्तन", neContext: "सतह सुक्खा/मजबुत छ कि ओस, चिरा वा खुकुलो प्लास्टरमाथि रङ उक्किएको छ? शङ्कास्पद पुरानो रङ नखोतल्नुहोस्।", romanObject: "wall, ceiling, door, metal, wa pahile paint gareko surface", romanComponent: "peeling, blister, crack, damp patch, uneven finish, wa color change", romanContext: "Surface sukha/majboot cha ki damp, crack, wa loose plaster mathi paint upkeko cha? Suspected old coating nakhotolnu." },
  medical: { object: "health concern or requested at-home care", component: "new symptom, ongoing condition, follow-up, mobility, or care support", context: "Is this a new symptom, an ongoing issue, or a planned follow-up? This assistant cannot diagnose or replace a clinician; seek emergency care for severe sudden symptoms.", neObject: "स्वास्थ्य समस्या वा घरमै चाहिएको हेरचाह", neComponent: "नयाँ लक्षण, पुरानो समस्या, फलोअप, हिँडडुल वा हेरचाह सहयोग", neContext: "यो नयाँ लक्षण, निरन्तर समस्या वा योजनाबद्ध फलोअप हो? यो सहायकले निदान वा चिकित्सकको विकल्प दिन सक्दैन; अचानक गम्भीर लक्षण भए आपतकालीन उपचार लिनुहोस्।", romanObject: "health concern wa gharmai chahiyeko care", romanComponent: "naya symptom, ongoing issue, follow-up, mobility, wa care support", romanContext: "Yo naya symptom, ongoing samasya, ki planned follow-up ho? Yo assistant le diagnosis wa clinician ko replacement gardaina; sudden severe symptom bhaye emergency care linu hos." },
  beauty: { object: "hair, skin, nails, makeup, or spa service area", component: "service requested, product sensitivity, desired result, or timing", context: "What result do you want, and are there known allergies, skin sensitivities, or product restrictions to tell the professional?", neObject: "कपाल, छाला, नङ, मेकअप वा स्पा सेवा", neComponent: "चाहिएको सेवा, उत्पादन संवेदनशीलता, अपेक्षित परिणाम वा समय", neContext: "तपाईंलाई कस्तो परिणाम चाहिन्छ? थाहा भएको एलर्जी, छालाको संवेदनशीलता वा उत्पादनसम्बन्धी प्रतिबन्ध प्राविधिकलाई बताउनुहोस्।", romanObject: "hair, skin, nails, makeup, wa spa service", romanComponent: "service, product sensitivity, desired result, wa timing", romanContext: "Tapai lai kasto result chahiyo? Thaha bhayeko allergy, skin sensitivity, wa product restriction professional lai bhannus." },
  tutor: { object: "subject, class level, assignment, or learning goal", component: "topic, current difficulty, prior lessons, or preferred learning format", context: "Which topic is difficult, and what have you already covered? Do not share a student's private school or account credentials.", neObject: "विषय, कक्षा, गृहकार्य वा सिकाइको लक्ष्य", neComponent: "पाठ, अहिलेको कठिनाइ, पहिले पढेको भाग वा मनपर्ने सिकाइ तरिका", neContext: "कुन पाठ कठिन छ र अहिलेसम्म के पढ्नुभएको छ? विद्यार्थीको निजी खाता वा पासवर्ड नदिनुहोस्।", romanObject: "subject, class level, assignment, wa learning goal", romanComponent: "topic, current difficulty, previous lessons, wa learning style", romanContext: "Kun topic garho cha ra ahile samma ke padhnu bhayo? Student ko private account wa password nadinu." },
  astrology: { object: "consultation topic or question", component: "career, relationship, family, timing, or general guidance", context: "What topic would you like the practitioner to discuss? Share only the personal details you are comfortable providing.", neObject: "परामर्शको विषय वा प्रश्न", neComponent: "पेशा, सम्बन्ध, परिवार, समय वा सामान्य मार्गदर्शन", neContext: "प्र्याक्टिसनरसँग कुन विषयमा कुरा गर्न चाहनुहुन्छ? सहज लाग्ने व्यक्तिगत विवरण मात्र साझा गर्नुहोस्।", romanObject: "consultation ko topic wa question", romanComponent: "career, relationship, family, timing, wa general guidance", romanContext: "Practitioner sanga kun topic ma kura garna chahanu huncha? Comfortable bhayeko personal detail matra share garnu." },
  pest: { object: "room, storage area, furniture, drain, or building edge", component: "insect type if known, visible traces, affected material, or entry point", context: "Where are insects or signs appearing, and are children, pets, food, or water sources nearby? Keep away from unknown chemicals.", neObject: "कोठा, भण्डारण, फर्निचर, नाली वा भवनको किनार", neComponent: "थाहा भए किराको प्रकार, देखिएका चिन्ह, प्रभावित सामग्री वा प्रवेश बिन्दु", neContext: "किरा वा चिन्ह कहाँ देखिन्छ, र नजिक बच्चा, जनावर, खाना वा पानी छ? नचिनेको रसायनबाट टाढा रहनुहोस्।", romanObject: "room, storage, furniture, drain, wa building edge", romanComponent: "insect type if known, visible trace, affected material, wa entry point", romanContext: "Kira wa signs kata dekhincha, ra najik child, pet, food, wa water cha? Unknown chemical bata tada basnu." },
};

export function normalizeDiagnosticText(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("ne-NP").replace(/[\u200B-\u200D\uFEFF]/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").map(token => {
      const collapsed = token.replace(/([a-z])\1{1,}/g, "$1");
      // Keep valid English double letters (e.g. intermittent, smell, address).
      // Use collapsed forms only when they resolve to a known typo alias.
      return ALIASES[token] ?? ALIASES[collapsed] ?? token.replace(/([a-z])\1{2,}/g, "$1");
    }).join(" ");
}

const ROMANIZED_NEPALI = /\b(pani|dhara|bhairacha|bhairako|chha|cha|fohor|dhal|bijuli|batti|aayena|aaena|chuhiyo|chuhirako|gandha|lagyo|jaleyo|garnu|chahiyo|mero|tapai|bigryo|bhayo|garna|safa|ghar|kotha|jyotish|saas|ferna|garo|khatra|jhatka|aairacha|aairako|bhayeko|naako|bihe|bihay|bibaha|sajawat|kharab(?:e+|i)?|kharbi+|kharabi+)\b/i;
export function detectUniversalLanguage(text: string): UniversalLanguage {
  if (/[\u0900-\u097f]/u.test(text)) return "nepali_devanagari";
  return ROMANIZED_NEPALI.test(normalizeDiagnosticText(text)) ? "nepali_romanized" : "english";
}

const CONSONANTS: Readonly<Record<string, string>> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "ng", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "ny",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", व: "w", श: "sh",
  ष: "sh", स: "s", ह: "h", ळ: "l",
};
const VOWELS: Readonly<Record<string, string>> = { अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au" };
const MATRAS: Readonly<Record<string, string>> = { "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॅ": "e", "ॉ": "o" };

/** Lightweight Devanagari-to-Latin transliteration for Romanized-Nepali replies. */
export function romanizeNepaliText(text: string): string {
  const chars = Array.from(text.normalize("NFC"));
  let output = "";
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index]!;
    if (CONSONANTS[char]) {
      let syllable = CONSONANTS[char]!;
      const next = chars[index + 1];
      if (next && MATRAS[next] !== undefined) { syllable += MATRAS[next]; index++; }
      else if (next === "्") index++;
      else syllable += "a";
      if (chars[index + 1] === "ं" || chars[index + 1] === "ँ") { syllable += "n"; index++; }
      output += syllable;
    } else if (VOWELS[char]) output += VOWELS[char];
    else if (char === "ं" || char === "ँ") output += "n";
    else if (char === "ः") output += "h";
    else if (char === "्" || char === "़") continue;
    else output += char;
  }
  return output.replace(/\s+/g, " ").trim();
}

export type DiagnosticSeverity = "routine" | "soon" | "urgent";
const SEVERITY_WORDS: Readonly<Record<DiagnosticSeverity, readonly string[]>> = {
  urgent: ["urgent", "emergency", "danger", "hazard", "immediate", "major impact", "severe", "serious", "gambhir", "flood", "fire", "smoke", "shock", "spark", "gas leak", "chest pain", "difficulty breathing", "unconscious", "heavy bleeding", "choking", "saas ferna garo", "behous", "dherai khatra", "turuntai", "aapatkalin", "गम्भीर", "सास फेर्न गाह्रो", "बेहोस", "धेरै रक्तस्राव", "आगो", "धुवाँ", "करेन्ट", "झट्का", "तत्काल", "आपतकालीन", "डुबान", "तत्काल जोखिम"],
  soon: ["worsening", "spreading", "getting worse", "continuous", "repeat", "dohoriyo", "badhdai", "failiyo", "barambar", "फैलिँदै", "बढ्दै", "निरन्तर", "बारम्बार"],
  routine: ["minor", "small", "intermittent", "once", "sano", "thorai", "kahile kahi", "सानो", "थोरै", "कहिलेकाहीँ"],
};
export function extractDiagnosticSeverity(text: string): DiagnosticSeverity {
  const normalized = normalizeDiagnosticText(text);
  if (SEVERITY_WORDS.urgent.some(word => normalized.includes(normalizeDiagnosticText(word)))) return "urgent";
  if (SEVERITY_WORDS.soon.some(word => normalized.includes(normalizeDiagnosticText(word)))) return "soon";
  return "routine";
}
export function hasMedicalEmergencyCue(text: string): boolean {
  const value = normalizeDiagnosticText(text);
  return ["chest pain", "difficulty breathing", "cannot breathe", "shortness of breath", "unconscious", "heavy bleeding", "choking", "seizure", "stroke", "saas ferna garo", "saas aaena", "behous", "dherai ragat", "सास फेर्न गाह्रो", "बेहोस", "धेरै रक्तस्राव", "दौरा", "स्ट्रोक"].some(cue => value.includes(normalizeDiagnosticText(cue)));
}

function categoryProfile(slug: string, name: string): string | null {
  const key = `${slug} ${name}`.toLowerCase();
  for (const profile of Object.keys(CATEGORY_TERMS)) if (new RegExp(`(^|[^a-z])${profile}([^a-z]|$)`, "i").test(key) || key.includes(profile)) return profile;
  if (/appliance|repair/.test(key)) return "appliance";
  if (/solar|energy/.test(key)) return "solar";
  if (/paint|color/.test(key)) return "painting";
  if (/clean|sanit/.test(key)) return "cleaning";
  if (/medical|doctor|nurse|health|physio/.test(key)) return "medical";
  if (/beauty|salon|spa/.test(key)) return "beauty";
  return null;
}
function termMatches(term: string, token: string) {
  const normalized = normalizeDiagnosticText(term);
  return normalized === token || normalized.length > 3 && token.startsWith(normalized) || token.length > 3 && normalized.startsWith(token);
}

export function resolveDiagnosticTarget(text: string, services: readonly DiagnosticCatalogEntry[]): DiagnosticTarget | null {
  const normalized = normalizeDiagnosticText(text);
  const tokens = normalized.split(" ").filter(token => token.length > 1);
  let best: DiagnosticTarget | null = null;
  for (const service of services) {
    const categoryWords = CATEGORY_TERMS[categoryProfile(service.category_slug, service.category_name) ?? ""] ?? [];
    const terms = [service.title, service.category_name, service.category_slug.replace(/[-_]/g, " "), service.description ?? "", ...(service.keywords ?? []), ...categoryWords];
    let score = 0;
    for (const term of terms) {
      const normalizedTerm = normalizeDiagnosticText(term);
      if (normalized.includes(normalizedTerm) && normalizedTerm.length >= 3) score = Math.max(score, normalizedTerm.split(" ").length > 1 ? 5 : 3);
      else if (tokens.some(token => termMatches(normalizedTerm, token))) score = Math.max(score, 2);
    }
    // Require a meaningful symptom/action term; category names alone are weak intent.
    if (score >= 2 && (!best || score > best.score)) best = { service, categorySlug: service.category_slug, categoryName: service.category_name, score };
  }
  return best;
}

export function universalDiagnosticDepth(input: { categorySlug: string; categoryName: string; symptom: string }): 3 | 5 | 7 {
  const category = categoryProfile(input.categorySlug, input.categoryName);
  const normalized = normalizeDiagnosticText(input.symptom);
  if (/concealed|intermittent|recurring|multiple|widespread|overheat|overload|pressure|voltage|motor|pump|solar|structural|crack|seepage|leak|trip|smoke|spark|जटिल|बारम्बार|फैलिएको/u.test(normalized)) return 7;
  if (category && !["tutor", "astrology", "beauty", "cleaning"].includes(category)) return 5;
  return 3;
}

export function universalDiagnosticQuestion(input: { categorySlug: string; categoryName: string; symptom: string; step: number; answers: readonly string[]; language: UniversalLanguage; depth?: 3 | 5 | 7 }): UniversalQuestion | null {
  const depth = input.depth ?? universalDiagnosticDepth(input);
  if (!Number.isInteger(input.step) || input.step < 0 || input.step >= depth) return null;
  const profile = categoryProfile(input.categorySlug, input.categoryName);
  const hints = DOMAIN_PROMPTS[profile ?? ""];
  const en = input.language === "english", roman = input.language === "nepali_romanized";
  if (input.step === 0) {
    const symptom = input.symptom.trim().slice(0, 120);
    const prompt = en ? `Where specifically do you observe “${symptom}” in or around ${input.categoryName.toLowerCase()}?` : roman ? `${input.categoryName} ma “${symptom}” samasya exactly kata dekhincha?` : `${input.categoryName} सेवामा “${symptom}” समस्या ठ्याक्कै कहाँ देखिन्छ?`;
    const choices = en ? hints ? [hints.object, "A connection/joint or control", "Several areas or the whole system", "Not sure; describe it in your own words"] : ["At one item or location", "At a connection or control", "Across several items/areas", "Not sure; describe it in your own words"]
      : roman ? hints ? [hints.romanObject, hints.romanComponent, "Dherai area wa pura system ma", "Thaha chaina; afnai sabda ma bhanus"] : ["Euta item wa thau ma", "Connection wa control ma", "Dherai item/area ma", "Thaha chaina; afnai sabda ma bhanus"]
        : hints ? [hints.neObject, hints.neComponent, "धेरै ठाउँ वा पूरै प्रणालीमा", "निश्चित छैन; आफ्नै शब्दमा बताउनुहोस्"] : ["एउटा वस्तु वा ठाउँमा", "जोड वा नियन्त्रण भागमा", "धेरै वस्तु/क्षेत्रमा", "निश्चित छैन; आफ्नै शब्दमा बताउनुहोस्"];
    return { prompt, choices };
  }
  if (input.step === 1) {
    const scope = input.answers[0] ?? "the reported area";
    const prompt = en ? hints ? `For ${scope}, which failure pattern best fits what you have already observed? ${hints.context}` : `For ${scope}, what changed during normal use: fit/alignment, movement, output, sound, appearance, or connection? Do not dismantle anything.`
      : roman ? hints ? `${scope} ma, normal use garda kun pattern dekhincha? ${hints.romanContext}` : `${scope} ma normal use garda ke badliyo: fit/alignment, movement, output, sound, appearance, ki connection? Kehi dismantle nagarnu.`
        : hints ? `${scope} मा, पहिलेबाट देखिएको कुन खराबी ढाँचासँग मिल्छ? ${hints.neContext}` : `${scope} मा सामान्य प्रयोग गर्दा के बदलियो: जडान/मिलान, चाल, कामको परिणाम, आवाज, देखावट वा कनेक्सन? केही नखोल्नुहोस्।`;
    const categoryChoices: Readonly<Record<string, { en: string[]; ne: string[]; roman: string[] }>> = {
      cleaning: { en: ["Stain or spill on one surface", "Dust/grease or buildup over a wider area", "Odour or hygiene concern", "Other; describe briefly"], ne: ["एउटा सतहमा दाग वा पोखिएको", "धेरै क्षेत्रमा धुलो/चिल्लो जमेको", "गन्ध वा सरसफाइको चिन्ता", "अर्को; छोटकरीमा बताउनुहोस्"], roman: ["Euta surface ma stain wa spill", "Dherai area ma dust/grease jameko", "Smell wa hygiene concern", "Arko; short ma bhannus"] },
      painting: { en: ["Paint is peeling or blistering", "Crack or dampness is visible", "Colour/finish is uneven", "Other; describe briefly"], ne: ["रङ उक्किएको वा फोका परेको", "चिरा वा ओस देखिएको", "रङ/फिनिस असमान", "अर्को; छोटकरीमा बताउनुहोस्"], roman: ["Paint upkeko wa blister pareko", "Crack wa damp dekheko", "Color/finish uneven cha", "Arko; short ma bhannus"] },
      medical: { en: ["New symptom needing an initial consultation", "Ongoing condition or symptom", "Planned follow-up or home-care support", "Severe sudden symptom; seek urgent care"], ne: ["पहिलो परामर्श चाहिने नयाँ लक्षण", "निरन्तर समस्या वा लक्षण", "फलोअप वा घरमै हेरचाह सहयोग", "अचानक गम्भीर लक्षण; तुरुन्त उपचार लिनुहोस्"], roman: ["Pahilo consultation chahine naya symptom", "Ongoing samasya wa symptom", "Follow-up wa gharmai care support", "Achanak gambhir symptom; urgent care linu hos"] },
      beauty: { en: ["Specific service or treatment requested", "Known allergy or skin/product sensitivity", "Desired style/result or preparation", "Other; describe briefly"], ne: ["चाहिएको खास सेवा वा उपचार", "थाहा भएको एलर्जी वा छाला/उत्पादन संवेदनशीलता", "चाहिएको शैली/परिणाम वा तयारी", "अर्को; छोटकरीमा बताउनुहोस्"], roman: ["Chahiyeko specific service wa treatment", "Thaha bhayeko allergy wa skin/product sensitivity", "Chahiyeko style/result wa preparation", "Arko; short ma bhannus"] },
      tutor: { en: ["A specific topic or concept is unclear", "Need guided practice or homework help", "Need a study plan or regular lessons", "Other; describe briefly"], ne: ["कुनै पाठ वा अवधारणा स्पष्ट छैन", "अभ्यास वा गृहकार्यमा सहयोग चाहिन्छ", "पढाइ योजना वा नियमित कक्षा चाहिन्छ", "अर्को; छोटकरीमा बताउनुहोस्"], roman: ["Kunai topic wa concept clear chaina", "Practice wa homework help chahiyo", "Study plan wa regular class chahiyo", "Arko; short ma bhannus"] },
      astrology: { en: ["Career or education guidance", "Relationship or family question", "Timing or general consultation", "Other; describe briefly"], ne: ["पेशा वा शिक्षासम्बन्धी मार्गदर्शन", "सम्बन्ध वा परिवारको प्रश्न", "समय वा सामान्य परामर्श", "अर्को; छोटकरीमा बताउनुहोस्"], roman: ["Career wa education guidance", "Relationship wa family question", "Timing wa general consultation", "Arko; short ma bhannus"] },
      pest: { en: ["Live insects are visible", "Droppings, holes, or material damage", "Repeated signs in one room/storage area", "Not sure; avoid unknown chemicals"], ne: ["जिउँदा किरा देखिन्छन्", "मल, प्वाल वा सामानमा क्षति", "एउटै कोठा/भण्डारणमा बारम्बार चिन्ह", "निश्चित छैन; नचिनेको रसायन नचलाउनुहोस्"], roman: ["Jinda kira dekhincha", "Droppings, hole, wa saman ma damage", "Eutai room/storage ma repeated signs", "Thaha chaina; unknown chemical nachalaunu"] },
    };
    const choices = categoryChoices[profile ?? ""] ? en ? categoryChoices[profile!]!.en : roman ? categoryChoices[profile!]!.roman : categoryChoices[profile!]!.ne
      : en ? ["A part is loose, worn, cracked, or misaligned", "It moves/runs but gives weak or no output", "It stops, leaks, overheats, or behaves intermittently", "None of these; add a short detail"]
        : roman ? ["Part loose, worn, cracked, wa misaligned cha", "Chalcha tara output kam wa chaina", "Rokkincha, leak, overheat, wa kahile kahi matra chalcha", "Yi madhye hoina; sano detail thapnus"]
          : ["भाग खुकुलो, घिसिएको, चर्किएको वा नमिलेको छ", "चल्छ तर परिणाम कमजोर वा छैन", "रोकिन्छ, चुहिन्छ, तात्छ वा बीचबीचमा मात्र चल्छ", "यीमध्ये होइन; छोटो विवरण थप्नुहोस्"];
    return { prompt, choices };
  }
  const prompt = input.step === depth - 1
    ? en ? "How severe or widespread is the issue so far? Choose only what you have observed; do not recreate the fault."
      : roman ? "Ahilesamma samasya kati gambhir wa failiyeko cha? Dekheko kura matra channus; fault dohorayera najachnuhos."
        : "अहिलेसम्म समस्या कति गम्भीर वा फैलिएको छ? देखिएको अवस्था मात्र छान्नुहोस्; खराबी दोहोर्‍याएर नजाँच्नुहोस्।"
    : input.step === 2
      ? en ? `Which component, material, or service option is already known for ${input.categoryName.toLowerCase()}? Do not open or dismantle anything.`
        : roman ? `${input.categoryName} ko kun component, material, wa service option pahile dekhi thaha cha? Kehi nakholnu wa dismantle nagarnu.`
          : `${input.categoryName} को कुन भाग, सामग्री वा सेवा विकल्प पहिलेबाट थाहा छ? केही नखोल्नुहोस् वा नखोल्दै जाँच नगर्नुहोस्।`
      : input.step === 3
        ? en ? `What was happening during normal use immediately before the ${input.categoryName.toLowerCase()} issue appeared? Do not recreate it.`
          : roman ? `${input.categoryName} ko samasya dekhinu aghi normal use garda ke bhairako thiyo? Dohoryaera test nagarnu.`
            : `${input.categoryName} को समस्या देखिनुअघि सामान्य प्रयोग गर्दा के भइरहेको थियो? दोहोर्‍याएर जाँच नगर्नुहोस्।`
        : input.step === 4
          ? en ? "When did this begin, and how often has it happened?"
            : roman ? "Yo kahile suru bhayo ra kati choti bhayeko cha?"
              : "यो कहिलेदेखि सुरु भयो र कति पटक भएको छ?"
          : en ? "What surrounding condition may be relevant (room, weather, recent work, load, access, or nearby equipment)? State only what you know."
            : roman ? "Najik ko kun condition relevant huna sakcha (room, weather, recent work, load, access, wa equipment)? Thaha bhayeko kura matra bhannus."
              : "वरपरको कुन अवस्था सम्बन्धित हुन सक्छ (कोठा, मौसम, हालैको काम, भार, पहुँच वा नजिकको उपकरण)? थाहा भएको कुरा मात्र बताउनुहोस्।";
  const choices = input.step === depth - 1
    ? en ? ["Limited to one point and currently stopped", "Recurring or gradually worsening", "Multiple areas, major impact, or immediate hazard", "Cannot tell; request an on-site assessment"]
      : roman ? ["Euta thau ma matra, ahile rokiyeko", "Dohorirako wa bistarai badhdai", "Dherai area, thulo asar, wa turuntai khatra", "Thaha chaina; site assessment chahiyo"]
        : ["एउटै ठाउँमा सीमित र अहिले रोकिएको", "दोहोरिने वा बिस्तारै बढ्दै गएको", "धेरै ठाउँ प्रभावित, ठूलो असर वा तत्काल जोखिम", "निश्चित छैन; स्थलमै जाँच चाहिन्छ"]
    : input.step === 2
      ? en ? hints ? [hints.component, "The item/material is visible and identifiable", "Not visible or not known", "Other; describe without opening anything"] : ["One identifiable component", "A connection, control, or surface", "Not visible or not known", "Other; describe briefly"]
        : roman ? hints ? [hints.romanComponent, "Part/material dekhincha ra chinina sakcha", "Dekhidaina wa thaha chaina", "Arko; kehi nakholi bhannus"] : ["Euta chinine component", "Connection, control, wa surface", "Dekhidaina wa thaha chaina", "Arko; short ma bhannus"]
          : hints ? [hints.neComponent, "भाग/सामग्री देखिन्छ र चिन्न सकिन्छ", "देखिँदैन वा थाहा छैन", "अर्को; केही नखोली बताउनुहोस्"] : ["चिन्न सकिने एउटा भाग", "जोड, नियन्त्रण भाग वा सतह", "देखिँदैन वा थाहा छैन", "अर्को; छोटकरीमा बताउनुहोस्"]
      : input.step === 3
        ? en ? ["During regular operation", "After a specific event or recent work", "Only under a particular condition", "Not sure"]
          : roman ? ["Regular use huda", "Kunai event wa recent work pachi", "Kunai specific condition ma matra", "Thaha chaina"]
            : ["नियमित प्रयोग गर्दा", "कुनै घटना वा हालैको कामपछि", "विशेष अवस्थामा मात्र", "निश्चित छैन"]
        : input.step === 4
          ? en ? ["Today or very recently", "Several days or weeks", "Recurring for a longer period", "Not sure"]
            : roman ? ["Aaja wa bharkharai", "Kehi din wa hapta", "Lamo samaya dekhi dohorirako", "Thaha chaina"]
              : ["आज वा भर्खरै", "केही दिन वा हप्तादेखि", "लामो समयदेखि दोहोरिरहेको", "निश्चित छैन"]
          : en ? ["Indoor or enclosed area", "Outdoor or weather-exposed area", "Near other equipment or recent work", "No known surrounding factor"]
            : roman ? ["Bhitra wa enclosed area", "Bahir wa weather le affect garne area", "Arko equipment wa recent work najik", "Thaha bhayeko surrounding factor chaina"]
              : ["भित्री वा बन्द क्षेत्र", "बाहिरी वा मौसमको असर पर्ने क्षेत्र", "अर्को उपकरण वा हालैको काम नजिक", "थाहा भएको वरपरको कारण छैन"];
  return { prompt, choices };
}
