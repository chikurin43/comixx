import { createClient } from "@supabase/supabase-js";

export type ConnectionStatus = "idle" | "loading" | "success" | "error";

export function readPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const missing = [
      !url ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ].filter((entry): entry is string => entry !== null);

    return {
      ok: false as const,
      missing,
      message: `Supabase environment variables are missing: ${missing.join(", ")}`,
    };
  }

  return {
    ok: true as const,
    url,
    anonKey,
  };
}

let probeClient: ReturnType<typeof createClient> | null = null;

function getProbeClient() {
  const env = readPublicSupabaseEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  if (!probeClient) {
    probeClient = createClient(env.url, env.anonKey);
  }

  return probeClient;
}

export async function probeSupabaseConnection() {
  const env = readPublicSupabaseEnv();
  if (!env.ok) {
    return {
      status: "error" as const,
      message: `${env.message}. Configure them in .env.local and restart the dev server.`,
    };
  }

  const tableName = process.env.NEXT_PUBLIC_SUPABASE_PROBE_TABLE || "profiles";

  try {
    const client = getProbeClient();
    const { error } = await client.from(tableName).select("*", { head: true, count: "exact" });

    if (error) {
      return {
        status: "error" as const,
        message: `Supabase probe failed on table '${tableName}': ${error.message}`,
      };
    }

    return {
      status: "success" as const,
      message: `Supabase connection OK. Read probe succeeded on '${tableName}'.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected probe error.";
    return { status: "error" as const, message };
  }
}
