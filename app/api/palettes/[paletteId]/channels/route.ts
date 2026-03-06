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

export async function GET(request: NextRequest, { params }: { params: { paletteId: string } }) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const { data, error } = await supabase
      .from("palette_channels")
      .select("id,palette_id,name,description,created_by,created_at")
      .eq("palette_id", params.paletteId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(failure("CHANNELS_FETCH_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ channels: data ?? [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CHANNELS_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { paletteId: string } }) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const ownerId = await readPaletteOwner(auth.supabase, params.paletteId);
    if (!ownerId) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (ownerId !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only owner can create channels."), { status: 403 });
    }

    const body = (await request.json()) as { name?: string; description?: string };
    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() ?? "";

    if (!validateRequiredText(name, 1, 40) || /[\r\n\t]/.test(name)) {
      return NextResponse.json(
        failure("INVALID_INPUT", "name must be 1-40 chars and must not include line breaks."),
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabase
      .from("palette_channels")
      .insert({
        palette_id: params.paletteId,
        name,
        description: description || null,
        created_by: auth.user.id,
      })
      .select("id,palette_id,name,description,created_by,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("CHANNEL_CREATE_FAILED", error?.message ?? "Insert failed."), { status: 400 });
    }

    return NextResponse.json(success({ channel: data }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CHANNEL_CREATE_FAILED", message), { status: 500 });
  }
}
