import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import { categorySlugSchema, hourlyRateLabel, PROFESSIONAL_PAGE_SIZE, tokens, translateCatalogLabel, translateUi, type PublicProfessional, type ServiceCategory } from "@tirkha/shared";
import { loadCategory, loadProfessionals } from "../../../lib/discovery";
import { LanguageSwitcher } from "../../../components/language-switcher";
import { useLanguage } from "../../../providers/language-provider";

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
    let active = true; setLoading(true); setError("");
    if (!categorySlugSchema.safeParse(slug).success) { setCategory(null); setProfessionals([]); setLoading(false); return; }
    void Promise.all([loadCategory(slug), loadProfessionals(slug, page * PROFESSIONAL_PAGE_SIZE)])
      .then(([category, professionals]) => { if (active) { setCategory(category); setProfessionals(professionals); } })
      .catch(() => { if (active) setError(t("serviceLoadError")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, page, attempt, language]);
  return <FlatList className="flex-1 bg-background" contentContainerStyle={{ padding: 24, flexGrow: 1 }}
    data={loading || error || !category ? [] : professionals} keyExtractor={(item) => item.profile_id}
    ListHeaderComponent={<View className="mb-6">
      <View className="mb-5 items-start"><LanguageSwitcher /></View>
      <Link href="/(app)/categories" className="mb-6 py-3 font-medium text-primary underline">← {t("exploreServices")}</Link>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-primary">{category ? translateCatalogLabel(category.name, language) : loading ? t("loadingServices") : error ? t("service") : t("serviceNotFound")}</Text>
      {category && !loading && !error && <>
        <Text className="mt-3 text-base leading-6 text-muted-foreground">{translateCatalogLabel(category.description || "", language)}</Text>
        <Link href={{ pathname: "/(app)/book", params: { category: slug } }} className="mt-4 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">{t("requestService")}</Link><Text accessibilityRole="header" className="mt-8 text-xl font-semibold text-primary">{t("exploreProfessionals")}</Text>
        <Text className="mt-2 text-sm leading-5 text-muted-foreground">{t("hourlyRateNote")}</Text>
      </>}
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("loadingProfessionals")} /> : error ? <View>
      <Text accessibilityRole="alert" className="text-foreground">{error}</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} className="mt-4 min-h-12 items-center justify-center rounded-md bg-primary"><Text className="font-medium text-primary-foreground">{t("tryAgain")}</Text></Pressable>
    </View> : <Text className="text-muted-foreground">{!category ? t("chooseCategory") : page === 0 ? t("noProfessionals") : t("endOfListings")}</Text>}
    renderItem={({ item }) => <View className="mb-4 rounded-lg border border-border bg-card p-6">
      <Text className="mb-3 text-sm font-medium text-primary">{t("verifiedProfessional")}</Text>
      <Text accessibilityRole="header" className="text-xl font-semibold text-foreground">{item.full_name || t("tirkhaProfessional")}</Text>
      <Text className="mt-3 text-sm leading-6 text-muted-foreground">{item.bio || t("noIntroduction")}</Text>
      <Text className="mt-5 text-sm text-foreground">{item.rating > 0 ? `${t("rating")}: ${item.rating.toFixed(1)} / 5` : t("newProfessional")}</Text>
      <Text className="mt-3 text-lg font-semibold text-primary">{hourlyRateLabel(item.hourly_rate_paisa)}</Text>
    </View>}
    ListFooterComponent={category && !loading && !error ? <View className="mt-4 flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: page === 0 }} disabled={page === 0} onPress={() => setPage((value) => value - 1)} className={page === 0 ? "min-h-12 justify-center rounded-md border border-border px-4 opacity-40" : "min-h-12 justify-center rounded-md border border-border px-4"}><Text className="text-primary">{t("previous")}</Text></Pressable>
      <Text className="text-foreground">{t("page")} {page + 1}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: professionals.length < PROFESSIONAL_PAGE_SIZE || (page + 1) * PROFESSIONAL_PAGE_SIZE > 10000 }} disabled={professionals.length < PROFESSIONAL_PAGE_SIZE || (page + 1) * PROFESSIONAL_PAGE_SIZE > 10000} onPress={() => setPage((value) => value + 1)} className={professionals.length < PROFESSIONAL_PAGE_SIZE ? "min-h-12 justify-center rounded-md border border-border px-4 opacity-40" : "min-h-12 justify-center rounded-md border border-border px-4"}><Text className="text-primary">{t("next")}</Text></Pressable>
    </View> : null}
  />;
}

