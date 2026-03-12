import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import type { MemberRole } from "@/lib/types";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

async function readOwnerId(supabase: ReturnType<typeof createSupabaseRouteClient>, paletteId: string) {
  const { data } = await supabase.from("palettes").select("owner_id").eq("id", paletteId).single();
  return data?.owner_id ?? null;
}

function isMemberRole(role: string): role is MemberRole {
  return role === "owner" || role === "moderator" || role === "member";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  try {
    const supabase = createSupabaseRouteClient(request);
    const ownerId = await readOwnerId(supabase, paletteId);

    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    const { data, error } = await supabase
      .from("palette_members")
      .select("palette_id,user_id,role,joined_at")
      .eq("palette_id", paletteId)
      .order("joined_at", { ascending: true });

    if (error) {
      return NextResponse.json(failure("MEMBERS_FETCH_FAILED", error.message), { status: 400 });
    }

    const userIds = [...new Set((data ?? []).map((member) => member.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select(profileColumns).in("id", userIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    const members = (data ?? []).map((member) => ({
      ...member,
      profile: profileMap.get(member.user_id) ?? null,
    }));

    return NextResponse.json(success({ members, ownerId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MEMBERS_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const ownerId = await readOwnerId(auth.supabase, paletteId);
    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    const role: MemberRole = ownerId === auth.user.id ? "owner" : "member";

    const { error } = await auth.supabase
      .from("palette_members")
      .upsert(
        {
          palette_id: paletteId,
          user_id: auth.user.id,
          role,
        },
        { onConflict: "palette_id,user_id" },
      );

    if (error) {
      return NextResponse.json(failure("MEMBER_JOIN_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ joined: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MEMBER_JOIN_FAILED", message), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const ownerId = await readOwnerId(auth.supabase, paletteId);
    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (ownerId !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only owner can update member role."), { status: 403 });
    }

    const body = (await request.json()) as { userId?: string; role?: string };
    const targetUserId = body.userId?.trim() ?? "";
    const role = body.role?.trim() ?? "";

    if (!targetUserId || !isMemberRole(role) || role === "owner") {
      return NextResponse.json(failure("INVALID_INPUT", "Valid userId and role are required."), { status: 400 });
    }

    if (targetUserId === ownerId) {
      return NextResponse.json(failure("FORBIDDEN", "Owner role cannot be changed."), { status: 400 });
    }

    const { error } = await auth.supabase
      .from("palette_members")
      .update({ role })
      .eq("palette_id", paletteId)
      .eq("user_id", targetUserId);

    if (error) {
      return NextResponse.json(failure("MEMBER_ROLE_UPDATE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ updated: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MEMBER_ROLE_UPDATE_FAILED", message), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  const targetUserId = request.nextUrl.searchParams.get("userId");
  if (!targetUserId) {
    return NextResponse.json(failure("INVALID_INPUT", "userId is required."), { status: 400 });
  }

  try {
    const ownerId = await readOwnerId(auth.supabase, paletteId);
    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (ownerId !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only owner can remove members."), { status: 403 });
    }

    if (targetUserId === ownerId) {
      return NextResponse.json(failure("FORBIDDEN", "Owner cannot be removed."), { status: 400 });
    }

    const { error } = await auth.supabase
      .from("palette_members")
      .delete()
      .eq("palette_id", paletteId)
      .eq("user_id", targetUserId);

    if (error) {
      return NextResponse.json(failure("MEMBER_REMOVE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ removed: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MEMBER_REMOVE_FAILED", message), { status: 500 });
  }
}

