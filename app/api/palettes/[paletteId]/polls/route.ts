import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";

async function readPaletteOwner(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  paletteId: string,
) {
  const { data } = await supabase.from("palettes").select("owner_id").eq("id", paletteId).single();
  return data?.owner_id ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  try {
    const supabase = createSupabaseRouteClient(request);

    const { data: polls, error } = await supabase
      .from("palette_polls")
      .select("id,palette_id,title,description,created_by,active,created_at")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(failure("POLLS_FETCH_FAILED", error.message), { status: 400 });
    }

    const pollIds = (polls ?? []).map((poll) => poll.id);
    const { data: options, error: optionsError } = pollIds.length
      ? await supabase
          .from("palette_poll_options")
          .select("id,poll_id,label,sort_order")
          .in("poll_id", pollIds)
          .order("sort_order", { ascending: true })
      : { data: [] as any[], error: null as any };

    if (optionsError) {
      return NextResponse.json(failure("POLLS_FETCH_FAILED", optionsError.message), { status: 400 });
    }

    const optionMap = new Map<string, any[]>();
    (options ?? []).forEach((option) => {
      const list = optionMap.get(option.poll_id) ?? [];
      list.push(option);
      optionMap.set(option.poll_id, list);
    });

    const normalized = (polls ?? []).map((poll) => ({
      ...poll,
      options: optionMap.get(poll.id) ?? [],
    }));

    return NextResponse.json(success({ polls: normalized }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("POLLS_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;

  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const ownerId = await readPaletteOwner(auth.supabase, paletteId);
    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (ownerId !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only owner can create polls."), { status: 403 });
    }

    const body = (await request.json()) as { title?: string; description?: string; options?: string[] };
    const title = body.title?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const options = (body.options ?? []).map((option) => option.trim()).filter((option) => option.length > 0);

    if (!validateRequiredText(title, 2, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "title must be 2-120 chars."), { status: 400 });
    }

    if (options.length < 2 || options.length > 8) {
      return NextResponse.json(failure("INVALID_INPUT", "options must contain 2-8 items."), { status: 400 });
    }

    const deduped = new Set(options.map((option) => option.toLowerCase()));
    if (deduped.size !== options.length) {
      return NextResponse.json(failure("INVALID_INPUT", "options must be unique."), { status: 400 });
    }

    const { data: poll, error: pollError } = await auth.supabase
      .from("palette_polls")
      .insert({
        palette_id: paletteId,
        title,
        description: description || null,
        created_by: auth.user.id,
        active: true,
      })
      .select("id,palette_id,title,description,created_by,active,created_at")
      .single();

    if (pollError || !poll) {
      return NextResponse.json(failure("POLL_CREATE_FAILED", pollError?.message ?? "Insert failed."), { status: 400 });
    }

    const optionRows = options.map((label, index) => ({
      poll_id: poll.id,
      label,
      sort_order: index,
    }));

    const { data: insertedOptions, error: optionError } = await auth.supabase
      .from("palette_poll_options")
      .insert(optionRows)
      .select("id,poll_id,label,sort_order")
      .order("sort_order", { ascending: true });

    if (optionError) {
      return NextResponse.json(failure("POLL_CREATE_FAILED", optionError.message), { status: 400 });
    }

    return NextResponse.json(success({ poll: { ...poll, options: insertedOptions ?? [] } }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("POLL_CREATE_FAILED", message), { status: 500 });
  }
}

