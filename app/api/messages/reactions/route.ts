import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { requireAuthUser } from "@/lib/supabase/route-client";

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as { paletteId?: string; messageId?: string; emoji?: string };
    const paletteId = body.paletteId ?? "";
    const messageId = body.messageId ?? "";
    const emoji = body.emoji ?? "❤️";

    if (!paletteId || !messageId) {
      return NextResponse.json(failure("INVALID_INPUT", "paletteId and messageId are required."), { status: 400 });
    }

    if (emoji !== "❤️") {
      return NextResponse.json(failure("INVALID_INPUT", "Only heart reaction is supported."), { status: 400 });
    }

    const existing = await auth.supabase
      .from("message_reactions")
      .select("id")
      .eq("palette_id", paletteId)
      .eq("message_id", messageId)
      .eq("user_id", auth.user.id)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing.data?.id) {
      const { error } = await auth.supabase.from("message_reactions").delete().eq("id", existing.data.id);
      if (error) {
        return NextResponse.json(failure("REACTION_TOGGLE_FAILED", error.message), { status: 400 });
      }
      return NextResponse.json(success({ reacted: false }));
    }

    const { error } = await auth.supabase.from("message_reactions").insert({
      palette_id: paletteId,
      message_id: messageId,
      user_id: auth.user.id,
      emoji,
    });

    if (error) {
      return NextResponse.json(failure("REACTION_TOGGLE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ reacted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("REACTION_TOGGLE_FAILED", message), { status: 500 });
  }
}
