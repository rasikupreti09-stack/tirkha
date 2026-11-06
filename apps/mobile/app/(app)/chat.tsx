import { Link, useLocalSearchParams } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { formatBookingDate, translateUi } from "@tirkha/shared";
import { AccountGate } from "../../components/account-gate";
import { useBookingChat } from "../../hooks/use-booking-chat";
import { useLanguage } from "../../providers/language-provider";
export default function Chat() {
  const { booking } = useLocalSearchParams<{ booking?: string }>();
  const id = typeof booking === "string" ? booking : "";
  return <AccountGate roles={["customer", "professional"]}>{({ profile }) => <Conversation key={profile.id + id} bookingId={id} userId={profile.id} professional={profile.role === "professional"} />}</AccountGate>;
}
function Conversation({ bookingId, userId, professional }: { bookingId: string; userId: string; professional: boolean }) {
  const { language } = useLanguage();
  const t = (key: Parameters<typeof translateUi>[0]) => translateUi(key, language);
  const statusLabel: Record<string, Parameters<typeof translateUi>[0]> = {
    requested: "statusRequested",
    accepted: "statusAccepted",
    on_the_way: "statusOnTheWay",
    in_progress: "statusInProgress",
    completed: "statusCompleted",
    cancelled: "statusCancelled",
  };
  const chat = useBookingChat(bookingId, userId, language);
  return <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <FlatList data={chat.messages} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View className="mb-5">
        <Link href={professional ? "/(app)/jobs" : "/(app)/bookings"} className="py-3 text-primary underline">{t("chatBookings")}</Link>
        <Text accessibilityRole="header" className="mt-4 text-2xl font-semibold text-primary">{t("bookingConversation")}</Text>{chat.booking && <Text className="mt-3 font-medium text-primary">{t("bookingStatus")}: {t(statusLabel[chat.booking.status] ?? "statusRequested")}</Text>}
        <Text className="mt-2 text-sm text-muted-foreground">{chat.localMock ? t("localMockPolling") : chat.live ? t("liveUpdatesConnected") : t("connectingLiveUpdates")} {t("chatRefreshInterval")}</Text>
        <View className="mt-4 flex-row flex-wrap gap-3">
          <Control label={t("refresh")} onPress={chat.refresh} />
          <Control label={t("older")} disabled={!chat.hasOlder || chat.loading} onPress={chat.older} />
          <Control label={t("latest")} onPress={chat.latest} />
        </View>
        {!chat.isLatest && <Text className="mt-3 text-muted-foreground">{t("viewingOlderMessages")}</Text>}
        {!!chat.error && <Text accessibilityRole="alert" className="mt-4 text-foreground">{chat.error}</Text>}
        {chat.loading && <Text className="mt-3 text-muted-foreground">{t("refreshing")}</Text>}
      </View>}
      ListEmptyComponent={!chat.loading && !chat.error ? <Text className="text-muted-foreground">{t("noMessagesYet")}</Text> : null}
      renderItem={({ item }) => <View className={item.sender_id === userId ? "mb-3 ml-5 rounded-lg border border-border bg-muted p-4" : "mb-3 mr-5 rounded-lg border border-border bg-card p-4"}>
        <Text className="text-xs font-semibold text-primary">{item.sender_id === userId ? t("you") : t("bookingParticipant")} · {formatBookingDate(item.created_at)}</Text>
        <Text className="mt-2 text-base leading-6 text-foreground">{item.body}</Text>
      </View>}
      ListFooterComponent={<View className="mt-4">
        {chat.booking && !chat.writable && <Text className="text-muted-foreground">{chat.booking.professional_id ? t("bookingClosedReadOnly") : t("chatAvailableWhenAssigned")}</Text>}
        {chat.writable && <>
          <Text className="mb-2 font-semibold text-primary">{t("message")}</Text>
          <TextInput accessibilityLabel={t("message")} multiline maxLength={2000} editable={!chat.sending} value={chat.draft} onChangeText={chat.setDraft} textAlignVertical="top" className="min-h-24 rounded-md border border-border bg-card p-3 text-foreground" />
          {!!chat.sendError && <Text accessibilityRole="alert" className="mt-3 text-foreground">{chat.sendError}</Text>}
          <View className="mt-3"><Control label={chat.sending ? t("sending") : t("sendMessage")} disabled={chat.sending || !chat.draft.trim()} onPress={() => void chat.send()} /></View>
        </>}
      </View>}
    />
  </KeyboardAvoidingView>;
}
function Control({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className={`min-h-12 justify-center rounded-md border border-border px-4 py-3 ${disabled ? "opacity-40" : ""}`}><Text className="text-primary">{label}</Text></Pressable>;
}


