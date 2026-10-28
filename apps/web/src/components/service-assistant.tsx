"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bot, ImagePlus, Mic, Send, Sparkles, X } from "lucide-react";
import { diagnosticBookingPrefillSchema, detectHomeFaultTrade, diagnosticLanguageForText, diagnosticQuestion, diagnosticQuestionCount, diagnosticSeverityLabel, detectHomeSafetyRisk, DIAGNOSTIC_PREFILL_STORAGE_KEY, extractDiagnosticSeverity, hasMedicalEmergencyCue, HOME_ISSUES, matchHomeFault, matchHomeIssue, normalizeHomeDiagnosticText, resolveDiagnosticCode, resolveDiagnosticTarget, romanizeNepaliText, serviceIdForDiagnosticCode, universalDiagnosticDepth, universalDiagnosticQuestion, type DiagnosticDraft, type DiagnosticLanguage, type DiagnosticQuestion, type HomeFaultCode, type SupportedDiagnosticCode } from "@tirkha/shared";
import { useRouter } from "next/navigation";
import { useMarketplace } from "./marketplace-provider";

type SpeechResultEvent = Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: Event) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
type VisualEvidence = { visual_clarity: "clear" | "limited" | "poor" | "not_applicable"; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string };
type Intake = { serviceId: string; issueId: string; step: "diagnostic" | "diagnosis-review" | "area" | "time"; symptom: string; issueTitle: string; explanation: string; urgency: "routine" | "soon" | "urgent"; safetyNote?: string; photoAssessed: boolean; area?: string; diagnosticCode?: SupportedDiagnosticCode; faultCode?: HomeFaultCode; answers: number[]; language: DiagnosticLanguage; visual?: VisualEvidence; inspectionSummary?: DiagnosticDraft; universal?: { categorySlug: string; categoryName: string; answers: string[] } };
type QuickReply = { label: string; query: string; action?: "inspection" };
type Message = { id: string; role: "assistant" | "user"; text: string; question?: DiagnosticQuestion; quickReplies?: QuickReply[]; diagnosticAction?: "review" | "dispatch" | "fallback"; diagnostic?: DiagnosticDraft; serviceId?: string; fallbackTrade?: "plumbing" | "electrical" | null };
type PhotoAssessment = { issue_title: string; explanation: string; issue_id: string; visual_clarity: VisualEvidence["visual_clarity"]; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string; urgency: "routine" | "soon" | "urgent"; safety_note: string; photo_assessed: boolean; request_closer_photo: boolean; clarification_question: string; clarification_choices: string[]; language: DiagnosticLanguage };
const SESSION_KEY = "tirkha_diagnostic_session_v1";
function readDiagnosticSession(): { language: DiagnosticLanguage | null; intake: Intake | null } | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null");
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as { language?: unknown; intake?: unknown };
    const language = value.language === "english" || value.language === "nepali_devanagari" || value.language === "nepali_romanized" ? value.language : null;
    const candidate = value.intake;
    if (!candidate || typeof candidate !== "object") return { language, intake: null };
    const state = candidate as Partial<Intake>;
    if (typeof state.serviceId !== "string" || typeof state.issueId !== "string" || typeof state.symptom !== "string" || !Array.isArray(state.answers) || !["diagnostic", "diagnosis-review", "area", "time"].includes(state.step ?? "")) return { language, intake: null };
    if (state.universal && (typeof state.universal.categorySlug !== "string" || typeof state.universal.categoryName !== "string" || !Array.isArray(state.universal.answers))) return { language, intake: null };
    return { language, intake: state as Intake };
  } catch { return null; }
}
function fileAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read this image.")); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image.")); reader.readAsDataURL(file); }); }
function riskMessage(risk: "electric" | "water-electric" | "gas", language: DiagnosticLanguage) {
  if (language === "nepali_romanized") {
    if (risk === "gas") return "Yo turuntai gas hazard huna sakcha. Sabailai bahira surakshit thau ma lanu hos; aago wa switch nachalaunu. Bahira pugera emergency service wa gas supplier lai samparka garnu hos.";
    if (risk === "water-electric") return "Pani ra bijuli wa current ko jhatka khatarnak huna sakcha. Tyo thau bata tada basnu hos, pani wa equipment nachhunu hos, ra qualified emergency help bolaaunu hos. Asurakshit thau ko main switch nachhunu hos.";
    return "Spark, dhuwa, jalyeko wire wa tato socket turuntai khatra huna sakcha. Tada basnu hos. Sukha ra safe thau bata hazard najik nagai main breaker banda garna milcha bhane matra garnu hos; natra nachhunu hos. Qualified emergency wa utility help samparka garnu hos.";
  }
  if (language !== "english") {
    if (risk === "gas") return "यो ग्याससम्बन्धी तत्काल जोखिम हुन सक्छ। सबैलाई बाहिर सुरक्षित ठाउँमा लैजानुहोस्; आगो वा स्विच नचलाउनुहोस्। बाहिर पुगेपछि स्थानीय आपतकालीन सेवा वा ग्यास आपूर्तिकर्तालाई सम्पर्क गर्नुहोस्।";
    if (risk === "water-electric") return "पानी र बिजुली वा करेन्टको झट्का खतरनाक हुन सक्छ। त्यस ठाउँबाट टाढा रहनुहोस्, पानी वा उपकरण नछुनुहोस्, र योग्य आपतकालीन सहायता बोलाउनुहोस्। असुरक्षित ठाउँको मेन स्विच नछुनुहोस्।";
    return "झिल्का, धुवाँ, जलेको तार वा तातो/जलेको सकेट तत्काल जोखिमको संकेत हुन सक्छ। टाढा रहनुहोस्। सुक्खा र सुरक्षित ठाउँबाट जोखिमनजिक नपुगी मेन ब्रेकर बन्द गर्न सकिने भए मात्र बन्द गर्नुहोस्; अन्यथा नछुनुहोस्। योग्य आपतकालीन सहायता वा विद्युत् प्राधिकरणलाई सम्पर्क गर्नुहोस्।";
  }
  if (risk === "gas") return "This may be an immediate gas hazard. Take everyone outside; avoid flames and electrical switches. Once outside, contact local emergency services or your gas supplier.";
  if (risk === "water-electric") return "Water near electricity or an electric shock can be dangerous. Keep away, do not touch the water or equipment, and contact qualified emergency help. Do not approach a main switch if the area is unsafe.";
  return "Sparks, smoke, a burning wire or a hot/burnt socket can signal an immediate hazard. Keep away. If the main breaker is reachable from a dry, safe place without approaching the hazard, switch it off; otherwise leave it alone. Contact qualified emergency or utility help.";
}
function urgentAssessmentMessage(language: DiagnosticLanguage) {
  return textFor(language, "The report indicates an urgent impact. Contact a qualified professional promptly; if anyone is in immediate danger, contact local emergency services now. Do not wait for this chat to resolve it.", "बताइएको असर तत्काल ध्यान दिनुपर्ने देखिन्छ। योग्य प्राविधिकलाई छिट्टै सम्पर्क गर्नुहोस्; कसैलाई तत्काल खतरा भए स्थानीय आपतकालीन सेवा अहिले नै सम्पर्क गर्नुहोस्। यो संवादबाट समाधान पर्खेर नबस्नुहोस्।");
}
function textFor(language: DiagnosticLanguage, english: string, nepali: string) { return language === "english" ? english : language === "nepali_romanized" ? romanizeNepaliText(nepali) : nepali; }
function questionFor(issueId: string, step: number, language: DiagnosticLanguage, previousAnswers: readonly number[] = [], faultCode?: string): DiagnosticQuestion | null {
  return diagnosticQuestion(issueId, step, language, previousAnswers, faultCode);
}
function optionIndex(answer: string, choices: string[]) {
  const encoded = answer.match(/^\[\[(\d+)\]\]/); if (encoded) return Number(encoded[1]);
  const letter = answer.match(/^\s*([a-d])(?:[).:\s]|$)/i); if (letter) return letter[1]!.toLowerCase().charCodeAt(0) - 97;
  const normalized = normalizeHomeDiagnosticText(answer);
  const exact = choices.findIndex(choice => normalizeHomeDiagnosticText(choice) === normalized); if (exact >= 0) return exact;
  if (/^(?:i\s+)?(?:don'?t know|not sure|unknown|cannot tell|can't tell|no idea|निश्चित छैन|थाहा छैन)$/i.test(normalized)) return choices.length - 1;
  const hasLeakIntent = /\b(leak|leaking|water|pani|dhara|chuh)\b/u.test(normalized);
  if (hasLeakIntent) {
    const leakChoice = choices.findIndex(choice => /\b(leak|water|damp|flow|चुहावट|पानी)\b/iu.test(normalizeHomeDiagnosticText(choice)) && !/other|not sure|निश्चित छैन/i.test(choice));
    if (leakChoice >= 0) return leakChoice;
  }
  const hasPowerIntent = /\b(power|electricity|bijuli|batti|light|outage|बिजुली|बत्ती)\b/u.test(normalized);
  if (hasPowerIntent) {
    const powerChoice = choices.findIndex(choice => /\b(power|electric|breaker|supply|light|बिजुली|बत्ती)\b/iu.test(normalizeHomeDiagnosticText(choice)) && !/other|not sure|निश्चित छैन/i.test(choice));
    if (powerChoice >= 0) return powerChoice;
  }
  return -1;
}

