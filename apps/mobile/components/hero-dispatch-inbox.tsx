"use client";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, Text, View } from "react-native";
import { formatBookingDate, type Database } from "@tirkha/shared";
import { useAuth } from "../providers/auth-provider";
import { changeBooking } from "../lib/bookings";
import { tokens } from "@tirkha/shared";

type DispatchNotice = Database["public"]["Tables"]["hero_dispatch_notifications"]["Row"];
export function HeroDispatchInbox({ onAccepted }: { onAccepted: () => void }) {
  const { client, session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<DispatchNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    const { data, error: failure } = await client.from("hero_dispatch_notifications")
      .select("*").eq("professional_id", userId).in("status", ["new", "seen"])
      .order("created_at", { ascending: false }).limit(20);
    if (failure) setError("Nearby alerts are temporarily unavailable. Pull to refresh your jobs.");
    else { setItems(data ?? []); setError(""); }
    setLoading(false);
  }, [client, userId]);
  useEffect(() => {
    if (!client || !userId) return;
    let active = true;
    const load = () => { if (active) void refresh(); };
    load();
    const channel = client.channel(`hero-dispatch:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hero_dispatch_notifications", filter: `professional_id=eq.${userId}` }, load)
      .subscribe();
    const timer = setInterval(load, 30_000);
    const appState = AppState.addEventListener("change", state => { if (state === "active") load(); });
    return () => { active = false; clearInterval(timer); appState.remove(); void client.removeChannel(channel); };
  }, [client, userId, refresh]);
  async function accept(item: DispatchNotice) {
    if (busy) return;
    setBusy(item.id); setError("");
    try { await changeBooking(item.booking_id, "accepted"); await refresh(); onAccepted(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "This request is no longer available. Refresh and try again."); await refresh(); }
    finally { setBusy(null); }
  }
  return <View className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
    <Text accessibilityRole="header" className="text-xs font-bold uppercase tracking-widest text-emerald-900">Hero Dispatch · nearby jobs</Text>
    {loading && !items.length && <View className="mt-3"><ActivityIndicator color={tokens.colors.primary} accessibilityLabel="Checking nearby requests" /></View>}
    {!!error && <Text accessibilityRole="alert" className="mt-3 text-amber-900">{error}</Text>}
    {!loading && !error && !items.length && <Text className="mt-2 text-slate-600">No nearby requests right now. Keep your availability on for matching jobs.</Text>}
    {items.map(item => <View key={item.id} className="mt-3 rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-2"><View className="flex-1"><Text className="text-lg font-semibold text-primary">{item.service_name}</Text><Text className="mt-1 text-sm text-muted-foreground">{item.distance_meters == null ? "Assigned directly to you" : `${(item.distance_meters / 1000).toFixed(1)} km away`} · {formatBookingDate(item.scheduled_at)}</Text></View><Text className={`rounded-full px-2 py-1 text-xs font-semibold ${item.diagnostic_urgency === "urgent" ? "bg-rose-100 text-rose-900" : "bg-slate-100 text-slate-700"}`}>{item.diagnostic_severity || item.diagnostic_urgency?.toUpperCase() || "Routine"}</Text></View>
      <Text className="mt-3 leading-5 text-foreground">{item.diagnostic_summary || "No AI triage summary was provided. Review details before accepting."}</Text>
      <Text className="mt-2 text-sm font-medium text-foreground">Customer location</Text><Text className="text-sm text-muted-foreground">{item.service_address}</Text>
      {item.suggested_parts.length > 0 && <View className="mt-2"><Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Possible parts · verify on site</Text>{item.suggested_parts.map((part, index) => <Text key={`${item.id}-part-${index}`} className="mt-1 text-sm text-foreground">• {part}</Text>)}</View>}
      {item.latitude != null && item.longitude != null && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`)} className="mt-3 min-h-11 justify-center"><Text className="font-medium text-emerald-900 underline">Open pinned location in Maps</Text></Pressable>}
      <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void accept(item)} className="mt-2 min-h-12 justify-center rounded-lg bg-primary px-4"><Text className="text-center font-semibold text-primary-foreground">{busy === item.id ? "Accepting…" : "Accept this nearby job"}</Text></Pressable>
    </View>)}
  </View>;
}
