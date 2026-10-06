"use client";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnvSchema } from "@tirkha/shared";

let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  if (client) return client;
  const env = publicSupabaseEnvSchema.parse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  client = createClient(env.url, env.anonKey);
  return client;
}
