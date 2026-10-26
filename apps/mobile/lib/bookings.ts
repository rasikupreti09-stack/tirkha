import { transitionBookingStatus, workflowBookingSchema, serviceCategorySchema, BOOKING_PAGE_SIZE, type BookingRequest, type BookingAction, type BookingListMode, type UserRole } from "@tirkha/shared";
import { getSupabase } from "./supabase";

export async function createBooking(input: BookingRequest) {
  const { data, error } = await getSupabase().rpc("create_diagnostic_booking_request", {
    p_request_id: input.request_id, p_category_id: input.category_id,
    p_professional_id: input.professional_id, p_service_address: input.service_address,
    p_job_details: input.job_details, p_scheduled_at: input.scheduled_at,
    p_duration_minutes: input.duration_minutes,
    p_latitude: input.latitude ?? null, p_longitude: input.longitude ?? null, p_resolved_address: input.resolved_address ?? null,
    p_diagnostic_summary: input.diagnostic_summary ?? null, p_diagnostic_severity: input.diagnostic_severity ?? null,
    p_diagnostic_urgency: input.diagnostic_urgency ?? null, p_suggested_parts: input.suggested_parts ?? [],
  }).single();
  if (error) throw error;
  return workflowBookingSchema.parse(data);
}
export async function changeBooking(id: string, action: BookingAction) {
  return workflowBookingSchema.parse(await transitionBookingStatus(getSupabase(), id, action));
}
export async function loadBookings(userId: string, role: UserRole, mode: BookingListMode, page: number) {
  const client = getSupabase();
  let query = client.from("bookings").select("*");
  if (role === "professional" && mode === "available") {
    query = query.is("professional_id", null).eq("status", "requested").gt("scheduled_at", new Date().toISOString());
  } else {
    query = role === "customer" ? query.eq("customer_id", userId) : query.eq("professional_id", userId);
    query = mode === "completed" || mode === "cancelled" ? query.eq("status", mode) : query.in("status", ["requested", "accepted", "on_the_way", "in_progress"]);
  }
  const [result, categories] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(page * BOOKING_PAGE_SIZE, (page + 1) * BOOKING_PAGE_SIZE - 1),
    client.from("service_categories").select("*"),
  ]);
  if (result.error) throw result.error;
  if (categories.error) throw categories.error;
  return { items: workflowBookingSchema.array().parse(result.data), categories: serviceCategorySchema.array().parse(categories.data) };
}
