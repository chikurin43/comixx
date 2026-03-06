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

function buildSlug(source: string) {
  const normalized = source
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 40);

  return normalized || "channel";
}

async function resolveUniqueSlug(
  supabase: ReturnType<typeof createSupabaseRouteClient>,
  paletteId: string,
  desired: string,
  exceptChannelId?: string,
) {
  const base = buildSlug(desired);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    let query = supabase.from("palette_channels").select("id").eq("palette_id", paletteId).eq("slug", candidate);

    if (exceptChannelId) {
      query = query.neq("id", exceptChannelId);
    }

    const { data } = await query.maybeSingle();
    if (!data) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function GET(request: NextRequest, { params }: { params: { paletteId: string } }) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const { data, error } = await supabase
      .from("palette_channels")
      .select("id,palette_id,name,slug,description,created_by,created_at")
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

    const slug = await resolveUniqueSlug(auth.supabase, params.paletteId, name);

    const { data, error } = await auth.supabase
      .from("palette_channels")
      .insert({
        palette_id: params.paletteId,
        name,
        slug,
        description: description || null,
        created_by: auth.user.id,
      })
      .select("id,palette_id,name,slug,description,created_by,created_at")
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

export async function PATCH(request: NextRequest, { params }: { params: { paletteId: string } }) {
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
      return NextResponse.json(failure("FORBIDDEN", "Only owner can update channels."), { status: 403 });
    }

    const body = (await request.json()) as { channelId?: string; name?: string; description?: string };
    const channelId = body.channelId?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const description = body.description?.trim() ?? "";

    if (!validateRequiredText(channelId, 1, 120) || !validateRequiredText(name, 1, 40) || /[\r\n\t]/.test(name)) {
      return NextResponse.json(failure("INVALID_INPUT", "channelId and valid name are required."), { status: 400 });
    }

    const slug = await resolveUniqueSlug(auth.supabase, params.paletteId, name, channelId);

    const { data, error } = await auth.supabase
      .from("palette_channels")
      .update({ name, slug, description: description || null })
      .eq("id", channelId)
      .eq("palette_id", params.paletteId)
      .select("id,palette_id,name,slug,description,created_by,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("CHANNEL_UPDATE_FAILED", error?.message ?? "Update failed."), { status: 400 });
    }

    return NextResponse.json(success({ channel: data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CHANNEL_UPDATE_FAILED", message), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { paletteId: string } }) {
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
      return NextResponse.json(failure("FORBIDDEN", "Only owner can delete channels."), { status: 403 });
    }

    const channelId = request.nextUrl.searchParams.get("channelId") ?? "";
    if (!validateRequiredText(channelId, 1, 120)) {
      return NextResponse.json(failure("INVALID_INPUT", "channelId is required."), { status: 400 });
    }

    const { count: existingCount } = await auth.supabase
      .from("palette_channels")
      .select("id", { count: "exact", head: true })
      .eq("palette_id", params.paletteId);

    const count = existingCount ?? 0;
    if (count <= 1) {
      return NextResponse.json(failure("FORBIDDEN", "At least one channel must remain."), { status: 400 });
    }

    const { error } = await auth.supabase
      .from("palette_channels")
      .delete()
      .eq("id", channelId)
      .eq("palette_id", params.paletteId);

    if (error) {
      return NextResponse.json(failure("CHANNEL_DELETE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CHANNEL_DELETE_FAILED", message), { status: 500 });
  }
}

