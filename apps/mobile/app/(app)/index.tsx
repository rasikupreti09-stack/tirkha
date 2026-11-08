import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  catalogPriceLabel,
  catalogServiceMatchesQuery,
  translateCatalogLabel,
  translatePriceLabel,
  translateRegionName,
  type RegionalCatalogRow,
} from "@tirkha/shared";
import { LanguageSwitcher } from "../../components/language-switcher";
import { getServiceArtwork } from "../../lib/service-artwork";
import { loadRegionalCatalog } from "../../lib/discovery";
import { useLanguage } from "../../providers/language-provider";

const COLORS = {
  ink: "#1f2937",
  muted: "#64748b",
  line: "#cbd5e1",
  green: "#047857",
  greenDark: "#065f46",
  cream: "#f8fafc",
  paper: "#ffffff",
  sage: "#f7f7f3",
  paleGreen: "#ecfdf5",
  gold: "#c49a45",
  warning: "#92400e",
};

type CategoryFilter = "all" | "plumbing" | "electrical" | "cleaning" | "care" | "support";

const FILTERS: { id: CategoryFilter; label: string; ne: string }[] = [
  { id: "all", label: "All services", ne: "सबै सेवा" },
  { id: "plumbing", label: "Plumbing", ne: "प्लम्बिङ" },
  { id: "electrical", label: "Electrical", ne: "इलेक्ट्रिकल" },
  { id: "cleaning", label: "Cleaning", ne: "सरसफाइ" },
  { id: "care", label: "Care", ne: "हेरचाह" },
  { id: "support", label: "Everyday support", ne: "दैनिक सहयोग" },
];

const REGION_OPTIONS = ["Kathmandu Valley", "Kathmandu", "Lalitpur", "Bhaktapur"] as const;

const REGION_KEYS: Record<string, string> = {
  "Kathmandu Valley": "kathmandu-valley",
  Kathmandu: "kathmandu-valley",
  Lalitpur: "kathmandu-valley",
  Bhaktapur: "kathmandu-valley",
  Kirtipur: "kathmandu-valley",
  Pokhara: "pokhara",
  Hetauda: "hetauda",
  Simara: "simara",
  Chitwan: "chitwan",
  Jhapa: "jhapa",
  Sunsari: "sunsari",
};

const LOCAL_FALLBACK_SERVICES = [
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "tap-leak-repair", category_slug: "plumbing", category_name: "Plumbing", vertical: "home-repair", image: "tap-leak-repair", title: "Tap & faucet leakage repair", description: "Stop the drip and get your kitchen back. A local professional can inspect the tap and explain the repair before work begins.", duration_minutes: 45 },
    fallbackPrice: "Rs. 350 / per unit",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "pipe-fitting-repair", category_slug: "plumbing", category_name: "Plumbing", vertical: "home-repair", image: "pipe-fitting-repair", title: "Pipe fitting & repair", description: "Reliable connections for everyday water flow, with the work scope confirmed before repair.", duration_minutes: 90 },
    fallbackPrice: "Rs. 1,000",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "waste-pipe-clearing", category_slug: "plumbing", category_name: "Plumbing", vertical: "home-repair", image: "drain-clearing", title: "Waste pipe & drainage clearing", description: "Starting rate for clearing one accessible household waste pipe or drain.", duration_minutes: 60 },
    fallbackPrice: "From Rs. 500",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "electrical-safety-inspection", category_slug: "electrical", category_name: "Electrical", vertical: "home-repair", image: "electrical-inspection", title: "Electrical safety inspection & MCB diagnosis", description: "A first safety inspection and diagnosis for one accessible household circuit or breaker issue.", duration_minutes: 45 },
    fallbackPrice: "Rs. 650",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "switch-socket-replacement", category_slug: "electrical", category_name: "Electrical", vertical: "home-repair", image: "switchboard-repair", title: "Switch & socket replacement", description: "Careful replacement of an accessible household switch, socket, or light fitting.", duration_minutes: 45 },
    fallbackPrice: "Rs. 350–500",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "deep-home-cleaning", category_slug: "home-cleaning", category_name: "Home Cleaning", vertical: "cleaning", image: "deep-clean", title: "Deep home cleaning", description: "A cleaner home and a clearer head, with the cleaning scope agreed in advance.", duration_minutes: 240 },
    fallbackPrice: "Rs. 4,650",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "water-tank-cleaning", category_slug: "home-cleaning", category_name: "Home Cleaning", vertical: "cleaning", image: "water-tank-cleaning", title: "Water tank & reservoir cleaning", description: "Care for the water your home depends on with a scheduled tank cleaning.", duration_minutes: 180 },
    fallbackPrice: "Rs. 2,650",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "doctor-at-home", category_slug: "healthcare", category_name: "Care & wellness", vertical: "care", image: "doctor-at-home", title: "Doctor consultation at home", description: "A non-emergency consultation in the comfort of your home.", duration_minutes: 45 },
    fallbackPrice: "Rs. 2,150",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "home-nursing", category_slug: "healthcare", category_name: "Care & wellness", vertical: "care", image: "home-nursing", title: "Home nurse & elderly care", description: "Thoughtful assistance for everyday care at home.", duration_minutes: 120 },
    fallbackPrice: "Rs. 1,950",
  },
  {
    region_id: "kathmandu-valley",
    availability_status: "coming_soon",
    service: { id: "home-tutoring", category_slug: "everyday-support", category_name: "Everyday support", vertical: "support", image: "home-tutoring", title: "At-home tutoring session", description: "One focused learning session at home, matched to a subject and grade.", duration_minutes: 60 },
    fallbackPrice: "Rs. 1,150",
  },
] as unknown as RegionalCatalogRow[];

