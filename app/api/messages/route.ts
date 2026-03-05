import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { failure, success } from "@/lib/api/response";
import { validateRequiredText } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const paletteId = request.nextUrl.searchParams.get("paletteId");
  if (!paletteId) {
    return NextResponse.json(failure("INVALID_INPUT", "paletteId is required."), { status: 400 });
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    const { data, error } = await supabase
      .from("messages")
      .select("id,palette_id,user_id,content,reply_to_id,created_at")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(failure("MESSAGES_FETCH_FAILED", error.message), { status: 400 });
    }

    const userIds = [...new Set((data ?? []).map((message) => message.user_id))];

    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
          .in("id", userIds)
      : { data: [] as any[] };

    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    const { data: reactions, error: reactionsError } = await supabase
      .from("message_reactions")
      .select("message_id,user_id,emoji,created_at")
      .eq("palette_id", paletteId)
      .eq("emoji", "❤️");

    if (reactionsError) {
      return NextResponse.json(failure("REACTIONS_FETCH_FAILED", reactionsError.message), { status: 400 });
    }

    const messages = (data ?? []).map((message) => ({
      ...message,
      profile: profileMap.get(message.user_id) ?? null,
    }));

    return NextResponse.json(success({ messages, reactions: reactions ?? [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MESSAGES_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as { paletteId?: string; content?: string; replyToId?: string | null };
    const paletteId = body.paletteId ?? "";
    const content = body.content ?? "";
    const replyToId = body.replyToId ?? null;

    if (!validateRequiredText(paletteId, 1, 120) || !validateRequiredText(content, 1, 4000)) {
      return NextResponse.json(
        failure("INVALID_INPUT", "paletteId and message content are required."),
        { status: 400 },
      );
    }

    const { data: palette } = await auth.supabase
      .from("palettes")
      .select("owner_id")
      .eq("id", paletteId)
      .single();

    const role = palette?.owner_id === auth.user.id ? "owner" : "member";

    await auth.supabase.from("palette_members").upsert(
      {
        palette_id: paletteId,
        user_id: auth.user.id,
        role,
      },
      { onConflict: "palette_id,user_id" },
    );

    const { data, error } = await auth.supabase
      .from("messages")
      .insert({
        palette_id: paletteId,
        user_id: auth.user.id,
        content: content.trim(),
        reply_to_id: replyToId,
      })
      .select("id,palette_id,user_id,content,reply_to_id,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("MESSAGE_CREATE_FAILED", error?.message ?? "Insert failed."), { status: 400 });
    }

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
      .eq("id", auth.user.id)
      .maybeSingle();

    return NextResponse.json(success({ message: { ...data, profile: profile ?? null } }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MESSAGE_CREATE_FAILED", message), { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  const messageId = request.nextUrl.searchParams.get("messageId");
  if (!messageId) {
    return NextResponse.json(failure("INVALID_INPUT", "messageId is required."), { status: 400 });
  }

  try {
    const { data: target, error: targetError } = await auth.supabase
      .from("messages")
      .select("id,palette_id,user_id")
      .eq("id", messageId)
      .single();

    if (targetError || !target) {
      return NextResponse.json(failure("MESSAGE_NOT_FOUND", targetError?.message ?? "Message not found."), { status: 404 });
    }

    const { data: palette } = await auth.supabase
      .from("palettes")
      .select("owner_id")
      .eq("id", target.palette_id)
      .single();

    const canDelete = target.user_id === auth.user.id || palette?.owner_id === auth.user.id;
    if (!canDelete) {
      return NextResponse.json(failure("FORBIDDEN", "Only author or owner can delete this message."), { status: 403 });
    }

    const { error } = await auth.supabase.from("messages").delete().eq("id", messageId);
    if (error) {
      return NextResponse.json(failure("MESSAGE_DELETE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MESSAGE_DELETE_FAILED", message), { status: 500 });
  }
}
