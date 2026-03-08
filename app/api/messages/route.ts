import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { failure, success } from "@/lib/api/response";
import { validateRequiredText } from "@/lib/validation";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";
const messageColumns = "id,palette_id,channel_id,user_id,content,parent_message_id,edited_at,deleted_at,metadata,created_at";

type MessageTarget = {
  id: string;
  palette_id: string;
  user_id: string;
  content: string;
  deleted_at: string | null;
  metadata: Record<string, unknown> | null;
};

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? 40);
  if (!Number.isFinite(parsed)) {
    return 40;
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function parseMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input as Record<string, unknown>;
}

async function loadMessageTarget(request: NextRequest, messageId: string) {
  const supabase = createSupabaseRouteClient(request);
  const { data, error } = await supabase
    .from("messages")
    .select("id,palette_id,user_id,content,deleted_at,metadata")
    .eq("id", messageId)
    .single();

  if (error || !data) {
    return { supabase, target: null as MessageTarget | null, error: error?.message ?? "Message not found." };
  }

  return { supabase, target: data as MessageTarget, error: null as string | null };
}

async function resolveActorPermission(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  target: MessageTarget,
  actorId: string,
) {
  const { data: palette } = await supabase.from("palettes").select("owner_id").eq("id", target.palette_id).single();
  const { data: actorMember } = await supabase
    .from("palette_members")
    .select("role")
    .eq("palette_id", target.palette_id)
    .eq("user_id", actorId)
    .maybeSingle();

  const isOwner = palette?.owner_id === actorId;
  const isModerator = actorMember?.role === "moderator";
  const isAuthor = target.user_id === actorId;

  return {
    isAuthor,
    canModerate: isOwner || isModerator,
    canHide: isOwner || isModerator || isAuthor,
  };
}

async function hideMessage(
  request: NextRequest,
  messageId: string,
  actorId: string,
  reason: string | null,
) {
  const loaded = await loadMessageTarget(request, messageId);
  if (!loaded.target) {
    return NextResponse.json(failure("MESSAGE_NOT_FOUND", loaded.error ?? "Message not found."), { status: 404 });
  }

  const permission = await resolveActorPermission(loaded.supabase, loaded.target, actorId);
  if (!permission.canHide) {
    return NextResponse.json(failure("FORBIDDEN", "Only author, owner, or moderator can hide this message."), {
      status: 403,
    });
  }

  if (loaded.target.deleted_at) {
    return NextResponse.json(success({ hidden: true }));
  }

  const now = new Date().toISOString();
  const currentMetadata = parseMetadata(loaded.target.metadata);
  const currentModeration = parseMetadata(currentMetadata.moderation);
  const originalContent =
    typeof currentModeration.original_content === "string"
      ? currentModeration.original_content
      : loaded.target.content;

  const metadata = {
    ...currentMetadata,
    moderation: {
      ...currentModeration,
      original_content: originalContent,
      last_action: "hide",
      last_reason: reason,
      last_actor_id: actorId,
      last_at: now,
    },
  };

  const hiddenContent = permission.canModerate && !permission.isAuthor ? "[hidden by moderator]" : "[deleted]";

  const { error: updateError } = await loaded.supabase
    .from("messages")
    .update({ deleted_at: now, content: hiddenContent, metadata })
    .eq("id", loaded.target.id);

  if (updateError) {
    return NextResponse.json(failure("MESSAGE_HIDE_FAILED", updateError.message), { status: 400 });
  }

  await loaded.supabase.from("message_moderation_logs").insert({
    palette_id: loaded.target.palette_id,
    message_id: loaded.target.id,
    actor_id: actorId,
    action: "hide",
    reason,
  });

  return NextResponse.json(success({ hidden: true }));
}

