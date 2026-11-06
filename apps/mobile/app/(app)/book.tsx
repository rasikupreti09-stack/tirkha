import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { DURATION_OPTIONS, REGIONS, formatBookingDate, formatNpr, hourlyRateLabel, tokens, translateCatalogLabel, translateUi } from "@tirkha/shared";
import { AccountGate } from "../../components/account-gate";
import { PaymentCheckout } from "../../components/payment-checkout";
import { useBookingDraft } from "../../hooks/use-booking-draft";
import { LocationPicker } from "../../components/location-picker";
import { LanguageSwitcher } from "../../components/language-switcher";
import { useLanguage } from "../../providers/language-provider";

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="mb-4"><Text className="mb-2 font-medium text-foreground">{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={tokens.colors["muted-foreground"]} className="min-h-12 rounded-md border border-border bg-card px-3 py-3 text-foreground" {...props} /></View>;
}
function Choice({ label, selected, disabled, onPress }: { label: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} className={selected ? "mb-2 min-h-12 justify-center rounded-md bg-primary p-3" : "mb-2 min-h-12 justify-center rounded-md border border-border p-3"}><Text className={selected ? "text-primary-foreground" : "text-foreground"}>{label}</Text></Pressable>;
}
export default function Book() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <AccountGate roles={["customer"]}>{() => <BookingFields key={category || ""} slug={typeof category === "string" ? category : ""} />}</AccountGate>;
}
function BookingFields({ slug }: { slug: string }) {
  const draft = useBookingDraft(slug);
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translateUi>[0]) => translateUi(key, language);
  const regionKeys: Record<string, Parameters<typeof translateUi>[0]> = {
    "Kathmandu Valley": "valley", Kathmandu: "city", Lalitpur: "lalitpur", Bhaktapur: "bhaktapur",
    Kirtipur: "kirtipur", Pokhara: "pokhara", Hetauda: "hetauda", Simara: "simara",
    Chitwan: "chitwan", Jhapa: "jhapa", Sunsari: "sunsari",
  };
  if (draft.created) return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
    <View className="mb-5 flex-row items-center justify-between"><Text className="text-xl font-semibold text-primary">Tirkha | तिर्खा</Text><LanguageSwitcher /></View>
    <Text accessibilityRole="header" className="text-3xl font-semibold text-primary">{t("bookingRequested")}</Text>
    <Text className="mt-4 text-foreground">{formatBookingDate(draft.created.scheduled_at)}</Text>
    <Text className="mt-4 text-foreground">{t("estimatedLabourTotal")}: {draft.created.total_price_paisa === null ? t("quotePending") : formatNpr(draft.created.total_price_paisa)}</Text>
    <Text className="mt-4 text-muted-foreground">{t("reference")}: {draft.created.id}</Text>
    <PaymentCheckout bookingId={draft.created.id} amount={draft.created.total_price_paisa} /><Link href="/(app)/bookings" className="mt-6 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">{t("myBookings")}</Link>
  </ScrollView>;
  return <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
    <View className="mb-4 flex-row items-center justify-between"><Link href="/(app)/dashboard" className="py-3 text-primary underline">{t("backToDashboard")}</Link><LanguageSwitcher /></View>
    <Text accessibilityRole="header" className="mb-6 text-3xl font-semibold text-primary">{t("requestAService")}</Text>
    <Text className="mb-3 font-semibold text-foreground">{t("serviceCity")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 max-h-14" contentContainerStyle={{ gap: 8 }}>
      {REGIONS.map((region) => <Pressable key={region} accessibilityRole="button" accessibilityState={{ selected: draft.region === region }} onPress={() => draft.setRegion(region)} className={draft.region === region ? "min-h-11 justify-center rounded-full bg-primary px-4" : "min-h-11 justify-center rounded-full border border-border bg-card px-4"}><Text className={draft.region === region ? "font-medium text-primary-foreground" : "font-medium text-foreground"}>{regionKeys[region] ? t(regionKeys[region]) : region}</Text></Pressable>)}
    </ScrollView>
    {draft.loading && <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("loadingServicesForBooking")} />}
    <Text className="mb-3 font-semibold text-foreground">{t("serviceCategory")}</Text>
    {draft.categories.map((item) => <Choice key={item.id} label={translateCatalogLabel(item.name, language)} selected={draft.categoryId === item.id} onPress={() => draft.changeCategory(item.id)} />)}
    {draft.categoryId && <><Text className="mb-3 mt-4 font-semibold text-foreground">{t("specificService")}</Text>{draft.catalogLoading ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("checkingServices")} /> : draft.categoryOfferings.map((row) => <Choice key={row.service.id} label={`${translateCatalogLabel(row.service.title, language)} · ${row.availability_status === "available" ? formatNpr(row.service.base_paisa + row.service.visit_paisa) : row.availability_status === "paused" ? t("pausedHere") : `${t("comingSoonIn")} ${regionKeys[draft.region] ? t(regionKeys[draft.region]) : draft.region}`}`} selected={draft.offeringId === row.service.id} disabled={row.availability_status !== "available"} onPress={() => draft.setOfferingId(row.service.id)} />)}{!draft.catalogLoading && draft.categoryOfferings.length === 0 && <Text className="mb-3 text-muted-foreground">{t("noRegionalServices")} {regionKeys[draft.region] ? t(regionKeys[draft.region]) : draft.region}.</Text>}</>}
    <Text className="mb-3 mt-6 font-semibold text-foreground">{t("professional")}</Text>
    <Choice label={t("unassignedQuotePending")} selected={!draft.professionalId} onPress={() => draft.setProfessionalId("")} />
    {draft.choices.map((item) => <Choice key={item.profile_id} label={`${item.full_name || t("verifiedProfessional")} · ${hourlyRateLabel(item.hourly_rate_paisa)}`} selected={draft.professionalId === item.profile_id} onPress={() => draft.setProfessionalId(item.profile_id)} />)}
    {draft.proLoading && <ActivityIndicator color={tokens.colors.primary} accessibilityLabel={t("loadingVerifiedProfessionals")} />}
    {draft.hasMore && !draft.proLoading && <Choice label={t("moreProfessionals")} onPress={draft.loadMore} />}
    {draft.dataError && <View><Text accessibilityRole="alert">{draft.dataError}</Text><Choice label={t("retryLoading")} onPress={draft.retryData} /></View>}
    <Text className="mb-4 mt-6 text-muted-foreground">{t("nepalTimeNote")}</Text>
    <Field label={t("dateFormat")} value={draft.schedule.date} onChangeText={(date) => draft.setSchedule({ ...draft.schedule, date })} autoCapitalize="none" maxLength={10} />
    <Field label={t("timeFormat")} value={draft.schedule.time} onChangeText={(time) => draft.setSchedule({ ...draft.schedule, time })} autoCapitalize="none" maxLength={5} />
    <Text className="mb-3 font-semibold text-foreground">{t("estimatedDuration")}</Text>
    <View className="flex-row flex-wrap gap-2">{DURATION_OPTIONS.map((minutes) => <Choice key={minutes} label={`${minutes} ${t("durationMinutes")}`} selected={draft.duration === minutes} onPress={() => draft.setDuration(minutes)} />)}</View>
    <Text className="mb-3 mt-6 font-semibold text-foreground">{t("landmarkLocation")}</Text>
    <LocationPicker value={draft.location.map_pin ?? null} onChange={draft.setPin} disabled={draft.busy || draft.loading} region={draft.region} />
    {draft.savedLocation && <Choice label={`${t("savedLocationLabel")}: ${draft.savedLocation.landmark}`} onPress={draft.useSavedLocation} />}
    <Field label={t("municipalityArea")} value={draft.location.municipality} onChangeText={(municipality) => draft.setLocation({ ...draft.location, municipality })} maxLength={100} />
    <Field label={t("wardOptional")} value={draft.location.ward} onChangeText={(ward) => draft.setLocation({ ...draft.location, ward })} keyboardType="number-pad" maxLength={2} />
    <Field label={t("nearbyLandmark")} value={draft.location.landmark} onChangeText={(landmark) => draft.setLocation({ ...draft.location, landmark })} maxLength={160} />
    <Field label={t("jobDetails")} value={draft.details} onChangeText={draft.setDetails} multiline textAlignVertical="top" maxLength={2000} style={{ minHeight: 120 }} placeholder={t("jobDetailsHint")} />
    <Text className="mt-2 text-xl font-semibold text-primary">{t("estimatedLabourTotal")}: {draft.estimate === null ? t("quotePending") : formatNpr(draft.estimate)}</Text>
    <Text className="mb-6 mt-3 text-sm leading-5 text-muted-foreground">{t("labourEstimateOnly")}</Text>
    {(draft.error || draft.estimateError) && <Text accessibilityRole="alert" className="mb-4 text-foreground">{draft.error || draft.estimateError}</Text>}
    <Pressable accessibilityRole="button" disabled={draft.busy || draft.loading} onPress={() => void draft.submit()} className="min-h-12 items-center justify-center rounded-md bg-primary p-4"><Text className="font-semibold text-primary-foreground">{draft.busy ? t("submitting") : t("submitRequest")}</Text></Pressable>
    <Link href="/(app)/bookings" className="mt-4 py-3 text-center text-primary underline">{t("myBookings")}</Link>
  </ScrollView></KeyboardAvoidingView>;
}


