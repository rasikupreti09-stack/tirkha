"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { formatBookingDate, type Database } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
import { useLanguage } from "../providers/language-provider";
import { changeBooking } from "../lib/bookings";
import { tokens } from "@tirkha/shared";

type DispatchNotice = Database["public"]["Tables"]["hero_dispatch_notifications"]["Row"];
type BookingStatus = Database["public"]["Tables"]["bookings"]["Row"]["status"];
type BookingContact = { full_name: string | null; phone: string };
type BookingLiveDetails = {
  status: BookingStatus | null;
  professionalId: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

export function HeroDispatchInbox({ refreshSignal }: { refreshSignal: number }) {
  const { client, session } = useAuth();
  const { language } = useLanguage();
  const isNepali = language === "np";
  const userId = session?.user.id;
  const [items, setItems] = useState<DispatchNotice[]>([]);
  const [bookingDetails, setBookingDetails] = useState<Record<string, BookingLiveDetails>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const previousRefreshSignal = useRef(refreshSignal);
  const activeRef = useRef(false);
  const requestRef = useRef(0);
  const refresh = useCallback(async () => {
    if (!client || !userId) { setLoading(false); return; }
    const request = ++requestRef.current;
    try {
      const { data, error: failure } = await client.from("hero_dispatch_notifications")
        .select("*").eq("professional_id", userId).in("status", ["new", "seen"])
        .order("created_at", { ascending: false }).limit(20);
      if (!activeRef.current || request !== requestRef.current) return;
      if (failure) setError("Nearby alerts are temporarily unavailable. Refresh to try again.");
      else {
        const notices = data ?? [];
        setItems(notices);
        setError("");
        const bookingIds = [...new Set(notices.map((notice) => notice.booking_id))];
        if (bookingIds.length === 0) {
          setBookingDetails({});
          return;
        }

        const { data: bookings } = await client.from("bookings")
          .select("id,status,professional_id").in("id", bookingIds);
        if (!activeRef.current || request !== requestRef.current) return;
        const bookingById = new Map((bookings ?? []).map((booking) => [booking.id, booking]));
        const contactEntries = await Promise.all(notices.map(async (notice) => {
          const booking = bookingById.get(notice.booking_id);
          const isAssignedToHero = booking?.professional_id === userId;
          const isActive = booking?.status === "accepted" || booking?.status === "on_the_way" || booking?.status === "in_progress";
          let contact: BookingContact | null = null;
          if (isAssignedToHero && isActive) {
            const { data: contactRows, error: contactError } = await client.rpc("get_booking_contact", {
              p_booking_id: notice.booking_id,
            });
            if (!contactError) contact = (contactRows as BookingContact[] | null)?.[0] ?? null;
          }
          return [notice.booking_id, {
            status: booking?.status ?? null,
            professionalId: booking?.professional_id ?? null,
            customerName: contact?.full_name ?? null,
            customerPhone: contact?.phone ?? null,
          }] as const;
        }));
        if (!activeRef.current || request !== requestRef.current) return;
        setBookingDetails(Object.fromEntries(contactEntries));
      }
    } catch {
      if (activeRef.current && request === requestRef.current) setError("Nearby alerts are temporarily unavailable. Refresh to try again.");
    } finally {
      if (activeRef.current && request === requestRef.current) setLoading(false);
    }
  }, [client, userId]);
  useEffect(() => {
    if (!client || !userId) return;
    activeRef.current = true;
    const load = () => { if (activeRef.current) void refresh(); };
    load();
    const channel = client.channel(`hero-dispatch:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_dispatch_notifications", filter: `professional_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${userId}` }, load)
      .subscribe();
    const timer = setInterval(load, 30_000);
    const appState = AppState.addEventListener("change", state => { if (state === "active") load(); });
    return () => { activeRef.current = false; requestRef.current++; clearInterval(timer); appState.remove(); void client.removeChannel(channel); };
  }, [client, userId, refresh]);
  useEffect(() => {
    if (previousRefreshSignal.current === refreshSignal) return;
    previousRefreshSignal.current = refreshSignal;
    void refresh();
  }, [refresh, refreshSignal]);
  async function accept(item: DispatchNotice) {
    if (busy) return;
    setBusy(item.id); setError("");
    try { await changeBooking(item.booking_id, "accepted"); await refresh(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This request is no longer available. Refresh and try again."); await refresh(); }
    finally { setBusy(null); }
  }
  function decline(item: DispatchNotice) {
    setDismissedIds((current) => new Set(current).add(item.id));
  }
  function statusLabel(status: BookingStatus | null | undefined) {
    const labels: Record<string, string> = {
      requested: isNepali ? "प्रतीक्षामा" : "Pending",
      accepted: isNepali ? "स्वीकृत" : "Accepted",
      on_the_way: isNepali ? "बाटोमा" : "En route",
      in_progress: isNepali ? "काम हुँदैछ" : "In progress",
      completed: isNepali ? "सम्पन्न" : "Completed",
      cancelled: isNepali ? "रद्द" : "Cancelled",
    };
    return labels[status ?? ""] ?? (status ?? (isNepali ? "स्थिति उपलब्ध छैन" : "Status unavailable"));
  }
  const visibleItems = items.filter((item) => !dismissedIds.has(item.id));
  return <View className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <Text accessibilityRole="header" className="text-xs font-bold uppercase tracking-widest text-emerald-900">{isNepali ? "हिरो डिस्प्याच · नजिकका काम" : "Hero Dispatch · nearby jobs"}</Text>
    {loading && !items.length && <View className="mt-3"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Checking nearby requests" /></View>}
    {!!error && <Text accessibilityRole="alert" className="mt-3 text-amber-900">{error}</Text>}
    {!loading && !error && !visibleItems.length && <Text className="mt-2 text-slate-600">{isNepali ? "अहिले नजिकै कुनै अनुरोध छैन। मिल्ने कामका लागि उपलब्धता अन राख्नुहोस्।" : "No nearby requests right now. Keep your availability on for matching jobs."}</Text>}
    {visibleItems.map(item => {
      const booking = bookingDetails[item.booking_id];
      const isAssignedToHero = booking?.professionalId === userId;
      const isActive = booking?.status === "accepted" || booking?.status === "on_the_way" || booking?.status === "in_progress";
      return <View key={item.id} className="mt-3 rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2"><View className="flex-1"><Text className="text-lg font-semibold text-primary">{item.service_name}</Text><Text className="mt-1 text-sm text-muted-foreground">{item.distance_meters == null ? "Assigned directly to you" : `${(item.distance_meters / 1000).toFixed(1)} km away`} · {formatBookingDate(item.scheduled_at)}</Text></View><Text className={`rounded-full px-2 py-1 text-xs font-semibold ${item.diagnostic_urgency === "urgent" ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-700"}`}>{item.diagnostic_severity || item.diagnostic_urgency?.toUpperCase() || "Routine"}</Text></View>
      <Text className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-900">{isNepali ? "अनुरोधको स्थिति" : "Request status"}: {statusLabel(booking?.status ?? (item.status === "new" || item.status === "seen" ? "requested" : null))}</Text>
      <Text className="mt-3 leading-5 text-foreground">{item.diagnostic_summary || "No AI triage summary was provided. Review details before accepting."}</Text>
      <Text className="mt-2 text-sm font-medium text-foreground">{isNepali ? "ग्राहकको स्थान" : "Customer location"}</Text><Text className="text-sm text-muted-foreground">{item.service_address || (isNepali ? "ठेगाना उपलब्ध छैन" : "Address not provided")}</Text>
      {item.latitude != null && item.longitude != null && <Text selectable className="mt-1 text-xs text-muted-foreground">{isNepali ? "निर्देशाङ्क" : "Coordinates"}: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</Text>}
      <View className="mt-3 rounded-lg bg-slate-50 p-3">
        <Text className="text-sm font-semibold text-foreground">{isNepali ? "ग्राहक" : "Customer"}: {booking?.customerName ?? (isNepali ? "काम स्वीकारेपछि उपलब्ध हुनेछ" : "Available after accepting")}</Text>
        <Text className="mt-1 text-sm text-muted-foreground">{isNepali ? "फोन" : "Phone"}: {booking?.customerPhone ?? (isNepali ? "काम स्वीकारेपछि उपलब्ध हुनेछ" : "Available after accepting")}</Text>
        {isAssignedToHero && isActive && booking?.customerPhone && <Pressable accessibilityRole="button" accessibilityLabel={isNepali ? "ग्राहकलाई फोन गर्नुहोस्" : "Call customer"} onPress={() => void Linking.openURL(`tel:${booking.customerPhone?.replace(/[^\d+]/g, "")}`)} className="mt-2 min-h-11 justify-center">
          <Text className="font-semibold text-emerald-900 underline">{isNepali ? "☎ ग्राहकलाई फोन गर्नुहोस्" : "☎ Call customer"}</Text>
        </Pressable>}
      </View>
      {item.suggested_parts.length > 0 && <View className="mt-2"><Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Possible parts · verify on site</Text>{item.suggested_parts.map((part, index) => <Text key={`${item.id}-part-${index}`} className="mt-1 text-sm text-foreground">• {part}</Text>)}</View>}
      {item.latitude != null && item.longitude != null && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`)} className="mt-3 min-h-11 justify-center"><Text className="font-medium text-emerald-900 underline">Open pinned location in Maps</Text></Pressable>}
      {isAssignedToHero && isActive && <Link href={{ pathname: "/(app)/chat", params: { booking: item.booking_id } }} asChild>
        <Pressable accessibilityRole="button" className="mt-2 min-h-11 items-center justify-center rounded-lg border border-emerald-700 px-3">
          <Text className="font-semibold text-emerald-900">{isNepali ? "च्याट खोल्नुहोस्" : "Open chat"}</Text>
        </Pressable>
      </Link>}
      <View className="mt-3 flex-row gap-2">
        <Pressable accessibilityRole="button" accessibilityLabel={isNepali ? "अनुरोध अस्वीकार गर्नुहोस्" : "Decline request"} disabled={busy !== null} onPress={() => decline(item)} className="min-h-12 flex-1 items-center justify-center rounded-lg border border-border bg-card px-3"><Text className="text-center font-semibold text-foreground">{isNepali ? "अस्वीकार" : "Decline"}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void accept(item)} className="min-h-12 flex-1 items-center justify-center rounded-lg bg-primary px-3"><Text className="text-center font-semibold text-primary-foreground">{busy === item.id ? (isNepali ? "स्वीकार हुँदै…" : "Accepting…") : (isNepali ? "काम स्वीकार्नुहोस्" : "Accept job")}</Text></Pressable>
      </View>
      <Text className="mt-2 text-xs text-muted-foreground">{isNepali ? "अस्वीकार गर्दा यो अनुरोध तपाईंको सूचीबाट मात्र लुक्छ; अरू हिरोले अझै स्वीकार गर्न सक्छन्।" : "Declining hides this request from your list on this device; another Hero may still accept it."}</Text>
    </View>;
    })}
  </View>;
}
