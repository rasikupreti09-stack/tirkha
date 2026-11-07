import { LocationPicker } from "@/components/location-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  diagnosticLanguageForText,
  diagnosticQuestion,
  detectHomeSafetyRisk,
  matchHomeFault as matchFault,
  resolveDiagnosticCode,
  serviceIdForDiagnosticCode,
  catalogPriceLabel,
  operationalRegionFor,
  type CatalogService,
} from "@tirkha/shared";
import { useLanguage } from "../../providers/language-provider";
import { useBookingDraft } from "../../hooks/use-booking-draft";
import { loadRegionalCatalog } from "../../lib/discovery";
import { getServiceArtwork } from "../../lib/service-artwork";

type Language = ReturnType<typeof diagnosticLanguageForText>;
type Choice = string | { label?: string; text?: string; title?: string; value?: string };
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  choices?: Choice[];
  service?: CatalogService;
  reason?: string;
};

type FaultMatch = {
  code: string;
  issueId: string;
  title?: string;
  serviceId?: string | null;
};

const copy = {
  en: {
    title: "Tirkha Home Assistant",
    subtitle: "Describe what needs attention. I’ll ask focused questions before recommending a service.",
    placeholder: "Describe the issue…",
    send: "Send",
    welcome: "Tell me what is happening at home. You can write in English or नेपाली.",
    prompts: ["Leaking pipe", "AC isn't cooling", "Circuit short"],
    noMatch: "I couldn't identify the fault yet. Add one detail: which fixture or appliance is affected, and what is it doing?",
    safety: "Safety first: move away from exposed wiring or standing water near electricity. If safe, switch off the affected circuit and contact emergency help if there is immediate danger.",
    book: "Book this service",
    duration: "Typical time",
    reason: "Why this match",
    noService: "The diagnosis is ready, but this service is not bookable in the selected region yet.",
  },
  np: {
    title: "तिर्खा गृह-सहायता",
    subtitle: "समस्या लेख्नुहोस्। सेवा सिफारिस गर्नुअघि म उपयोगी प्रश्नहरू सोध्छु।",
    placeholder: "समस्या लेख्नुहोस्…",
    send: "पठाउनुहोस्",
    welcome: "घरमा के समस्या भइरहेको छ लेख्नुहोस्। नेपाली वा English दुवैमा लेख्न सक्नुहुन्छ।",
    prompts: ["नल चुहिएको", "AC चिसो छैन", "बिजुली सर्ट"],
    noMatch: "समस्या अझै स्पष्ट भएन। कुन धारा वा उपकरणमा के भइरहेको छ भन्ने एक विवरण थप्नुहोस्।",
    safety: "पहिले सुरक्षा: खुला तार वा बिजुली नजिकको पानीबाट टाढा रहनुहोस्। सुरक्षित भए प्रभावित सर्किट बन्द गर्नुहोस्। तत्काल जोखिम भए आपत्कालीन सहयोग लिनुहोस्।",
    book: "यो सेवा बुक गर्नुहोस्",
    duration: "सामान्य समय",
    reason: "यो सेवा किन",
    noService: "समस्या पहिचान भयो, तर यो सेवा चयन गरिएको क्षेत्रमा अहिले बुक गर्न उपलब्ध छैन।",
  },
} as const;

function getChoiceLabel(choice: Choice): string {
  if (typeof choice === "string") return choice;
  return choice.label ?? choice.text ?? choice.title ?? choice.value ?? "";
}

