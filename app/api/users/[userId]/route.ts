import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseRouteClient } from "@/lib/supabase/route-client";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findProfile(supabase: ReturnType<typeof createSupabaseRouteClient>, userKey: string) {
  const byPublicId = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("public_id", userKey)
    .maybeSingle();

  if (byPublicId.data) {
    return byPublicId.data;
  }

  const byId = await supabase
    .from("profiles")
    .select(profileColumns)
    .eq("id", userKey)
    .maybeSingle();

  return byId.data ?? null;
}

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const supabase = createSupabaseRouteClient(request);
    const profile = await findProfile(supabase, params.userId);

    const targetUserId = profile?.id ?? (uuidPattern.test(params.userId) ? params.userId : null);

    const [paletteCount, messageCount] = targetUserId
      ? await Promise.all([
          supabase.from("palettes").select("id", { count: "exact", head: true }).eq("owner_id", targetUserId),
          supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
        ]).then((results) => [results[0].count ?? 0, results[1].count ?? 0])
      : [0, 0];

    return NextResponse.json(
      success({
        profile: profile ?? {
          id: targetUserId ?? params.userId,
          public_id: null,
          display_name: null,
          avatar_url: null,
          bio: null,
          notifications: "all",
          visibility: "public",
          created_at: null,
          updated_at: null,
        },
        paletteCount,
        messageCount,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("USER_FETCH_FAILED", message), { status: 500 });
  }
}
