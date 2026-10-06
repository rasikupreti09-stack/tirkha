import { z } from "zod";
import tokens from "./tokens.json";

export { tokens };
export const userRoleSchema = z.enum(["customer", "professional", "admin"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const publicSupabaseEnvSchema = z.object({
  url: z.url().refine((value) => new URL(value).protocol === "https:", {
    message: "Use your HTTPS Supabase project URL",
  }),
  anonKey: z.string().min(1, "Supabase anon key is required"),
});
export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;
