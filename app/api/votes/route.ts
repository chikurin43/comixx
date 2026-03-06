import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const paletteId = request.nextUrl.searchParams.get("paletteId");
  const pollId = request.nextUrl.searchParams.get("pollId");
  const topic = request.nextUrl.searchParams.get("topic") ?? "story_direction";

  if (!paletteId) {
    return NextResponse.json(failure("INVALID_INPUT", "paletteId is required."), { status: 400 });
  }

  try {
    const supabase = createSupabaseRouteClient(request);
    let query = supabase
      .from("votes")
      .select("id,palette_id,poll_id,user_id,topic,option_key,created_at")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: true });

    if (pollId) {
      query = query.eq("poll_id", pollId);
    } else {
      query = query.eq("topic", topic);
    }

    const { data, error } = await query;

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
    const body = (await request.json()) as { paletteId?: string; pollId?: string | null; topic?: string; optionKey?: string };
    const paletteId = body.paletteId ?? "";
    const pollId = body.pollId ?? null;
    const topic = body.topic ?? "story_direction";
    const optionKey = body.optionKey ?? "";

    if (!validateRequiredText(paletteId, 1, 120) || !validateRequiredText(optionKey, 1, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "paletteId and optionKey are required."), { status: 400 });
    }

    if (pollId) {
      const { data: poll, error: pollError } = await auth.supabase
        .from("palette_polls")
        .select("id,palette_id,active")
        .eq("id", pollId)
        .eq("palette_id", paletteId)
        .maybeSingle();

      if (pollError || !poll) {
        return NextResponse.json(failure("INVALID_INPUT", pollError?.message ?? "Poll not found."), { status: 404 });
      }

      if (!poll.active) {
        return NextResponse.json(failure("FORBIDDEN", "This poll is closed."), { status: 400 });
      }

      const { data: optionExists } = await auth.supabase
        .from("palette_poll_options")
        .select("id")
        .eq("poll_id", pollId)
        .eq("label", optionKey.trim())
        .maybeSingle();

      if (!optionExists) {
        return NextResponse.json(failure("INVALID_INPUT", "Invalid option for this poll."), { status: 400 });
      }

      const voteTopic = `poll:${pollId}`;

      const { data, error } = await auth.supabase
        .from("votes")
        .upsert(
          {
            palette_id: paletteId,
            poll_id: pollId,
            user_id: auth.user.id,
            topic: voteTopic,
            option_key: optionKey.trim(),
          },
          { onConflict: "palette_id,user_id,topic" },
        )
        .select("id,palette_id,poll_id,user_id,topic,option_key,created_at")
        .single();

      if (error || !data) {
        return NextResponse.json(failure("VOTE_SUBMIT_FAILED", error?.message ?? "Upsert failed."), { status: 400 });
      }

      return NextResponse.json(success({ vote: data }), { status: 201 });
    }

    if (!validateRequiredText(topic, 1, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "topic is required."), { status: 400 });
    }

    const { data, error } = await auth.supabase
      .from("votes")
      .upsert(
        {
          palette_id: paletteId,
          poll_id: null,
          user_id: auth.user.id,
          topic: topic.trim(),
          option_key: optionKey.trim(),
        },
        { onConflict: "palette_id,user_id,topic" },
      )
      .select("id,palette_id,poll_id,user_id,topic,option_key,created_at")
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
