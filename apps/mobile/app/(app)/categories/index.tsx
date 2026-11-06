import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { tokens, translateCatalogLabel, translateUi, type ServiceCategory } from "@tirkha/shared";
import { loadCategories } from "../../../lib/discovery";
import { LanguageSwitcher } from "../../../components/language-switcher";
import { useLanguage } from "../../../providers/language-provider";
import { getServiceArtwork } from "../../../lib/service-artwork";

export default function Categories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const router = useRouter();
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translateUi>[0]) => translateUi(key, language);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    void loadCategories().then((data) => { if (active) setCategories(data); })
      .catch(() => { if (active) setError(t("servicesLoadError")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt, language]);
  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/dashboard")}
          style={styles.backButton}
          hitSlop={8}
        >
          <Text style={styles.backText}>← {t("dashboard")}</Text>
        </Pressable>
        <View style={styles.languageRow}><LanguageSwitcher /></View>
        <Text accessibilityRole="header" style={styles.title}>{t("exploreServices")}</Text>
        <Text style={styles.subtitle}>{language === "np" ? "घरायसी सहयोगका लागि प्रमाणित प्राविधिकहरू खोज्नुहोस्।" : "Find verified professionals for everyday help at home."}</Text>
      </View>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("loadingServices")} />
          <Text style={styles.stateText}>{t("loadingServices")}</Text>
        </View>
      ) : error ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.stateText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t("tryAgain")}</Text>
          </Pressable>
        </View>
      ) : categories.length === 0 ? (
        <Text style={styles.stateText}>{t("categoriesPreparing")}</Text>
      ) : categories.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          accessibilityLabel={`${translateCatalogLabel(item.name, language)}, ${t("viewProfessionals")}`}
          onPress={() => router.push({ pathname: "/(app)/categories/[slug]", params: { slug: item.slug } })}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <Image
            source={getServiceArtwork(undefined, item.slug)}
            style={styles.artwork}
            resizeMode="cover"
            accessibilityLabel={translateCatalogLabel(item.name, language)}
          />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{translateCatalogLabel(item.name, language)}</Text>
            <Text style={styles.description}>{item.description ? translateCatalogLabel(item.description, language) : t("genericServiceDescription")}</Text>
            <Text style={styles.action}>{t("viewProfessionals")}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: 20, paddingBottom: 32 },
  header: { marginBottom: 24 },
  languageRow: { alignItems: "flex-start", marginBottom: 16 },
  backButton: { alignSelf: "flex-start", paddingVertical: 12, marginBottom: 16 },
  backText: { color: tokens.colors.primary, fontSize: 16, fontWeight: "600", textDecorationLine: "underline" },
  title: { color: tokens.colors.primary, fontSize: 30, lineHeight: 38, fontWeight: "700" },
  subtitle: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24, marginTop: 10 },
  state: { paddingVertical: 28, alignItems: "center", gap: 12 },
  stateText: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24 },
  retryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: tokens.colors.primary, paddingHorizontal: 20 },
  retryText: { color: tokens.colors["primary-foreground"], fontSize: 16, fontWeight: "600" },
  card: {
    alignSelf: "stretch",
    marginBottom: 16,
    padding: 0,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 18,
    backgroundColor: tokens.colors.card,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  artwork: { width: "100%", height: 190, backgroundColor: tokens.colors["muted"] },
  cardBody: { padding: 20 },
  cardTitle: { color: tokens.colors.primary, fontSize: 21, lineHeight: 28, fontWeight: "700" },
  description: { color: tokens.colors["muted-foreground"], fontSize: 16, lineHeight: 24, marginTop: 8 },
  action: { color: tokens.colors.primary, fontSize: 16, lineHeight: 22, fontWeight: "600", textDecorationLine: "underline", marginTop: 20 },
});
