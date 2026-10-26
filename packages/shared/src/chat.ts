import { z } from "zod";
import type { WorkflowBooking } from "./schemas";
export const chatMessageSchema = z.object({
  id: z.uuid(), booking_id: z.uuid(), sender_id: z.uuid(), client_message_id: z.uuid(),
  body: z.string().min(1).max(2000), attachment_path: z.string().nullable().optional(), created_at: z.iso.datetime({ offset: true }),
});
export const sendMessageSchema = z.strictObject({ booking_id: z.uuid(), client_message_id: z.uuid(), body: z.string().trim().min(1, "Enter a message.").max(2000, "Keep messages under 2,000 characters.") });
export const pushNavigationSchema = z.object({ booking_id: z.uuid(), recipient_id: z.uuid(), kind: z.enum(["chat", "job_status", "hero_dispatch"]) });
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type PushJob = {
  id: string; event_key: string; recipient_id: string; booking_id: string; token: string;
  kind: "chat" | "job_status" | "hero_dispatch"; booking_status: WorkflowBooking["status"] | null;
  state: "queued" | "processing" | "receipt" | "delivered" | "failed" | "skipped";
  attempts: number; ticket_id: string | null; last_error: string | null; available_at: string; lease_id: string | null; created_at: string;
};
export const CHAT_PAGE_SIZE = 50;
export function canChat(booking: WorkflowBooking, userId: string) {
  return !!booking.professional_id && [booking.customer_id, booking.professional_id].includes(userId) && ["requested", "accepted", "on_the_way", "in_progress"].includes(booking.status);
}
export function chatError(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const errors: Record<string, string> = { CHAT_CLOSED: "This conversation is now read-only.", CHAT_UNAVAILABLE: "This conversation is unavailable to your account.", MESSAGE_RATE_LIMIT: "Please wait a moment before sending another message.", INVALID_MESSAGE: "Enter 1–2,000 characters.", MESSAGE_ID_REUSED: "Refresh the conversation before sending again." };
  return errors[message] || "Message could not be confirmed. Retry the same message to avoid duplicates.";
}
