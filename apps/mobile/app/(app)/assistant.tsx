import React, { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  faultServiceId,
  faultTreeQuestion,
  matchHomeFault,
  normalizeHomeDiagnosticText,
  resolveHomeFaultCode,
  HOME_FAULT_TREE,
} from "../../../../packages/shared/src/home-fault-tree";

type FaultNode = NonNullable<ReturnType<typeof matchHomeFault>>;
type Choice = { label: string; value: number };
type Recommendation = {
  title: string;
  serviceId: string;
  categoryId: string;
  price: string;
  reason: string;
};
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  choices?: Choice[];
  recommendation?: Recommendation;
};

const COPY = {
  en: {
    header: "Tirkha AI Assistant",
    intro: "Tell me what is happening at home. I’ll help narrow down the right service.",
    placeholder: "Describe the issue…",
    send: "Send",
    book: "Book this service",
    estimate: "Indicative estimate",
    unavailable: "I couldn’t confidently match that yet. Try one of these examples, or describe the symptom and where it occurs.",
    suggestions: ["Leaking pipe", "AC is not cooling", "Electrical outlet spark"],
    active: "Diagnostic in progress",
    price: "Final scope and price are confirmed by the professional on site.",
  },
  ne: {
    header: "टिर्खा AI सहायक",
    intro: "घरमा के समस्या भइरहेको छ भन्नुहोस्। सही सेवा छान्न म सहयोग गर्छु।",
    placeholder: "समस्या लेख्नुहोस्…",
    send: "पठाउनुहोस्",
    book: "यो सेवा बुक गर्नुहोस्",
    estimate: "अनुमानित शुल्क",
    unavailable: "अहिले समस्या स्पष्ट रूपमा मिलाउन सकिनँ। तलको उदाहरण छान्नुहोस् वा समस्या कहाँ र कसरी भइरहेको छ लेख्नुहोस्।",
    suggestions: ["पाइपबाट पानी चुहियो", "AC चिसो भएन", "सकेटबाट झिल्का आयो"],
    active: "समस्या जाँच हुँदैछ",
    price: "अन्तिम काम र शुल्क प्राविधिकले स्थानमै पुष्टि गर्नुहुन्छ।",
  },
} as const;

const nodeTitle = (node: FaultNode): string => {
  const raw = node as unknown as Record<string, unknown>;
  return String(raw.title ?? raw.name ?? raw.label ?? node.issueId.replace(/[-_]/g, " "));
};

function readQuestion(question: unknown, fallback: string): { text: string; choices: Choice[] } {
  if (question == null) return { text: fallback, choices: [] };
  if (typeof question === "string") return { text: question, choices: [] };
  const item = question as Record<string, unknown>;
  const text = String(item.prompt ?? item.question ?? item.title ?? item.text ?? fallback);
  const rawChoices = (item.choices ?? item.options ?? item.answers ?? []) as unknown;
  const choices = Array.isArray(rawChoices)
    ? rawChoices.map((option, index) => {
        if (typeof option === "string") return { label: option, value: index };
        const value = option as Record<string, unknown>;
        return {
          label: String(value.label ?? value.title ?? value.text ?? value.name ?? `Option ${index + 1}`),
          value: typeof value.value === "number" ? value.value : index,
        };
      })
    : [];
  return { text, choices };
}

function priceFor(node: FaultNode): string {
  const key = `${node.code} ${node.serviceId} ${nodeTitle(node)}`.toLowerCase();
  if (/tap|faucet/.test(key)) return "Rs. 350 / unit";
  if (/drain|waste.pipe|sewer/.test(key)) return "From Rs. 500";
  if (/pump|motor/.test(key)) return "Rs. 2,000";
  if (/mcb|fuse/.test(key)) return "Rs. 750";
  if (/socket|switch|bulb/.test(key)) return "Rs. 350–500";
  if (/elect|circuit|short/.test(key)) return "Rs. 650 inspection";
  if (/plumb|leak|pipe/.test(key)) return "Rs. 650 inspection";
  return "Estimate confirmed after inspection";
}

function recommendationFor(node: FaultNode, resolvedCode?: string | null): Recommendation {
  const match = resolvedCode
    ? (HOME_FAULT_TREE as readonly FaultNode[]).find((entry) => entry.code === resolvedCode) ?? node
    : node;
  const serviceId = faultServiceId(resolvedCode ?? match.code) ?? match.serviceId;
  const categoryId = match.trade.toLowerCase();
  return {
    title: nodeTitle(match),
    serviceId,
    categoryId,
    price: priceFor(match),
    reason: `${match.group} · ${match.trade}`,
  };
}

