import { useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { BOOKING_ACTION_LABELS, BOOKING_PAGE_SIZE, BOOKING_STATUS_LABELS, bookingActions, bookingErrorMessage, formatBookingDate, formatNpr, tokens, type BookingAction, type BookingListMode, type WorkflowBooking } from "@tirkha/shared";
import { AccountGate } from "./account-gate";
import { PaymentCheckout } from "./payment-checkout";
import { ProviderWorkflow } from "./provider-workflow";
import { BookingTrackingCard } from "./booking-tracking-card";
import type { Account } from "../hooks/use-account";
import { useBookingFeed } from "../hooks/use-booking-feed";
import { changeBooking } from "../lib/bookings";
import { HeroDispatchInbox } from "./hero-dispatch-inbox";

function Action({ label, onPress, disabled = false, selected = false }: { label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} className={`min-h-12 justify-center rounded-md border border-border px-4 py-3 ${selected ? "bg-primary" : "bg-card"} ${disabled ? "opacity-40" : ""}`}><Text className={selected ? "text-primary-foreground" : "text-primary"}>{label}</Text></Pressable>;
}
export function BookingList({ professional = false }: { professional?: boolean }) {
  return <AccountGate roles={[professional ? "professional" : "customer"]}>{(account) => <Records account={account} professional={professional} />}</AccountGate>;
}
function Records({ account, professional }: { account: Account; professional: boolean }) {
  const [mode, setMode] = useState<BookingListMode>(professional ? "available" : "active");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const busyRef = useRef(false);
  const verified = account.professional?.verification_status === "verified";
  const feed = useBookingFeed(account.profile.id, account.profile.role, mode, page);
  async function update(booking: WorkflowBooking, action: BookingAction) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(booking.id); setMessage("");
    try { await changeBooking(booking.id, action); setMessage(action === "accepted" ? "Job accepted. Open Assigned to manage it." : "Booking updated."); }
    catch (error) { setMessage(bookingErrorMessage(error)); }
    finally { feed.refresh(); setBusy(null); busyRef.current = false; }
  }
  function confirm(booking: WorkflowBooking, action: BookingAction) {
    Alert.alert(BOOKING_ACTION_LABELS[action], action === "accepted" ? "Accept this job at the requested time? The displayed estimate stays unchanged." : action === "cancelled" ? "Cancel this pending request?" : `Mark this job as ${BOOKING_STATUS_LABELS[action].toLowerCase()}?`, [
      { text: "Go back", style: "cancel" }, { text: "Confirm", style: action === "cancelled" ? "destructive" : "default", onPress: () => void update(booking, action) },
    ]);
  }
  const modes: { key: BookingListMode; label: string }[] = [...(professional ? [{ key: "available" as const, label: "Available" }] : []), { key: "active", label: professional ? "Assigned" : "Active" }, { key: "completed", label: "Completed" }, { key: "cancelled", label: "Cancelled" }];
  return <FlatList className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 48, flexGrow: 1 }} data={feed.items} keyExtractor={(item) => item.id}
    refreshing={feed.loading} onRefresh={feed.refresh}
    ListHeaderComponent={<View className="mb-6">
      <Link href="/(app)/dashboard" className="mb-6 py-3 text-primary underline">← Dashboard</Link>
      <Text accessibilityRole="header" className="text-3xl font-semibold text-primary">{professional ? "Hero Dispatch · Professional jobs" : "My bookings"}</Text>
      {!professional && <Link href="/(app)/book" className="mt-4 rounded-md bg-primary p-4 text-center font-semibold text-primary-foreground">Request a service</Link>}
      {professional && verified && <HeroDispatchInbox onAccepted={feed.refresh} />}
      {professional && <Text className="mt-4 text-muted-foreground">{verified ? "Available requests match your service categories. Confirm the landmark and appointment before accepting." : "Verification is required to view available requests and update jobs."}</Text>}
      <View className="mt-6 flex-row flex-wrap gap-2">{modes.map((item) => <Action key={item.key} label={item.label} selected={mode === item.key} onPress={() => { setMode(item.key); setPage(0); setMessage(""); }} />)}<Action label="Refresh" onPress={feed.refresh} /></View>
      <Text className="mt-4 text-xs text-muted-foreground">{feed.localMock ? "Local mock polling" : feed.live ? "Live updates connected" : "Connecting live updates"} · refreshes every 30 seconds</Text>
      {!!message && <Text accessibilityRole="alert" className="mt-4 rounded-md border border-border p-4 text-foreground">{message}</Text>}
      {!!feed.error && <Text accessibilityRole="alert" className="mt-4 text-foreground">{feed.error}</Text>}
    </View>}
    ListEmptyComponent={feed.loading ? <ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Loading bookings" /> : !feed.error ? <Text className="text-muted-foreground">No bookings in this view.</Text> : null}
    renderItem={({ item }) => <View className="mb-4 rounded-lg border border-border bg-card p-5">
      <Text accessibilityRole="header" className="text-xl font-semibold text-primary">{feed.categories.find((category) => category.id === item.category_id)?.name || "Service request"}</Text>
      <Text className="mt-3 self-start rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">{BOOKING_STATUS_LABELS[item.status]}</Text>
      <Text className="mt-4 font-medium text-foreground">{formatBookingDate(item.scheduled_at)} · {item.duration_minutes} minutes</Text>
      <Text className="mt-3 text-foreground">{item.service_address}</Text>
      <Text className="mt-4 leading-6 text-muted-foreground">{item.job_details || "No job details provided."}</Text>
      {professional && item.diagnostic_summary && <View className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4"><Text className="font-semibold text-slate-900">AI-assisted triage · verify on site</Text><Text className="mt-2 text-slate-800">{item.diagnostic_summary}</Text>{item.diagnostic_severity && <Text className="mt-2 text-slate-800">Customer-reported severity: {item.diagnostic_severity}</Text>}{item.diagnostic_urgency && <Text className="mt-1 text-slate-800">Urgency: {item.diagnostic_urgency}</Text>}{(item.suggested_parts ?? []).length > 0 && <Text className="mt-1 text-slate-800">Possible parts: {item.suggested_parts?.join(", ")} (unconfirmed and unpriced)</Text>}</View>}
      <Text className="mt-4 font-semibold text-primary">Estimated labour total: {item.total_price_paisa === null ? "Quote pending" : formatNpr(item.total_price_paisa)}</Text>
      <Text className="mt-3 text-sm text-muted-foreground">{item.professional_id ? "Professional assigned" : "Awaiting professional assignment"}</Text>
      <Text className="mt-3 text-xs text-muted-foreground">Reference: {item.id}</Text>{(item.customer_id === account.profile.id || item.professional_id === account.profile.id) && <Link href={{ pathname: "/(app)/chat", params: { booking: item.id } }} className="mt-4 py-3 font-medium text-primary underline">Open booking chat</Link>}
      <View className="mt-4 gap-2">{!professional && bookingActions(item, account.profile.id, account.profile.role, verified).map((action) => <Action key={action} label={busy === item.id ? "Updating…" : BOOKING_ACTION_LABELS[action]} disabled={busy !== null} onPress={() => confirm(item, action)} />)}</View>
      {professional ? <ProviderWorkflow booking={item} userId={account.profile.id} verified={verified} busy={busy !== null} updating={busy === item.id} onAction={(action) => confirm(item, action)} /> : <BookingTrackingCard booking={item} live={feed.live} localMock={feed.localMock} stale={!!feed.error} />}
      {!professional && <PaymentCheckout bookingId={item.id} amount={item.total_price_paisa} cancelled={item.status === "cancelled"} />}
    </View>}
    ListFooterComponent={<View className="mt-6 flex-row items-center justify-between"><Action label="Previous" disabled={page === 0 || feed.loading} onPress={() => setPage((value) => value - 1)} /><Text className="text-foreground">Page {page + 1}</Text><Action label="Next" disabled={feed.items.length < BOOKING_PAGE_SIZE || feed.loading} onPress={() => setPage((value) => value + 1)} /></View>}
  />;
}



