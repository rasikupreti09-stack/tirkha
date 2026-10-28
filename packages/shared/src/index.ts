import { z } from "zod";
import tokens from "./tokens.json";

export { tokens };
export * from "./schemas";
export * from "./auth";
export * from "./discovery";
export * from "./booking-workflow";
export * from "./booking-realtime";
export * from "./payments";
export * from "./chat";
export * from "./environment";
export * from "./geocoding";
export type { Database } from "./database";

export const publicSupabaseEnvSchema = z.object({
  url: z.url().refine((value) => new URL(value).protocol === "https:", {
    message: "Use your HTTPS Supabase project URL",
  }),
  anonKey: z.string().min(1, "Supabase anon key is required"),
});
export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

export * from "./phone-auth";


export * from "./catalog";
export * from "./pricing";

export * from "./home-diagnostics";
export * from "./universal-diagnostics";

export * from "./hero-portal";
