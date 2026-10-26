import type { WorkflowBooking, UserRole, LocationPreference } from "./schemas";
import { z } from "zod";

export const BOOKING_PAGE_SIZE = 20;
export const BOOKING_STATUS_LABELS = {
  requested: "Pending", accepted: "Accepted", on_the_way: "On the Way", in_progress: "In Progress",
  completed: "Completed", cancelled: "Cancelled",
} as const;
export const BOOKING_ACTION_LABELS = {
  accepted: "Accept job", on_the_way: "On the Way", in_progress: "Start job", completed: "Finish job", cancelled: "Cancel request",
} as const;
export type BookingAction = keyof typeof BOOKING_ACTION_LABELS;
const bookingActionSchema = z.enum(["accepted", "on_the_way", "in_progress", "completed", "cancelled"]);
export function nextBookingStatus(status: WorkflowBooking["status"]): BookingAction | null {
  const next: Partial<Record<WorkflowBooking["status"], BookingAction>> = {
    requested: "accepted", accepted: "on_the_way", on_the_way: "in_progress", in_progress: "completed",
  };
  return next[status] ?? null;
}
/** Always use the authenticated RPC: the database checks ownership, verification
 * and ordering under a row lock. Never optimistically write status to the table. */
export async function transitionBookingStatus(client: {
  rpc(name: "transition_booking", args: { p_booking_id: string; p_action: string }): {
    single(): PromiseLike<{ data: unknown; error: unknown }>;
  };
}, bookingId: string, action: BookingAction): Promise<unknown> {
  const { data, error } = await client.rpc("transition_booking", {
    p_booking_id: z.uuid().parse(bookingId), p_action: bookingActionSchema.parse(action),
  }).single();
  if (error) throw error;
  return data;
}
export const BOOKING_TRACKING_STEPS = ["requested", "accepted", "on_the_way", "in_progress", "completed"] as const;
export const BOOKING_TRACKING_MESSAGES: Record<WorkflowBooking["status"], string> = {
  requested: "Waiting for a professional to accept your request.",
  accepted: "Your professional has accepted the job.",
  on_the_way: "Your professional is on the way to your service location.",
  in_progress: "Your professional has started the work.",
  completed: "Your professional has marked the work complete.",
  cancelled: "This booking was cancelled.",
};
export type BookingListMode = "active" | "completed" | "cancelled" | "available";
export const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240, 360, 480] as const;

export function locationToAddress(location: LocationPreference): string {
  return [location.municipality, location.ward ? "Ward " + location.ward : "", "Near " + location.landmark].filter(Boolean).join(", ");
}
export function nepalDateTimeToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Enter a valid date and time.");
  const millis = Date.parse(`${date}T${time}:00+05:45`);
  if (!Number.isFinite(millis) || new Date(millis + 345 * 60_000).toISOString().slice(0, 16) !== date + "T" + time) {
    throw new Error("Enter a valid date and time.");
  }
  return new Date(millis).toISOString();
}
export function defaultNepalSchedule() {
  const date = new Date(Date.now() + 86_400_000 + 345 * 60_000).toISOString().slice(0, 10);
  return { date, time: "09:00" };
}
export function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: "Asia/Kathmandu", dateStyle: "medium", timeStyle: "short",
  }).format(new Date(value)) + " NPT";
}
export function estimateLabourPaisa(rate: number | null, minutes: number): number | null {
  if (!Number.isInteger(minutes) || minutes < 30 || minutes > 480 || minutes % 30 !== 0) throw new Error("Invalid duration.");
  if (rate === null) return null;
  if (!Number.isInteger(rate) || rate < 0) throw new Error("Invalid rate.");
  const total = Math.round(rate * minutes / 60);
  if (total > 2_147_483_647) throw new Error("This duration exceeds the supported price. Choose a shorter duration.");
  return total;
}
export function bookingActions(booking: WorkflowBooking, userId: string, role: UserRole, verified: boolean): BookingAction[] {
  if (booking.customer_id === userId && booking.status === "requested") return ["cancelled"];
  if (role !== "professional" || !verified || booking.customer_id === userId) return [];
  if (booking.professional_id !== null && booking.professional_id !== userId) return [];
  if (booking.status === "requested") return Date.parse(booking.scheduled_at) > Date.now() ? ["accepted"] : [];
  if (booking.professional_id !== userId) return [];
  const next = nextBookingStatus(booking.status);
  return next ? [next] : [];
}
export function bookingErrorMessage(error: unknown): string {
  const code = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const messages: Record<string, string> = {
    PAYMENT_REVIEW_REQUIRED: "Check payment status first. A pending or paid booking needs payment review or a refund before cancellation. Contact support.",
    CUSTOMER_REQUIRED: "Only customer accounts can create booking requests.",
    REQUEST_ID_REUSED: "This request changed after submission. Check My bookings before creating a new request.",
    INVALID_SCHEDULE: "Choose a future appointment within the next year.",
    INVALID_DURATION: "Choose a duration between 30 minutes and 8 hours.",
    INVALID_JOB_DETAILS: "Enter a full landmark address and 10–2,000 characters of job details.",
    CATEGORY_UNAVAILABLE: "This category is no longer available. Choose another service.",
    PROFESSIONAL_UNAVAILABLE: "This professional is no longer available for that category.",
    VERIFIED_PROFESSIONAL_REQUIRED: "A verified professional account is required.",
    BOOKING_UNAVAILABLE: "This job is no longer available to your account. Refresh the list.",
    REQUEST_NO_LONGER_PENDING: "This request has already changed. Refresh the list.",
    INVALID_TRANSITION: "This status change is no longer allowed. Refresh the list.",
    CATEGORY_NOT_SUPPORTED: "This service is not assigned to your professional profile.",
    SCHEDULE_EXPIRED: "The requested appointment time has passed. Contact support.",
    SCHEDULE_CONFLICT: "You already have an accepted job during this time.",
    PRICE_TOO_LARGE: "The estimate is too large. Choose a shorter duration.",
  };
  return messages[code] || "The request could not be confirmed. Check your connection and refresh your bookings before retrying.";
}