function localIssueTitle(issueId: string, fallback: string, language: DiagnosticLanguage) {
  if (language === "english") return fallback;
  const nepali: Record<string, string> = {
    "tap-leak": "धारा वा सिङ्कमुनि चुहावट", "pipe-leak": "पाइप वा जोडमा चुहावट", "blocked-drain": "नाली ढिलो बग्ने वा थुनिने समस्या",
    "low-pressure": "पानीको चाप कम वा असमान", "air-in-line": "पानीको पाइपमा हावा वा फोका", "muddy-water": "मैलो वा रङ बदलिएको पानी",
    "pump": "पानीको पम्पसम्बन्धी समस्या", "solar-water-heater": "सौर्य पानी तताउने प्रणालीको समस्या", "water-heater": "पानी तताउने उपकरणको समस्या",
    "tank-overflow": "ट्याङ्कीबाट पानी पोखिने समस्या", "toilet-flush": "शौचालयको फ्लससम्बन्धी समस्या", "no-water": "धारामा पानी नआएको समस्या",
    "intermittent-supply": "पानीको आपूर्ति अनियमित", "pipe-noise": "पाइपमा आवाज वा कम्पन", "no-power": "बिजुली आपूर्ति बन्द",
    "flicker": "बत्ती झिम्किने वा मधुरो हुने", "breaker-trip": "सुरक्षा ब्रेकर बारम्बार ट्रिप हुने", "sparks-burning": "झिल्का, धुवाँ वा जलेको गन्ध",
    "hot-outlet": "सकेट वा स्विच तात्ने", "electric-shock": "उपकरणबाट करेन्ट लाग्ने", "voltage": "बिजुलीको भोल्टेज अस्थिर",
    "inverter": "इन्भर्टर वा ब्याकअप बिजुलीको समस्या", "overload": "सर्किटमा बढी भार परेको सम्भावना", "earthing": "अर्थिङ वा करेन्ट चुहावटको सम्भावना", "appliance": "घरायसी उपकरणको समस्या",
  };
  return nepali[issueId] ?? "वर्गीकरण नभएको घरायसी समस्या";
}
function unconfirmedText(language: DiagnosticLanguage) { return textFor(language, "The reported symptoms match a limited triage classification. This does not confirm the failed component or a hidden cause. An on-site inspection and written quote are required before repair.", "बताइएका लक्षण सीमित प्रारम्भिक वर्गीकरणसँग मिल्छन्। यसले बिग्रिएको पार्ट वा लुकेको कारण पुष्टि गर्दैन। मर्मतअघि स्थलमै जाँच र लिखित मूल्य प्रस्ताव आवश्यक छ।"); }
export function ServiceAssistant() {
  const { services } = useMarketplace();
  const router = useRouter();
  const [open, setOpen] = useState(false), [language, setLanguage] = useState<DiagnosticLanguage | null>(null), [input, setInput] = useState(""), [listening, setListening] = useState(false), [busy, setBusy] = useState(false), [voiceError, setVoiceError] = useState(""), [photo, setPhoto] = useState<File | null>(null), [photoPreview, setPhotoPreview] = useState<string | null>(null), [intake, setIntake] = useState<Intake | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null), recognitionRef = useRef<SpeechRecognitionLike | null>(null), fileRef = useRef<HTMLInputElement>(null), previewUrls = useRef<string[]>([]), requestControllerRef = useRef<AbortController | null>(null), mountedRef = useRef(true), restoredSessionRef = useRef(false);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open, busy]);
  useEffect(() => { const reveal = () => setOpen(true); window.addEventListener("tirkha:open-assistant", reveal); return () => window.removeEventListener("tirkha:open-assistant", reveal); }, []);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; requestControllerRef.current?.abort(); recognitionRef.current?.stop(); previewUrls.current.forEach(url => URL.revokeObjectURL(url)); previewUrls.current = []; }; }, []);
  useEffect(() => {
    const restored = readDiagnosticSession();
    if (restored?.language) setLanguage(restored.language);
    if (restored?.intake) {
      setIntake(restored.intake);
      const state = restored.intake;
      const prompt = state.universal
        ? universalDiagnosticQuestion({ categorySlug: state.universal.categorySlug, categoryName: state.universal.categoryName, symptom: state.symptom, step: state.universal.answers.length, answers: state.universal.answers, language: state.language })?.prompt
        : state.step === "diagnostic" ? questionFor(state.issueId, state.answers.length, state.language, state.answers, state.faultCode)?.prompt : undefined;
      setMessages([{ id: "restored-session", role: "assistant", text: prompt ? textFor(state.language, `Your diagnostic session has been restored. ${prompt}`, `तपाईंको जाँच सत्र पुनः सुरु भयो। ${prompt}`) : textFor(state.language, "Your diagnostic draft has been restored. Continue with the next step or describe what changed.", "तपाईंको जाँच मस्यौदा पुनः सुरु भयो। अर्को चरणमा जानुहोस् वा के परिवर्तन भयो बताउनुहोस्।") }]);
    }
    restoredSessionRef.current = true;
  }, []);
  useEffect(() => {
    if (!restoredSessionRef.current) return;
    try {
      if (!language && !intake) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify({ language, intake }));
    } catch { /* Session storage can be disabled; the in-memory diagnostic still works. */ }
  }, [intake, language]);
  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null; event.target.value = ""; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setVoiceError(textFor(language ?? "english", "Choose a JPG, PNG or WebP photo.", "JPG, PNG वा WebP तस्बिर छान्नुहोस्।")); return; }
    if (file.size > 3 * 1024 * 1024) { setVoiceError(textFor(language ?? "english", "Choose a photo under 3 MB.", "३ MB भन्दा सानो तस्बिर छान्नुहोस्।")); return; }
    if (photoPreview) { URL.revokeObjectURL(photoPreview); previewUrls.current = previewUrls.current.filter(url => url !== photoPreview); }
    const preview = URL.createObjectURL(file); previewUrls.current.push(preview); setPhoto(file); setPhotoPreview(preview); setVoiceError("");
  }
  function selectLanguage(selected: DiagnosticLanguage) {
    if (language) return;
    setLanguage(selected);
    setMessages([{ id: "welcome", role: "assistant", text: selected === "english" ? "Describe the issue or attach an optional photo. I will check hazards first, then ask service-specific questions. I provide a limited routing summary, not a confirmed diagnosis or AI-generated price." : selected === "nepali_romanized" ? "Samasya describe garnu hos wa photo optional rupma pathaunu hos. Pahila safety herera, chhaneko service anusar targeted questions sodhchu. Yo limited triage ho, confirmed diagnosis wa AI price hoina." : "समस्या छोटकरीमा लेख्नुहोस् वा स्पष्ट तस्बिर जोड्नुहोस्। पहिले तत्काल जोखिम जाँचेर, छानिएको सेवाअनुसार सम्बन्धित प्रश्न सोध्छु। म सीमित प्रारम्भिक वर्गीकरण देखाउँछु, पुष्टि भएको निदान वा एआई मूल्य अनुमान होइन।" }]);
  }
  async function send(event?: FormEvent, forcedQuery?: string) {
    event?.preventDefault();
    const lockedLanguage = language;
    const query = forcedQuery === "[[onsite-inspection]]" ? textFor(lockedLanguage ?? "english", "On-site inspection", "स्थलमै जाँच") : forcedQuery?.replace(/^\[\[\d+\]\]/, "").trim() ?? input.trim();
    if (!query && !photo) return;
    if (busy) return;
    const currentPhoto = photo;
    const currentPreview = photoPreview;
    const activeLanguage = lockedLanguage ?? diagnosticLanguageForText(query);
    if (!lockedLanguage) {
      setLanguage(activeLanguage);
      setMessages(old => old.length ? old : [{ id: "welcome", role: "assistant", text: activeLanguage === "english" ? "I detected English. I will check safety first and ask adaptive service-specific questions only if needed. Photos are optional." : activeLanguage === "nepali_romanized" ? "Romanized Nepali bujhe. Pahila safety herchu, ani jaruri bhaye service-anusar questions sodhchu. Photo optional ho." : "तपाईंको सन्देश नेपालीमा छ भनेर पहिचान भयो। पहिले सुरक्षा जाँचेर आवश्यक परेमा सेवाअनुसार प्रश्न सोध्छु। तस्बिर वैकल्पिक हो।" }]);
    }
    const currentQuestion = intake?.step === "diagnostic" ? questionFor(intake.issueId, intake.answers.length, activeLanguage, intake.answers, intake.faultCode) : null;
    const acceptedText = forcedQuery === "[[confirm-diagnosis]]" ? textFor(activeLanguage, "Accepted classification; continue", "वर्गीकरण स्वीकार गरियो; अगाडि बढ्नुहोस्") : query;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: acceptedText || (activeLanguage === "english" ? "Photo submitted for triage." : "जाँचका लागि तस्बिर पठाइयो।") };
    setMessages(old => [...old, userMessage].slice(-32));
    setInput(""); setPhoto(null); setPhotoPreview(null); setVoiceError(""); setBusy(true);
    const requestController = new AbortController();
    requestControllerRef.current?.abort(); requestControllerRef.current = requestController;
    if (currentPreview) { URL.revokeObjectURL(currentPreview); previewUrls.current = previewUrls.current.filter(url => url !== currentPreview); }
    try {
      let next: Intake | null = intake, answer = "", question: DiagnosticQuestion | undefined, quickReplies: QuickReply[] | undefined, diagnostic: DiagnosticDraft | undefined, diagnosticAction: Message["diagnosticAction"], serviceId: string | undefined, fallbackTrade: Message["fallbackTrade"];
      const risk = detectHomeSafetyRisk(query);
      if (risk) { answer = riskMessage(risk, activeLanguage); next = null; }
      else if (hasMedicalEmergencyCue(query)) { next = null; answer = activeLanguage === "english" ? "This may be a medical emergency. Contact local emergency medical services now or go to the nearest emergency department. Do not wait for an in-home booking or rely on this assistant for diagnosis." : activeLanguage === "nepali_romanized" ? "Yo medical emergency huna sakcha. Ahile nai local emergency medical service samparka garnu hos wa najik ko emergency department janu hos. Ghar visit booking ko lagi parkhinu wa yo assistant ma diagnosis ko lagi bhar naparnu hos." : "यो स्वास्थ्य आपतकाल हुन सक्छ। अहिले नै स्थानीय आपतकालीन स्वास्थ्य सेवा सम्पर्क गर्नुहोस् वा नजिकको आकस्मिक कक्ष जानुहोस्। घरमै आउने सेवा बुकिङ पर्खेर नबस्नुहोस् र यस सहायकबाट निदान नलिनुहोस्।"; }
      else if (forcedQuery === "[[onsite-inspection]]") {
        const originalSymptom = intake?.symptom ?? query;
        const trade = intake ? HOME_ISSUES.find(candidate => candidate.id === intake.issueId)?.trade as "plumbing" | "electrical" | undefined : detectHomeFaultTrade(originalSymptom) ?? undefined;
        next = null; fallbackTrade = trade ?? null; diagnosticAction = "fallback";
        diagnostic = { symptom: originalSymptom, issue_title: textFor(activeLanguage, "On-site technical inspection", "स्थलगत प्राविधिक जाँच"), explanation: textFor(activeLanguage, "A qualified professional will inspect the reported issue and confirm the scope on site. No component failure or price is inferred.", "योग्य प्राविधिकले स्थलमै समस्या जाँच गरी कामको दायरा पुष्टि गर्नुहुनेछ। कुनै पार्ट बिग्रिएको वा मूल्य अनुमान गरिएको छैन।"), urgency: "routine", trade, severity: diagnosticSeverityLabel(1, activeLanguage), visual_evidence: [], photo_assessed: intake?.photoAssessed ?? false, safety_note: intake?.safetyNote, triage_answers: intake?.answers.map(String) ?? [], suggested_parts: [] };
        answer = textFor(activeLanguage, "On-site inspection selected. You can choose the appropriate trade below.", "स्थलगत जाँच छानियो। तल उपयुक्त सेवा छान्नुहोस्।");
      }
      else if (intake?.universal && intake.step === "diagnostic" && !currentPhoto) {
        const planDepth = universalDiagnosticDepth({ categorySlug: intake.universal.categorySlug, categoryName: intake.universal.categoryName, symptom: intake.symptom });
        const planQuestion = universalDiagnosticQuestion({ categorySlug: intake.universal.categorySlug, categoryName: intake.universal.categoryName, symptom: intake.symptom, step: intake.universal.answers.length, answers: intake.universal.answers, language: activeLanguage, depth: planDepth });
        if (!planQuestion) {
          next = null;
          answer = activeLanguage === "english" ? "This category needs a qualified on-site assessment. No fault or price has been inferred." : activeLanguage === "nepali_romanized" ? "Yo service ko lagi qualified on-site assessment chahincha. Fault wa price anuman gareko chaina." : "यो सेवाका लागि योग्य प्राविधिकको स्थलमै जाँच आवश्यक छ। खराबी वा मूल्य अनुमान गरिएको छैन।";
        } else {
          const picked = optionIndex(forcedQuery ?? query, planQuestion.choices);
          const detail = picked >= 0 ? planQuestion.choices[picked]! : query.slice(0, 180);
          const medicalCategory = /medical|doctor|health|nurse|physio/i.test(`${intake.universal.categorySlug} ${intake.universal.categoryName}`);
          if (medicalCategory && extractDiagnosticSeverity(detail) === "urgent") {
            next = null;
            answer = activeLanguage === "english" ? "This may be a medical emergency. Contact local emergency medical services now or go to the nearest emergency department. Do not wait for an in-home booking or rely on this assistant for diagnosis." : activeLanguage === "nepali_romanized" ? "Yo medical emergency huna sakcha. Ahile nai local emergency medical service samparka garnu hos wa najik ko emergency department janu hos. Ghar visit booking ko lagi parkhinu wa yo assistant ma diagnosis ko lagi bhar naparnu hos." : "यो स्वास्थ्य आपतकाल हुन सक्छ। अहिले नै स्थानीय आपतकालीन स्वास्थ्य सेवा सम्पर्क गर्नुहोस् वा नजिकको आकस्मिक कक्ष जानुहोस्। घरमै आउने सेवा बुकिङ पर्खेर नबस्नुहोस् र यस सहायकबाट निदान नलिनुहोस्।";
          }
          else if (!detail) {
            next = intake; question = planQuestion; answer = planQuestion.prompt;
          } else {
            const answers = [...intake.universal.answers, detail];
            if (answers.length < planDepth) {
              next = { ...intake, universal: { ...intake.universal, answers } };
              question = universalDiagnosticQuestion({ categorySlug: intake.universal.categorySlug, categoryName: intake.universal.categoryName, symptom: intake.symptom, step: answers.length, answers, language: activeLanguage, depth: planDepth }) ?? undefined;
              answer = question?.prompt ?? (activeLanguage === "english" ? "Add one detail in your own words so I can keep this assessment focused." : activeLanguage === "nepali_romanized" ? "Assessment focused rakhna euta detail afnai sabda ma bhannus." : "जाँचलाई केन्द्रित राख्न आफ्नै शब्दमा एउटा विवरण दिनुहोस्।");
            } else {
              const severity = extractDiagnosticSeverity(`${intake.symptom} ${answers.at(-1) ?? ""} ${answers.join(" ")}`);
              const urgency = severity;
              const severityLabel = activeLanguage === "english" ? severity === "urgent" ? "Broad impact or potential hazard; professional should assess promptly" : severity === "soon" ? "Recurring or worsening; arrange a timely assessment" : "Currently limited; confirm scope during assessment" : activeLanguage === "nepali_romanized" ? severity === "urgent" ? "Thulo asar wa sambhavit khatra; professional le chhito assess garnu parcha" : severity === "soon" ? "Dohorine wa badhdai; samayamai assessment garnu hos" : "Ahile simit cha; assessment ma scope confirm garnu hos" : severity === "urgent" ? "ठूलो असर वा सम्भावित जोखिम; प्राविधिकले छिट्टै जाँच गर्नुपर्छ" : severity === "soon" ? "दोहोरिने वा बढ्दै गएको; समयमै जाँच गराउनुहोस्" : "अहिले सीमित; जाँचमा कामको दायरा पुष्टि गर्नुहोस्";
              const explanation = activeLanguage === "english" ? `Preliminary ${intake.universal.categoryName} triage from the reported symptom and answers. This does not confirm a failed part. A qualified professional must inspect and agree the scope before work.` : activeLanguage === "nepali_romanized" ? `${intake.universal.categoryName} ko symptom ra jawab bata preliminary triage matra ho. Kunai part bigreko confirm bhayeko chaina. Kaam agadi qualified professional le inspect gari scope ma sahmati linu parcha.` : `${intake.universal.categoryName} को लक्षण र जवाफका आधारमा प्रारम्भिक वर्गीकरण मात्र हो। कुनै भाग बिग्रिएको पुष्टि भएको छैन। कामअघि योग्य प्राविधिकले जाँच गरी दायरा सहमत गर्नुपर्छ।`;
              const title = activeLanguage === "english" ? `${intake.universal.categoryName} · ${intake.symptom}`.slice(0, 120) : activeLanguage === "nepali_romanized" ? `${intake.universal.categoryName} · ${intake.symptom}`.slice(0, 120) : `${intake.universal.categoryName} · ${intake.symptom}`.slice(0, 120);
              next = { ...intake, step: "diagnosis-review", universal: { ...intake.universal, answers }, issueTitle: title, explanation, urgency };
              diagnostic = { symptom: intake.symptom, issue_title: title, explanation, urgency, severity: severityLabel, photo_assessed: intake.photoAssessed, visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, triage_answers: answers, safety_note: intake.safetyNote, suggested_parts: [] };
              diagnosticAction = "review"; serviceId = intake.serviceId;
              answer = activeLanguage === "english" ? "Here is the limited triage summary. Confirm it to continue to service area and scheduling; no price has been guessed." : activeLanguage === "nepali_romanized" ? "Yo limited triage summary ho. Service area ra time ko lagi confirm garnu hos; price anuman gareko chaina." : "यो सीमित प्रारम्भिक वर्गीकरण हो। सेवा क्षेत्र र समयका लागि पुष्टि गर्नुहोस्; मूल्य अनुमान गरिएको छैन।";
            }
          }
        }
      }
      else if (intake?.step === "diagnosis-review" && forcedQuery === "[[confirm-diagnosis]]" && !currentPhoto) {
        next = { ...intake, step: "area" };
        answer = activeLanguage === "english" ? "Summary accepted for dispatch. Which area or nearby landmark should the professional visit?" : activeLanguage === "nepali_romanized" ? "Limited summary dispatch ko lagi accept bhayo. Professional kun area wa najik ko landmark ma aaunu parcha?" : "सीमित वर्गीकरण dispatch का लागि स्वीकार भयो। प्राविधिक कुन क्षेत्र वा नजिकको landmark मा आउनुपर्छ?";
      } else if (intake?.step === "diagnostic" && !currentPhoto) {
        if (!currentQuestion) {
          next = null;
          answer = textFor(activeLanguage, "The available details do not support another safe, trade-specific question. Please describe the affected component and exact symptom in your own words; I will not switch trades or guess.", "उपलब्ध विवरणले सम्बन्धित कामभित्र अर्को सुरक्षित प्रश्न बनाउन पर्याप्त भएन। प्रभावित उपकरण/भाग र देखिएको लक्षण आफ्नै शब्दमा लेख्नुहोस्; म अर्को कामको विकल्प वा अनुमान प्रस्तुत गर्दिनँ।");
        } else {
          const selected = optionIndex(forcedQuery ?? query, currentQuestion.choices);
          const activeTrade = HOME_ISSUES.find(issue => issue.id === intake.issueId)?.trade as "plumbing" | "electrical" | undefined;
          const followupTrade = detectHomeFaultTrade(query);
          if (selected < 0 && activeTrade && followupTrade === activeTrade) {
            next = { ...intake, symptom: `${intake.symptom} Customer clarification: ${query}`.slice(0, 1200) };
            question = currentQuestion;
            answer = activeTrade === "plumbing"
              ? textFor(activeLanguage, "I’ve kept this in your plumbing diagnosis. For this step, choose the component or symptom that best matches what you can observe.", "यो प्लम्बिङसम्बन्धी समस्या नै हो भनेर राखेको छु। यो चरणका लागि देखिएको भाग वा लक्षणसँग सबैभन्दा मिल्ने विकल्प छान्नुहोस्।")
              : textFor(activeLanguage, "I’ve kept this in your electrical diagnosis. For this step, choose the component or symptom that best matches what you can safely observe.", "यो विद्युतीय समस्या नै हो भनेर राखेको छु। यो चरणका लागि सुरक्षित रूपमा देखिएको भाग वा लक्षणसँग मिल्ने विकल्प छान्नुहोस्।");
          }
          else if (selected < 0 || selected === 3) {
            const trade = HOME_ISSUES.find(issue => issue.id === intake.issueId)?.trade as "plumbing" | "electrical" | undefined;
            next = null; fallbackTrade = trade ?? null; diagnosticAction = "fallback";
            diagnostic = { symptom: `${intake.symptom} Follow-up detail: ${query}`.slice(0, 1200), issue_title: textFor(activeLanguage, "On-site technical inspection", "स्थलमै प्राविधिक जाँच"), explanation: textFor(activeLanguage, "This response is not a supported diagnostic answer. Keep the original report for the Hero to verify on site; no exact fault is inferred.", "यो जवाफ समर्थित निदान विकल्पमा परेन। Hero ले स्थलमै पुष्टि गर्न मूल विवरण राखिएको छ; ठ्याक्कै खराबी अनुमान गरिएको छैन।"), urgency: intake.urgency, trade, severity: diagnosticSeverityLabel(3, activeLanguage), triage_answers: [...intake.answers, ...(selected === 3 ? [selected] : [])].map((selectedAnswer, index, allAnswers) => questionFor(intake.issueId, index, activeLanguage, allAnswers.slice(0, index), intake.faultCode)?.choices[selectedAnswer] ?? "Not recorded"), visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, photo_assessed: intake.photoAssessed, safety_note: intake.safetyNote, suggested_parts: [] };
            answer = textFor(activeLanguage, "This answer does not resolve a supported fault branch. I will stop the questions and offer an on-site inspection.", "यो जवाफले समर्थित खराबी शाखा निश्चित गरेन। प्रश्न रोक्दै स्थलमै जाँचको विकल्प देखाउँछु।");
          }
          else {
            const answers = [...intake.answers, selected];
            if (answers.length < diagnosticQuestionCount(intake.issueId, intake.faultCode)) {
              next = { ...intake, answers };
              question = questionFor(intake.issueId, answers.length, activeLanguage, answers, intake.faultCode) ?? undefined;
              if (question) answer = question.prompt;
              else { next = null; answer = textFor(activeLanguage, "The issue remains unclassified after the available trade-specific questions. A qualified professional must inspect it; no price or repair scope is inferred.", "सम्बन्धित कामका उपलब्ध प्रश्नपछि पनि समस्या वर्गीकृत भएन। योग्य प्राविधिकले स्थलमै जाँच गर्नुपर्छ; मूल्य वा मर्मतको दायरा अनुमान गरिएको छैन।"); }
            } else {
              const code = resolveDiagnosticCode(intake.issueId, answers, intake.faultCode), resolvedServiceId = code ? serviceIdForDiagnosticCode(code) : null;
              const matchedService = resolvedServiceId ? services.find(item => item.id === resolvedServiceId) : undefined;
              if (!code || !matchedService) {
                const trade = HOME_ISSUES.find(issue => issue.id === intake.issueId)?.trade as "plumbing" | "electrical" | undefined;
                next = null;
                fallbackTrade = trade ?? null;
                diagnosticAction = "fallback";
                diagnostic = {
                  symptom: intake.symptom,
                  issue_title: textFor(activeLanguage, "On-site technical inspection", "स्थलमै प्राविधिक जाँच"),
                  explanation: textFor(activeLanguage, "The answers do not resolve a supported fault branch. A qualified Hero should inspect the system and provide a written scope and quote before work starts.", "जवाफबाट समर्थित खराबी शाखा निश्चित भएन। काम सुरु हुनुअघि योग्य Hero ले स्थलमै जाँच गरी लिखित कामको विवरण र मूल्य दिनुपर्छ।"),
                  urgency: intake.urgency,
                  severity: diagnosticSeverityLabel(answers.at(-1) ?? 3, activeLanguage),
                  trade,
                  triage_answers: answers.map((selectedAnswer, index) => questionFor(intake.issueId, index, activeLanguage, answers.slice(0, index), intake.faultCode)?.choices[selectedAnswer] ?? "Not recorded"),
                  photo_assessed: intake.photoAssessed,
                  safety_note: intake.safetyNote,
                  visual_material: intake.visual?.visual_material,
                  visual_mounting: intake.visual?.visual_mounting,
                  visual_defect: intake.visual?.visual_defect,
                  visual_evidence: intake.visual?.visual_evidence ?? [],
                  root_cause_hypothesis: intake.visual?.root_cause_hypothesis,
                  suggested_parts: [],
                };
                answer = textFor(activeLanguage, "The answers do not match a supported fault classification. I will stop here and offer an on-site inspection; no failed part or price is inferred.", "जवाफ समर्थित खराबी वर्गीकरणसँग मिलेन। अब प्रश्न रोक्दै स्थलमै जाँचको विकल्प दिन्छु; बिग्रिएको पार्ट वा मूल्य अनुमान गरिएको छैन।");
              }
              else {
                const title = `${intake.issueTitle} (${code})`, explanation = unconfirmedText(activeLanguage);
                const matchedTrade = HOME_ISSUES.find(issue => issue.id === intake.issueId)?.trade;
                const triageAnswers = answers.map((selectedAnswer, index) => questionFor(intake.issueId, index, activeLanguage, answers.slice(0, index), intake.faultCode)?.choices[selectedAnswer] ?? "Not recorded");
                next = { ...intake, step: "diagnosis-review", serviceId: matchedService.id, diagnosticCode: code, answers, issueTitle: title, explanation };
                diagnostic = { symptom: intake.symptom, issue_title: title, explanation, diagnostic_code: code, diagnostic_basis: intake.photoAssessed ? "photo_and_answers" : "text_and_answers", visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, urgency: intake.urgency, severity: diagnosticSeverityLabel(answers.at(-1) ?? 3, activeLanguage), trade: matchedTrade, triage_answers: triageAnswers, photo_assessed: intake.photoAssessed, safety_note: intake.safetyNote, suggested_parts: [] };
                if (code.includes("ONSITE-INSPECTION") || code === "EL-SITE-INSPECTION") { next = null; diagnosticAction = "fallback"; fallbackTrade = matchedTrade as Message["fallbackTrade"]; } else { diagnosticAction = "review"; serviceId = matchedService.id; }
                if (diagnosticAction === "fallback") answer = textFor(activeLanguage, "The answers did not isolate a supported fault branch. Request an on-site technical inspection; no exact component failure or price is inferred.", "जवाफबाट समर्थित खराबी शाखा निश्चित भएन। स्थलमै प्राविधिक जाँच अनुरोध गर्नुहोस्; ठ्याक्कै बिग्रिएको भाग वा मूल्य अनुमान गरिएको छैन।"); else answer = textFor(activeLanguage, `Limited triage finding: ${code}. ${explanation} Review this classification. I will ask for dispatch details only after you accept it.`, `सीमित प्रारम्भिक निष्कर्ष: ${code}। ${explanation} यो वर्गीकरण समीक्षा गर्नुहोस्। तपाईंले स्वीकार गरेपछि मात्र dispatch विवरण सोधिन्छ।`);
              }
            }
          }
        }
      } else if (intake?.step === "area" && !currentPhoto) {
        if (query.length < 2) answer = textFor(activeLanguage, "Enter a neighborhood or nearby landmark.", "टोल वा नजिकको landmark लेख्नुहोस्।");
        else { next = { ...intake, area: query.slice(0, 180), step: "time" }; answer = activeLanguage === "nepali_romanized" ? "Nepal time anusar kun din ra samaya tapai lai thik huncha?" : textFor(activeLanguage, "What day and time in Nepal time would suit you?", "नेपालको समयअनुसार कुन दिन र समय तपाईंलाई उपयुक्त हुन्छ?"); }
      } else if (intake?.step === "time" && !currentPhoto) {
        const matchedService = services.find(item => item.id === intake.serviceId);
        if (!matchedService || (!intake.diagnosticCode && !intake.universal) || !intake.area) { next = null; answer = textFor(activeLanguage, "The inspection request cannot be prepared from the available details. Please start a new triage.", "उपलब्ध विवरणबाट जाँच अनुरोध तयार गर्न सकिएन। कृपया नयाँ जाँच सुरु गर्नुहोस्।"); }
        else {
          diagnostic = {
            ...intake.inspectionSummary,
            symptom: intake.inspectionSummary?.symptom ?? intake.symptom,
            issue_title: intake.inspectionSummary?.issue_title ?? intake.issueTitle,
            explanation: intake.inspectionSummary?.explanation ?? intake.explanation,
            diagnostic_code: intake.diagnosticCode,
            diagnostic_basis: intake.inspectionSummary?.diagnostic_basis ?? (intake.photoAssessed ? "photo_and_answers" : "text_and_answers"),
            visual_material: intake.inspectionSummary?.visual_material ?? intake.visual?.visual_material,
            visual_mounting: intake.inspectionSummary?.visual_mounting ?? intake.visual?.visual_mounting,
            visual_defect: intake.inspectionSummary?.visual_defect ?? intake.visual?.visual_defect,
            visual_evidence: intake.inspectionSummary?.visual_evidence ?? intake.visual?.visual_evidence ?? [],
            root_cause_hypothesis: intake.inspectionSummary?.root_cause_hypothesis ?? intake.visual?.root_cause_hypothesis,
            urgency: intake.inspectionSummary?.urgency ?? intake.urgency,
            severity: intake.inspectionSummary?.severity ?? diagnosticSeverityLabel(intake.answers.at(-1) ?? 3, activeLanguage),
            trade: intake.inspectionSummary?.trade ?? HOME_ISSUES.find(issue => issue.id === intake.issueId)?.trade,
            triage_answers: intake.inspectionSummary?.triage_answers ?? intake.answers.map((selectedAnswer, index) => questionFor(intake.issueId, index, activeLanguage, intake.answers.slice(0, index), intake.faultCode)?.choices[selectedAnswer] ?? "Not recorded"),
            area: intake.area, preferred_time: query.slice(0, 180),
            photo_assessed: intake.inspectionSummary?.photo_assessed ?? intake.photoAssessed,
            safety_note: intake.inspectionSummary?.safety_note ?? intake.safetyNote,
            suggested_parts: intake.inspectionSummary?.suggested_parts ?? [],
          };
          next = null; diagnosticAction = "dispatch"; serviceId = matchedService.id;
          answer = textFor(activeLanguage, "The inspection request details are ready. No AI price has been calculated; the professional must inspect and provide a written quote for your approval before any repair.", "जाँच अनुरोधका विवरण तयार छन्। एआईले मूल्य गणना गरेको छैन; मर्मतअघि प्राविधिकले स्थलमै जाँच गरी तपाईंको स्वीकृतिका लागि लिखित मूल्य प्रस्ताव दिनुपर्छ।");
        }
      } else if (currentPhoto) {
        const imageDataUrl = await fileAsDataUrl(currentPhoto);
      const response = await fetch("/api/diagnostics", { method: "POST", signal: requestController.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query || intake?.symptom || "", imageDataUrl, language: activeLanguage, ...(intake ? { expectedIssueId: intake.issueId } : {}) }) });
        const result = await response.json() as PhotoAssessment | { error?: string };
        if (!response.ok) throw new Error((result as { error?: string }).error || "Photo assessment is unavailable.");
        const assessment = result as PhotoAssessment;
        const photoRisk = detectHomeSafetyRisk(`${query} ${assessment.issue_title} ${assessment.safety_note}`);
        if (photoRisk) { answer = riskMessage(photoRisk, activeLanguage); next = null; }
        else if (assessment.urgency === "urgent") { answer = urgentAssessmentMessage(activeLanguage); next = null; }
        else {
          const classified = HOME_ISSUES.find(candidate => candidate.id === assessment.issue_id) ?? null;
          const textLockedIssue = matchHomeIssue(query);
          const matchedFault = matchHomeFault(`${query} ${intake?.symptom ?? ""} ${assessment.issue_title} ${assessment.explanation} ${assessment.visual_defect} ${assessment.visual_material}`);
          const issue = intake ? HOME_ISSUES.find(candidate => candidate.id === intake.issueId) ?? null : (textLockedIssue ?? classified);
          const sameTrade = !classified || classified.trade === issue?.trade;
          const selectedIssue = sameTrade ? issue : null;
          const serviceMatch = selectedIssue?.serviceId ? services.find(item => item.id === selectedIssue.serviceId) : undefined;
          const visual: VisualEvidence = { visual_clarity: assessment.visual_clarity, visual_material: assessment.visual_material, visual_mounting: assessment.visual_mounting, visual_defect: assessment.visual_defect, visual_evidence: assessment.visual_evidence, root_cause_hypothesis: assessment.root_cause_hypothesis };
          const issueId = selectedIssue?.id ?? "unknown";
          const symptom = query || intake?.symptom || assessment.issue_title;
          const answers = intake?.answers ?? [];
          const faultCode = intake?.faultCode ?? (matchedFault?.issueId === issueId ? matchedFault.code : undefined);
          const followup = questionFor(issueId, answers.length, activeLanguage, answers, faultCode);
          const universalTarget = !selectedIssue ? resolveDiagnosticTarget(`${query} ${assessment.issue_title} ${assessment.explanation} ${assessment.visual_defect} ${assessment.visual_material}`, services) : null;
          const universalFirst = universalTarget ? universalDiagnosticQuestion({ categorySlug: universalTarget.categorySlug, categoryName: universalTarget.categoryName, symptom, step: 0, answers: [], language: activeLanguage }) : null;
          if (!selectedIssue && universalTarget && universalFirst) {
            next = { serviceId: universalTarget.service.id, issueId: "universal", step: "diagnostic", symptom, issueTitle: universalTarget.categoryName, explanation: assessment.explanation, urgency: assessment.urgency, safetyNote: assessment.safety_note || undefined, photoAssessed: true, answers: [], language: activeLanguage, visual, universal: { categorySlug: universalTarget.categorySlug, categoryName: universalTarget.categoryName, answers: [] } };
            question = universalFirst;
            const note = activeLanguage === "english" ? `Photo evidence is preliminary. Category matched: ${universalTarget.categoryName}. ` : activeLanguage === "nepali_romanized" ? `Photo evidence preliminary ho. Category match: ${universalTarget.categoryName}. ` : `तस्बिरका प्रमाण प्रारम्भिक हुन्। सेवा वर्ग: ${universalTarget.categoryName}। `;
            answer = `${note}${universalFirst.prompt}`;
          } else if (!selectedIssue || !followup) {
  next = null;
  fallbackTrade = selectedIssue?.trade ?? (intake ? (HOME_ISSUES.find(item => item.id === intake.issueId)?.trade as "plumbing" | "electrical" | undefined) ?? null : null);
  if (!fallbackTrade) {
    const categories = [...new Map(services.map(item => [item.category_slug, item.category_name])).entries()].slice(0, 4);
    quickReplies = categories.map(([, name]) => ({ label: name, query: name }));

    quickReplies.push({ label: "🛠️ On-Site Assessment / स्थलगत जाँच", query: "[[onsite-inspection]]", action: "inspection" });
  }
  diagnostic = { symptom, issue_title: textFor(activeLanguage, "On-site technical inspection", "स्थलमै प्राविधिक जाँच"), explanation: textFor(activeLanguage, "The available text/photo does not safely resolve a standard fault branch. A Hero should inspect the reported issue and confirm the component on site.", "उपलब्ध विवरण वा तस्बिरबाट मानक खराबी शाखा सुरक्षित रूपमा छुट्याउन सकिएन। Hero ले स्थलमै जाँच गरी भाग पुष्टि गर्नुपर्छ।"), urgency: assessment.urgency, visual_material: visual.visual_material, visual_mounting: visual.visual_mounting, visual_defect: visual.visual_defect, visual_evidence: visual.visual_evidence, root_cause_hypothesis: visual.root_cause_hypothesis, photo_assessed: true, safety_note: assessment.safety_note || undefined, triage_answers: [], suggested_parts: [] };
  diagnosticAction = "fallback";
  answer = textFor(activeLanguage, "This does not match a supported fault branch. Choose the inspection trade below; the original description and visual findings will be included for the Hero. No cause or price is guessed.", "यो समर्थित खराबी शाखासँग मिलेन। तल जाँचको काम छान्नुहोस्; मूल विवरण र तस्बिरबाट देखिएका कुरा Hero लाई पठाइनेछ। कारण वा मूल्य अनुमान गरिने छैन।");
} else {
            next = { serviceId: serviceMatch?.id ?? "unknown", issueId, step: "diagnostic", symptom, issueTitle: localIssueTitle(issueId, assessment.issue_title, activeLanguage), explanation: assessment.explanation, urgency: assessment.urgency, safetyNote: assessment.safety_note || undefined, photoAssessed: true, answers, language: activeLanguage, visual, faultCode };
            const visualNote = assessment.request_closer_photo || assessment.visual_clarity === "poor"
              ? textFor(activeLanguage, "The photo is unclear for identifying the material or exact defect. If safe, send a closer, well-lit photo without touching or moving the item. ", "तस्बिरबाट सामग्री वा खराबीको स्थान स्पष्ट देखिएन। सुरक्षित भएमा, वस्तु नछोई वा नसारी राम्रो उज्यालोमा नजिकको तस्बिर पठाउनुहोस्। ")
              : textFor(activeLanguage, `Visible evidence only: ${assessment.visual_defect || assessment.issue_title}. Material: ${assessment.visual_material || "unclear"}; mounting: ${assessment.visual_mounting || "unclear"}. `, `तस्बिरमा देखिएको प्रमाण: ${assessment.visual_defect || assessment.issue_title}। सामग्री: ${assessment.visual_material || "स्पष्ट छैन"}; जडान: ${assessment.visual_mounting || "स्पष्ट छैन"}। `);
            answer = `${visualNote}${followup.prompt}`; question = followup;
          }
        }
      } else {
        let issue = matchHomeIssue(query), textAssessment: PhotoAssessment | null = null;
        let universalTarget = !issue ? resolveDiagnosticTarget(query, services) : null;
        if (!issue && !universalTarget) {
          try {
            const response = await fetch("/api/diagnostics", { method: "POST", signal: requestController.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query, language: activeLanguage }) });
            if (response.ok) { textAssessment = await response.json() as PhotoAssessment; issue = HOME_ISSUES.find(candidate => candidate.id === textAssessment!.issue_id) ?? null; }
          } catch { /* Text-only trade-specific clarification remains available if the model is unavailable. */ }
        }
        if (!issue && !universalTarget) universalTarget = resolveDiagnosticTarget(`${query} ${textAssessment?.issue_title ?? ""} ${textAssessment?.explanation ?? ""}`, services);
        const issueId = issue?.id ?? "unknown";
        const matchedFault = matchHomeFault(`${query} ${textAssessment?.issue_title ?? ""} ${textAssessment?.explanation ?? ""} ${textAssessment?.visual_defect ?? ""}`);
        const faultCode = matchedFault?.issueId === issueId ? matchedFault.code : undefined;
        const first = questionFor(issueId, 0, activeLanguage, [], faultCode);
        const textRisk = textAssessment ? detectHomeSafetyRisk(`${query} ${textAssessment.issue_title} ${textAssessment.safety_note}`) : null;
        if (textRisk) { next = null; answer = riskMessage(textRisk, activeLanguage); }
        else if (textAssessment?.urgency === "urgent") { next = null; answer = urgentAssessmentMessage(activeLanguage); }
        else if (!issue && universalTarget) {
          const prompt = universalDiagnosticQuestion({ categorySlug: universalTarget.categorySlug, categoryName: universalTarget.categoryName, symptom: query, step: 0, answers: [], language: activeLanguage });
          if (prompt) {
            next = { serviceId: universalTarget.service.id, issueId: "universal", step: "diagnostic", symptom: query, issueTitle: universalTarget.categoryName, explanation: textAssessment?.explanation ?? textFor(activeLanguage, "The service category is identified. Follow-up questions will narrow the affected component and observed failure pattern; this is not a confirmed diagnosis.", "सेवा वर्ग पहिचान भयो। थप प्रश्नले प्रभावित भाग र देखिएको खराबीको ढाँचा छुट्याउनेछ; यो पुष्टि भएको निदान होइन।"), urgency: textAssessment?.urgency ?? extractDiagnosticSeverity(query), safetyNote: textAssessment?.safety_note || undefined, photoAssessed: false, answers: [], language: activeLanguage, universal: { categorySlug: universalTarget.categorySlug, categoryName: universalTarget.categoryName, answers: [] } };
            question = prompt;
            answer = activeLanguage === "english" ? `I matched this to ${universalTarget.categoryName}. I’ll keep questions specific to this service and the issue you described. ${prompt.prompt}` : activeLanguage === "nepali_romanized" ? `Yo ${universalTarget.categoryName} service sanga match bhayo. Tapai le bhannu bhayeko issue anusar targeted questions sodhchu. ${prompt.prompt}` : `यो ${universalTarget.categoryName} सेवासँग मिल्यो। तपाईंले बताउनुभएको समस्याअनुसार सम्बन्धित प्रश्न सोध्छु। ${prompt.prompt}`;
          } else {
            next = null; answer = textFor(activeLanguage, "The selected service needs a qualified on-site assessment.", "छानिएको सेवाका लागि योग्य प्राविधिकको स्थलमै जाँच आवश्यक छ।");
          }
        }
        else if (!issue || !first) {
          const inferredTrade = detectHomeFaultTrade(query) ?? issue?.trade;
          next = null; fallbackTrade = inferredTrade ?? null; diagnosticAction = "fallback";
          diagnostic = { symptom: query, issue_title: textFor(activeLanguage, "On-site technical inspection", "स्थलगत प्राविधिक जाँच"), explanation: textAssessment?.explanation ?? textFor(activeLanguage, "The symptom does not fit a supported fault branch. A qualified Hero should inspect the reported component on site.", "लक्षण समर्थित खराबी शाखासँग मिलेन। योग्य Hero ले बताइएको भाग स्थलमै जाँच गर्नुपर्छ।"), urgency: textAssessment?.urgency ?? "routine", trade: inferredTrade, visual_material: textAssessment?.visual_material, visual_mounting: textAssessment?.visual_mounting, visual_defect: textAssessment?.visual_defect, visual_evidence: textAssessment?.visual_evidence ?? [], root_cause_hypothesis: textAssessment?.root_cause_hypothesis, photo_assessed: false, safety_note: textAssessment?.safety_note || undefined, triage_answers: [], suggested_parts: [] };
          if (!inferredTrade) {
            const categories = [...new Map(services.map(item => [item.category_slug, item.category_name])).entries()].slice(0, 4);
            quickReplies = categories.map(([, name]) => ({ label: name, query: name }));

            quickReplies.push({ label: "🛠️ On-Site Assessment / स्थलगत जाँच", query: "[[onsite-inspection]]", action: "inspection" });
          }
          answer = textFor(activeLanguage, "I could not confidently match that description to a supported fault tree. Choose a quick reply or request an on-site inspection below; no cause or price is guessed.", "यो विवरणलाई समर्थित खराबी शाखामा विश्वासपूर्वक राख्न सकिएन। छिटो विकल्प वा तलको स्थलमै जाँच छान्नुहोस्; कारण वा मूल्य अनुमान गरिएको छैन।");
        } else {
          const match = issue.serviceId ? services.find(item => item.id === issue!.serviceId) : undefined;
          const visual = textAssessment ? { visual_clarity: textAssessment.visual_clarity, visual_material: textAssessment.visual_material, visual_mounting: textAssessment.visual_mounting, visual_defect: textAssessment.visual_defect, visual_evidence: textAssessment.visual_evidence, root_cause_hypothesis: textAssessment.root_cause_hypothesis } : undefined;
          next = { serviceId: match?.id ?? "unknown", issueId, step: "diagnostic", symptom: query, issueTitle: textAssessment ? localIssueTitle(issueId, textAssessment.issue_title, activeLanguage) : localIssueTitle(issueId, issue.title, activeLanguage), explanation: textAssessment?.explanation ?? textFor(activeLanguage, "Symptoms alone do not confirm a failed component.", "लक्षणबाट मात्र कुन भाग बिग्रिएको हो पुष्टि हुँदैन।"), urgency: textAssessment?.urgency ?? (issue.id === "muddy-water" ? "soon" : "routine"), safetyNote: textAssessment?.safety_note || undefined, photoAssessed: false, answers: [], language: activeLanguage, visual, faultCode };
          answer = textFor(activeLanguage, `${textAssessment?.visual_defect ? `Reported evidence: ${textAssessment.visual_defect}. ` : ""}The symptom alone does not confirm a failure. ${first.prompt}`, `${textAssessment?.visual_defect ? `बताइएको प्रमाण: ${textAssessment.visual_defect}। ` : ""}लक्षणबाट मात्र खराबी पुष्टि हुँदैन। ${first.prompt}`);
          question = first;
        }
      }
      setIntake(next);
      setMessages(old => [...old, { id: crypto.randomUUID(), role: "assistant" as const, text: answer, question, quickReplies, diagnosticAction, diagnostic, serviceId, fallbackTrade }].slice(-32));
    } catch (error) {
      if (requestController.signal.aborted || !mountedRef.current) return;
      setIntake(intake);
      const fallback = textFor(activeLanguage, "Assessment failed. Describe the issue in text; safety checks remain available. No photo or transcript was saved.", "जाँच हुन सकेन। जोखिम जाँचका लागि समस्या शब्दमा लेख्नुहोस्। तस्बिर वा संवाद सुरक्षित गरिएको छैन।");
      setMessages(old => [...old, { id: crypto.randomUUID(), role: "assistant" as const, text: fallback }].slice(-32));
    } finally { if (requestControllerRef.current === requestController) requestControllerRef.current = null; if (mountedRef.current) setBusy(false); }
  }
  function startInspectionFallback(trade: "plumbing" | "electrical", summary: DiagnosticDraft) {
    const activeLanguage = language ?? "english";
    const code: SupportedDiagnosticCode = trade === "plumbing" ? "PL-ONSITE-INSPECTION" : "EL-ONSITE-INSPECTION";
    const serviceId = serviceIdForDiagnosticCode(code);
    const service = serviceId ? services.find(item => item.id === serviceId) : undefined;
    if (!service) { setVoiceError(textFor(activeLanguage, "The inspection category is unavailable. Please contact support.", "जाँच सेवा वर्ग उपलब्ध छैन। कृपया सहायता लिनुहोस्।")); return; }
    const issueId = trade === "plumbing" ? "pipe-leak" : "no-power";
    const issueTitle = textFor(activeLanguage, `${trade === "plumbing" ? "Plumbing" : "Electrical"} on-site technical inspection`, trade === "plumbing" ? "प्लम्बिङको स्थलमै प्राविधिक जाँच" : "विद्युतीय कामको स्थलमै प्राविधिक जाँच");
    const visual = summary.photo_assessed ? { visual_clarity: "limited" as const, visual_material: summary.visual_material ?? "", visual_mounting: summary.visual_mounting ?? "", visual_defect: summary.visual_defect ?? "", visual_evidence: summary.visual_evidence ?? [], root_cause_hypothesis: summary.root_cause_hypothesis ?? "" } : undefined;
    setIntake({ serviceId: service.id, issueId, step: "area", symptom: summary.symptom, issueTitle, explanation: summary.explanation, urgency: summary.urgency, safetyNote: summary.safety_note, photoAssessed: summary.photo_assessed, diagnosticCode: code, answers: [], language: activeLanguage, visual, inspectionSummary: summary });
    setMessages(old => [...old, { id: crypto.randomUUID(), role: "assistant" as const, text: textFor(activeLanguage, "Inspection request selected. Which Kathmandu Valley area or nearby landmark should the Hero visit?", "स्थलमै जाँच छानियो। Hero कुन उपत्यकाको क्षेत्र वा नजिकको landmark मा आउनुपर्छ?") }].slice(-32));
  }
  function continueToBooking(serviceId: string, diagnostic: DiagnosticDraft) {
    const service = services.find(item => item.id === serviceId); if (!service) { setVoiceError(textFor(language ?? "english", "The service category is unavailable. Please try again later.", "सेवा वर्ग उपलब्ध छैन। कृपया पछि पुनः प्रयास गर्नुहोस्।")); return; }
    try { const prefill = diagnosticBookingPrefillSchema.parse({ category_slug: service.category_slug, duration_minutes: service.duration_minutes, diagnostic }); sessionStorage.setItem(DIAGNOSTIC_PREFILL_STORAGE_KEY, JSON.stringify(prefill)); router.push(`/book?category=${encodeURIComponent(service.category_slug)}&inspection=1`); }
    catch { setVoiceError(textFor(language ?? "english", "Could not prepare the inspection request. Please start again or contact support.", "जाँच अनुरोध तयार गर्न सकिएन। कृपया पुनः सुरु गर्नुहोस् वा सहायता लिनुहोस्।")); }
  }
  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setVoiceError(textFor(language ?? "english", "Voice dictation is unavailable in this browser. You can still type your message.", "यो ब्राउजरमा आवाजबाट लेख्ने सुविधा उपलब्ध छैन। तपाईं सन्देश टाइप गर्न सक्नुहुन्छ।")); return; }
    try { const recognition = new Speech(); recognition.lang = language === "english" ? "en-NP" : "ne-NP"; recognition.continuous = false; recognition.interimResults = true; recognitionRef.current = recognition; recognition.onresult = event => { const result = event.results[event.results.length - 1]; if (result?.[0]) setInput(result[0].transcript); }; recognition.onerror = () => { setVoiceError(textFor(language ?? "english", "Microphone access or speech recognition failed. Check permissions or type instead.", "माइक्रोफोन वा आवाज पहिचानमा समस्या भयो। अनुमति जाँच्नुहोस् वा टाइप गर्नुहोस्।")); setListening(false); }; recognition.onend = () => setListening(false); setVoiceError(""); setListening(true); recognition.start(); }
    catch { setListening(false); setVoiceError(textFor(language ?? "english", "Could not start voice dictation. Type your message instead.", "आवाजबाट लेख्न सुरु गर्न सकिएन। कृपया टाइप गर्नुहोस्।")); }
  }
  const uiLanguage = language ?? "english";
  return <div className="mk-assistant">
    {open && <section className="mk-assistant-panel" aria-label={textFor(uiLanguage, "Home service diagnostic guide", "घरायसी सेवा निदान सहायक")}>
      <header><div className="mk-assistant-avatar"><Sparkles size={17} /></div><div><b>{textFor(uiLanguage, "Home service triage", "घरायसी सेवा प्रारम्भिक जाँच")}</b><small>{textFor(uiLanguage, "Safety · evidence · inspection booking", "सुरक्षा · प्रमाण · जाँच बुकिङ")}</small></div><button type="button" onClick={() => { recognitionRef.current?.stop(); setOpen(false); }} aria-label={textFor(uiLanguage, "Close assistant", "सहायक बन्द गर्नुहोस्")}><X size={18} /></button></header>
      {!language && <div className="mk-language-gate" role="group" aria-label="Select diagnostic language"><strong>Choose a language or start typing / भाषा छान्नुहोस् वा लेख्न सुरु गर्नुहोस्</strong><div><button type="button" onClick={() => selectLanguage("english")}>English</button><button type="button" onClick={() => selectLanguage("nepali_devanagari")}>नेपाली (Devanagari)</button><button type="button" onClick={() => selectLanguage("nepali_romanized")}>Romanized Nepali</button></div><small>Type in English, Nepali script, or Romanized Nepali to detect your language. It stays consistent for this session. / लेख्न सुरु गर्दा भाषा पहिचान हुन्छ र सत्रभरि स्थिर रहन्छ।</small></div>}
      <>
        <div className="mk-chat-messages" ref={scrollRef} aria-live="polite">{messages.map(message => <div key={message.id} className={`mk-chat-message mk-chat-${message.role}`}><p>{message.text}</p>{message.question && <div className="mk-diagnostic-choices">{message.question.choices.map((choice, index) => <button key={choice} type="button" disabled={busy} onClick={() => void send(undefined, `[[${index}]]${choice}`)}><b>{String.fromCharCode(65 + index)})</b> {choice}</button>)}</div>}{message.quickReplies && <div className="mk-diagnostic-choices">{message.quickReplies.map(reply => <button key={reply.query} type="button" disabled={busy} onClick={() => void send(undefined, reply.query)}>{reply.label}</button>)}</div>}{message.diagnostic && message.diagnosticAction === "review" && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(uiLanguage, "LIMITED TRIAGE CLASSIFICATION", "सीमित प्रारम्भिक वर्गीकरण")}{message.diagnostic.diagnostic_code ? ` · ${message.diagnostic.diagnostic_code}` : message.serviceId ? ` · ${message.serviceId}` : ""}</span><b>{message.diagnostic.issue_title}</b><small>{message.diagnostic.explanation}</small>{message.diagnostic.photo_assessed && <small>{textFor(uiLanguage, "Visual evidence", "तस्बिरमा देखिएको प्रमाण")}: {[message.diagnostic.visual_material, message.diagnostic.visual_mounting, message.diagnostic.visual_defect, ...(message.diagnostic.visual_evidence ?? [])].filter(Boolean).join(" · ") || textFor(uiLanguage, "No specific defect is clear in the image.", "तस्बिरमा कुनै निश्चित खराबी स्पष्ट देखिँदैन।")}</small>}{message.diagnostic.root_cause_hypothesis && <small>{textFor(uiLanguage, "Unconfirmed possibility", "पुष्टि नभएको सम्भावित कारण")}: {message.diagnostic.root_cause_hypothesis}</small>}<small>{message.diagnostic.trade === "electrical" ? textFor(uiLanguage, "Electrical work requires on-site inspection. This triage does not set a price.", "विद्युतीय कामका लागि स्थलमै जाँच आवश्यक हुन्छ। यो प्रारम्भिक जाँचले मूल्य तोक्दैन।") : textFor(uiLanguage, "This is a limited service-routing summary, not a confirmed diagnosis or price quote. Confirm the written scope with the professional before work.", "यो सीमित सेवा-वर्गीकरण हो, पुष्टि भएको निदान वा मूल्य प्रस्ताव होइन। कामअघि प्राविधिकसँग लिखित दायरा पुष्टि गर्नुहोस्।")}</small><button type="button" disabled={busy} onClick={() => void send(undefined, "[[confirm-diagnosis]]")}>{textFor(uiLanguage, "Accept classification and continue", "वर्गीकरण स्वीकार गरी अगाडि बढ्नुहोस्")}</button></article>}{message.diagnostic && message.diagnosticAction === "fallback" && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(uiLanguage, "ON-SITE INSPECTION FALLBACK", "स्थलमै जाँचको विकल्प")}</span><b>{message.diagnostic.issue_title}</b><small>{message.diagnostic.explanation}</small>{message.diagnostic.photo_assessed && <small>{textFor(uiLanguage, "Transient photo findings", "क्षणिक तस्बिर निष्कर्ष")}: {[message.diagnostic.visual_material, message.diagnostic.visual_defect, ...(message.diagnostic.visual_evidence ?? [])].filter(Boolean).join(" · ") || textFor(uiLanguage, "No specific visual finding", "विशेष दृश्य निष्कर्ष छैन")}</small>}<div className="mk-fallback-actions">{message.fallbackTrade ? <button type="button" onClick={() => startInspectionFallback(message.fallbackTrade!, message.diagnostic!)}>{textFor(uiLanguage, message.fallbackTrade === "plumbing" ? "Request plumbing inspection" : "Request electrical inspection", message.fallbackTrade === "plumbing" ? "प्लम्बिङ जाँच अनुरोध" : "विद्युतीय जाँच अनुरोध")}</button> : <p>{textFor(uiLanguage, "Choose a service category above, or describe the service you need.", "माथि सेवा वर्ग छान्नुहोस् वा आवश्यक सेवा बताउनुहोस्।")}</p>}</div></article>}{message.diagnostic && message.diagnosticAction === "dispatch" && message.serviceId && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(uiLanguage, "INSPECTION REQUEST", "जाँच अनुरोध")}{message.diagnostic.diagnostic_code ? ` · ${message.diagnostic.diagnostic_code}` : ""}</span><b>{message.diagnostic.issue_title}</b><small>{textFor(uiLanguage, "Area", "क्षेत्र")}: {message.diagnostic.area} · {textFor(uiLanguage, "Requested time", "अनुरोध गरिएको समय")}: {message.diagnostic.preferred_time}</small><small>{textFor(uiLanguage, "Quote pending. No repair or price is approved until the professional has inspected the issue and you accept a written quote.", "मूल्य प्रस्ताव बाँकी छ। प्राविधिकले जाँच गरी तपाईंले लिखित मूल्य प्रस्ताव स्वीकार नगरेसम्म मर्मत वा मूल्य स्वीकृत हुँदैन।")}</small><button type="button" onClick={() => continueToBooking(message.serviceId!, message.diagnostic!)}>{textFor(uiLanguage, "Continue to inspection booking", "जाँच बुकिङ अगाडि बढाउनुहोस्")}</button></article>}</div>)}</div>
        {busy && <p className="mk-voice-error" role="status">{textFor(uiLanguage, "Reviewing the evidence", "प्रमाण जाँच हुँदैछ")}{photo ? textFor(uiLanguage, " and photo…", " र तस्बिर…") : "…"}</p>}{voiceError && <p className="mk-voice-error" role="status">{voiceError}</p>}
        {photo && <div className="mk-photo-attachment"><img src={photoPreview ?? ""} alt={textFor(uiLanguage, "Selected photo preview", "छानिएको तस्बिरको पूर्वावलोकन")} /><span>{photo.name} · {textFor(uiLanguage, "used for this assessment only; not saved", "यो जाँचका लागि मात्र; सुरक्षित राखिँदैन")}</span><button type="button" onClick={() => { if (photoPreview) { URL.revokeObjectURL(photoPreview); previewUrls.current = previewUrls.current.filter(url => url !== photoPreview); } setPhoto(null); setPhotoPreview(null); }} aria-label={textFor(uiLanguage, "Remove attached photo", "जोडिएको तस्बिर हटाउनुहोस्")}><X size={14} /></button></div>}
        <form className="mk-assistant-compose" onSubmit={event => void send(event)}><button type="button" className={listening ? "is-listening" : ""} onClick={toggleVoice} aria-label={listening ? textFor(uiLanguage, "Stop voice dictation", "आवाजबाट लेख्न रोक्नुहोस्") : textFor(uiLanguage, "Start voice dictation", "आवाजबाट लेख्न सुरु गर्नुहोस्")}><Mic size={18} /></button><input value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? textFor(uiLanguage, "Listening…", "सुन्दैछ…") : language ? textFor(uiLanguage, "Describe what you notice", "के देख्नुभएको छ लेख्नुहोस्") : "Describe the issue in English or Nepali / समस्या लेख्नुहोस्"} aria-label={textFor(uiLanguage, "Describe the home-service problem", "घरायसी सेवाको समस्या बताउनुहोस्")} /><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} hidden /><button type="button" onClick={() => fileRef.current?.click()} aria-label={textFor(uiLanguage, "Attach a JPG, PNG or WebP photo", "JPG, PNG वा WebP तस्बिर जोड्नुहोस्")}><ImagePlus size={18} /></button><button type="submit" disabled={busy || (!input.trim() && !photo)} aria-label={textFor(uiLanguage, "Send message", "सन्देश पठाउनुहोस्")}><Send size={17} /></button></form>
        <small className="mk-assistant-disclaimer">{textFor(uiLanguage, "No numeric confidence or AI-generated price is presented. Remote image triage cannot confirm concealed faults; electrical work requires an on-site inspection and quote.", "विश्वासको प्रतिशत वा एआईले बनाएको मूल्य देखाइँदैन। टाढाबाट तस्बिर हेरेर लुकेको खराबी पुष्टि हुँदैन; विद्युतीय कामका लागि स्थलमै जाँच र मूल्य प्रस्ताव आवश्यक हुन्छ।")}</small>
      </>
    </section>}
    <button className="mk-assistant-launch" onClick={() => setOpen(value => !value)} aria-label={open ? textFor(uiLanguage, "Close assistant", "सहायक बन्द गर्नुहोस्") : textFor(uiLanguage, "Open assistant", "सहायक खोल्नुहोस्")}>{open ? <X size={21} /> : <><Bot size={21} /><span>{textFor(uiLanguage, "Ask about a home issue", "घरायसी समस्याबारे सोध्नुहोस्")}</span></>}</button>
  </div>;
}
