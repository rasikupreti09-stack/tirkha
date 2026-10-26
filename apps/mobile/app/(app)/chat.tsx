import { Link, useLocalSearchParams } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { BOOKING_STATUS_LABELS, formatBookingDate } from "@tirkha/shared";
import { AccountGate } from "../../components/account-gate";
import { useBookingChat } from "../../hooks/use-booking-chat";
export default function Chat() {
  const { booking } = useLocalSearchParams<{ booking?: string }>();
  const id = typeof booking === "string" ? booking : "";
  return <AccountGate roles={["customer", "professional"]}>{({ profile }) => <Conversation key={profile.id + id} bookingId={id} userId={profile.id} professional={profile.role === "professional"} />}</AccountGate>;
}
function Conversation({ bookingId, userId, professional }: { bookingId: string; userId: string; professional: boolean }) {
  const chat = useBookingChat(bookingId, userId);
  return <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <FlatList data={chat.messages} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View className="mb-5">
        <Link href={professional ? "/(app)/jobs" : "/(app)/bookings"} className="py-3 text-primary underline">← Bookings</Link>
        <Text accessibilityRole="header" className="mt-4 text-2xl font-semibold text-primary">Booking conversation</Text>{chat.booking && <Text className="mt-3 font-medium text-primary">Booking status: {BOOKING_STATUS_LABELS[chat.booking.status]}</Text>}
        <Text className="mt-2 text-sm text-muted-foreground">{chat.localMock ? "Local mock polling" : chat.live ? "Live updates connected" : "Connecting live updates"} · refreshes every 15 seconds</Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Control label="Refresh" onPress={chat.refresh} />
          <Control label="Older" disabled={!chat.hasOlder || chat.loading} onPress={chat.older} />
          <Control label="Latest" onPress={chat.latest} />
        </View>
        {!chat.isLatest && <Text className="mt-3 text-muted-foreground">Viewing older messages. Tap Latest for new replies.</Text>}
        {!!chat.error && <Text accessibilityRole="alert" className="mt-4 text-foreground">{chat.error}</Text>}
        {chat.loading && <Text className="mt-3 text-muted-foreground">Refreshing…</Text>}
      </View>}
      ListEmptyComponent={!chat.loading && !chat.error ? <Text className="text-muted-foreground">No messages yet.</Text> : null}
      renderItem={({ item }) => <View className={item.sender_id === userId ? "mb-3 ml-5 rounded-lg border border-border bg-muted p-4" : "mb-3 mr-5 rounded-lg border border-border bg-card p-4"}>
        <Text className="text-xs font-semibold text-primary">{item.sender_id === userId ? "You" : "Booking participant"} · {formatBookingDate(item.created_at)}</Text>
        <Text className="mt-2 text-base leading-6 text-foreground">{item.body}</Text>
      </View>}
      ListFooterComponent={<View className="mt-4">
        {chat.booking && !chat.writable && <Text className="text-muted-foreground">{chat.booking.professional_id ? "This booking is closed. History is read-only." : "Chat becomes available when a professional is assigned."}</Text>}
        {chat.writable && <>
          <Text className="mb-2 font-semibold text-primary">Message</Text>
          <TextInput accessibilityLabel="Message" multiline maxLength={2000} editable={!chat.sending} value={chat.draft} onChangeText={chat.setDraft} textAlignVertical="top" className="min-h-24 rounded-md border border-border bg-card p-3 text-foreground" />
          {!!chat.sendError && <Text accessibilityRole="alert" className="mt-3 text-foreground">{chat.sendError}</Text>}
          <View className="mt-3"><Control label={chat.sending ? "Sending…" : "Send message"} disabled={chat.sending || !chat.draft.trim()} onPress={() => void chat.send()} /></View>
        </>}
      </View>}
    />
  </KeyboardAvoidingView>;
}
function Control({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className={`min-h-12 justify-center rounded-md border border-border px-4 py-3 ${disabled ? "opacity-40" : ""}`}><Text className="text-primary">{label}</Text></Pressable>;
}


