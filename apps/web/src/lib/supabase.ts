"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSettings, type Database } from "@tirkha/shared";

export const isLocalMock = process.env.NEXT_PUBLIC_TIRKHA_LOCAL_MOCK === "1";
let client: SupabaseClient<Database> | undefined;
export function getSupabase() {
  if (client) return client;
  const env = supabaseSettings(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC"
  );
  client = createClient<Database>(env.url, env.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  return client;
}



