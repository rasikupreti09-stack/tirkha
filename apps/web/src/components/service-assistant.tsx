"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bot, ImagePlus, Mic, Send, Sparkles, X } from "lucide-react";
import { diagnosticBookingPrefillSchema, diagnosticLanguageForText, diagnosticQuestion, detectHomeSafetyRisk, DIAGNOSTIC_PREFILL_STORAGE_KEY, HOME_ISSUES, matchHomeIssue, resolveDiagnosticCode, serviceIdForDiagnosticCode, type DiagnosticDraft, type DiagnosticLanguage, type DiagnosticQuestion, type SupportedDiagnosticCode } from "@tirkha/shared";
import { useRouter } from "next/navigation";
import { useMarketplace } from "./marketplace-provider";

type SpeechResultEvent = Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: Event) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
type VisualEvidence = { visual_clarity: "clear" | "limited" | "poor" | "not_applicable"; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string };
type Intake = { serviceId: string; issueId: string; step: "diagnostic-q1" | "diagnostic-q2" | "diagnosis-review" | "area" | "time"; symptom: string; issueTitle: string; explanation: string; urgency: "routine" | "soon" | "urgent"; safetyNote?: string; photoAssessed: boolean; area?: string; diagnosticCode?: SupportedDiagnosticCode; answers: number[]; language: DiagnosticLanguage; visual?: VisualEvidence };
type Message = { id: string; role: "assistant" | "user"; text: string; question?: DiagnosticQuestion; diagnosticAction?: "review" | "dispatch"; diagnostic?: DiagnosticDraft; serviceId?: string; photoPreview?: string };
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
function questionFor(issueId: string, step: 0 | 1, language: DiagnosticLanguage): DiagnosticQuestion {
  const known = diagnosticQuestion(issueId, step, language);
  if (known) return known;
  if (language !== "english") return step === 0
    ? { prompt: "समस्या मुख्यतः कहाँ देखिन्छ?", choices: ["पानी वा पाइप", "बत्ती, स्विच वा बिजुली", "उपकरण", "निश्चित छैन"] }
    : { prompt: "यो समस्या कहिले वा कुन अवस्थामा हुन्छ?", choices: ["सधैँ", "कहिलेकाहीँ", "केही चलाउँदा मात्र", "निश्चित छैन"] };
  return step === 0
    ? { prompt: "Where do you mainly notice the problem?", choices: ["Water or pipes", "Lights, switches or power", "An appliance", "I am not sure"] }
    : { prompt: "When does it happen?", choices: ["All the time", "Intermittently", "Only when something is used", "I am not sure"] };
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
}function unconfirmedText(language: DiagnosticLanguage) { return textFor(language, "The reported symptoms match a limited triage classification. This does not confirm the failed component or a hidden cause. An on-site inspection and written quote are required before repair.", "बताइएका लक्षण सीमित प्रारम्भिक वर्गीकरणसँग मिल्छन्। यसले बिग्रिएको पार्ट वा लुकेको कारण पुष्टि गर्दैन। मर्मतअघि स्थलमै जाँच र लिखित मूल्य प्रस्ताव आवश्यक छ।"); }
export function ServiceAssistant() {
  const { services } = useMarketplace();
  const router = useRouter();
  const [open, setOpen] = useState(false), [input, setInput] = useState(""), [listening, setListening] = useState(false), [busy, setBusy] = useState(false), [voiceError, setVoiceError] = useState(""), [photo, setPhoto] = useState<File | null>(null), [photoPreview, setPhotoPreview] = useState<string | null>(null), [intake, setIntake] = useState<Intake | null>(null);
  const welcome = "Describe the fault or attach a clear photo. I will check immediate hazards first, ask up to two technical questions, then show a limited finding for your review. I do not provide AI-generated prices or claim a diagnosis is 95% accurate.";
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", text: welcome }]);
  const scrollRef = useRef<HTMLDivElement>(null), recognitionRef = useRef<SpeechRecognitionLike | null>(null), fileRef = useRef<HTMLInputElement>(null), previewUrls = useRef<string[]>([]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, open, busy]);
  useEffect(() => { const reveal = () => setOpen(true); window.addEventListener("tirkha:open-assistant", reveal); return () => window.removeEventListener("tirkha:open-assistant", reveal); }, []);
  useEffect(() => () => { recognitionRef.current?.stop(); previewUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  function onPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null; event.target.value = ""; if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setVoiceError("Choose a JPG, PNG or WebP photo."); return; }
    if (file.size > 3 * 1024 * 1024) { setVoiceError("Choose a photo under 3 MB."); return; }
    const preview = URL.createObjectURL(file); previewUrls.current.push(preview); setPhoto(file); setPhotoPreview(preview); setVoiceError("");
  }
  async function send(event?: FormEvent, forcedQuery?: string) {
    event?.preventDefault(); const query = forcedQuery?.replace(/^\[\[\d+\]\]/, "").trim() ?? input.trim();
    if (!query && !photo) return; if (busy) return;
    const currentPhoto = photo, currentPreview = photoPreview, recentText = [...messages].reverse().find(message => message.role === "user")?.text ?? "", language = diagnosticLanguageForText(query || intake?.symptom || recentText), activeLanguage = intake && forcedQuery?.startsWith("[[") ? intake.language : language;
    const currentQuestion = intake?.step === "diagnostic-q1" ? questionFor(intake.issueId, 0, intake.language) : intake?.step === "diagnostic-q2" ? questionFor(intake.issueId, 1, intake.language) : undefined;
    const acceptedText = forcedQuery === "[[confirm-diagnosis]]" ? textFor(activeLanguage, "Accepted classification; continue", "वर्गीकरण स्वीकार गरियो; अगाडि बढ्नुहोस्") : query;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: acceptedText || (language === "english" ? "Photo submitted for triage." : "जाँचका लागि तस्बिर पठाइयो।"), photoPreview: currentPreview ?? undefined };
    setMessages(old => [...old, userMessage].slice(-32)); setInput(""); setPhoto(null); setPhotoPreview(null); setVoiceError(""); setBusy(true);
    try {
      let next: Intake | null = intake, answer = "", question: DiagnosticQuestion | undefined, diagnostic: DiagnosticDraft | undefined, diagnosticAction: Message["diagnosticAction"], serviceId: string | undefined;
      const risk = detectHomeSafetyRisk(query);
      if (risk) { answer = riskMessage(risk, language); next = null; }
      else if (intake?.step === "diagnosis-review" && query === "[[confirm-diagnosis]]" && !currentPhoto) {
        next = { ...intake, step: "area" };
        answer = textFor(activeLanguage, "Classification accepted for dispatch. Which Kathmandu area or landmark should the professional visit?", "सीमित वर्गीकरणलाई dispatch का लागि स्वीकार गरियो। प्राविधिक कुन टोल वा landmark मा आउनुपर्छ?");
      } else if (intake?.step === "diagnostic-q1" && !currentPhoto) {
        const selected = optionIndex(forcedQuery ?? query, currentQuestion?.choices ?? []);
        if (selected < 0) { question = currentQuestion; answer = currentQuestion!.prompt; }
        else { next = { ...intake, answers: [selected], step: "diagnostic-q2" }; question = questionFor(intake.issueId, 1, activeLanguage); answer = question.prompt; }
      } else if (intake?.step === "diagnostic-q2" && !currentPhoto) {
        const selected = optionIndex(forcedQuery ?? query, currentQuestion?.choices ?? []);
        if (selected < 0) { question = currentQuestion; answer = currentQuestion!.prompt; }
        else {
          const answers = [...intake.answers, selected], code = resolveDiagnosticCode(intake.issueId, answers), resolvedServiceId = code ? serviceIdForDiagnosticCode(code) : null;
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
        const imageDataUrl = await fileAsDataUrl(currentPhoto), response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query || intake?.symptom || "", imageDataUrl, language: activeLanguage }) });
        const result = await response.json() as PhotoAssessment | { error?: string }; if (!response.ok) throw new Error((result as { error?: string }).error || "Photo assessment is unavailable.");
        const assessment = result as PhotoAssessment, assessmentLanguage = assessment.language === "english" ? "english" : "nepali_devanagari", photoRisk = detectHomeSafetyRisk(`${query} ${assessment.issue_title} ${assessment.safety_note}`);
        if (photoRisk || assessment.urgency === "urgent") { answer = riskMessage(photoRisk ?? "electric", assessmentLanguage); next = null; }
        else {
          const issue = matchHomeIssue(query || intake?.symptom || "") ?? HOME_ISSUES.find(candidate => candidate.id === assessment.issue_id) ?? null;
          const match = issue?.serviceId ? services.find(item => item.id === issue.serviceId) : undefined;
          const issueId = issue?.id ?? "unknown", answers = intake?.answers ?? [], questionIndex = answers.length === 0 ? 0 : answers.length === 1 ? 1 : null;
          const visual: VisualEvidence = { visual_clarity: assessment.visual_clarity, visual_material: assessment.visual_material, visual_mounting: assessment.visual_mounting, visual_defect: assessment.visual_defect, visual_evidence: assessment.visual_evidence, root_cause_hypothesis: assessment.root_cause_hypothesis };
          next = { serviceId: match?.id ?? intake?.serviceId ?? "unknown", issueId, step: questionIndex === 1 ? "diagnostic-q2" : "diagnostic-q1", symptom: query || intake?.symptom || assessment.issue_title, issueTitle: assessment.issue_title, explanation: assessment.explanation, urgency: assessment.urgency, safetyNote: assessment.safety_note || undefined, photoAssessed: true, answers, language: assessmentLanguage, visual };
          if (questionIndex === null) { next = null; answer = textFor(assessmentLanguage, "Two technical questions have already been used. The exact failure remains unconfirmed; arrange an on-site inspection and written quote.", "दुईवटा प्राविधिक प्रश्न सोधिसकिएको छ। वास्तविक खराबी पुष्टि भएको छैन; स्थलमै जाँच र लिखित मूल्य प्रस्ताव आवश्यक छ।"); }
          else {
            question = questionFor(issueId, questionIndex, assessmentLanguage);
            const visualNote = assessment.request_closer_photo || assessment.visual_clarity === "poor"
              ? textFor(assessmentLanguage, "The photo is too unclear to identify the material or defect location. Send a closer, well-lit photo of the joint/component without touching it. ", "तस्बिरबाट सामग्री वा खराबीको स्थान स्पष्ट देखिएन। नछोईकन, राम्रो उज्यालोमा जोड वा उपकरणको नजिकको तस्बिर पठाउनुहोस्। ")
              : textFor(assessmentLanguage, `Visible evidence only: ${assessment.visual_defect || assessment.issue_title}. Material: ${assessment.visual_material || "unclear"}; mounting: ${assessment.visual_mounting || "unclear"}. `, `तस्बिरमा देखिएको प्रमाण: ${assessment.visual_defect || assessment.issue_title}। सामग्री: ${assessment.visual_material || "स्पष्ट छैन"}; जडान: ${assessment.visual_mounting || "स्पष्ट छैन"}। `);
            answer = `${visualNote}${question.prompt}`;
          }
        }
      } else {
        let issue = matchHomeIssue(query), textAssessment: PhotoAssessment | null = null;
        if (!issue) {
          try {
            const response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query, language }) });
            if (response.ok) { textAssessment = await response.json() as PhotoAssessment; issue = HOME_ISSUES.find(candidate => candidate.id === textAssessment!.issue_id) ?? null; }
          } catch { /* Local clarification remains available if the AI service is unavailable. */ }
        }
        const responseLanguage = language === "english" ? "english" : "nepali_devanagari", issueId = issue?.id ?? "unknown", first = questionFor(issueId, 0, responseLanguage), match = issue?.serviceId ? services.find(item => item.id === issue.serviceId) : undefined;
        const textRisk = textAssessment ? detectHomeSafetyRisk(`${query} ${textAssessment.issue_title} ${textAssessment.safety_note}`) : null;
        if (textRisk || textAssessment?.urgency === "urgent") { next = null; answer = riskMessage(textRisk ?? "electric", responseLanguage); } else {
        const visual = textAssessment ? { visual_clarity: textAssessment.visual_clarity, visual_material: textAssessment.visual_material, visual_mounting: textAssessment.visual_mounting, visual_defect: textAssessment.visual_defect, visual_evidence: textAssessment.visual_evidence, root_cause_hypothesis: textAssessment.root_cause_hypothesis } : undefined;
        next = { serviceId: match?.id ?? "unknown", issueId, step: "diagnostic-q1", symptom: query, issueTitle: textAssessment?.issue_title ?? localIssueTitle(issueId, issue?.title ?? "Unclassified issue", responseLanguage), explanation: textAssessment?.explanation ?? "Symptoms alone do not confirm a failed component.", urgency: textAssessment?.urgency ?? (issue?.id === "muddy-water" ? "soon" : "routine"), safetyNote: textAssessment?.safety_note || undefined, photoAssessed: false, answers: [], language: responseLanguage, visual };
        answer = textFor(responseLanguage, `${textAssessment?.visual_defect ? `Reported evidence: ${textAssessment.visual_defect}. ` : ""}The symptom alone does not confirm a failure. ${first.prompt}`, `${textAssessment?.visual_defect ? `बताइएको प्रमाण: ${textAssessment.visual_defect}। ` : ""}लक्षणबाट मात्र खराबी पुष्टि हुँदैन। ${first.prompt}`); question = first;
        }
      }
      const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: answer, question, diagnosticAction, diagnostic, serviceId };
      setIntake(next); setMessages(old => [...old, assistant].slice(-32));
    } catch (error) {
      setIntake(null); const fallbackMessage: Message = { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "Assessment failed. Describe the issue in text; safety checks and technical clarification remain available." }; setMessages(old => [...old, fallbackMessage].slice(-32));
    } finally { setBusy(false); }
  }
  function continueToBooking(serviceId: string, diagnostic: DiagnosticDraft) {
    const service = services.find(item => item.id === serviceId); if (!service) { setVoiceError("The service category is unavailable. Please try again later."); return; }
    try { const prefill = diagnosticBookingPrefillSchema.parse({ category_slug: service.category_slug, duration_minutes: service.duration_minutes, diagnostic }); sessionStorage.setItem(DIAGNOSTIC_PREFILL_STORAGE_KEY, JSON.stringify(prefill)); router.push(`/book?category=${encodeURIComponent(service.category_slug)}&inspection=1`); }
    catch { setVoiceError("Could not prepare the inspection request. Please start again or contact support."); }
  }
  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setVoiceError("Voice dictation is unavailable in this browser. You can still type your message."); return; }
    try { const recognition = new Speech(); recognition.lang = intake?.language === "english" ? "en-NP" : "ne-NP"; recognition.continuous = false; recognition.interimResults = true; recognitionRef.current = recognition; recognition.onresult = event => { const result = event.results[event.results.length - 1]; if (result?.[0]) setInput(result[0].transcript); }; recognition.onerror = () => { setVoiceError("Microphone access or speech recognition failed. Check permissions or type instead."); setListening(false); }; recognition.onend = () => setListening(false); setVoiceError(""); setListening(true); recognition.start(); }
    catch { setListening(false); setVoiceError("Could not start voice dictation. Type your message instead."); }
  }
  return <div className="mk-assistant">
    {open && <section className="mk-assistant-panel" aria-label="Home service diagnostic guide"><header><div className="mk-assistant-avatar"><Sparkles size={17} /></div><div><b>Home service triage</b><small>Safety · evidence · inspection booking</small></div><button type="button" onClick={() => { recognitionRef.current?.stop(); setOpen(false); }} aria-label="Close assistant"><X size={18} /></button></header>
      <div className="mk-chat-messages" ref={scrollRef} aria-live="polite">{messages.map(message => <div key={message.id} className={`mk-chat-message mk-chat-${message.role}`}><p>{message.text}</p>{message.photoPreview && <img className="mk-chat-photo-preview" src={message.photoPreview} alt="Customer attached home issue photo" />}{message.question && <div className="mk-diagnostic-choices">{message.question.choices.map((choice, index) => <button key={choice} type="button" disabled={busy} onClick={() => void send(undefined, `[[${index}]]${choice}`)}><b>{String.fromCharCode(65 + index)})</b> {choice}</button>)}</div>}{message.diagnostic && message.diagnosticAction === "review" && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "LIMITED TRIAGE CLASSIFICATION", "सीमित प्रारम्भिक वर्गीकरण")} · {message.diagnostic.diagnostic_code}</span><b>{message.diagnostic.issue_title}</b><small>{message.diagnostic.explanation}</small>{message.diagnostic.photo_assessed && <small>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Visual evidence", "तस्बिरमा देखिएको प्रमाण")}: {[message.diagnostic.visual_material, message.diagnostic.visual_mounting, message.diagnostic.visual_defect, ...(message.diagnostic.visual_evidence ?? [])].filter(Boolean).join(" · ") || textFor(diagnosticLanguageForText(message.diagnostic.symptom), "No specific defect is clear in the image.", "तस्बिरमा कुनै निश्चित खराबी स्पष्ट देखिँदैन।")}</small>}{message.diagnostic.root_cause_hypothesis && <small>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Unconfirmed possibility", "पुष्टि नभएको सम्भावित कारण")}: {message.diagnostic.root_cause_hypothesis}</small>}<small>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Electrical work requires on-site inspection. This triage does not set a price.", "विद्युतीय कामका लागि स्थलमै जाँच आवश्यक हुन्छ। यो प्रारम्भिक जाँचले मूल्य तोक्दैन।")}</small><button type="button" disabled={busy} onClick={() => void send(undefined, "[[confirm-diagnosis]]")}>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Accept classification and continue", "वर्गीकरण स्वीकार गरी अगाडि बढ्नुहोस्")}</button></article>}{message.diagnostic && message.diagnosticAction === "dispatch" && message.serviceId && <article className="mk-assistant-card mk-diagnostic-card"><span className="mk-kicker">{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "INSPECTION REQUEST", "जाँच अनुरोध")} · {message.diagnostic.diagnostic_code}</span><b>{message.diagnostic.issue_title}</b><small>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Area", "क्षेत्र")}: {message.diagnostic.area} · {textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Requested time", "अनुरोध गरिएको समय")}: {message.diagnostic.preferred_time}</small><small>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Quote pending. No repair or price is approved until the professional has inspected the issue and you accept a written quote.", "मूल्य प्रस्ताव बाँकी छ। प्राविधिकले जाँच गरी तपाईंले लिखित मूल्य प्रस्ताव स्वीकार नगरेसम्म मर्मत वा मूल्य स्वीकृत हुँदैन।")}</small><button type="button" onClick={() => continueToBooking(message.serviceId!, message.diagnostic!)}>{textFor(diagnosticLanguageForText(message.diagnostic.symptom), "Continue to inspection booking", "जाँच बुकिङ अगाडि बढाउनुहोस्")}</button></article>}</div>)}</div>
      {busy && <p className="mk-voice-error" role="status">Reviewing the evidence{photo ? " and photo" : ""}…</p>}{voiceError && <p className="mk-voice-error" role="status">{voiceError}</p>}
      {photo && <div className="mk-photo-attachment"><img src={photoPreview ?? ""} alt="Selected photo preview" /><span>{photo.name} · reviewed for this assessment only; not saved to the booking</span><button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} aria-label="Remove attached photo"><X size={14} /></button></div>}
      <form className="mk-assistant-compose" onSubmit={event => void send(event)}><button type="button" className={listening ? "is-listening" : ""} onClick={toggleVoice} aria-label={listening ? "Stop voice dictation" : "Start voice dictation"}><Mic size={18} /></button><input value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? "Listening…" : "Describe what you notice"} aria-label="Describe the home-service problem" /><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} hidden /><button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a JPG, PNG or WebP photo"><ImagePlus size={18} /></button><button type="submit" disabled={busy || (!input.trim() && !photo)} aria-label="Send message"><Send size={17} /></button></form>
      <small className="mk-assistant-disclaimer">No numeric confidence or AI-generated price is presented. Remote image triage cannot confirm concealed faults; electrical work requires an on-site inspection and quote.</small></section>}
    <button className="mk-assistant-launch" onClick={() => setOpen(value => !value)} aria-label={open ? "Close assistant" : "Open assistant"}>{open ? <X size={21} /> : <><Bot size={21} /><span>Ask about a home issue</span></>}</button>
  </div>;
}





