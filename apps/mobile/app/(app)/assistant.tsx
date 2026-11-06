import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  assistantReply,
  catalogPriceLabel,
  type CatalogService,
} from "@tirkha/shared";
import { useLanguage } from "../../hooks/use-language";
import { loadRegionalCatalog } from "../../lib/discovery";
import { getServiceArtwork } from "../../lib/service-artwork";

type RegionalService = CatalogService & {
  title_ne?: string | null;
  name_ne?: string | null;
  description_ne?: string | null;
  duration_minutes?: number | null;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  services?: RegionalService[];
};

const prompts = [
  { en: "Leaking pipe", np: "नल चुहिएको" },
  { en: "AC repair", np: "एसी मर्मत" },
  { en: "Short circuit", np: "बिजुली सर्ट" },
];

const copy = {
  en: {
    title: "Tirkha Assistant",
    subtitle: "Tell me what needs attention at home.",
    welcome: "Describe the issue and I’ll help find a suitable service. You can also choose a quick prompt below.",
    placeholder: "Describe your home issue…",
    send: "Send",
    thinking: "Checking the service catalog…",
    noMatch: "I couldn’t match that confidently to a service. Try describing the fixture, appliance, or symptom in a little more detail.",
    unavailable: "I couldn’t load the service catalog right now. Please try again shortly.",
    recommendations: "Services that may help",
    book: "Book this service",
    duration: "Typical duration",
    minutes: "min",
    npr: "NPR",
  },
  np: {
    title: "तिर्खा सहयोगी",
    subtitle: "घरमा के मर्मत वा सहयोग चाहिएको छ भन्नुहोस्।",
    welcome: "समस्या लेख्नुहोस्, म उपयुक्त सेवा खोज्न मद्दत गर्छु। तलका छिटो विकल्प पनि छान्न सक्नुहुन्छ।",
    placeholder: "घरको समस्या लेख्नुहोस्…",
    send: "पठाउनुहोस्",
    thinking: "सेवा सूची जाँच्दैछु…",
    noMatch: "यो समस्याका लागि मिल्दो सेवा भेटिएन। कुन धारा, उपकरण वा लक्षणमा समस्या छ, अलि विस्तृतमा लेख्नुहोस्।",
    unavailable: "अहिले सेवा सूची लोड गर्न सकिएन। केही बेरपछि फेरि प्रयास गर्नुहोस्।",
    recommendations: "उपयोगी हुन सक्ने सेवाहरू",
    book: "यो सेवा बुक गर्नुहोस्",
    duration: "सामान्य समय",
    minutes: "मिनेट",
    npr: "रु.",
  },
} as const;

function localizedServiceName(service: RegionalService, isNepali: boolean) {
  if (isNepali) {
    return service.title_ne || service.name_ne || service.title || service.name;
  }
  return service.title || service.name;
}

function localizedServiceDescription(service: RegionalService, isNepali: boolean) {
  if (isNepali) {
    return service.description_ne || service.description || "घरायसी सेवाका अनुभवी प्राविधिकबाट सहयोग।";
  }
  return service.description || "Professional help for your home service needs.";
}