const FALLBACK_PRICES: Record<string, string> = {
  "tap-leak-repair": "Rs. 350 / per unit",
  "pipe-fitting-repair": "Rs. 1,000",
  "waste-pipe-clearing": "From Rs. 500",
  "electrical-safety-inspection": "Rs. 650",
  "switch-socket-replacement": "Rs. 350–500",
  "deep-home-cleaning": "Rs. 4,650",
  "water-tank-cleaning": "Rs. 2,650",
  "doctor-at-home": "Rs. 2,150",
  "home-nursing": "Rs. 1,950",
  "home-tutoring": "Rs. 1,150",
};

const FALLBACK_NEPALI: Record<string, { title: string; description: string }> = {
  "tap-leak-repair": { title: "धारा तथा नल चुहावट मर्मत", description: "चुहावट रोक्नुहोस् र आफ्नो भान्सा फेरि सहज बनाउनुहोस्। काम सुरु गर्नुअघि मर्मतको विवरण बुझ्नुहोस्।" },
  "pipe-fitting-repair": { title: "पाइप जडान तथा मर्मत", description: "पानीको नियमित बहावका लागि भरपर्दो जडान र मर्मत।" },
  "waste-pipe-clearing": { title: "ढल तथा फोहोर पाइप सफा", description: "घरको पहुँचयोग्य फोहोर पाइप वा नाली सफा गर्ने सुरुवाती दर।" },
  "electrical-safety-inspection": { title: "विद्युत् सुरक्षा जाँच तथा एमसीबी परीक्षण", description: "घरको पहुँचयोग्य सर्किट वा ब्रेकरको प्रारम्भिक सुरक्षा जाँच।" },
  "switch-socket-replacement": { title: "स्विच तथा सकेट फेर्ने", description: "घरको पहुँचयोग्य स्विच, सकेट वा बत्ती सावधानीपूर्वक फेर्ने सेवा।" },
  "deep-home-cleaning": { title: "घरको गहिरो सरसफाइ", description: "कामको दायरा पहिल्यै तय गरेर घर सफा र व्यवस्थित बनाउनुहोस्।" },
  "water-tank-cleaning": { title: "पानी ट्यांकी तथा जलाशय सफा", description: "नियमित ट्यांकी सरसफाइबाट घरको पानीको हेरचाह गर्नुहोस्।" },
  "doctor-at-home": { title: "घरमै चिकित्सक परामर्श", description: "आफ्नै घरमा लिन सकिने गैर-आकस्मिक चिकित्सकीय परामर्श।" },
  "home-nursing": { title: "घरमै नर्स तथा ज्येष्ठ नागरिक हेरचाह", description: "दैनिक हेरचाहका लागि घरमै सहयोग।" },
  "home-tutoring": { title: "घरमै ट्युसन", description: "विषय र कक्षाअनुसार घरमै एकाग्रतापूर्वक सिकाइ सत्र।" },
};

