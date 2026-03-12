import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

export async function GET(request: NextRequest, { params }: { params: { paletteId: string } }) {
  try {
    const supabase = createSupabaseRouteClient(request);

    const { data: palette, error: paletteError } = await supabase
      .from("palettes")
      .select("id,title,genre,description,owner_id,is_public,created_at")
      .eq("id", params.paletteId)
      .single();

    if (paletteError || !palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", paletteError?.message ?? "Palette not found."), { status: 404 });
    }

    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select(profileColumns)
      .eq("id", palette.owner_id)
      .maybeSingle();

    return NextResponse.json(success({ palette: { ...palette, owner_profile: ownerProfile ?? null } }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PALETTE_FETCH_FAILED", message), { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { paletteId: string } }) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      genre?: string | null;
    };

    // 現在のパレット情報を取得してオーナー確認
    const { data: palette, error: paletteError } = await auth.supabase
      .from("palettes")
      .select("owner_id")
      .eq("id", params.paletteId)
      .single();

    if (paletteError || !palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (palette.owner_id !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only the owner can update the palette."), { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.genre !== undefined) updateData.genre = body.genre;

    const { data, error } = await auth.supabase
      .from("palettes")
      .update(updateData)
      .eq("id", params.paletteId)
      .select("id,title,genre,description,owner_id,is_public,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("PALETTE_UPDATE_FAILED", error?.message ?? "Update failed."), { status: 400 });
    }

    return NextResponse.json(success({ palette: data }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PALETTE_UPDATE_FAILED", message), { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { paletteId: string } }) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    // 現在のパレット情報を取得してオーナー確認
    const { data: palette, error: paletteError } = await auth.supabase
      .from("palettes")
      .select("owner_id")
      .eq("id", params.paletteId)
      .single();

    if (paletteError || !palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (palette.owner_id !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only the owner can delete the palette."), { status: 403 });
    }

    const { error } = await auth.supabase
      .from("palettes")
      .delete()
      .eq("id", params.paletteId);

    if (error) {
      return NextResponse.json(failure("PALETTE_DELETE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PALETTE_DELETE_FAILED", message), { status: 500 });
  }
}
