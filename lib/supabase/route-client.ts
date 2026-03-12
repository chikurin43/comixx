import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { readPublicSupabaseEnv } from "@/lib/supabase";

function readBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return auth.slice(7).trim();
}

export function createSupabaseRouteClient(request: NextRequest) {
  const env = readPublicSupabaseEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  const token = readBearerToken(request);

  return createClient(env.url, env.anonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export function createSupabaseAdminClient() {
  const env = readPublicSupabaseEnv();
  if (!env.ok) {
    throw new Error(env.message);
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }

  return createClient(env.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthUser(request: NextRequest) {
  const supabase = createSupabaseRouteClient(request);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ok: false as const, message: "Authentication required." };
  }

  return { ok: true as const, user: data.user, supabase };
}
