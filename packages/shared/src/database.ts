import type { CatalogService } from "./catalog";
import type { Profile, ProfessionalProfile, ServiceCategory, WorkflowBooking, PublicProfessional, UserRole, VerificationStatus, BookingStatus } from "./schemas";
import type { BookingPayment } from "./payments";
import type { ChatMessage, PushJob } from "./chat";

// Hand-maintained database contract for the checked-in migrations. Regenerate
// from Supabase after deployment as the schema grows; SQL remains authoritative.
type Table<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
export type Database = {
  public: {
    Tables: {
      service_offerings: Table<CatalogService, CatalogService, Partial<CatalogService>>;
      geocoding_cache: Table<{ key: string; area: string; expires_at: string }, { key: string; area: string; expires_at: string }, { area?: string; expires_at?: string }>;
      booking_messages: Table<ChatMessage, never, never>;
      push_devices: Table<{ token: string; user_id: string; installation_id: string; updated_at: string }, never, { updated_at?: string }>;
      push_outbox: Table<PushJob, never, Partial<PushJob>>;
      booking_payments: Table<BookingPayment, Partial<BookingPayment>, Partial<BookingPayment>>;
      profiles: Table<Profile, Pick<Profile, "id"> & Partial<Omit<Profile, "id">>, Partial<Profile>>;
      professional_profiles: Table<ProfessionalProfile, Pick<ProfessionalProfile, "profile_id"> & Partial<Omit<ProfessionalProfile, "profile_id">>, Partial<ProfessionalProfile>>;
      service_categories: Table<ServiceCategory, Pick<ServiceCategory, "name" | "slug"> & Partial<Omit<ServiceCategory, "name" | "slug">>, Partial<ServiceCategory>>;
      bookings: Table<WorkflowBooking, Pick<WorkflowBooking, "customer_id" | "category_id" | "service_address" | "scheduled_at"> & Partial<Omit<WorkflowBooking, "customer_id" | "category_id" | "service_address" | "scheduled_at">>, Partial<WorkflowBooking>>;
      professional_service_categories: Table<{ professional_id: string; category_id: string }, { professional_id: string; category_id: string }, { professional_id?: string; category_id?: string }>;
      professional_settlement_ledger: Table<{ id: string; booking_id: string; professional_id: string; gross_amount_paisa: number; commission_rate_basis_points: number; commission_paisa: number; entry_amount_paisa: number; entry_type: "cod_platform_commission"; created_at: string }, never, never>;
      professional_presence: Table<{ professional_id: string; latitude: number; longitude: number; heading: number | null; updated_at: string }, never, never>;
      hero_locations: Table<{ professional_id: string; latitude: number; longitude: number; heading: number | null; speed_mps: number | null; battery_level: number | null; active_booking_id: string | null; status: "online_idle" | "en_route" | "on_service"; updated_at: string }, never, never>;
      hero_dispatch_notifications: Table<{ id: string; booking_id: string; professional_id: string; status: "new" | "seen" | "accepted" | "expired"; service_name: string; diagnostic_summary: string | null; diagnostic_severity: string | null; diagnostic_urgency: "routine" | "soon" | "urgent" | null; suggested_parts: string[]; service_address: string; latitude: number | null; longitude: number | null; distance_meters: number | null; scheduled_at: string; created_at: string }, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_booking_contact: { Args: { p_booking_id: string }; Returns: { full_name: string | null; phone: string }[] };
      confirm_cod: { Args: { p_booking_id: string }; Returns: BookingPayment[] };
      reserve_gateway_payment: { Args: { p_booking_id: string; p_customer_id: string; p_attempt_id: string; p_environment: string; p_method: string }; Returns: BookingPayment[] };
      record_gateway_lookup: { Args: { p_attempt_id: string; p_pidx: string; p_amount: number; p_status: string; p_transaction_id: string | null; p_method: string }; Returns: BookingPayment[] };
      claim_geocoding: { Args: { p_lease_id: string }; Returns: boolean };
      release_geocoding: { Args: { p_lease_id: string }; Returns: undefined };
      send_booking_message: { Args: { p_booking_id: string; p_client_message_id: string; p_body: string; p_attachment_path?: string | null }; Returns: ChatMessage[] };
      register_push_device: { Args: { p_token: string; p_installation_id: string }; Returns: undefined };
      unregister_push_device: { Args: { p_installation_id: string }; Returns: undefined };
      claim_push_jobs: { Args: { p_lease_id: string }; Returns: PushJob[] };
      reserve_booking_payment: { Args: { p_booking_id: string; p_customer_id: string; p_attempt_id: string; p_environment: string }; Returns: BookingPayment[] };
      attach_khalti_checkout: { Args: { p_attempt_id: string; p_pidx: string; p_url: string; p_expires_at: string }; Returns: BookingPayment[] };
      record_khalti_lookup: { Args: { p_attempt_id: string; p_pidx: string; p_amount: number; p_status: string; p_transaction_id: string | null }; Returns: BookingPayment[] };
      create_booking_request: {
        Args: { p_request_id: string; p_category_id: string; p_professional_id: string | null; p_service_address: string; p_job_details: string; p_scheduled_at: string; p_duration_minutes: number; p_latitude?: number | null; p_longitude?: number | null; p_resolved_address?: string | null };
        Returns: WorkflowBooking[];
      };
      create_diagnostic_booking_request: { Args: { p_request_id: string; p_category_id: string; p_professional_id: string | null; p_service_address: string; p_job_details: string; p_scheduled_at: string; p_duration_minutes: number; p_latitude?: number | null; p_longitude?: number | null; p_resolved_address?: string | null; p_diagnostic_summary?: string | null; p_diagnostic_severity?: string | null; p_diagnostic_urgency?: "routine" | "soon" | "urgent" | null; p_suggested_parts?: string[] }; Returns: WorkflowBooking[] };
      transition_booking: { Args: { p_booking_id: string; p_action: string }; Returns: WorkflowBooking[] };
      update_professional_presence: { Args: { p_latitude: number; p_longitude: number; p_heading?: number | null }; Returns: undefined };
      update_hero_location: { Args: { p_latitude: number; p_longitude: number; p_heading?: number | null; p_speed_mps?: number | null; p_battery_level?: number | null; p_active_booking_id?: string | null }; Returns: undefined };
      list_verified_professionals: {
        Args: { p_category_slug: string; p_limit?: number; p_offset?: number };
        Returns: PublicProfessional[];
      };
    };
    Enums: { user_role: UserRole; verification_status: VerificationStatus; booking_status: BookingStatus };
    CompositeTypes: { [_ in never]: never };
  };
};


