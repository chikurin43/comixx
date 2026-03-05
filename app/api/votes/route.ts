import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const paletteId = request.nextUrl.searchParams.get("paletteId");
  const topic = request.nextUrl.searchParams.get("topic") ?? "story_direction";

  if (!paletteId) {
    return NextResponse.json(failure("INVALID_INPUT", "paletteId is required."), { status: 400 });
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    const { data, error } = await supabase
      .from("votes")
      .select("id,palette_id,user_id,topic,option_key,created_at")
      .eq("palette_id", paletteId)
      .eq("topic", topic)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(failure("VOTES_FETCH_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ votes: data ?? [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("VOTES_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as { paletteId?: string; topic?: string; optionKey?: string };
    const paletteId = body.paletteId ?? "";
    const topic = body.topic ?? "story_direction";
    const optionKey = body.optionKey ?? "";

    if (!validateRequiredText(paletteId, 1, 120) || !validateRequiredText(topic, 1, 120) || !validateRequiredText(optionKey, 1, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "paletteId, topic, optionKey are required."), { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("votes")
      .upsert(
        {
          palette_id: paletteId,
          user_id: auth.user.id,
          topic: topic.trim(),
          option_key: optionKey.trim(),
        },
        { onConflict: "palette_id,user_id,topic" },
      )
      .select("id,palette_id,user_id,topic,option_key,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("VOTE_SUBMIT_FAILED", error?.message ?? "Upsert failed."), { status: 400 });
    }

    return NextResponse.json(success({ vote: data }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("VOTE_SUBMIT_FAILED", message), { status: 500 });
  }
}
