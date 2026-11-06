import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { categorySlugSchema, hourlyRateLabel, PROFESSIONAL_PAGE_SIZE, tokens, translateCatalogLabel, translateUi, type PublicProfessional, type ServiceCategory } from "@tirkha/shared";
import { loadCategory, loadProfessionals } from "../../../lib/discovery";
import { LanguageSwitcher } from "../../../components/language-switcher";
import { useLanguage } from "../../../providers/language-provider";
import { getServiceArtwork } from "../../../lib/service-artwork";

export default function CategoryDetail() {
  const params = useLocalSearchParams<{ slug: string | string[] }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  return <CategoryResults key={slug} slug={slug} />;
}

function CategoryResults({ slug }: { slug: string }) {
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translateUi>[0]) => translateUi(key, language);
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [professionals, setProfessionals] = useState<PublicProfessional[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    if (!categorySlugSchema.safeParse(slug).success) {
      setCategory(null);
      setProfessionals([]);
      setLoading(false);
      return () => { active = false; };
    }
    void Promise.all([loadCategory(slug), loadProfessionals(slug, page * PROFESSIONAL_PAGE_SIZE)])
      .then(([nextCategory, nextProfessionals]) => {
        if (active) { setCategory(nextCategory); setProfessionals(nextProfessionals); }
      })
      .catch(() => { if (active) setError(t("serviceLoadError")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, page, attempt, language]);

  const title = category ? translateCatalogLabel(category.name, language) : loading ? t("loadingServices") : error ? t("service") : t("serviceNotFound");
  return <FlatList
    style={styles.screen}
    contentContainerStyle={styles.content}
    data={loading || error || !category ? [] : professionals}
    keyExtractor={(item) => item.profile_id}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.utility}><Text style={styles.brand}>Tirkha | तिर्खा</Text><LanguageSwitcher /></View>
      <Link href="/(app)/categories" style={styles.back}>‹  {t("exploreServices")}</Link>
      {category && <Image source={getServiceArtwork(undefined, slug)} accessibilityLabel={translateCatalogLabel(category.name, language)} resizeMode="cover" style={styles.hero} />}
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {category && !loading && !error && <>
        <Text style={styles.description}>{translateCatalogLabel(category.description || "", language)}</Text>
        <View style={styles.trustRow}><Text style={styles.trustText}>✓  {t("verifiedProfessional")}</Text><Text style={styles.trustText}>Rs.  {t("hourlyRateNote")}</Text></View>
        <Link href={{ pathname: "/(app)/book", params: { category: slug } }} style={styles.primaryAction}>{t("requestService")}</Link>
        <Text accessibilityRole="header" style={styles.sectionHeading}>{t("exploreProfessionals")}</Text>
        <Text style={styles.rateNote}>{t("hourlyRateNote")}</Text>
      </>}
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator color={tokens.colors["brand-accent"]} accessibilityLabel={t("loadingProfessionals")} style={styles.loader} /> : error ? <View style={styles.emptyCard}>
      <Text accessibilityRole="alert" style={styles.bodyText}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}><Text style={styles.retryText}>{t("tryAgain")}</Text></Pressable>
    </View> : <View style={styles.emptyCard}><Text style={styles.bodyText}>{!category ? t("chooseCategory") : page === 0 ? t("noProfessionals") : t("endOfListings")}</Text></View>}
    renderItem={({ item }) => <View style={styles.professionalCard}>
      <Image source={getServiceArtwork(undefined, slug)} accessibilityLabel={item.full_name || t("tirkhaProfessional")} resizeMode="cover" style={styles.avatar} />
      <View style={styles.professionalBody}>
        <Text style={styles.verified}>{t("verifiedProfessional")}</Text>
        <Text accessibilityRole="header" style={styles.professionalName}>{item.full_name || t("tirkhaProfessional")}</Text>
        <Text style={styles.bio} numberOfLines={3}>{item.bio || t("noIntroduction")}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.rating}>{item.rating > 0 ? `★ ${item.rating.toFixed(1)} / 5` : t("newProfessional")}</Text>
          <Text style={styles.rate}>{hourlyRateLabel(item.hourly_rate_paisa)}</Text>
        </View>
      </View>
    </View>}
    ListFooterComponent={category && !loading && !error ? <View style={styles.pagination}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: page === 0 }} disabled={page === 0} onPress={() => setPage((value) => value - 1)} style={[styles.pageButton, page === 0 && styles.disabled]}><Text style={styles.pageButtonText}>{t("previous")}</Text></Pressable>
      <Text style={styles.pageCount}>{t("page")} {page + 1}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: professionals.length < PROFESSIONAL_PAGE_SIZE }} disabled={professionals.length < PROFESSIONAL_PAGE_SIZE} onPress={() => setPage((value) => value + 1)} style={[styles.pageButton, professionals.length < PROFESSIONAL_PAGE_SIZE && styles.disabled]}><Text style={styles.pageButtonText}>{t("next")}</Text></Pressable>
    </View> : <View style={styles.bottomSpace} />}
  />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: 20, paddingBottom: 36, flexGrow: 1 },
  header: { marginBottom: 16 },
  utility: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  brand: { color: tokens.colors.primary, fontSize: 17, fontWeight: "800" },
  back: { color: tokens.colors["brand-accent"], fontSize: 15, fontWeight: "600", paddingVertical: 12, marginBottom: 8 },
  hero: { width: "100%", height: 190, borderRadius: 18, backgroundColor: tokens.colors.muted, marginBottom: 20 },
  heading: { color: tokens.colors.primary, fontSize: 29, lineHeight: 36, fontWeight: "800" },
  description: { color: tokens.colors["muted-foreground"], fontSize: 15, lineHeight: 23, marginTop: 10 },
  trustRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 16, padding: 13, borderRadius: 14, backgroundColor: tokens.colors["brand-surface"], borderWidth: 1, borderColor: tokens.colors.border },
  trustText: { color: tokens.colors.foreground, fontSize: 12, fontWeight: "600", flexShrink: 1 },
  primaryAction: { overflow: "hidden", borderRadius: 14, backgroundColor: tokens.colors["brand-accent"], color: "#FFFFFF", textAlign: "center", paddingVertical: 15, paddingHorizontal: 18, marginTop: 18, fontSize: 16, fontWeight: "700" },
  sectionHeading: { color: tokens.colors.primary, fontSize: 21, fontWeight: "800", marginTop: 28 },
  rateNote: { color: tokens.colors["muted-foreground"], fontSize: 13, lineHeight: 19, marginTop: 7 },
  loader: { padding: 28 },
  emptyCard: { backgroundColor: tokens.colors.card, borderRadius: 16, borderWidth: 1, borderColor: tokens.colors.border, padding: 18, marginBottom: 12 },
  bodyText: { color: tokens.colors.foreground, fontSize: 14, lineHeight: 21 },
  retry: { alignItems: "center", justifyContent: "center", minHeight: 46, marginTop: 14, borderRadius: 12, backgroundColor: tokens.colors.primary },
  retryText: { color: tokens.colors["primary-foreground"], fontWeight: "700" },
  professionalCard: { flexDirection: "row", overflow: "hidden", backgroundColor: tokens.colors.card, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 17, marginBottom: 14, minHeight: 148 },
  avatar: { width: 104, minHeight: 148, backgroundColor: tokens.colors.muted },
  professionalBody: { flex: 1, padding: 14, justifyContent: "center" },
  verified: { color: tokens.colors["brand-accent"], fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  professionalName: { color: tokens.colors.foreground, fontSize: 17, lineHeight: 22, fontWeight: "800", marginTop: 5 },
  bio: { color: tokens.colors["muted-foreground"], fontSize: 13, lineHeight: 19, marginTop: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 10 },
  rating: { color: tokens.colors.foreground, fontSize: 12, fontWeight: "700" },
  rate: { color: tokens.colors.primary, fontSize: 13, fontWeight: "800" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  pageButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, backgroundColor: tokens.colors.card },
  pageButtonText: { color: tokens.colors.primary, fontWeight: "700" },
  pageCount: { color: tokens.colors.foreground, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  bottomSpace: { height: 12 },
});
