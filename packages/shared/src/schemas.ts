import { z } from "zod";
import { phoneSchema } from "./phone-auth.ts";

export const userRoleSchema = z.enum(["customer", "professional", "admin"]);
export const verificationStatusSchema = z.enum(["pending", "verified", "rejected"]);
export const bookingStatusSchema = z.enum([
  "requested", "accepted", "on_the_way", "in_progress", "completed", "cancelled",
]);

// Match PostgreSQL integer rather than an unconstrained JS number.
export const paisaSchema = z.number().int().min(0).max(2_147_483_647);
const timestampSchema = z.iso.datetime({ offset: true });
const nonBlankTextSchema = z.string().refine(
  (value) => value.replace(/^ +| +$/g, "").length > 0,
  "Must not be empty or contain only spaces",
);

export const legacyProfileSchema = z.object({
  id: z.uuid(),
  full_name: z.string().nullable(),
  phone_number: z.string().nullable(),
  avatar_url: z.string().nullable(),
  role: userRoleSchema,
  created_at: timestampSchema,
});

export const profileSchema = legacyProfileSchema.extend({ phone: phoneSchema, email: z.email().nullable().optional() });

export const professionalProfileSchema = z.object({
  profile_id: z.uuid(),
  bio: z.string().nullable(),
  verification_status: verificationStatusSchema,
  rating: z.number().min(0).max(5).multipleOf(0.01),
  hourly_rate_paisa: paisaSchema.nullable(),
});

export const serviceCategorySchema = z.object({
  id: z.uuid(),
  name: nonBlankTextSchema,
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().nullable(),
  icon_name: z.string().nullable(),
});

export const bookingSchema = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  professional_id: z.uuid().nullable(),
  category_id: z.uuid(),
  status: bookingStatusSchema,
  total_price_paisa: paisaSchema.nullable(),
  service_address: nonBlankTextSchema,
  scheduled_at: timestampSchema,
  created_at: timestampSchema,
}).superRefine((booking, ctx) => {
  if (booking.professional_id === booking.customer_id) {
    ctx.addIssue({ code: "custom", path: ["professional_id"], message: "Self-assignment is not allowed" });
  }
  if (!["requested", "cancelled"].includes(booking.status) && booking.professional_id === null) {
    ctx.addIssue({ code: "custom", path: ["professional_id"], message: "An active booking requires a professional" });
  }
});

// These are client write contracts, not complete database row schemas.
// Strict objects reject attempts to supply privileged columns.
export const profileUpdateSchema = profileSchema.pick({
  full_name: true, avatar_url: true,
}).partial().strict().refine((value) => Object.values(value).some((field) => field !== undefined), {
  message: "Provide at least one editable field",
});

/** @deprecated Initial migration contract. Use bookingRequestSchema and the booking RPC after migration 04. */
export const bookingCreateSchema = z.strictObject({
  customer_id: z.uuid(),
  category_id: z.uuid(),
  service_address: nonBlankTextSchema,
  scheduled_at: timestampSchema,
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type VerificationStatus = z.infer<typeof verificationStatusSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type BookingCreate = z.infer<typeof bookingCreateSchema>;

export const categorySlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
export const publicProfessionalSchema = z.object({
  profile_id: z.uuid(),
  full_name: z.string().nullable(),
  bio: z.string().nullable(),
  rating: z.number().min(0).max(5),
  hourly_rate_paisa: paisaSchema.nullable(),
});
export const coordinatesSchema = z.strictObject({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const mapPinSchema = coordinatesSchema.extend({
  resolved_address: z.string().trim().min(2).max(200).nullable(),
});
export type Coordinates = z.infer<typeof coordinatesSchema>;
export type MapPin = z.infer<typeof mapPinSchema>;
export const locationPreferenceSchema = z.strictObject({
  map_pin: mapPinSchema.optional(),
  municipality: z.string().trim().min(2, "Enter your municipality or area.").max(100),
  ward: z.string().trim().regex(/^(?:[1-9]|[1-9][0-9])?$/, "Ward must be a number from 1 to 99, or blank.").optional(),
  landmark: z.string().trim().min(2, "Enter a nearby landmark.").max(160),
});
export type PublicProfessional = z.infer<typeof publicProfessionalSchema>;
export type LocationPreference = z.infer<typeof locationPreferenceSchema>;

// Migration 04 extends the original row contract without changing legacy tests.
export const workflowBookingSchema = bookingSchema.safeExtend({
  payment_method: z.enum(["COD", "ESEWA", "KHALTI"]).nullable().optional(),
  checkout_status: z.enum(["unpaid", "pending", "confirmed", "paid", "refunded", "partially_refunded"]).optional(),
  latitude: coordinatesSchema.shape.latitude.nullable().optional(),
  longitude: coordinatesSchema.shape.longitude.nullable().optional(),
  resolved_address: mapPinSchema.shape.resolved_address.optional(),
  job_details: z.string().max(2000),
  duration_minutes: z.number().int().min(30).max(480).multipleOf(30),
  hourly_rate_paisa: paisaSchema.nullable(),
  client_request_id: z.uuid().nullable(),
  updated_at: timestampSchema,
  diagnostic_summary: z.string().max(1200).nullable().optional(),
  diagnostic_severity: z.string().max(120).nullable().optional(),
  diagnostic_urgency: z.enum(["routine", "soon", "urgent"]).nullable().optional(),
  suggested_parts: z.array(z.string().max(100)).max(12).optional(),
});
export const bookingRequestSchema = z.strictObject({
  latitude: coordinatesSchema.shape.latitude.nullable().optional(),
  longitude: coordinatesSchema.shape.longitude.nullable().optional(),
  resolved_address: mapPinSchema.shape.resolved_address.optional(),
  request_id: z.uuid(),
  category_id: z.uuid(),
  professional_id: z.uuid().nullable(),
  service_address: z.string().trim().min(5, "Enter your municipality and landmark.").max(500),
  job_details: z.string().trim().min(10, "Describe the job in at least 10 characters.").max(2000),
  scheduled_at: timestampSchema.refine((value) => Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + 365 * 86400000, "Choose a future appointment within the next year."),
  duration_minutes: z.number().int().min(30).max(480).multipleOf(30),
  diagnostic_summary: z.string().trim().max(1200).optional(),
  diagnostic_severity: z.string().trim().max(120).optional(),
  diagnostic_urgency: z.enum(["routine", "soon", "urgent"]).optional(),
  suggested_parts: z.array(z.string().trim().min(1).max(100)).max(12).optional(),
}).refine((value) => (value.latitude == null) === (value.longitude == null)
  && (value.resolved_address == null || value.latitude != null), "A map address requires a complete coordinate pair.");
export type WorkflowBooking = z.infer<typeof workflowBookingSchema>;
export type BookingRequest = z.infer<typeof bookingRequestSchema>;


