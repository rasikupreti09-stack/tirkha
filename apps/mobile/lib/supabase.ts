import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseEnvSchema } from "@tirkha/shared";

let client: ReturnType<typeof createClient> | undefined;
export function getSupabase() {
  if (client) return client;
  const env = publicSupabaseEnvSchema.parse({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
  client = createClient(env.url, env.anonKey, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}
