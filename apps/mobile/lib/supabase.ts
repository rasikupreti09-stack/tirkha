import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseSettings, type Database } from "@tirkha/shared";

export const isLocalMock = process.env.EXPO_PUBLIC_TIRKHA_LOCAL_MOCK === "1";
let client: SupabaseClient<Database> | undefined;
export function getSupabase() {
  if (client) return client;
  const env = supabaseSettings(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    "EXPO_PUBLIC"
  );
  client = createClient<Database>(env.url, env.anonKey, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "implicit", lock: processLock },
  });
  return client;
}



