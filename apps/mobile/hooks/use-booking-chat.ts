
import { useEffect, useRef, useState } from "react";
import { CHAT_PAGE_SIZE, chatMessageSchema, sendMessageSchema, workflowBookingSchema, canChat, chatError, type ChatMessage, type WorkflowBooking } from "@tirkha/shared";
import { getSupabase, isLocalMock } from "../lib/supabase";
import { AppState } from "react-native";
import { randomUUID } from "expo-crypto";
export function useBookingChat(bookingId: string, userId: string) {
  const [booking, setBooking] = useState<WorkflowBooking | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ text: string; id: string } | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    if (!sendMessageSchema.shape.booking_id.safeParse(bookingId).success) {
      setError("Invalid booking reference."); setLoading(false); return;
    }
    const client = getSupabase();
    void (async () => {
      try {
        const result = await client.from("bookings").select("*").eq("id", bookingId).single();
        if (result.error) throw result.error;
        const row = workflowBookingSchema.parse(result.data);
        if (row.customer_id !== userId && row.professional_id !== userId) throw new Error("Not a participant");
        let query = client.from("booking_messages").select("*").eq("booking_id", bookingId);
        if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
        const history = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(CHAT_PAGE_SIZE);
        if (history.error) throw history.error;
        const rows = chatMessageSchema.array().parse(history.data).reverse();
        if (active) { setBooking(row); setMessages(rows); }
      } catch { if (active) { setBooking(null); setMessages([]); setError("Could not load this conversation. Only booking participants have access. Try Refresh."); } }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [bookingId, userId, cursor, revision]);
  useEffect(() => {
    if (!sendMessageSchema.shape.booking_id.safeParse(bookingId).success) return;
    const client = getSupabase();
    let subscribed = true;
    const channel = client.channel("chat:" + bookingId + ":" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "booking_messages", filter: "booking_id=eq." + bookingId }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: "id=eq." + bookingId }, refresh)
      ;
    if (!isLocalMock) channel.subscribe((status) => { if (!subscribed) return; setLive(status === "SUBSCRIBED"); if (status === "SUBSCRIBED") refresh(); });
    const timer = setInterval(refresh, 15000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { subscribed = false; clearInterval(timer); subscription.remove(); void client.removeChannel(channel); };
  }, [bookingId, userId]);
  async function send() {
    if (lock.current || !booking || !canChat(booking, userId)) return;
    const text = draft.trim();
    if (!attempt.current || attempt.current.text !== text) attempt.current = { text, id: randomUUID() };
    const input = sendMessageSchema.safeParse({ booking_id: bookingId, client_message_id: attempt.current.id, body: text });
    if (!input.success) { setSendError(input.error.issues[0].message); return; }
    lock.current = true; setSending(true); setSendError("");
    try {
      const { error } = await getSupabase().rpc("send_booking_message", { p_booking_id: bookingId, p_client_message_id: input.data.client_message_id, p_body: input.data.body });
      if (error) throw error;
      if (mounted.current) { setDraft(""); attempt.current = null; setCursor(null); refresh(); }
    } catch (error) { if (mounted.current) setSendError(chatError(error)); }
    finally { lock.current = false; if (mounted.current) setSending(false); }
  }
  return { localMock: isLocalMock, booking, messages, loading, live, error, draft, setDraft, sending, sendError, send, refresh,
    writable: !!booking && canChat(booking, userId), older: () => { if (messages[0]) setCursor(messages[0]); },
    latest: () => { setCursor(null); refresh(); }, isLatest: cursor === null, hasOlder: messages.length === CHAT_PAGE_SIZE };
}





