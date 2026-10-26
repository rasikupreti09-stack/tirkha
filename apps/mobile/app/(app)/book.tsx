import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { DURATION_OPTIONS, formatBookingDate, formatNpr, hourlyRateLabel, tokens } from "@tirkha/shared";
import { AccountGate } from "../../components/account-gate";
import { PaymentCheckout } from "../../components/payment-checkout";
import { useBookingDraft } from "../../hooks/use-booking-draft";
import { LocationPicker } from "../../components/location-picker";

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View className="mb-4"><Text className="mb-2 font-medium text-foreground">{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={tokens.colors["muted-foreground"]} className="min-h-12 rounded-md border border-border bg-card px-3 py-3 text-foreground" {...props} /></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} className={selected ? "mb-2 min-h-12 justify-center rounded-md bg-primary p-3" : "mb-2 min-h-12 justify-center rounded-md border border-border p-3"}><Text className={selected ? "text-primary-foreground" : "text-foreground"}>{label}</Text></Pressable>;
}
export default function Book() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  return <AccountGate roles={["customer"]}>{() => <BookingFields key={category || ""} slug={typeof category === "string" ? category : ""} />}</AccountGate>;
}
function BookingFields({ slug }: { slug: string }) {
  const draft = useBookingDraft(slug);
  if (draft.created) return <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
    <Text accessibilityRole="header" className="text-3xl font-semibold text-primary">Booking requested</Text>
    <Text className="mt-4 text-foreground">{formatBookingDate(draft.created.scheduled_at)}</Text>
    <Text className="mt-4 text-foreground">Estimated labour total: {draft.created.total_price_paisa === null ? "Quote pending" : formatNpr(draft.created.total_price_paisa)}</Text>
    <Text className="mt-4 text-muted-foreground">Reference: {draft.created.id}</Text>
    <PaymentCheckout bookingId={draft.created.id} amount={draft.created.total_price_paisa} /><Link href="/(app)/bookings" className="mt-6 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">My bookings</Link>
  </ScrollView>;
  return <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
    <Link href="/(app)/dashboard" className="mb-6 py-3 text-primary underline">← Dashboard</Link>
    <Text accessibilityRole="header" className="mb-6 text-3xl font-semibold text-primary">Request a service</Text>
    {draft.loading && <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading services" />}
    <Text className="mb-3 font-semibold text-foreground">Service category</Text>
    {draft.categories.map((item) => <Choice key={item.id} label={item.name} selected={draft.categoryId === item.id} onPress={() => draft.changeCategory(item.id)} />)}
    <Text className="mb-3 mt-6 font-semibold text-foreground">Professional</Text>
    <Choice label="Unassigned request · quote pending" selected={!draft.professionalId} onPress={() => draft.setProfessionalId("")} />
    {draft.choices.map((item) => <Choice key={item.profile_id} label={`${item.full_name || "Verified professional"} · ${hourlyRateLabel(item.hourly_rate_paisa)}`} selected={draft.professionalId === item.profile_id} onPress={() => draft.setProfessionalId(item.profile_id)} />)}
    {draft.proLoading && <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading professionals" />}
    {draft.hasMore && !draft.proLoading && <Choice label="More professionals" onPress={draft.loadMore} />}
    {draft.dataError && <View><Text accessibilityRole="alert">{draft.dataError}</Text><Choice label="Retry loading" onPress={draft.retryData} /></View>}
    <Text className="mb-4 mt-6 text-muted-foreground">Appointments use Nepal time (UTC+05:45).</Text>
    <Field label="Date (YYYY-MM-DD)" value={draft.schedule.date} onChangeText={(date) => draft.setSchedule({ ...draft.schedule, date })} autoCapitalize="none" maxLength={10} />
    <Field label="Time (HH:mm, 24-hour)" value={draft.schedule.time} onChangeText={(time) => draft.setSchedule({ ...draft.schedule, time })} autoCapitalize="none" maxLength={5} />
    <Text className="mb-3 font-semibold text-foreground">Estimated duration</Text>
    <View className="flex-row flex-wrap gap-2">{DURATION_OPTIONS.map((minutes) => <Choice key={minutes} label={`${minutes} min`} selected={draft.duration === minutes} onPress={() => draft.setDuration(minutes)} />)}</View>
    <Text className="mb-3 mt-6 font-semibold text-foreground">Landmark location</Text>
    <LocationPicker value={draft.location.map_pin ?? null} onChange={draft.setPin} disabled={draft.busy || draft.loading} />
    {draft.savedLocation && <Choice label={`Use saved location: ${draft.savedLocation.landmark}`} onPress={draft.useSavedLocation} />}
    <Field label="Municipality or area" value={draft.location.municipality} onChangeText={(municipality) => draft.setLocation({ ...draft.location, municipality })} maxLength={100} />
    <Field label="Ward (optional)" value={draft.location.ward} onChangeText={(ward) => draft.setLocation({ ...draft.location, ward })} keyboardType="number-pad" maxLength={2} />
    <Field label="Nearby landmark" value={draft.location.landmark} onChangeText={(landmark) => draft.setLocation({ ...draft.location, landmark })} maxLength={160} />
    <Field label="Job details" value={draft.details} onChangeText={draft.setDetails} multiline textAlignVertical="top" maxLength={2000} style={{ minHeight: 120 }} placeholder="Describe the work and access instructions (10–2,000 characters)." />
    <Text className="mt-2 text-xl font-semibold text-primary">Estimated labour total: {draft.estimate === null ? "Quote pending" : formatNpr(draft.estimate)}</Text>
    <Text className="mb-6 mt-3 text-sm leading-5 text-muted-foreground">Labour estimate only; materials and final charges need agreement. Unassigned requests remain quote pending after acceptance. Your landmark will be saved on this device.</Text>
    {(draft.error || draft.estimateError) && <Text accessibilityRole="alert" className="mb-4 text-foreground">{draft.error || draft.estimateError}</Text>}
    <Pressable accessibilityRole="button" disabled={draft.busy || draft.loading} onPress={() => void draft.submit()} className="min-h-12 items-center justify-center rounded-md bg-primary p-4"><Text className="font-semibold text-primary-foreground">{draft.busy ? "Submitting…" : "Submit request"}</Text></Pressable>
    <Link href="/(app)/bookings" className="mt-4 py-3 text-center text-primary underline">My bookings</Link>
  </ScrollView></KeyboardAvoidingView>;
}


