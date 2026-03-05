import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv } from "@/lib/supabase";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient() {
  const env = readPublicSupabaseEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.url, env.anonKey);
  }

  return browserClient;
}
