export type UiLanguage = "en" | "np";

const uiDictionary = {
  allServices: ["All services", "सबै सेवाहरू"],
  homeRepairs: ["Home repairs", "घरेलु मर्मत"],
  cleaning: ["Cleaning", "सरसफाइ"],
  careWellness: ["Care & wellness", "स्वास्थ्य तथा हेरचाह"],
  everydaySupport: ["Everyday support", "दैनिक सहयोग"],
  listedRate: ["Listed rate", "सेवा दर"],
  atDoorstep: ["At your doorstep", "तपाईंको ढोकामा"],
  add: ["Add", "थप्नुहोस्"],
  addToCart: ["Add to cart", "कार्टमा थप्नुहोस्"],
  bookNow: ["Book now", "अहिले बुक गर्नुहोस्"],
  viewService: ["View", "सेवा हेर्नुहोस्"],
  minutesShort: ["min", "मिनेट"],
  perUnit: ["per unit", "प्रति युनिट"],
  estimatedTime: ["Estimated time", "अनुमानित समय"],
  whatIncluded: ["What’s included", "समावेश भएका काम"],
  whatExcluded: ["What’s excluded", "समावेश नभएका काम"],
  exploreServices: ["Explore services", "सेवाहरू हेर्नुहोस्"],
  ourMap: ["Our map", "हाम्रो नक्सा"],
  howItWorks: ["How it works", "कसरी काम गर्छ"],
  exploreProfessionals: ["Explore professionals", "प्राविधिकहरू हेर्नुहोस्"],
  allServicesLink: ["All services", "सबै सेवाहरू"],
  requestService: ["Request this service", "यो सेवा अनुरोध गर्नुहोस्"],
  verifiedProfessional: ["Verified professional", "प्रमाणित प्राविधिक"],
  previous: ["Previous", "अघिल्लो"],
  next: ["Next", "अर्को"],
  loadingProfessionals: ["Loading professionals…", "प्राविधिकहरू लोड हुँदैछन्…"],
  serviceNotFound: ["Service not found", "सेवा भेटिएन"],
  chooseCategory: ["Choose a category from all services.", "सबै सेवाबाट एउटा वर्ग छान्नुहोस्।"],
  hourlyRateNote: ["Hourly rates are estimates for labour. Confirm service area, materials, and the final quote before booking.", "घण्टाको दर श्रमको अनुमान मात्र हो। बुक गर्नुअघि सेवा क्षेत्र, सामग्री र अन्तिम मूल्य प्रस्ताव पुष्टि गर्नुहोस्।"],
  noProfessionals: ["No verified professionals are listed in this category yet.", "यस सेवा वर्गमा अहिलेसम्म प्रमाणित प्राविधिक सूचीबद्ध छैनन्।"],
  endOfListings: ["You have reached the end of the listings.", "सूचीको अन्त्यमा पुग्नुभयो।"],
  checkBackSoon: ["Check back soon or explore another service.", "केही समयपछि फेरि हेर्नुहोस् वा अर्को सेवा छान्नुहोस्।"],
  page: ["Page", "पृष्ठ"],
  myBookings: ["My demo bookings", "मेरा डेमो बुकिङहरू"],
  signIn: ["Sign in", "साइन इन"],
  signOut: ["Sign out", "साइन आउट"],
  tagline: ["Your home, effortlessly managed.", "घरको झन्झट सधैंलाई बिदा।"],
  madeForNepal: ["Made for life in Nepal", "नेपालको दैनिक जीवनका लागि"],
  heroEyebrow: ["YOUR CITY. YOUR HOME.", "तपाईंको सहर। तपाईंको घर।"],
  heroTitleLine1: ["Your home,", "घरको झन्झटलाई"],
  heroTitleLine2: ["effortlessly managed.", "सधैंका लागि बिदा,"],
  heroTitleLine3: ["More time for what matters.", "घरमै आराम र सुविधा।"],
  heroMarketplace: ["Nepal’s Premier Home Services Marketplace", "नेपालको अग्रणी घरायसी सेवा बजार"],
  heroSubline1: ["Repairs, cleaning, and care—thoughtfully brought together.", "मर्मत, सरसफाइ र हेरचाह—अब एउटै ठाउँमा।"],
  heroSubline2: ["Clear scopes, trusted local professionals, on your schedule.", "स्पष्ट कामको दायरा, विश्वासिला स्थानीय प्राविधिक र तपाईंको समयअनुसार सेवा।"],
  searchPlaceholder: ["What do you need help with?", "तपाईंलाई के सहयोग चाहिएको छ?"],
  searchCta: ["Find your everyday expert", "सेवा खोज्नुहोस्"],
  clearPricing: ["Clear pricing", "स्पष्ट मूल्य"],
  localCatalog: ["Local service catalog", "स्थानीय सेवा सूची"],
  definedScopes: ["Carefully defined scopes", "स्पष्ट रूपमा तोकिएको कामको दायरा"],
  valley: ["Kathmandu Valley", "काठमाडौं उपत्यका"],
  pokhara: ["Pokhara", "पोखरा"],
  city: ["Kathmandu", "काठमाडौं"],
  lalitpur: ["Lalitpur", "ललितपुर"],
  bhaktapur: ["Bhaktapur", "भक्तपुर"],
  kirtipur: ["Kirtipur", "कीर्तिपुर"],
  hetauda: ["Hetauda", "हेटौँडा"],
  simara: ["Simara", "सिमरा"],
  chitwan: ["Chitwan", "चितवन"],
  jhapa: ["Jhapa", "झापा"],
  sunsari: ["Sunsari", "सुनसरी"],
  serviceAvailable: ["Available to book", "बुकिङका लागि उपलब्ध"],
  comingSoonIn: ["Coming soon in", "चाँडै उपलब्ध हुँदैछ"],
  pausedIn: ["Temporarily unavailable in", "हाललाई उपलब्ध छैन"],
  bookingUnavailable: ["This service is not available for booking in the selected area yet.", "छानिएको क्षेत्रमा यो सेवा बुकिङका लागि अझै उपलब्ध छैन।"],
  valleyHome: ["Our home. Just like yours.", "हाम्रो घर। तपाईंको जस्तै।"],
  localHeroTeam: ["Local Tirkha Hero team", "स्थानीय Tirkha Hero टोली"],
  discoveryEyebrow: ["GOOD HELP STARTS HERE", "राम्रो सहयोगको सुरुवात यहीँबाट"],
  discoveryTitle: ["What can we help you with?", "हामी तपाईंलाई के सहयोग गर्न सक्छौँ?"],
  discoverySub: ["Small fixes, fresh spaces, and a little more peace of mind.", "साना मर्मत, सफा घर र मनको ढुक्क।"],
  searchServices: ["Try “plumbing” or “cleaning”", "“प्लम्बिङ” वा “सरसफाइ” खोज्नुहोस्"],
  servicesCount: ["services to make life easier", "सेवाले दैनिक जीवन सहज बनाउँछन्"],
  noMatches: ["No matching services", "मिल्दो सेवा भेटिएन"],
  noMatchesHint: ["Try another search or explore all categories.", "अर्को शब्द खोज्नुहोस् वा सबै सेवा हेर्नुहोस्।"],
  showAll: ["Show all services", "सबै सेवा देखाउनुहोस्"],
  priceNote: ["Listed Kathmandu starting rates are shown in NPR. Any parts, materials or work beyond the listed scope need a written quote and your approval.", "काठमाडौंका सुरुवाती दर नेपाली रुपैयाँमा देखाइएका छन्। सूचीबाहिरका पार्टपुर्जा, सामग्री वा थप कामका लागि लिखित मूल्य प्रस्ताव र तपाईंको स्वीकृति आवश्यक हुन्छ।"],
  careKicker: ["CARE THAT COMES TO YOU", "तपाईंको घरमै हेरचाह"],
  careTitle: ["For the people who make it home.", "घरलाई घर बनाउनेहरूका लागि।"],
  careDescription: ["Explore scheduled home care, wellness and everyday support.", "घरमै हेरचाह, स्वास्थ्य सेवा र दैनिक सहयोगका लागि समय मिलाउनुहोस्।"],
  exploreHomeCare: ["Explore home care", "घरमै हेरचाह सेवा हेर्नुहोस्"],
  assistantButton: ["Ask about a home issue", "घरायसी समस्याबारे सोध्नुहोस्"],
  assistantTitle: ["Home service triage", "घरायसी सेवा प्रारम्भिक जाँच"],
  assistantSubtitle: ["Safety · evidence · inspection booking", "सुरक्षा · प्रमाण · जाँच बुकिङ"],
} as const satisfies Record<string, readonly [string, string]>;