async function restoreMessage(
  request: NextRequest,
  messageId: string,
  actorId: string,
  reason: string | null,
) {
  const loaded = await loadMessageTarget(request, messageId);
  if (!loaded.target) {
    return NextResponse.json(failure("MESSAGE_NOT_FOUND", loaded.error ?? "Message not found."), { status: 404 });
  }

  const permission = await resolveActorPermission(loaded.supabase, loaded.target, actorId);
  if (!permission.canModerate) {
    return NextResponse.json(failure("FORBIDDEN", "Only owner or moderator can restore this message."), {
      status: 403,
    });
  }

  if (!loaded.target.deleted_at) {
    return NextResponse.json(success({ restored: true }));
  }

  const currentMetadata = parseMetadata(loaded.target.metadata);
  const currentModeration = parseMetadata(currentMetadata.moderation);
  const originalContent =
    typeof currentModeration.original_content === "string" ? currentModeration.original_content : null;

  if (!originalContent) {
    return NextResponse.json(
      failure("MESSAGE_RESTORE_FAILED", "Original content is unavailable for this message."),
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const metadata = {
    ...currentMetadata,
    moderation: {
      ...currentModeration,
      last_action: "restore",
      last_reason: reason,
      last_actor_id: actorId,
      last_at: now,
    },
  };

  const { error: updateError } = await loaded.supabase
    .from("messages")
    .update({ deleted_at: null, content: originalContent, metadata })
    .eq("id", loaded.target.id);

  if (updateError) {
    return NextResponse.json(failure("MESSAGE_RESTORE_FAILED", updateError.message), { status: 400 });
  }

  await loaded.supabase.from("message_moderation_logs").insert({
    palette_id: loaded.target.palette_id,
    message_id: loaded.target.id,
    actor_id: actorId,
    action: "restore",
    reason,
  });

  return NextResponse.json(success({ restored: true }));
}

export async function GET(request: NextRequest) {
  const paletteId = request.nextUrl.searchParams.get("paletteId");
  const channelId = request.nextUrl.searchParams.get("channelId");
  const cursor = request.nextUrl.searchParams.get("cursor");
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  if (!paletteId) {
    return NextResponse.json(failure("INVALID_INPUT", "paletteId is required."), { status: 400 });
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    let query = supabase
      .from("messages")
      .select(messageColumns)
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (channelId) {
      query = query.eq("channel_id", channelId);
    }

    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(failure("MESSAGES_FETCH_FAILED", error.message), { status: 400 });
    }

    const rows = data ?? [];
    const ordered = [...rows].reverse();
    const userIds = [...new Set(ordered.map((message) => message.user_id))];

    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select(profileColumns).in("id", userIds)
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

    const messages = ordered.map((message) => ({
      ...message,
      profile: profileMap.get(message.user_id) ?? null,
    }));

    const nextCursor = messages.length > 0 ? messages[0].created_at : null;
    const hasMore = rows.length === limit;

    return NextResponse.json(success({ messages, reactions: reactions ?? [], nextCursor, hasMore }));
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
    const body = (await request.json()) as {
      paletteId?: string;
      channelId?: string | null;
      content?: string;
      replyToId?: string | null;
    };
    const paletteId = body.paletteId ?? "";
    const channelId = body.channelId ?? null;
    const content = body.content ?? "";
    const replyToId = body.replyToId ?? null;

    if (!validateRequiredText(paletteId, 1, 120) || !validateRequiredText(content, 1, 4000)) {
      return NextResponse.json(failure("INVALID_INPUT", "paletteId and message content are required."), { status: 400 });
    }

    const { data: palette } = await auth.supabase.from("palettes").select("owner_id").eq("id", paletteId).single();

    if (!palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (channelId) {
      const { data: channel } = await auth.supabase
        .from("palette_channels")
        .select("id")
        .eq("id", channelId)
        .eq("palette_id", paletteId)
        .maybeSingle();

      if (!channel) {
        return NextResponse.json(failure("INVALID_INPUT", "channelId is invalid."), { status: 400 });
      }
    }

    if (replyToId) {
      const { data: parent } = await auth.supabase
        .from("messages")
        .select("id")
        .eq("id", replyToId)
        .eq("palette_id", paletteId)
        .maybeSingle();

      if (!parent) {
        return NextResponse.json(failure("INVALID_INPUT", "replyToId is invalid."), { status: 400 });
      }
    }

    const role = palette.owner_id === auth.user.id ? "owner" : "member";

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
        channel_id: channelId,
        user_id: auth.user.id,
        content: content.trim(),
        parent_message_id: replyToId,
        metadata: {},
      })
      .select(messageColumns)
      .single();

    if (error || !data) {
      return NextResponse.json(failure("MESSAGE_CREATE_FAILED", error?.message ?? "Insert failed."), { status: 400 });
    }

    const { data: profile } = await auth.supabase
      .from("profiles")
      .select(profileColumns)
      .eq("id", auth.user.id)
      .maybeSingle();

    return NextResponse.json(success({ message: { ...data, profile: profile ?? null } }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MESSAGE_CREATE_FAILED", message), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      messageId?: string;
      action?: "hide" | "restore" | "edit";
      reason?: string | null;
      content?: string;
    };

    const messageId = body.messageId ?? "";
    const action = body.action ?? "hide";
    const reasonRaw = body.reason ?? null;
    const reason = reasonRaw && reasonRaw.trim() ? reasonRaw.trim().slice(0, 280) : null;

    if (!validateRequiredText(messageId, 1, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "messageId is required."), { status: 400 });
    }

    if (action !== "hide" && action !== "restore" && action !== "edit") {
      return NextResponse.json(failure("INVALID_INPUT", "action must be hide, restore, or edit."), {
        status: 400,
      });
    }

    if (action === "edit") {
      const content = typeof body.content === "string" ? body.content : "";
      if (!validateRequiredText(content, 1, 4000)) {
        return NextResponse.json(
          failure("INVALID_INPUT", "Edited content must be between 1 and 4000 characters."),
          { status: 400 },
        );
      }

      const loaded = await loadMessageTarget(request, messageId);
      if (!loaded.target) {
        return NextResponse.json(
          failure("MESSAGE_NOT_FOUND", loaded.error ?? "Message not found."),
          { status: 404 },
        );
      }

      const permission = await resolveActorPermission(loaded.supabase, loaded.target, auth.user.id);
      if (!permission.isAuthor) {
        return NextResponse.json(
          failure("FORBIDDEN", "Only the author can edit this message."),
          { status: 403 },
        );
      }

      const now = new Date().toISOString();
      const currentMetadata = parseMetadata(loaded.target.metadata);
      const currentModeration = parseMetadata(currentMetadata.moderation);
      const metadata = {
        ...currentMetadata,
        moderation: {
          ...currentModeration,
          last_action: "edit",
          last_actor_id: auth.user.id,
          last_at: now,
        },
      };

      const trimmed = content.trim();
      const { error: updateError } = await loaded.supabase
        .from("messages")
        .update({ content: trimmed, edited_at: now, metadata })
        .eq("id", loaded.target.id);

      if (updateError) {
        return NextResponse.json(failure("MESSAGE_EDIT_FAILED", updateError.message), { status: 400 });
      }

      return NextResponse.json(success({ edited: true }));
    }

    if (action === "hide") {
      return hideMessage(request, messageId, auth.user.id, reason);
    }

    return restoreMessage(request, messageId, auth.user.id, reason);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("MESSAGE_MODERATION_FAILED", message), { status: 500 });
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

  return hideMessage(request, messageId, auth.user.id, null);
}