export default function AssistantScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const isNepali = language === "np";
  const t = isNepali ? copy.np : copy.en;
  const scrollRef = useRef<ScrollView>(null);
  const [catalog, setCatalog] = useState<RegionalService[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    let mounted = true;
    void loadRegionalCatalog("kathmandu-valley")
      .then((rows) => {
        if (!mounted) return;
        const available = rows
          .filter((row) => row.status === "available" && row.service)
          .map((row) => row.service as RegionalService);
        setCatalog(available);
      })
      .catch(() => {
        if (mounted) setCatalog([]);
      })
      .finally(() => {
        if (mounted) setCatalogLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  const greeting = useMemo<ChatMessage>(
    () => ({ id: "welcome", role: "assistant", text: t.welcome }),
    [t.welcome],
  );

  const ask = useCallback(
    async (rawText: string) => {
      const question = rawText.trim();
      if (!question || sending) return;
      setDraft("");
      setSending(true);
      setMessages((current) => [
        ...current,
        { id: `user-${Date.now()}`, role: "user", text: question },
      ]);

      // The shared matcher supplies catalog-grounded suggestions; the assistant
      // does not invent prices or claim a confirmed diagnosis.
      await new Promise<void>((resolve) => setTimeout(resolve, 180));
      if (catalogLoading) {
        setMessages((current) => [
          ...current,
          { id: `assistant-${Date.now()}`, role: "assistant", text: t.thinking },
        ]);
        setSending(false);
        return;
      }

      try {
        const result = assistantReply(question, catalog);
        const recommendations = (result.services ?? []).slice(0, 3) as RegionalService[];
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: recommendations.length ? result.text : (result.text || t.noMatch),
            services: recommendations,
          },
        ]);
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            text: catalog.length ? t.noMatch : t.unavailable,
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [catalog, catalogLoading, sending, t.noMatch, t.thinking, t.unavailable],
  );

  const openBooking = useCallback(
    (service: RegionalService) => {
      router.push({
        pathname: "/(app)/book" as never,
        params: {
          category: service.category_slug ?? service.category_id ?? "",
          serviceId: service.id,
        },
      } as never);
    },
    [router],
  );

  const displayedMessages = messages.length ? messages : [greeting];

  return (
    <View className="flex-1 bg-[#f6f8f7]">
      <View className="border-b border-[#e2e9e5] bg-white px-5 pb-4 pt-4">
        <Text className="text-[22px] font-bold text-[#1f2937]">{t.title}</Text>
        <Text className="mt-1 text-[14px] text-[#66756e]">{t.subtitle}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View className="mb-3 flex-row flex-wrap gap-2">
            {prompts.map((prompt) => (
              <TouchableOpacity
                key={prompt.en}
                accessibilityRole="button"
                onPress={() => void ask(isNepali ? prompt.np : prompt.en)}
                className="rounded-full border border-[#cbded3] bg-white px-3 py-2"
              >
                <Text className="text-[13px] font-semibold text-[#176b52]">
                  {prompt.np} / {prompt.en}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {displayedMessages.map((message) => (
          <View
            key={message.id}
            className={`mb-3 max-w-[92%] rounded-2xl px-4 py-3 ${
              message.role === "user"
                ? "self-end rounded-br-sm bg-[#087f5b]"
                : "self-start rounded-bl-sm border border-[#e3eae6] bg-white"
            }`}
          >
            <Text className={`text-[15px] leading-6 ${message.role === "user" ? "text-white" : "text-[#26332d]"}`}>
              {message.text}
            </Text>
            {!!message.services?.length && (
              <View className="mt-3 gap-3">
                <Text className="text-[13px] font-bold text-[#52635a]">{t.recommendations}</Text>
                {message.services.map((service) => (
                  <View key={service.id} className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white">
                    <Image
                      source={getServiceArtwork(service.id)}
                      resizeMode="cover"
                      className="h-36 w-full bg-[#e7efea]"
                      accessibilityLabel={localizedServiceName(service, isNepali)}
                    />
                    <View className="p-3">
                      <Text className="text-[16px] font-bold text-[#1e2c25]">
                        {localizedServiceName(service, isNepali)}
                      </Text>
                      <Text className="mt-1 text-[13px] leading-5 text-[#66756e]">
                        {localizedServiceDescription(service, isNepali)}
                      </Text>
                      <View className="mt-3 flex-row items-center justify-between">
                        <Text className="font-bold text-[#087f5b]">
                          {t.npr} {catalogPriceLabel(service)}
                        </Text>
                        {service.duration_minutes ? (
                          <Text className="text-[12px] text-[#66756e]">
                            {t.duration}: {service.duration_minutes} {t.minutes}
                          </Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        accessibilityRole="button"
                        onPress={() => openBooking(service)}
                        className="mt-3 items-center rounded-xl bg-[#087f5b] px-4 py-3"
                      >
                        <Text className="font-bold text-white">{t.book}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        {sending && (
          <View className="mb-3 self-start rounded-2xl border border-[#e3eae6] bg-white px-4 py-3">
            <Text className="text-[14px] text-[#66756e]">{t.thinking}</Text>
          </View>
        )}
      </ScrollView>

      <View className="flex-row items-end gap-2 border-t border-[#e2e9e5] bg-white px-4 py-3">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t.placeholder}
          placeholderTextColor="#8b9891"
          multiline
          maxLength={1200}
          className="max-h-28 min-h-12 flex-1 rounded-2xl border border-[#dce5df] bg-[#f8faf9] px-4 py-3 text-[15px] text-[#1f2937]"
          onSubmitEditing={() => void ask(draft)}
          returnKeyType="send"
        />
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!draft.trim() || sending}
          onPress={() => void ask(draft)}
          className={`mb-0.5 rounded-2xl px-4 py-3 ${draft.trim() && !sending ? "bg-[#087f5b]" : "bg-[#a9b8b0]"}`}
        >
          <Text className="font-bold text-white">{t.send}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
