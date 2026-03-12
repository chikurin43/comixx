import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? 30);
  if (!Number.isFinite(parsed)) {
    return 30;
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const { data: actorMember } = await auth.supabase
      .from("palette_members")
      .select("role")
      .eq("palette_id", paletteId)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!actorMember || (actorMember.role !== "owner" && actorMember.role !== "moderator")) {
      return NextResponse.json(failure("FORBIDDEN", "Only owner or moderator can read moderation logs."), {
        status: 403,
      });
    }

    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const { data: logs, error } = await auth.supabase
      .from("message_moderation_logs")
      .select("id,palette_id,message_id,actor_id,action,reason,created_at")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(failure("MODERATION_LOGS_FETCH_FAILED", error.message), { status: 400 });
    }

    const actorIds = [...new Set((logs ?? []).map((log) => log.actor_id))];
    const messageIds = [...new Set((logs ?? []).map((log) => log.message_id))];

    const { data: actorProfiles } = actorIds.length
      ? await auth.supabase.from("profiles").select(profileColumns).in("id", actorIds)
      : { data: [] as any[] };

    const { data: relatedMessages } = messageIds.length
      ? await auth.supabase
          .from("messages")
          .select("id,content,user_id,created_at")
          .in("id", messageIds)
      : { data: [] as any[] };

    const profileMap = new Map((actorProfiles ?? []).map((profile) => [profile.id, profile]));
    const messageMap = new Map((relatedMessages ?? []).map((message) => [message.id, message]));

    const normalized = (logs ?? []).map((log) => ({
      ...log,
      actor_profile: profileMap.get(log.actor_id) ?? null,
      message: messageMap.get(log.message_id) ?? null,
    }));

    return NextResponse.json(success({ logs: normalized }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MODERATION_LOGS_FETCH_FAILED", message), { status: 500 });
  }
}