export type UiTranslationKey = keyof typeof uiDictionary;

const serviceTitles: Record<string, string> = {
  "Tap & faucet leakage repair": "धारा तथा ट्यापको चुहावट मर्मत",
  "Pipe fitting & repair": "पाइप जडान तथा मर्मत",
  "Tap installation": "धारा जडान",
  "Wiring & fault checks": "तार जडान तथा विद्युत् समस्या जाँच",
  "Switch, socket & bulb replacement": "स्विच, सकेट तथा बल्ब फेर्ने",
  "Inverter setup": "इन्भर्टर जडान",
  "Door & furniture fixes": "ढोका तथा फर्निचर मर्मत",
  "Deep home cleaning": "घरको गहिरो सरसफाइ",
  "Water tank & reservoir cleaning": "पानी ट्याङ्की तथा रिजर्भ्वार सफाइ",
  "Sofa & carpet shampooing": "सोफा तथा कार्पेट सफाइ",
  "Doctor consultation at home": "घरमै डाक्टर परामर्श",
  "Home nurse & elderly care": "घरमै नर्स तथा ज्येष्ठ नागरिक हेरचाह",
  "At-home physiotherapy": "घरमै फिजियोथेरापी",
  "Home salon & spa": "घरमै सलुन तथा स्पा",
  "Astrology consultation": "ज्योतिष परामर्श",
  "At-home tutoring session": "घरमै ट्युसन कक्षा",
  "Home decoration consultation": "घर सजावट परामर्श",
  "Plumbing initial inspection & leak diagnosis": "प्लम्बिङको प्रारम्भिक जाँच तथा चुहावट पहिचान",
  "Waste pipe & drainage clearing": "फोहोर पानीको पाइप तथा ढल खुलाउने",
  "Water motor & sump pump fitting": "पानी मोटर तथा सम्प पम्प जडान",
  "Electrical safety inspection & MCB diagnosis": "विद्युत् सुरक्षा जाँच तथा एमसीबी समस्या पहिचान",
  "Single-phase MCB & fuse swap": "सिंगल-फेज एमसीबी तथा फ्युज फेर्ने",
  "General on-site technical audit": "सामान्य स्थलगत प्राविधिक जाँच",
};

