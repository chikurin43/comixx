import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";
import { buildSlug, resolveUniqueSlug } from "@/lib/posts/util";

const defaultCategories = [
  { name: "日記", slug: "diary" },
  { name: "ラフ", slug: "rough" },
  { name: "下書き", slug: "draft" },
  { name: "線画", slug: "lineart" },
  { name: "完成版", slug: "final" },
];

async function ensureDefaultCategories(paletteId: string, request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return { ok: false as const, message: "Authentication required." };
  }

  const { data: palette } = await auth.supabase.from("palettes").select("owner_id").eq("id", paletteId).single();
  if (!palette) {
    return { ok: false as const, message: "Palette not found." };
  }

  if (palette.owner_id !== auth.user.id) {
    return { ok: true as const, inserted: false as const };
  }

  const { data: existing } = await auth.supabase
    .from("post_categories")
    .select("id,slug")
    .eq("palette_id", paletteId);

  const slugs = new Set((existing ?? []).map((row) => row.slug));
  if (slugs.size >= defaultCategories.length && slugs.has("final")) {
    return { ok: true as const, inserted: false as const };
  }

  const rows = defaultCategories.filter((cat) => !slugs.has(cat.slug)).map((cat) => ({
    palette_id: paletteId,
    name: cat.name,
    slug: cat.slug,
    created_by: auth.user.id,
  }));

  if (!rows.length) {
    return { ok: true as const, inserted: false as const };
  }

  await auth.supabase.from("post_categories").upsert(rows, { onConflict: "palette_id,slug" });
  return { ok: true as const, inserted: true as const };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const { data: dataBefore } = await auth.supabase
      .from("post_categories")
      .select("id,name,slug")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: true });

    const categories = dataBefore ?? [];
    if (!categories.length) {
      await ensureDefaultCategories(paletteId, request);
    }

    const { data, error } = await auth.supabase
      .from("post_categories")
      .select("id,name,slug")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json(failure("CATEGORIES_FETCH_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ categories: data ?? [] }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CATEGORIES_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const body = (await request.json()) as { name?: string };
    const name = (body.name ?? "").trim();

    if (!validateRequiredText(name, 1, 40)) {
      return NextResponse.json(failure("INVALID_INPUT", "name must be 1-40 chars."), { status: 400 });
    }

    const { data: palette } = await auth.supabase
      .from("palettes")
      .select("owner_id")
      .eq("id", paletteId)
      .single();

    if (!palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (palette.owner_id !== auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only palette owner can add categories."), { status: 403 });
    }

    const baseSlug = buildSlug(name);
    const { data: existing } = await auth.supabase
      .from("post_categories")
      .select("slug")
      .eq("palette_id", paletteId);

    const existingSlugs = new Set((existing ?? []).map((row) => row.slug));
    const slug = resolveUniqueSlug(baseSlug, existingSlugs);

    const { data, error } = await auth.supabase
      .from("post_categories")
      .insert({
        palette_id: paletteId,
        name,
        slug,
        created_by: auth.user.id,
      })
      .select("id,name,slug")
      .single();

    if (error || !data) {
      return NextResponse.json(failure("CATEGORY_CREATE_FAILED", error?.message ?? "Insert failed."), { status: 400 });
    }

    return NextResponse.json(success({ categories: [data] }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("CATEGORY_CREATE_FAILED", message), { status: 500 });
  }
}
