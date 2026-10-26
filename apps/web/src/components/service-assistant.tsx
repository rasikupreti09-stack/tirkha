"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Bot, ImagePlus, Mic, Send, Sparkles, X } from "lucide-react";
import { catalogMoney, detectHomeSafetyRisk, diagnosticBookingPrefillSchema, diagnosticLanguageForText, diagnosticQuestion, DIAGNOSTIC_PREFILL_STORAGE_KEY, HOME_ISSUES, matchHomeIssue, resolveDiagnosticCode, serviceIdForDiagnosticCode, serviceTotal, suggestedPartsForService, type CatalogService, type DiagnosticDraft, type DiagnosticLanguage, type DiagnosticQuestion, type SupportedDiagnosticCode } from "@tirkha/shared";
import { useRouter } from "next/navigation";
import { useMarketplace } from "./marketplace-provider";

type SpeechResultEvent = Event & { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: Event) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
type Intake = { serviceId: string; issueId: string; step: "diagnostic-q1" | "diagnostic-q2" | "area" | "time"; symptom: string; issueTitle: string; explanation: string; confidence: "low" | "moderate" | "high"; urgency: "routine" | "soon" | "urgent"; safetyNote?: string; photoAssessed: boolean; suggestedParts: string[]; area?: string; diagnosticCode?: SupportedDiagnosticCode; answers: number[]; language: DiagnosticLanguage; visual?: Pick<PhotoAssessment, "visual_confidence_pct" | "visual_material" | "visual_mounting" | "visual_defect" | "visual_evidence" | "root_cause_hypothesis"> };
type Message = { id: string; role: "assistant" | "user"; text: string; serviceIds: string[]; question?: DiagnosticQuestion; confirmServiceId?: string; diagnostic?: DiagnosticDraft; photoPreview?: string };
type PhotoAssessment = { issue_title: string; explanation: string; suggested_service_id: string; issue_id: string; confidence: "low" | "moderate" | "high"; visual_confidence_pct: number; visual_material: string; visual_mounting: string; visual_defect: string; visual_evidence: string[]; root_cause_hypothesis: string; urgency: "routine" | "soon" | "urgent"; safety_note: string; photo_assessed: boolean; language: DiagnosticLanguage };
function fileAsDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Could not read this image.")); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read this image.")); reader.readAsDataURL(file); }); }
function riskMessage(risk: "electric" | "water-electric" | "gas", language: DiagnosticLanguage) {
  if (language === "nepali_devanagari") {
    if (risk === "gas") return "यो ग्याससम्बन्धी तत्काल जोखिम हुन सक्छ। सबैलाई बाहिर सुरक्षित ठाउँमा लैजानुहोस्; आगो वा स्विच नचलाउनुहोस्। बाहिर पुगेपछि स्थानीय आपतकालीन सेवा वा ग्यास आपूर्तिकर्तालाई सम्पर्क गर्नुहोस्।";
    if (risk === "water-electric") return "पानी र बिजुली वा करेन्टको झट्का खतरनाक हुन सक्छ। त्यस ठाउँबाट टाढा रहनुहोस्, पानी वा उपकरण नछुनुहोस्, र योग्य आपतकालीन सहायता बोलाउनुहोस्। असुरक्षित ठाउँको मेन स्विच नछुनुहोस्।";
    return "झिल्का, धुवाँ वा जलेको गन्ध तत्काल जोखिमको संकेत हुन सक्छ। उपकरणबाट टाढा रहनुहोस् र स्थानीय आपतकालीन सेवा वा विद्युत् प्राधिकरणलाई सम्पर्क गर्नुहोस्।";
  }
  if (language === "nepali_romanized") {
    if (risk === "gas") return "Yo gas sambandhi turuntai jokhim huna sakcha. Sabailai bahira surakshit thau ma lanu; aago wa switch nachalaunu. Bahira pugera local emergency service wa gas supplier lai samparka garnuhola.";
    if (risk === "water-electric") return "Pani ra bijuli wa current ko jhatka khatarnak huna sakcha. Tyo thau bata tada rahanu, pani wa equipment nachhunu, ra qualified emergency help bolaunu. Asurakshit thauko main switch nachhunu.";
    return "Sparking, dhuwa wa jaleko gandha turuntai jokhim ko sanket huna sakcha. Equipment bata tada rahanu ra local emergency wa bijuli authority lai samparka garnuhola.";
  }
  if (risk === "gas") return "This may be an immediate gas hazard. Take everyone outside; avoid flames and electrical switches. Once outside, contact local emergency services or your gas supplier.";
  if (risk === "water-electric") return "Water near electricity or an electric shock can be dangerous. Keep away, do not touch the water or equipment, and contact qualified emergency help. Do not approach a main switch if the area is unsafe.";
  return "Sparks, smoke or a burning smell can signal an immediate hazard. Keep away from the equipment and contact local emergency or utility help.";
}
function questionFor(issueId: string, step: 0 | 1, language: DiagnosticLanguage): DiagnosticQuestion {
  const known = diagnosticQuestion(issueId, step, language);
  if (known) return known;
  if (language === "nepali_devanagari") return step === 0
    ? { prompt: "समस्या मुख्यतः कहाँ देखिन्छ?", choices: ["पानी/पाइप", "बत्ती/स्विच/बिजुली", "उपकरण", "थाहा छैन"] }
    : { prompt: "यो समस्या कहिलेदेखि वा कुन अवस्थामा हुन्छ?", choices: ["सधैँ", "कहिलेकाहीँ", "केही चलाउँदा मात्र", "थाहा छैन"] };
  if (language === "nepali_romanized") return step === 0
    ? { prompt: "Samasya mukhya rupma kata dekhincha?", choices: ["Pani/pipe", "Batti/switch/bijuli", "Appliance", "Thaha chaina"] }
    : { prompt: "Yo samasya kahile dekhi wa kun awasthama huncha?", choices: ["Sadhai", "Kahile kahi", "Kehi chalaunda matra", "Thaha chaina"] };
  return step === 0
    ? { prompt: "Where do you mainly notice the problem?", choices: ["Water or pipes", "Lights, switches or power", "An appliance", "I am not sure"] }
    : { prompt: "When does it happen?", choices: ["All the time", "Intermittently", "Only when something is used", "I am not sure"] };
}
function optionIndex(answer: string, choices: string[]) {
  const encoded = answer.match(/^\[\[(\d+)\]\]/);
  if (encoded) return Number(encoded[1]);
  return choices.findIndex(choice => choice.toLocaleLowerCase() === answer.trim().toLocaleLowerCase());
}
function textFor(language: DiagnosticLanguage, english: string, roman: string, devanagari: string) {
  return language === "nepali_devanagari" ? devanagari : language === "nepali_romanized" ? roman : english;
}
export function ServiceAssistant() {
  const { services, addDiagnostic, setDetail } = useMarketplace();
  const router = useRouter();
  const [open, setOpen] = useState(false), [input, setInput] = useState(""), [listening, setListening] = useState(false), [busy, setBusy] = useState(false), [voiceError, setVoiceError] = useState(""), [photo, setPhoto] = useState<File | null>(null), [photoPreview, setPhotoPreview] = useState<string | null>(null), [intake, setIntake] = useState<Intake | null>(null);
  const welcome = "Describe what you notice or attach a clear photo. I’ll check for immediate safety risks, ask up to two focused questions, and only show a catalog estimate if the supported diagnostic code is resolved. A remote assessment cannot confirm hidden faults.";
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", text: welcome, serviceIds: [] }]);
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
    const currentPhoto = photo, currentPreview = photoPreview, recentText = [...messages].reverse().find(message => message.role === "user")?.text ?? "", language = diagnosticLanguageForText(query || intake?.symptom || recentText);
    const currentQuestion = intake?.step === "diagnostic-q1" ? questionFor(intake.issueId, 0, intake.language) : intake?.step === "diagnostic-q2" ? questionFor(intake.issueId, 1, intake.language) : undefined;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", text: query || "I attached a photo for visual assessment.", serviceIds: [], photoPreview: currentPreview ?? undefined };
    setMessages(old => [...old, userMessage].slice(-32)); setInput(""); setPhoto(null); setPhotoPreview(null); setVoiceError(""); setBusy(true);
    try {
      let next: Intake | null = intake, answer = "", question: DiagnosticQuestion | undefined, service: CatalogService | undefined, finalDraft: DiagnosticDraft | undefined;
      const risk = detectHomeSafetyRisk(query);
      if (risk) { answer = riskMessage(risk, language); next = null; }
      else if (intake?.step === "diagnostic-q1") {
        const selected = optionIndex(forcedQuery ?? query, currentQuestion?.choices ?? []);
        next = { ...intake, answers: [selected], step: "diagnostic-q2" };
        question = questionFor(intake.issueId, 1, intake.language);
        answer = textFor(intake.language, question.prompt, question.prompt, question.prompt);
      } else if (intake?.step === "diagnostic-q2") {
        const selected = optionIndex(forcedQuery ?? query, currentQuestion?.choices ?? []), answers = [...intake.answers, selected];
        const code = resolveDiagnosticCode(intake.issueId, answers);
        const resolvedServiceId = code ? serviceIdForDiagnosticCode(code) : null;
        service = resolvedServiceId ? services.find(item => item.id === resolvedServiceId) : undefined;
        if (!code || !service) {
          next = null;
          answer = textFor(intake.language,
            "Those answers do not resolve a supported diagnostic code. I won’t invent a cause or show a price. A qualified professional can inspect it and provide a written scope and quote before work begins.",
            "Yi jawafle supported diagnostic code nischit bhayena. Ma karan anuman garera price dekhaudina. Qualified professional le inspect garepachi kaam suru hunu agadi written scope ra quote dinu parcha.",
            "यी जवाफबाट समर्थित निदान कोड निश्चित भएन। म कारण अनुमान गरेर मूल्य देखाउँदिनँ। योग्य प्राविधिकले जाँच गरेपछि काम सुरु हुनुअघि लिखित कामको विवरण र मूल्य दिनुपर्छ।");
        } else {
          next = { ...intake, step: "area", serviceId: service.id, diagnosticCode: code, answers, issueTitle: `${intake.issueTitle} (${code})`, explanation: textFor(intake.language, "The reported location and symptom pattern match this limited triage classification. A professional must confirm the component and root cause on site.", "Bhaneko thau ra lakshan yo simit triage classification sanga milcha. Component ra asal karan professional le site ma confirm garnu parcha.", "बताइएको स्थान र लक्षणको ढाँचा यो सीमित प्रारम्भिक वर्गीकरणसँग मिल्छ। वास्तविक पार्ट र कारण प्राविधिकले स्थलमै पुष्टि गर्नुपर्छ।"), confidence: "moderate" };
          answer = textFor(intake.language, `The supported triage code is ${code}. This identifies the reported leak location, not a confirmed failed part. What neighborhood or landmark should the professional visit?`, `Supported triage code ${code} ho. Yo bhaneko leak ko location ho, confirmed kharab part hoina. Professional kun area wa landmark ma aaunu parcha?`, `समर्थित प्रारम्भिक कोड ${code} हो। यसले चुहावट देखिएको स्थान जनाउँछ, बिग्रिएको पार्ट पुष्टि गर्दैन। प्राविधिक कुन टोल वा landmark मा आउनुपर्छ?`);
        }
      } else if (intake?.step === "area") {
        next = { ...intake, area: query, step: "time" };
        answer = textFor(intake.language, "Thanks. What day and time would suit you?", "Dhanyabad. Kun din ra samaya thik huncha?", "धन्यवाद। कुन दिन र समय तपाईंलाई उपयुक्त हुन्छ?");
      } else if (intake?.step === "time") {
        service = services.find(item => item.id === intake.serviceId);
        if (!service || !intake.diagnosticCode) { next = null; answer = "No supported diagnosis is available for a catalog estimate. A professional inspection and quote are needed."; }
        else {
          finalDraft = { symptom: intake.symptom, issue_title: intake.issueTitle, explanation: intake.explanation, diagnostic_code: intake.diagnosticCode, diagnostic_basis: intake.photoAssessed ? "photo_and_answers" : "text_and_answers", visual_confidence_pct: intake.visual?.visual_confidence_pct, visual_material: intake.visual?.visual_material, visual_mounting: intake.visual?.visual_mounting, visual_defect: intake.visual?.visual_defect, visual_evidence: intake.visual?.visual_evidence ?? [], root_cause_hypothesis: intake.visual?.root_cause_hypothesis, confidence: intake.confidence, urgency: intake.urgency, area: intake.area, preferred_time: query, photo_assessed: intake.photoAssessed, safety_note: intake.safetyNote, catalog_service_paisa: service.base_paisa, catalog_visit_paisa: service.visit_paisa, catalog_total_paisa: serviceTotal(service), suggested_parts: intake.suggestedParts };
          answer = textFor(intake.language, "The triage code, area and requested time are ready for review. The amounts shown are the service catalog’s listed labour/service and visit fees; parts and concealed work still need an on-site quote and your approval.", "Triage code, area ra samaya review ko lagi tayar cha. Dekhaeko amount catalog ko listed service/labour ra visit fee ho; parts ra concealed work ko quote site ma liyera tapai ko approval chahincha.", "प्रारम्भिक कोड, टोल र समय समीक्षा गर्न तयार छन्। देखाइएको रकम catalog मा रहेको सेवा/श्रम र visit fee हो; पार्ट र लुकेको कामका लागि स्थलमा मूल्य प्रस्ताव लिएर तपाईंको स्वीकृति लिनुपर्छ।"); next = null;
        }
      } else if (currentPhoto) {
        const imageDataUrl = await fileAsDataUrl(currentPhoto);
        const response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query, imageDataUrl, language }) });
        const result = await response.json() as PhotoAssessment | { error?: string }; if (!response.ok) throw new Error((result as { error?: string }).error || "Photo assessment is unavailable.");
        const assessment = result as PhotoAssessment, photoRisk = detectHomeSafetyRisk(`${query} ${assessment.issue_title} ${assessment.safety_note}`);
        if (photoRisk || assessment.urgency === "urgent") { answer = `${assessment.safety_note ? `${assessment.safety_note} ` : ""}${riskMessage(photoRisk ?? "electric", assessment.language)}`; next = null; }
        else {
          const issue = matchHomeIssue(query) ?? (assessment.issue_id !== "unknown" ? { id: assessment.issue_id } : null);
          const match = services.find(item => item.id === assessment.suggested_service_id) ?? (issue && "serviceId" in issue ? services.find(item => item.id === issue.serviceId) : undefined);
          if (!issue || !match) { next = null; answer = textFor(assessment.language, `${assessment.explanation} I cannot match this to a supported diagnostic path, so I won’t show a price. A qualified professional can inspect it first.`, `${assessment.explanation} Yo samasya supported diagnostic path sanga milena, tesaile ma price dekhaudina. Qualified professional le pahila inspect garnu parcha.`, `${assessment.explanation} यसलाई समर्थित निदान प्रक्रियासँग मिलाउन सकिएन, त्यसैले मूल्य देखाउँदिनँ। योग्य प्राविधिकले पहिले जाँच गर्नुपर्छ।`); }
          else {
            const issueId = issue.id, visual = { visual_confidence_pct: assessment.visual_confidence_pct, visual_material: assessment.visual_material, visual_mounting: assessment.visual_mounting, visual_defect: assessment.visual_defect, visual_evidence: assessment.visual_evidence, root_cause_hypothesis: assessment.root_cause_hypothesis };
            next = { serviceId: match.id, issueId, step: "diagnostic-q1", symptom: query || "Photo submitted for visual triage.", issueTitle: assessment.issue_title, explanation: assessment.explanation, confidence: assessment.confidence, urgency: assessment.urgency, safetyNote: assessment.safety_note || undefined, photoAssessed: assessment.photo_assessed, suggestedParts: suggestedPartsForService(match.id), answers: [], language: assessment.language, visual };
            const first = questionFor(issueId, 0, assessment.language);
            answer = textFor(assessment.language,
              `Visible assessment: ${assessment.visual_defect || assessment.issue_title}. Material: ${assessment.visual_material || "unclear"}; mounting: ${assessment.visual_mounting || "unclear"}. Model visual-confidence estimate: ${assessment.visual_confidence_pct}% (not a calibrated probability or diagnosis). ${assessment.root_cause_hypothesis ? `Possible cause to verify: ${assessment.root_cause_hypothesis}. ` : ""}${first.prompt}`,
              `Photo ma dekheko: ${assessment.visual_defect || assessment.issue_title}. Material: ${assessment.visual_material || "spashta chaina"}; mounting: ${assessment.visual_mounting || "spashta chaina"}. Model ko visual-confidence estimate ${assessment.visual_confidence_pct}% ho (yo calibrated probability wa diagnosis hoina). ${assessment.root_cause_hypothesis ? `Sambhavit karan verify garnu parcha: ${assessment.root_cause_hypothesis}. ` : ""}${first.prompt}`,
              `तस्बिरमा देखिएको: ${assessment.visual_defect || assessment.issue_title}। सामग्री: ${assessment.visual_material || "स्पष्ट छैन"}; जडान: ${assessment.visual_mounting || "स्पष्ट छैन"}। मोडेलको दृश्य-confidence अनुमान ${assessment.visual_confidence_pct}% हो (यो calibrated probability वा निदान होइन)। ${assessment.root_cause_hypothesis ? `सम्भावित कारण जाँच गर्नुपर्छ: ${assessment.root_cause_hypothesis}। ` : ""}${first.prompt}`);
            question = first;
          }
        }
      } else {
        let issue = matchHomeIssue(query);
        let aiServiceId: string | undefined;
        if (!issue) {
          try {
            const response = await fetch("/api/diagnostics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ symptom: query }) });
            if (response.ok) {
              const assessment = await response.json() as PhotoAssessment;
              issue = HOME_ISSUES.find(candidate => candidate.id === assessment.issue_id) ?? null;
              aiServiceId = assessment.suggested_service_id;
            }
          } catch { /* Local matching remains available if the visual AI service is unavailable. */ }
        }
        const service = (issue?.serviceId ? services.find(item => item.id === issue.serviceId) : undefined) ?? (aiServiceId ? services.find(item => item.id === aiServiceId) : undefined);
        if (!issue || !service) {
          const issueId = issue?.id ?? "unknown", q = questionFor(issueId, 0, language);
          next = { serviceId: service?.id ?? aiServiceId ?? "unknown", issueId, step: "diagnostic-q1", symptom: query, issueTitle: issue?.title ?? "Unclassified home-service issue", explanation: "The available information does not identify a failure code.", confidence: "low", urgency: "routine", photoAssessed: false, suggestedParts: [], answers: [], language };
          answer = textFor(language, `I don’t have enough evidence to classify this reliably. I won’t show an estimate before a supported code is resolved. ${q.prompt}`, `Yo bibaran bata bharpardo classification garna pugne evidence chaina. Supported code nischit nahunjel estimate dekhaudina. ${q.prompt}`, `उपलब्ध विवरणबाट भरपर्दो वर्गीकरण गर्न पर्याप्त प्रमाण छैन। समर्थित कोड निश्चित नभएसम्म अनुमानित मूल्य देखाउँदिनँ। ${q.prompt}`);
          question = q;
        } else {
          const q = questionFor(issue.id, 0, language);
          if (!q) { next = null; answer = textFor(language, "I can identify the service area, but this issue is not covered by a sufficiently specific diagnostic flow. I won’t show a price until a qualified professional confirms the scope.", "Service area bujhna sakchu, tara yo issue ko lagi pugne gari specific diagnostic flow chaina. Qualified professional le scope confirm nagare samma price dekhaudina.", "सम्बन्धित सेवा क्षेत्र पहिचान गर्न सक्छु, तर यो समस्याका लागि पर्याप्त विशिष्ट निदान प्रक्रिया छैन। योग्य प्राविधिकले कामको दायरा पुष्टि नगरेसम्म मूल्य देखाउँदिनँ।"); }
          else {
            next = { serviceId: service.id, issueId: issue.id, step: "diagnostic-q1", symptom: query, issueTitle: issue.title, explanation: "Initial symptom match only; cause is not confirmed.", confidence: "low", urgency: issue.id === "muddy-water" ? "soon" : "routine", photoAssessed: false, suggestedParts: suggestedPartsForService(service.id), answers: [], language };
            answer = textFor(language, `This sounds like ${issue.title}, but symptoms alone do not confirm the failed part. ${q.prompt}`, `Yo ${issue.title} jasto sunincha, tara symptom bata kharab part confirm hudaina. ${q.prompt}`, `यो ${issue.title} जस्तो सुनिन्छ, तर लक्षणबाट बिग्रिएको पार्ट पुष्टि हुँदैन। ${q.prompt}`);
            question = q;
          }
        }
      }
      const assistant: Message = { id: crypto.randomUUID(), role: "assistant", text: answer, serviceIds: [], question, confirmServiceId: finalDraft ? service?.id : undefined, diagnostic: finalDraft };
      setIntake(next); setMessages(old => [...old, assistant].slice(-32));
    } catch (error) {
      setIntake(null); const fallbackMessage: Message = { id: crypto.randomUUID(), role: "assistant", text: error instanceof Error ? error.message : "Assessment failed. Please describe the issue in text and I can still help with safety and service matching.", serviceIds: [] }; setMessages(old => [...old, fallbackMessage].slice(-32));
    } finally { setBusy(false); }
  }
  function continueToBooking(service: CatalogService, diagnostic: DiagnosticDraft) {
    try { const prefill = diagnosticBookingPrefillSchema.parse({ category_slug: service.category_slug, duration_minutes: service.duration_minutes, diagnostic }); sessionStorage.setItem(DIAGNOSTIC_PREFILL_STORAGE_KEY, JSON.stringify(prefill)); router.push(`/book?category=${encodeURIComponent(service.category_slug)}`); }
    catch { setVoiceError("I could not prepare the booking summary. Please try again or choose the service from Explore."); }
  }
  function toggleVoice() {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const Speech = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!Speech) { setVoiceError("Voice dictation is unavailable in this browser. You can still type your message."); return; }
    try { const recognition = new Speech(); recognition.lang = intake?.language === "english" ? "en-NP" : "ne-NP"; recognition.continuous = false; recognition.interimResults = true; recognitionRef.current = recognition; recognition.onresult = event => { const result = event.results[event.results.length - 1]; if (result?.[0]) setInput(result[0].transcript); }; recognition.onerror = () => { setVoiceError("Microphone access or speech recognition failed. Check permissions or type instead."); setListening(false); }; recognition.onend = () => setListening(false); setVoiceError(""); setListening(true); recognition.start(); }
    catch { setListening(false); setVoiceError("Could not start voice dictation. Type your message instead."); }
  }
  return <div className="mk-assistant">
    {open && <section className="mk-assistant-panel" aria-label="Home service diagnostic guide"><header><div className="mk-assistant-avatar"><Sparkles size={17} /></div><div><b>Home service guide</b><small>Safety · symptom triage · verified rate cards</small></div><button type="button" onClick={() => { recognitionRef.current?.stop(); setOpen(false); }} aria-label="Close assistant"><X size={18} /></button></header>
      <div className="mk-chat-messages" ref={scrollRef} aria-live="polite">{messages.map(message => <div key={message.id} className={`mk-chat-message mk-chat-${message.role}`}><p>{message.text}</p>{message.photoPreview && <img className="mk-chat-photo-preview" src={message.photoPreview} alt="Customer attached home issue photo" />}{message.question && <div className="mk-diagnostic-choices">{message.question.choices.map((choice, index) => <button key={choice} type="button" disabled={busy} onClick={() => void send(undefined, `[[${index}]]${choice}`)}><b>{String.fromCharCode(65 + index)})</b> {choice}</button>)}</div>}{message.confirmServiceId && message.diagnostic && (() => { const chosen = services.find(item => item.id === message.confirmServiceId); return chosen ? <article className="mk-assistant-card mk-diagnostic-card"><div><span className="mk-kicker">SUPPORTED TRIAGE CODE · {message.diagnostic.diagnostic_code}</span><b>{message.diagnostic.issue_title}</b><small>{message.diagnostic.explanation}</small><small>Area: {message.diagnostic.area} · Preferred time: {message.diagnostic.preferred_time}</small>{message.diagnostic.photo_assessed && <><small>Model visual-confidence estimate: {message.diagnostic.visual_confidence_pct ?? 0}% — not a calibrated probability.</small><small>Visual evidence: {[message.diagnostic.visual_material, message.diagnostic.visual_mounting, message.diagnostic.visual_defect, ...(message.diagnostic.visual_evidence ?? [])].filter(Boolean).join(" · ")}</small>{message.diagnostic.root_cause_hypothesis && <small>Possible cause to verify on site: {message.diagnostic.root_cause_hypothesis}</small>}</>}<div className="mk-diagnostic-price"><span>Listed service/labour</span><b>{catalogMoney(chosen.base_paisa)}</b><span>Visit fee</span><b>{catalogMoney(chosen.visit_paisa)}</b><span>Listed subtotal</span><b>{catalogMoney(serviceTotal(chosen))}</b><span>Parts</span><b>Inspection and approved quote required</b></div><small>The code classifies the reported location/symptom and is not confirmation of the failed component or hidden cause. Labour amount is from the service catalog. Parts and extra work require a separate quote and your approval before work starts. The photo is not saved.</small><button onClick={() => continueToBooking(chosen, message.diagnostic!)}>Continue to secure booking</button><button onClick={() => addDiagnostic(chosen.id, message.diagnostic!)}>Add to demo cart instead</button><button onClick={() => setDetail(chosen.id)}>Review service scope</button></div></article> : null; })()}</div>)}</div>
      {busy && <p className="mk-voice-error" role="status">Reviewing the evidence{photo ? " and photo" : ""}…</p>}{voiceError && <p className="mk-voice-error" role="status">{voiceError}</p>}
      {photo && <div className="mk-photo-attachment"><img src={photoPreview ?? ""} alt="Selected photo preview" /><span>{photo.name} · processed for this assessment, not saved to the booking</span><button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} aria-label="Remove attached photo"><X size={14} /></button></div>}
      <form className="mk-assistant-compose" onSubmit={event => void send(event)}><button type="button" className={listening ? "is-listening" : ""} onClick={toggleVoice} aria-label={listening ? "Stop voice dictation" : "Start voice dictation"}><Mic size={18} /></button><input value={input} onChange={event => setInput(event.target.value)} placeholder={listening ? "Listening…" : "Describe what you notice"} aria-label="Describe the home-service problem" /><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} hidden /><button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach a JPG, PNG or WebP photo"><ImagePlus size={18} /></button><button type="submit" disabled={busy || (!input.trim() && !photo)} aria-label="Send message"><Send size={17} /></button></form>
      <small className="mk-assistant-disclaimer">AI visual confidence is not an accuracy guarantee. Remote triage cannot confirm concealed faults. No price is shown unless a supported code is resolved; parts require on-site inspection and approval.</small></section>}
    <button className="mk-assistant-launch" onClick={() => setOpen(value => !value)} aria-label={open ? "Close assistant" : "Open assistant"}>{open ? <X size={21} /> : <><Bot size={21} /><span>Ask about a home issue</span></>}</button>
  </div>;
}
