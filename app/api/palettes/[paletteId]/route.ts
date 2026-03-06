import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

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
