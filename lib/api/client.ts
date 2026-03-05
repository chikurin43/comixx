import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function apiFetch<T>(path: string, method: HttpMethod, body?: unknown): Promise<T> {
  const client = getBrowserSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  return JSON.parse(text) as T;
}
