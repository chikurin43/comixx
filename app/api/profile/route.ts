import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";

function readMaybePublicProfileId(request: NextRequest) {
  return request.nextUrl.searchParams.get("userId");
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const requestedUserId = readMaybePublicProfileId(request);

    if (requestedUserId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
        .eq("id", requestedUserId)
        .single();

      if (error || !data) {
        return NextResponse.json(failure("PROFILE_NOT_FOUND", error?.message ?? "Profile not found."), { status: 404 });
      }

      return NextResponse.json(success({ profile: data }));
    }

    const auth = await requireAuthUser(request);
    if (!auth.ok) {
      return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
    }

    const { data, error } = await auth.supabase
      .from("profiles")
      .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(failure("PROFILE_FETCH_FAILED", error.message), { status: 400 });
    }

    const profile =
      data ??
      ({
        id: auth.user.id,
        display_name: auth.user.user_metadata?.display_name ?? null,
        avatar_url: auth.user.user_metadata?.avatar_url ?? null,
        bio: auth.user.user_metadata?.bio ?? null,
        notifications: auth.user.user_metadata?.notifications ?? "all",
        visibility: auth.user.user_metadata?.visibility ?? "public",
        created_at: null,
        updated_at: null,
      } as const);

    return NextResponse.json(success({ profile }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PROFILE_FETCH_FAILED", message), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      notifications?: "all" | "vote-only" | "none";
      visibility?: "public" | "private";
    };

    const displayName = body.displayName ?? "";
    const avatarUrl = body.avatarUrl ?? "";
    const bio = body.bio ?? "";
    const notifications = body.notifications ?? "all";
    const visibility = body.visibility ?? "public";

    if (!validateRequiredText(displayName, 2, 40)) {
      return NextResponse.json(failure("INVALID_INPUT", "displayName must be 2-40 chars."), { status: 400 });
    }

    const upsertPayload = {
      id: auth.user.id,
      display_name: displayName.trim(),
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim() || null,
      notifications,
      visibility,
    };

    const { data, error } = await auth.supabase
      .from("profiles")
      .upsert(upsertPayload, { onConflict: "id" })
      .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("PROFILE_UPDATE_FAILED", error?.message ?? "Update failed."), { status: 400 });
    }

    await auth.supabase.auth.updateUser({
      data: {
        display_name: upsertPayload.display_name,
        avatar_url: upsertPayload.avatar_url,
        bio: upsertPayload.bio,
        notifications,
        visibility,
      },
    });

    return NextResponse.json(success({ profile: data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PROFILE_UPDATE_FAILED", message), { status: 500 });
  }
}