export default function AssistantScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [language, setLanguage] = useState<"en" | "ne">("en");
  const [draft, setDraft] = useState("");
  const [activeFault, setActiveFault] = useState<FaultNode | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", text: COPY.en.intro },
  ]);
  const copy = COPY[language];

  const append = (message: Omit<ChatMessage, "id">) => {
    setMessages((current) => [...current, { ...message, id: `${Date.now()}-${Math.random()}` }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const submit = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setDraft("");
    append({ role: "user", text: value });
    const normalized = normalizeHomeDiagnosticText(value);
    const node = matchHomeFault(normalized);
    if (!node) {
      append({
        role: "assistant",
        text: copy.unavailable,
        choices: copy.suggestions.map((label, index) => ({ label, value: index })),
      });
      return;
    }

    setActiveFault(node);
    setAnswers([]);
    const question = faultTreeQuestion(node.trade, node.issueId, 0, language === "en" ? "english" : "nepali_devanagari", [], node.code);
    const parsed = readQuestion(question, language === "en"
      ? `Let’s narrow down ${nodeTitle(node)}. What best describes the issue?`
      : `${nodeTitle(node)} बारे थप बुझौँ। कुन विकल्प समस्या मिल्छ?`);
    if (parsed.choices.length) {
      append({ role: "assistant", text: parsed.text, choices: parsed.choices });
      return;
    }
    const finalCode = resolveHomeFaultCode(node.trade, node.issueId, [], node.code);
    const recommendation = recommendationFor(node, finalCode);
    append({
      role: "assistant",
      text: language === "en" ? `Based on your description, this service looks relevant: ${recommendation.title}.` : `तपाईंको विवरणअनुसार यो सेवा उपयुक्त देखिन्छ: ${recommendation.title}।`,
      recommendation,
    });
  };

  const choose = (choice: Choice) => {
    if (!activeFault) {
      submit(copy.suggestions[choice.value] ?? choice.label);
      return;
    }
    append({ role: "user", text: choice.label });
    const nextAnswers = [...answers, choice.value];
    setAnswers(nextAnswers);
    const question = faultTreeQuestion(
      activeFault.trade,
      activeFault.issueId,
      nextAnswers.length,
      language === "en" ? "english" : "nepali_devanagari",
      nextAnswers,
      activeFault.code,
    );
    if (question) {
      const parsed = readQuestion(question, language === "en" ? "One more detail will help identify the right service." : "सही सेवा पहिचान गर्न अर्को विवरण बताउनुहोस्।");
      append({ role: "assistant", text: parsed.text, choices: parsed.choices });
      return;
    }
    const finalCode = resolveHomeFaultCode(activeFault.trade, activeFault.issueId, nextAnswers, activeFault.code);
    const recommendation = recommendationFor(activeFault, finalCode ?? undefined);
    append({
      role: "assistant",
      text: language === "en" ? "Here is the closest matching service. The Hero can confirm the scope on site." : "सबैभन्दा मिल्दो सेवा यहाँ छ। प्राविधिकले स्थानमै कामको दायरा पुष्टि गर्नुहुन्छ।",
      recommendation,
    });
    setActiveFault(null);
    setAnswers([]);
  };

  const suggestions = useMemo(() => copy.suggestions, [copy]);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backGlyph}>←</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>TIRKHA · HOME SUPPORT</Text>
          <Text style={styles.title}>{copy.header}</Text>
        </View>
        <Pressable onPress={() => setLanguage((current) => current === "en" ? "ne" : "en")} style={styles.languageButton}>
          <Text style={styles.languageText}>{language === "en" ? "नेपाली" : "EN"}</Text>
        </Pressable>
      </View>

      <View style={styles.suggestionWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
          {suggestions.map((item) => (
            <Pressable key={item} onPress={() => submit(item)} style={styles.suggestionChip}>
              <Text style={styles.suggestionText}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={scrollRef} style={styles.conversation} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
        {messages.map((message) => (
          <View key={message.id} style={[styles.messageRow, message.role === "user" && styles.userRow]}>
            {message.role === "assistant" && <View style={styles.assistantMark}><Text style={styles.markText}>✦</Text></View>}
            <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, message.role === "user" && styles.userBubbleText]}>{message.text}</Text>
              {message.choices?.length ? (
                <View style={styles.choices}>
                  {message.choices.map((choice, index) => (
                    <Pressable key={`${message.id}-${index}`} onPress={() => choose(choice)} style={styles.choiceChip}>
                      <Text style={styles.choiceText}>{choice.label}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {message.recommendation ? (
                <View style={styles.recommendation}>
                  <View style={styles.serviceVisual}><Text style={styles.serviceGlyph}>{message.recommendation.categoryId === "electrical" ? "⚡" : "⌂"}</Text></View>
                  <Text style={styles.serviceKicker}>{message.recommendation.reason}</Text>
                  <Text style={styles.serviceTitle}>{message.recommendation.title}</Text>
                  <Text style={styles.estimateLabel}>{copy.estimate}</Text>
                  <Text style={styles.price}>{message.recommendation.price}</Text>
                  <Text style={styles.disclaimer}>{copy.price}</Text>
                  <Pressable
                    onPress={() => router.push({ pathname: "/book", params: { categoryId: message.recommendation?.categoryId, serviceId: message.recommendation?.serviceId } } as never)}
                    style={styles.bookButton}
                  >
                    <Text style={styles.bookButtonText}>{copy.book}  →</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ))}
        {activeFault ? <Text style={styles.progress}>{copy.active} · {nodeTitle(activeFault)}</Text> : null}
      </ScrollView>

      <View style={styles.composerShell}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={copy.placeholder}
          placeholderTextColor="#77827d"
          multiline
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={() => submit(draft)}
        />
        <Pressable accessibilityRole="button" accessibilityLabel={copy.send} onPress={() => submit(draft)} style={styles.sendButton}>
          <Text style={styles.sendGlyph}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f7f9f8" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#e3e9e5" },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#f0f4f1", alignItems: "center", justifyContent: "center", marginRight: 12 },
  backGlyph: { color: "#1f2937", fontSize: 27, lineHeight: 31 },
  headerText: { flex: 1 },
  eyebrow: { color: "#087f5b", fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: "#202b38", fontSize: 18, fontWeight: "700", marginTop: 3 },
  languageButton: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: "#dbe4de" },
  languageText: { color: "#087f5b", fontWeight: "700", fontSize: 12 },
  suggestionWrap: { backgroundColor: "#ffffff", paddingBottom: 12 },
  suggestionRow: { paddingHorizontal: 18, gap: 8 },
  suggestionChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22, backgroundColor: "#eef7f2", borderWidth: 1, borderColor: "#d8ebe0" },
  suggestionText: { color: "#126b52", fontSize: 12, fontWeight: "600" },
  conversation: { flex: 1 },
  messages: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 22, gap: 16 },
  messageRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  userRow: { justifyContent: "flex-end" },
  assistantMark: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#dff3e9", alignItems: "center", justifyContent: "center", marginTop: 5 },
  markText: { color: "#087f5b", fontSize: 16, fontWeight: "700" },
  bubble: { maxWidth: "88%", borderRadius: 18, padding: 14 },
  assistantBubble: { backgroundColor: "#ffffff", borderColor: "#e0e8e3", borderWidth: 1, borderTopLeftRadius: 5 },
  userBubble: { backgroundColor: "#087f5b", borderTopRightRadius: 5 },
  bubbleText: { color: "#253341", fontSize: 14, lineHeight: 21 },
  userBubbleText: { color: "#ffffff" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  choiceChip: { borderWidth: 1, borderColor: "#b9ddcb", backgroundColor: "#f6fbf8", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 9 },
  choiceText: { color: "#126b52", fontSize: 12, fontWeight: "600" },
  recommendation: { marginTop: 12, borderRadius: 15, overflow: "hidden", borderWidth: 1, borderColor: "#dce8e1", backgroundColor: "#ffffff", padding: 13 },
  serviceVisual: { height: 78, borderRadius: 11, backgroundColor: "#e8f3ed", alignItems: "center", justifyContent: "center", marginBottom: 11 },
  serviceGlyph: { fontSize: 31, color: "#087f5b" },
  serviceKicker: { color: "#61736a", fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  serviceTitle: { color: "#202b38", fontSize: 16, fontWeight: "700", marginTop: 5 },
  estimateLabel: { color: "#64746d", fontSize: 10, marginTop: 12 },
  price: { color: "#202b38", fontSize: 16, fontWeight: "800", marginTop: 3 },
  disclaimer: { color: "#68766f", fontSize: 10, lineHeight: 15, marginTop: 5 },
  bookButton: { backgroundColor: "#087f5b", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 12 },
  bookButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  progress: { alignSelf: "center", color: "#718078", fontSize: 11, paddingVertical: 8 },
  composerShell: { flexDirection: "row", alignItems: "flex-end", margin: 12, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: "#dce5df", backgroundColor: "#ffffff", shadowColor: "#10251d", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  input: { flex: 1, maxHeight: 110, minHeight: 42, paddingHorizontal: 10, paddingTop: 10, color: "#202b38", fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#087f5b" },
  sendGlyph: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
});
