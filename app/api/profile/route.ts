import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { validatePublicId, validateRequiredText } from "@/lib/validation";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

function readMaybePublicProfileId(request: NextRequest) {
  return request.nextUrl.searchParams.get("userId");
}

async function findProfileByIdOrPublicId(userId: string, request: NextRequest) {
  const supabase = createSupabaseRouteClient(request);

  const byPublicId = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("public_id", userId)
    .maybeSingle();

  if (byPublicId.data) {
    return byPublicId;
  }

  return supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", userId)
    .maybeSingle();
}

export async function GET(request: NextRequest) {
  try {
    const requestedUserId = readMaybePublicProfileId(request);

    if (requestedUserId) {
      const { data, error } = await findProfileByIdOrPublicId(requestedUserId, request);
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
      .select(profileColumns)
      .eq("id", auth.user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(failure("PROFILE_FETCH_FAILED", error.message), { status: 400 });
    }

    const profile =
      data ??
      ({
        id: auth.user.id,
        public_id: auth.user.user_metadata?.public_id ?? null,
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
      publicId?: string;
      displayName?: string;
      avatarUrl?: string;
      bio?: string;
      notifications?: "all" | "vote-only" | "none";
      visibility?: "public" | "private";
    };

    const publicId = body.publicId?.trim() ?? "";
    const displayName = body.displayName ?? "";
    const avatarUrl = body.avatarUrl ?? "";
    const bio = body.bio ?? "";
    const notifications = body.notifications ?? "all";
    const visibility = body.visibility ?? "public";

    if (!validateRequiredText(displayName, 2, 40)) {
      return NextResponse.json(failure("INVALID_INPUT", "displayName must be 2-40 chars."), { status: 400 });
    }

    if (!validatePublicId(publicId)) {
      return NextResponse.json(
        failure("INVALID_INPUT", "publicId must be 3-24 chars and use only letters, numbers, underscore."),
        { status: 400 },
      );
    }

    const { data: conflict } = await auth.supabase
      .from("profiles")
      .select("id")
      .eq("public_id", publicId)
      .neq("id", auth.user.id)
      .maybeSingle();

    if (conflict?.id) {
      return NextResponse.json(failure("PUBLIC_ID_TAKEN", "このユーザーIDはすでに使用されています。"), { status: 409 });
    }

    const upsertPayload = {
      id: auth.user.id,
      public_id: publicId,
      display_name: displayName.trim(),
      avatar_url: avatarUrl.trim() || null,
      bio: bio.trim() || null,
      notifications,
      visibility,
    };

    const { data, error } = await auth.supabase
      .from("profiles")
      .upsert(upsertPayload, { onConflict: "id" })
      .select(profileColumns)
      .single();

    if (error || !data) {
      return NextResponse.json(failure("PROFILE_UPDATE_FAILED", error?.message ?? "Update failed."), { status: 400 });
    }

    await auth.supabase.auth.updateUser({
      data: {
        public_id: upsertPayload.public_id,
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