const serviceCategories: Record<string, string> = {
  Plumbing: "प्लम्बिङ",
  Electrical: "विद्युत् सेवा",
  Carpentry: "काठ तथा फर्निचर मर्मत",
  "Home Cleaning": "घर सरसफाइ",
  "Water Tank Cleaning": "पानी ट्याङ्की सफाइ",
  "Sofa & Carpet": "सोफा तथा कार्पेट",
  "Doctor at Home": "घरमै डाक्टर",
  "Home Nursing": "घरमै नर्सिङ",
  Physiotherapy: "फिजियोथेरापी",
  "Home Salon & Spa": "घरमै सलुन तथा स्पा",
  Astrology: "ज्योतिष सेवा",
  "Home Tutoring": "घरमै ट्युसन",
  "Home Decorators": "घर सजावट",
  "General Home Services": "सामान्य घरायसी सेवा",
  "Home repairs": "घरेलु मर्मत",
  Cleaning: "सरसफाइ",
  "Care & wellness": "स्वास्थ्य तथा हेरचाह",
  "Everyday support": "दैनिक सहयोग",
};

const serviceUnits: Record<string, string> = {
  "per unit": "प्रति युनिट",
};

const serviceDescriptions: Record<string, string> = {
  "Stop the drip. Get your kitchen back.": "चुहावट रोक्नुहोस् र भान्सालाई फेरि सहज बनाउनुहोस्।",
  "Reliable connections for everyday water flow.": "दैनिक पानी प्रवाहका लागि भरपर्दो पाइप जडान।",
  "A fresh fitting, installed with care.": "सावधानीपूर्वक जडान गरिएको नयाँ धारा।",
  "Make your everyday connections work better.": "दैनिक विद्युत् जडानलाई सुरक्षित र व्यवस्थित बनाउनुहोस्।",
  "Small switches. A big difference.": "सानो स्विचको फेरबदलले पनि ठूलो फरक पार्छ।",
  "A considered setup for backup power.": "ब्याकअप बिजुलीका लागि सोचविचारसहितको जडान।",
  "Give well-loved furniture a little attention.": "मनपर्ने फर्निचरलाई आवश्यक मर्मत गरौँ।",
  "A cleaner home. A clearer head.": "सफा घर, ढुक्क मन।",
  "Care for the water your home depends on.": "घरमा प्रयोग हुने पानीको ट्याङ्की सफा राखौँ।",
  "Freshen up your favourite corner.": "तपाईंको मनपर्ने ठाउँलाई फेरि ताजा बनाउनुहोस्।",
  "A non-emergency consultation, at home.": "आपतकालीन अवस्थाबाहेक घरमै स्वास्थ्य परामर्श।",
  "Thoughtful assistance for everyday care.": "दैनिक हेरचाहका लागि आत्मीय सहयोग।",
  "Support for movement, one session at a time.": "हरेक सत्रसँगै सहज चालचलनका लागि सहयोग।",
  "A little time, just for you.": "आफ्नो लागि केही समय।",
  "A private, scheduled conversation about your questions and traditions.": "तपाईंका प्रश्न र परम्पराबारे निजी तथा तय गरिएको परामर्श।",
  "One focused learning session at home, matched to a subject and grade.": "कक्षा र विषयअनुसार घरमै एकाग्रतापूर्वक पढाइको सत्र।",
  "A practical in-home consultation for a room refresh or small gathering.": "कोठा सजावट वा सानो जमघटका लागि घरमै व्यावहारिक परामर्श।",
  "A focused first inspection to identify an accessible plumbing leak or fault.": "देख्न र पुग्न सकिने पाइप चुहावट वा खराबी पत्ता लगाउन प्रारम्भिक जाँच।",
  "Starting rate for clearing one accessible household waste pipe or drain.": "घरको एउटा देख्न र पुग्न सकिने फोहोर पानीको पाइप वा नाली खुलाउने सुरुवाती दर।",
  "Labour for fitting one compatible water motor or sump pump at an accessible household installation.": "घरमा पहुँचयोग्य ठाउँमा मिल्दो पानी मोटर वा सम्प पम्प जडान गर्ने श्रम शुल्क।",
  "A first safety inspection and diagnosis for one accessible household circuit or breaker issue.": "घरको पहुँचयोग्य एउटा सर्किट वा ब्रेकर समस्याको प्रारम्भिक सुरक्षा जाँच।",
  "Labour to replace one compatible single-phase MCB or fuse after confirming the fault and rating.": "खराबी र क्षमता पुष्टि भएपछि मिल्दो एउटा सिंगल-फेज एमसीबी वा फ्युज फेर्ने श्रम शुल्क।",
  "A general on-site technical audit for a household repair issue that needs a professional assessment.": "प्राविधिकको मूल्याङ्कन आवश्यक पर्ने घरायसी समस्याको सामान्य स्थलगत जाँच।",
};