function getServiceText(service: CatalogService, keys: string[], fallback = ""): string {
  const record = service as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function getServiceDuration(service: CatalogService): string {
  const record = service as unknown as Record<string, unknown>;
  const value = record.duration_minutes ?? record.duration ?? record.estimated_minutes;
  if (typeof value === "number") return `${value} min`;
  if (typeof value === "string" && value.trim()) return value;
  return "—";
}

export default function AssistantScreen() {
  const router = useRouter();
  const languageContext = useLanguage() as { language?: string };
  const isNepali = languageContext.language === "np" || languageContext.language === "ne";
  const text = isNepali ? copy.np : copy.en;

  // The booking draft is shared with the /book funnel so a recommendation can
  // be selected before navigation instead of relying on route-only display state.
  const bookingDraft = useBookingDraft();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const messageSequence = useRef(0);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [diagnostic, setDiagnostic] = useState<{
    issueId: string;
    faultCode: string;
    language: Language;
    answers: number[];
    fault: FaultMatch;
  } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const nextId = useCallback(() => {
    messageSequence.current += 1;
    return `message-${messageSequence.current}`;
  }, []);

  useEffect(() => {
    let alive = true;
    const region = operationalRegionFor(bookingDraft.region);
    setCatalogLoading(true);
    setServices([]);
    if (!region) {
      setCatalogLoading(false);
      return () => {
        alive = false;
      };
    }
    void loadRegionalCatalog(region)
      .then((rows) => {
        if (!alive) return;
        setServices(
          rows
            .filter((row) => row.availability_status === "available")
            .map((row) => row.service),
        );
      })
      .catch(() => {
        if (alive) setServices([]);
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [bookingDraft.region]);

  useEffect(() => {
    if (messages.length) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages]);

  const appendAssistant = useCallback(
    (message: Omit<ChatMessage, "id" | "role">) => {
      setMessages((current) => [...current, { ...message, id: nextId(), role: "assistant" }]);
    },
    [nextId],
  );

  const findService = useCallback(
    (serviceId: string | null | undefined) =>
      serviceId ? services.find((service) => service.id === serviceId) : undefined,
    [services],
  );

  const askSharedQuestion = useCallback(
    (state: NonNullable<typeof diagnostic>) => {
      const question = diagnosticQuestion(
        state.issueId as Parameters<typeof diagnosticQuestion>[0],
        state.answers.length,
        state.language,
        state.answers,
        state.faultCode,
      );
      if (!question) {
        const resolved = resolveDiagnosticCode(
          state.issueId as Parameters<typeof resolveDiagnosticCode>[0],
          state.answers,
          state.faultCode,
        );
        const code = resolved as unknown as string | null;
        const serviceId = code ? serviceIdForDiagnosticCode(code as Parameters<typeof serviceIdForDiagnosticCode>[0]) : state.fault.serviceId;
        const service = findService(serviceId);
        appendAssistant({
          text: isNepali ? "तपाईंको जवाफका आधारमा सम्भावित समस्या पहिचान गरिएको छ।" : "Based on your answers, the likely fault has been identified.",
          service,
          reason: state.fault.title ?? state.fault.code,
        });
        return;
      }
      appendAssistant({
        text: question.prompt,
        choices: question.choices as Choice[],
      });
    },
    [appendAssistant, findService, isNepali],
  );

  const processText = useCallback(
    (rawText: string) => {
      const submitted = rawText.trim();
      if (!submitted) return;
      setMessages((current) => [...current, { id: nextId(), role: "user", text: submitted }]);
      setInput("");

      // Use the same shared matcher and fault-tree question generator as the web triage flow.
      const matched = matchFault(submitted) as FaultMatch | null;
      if (!matched) {
        appendAssistant({ text: text.noMatch });
        return;
      }

      const detectedLanguage = diagnosticLanguageForText(submitted);
      const state = {
        issueId: matched.issueId,
        faultCode: matched.code,
        language: detectedLanguage,
        answers: [],
        fault: matched,
      };
      setDiagnostic(state);
      if (detectHomeSafetyRisk(submitted)) {
        appendAssistant({ text: text.safety });
      }
      askSharedQuestion(state);
    },
    [appendAssistant, askSharedQuestion, nextId, text.noMatch, text.safety],
  );

  const answerChoice = useCallback(
    (choiceIndex: number, choice: Choice) => {
      if (!diagnostic) return;
      const label = getChoiceLabel(choice);
      setMessages((current) => [...current, { id: nextId(), role: "user", text: label }]);
      const state = { ...diagnostic, answers: [...diagnostic.answers, choiceIndex] };
      setDiagnostic(state);
      askSharedQuestion(state);
    },
    [askSharedQuestion, diagnostic, nextId],
  );

  const choosePrompt = useCallback(
    (prompt: string) => {
      inputRef.current?.blur();
      processText(prompt);
    },
    [processText],
  );

  const openBooking = useCallback(
    (service: CatalogService) => {
      const record = service as unknown as Record<string, unknown>;
      const rawCategory = String(record.category_id ?? record.categoryId ?? record.category_slug ?? "");
      const category = bookingDraft.categories.find(
        (item) => item.id === rawCategory || item.slug === rawCategory,
      );
      const categoryId = category?.id ?? rawCategory;
      const categorySlug = category?.slug ?? rawCategory;
      const serviceId = service.id;
      // Set the shared draft first; route params also let the booking screen restore
      // the selection after app process recreation.
      bookingDraft.changeCategory(categoryId);
      bookingDraft.setOfferingId?.(serviceId);
      router.push({
        pathname: "/(app)/book",
        params: { category: categorySlug, serviceId },
      });
    },
    [bookingDraft, router],
  );

  const welcome = useMemo(
    () => messages.length === 0,
    [messages.length],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f6f8f6]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 0}
    >
      <View className="border-b border-slate-200 bg-white px-5 pb-4 pt-3">
        <Text className="text-xl font-bold text-slate-900">{text.title}</Text>
        <Text className="mt-1 text-sm leading-5 text-slate-600">{text.subtitle}</Text>
      </View>

      <View className="px-4 pt-3"><LocationPicker value={bookingDraft.location?.map_pin ?? null} onChange={bookingDraft.setPin} region={bookingDraft.region} /></View>
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {welcome && (
          <View>
            <View className="max-w-[88%] self-start rounded-3xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Text className="text-[15px] leading-6 text-slate-800">{text.welcome}</Text>
            </View>
            <View className="mt-5 flex-row flex-wrap gap-2">
              {text.prompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  onPress={() => choosePrompt(prompt)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 active:bg-emerald-100"
                >
                  <Text className="text-sm font-semibold text-emerald-900">{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {messages.map((message) => (
          <View
            key={message.id}
            className={`mb-4 max-w-[94%] ${message.role === "user" ? "self-end" : "self-start"}`}
          >
            <View
              className={`rounded-3xl px-4 py-3 shadow-sm ${message.role === "user" ? "rounded-tr-md bg-emerald-700" : "rounded-tl-md border border-slate-200 bg-white"}`}
            >
              <Text className={`text-[15px] leading-6 ${message.role === "user" ? "text-white" : "text-slate-800"}`}>
                {message.text}
              </Text>
              {message.choices && diagnostic && (
                <View className="mt-3 gap-2">
                  {message.choices.map((choice, index) => (
                    <Pressable
                      key={`${message.id}-choice-${index}`}
                      onPress={() => answerChoice(index, choice)}
                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 active:bg-emerald-100"
                    >
                      <Text className="text-sm font-medium text-emerald-950">{getChoiceLabel(choice)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {message.service && (
              <View className="mt-3 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
                <Image
                source={getServiceArtwork(message.service.image, message.service.category_slug)}
                  className="h-48 w-full bg-slate-100"
                  resizeMode="cover"
                  accessibilityLabel={getServiceText(message.service, ["name", "title", "name_en"], "Service")}
                />
                <View className="p-4">
                  <Text className="text-lg font-bold text-slate-900">
                    {getServiceText(
                      message.service,
                      isNepali ? ["name_ne", "title_ne", "name_np"] : ["name_en", "title_en", "name"],
                      getServiceText(message.service, ["name", "title"], ""),
                    )}
                  </Text>
                  <Text className="mt-2 text-base font-bold text-emerald-800">
                    {isNepali ? "रू " : "NPR "}
                    {catalogPriceLabel(message.service).replace(/^Rs\.\s*/i, "")}
                  </Text>
                  <Text className="mt-1 text-sm text-slate-600">
                    {text.duration}: {getServiceDuration(message.service)}
                  </Text>
                  {message.reason ? (
                    <View className="mt-3 rounded-2xl bg-slate-50 p-3">
                      <Text className="text-xs font-bold uppercase tracking-wide text-slate-500">{text.reason}</Text>
                      <Text className="mt-1 text-sm leading-5 text-slate-700">{message.reason}</Text>
                    </View>
                  ) : null}
                  <Pressable
                    onPress={() => openBooking(message.service!)}
                    className="mt-4 items-center rounded-2xl bg-emerald-700 px-4 py-3.5 active:bg-emerald-800"
                  >
                    <Text className="font-bold text-white">{text.book}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}

        {catalogLoading ? (
          <Text className="mb-3 self-center text-xs text-slate-500">
            {isNepali ? "सेवा सूची लोड हुँदैछ…" : "Loading available services…"}
          </Text>
        ) : null}
        {!catalogLoading && messages.some((message) => message.reason && !message.service) ? (
          <Text className="mb-3 max-w-[90%] self-start rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900">
            {text.noService}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-t border-slate-200 bg-white px-4 pb-4 pt-3">
        <View className="flex-row items-end gap-2 rounded-3xl border border-slate-300 bg-slate-50 p-2">
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder={text.placeholder}
            placeholderTextColor="#64748b"
            multiline
            maxLength={1200}
            className="max-h-28 min-h-11 flex-1 px-3 py-2 text-[15px] leading-5 text-slate-900"
            onSubmitEditing={() => processText(input)}
            returnKeyType="send"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text.send}
            disabled={!input.trim()}
            onPress={() => processText(input)}
            className={`mb-0.5 rounded-full px-4 py-3 ${input.trim() ? "bg-emerald-700" : "bg-slate-300"}`}
          >
            <Text className="font-bold text-white">{text.send}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
