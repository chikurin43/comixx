import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient, requireAuthUser } from "@/lib/supabase/route-client";
import { failure, success } from "@/lib/api/response";
import { validateRequiredText } from "@/lib/validation";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const { data, error } = await supabase
      .from("palettes")
      .select("id,title,genre,description,owner_id,is_public,created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(failure("PALETTES_FETCH_FAILED", error.message), { status: 400 });
    }

    const ownerIds = [...new Set((data ?? []).map((palette) => palette.owner_id))];
    const { data: ownerProfiles } = ownerIds.length
      ? await supabase
          .from("profiles")
          .select(profileColumns)
          .in("id", ownerIds)
      : { data: [] as any[] };

    const profileMap = new Map((ownerProfiles ?? []).map((profile) => [profile.id, profile]));

    const palettes = (data ?? []).map((palette) => ({
      ...palette,
      owner_profile: profileMap.get(palette.owner_id) ?? null,
    }));

    return NextResponse.json(success({ palettes }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PALETTES_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as { title?: string; genre?: string; description?: string };
    const title = body.title ?? "";
    const genre = body.genre ?? "";
    const description = body.description ?? "";

    if (!validateRequiredText(title, 2, 120) || !validateRequiredText(genre, 1, 60)) {
      return NextResponse.json(
        failure("INVALID_INPUT", "Title must be 2-120 chars and genre must be 1-60 chars."),
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabase
      .from("palettes")
      .insert({
        title: title.trim(),
        genre: genre.trim(),
        description: description.trim() || null,
        owner_id: auth.user.id,
        is_public: true,
      })
      .select("id,title,genre,description,owner_id,is_public,created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("PALETTE_CREATE_FAILED", error?.message ?? "Insert failed."), { status: 400 });
    }

    await auth.supabase.from("palette_members").upsert(
      {
        palette_id: data.id,
        user_id: auth.user.id,
        role: "owner",
      },
      { onConflict: "palette_id,user_id" },
    );

    await auth.supabase.from("palette_channels").upsert(
      {
        palette_id: data.id,
        name: "general",
        description: "Default channel",
        created_by: auth.user.id,
      },
      { onConflict: "palette_id,name" },
    );

    return NextResponse.json(success({ palette: data }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("PALETTE_CREATE_FAILED", message), { status: 500 });
  }
}
