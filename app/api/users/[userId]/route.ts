import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = createSupabaseRouteClient(request);

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at")
      .eq("id", params.userId)
      .maybeSingle();

    const [{ count: paletteCount }, { count: messageCount }] = await Promise.all([
      supabase.from("palettes").select("id", { count: "exact", head: true }).eq("owner_id", params.userId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", params.userId),
    ]);

    return NextResponse.json(
      success({
        profile: profile ?? {
          id: params.userId,
          display_name: null,
          avatar_url: null,
          bio: null,
          notifications: "all",
          visibility: "public",
          created_at: null,
          updated_at: null,
        },
        paletteCount: paletteCount ?? 0,
        messageCount: messageCount ?? 0,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("USER_FETCH_FAILED", message), { status: 500 });
  }
}
