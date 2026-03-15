import type { ApiResponse } from "@/lib/api/response";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function asFailure(code: string, message: string): ApiResponse<unknown> {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.success === true) {
    return true;
  }

  if (record.success === false) {
    const error = record.error as Record<string, unknown> | undefined;
    return typeof error?.code === "string" && typeof error?.message === "string";
  }

  return false;
}

async function readApiBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();
  return text.length ? text : null;
}

export async function apiFetch<T extends ApiResponse<unknown> = ApiResponse<unknown>>(
  path: string,
  method: HttpMethod = "GET",
  body?: unknown,
): Promise<T> {
  try {
    const client = getBrowserSupabaseClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;

    const response = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const payload = await readApiBody(response);

    if (isApiResponse(payload)) {
      return payload as T;
    }

    if (!response.ok) {
      return asFailure("HTTP_ERROR", `Request failed: ${response.status}`) as T;
    }

    return asFailure("INVALID_RESPONSE", "Expected API response shape was not returned.") as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    return asFailure("NETWORK_ERROR", message) as T;
  }
}

export async function apiFetchForm<T extends ApiResponse<unknown> = ApiResponse<unknown>>(
  path: string,
  method: Exclude<HttpMethod, "GET">,
  form: FormData,
): Promise<T> {
  try {
    const client = getBrowserSupabaseClient();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;

    const response = await fetch(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
      cache: "no-store",
    });

    const payload = await readApiBody(response);

    if (isApiResponse(payload)) {
      return payload as T;
    }

    if (!response.ok) {
      return asFailure("HTTP_ERROR", `Request failed: ${response.status}`) as T;
    }

    return asFailure("INVALID_RESPONSE", "Expected API response shape was not returned.") as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed.";
    return asFailure("NETWORK_ERROR", message) as T;
  }
}

export function apiGet<T extends ApiResponse<unknown> = ApiResponse<unknown>>(path: string) {
  return apiFetch<T>(path, "GET");
}

export function apiPost<T extends ApiResponse<unknown> = ApiResponse<unknown>>(path: string, body?: unknown) {
  return apiFetch<T>(path, "POST", body);
}

export function apiPut<T extends ApiResponse<unknown> = ApiResponse<unknown>>(path: string, body?: unknown) {
  return apiFetch<T>(path, "PUT", body);
}

export function apiPatch<T extends ApiResponse<unknown> = ApiResponse<unknown>>(path: string, body?: unknown) {
  return apiFetch<T>(path, "PATCH", body);
}

export function apiDelete<T extends ApiResponse<unknown> = ApiResponse<unknown>>(path: string) {
  return apiFetch<T>(path, "DELETE");
}
