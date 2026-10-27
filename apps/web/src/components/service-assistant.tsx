"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bot, ImagePlus, Mic, Send, Sparkles, X } from "lucide-react";
import { diagnosticBookingPrefillSchema, diagnosticQuestion, detectHomeSafetyRisk, DIAGNOSTIC_PREFILL_STORAGE_KEY, HOME_ISSUES, matchHomeIssue, resolveDiagnosticCode, serviceIdForDiagnosticCode, type DiagnosticDraft, type DiagnosticLanguage, type DiagnosticQuestion, type SupportedDiagnosticCode } from "@tirkha/shared";
import { useRouter } from "next/navigation";
import { useMarketplace } from "./marketplace-provider";

type SpeechResultEvent = Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: Event) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
type VisualEvidence = { visual_clarity: "clear" | "limited" | "poor" | "not_applicable"; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string };
type Intake = { serviceId: string; issueId: string; step: "diagnostic" | "diagnosis-review" | "area" | "time"; symptom: string; issueTitle: string; explanation: string; urgency: "routine" | "soon" | "urgent"; safetyNote?: string; photoAssessed: boolean; area?: string; diagnosticCode?: SupportedDiagnosticCode; answers: number[]; language: DiagnosticLanguage; visual?: VisualEvidence };
type Message = { id: string; role: "assistant" | "user"; text: string; question?: DiagnosticQuestion; diagnosticAction?: "review" | "dispatch"; diagnostic?: DiagnosticDraft; serviceId?: string };
type PhotoAssessment = { issue_title: string; explanation: string; issue_id: string; visual_clarity: VisualEvidence["visual_clarity"]; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string; urgency: "routine" | "soon" | "urgent"; safety_note: string; photo_assessed: boolean; request_closer_photo: boolean; clarification_question: string; clarification_choices: string[]; language: DiagnosticLanguage };
function fileAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read this image.")); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image.")); reader.readAsDataURL(file); }); }
function riskMessage(risk: "electric" | "water-electric" | "gas", language: DiagnosticLanguage) {
  if (language !== "english") {
    if (risk === "gas") return "यो ग्याससम्बन्धी तत्काल जोखिम हुन सक्छ। सबैलाई बाहिर सुरक्षित ठाउँमा लैजानुहोस्; आगो वा स्विच नचलाउनुहोस्। बाहिर पुगेपछि स्थानीय आपतकालीन सेवा वा ग्यास आपूर्तिकर्तालाई सम्पर्क गर्नुहोस्।";
    if (risk === "water-electric") return "पानी र बिजुली वा करेन्टको झट्का खतरनाक हुन सक्छ। त्यस ठाउँबाट टाढा रहनुहोस्, पानी वा उपकरण नछुनुहोस्, र योग्य आपतकालीन सहायता बोलाउनुहोस्। असुरक्षित ठाउँको मेन स्विच नछुनुहोस्।";
    return "झिल्का, धुवाँ वा जलेको गन्ध तत्काल जोखिमको संकेत हुन सक्छ। उपकरणबाट टाढा रहनुहोस् र स्थानीय आपतकालीन सेवा वा विद्युत् प्राधिकरणलाई सम्पर्क गर्नुहोस्।";
  }
  if (risk === "gas") return "This may be an immediate gas hazard. Take everyone outside; avoid flames and electrical switches. Once outside, contact local emergency services or your gas supplier.";
  if (risk === "water-electric") return "Water near electricity or an electric shock can be dangerous. Keep away, do not touch the water or equipment, and contact qualified emergency help. Do not approach a main switch if the area is unsafe.";
  return "Sparks, smoke or a burning smell can signal an immediate hazard. Keep away from the equipment and contact local emergency or utility help.";
}
function textFor(language: DiagnosticLanguage, english: string, nepali: string) { return language === "english" ? english : nepali; }
function questionFor(issueId: string, step: number, language: DiagnosticLanguage, previousAnswers: readonly number[] = []): DiagnosticQuestion | null {
  return diagnosticQuestion(issueId, step, language, previousAnswers);
}
function optionIndex(answer: string, choices: string[]) { const encoded = answer.match(/^\[\[(\d+)\]\]/); return encoded ? Number(encoded[1]) : choices.findIndex(choice => choice.toLocaleLowerCase() === answer.trim().toLocaleLowerCase()); }
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
  const scrollRef = useRef<HTMLDivElement>(null), recognitionRef = useRef<SpeechRecognitionLike | null>(null), fileRef = useRef<HTMLInputElement>(null), previewUrls = useRef<string[]>([]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open, busy]);
  useEffect(() => { const reveal = () => setOpen(true); window.addEventListener("tirkha:open-assistant", reveal); return () => window.removeEventListener("tirkha:open-assistant", reveal); }, []);
  useEffect(() => () => { recognitionRef.current?.stop(); previewUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
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
    setMessages([{ id: "welcome", role: "assistant", text: selected === "english" ? "Describe the fault or attach a clear photo. I will check immediate hazards first, ask up to five trade-specific questions, then show a limited finding for your review. I do not provide AI-generated prices or claim a diagnosis is 95% accurate." : "समस्या छोटकरीमा लेख्नुहोस् वा स्पष्ट तस्बिर जोड्नुहोस्। पहिले तत्काल जोखिम जाँचेर, सम्बन्धित कामका बढीमा पाँच प्रश्न सोध्छु र सीमित प्रारम्भिक निष्कर्ष समीक्षा गर्न देखाउँछु। म एआईबाट मूल्य अनुमान वा ९५% निदानको दाबी गर्दिनँ।" }]);
  }
  async function send(event?: FormEvent, forcedQuery?: string) {
    event?.preventDefault();
    const lockedLanguage = language;
    if (!lockedLanguage) return;
    const query = forcedQuery?.replace(/^\[\[\d+\]\]/, "").trim() ?? input.trim();
    if (!query && !photo) return;
    if (busy) return;
    const currentPhoto = photo;
    const currentPreview = photoPreview;
    const activeLanguage = lockedLanguage;
    const currentQuestion = intake?.step === "diagnostic" ? questionFor(intake.issueId, intake.answers.length, activeLanguage, intake.answers) : null;
    const acceptedText = forcedQuery === "[[confirm-diagnosis]]" ? textFor(activeLanguage, "Accepted classification; continue", "वर्गीकरण स्वीकार गरियो; अगाडि बढ्नुहोस्") : query;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: acceptedText || (activeLanguage === "english" ? "Photo submitted for triage." : "जाँचका लागि तस्बिर पठाइयो।") };
    setMessages(old => [...old, userMessage].slice(-32));
    setInput(""); setPhoto(null); setPhotoPreview(null); setVoiceError(""); setBusy(true);
    if (currentPreview) { URL.revokeObjectURL(currentPreview); previewUrls.current = previewUrls.current.filter(url => url !== currentPreview); }
    try {
      let next: Intake | null = intake, answer = "", question: DiagnosticQuestion | undefined, diagnostic: DiagnosticDraft | undefined, diagnosticAction: Message["diagnosticAction"], serviceId: string | undefined;
      const risk = detectHomeSafetyRisk(query);
      if (risk) { answer = riskMessage(risk, activeLanguage); next = null; }
      else if (intake?.step === "diagnosis-review" && forcedQuery === "[[confirm-diagnosis]]" && !currentPhoto) {
        next = { ...intake, step: "area" };
        answer = textFor(activeLanguage, "Classification accepted for dispatch. Which Kathmandu area or landmark should the professional visit?", "सीमित वर्गीकरण स्वीकार गरियो। प्राविधिक कुन टोल वा landmark मा आउनुपर्छ?");
      } else if (intake?.step === "diagnostic" && !currentPhoto) {
        if (!currentQuestion) {
          next = null;
          answer = textFor(activeLanguage, "The available details do not support another safe, trade-specific question. Please describe the affected component and exact symptom in your own words; I will not switch trades or guess.", "उपलब्ध विवरणले सम्बन्धित कामभित्र अर्को सुरक्षित प्रश्न बनाउन पर्याप्त भएन। प्रभावित उपकरण/भाग र देखिएको लक्षण आफ्नै शब्दमा लेख्नुहोस्; म अर्को कामको विकल्प वा अनुमान प्रस्तुत गर्दिनँ।");
        } else {
          const selected = optionIndex(forcedQuery ?? query, currentQuestion.choices);
          if (selected < 0) { question = currentQuestion; answer = currentQuestion.prompt; }
          else {
            const answers = [...intake.answers, selected];
            if (answers.length < 5) {
              next = { ...intake, answers };
              question = questionFor(intake.issueId, answers.length, activeLanguage, answers) ?? undefined;
              if (question) answer = question.prompt;
              else { next = null; answer = textFor(activeLanguage, "The issue remains unclassified after the available trade-specific questions. A qualified professional must inspect it; no price or repair scope is inferred.", "सम्बन्धित कामका उपलब्ध प्रश्नपछि पनि समस्या वर्गीकृत भएन। योग्य प्राविधिकले स्थलमै जाँच गर्नुपर्छ; मूल्य वा मर्मतको दायरा अनुमान गरिएको छैन।"); }
            } else {
              const code = resolveDiagnosticCode(intake.issueId, answers), resolvedServiceId = code ? serviceIdForDiagnosticCode(code) : null;
              const matchedService = resolvedServiceId ? services.find(item => item.id === resolvedServiceId) : undefined;
              if (!code || !matchedService) { next = null; answer = textFor(activeLanguage, "Those answers do not resolve a supported failure classification. I will not infer a failed part or price. A qualified professional must inspect the system and provide a written scope and quote before work starts.", "यी जवाफबाट समर्थित खराबी वर्गीकरण निश्चित भएन। म बिग्रिएको पार्ट वा मूल्य अनुमान गर्दिनँ। काम सुरु हुनुअघि योग्य प्राविधिकले स्थलमै जाँच गरी लिखित कामको विवरण र मूल्य दिनुपर्छ।"); }
              else {
                const title = `${intake.issueTitle} (${code})`, explanation = unconfirmedText(activeLanguage);
                next = { ...intake, step: "diagnosis-review", serviceId: matchedService.id, diagnosticCode: code, answers, issueTitle: title, explanation };
                diagnostic = { symptom: intake.symptom, issue_title: title, explanation, diagnostic_code: code, diagnostic_basis: intake.photoAssessed ? "photo_and_answers" : "text_and_answers", visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, urgency: intake.urgency, photo_assessed: intake.photoAssessed, safety_note: intake.safetyNote, suggested_parts: [] };
                diagnosticAction = "review"; serviceId = matchedService.id;
                answer = textFor(activeLanguage, `Limited triage finding: ${code}. ${explanation} Review this classification. I will ask for dispatch details only after you accept it.`, `सीमित प्रारम्भिक निष्कर्ष: ${code}। ${explanation} यो वर्गीकरण समीक्षा गर्नुहोस्। तपाईंले स्वीकार गरेपछि मात्र dispatch विवरण सोधिन्छ।`);
              }
            }
          }
        }
      } else if (intake?.step === "area" && !currentPhoto) {
        if (query.length < 2) answer = textFor(activeLanguage, "Enter a neighborhood or nearby landmark.", "टोल वा नजिकको landmark लेख्नुहोस्।");
        else { next = { ...intake, area: query.slice(0, 180), step: "time" }; answer = textFor(activeLanguage, "What day and time in Nepal time would suit you?", "नेपालको समयअनुसार कुन दिन र समय तपाईंलाई उपयुक्त हुन्छ?"); }
      } else if (intake?.step === "time" && !currentPhoto) {
        const matchedService = services.find(item => item.id === intake.serviceId);
        if (!matchedService || !intake.diagnosticCode || !intake.area) { next = null; answer = textFor(activeLanguage, "The inspection request cannot be prepared from the available details. Please start a new triage.", "उपलब्ध विवरणबाट जाँच अनुरोध तयार गर्न सकिएन। कृपया नयाँ जाँच सुरु गर्नुहोस्।"); }
        else {
          diagnostic = { symptom: intake.symptom, issue_title: intake.issueTitle, explanation: intake.explanation, diagnostic_code: intake.diagnosticCode, diagnostic_basis: intake.photoAssessed ? "photo_and_answers" : "text_and_answers", visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, urgency: intake.urgency, area: intake.area, preferred_time: query.slice(0, 180), photo_assessed: intake.photoAssessed, safety_note: intake.safetyNote, suggested_parts: [] };
          next = null; diagnosticAction = "dispatch"; serviceId = matchedService.id;
          answer = textFor(activeLanguage, "The inspection request details are ready. No AI price has been calculated; the professional must inspect and provide a written quote for your approval before any repair.", "जाँच अनुरोधका विवरण तयार छन्। एआईले मूल्य गणना गरेको छैन; मर्मतअघि प्राविधिकले स्थलमै जाँच गरी तपाईंको स्वीकृतिका लागि लिखित मूल्य प्रस्ताव दिनुपर्छ।");
        }
      } else if (currentPhoto) {
        const imageDataUrl = await fileAsDataUrl(currentPhoto);
        const response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query || intake?.symptom || "", imageDataUrl, language: activeLanguage, ...(intake ? { expectedIssueId: intake.issueId } : {}) }) });
        const result = await response.json() as PhotoAssessment | { error?: string };
        if (!response.ok) throw new Error((result as { error?: string }).error || "Photo assessment is unavailable.");
        const assessment = result as PhotoAssessment;
        const photoRisk = detectHomeSafetyRisk(`${query} ${assessment.issue_title} ${assessment.safety_note}`);
        if (photoRisk || assessment.urgency === "urgent") { answer = riskMessage(photoRisk ?? "electric", activeLanguage); next = null; }
        else {
          const classified = HOME_ISSUES.find(candidate => candidate.id === assessment.issue_id) ?? null;
          const textLockedIssue = matchHomeIssue(query);
          const issue = intake ? HOME_ISSUES.find(candidate => candidate.id === intake.issueId) ?? null : (textLockedIssue ?? classified);
          const sameTrade = !classified || classified.trade === issue?.trade;
          const selectedIssue = sameTrade ? issue : null;
          const serviceMatch = selectedIssue?.serviceId ? services.find(item => item.id === selectedIssue.serviceId) : undefined;
          const visual: VisualEvidence = { visual_clarity: assessment.visual_clarity, visual_material: assessment.visual_material, visual_mounting: assessment.visual_mounting, visual_defect: assessment.visual_defect, visual_evidence: assessment.visual_evidence, root_cause_hypothesis: assessment.root_cause_hypothesis };
          const issueId = selectedIssue?.id ?? "unknown";
          const symptom = query || intake?.symptom || assessment.issue_title;
          const answers = intake?.answers ?? [];
          const followup = questionFor(issueId, answers.length, activeLanguage, answers);
          if (!selectedIssue || !followup) {
            next = null;
            answer = textFor(activeLanguage, "The photo does not establish a safe plumbing or electrical category. Please describe which specific item is affected and what you observed. Do not touch or open it. No cross-trade options or price will be shown.", "तस्बिरबाट सुरक्षित रूपमा प्लम्बिङ वा विद्युतीय काम छुट्याउन सकिएन। कुन उपकरण/भाग प्रभावित छ र के देख्नुभयो भनेर लेख्नुहोस्। नछुनुहोस् वा नखोल्नुहोस्। अर्को कामका विकल्प वा मूल्य देखाइने छैन।");
          } else {
            next = { serviceId: serviceMatch?.id ?? "unknown", issueId, step: "diagnostic", symptom, issueTitle: localIssueTitle(issueId, assessment.issue_title, activeLanguage), explanation: assessment.explanation, urgency: assessment.urgency, safetyNote: assessment.safety_note || undefined, photoAssessed: true, answers, language: activeLanguage, visual };
            const visualNote = assessment.request_closer_photo || assessment.visual_clarity === "poor"
              ? textFor(activeLanguage, "The photo is unclear for identifying the material or exact defect. If safe, send a closer, well-lit photo without touching or moving the item. ", "तस्बिरबाट सामग्री वा खराबीको स्थान स्पष्ट देखिएन। सुरक्षित भएमा, वस्तु नछोई वा नसारी राम्रो उज्यालोमा नजिकको तस्बिर पठाउनुहोस्। ")
              : textFor(activeLanguage, `Visible evidence only: ${assessment.visual_defect || assessment.issue_title}. Material: ${assessment.visual_material || "unclear"}; mounting: ${assessment.visual_mounting || "unclear"}. `, `तस्बिरमा देखिएको प्रमाण: ${assessment.visual_defect || assessment.issue_title}। सामग्री: ${assessment.visual_material || "स्पष्ट छैन"}; जडान: ${assessment.visual_mounting || "स्पष्ट छैन"}। `);
            answer = `${visualNote}${followup.prompt}`; question = followup;
          }
        }
      } else {
        let issue = matchHomeIssue(query), textAssessment: PhotoAssessment | null = null;
        if (!issue) {
          try {
            const response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query, language: activeLanguage }) });
            if (response.ok) { textAssessment = await response.json() as PhotoAssessment; issue = HOME_ISSUES.find(candidate => candidate.id === textAssessment!.issue_id) ?? null; }
          } catch { /* Text-only trade-specific clarification remains available if the model is unavailable. */ }
        }
        const issueId = issue?.id ?? "unknown", first = questionFor(issueId, 0, activeLanguage);
        const textRisk = textAssessment ? detectHomeSafetyRisk(`${query} ${textAssessment.issue_title} ${textAssessment.safety_note}`) : null;
        if (textRisk || textAssessment?.urgency === "urgent") { next = null; answer = riskMessage(textRisk ?? "electric", activeLanguage); }
        else if (!issue || !first) {
          next = null;
          answer = textFor(activeLanguage, "Please identify the affected item (for example, a tap, drain, pipe, outlet, switch, or breaker) and describe exactly what it is doing. I will keep the session within that trade; no price is estimated.", "प्रभावित वस्तु (जस्तै धारा, नाली, पाइप, सकेट, स्विच वा ब्रेकर) र त्यसमा देखिएको लक्षण स्पष्ट लेख्नुहोस्। यो संवाद सोही कामभित्र रहनेछ; मूल्य अनुमान गरिने छैन।");
        } else {
          const match = issue.serviceId ? services.find(item => item.id === issue!.serviceId) : undefined;
          const visual = textAssessment ? { visual_clarity: textAssessment.visual_clarity, visual_material: textAssessment.visual_material, visual_mounting: textAssessment.visual_mounting, visual_defect: textAssessment.visual_defect, visual_evidence: textAssessment.visual_evidence, root_cause_hypothesis: textAssessment.root_cause_hypothesis } : undefined;
          next = { serviceId: match?.id ?? "unknown", issueId, step: "diagnostic", symptom: query, issueTitle: textAssessment ? localIssueTitle(issueId, textAssessment.issue_title, activeLanguage) : localIssueTitle(issueId, issue.title, activeLanguage), explanation: textAssessment?.explanation ?? textFor(activeLanguage, "Symptoms alone do not confirm a failed component.", "लक्षणबाट मात्र कुन भाग बिग्रिएको हो पुष्टि हुँदैन।"), urgency: textAssessment?.urgency ?? (issue.id === "muddy-water" ? "soon" : "routine"), safetyNote: textAssessment?.safety_note || undefined, photoAssessed: false, answers: [], language: activeLanguage, visual };
          answer = textFor(activeLanguage, `${textAssessment?.visual_defect ? `Reported evidence: ${textAssessment.visual_defect}. ` : ""}The symptom alone does not confirm a failure. ${first.prompt}`, `${textAssessment?.visual_defect ? `बताइएको प्रमाण: ${textAssessment.visual_defect}। ` : ""}लक्षणबाट मात्र खराबी पुष्टि हुँदैन। ${first.prompt}`);
          question = first;
        }
      }
      setIntake(next);
      setMessages(old => [...old, { id: crypto.randomUUID(), role: "assistant", text: answer, question, diagnosticAction, diagnostic, serviceId }].slice(-32));
    } catch (error) {
      setIntake(null);
      const fallback = textFor(activeLanguage, "Assessment failed. Describe the issue in text; safety checks remain available. No photo or transcript was saved.", "जाँच हुन सकेन। जोखिम जाँचका लागि समस्या शब्दमा लेख्नुहोस्। तस्बिर वा संवाद सुरक्षित गरिएको छैन।");
      setMessages(old => [...old, { id: crypto.randomUUID(), role: "assistant", text: fallback }].slice(-32));
    } finally { setBusy(false); }
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
      {!language && <div className="mk-language-gate" role="group" aria-label="Select diagnostic language"><strong>Choose a language to begin / निदान सुरु गर्न भाषा छान्नुहोस्</strong><div><button type="button" onClick={() => selectLanguage("english")}>English</button><button type="button" onClick={() => selectLanguage("nepali_devanagari")}>नेपाली (Devanagari)</button></div><small>सुरु गरेपछि भाषा यस सत्रका लागि स्थिर रहनेछ · Language stays fixed for this session</small></div>}
      {language && <>
        <div className="mk-chat-messages" ref={scrollRef} aria-live="polite">{messages.map(message => <div key={message.id} className={`mk-chat-message mk-chat-${message.role}`}><p>{message.text}</p>{message.question && <div className="mk-diagnostic-choices">{message.question.choices.map((choice, index) => <button key={choice} type="button" disabled={busy} onClick={() => void send(undefined, `[[${index}]]${choice}`)}><b>{String.fromCharCode(65 + index)})</b> {choice}</button>)}</div>}{message.diagnostic && message.diagnosticAction === "review" && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(uiLanguage, "LIMITED TRIAGE CLASSIFICATION", "सीमित प्रारम्भिक वर्गीकरण")} · {message.diagnostic.diagnostic_code}</span><b>{message.diagnostic.issue_title}</b><small>{message.diagnostic.explanation}</small>{message.diagnostic.photo_assessed && <small>{textFor(uiLanguage, "Visual evidence", "तस्बिरमा देखिएको प्रमाण")}: {[message.diagnostic.visual_material, message.diagnostic.visual_mounting, message.diagnostic.visual_defect, ...(message.diagnostic.visual_evidence ?? [])].filter(Boolean).join(" · ") || textFor(uiLanguage, "No specific defect is clear in the image.", "तस्बिरमा कुनै निश्चित खराबी स्पष्ट देखिँदैन।")}</small>}{message.diagnostic.root_cause_hypothesis && <small>{textFor(uiLanguage, "Unconfirmed possibility", "पुष्टि नभएको सम्भावित कारण")}: {message.diagnostic.root_cause_hypothesis}</small>}<small>{textFor(uiLanguage, "Electrical work requires on-site inspection. This triage does not set a price.", "विद्युतीय कामका लागि स्थलमै जाँच आवश्यक हुन्छ। यो प्रारम्भिक जाँचले मूल्य तोक्दैन।")}</small><button type="button" disabled={busy} onClick={() => void send(undefined, "[[confirm-diagnosis]]")}>{textFor(uiLanguage, "Accept classification and continue", "वर्गीकरण स्वीकार गरी अगाडि बढ्नुहोस्")}</button></article>}{message.diagnostic && message.diagnosticAction === "dispatch" && message.serviceId && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(uiLanguage, "INSPECTION REQUEST", "जाँच अनुरोध")} · {message.diagnostic.diagnostic_code}</span><b>{message.diagnostic.issue_title}</b><small>{textFor(uiLanguage, "Area", "क्षेत्र")}: {message.diagnostic.area} · {textFor(uiLanguage, "Requested time", "अनुरोध गरिएको समय")}: {message.diagnostic.preferred_time}</small><small>{textFor(uiLanguage, "Quote pending. No repair or price is approved until the professional has inspected the issue and you accept a written quote.", "मूल्य प्रस्ताव बाँकी छ। प्राविधिकले जाँच गरी तपाईंले लिखित मूल्य प्रस्ताव स्वीकार नगरेसम्म मर्मत वा मूल्य स्वीकृत हुँदैन।")}</small><button type="button" onClick={() => continueToBooking(message.serviceId!, message.diagnostic!)}>{textFor(uiLanguage, "Continue to inspection booking", "जाँच बुकिङ अगाडि बढाउनुहोस्")}</button></article>}</div>)}</div>
        {busy && <p className="mk-voice-error" role="status">{textFor(uiLanguage, "Reviewing the evidence", "प्रमाण जाँच हुँदैछ")}{photo ? textFor(uiLanguage, " and photo…", " र तस्बिर…") : "…"}</p>}{voiceError && <p className="mk-voice-error" role="status">{voiceError}</p>}
        {photo && <div className="mk-photo-attachment"><img src={photoPreview ?? ""} alt={textFor(uiLanguage, "Selected photo preview", "छानिएको तस्बिरको पूर्वावलोकन")} /><span>{photo.name} · {textFor(uiLanguage, "used for this assessment only; not saved", "यो जाँचका लागि मात्र; सुरक्षित राखिँदैन")}</span><button type="button" onClick={() => { if (photoPreview) { URL.revokeObjectURL(photoPreview); previewUrls.current = previewUrls.current.filter(url => url !== photoPreview); } setPhoto(null); setPhotoPreview(null); }} aria-label={textFor(uiLanguage, "Remove attached photo", "जोडिएको तस्बिर हटाउनुहोस्")}><X size={14} /></button></div>}
        <form className="mk-assistant-compose" onSubmit={event => void send(event)}><button type="button" className={listening ? "is-listening" : ""} onClick={toggleVoice} aria-label={listening ? textFor(uiLanguage, "Stop voice dictation", "आवाजबाट लेख्न रोक्नुहोस्") : textFor(uiLanguage, "Start voice dictation", "आवाजबाट लेख्न सुरु गर्नुहोस्")}><Mic size={18} /></button><input value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? textFor(uiLanguage, "Listening…", "सुन्दैछ…") : textFor(uiLanguage, "Describe what you notice", "के देख्नुभएको छ लेख्नुहोस्")} aria-label={textFor(uiLanguage, "Describe the home-service problem", "घरायसी सेवाको समस्या बताउनुहोस्")} /><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} hidden /><button type="button" onClick={() => fileRef.current?.click()} aria-label={textFor(uiLanguage, "Attach a JPG, PNG or WebP photo", "JPG, PNG वा WebP तस्बिर जोड्नुहोस्")}><ImagePlus size={18} /></button><button type="submit" disabled={busy || (!input.trim() && !photo)} aria-label={textFor(uiLanguage, "Send message", "सन्देश पठाउनुहोस्")}><Send size={17} /></button></form>
        <small className="mk-assistant-disclaimer">{textFor(uiLanguage, "No numeric confidence or AI-generated price is presented. Remote image triage cannot confirm concealed faults; electrical work requires an on-site inspection and quote.", "विश्वासको प्रतिशत वा एआईले बनाएको मूल्य देखाइँदैन। टाढाबाट तस्बिर हेरेर लुकेको खराबी पुष्टि हुँदैन; विद्युतीय कामका लागि स्थलमै जाँच र मूल्य प्रस्ताव आवश्यक हुन्छ।")}</small>
      </>}
    </section>}
    <button className="mk-assistant-launch" onClick={() => setOpen(value => !value)} aria-label={open ? textFor(uiLanguage, "Close assistant", "सहायक बन्द गर्नुहोस्") : textFor(uiLanguage, "Open assistant", "सहायक खोल्नुहोस्")}>{open ? <X size={21} /> : <><Bot size={21} /><span>{textFor(uiLanguage, "Ask about a home issue", "घरायसी समस्याबारे सोध्नुहोस्")}</span></>}</button>
  </div>;
}