const pricingNotes: Record<string, string> = {
  "Accessible tap or faucet leak; replacement parts are separate.": "पुग्न सकिने धारा वा ट्यापको चुहावटका लागि; फेर्नुपर्ने पार्टपुर्जा छुट्टै लाग्छ।",
  "Rs. 350–500 per unit depending on fitting; parts are separate.": "फिटिङअनुसार प्रति युनिट रु. ३५०–५००; पार्टपुर्जा छुट्टै लाग्छ।",
  "From Rs. 500; final scope confirmed on inspection.": "रु. ५०० देखि; अन्तिम कामको दायरा जाँचपछि पुष्टि हुन्छ।",
};

export function translateUi(key: UiTranslationKey, language: UiLanguage): string {
  return uiDictionary[key][language === "np" ? 1 : 0];
}

export function translateCatalogLabel(value: string, language: UiLanguage): string {
  if (language !== "np") return value;
  return serviceTitles[value] ?? serviceCategories[value] ?? serviceUnits[value] ?? serviceDescriptions[value] ?? pricingNotes[value] ?? value;
}

export function translatePriceLabel(value: string, language: UiLanguage): string {
  if (language !== "np") return value;
  return value
    .replace(/^From\s+/i, "")
    .replace(/Rs\.?\s*/gi, "रु. ")
    .replace(/\s*\/\s*per unit/gi, " प्रति युनिट");
}