function matchesCategory(row: RegionalCatalogRow, filter: CategoryFilter): boolean {
  if (filter === "all") return true;
  const service = row.service;
  const text = `${service.category_slug} ${service.category_name} ${service.vertical}`.toLowerCase();
  if (filter === "plumbing") return text.includes("plumb");
  if (filter === "electrical") return text.includes("electr");
  if (filter === "cleaning") return text.includes("clean");
  if (filter === "care") return text.includes("care") || text.includes("wellness");
  return text.includes("support") || text.includes("everyday");
}

function availabilityLabel(status: RegionalCatalogRow["availability_status"], language: string) {
  if (language === "np") {
    if (status === "available") return "उपलब्ध";
    if (status === "paused") return "हाललाई रोकिएको";
    return "छिट्टै उपलब्ध";
  }
  if (status === "available") return "Available";
  if (status === "paused") return "Temporarily paused";
  return "Coming soon";
}

export default function CustomerHomeScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const [region, setRegion] = useState<string>("Kathmandu Valley");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<RegionalCatalogRow[]>(LOCAL_FALLBACK_SERVICES);
  const [usingFallback, setUsingFallback] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openingServiceId, setOpeningServiceId] = useState<string | null>(null);

  const regionKey = useMemo(
    () => REGION_KEYS[region] ?? "kathmandu-valley",
    [region],
  );

  const refreshCatalog = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    else setLoading(catalog.length === 0);
    try {
      const rows = await loadRegionalCatalog(regionKey);
      if (rows.length > 0) {
        setCatalog(rows);
        setUsingFallback(false);
      } else {
        setCatalog(LOCAL_FALLBACK_SERVICES);
        setUsingFallback(true);
      }
    } catch {
      setCatalog(LOCAL_FALLBACK_SERVICES);
      setUsingFallback(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [catalog.length, regionKey]);

  useEffect(() => {
    let active = true;
    if (catalog.length === 0) setLoading(true);
    loadRegionalCatalog(regionKey)
      .then((rows) => {
        if (!active) return;
        setCatalog(rows.length > 0 ? rows : LOCAL_FALLBACK_SERVICES);
        setUsingFallback(rows.length === 0);
      })
      .catch(() => {
        if (active) {
          setCatalog(LOCAL_FALLBACK_SERVICES);
          setUsingFallback(true);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [regionKey]);

  const visibleCatalog = useMemo(() => catalog.filter((row) =>
    matchesCategory(row, filter) && (!query.trim() || catalogServiceMatchesQuery(row.service, query.trim())),
  ), [catalog, filter, query]);

  const openBooking = useCallback((row: RegionalCatalogRow) => {
    if (row.availability_status !== "available") return;
    setOpeningServiceId(row.service.id);
    router.push({
      pathname: "/(app)/book",
      params: { category: row.service.category_slug, serviceId: row.service.id },
    });
    setTimeout(() => setOpeningServiceId(null), 500);
  }, [router]);

  const openAssistant = useCallback(() => {
    router.push("/(app)/assistant");
  }, [router]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refreshCatalog(true)} tintColor={COLORS.green} />}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>Tirkha <Text style={styles.brandNepali}>| तिर्खा</Text></Text>
              <Text style={styles.tagline}>{language === "np" ? "घरको हेरचाह, सहज रूपमा।" : "Your home, effortlessly managed."}</Text>
            </View>
          </View>
          <LanguageSwitcher />
        </View>

        <Text style={styles.eyebrow}>{language === "np" ? "तपाईंको नजिकका सेवा" : "GOOD HELP STARTS HERE"}</Text>
        <Text style={styles.heading}>{language === "np" ? "घरका लागि के चाहियो?" : "What can we help with?"}</Text>
        <Text style={styles.intro}>
          {language === "np" ? "आफ्नो क्षेत्र छान्नुहोस् र उपलब्ध स्थानीय सेवाहरू हेर्नुहोस्।" : "Choose your area to browse local services with clear listed rates."}
        </Text>

        <Text style={styles.sectionLabel}>{language === "np" ? "सेवा क्षेत्र" : "SERVICE AREA"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.regionList}>
          {REGION_OPTIONS.map((item) => {
            const selected = item === region;
            return (
              <Pressable key={item} onPress={() => setRegion(item)} style={[styles.regionChip, selected && styles.regionChipSelected]}>
                <Text style={[styles.regionText, selected && styles.regionTextSelected]}>{translateRegionName(item, language)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={language === "np" ? "तपाईंलाई के सहयोग चाहिन्छ?" : "What do you need help with?"}
          placeholderTextColor={COLORS.muted}
          returnKeyType="search"
          style={styles.search}
          accessibilityLabel={language === "np" ? "सेवा खोज्नुहोस्" : "Search services"}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {FILTERS.map((item) => {
            const selected = filter === item.id;
            const label = language === "np" ? item.ne : item.label;
            return (
              <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filterChip, selected && styles.filterChipSelected]}>
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.catalogHeadingRow}>
          <View>
            <Text style={styles.catalogTitle}>{language === "np" ? "स्थानीय सेवा सूची" : "Services near you"}</Text>
            <Text style={styles.catalogSub}>{translateRegionName(region, language)}</Text>
          </View>
          <Text style={styles.count}>{visibleCatalog.length}</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={COLORS.green} size="large" />
            <Text style={styles.stateText}>{language === "np" ? "सेवा सूची लोड हुँदैछ…" : "Loading local services…"}</Text>
          </View>
        ) : visibleCatalog.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateText}>{language === "np" ? "यस छनोटमा सेवा भेटिएन।" : "No services match this selection."}</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visibleCatalog.map((row) => {
              const service = row.service;
              const bookable = !usingFallback && row.availability_status === "available";
              const price = usingFallback
                ? (FALLBACK_PRICES[service.id] ?? "Listed rate varies")
                : translatePriceLabel(catalogPriceLabel(service), language);
              const fallbackCopy = FALLBACK_NEPALI[service.id];
              const title = usingFallback && language === "np" && fallbackCopy
                ? fallbackCopy.title
                : translateCatalogLabel(service.title, language);
              const description = usingFallback && language === "np" && fallbackCopy
                ? fallbackCopy.description
                : translateCatalogLabel(service.description, language);
              return (
                <View key={`${row.region_id}:${service.id}`} style={styles.card}>
                  <View style={styles.imageWrap}>
                    <Image source={getServiceArtwork(service.image, service.category_slug)} style={styles.serviceImage} resizeMode="cover" />
                    <View style={[styles.statusBadge, bookable ? styles.availableBadge : styles.unavailableBadge]}>
                      <Text style={[styles.statusText, !bookable && styles.unavailableText]}>{availabilityLabel(row.availability_status, language)}</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.categoryName}>{translateCatalogLabel(service.category_name, language)}</Text>
                    <Text style={styles.serviceTitle}>{title}</Text>
                    <Text style={styles.description} numberOfLines={3}>{description}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.priceLabel}>{price.replace(/^(?:NPR|Rs\.)\s?/i, "रू ")}</Text>
                      <Text style={styles.duration}>{service.duration_minutes} {language === "np" ? "मिनेट" : "min"}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ disabled: !bookable }}
                      disabled={!bookable}
                      onPress={() => openBooking(row)}
                      style={[styles.bookButton, !bookable && styles.bookButtonDisabled]}
                    >
                      {openingServiceId === service.id ? <ActivityIndicator color={COLORS.paper} /> : (
                        <Text style={styles.bookButtonText}>{bookable
                          ? (language === "np" ? "अहिले बुक गर्नुहोस्" : "Book this service")
                          : (language === "np" ? "यस क्षेत्रमा उपलब्ध छैन" : "Not bookable here")}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.bottomSpace} />
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={language === "np" ? "घरको समस्याबारे सोध्नुहोस्" : "Ask about a home issue"}
        onPress={openAssistant}
        style={styles.assistantFab}
      >
        <Text style={styles.fabSpark}>✦</Text>
        <Text style={styles.fabText}>{language === "np" ? "घरको समस्याबारे सोध्नुहोस्" : "Ask about a home issue"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.sage },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 34 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28, gap: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0, gap: 10 },
  brandMark: { width: 44, height: 44, borderRadius: 13, backgroundColor: COLORS.ink, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 40, height: 40 },
  brandCopy: { flex: 1, minWidth: 0 },
  brandName: { color: COLORS.ink, fontSize: 19, fontWeight: "800" },
  brandNepali: { fontWeight: "700" },
  tagline: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  eyebrow: { color: COLORS.green, fontSize: 11, fontWeight: "800", letterSpacing: 1.8, marginBottom: 7 },
  heading: { color: COLORS.ink, fontSize: 29, lineHeight: 35, fontWeight: "800", letterSpacing: -0.6 },
  intro: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  sectionLabel: { color: COLORS.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 9 },
  regionList: { gap: 8, paddingBottom: 4, marginBottom: 17 },
  regionChip: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  regionChipSelected: { backgroundColor: COLORS.greenDark, borderColor: COLORS.greenDark },
  regionText: { color: COLORS.ink, fontSize: 12, fontWeight: "700" },
  regionTextSelected: { color: COLORS.paper },
  search: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, paddingVertical: 13, fontSize: 15, color: COLORS.ink, marginBottom: 14 },
  filterList: { gap: 8, paddingBottom: 3, marginBottom: 20 },
  filterChip: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10 },
  filterChipSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  filterText: { color: COLORS.ink, fontSize: 13, fontWeight: "700" },
  filterTextSelected: { color: COLORS.paper },
  catalogHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  catalogTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800" },
  catalogSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  count: { color: COLORS.greenDark, backgroundColor: COLORS.paleGreen, overflow: "hidden", borderRadius: 13, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: "800" },
  grid: { gap: 14 },
  card: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderWidth: 1, borderRadius: 18, overflow: "hidden", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
  imageWrap: { height: 178, backgroundColor: "#e8eee9", position: "relative" },
  serviceImage: { width: "100%", height: "100%" },
  statusBadge: { position: "absolute", top: 12, right: 12, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  availableBadge: { backgroundColor: COLORS.paleGreen },
  unavailableBadge: { backgroundColor: "#fff7ed" },
  statusText: { color: COLORS.greenDark, fontSize: 10, fontWeight: "800" },
  unavailableText: { color: COLORS.warning },
  cardBody: { padding: 15 },
  categoryName: { color: COLORS.green, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.3, fontWeight: "800" },
  serviceTitle: { color: COLORS.ink, fontSize: 19, lineHeight: 24, fontWeight: "800", marginTop: 5 },
  description: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginTop: 6, minHeight: 40 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 13, marginBottom: 12 },
  priceLabel: { color: COLORS.greenDark, fontSize: 15, fontWeight: "800" },
  duration: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  bookButton: { minHeight: 46, backgroundColor: COLORS.green, borderRadius: 13, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  bookButtonDisabled: { backgroundColor: "#e2e8f0" },
  bookButtonText: { color: COLORS.paper, fontSize: 13, fontWeight: "800", textAlign: "center" },
  stateCard: { backgroundColor: COLORS.paper, borderColor: COLORS.line, borderWidth: 1, borderRadius: 17, padding: 24, alignItems: "center", gap: 12 },
  stateText: { color: COLORS.muted, textAlign: "center", fontSize: 14, lineHeight: 21 },
  retryButton: { backgroundColor: COLORS.green, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  retryText: { color: COLORS.paper, fontWeight: "800" },
  bottomSpace: { height: 72 },
  assistantFab: { position: "absolute", right: 18, bottom: 20, minHeight: 54, borderRadius: 28, backgroundColor: COLORS.ink, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 9, shadowColor: "#000", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 8 },
  fabSpark: { color: "#facc15", fontSize: 18, fontWeight: "800" },
  fabText: { color: COLORS.paper, fontSize: 13, fontWeight: "800" },
});


