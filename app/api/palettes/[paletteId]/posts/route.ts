import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { failure, success } from "@/lib/api/response";
import { requireAuthUser } from "@/lib/supabase/route-client";
import { validateRequiredText } from "@/lib/validation";
import { detectImageKind, buildR2Key, sha256Hex } from "@/lib/posts/util";
import { getR2Client } from "@/lib/r2/client";
import { readR2Env } from "@/lib/r2/env";

const profileColumns = "id,public_id,display_name,avatar_url,bio,notifications,visibility,created_at,updated_at";

function parseLimit(raw: string | null, fallback: number) {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

async function requirePaletteMember(paletteId: string, request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return { ok: false as const, response: NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 }) };
  }

  const { data: member } = await auth.supabase
    .from("palette_members")
    .select("role")
    .eq("palette_id", paletteId)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!member) {
    return { ok: false as const, response: NextResponse.json(failure("FORBIDDEN", "Palette membership required."), { status: 403 }) };
  }

  return { ok: true as const, auth, member };
}

async function ensureFinalCategoryId(paletteId: string, request: NextRequest) {
  const guard = await requirePaletteMember(paletteId, request);
  if (!guard.ok) {
    return { ok: false as const, response: guard.response };
  }

  const { data: palette } = await guard.auth.supabase.from("palettes").select("owner_id").eq("id", paletteId).single();
  if (!palette) {
    return { ok: false as const, response: NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 }) };
  }

  if (palette.owner_id !== guard.auth.user.id) {
    return { ok: false as const, response: NextResponse.json(failure("FORBIDDEN", "Only owner can bootstrap categories."), { status: 403 }) };
  }

  const { data: finalRow } = await guard.auth.supabase
    .from("post_categories")
    .select("id")
    .eq("palette_id", paletteId)
    .eq("slug", "final")
    .maybeSingle();

  if (finalRow?.id) {
    return { ok: true as const, id: finalRow.id };
  }

  const defaults = [
    { name: "日記", slug: "diary" },
    { name: "ラフ", slug: "rough" },
    { name: "下書き", slug: "draft" },
    { name: "線画", slug: "lineart" },
    { name: "完成版", slug: "final" },
  ];

  await guard.auth.supabase.from("post_categories").upsert(
    defaults.map((row) => ({
      palette_id: paletteId,
      name: row.name,
      slug: row.slug,
      created_by: guard.auth.user.id,
    })),
    { onConflict: "palette_id,slug" },
  );

  const { data } = await guard.auth.supabase
    .from("post_categories")
    .select("id")
    .eq("palette_id", paletteId)
    .eq("slug", "final")
    .maybeSingle();

  if (!data?.id) {
    return { ok: false as const, response: NextResponse.json(failure("CATEGORY_BOOTSTRAP_FAILED", "final category missing."), { status: 400 }) };
  }

  return { ok: true as const, id: data.id };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;
  const guard = await requirePaletteMember(paletteId, request);
  if (!guard.ok) {
    return guard.response;
  }

  try {
    const view = request.nextUrl.searchParams.get("view") === "gallery" ? "gallery" : "timeline";
    const order = request.nextUrl.searchParams.get("order") === "old" ? "old" : "new";
    const category = request.nextUrl.searchParams.get("category");
    const cursor = request.nextUrl.searchParams.get("cursor");
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"), view === "gallery" ? 60 : 20);

    if (view === "gallery") {
      const postsLimit = Math.max(10, Math.min(50, Math.ceil(limit / 2)));
      let postQuery = guard.auth.supabase
        .from("palette_posts")
        .select("id,palette_id,category_id,created_at")
        .eq("palette_id", paletteId)
        .order("created_at", { ascending: order === "old" })
        .limit(postsLimit);

      if (category) {
        postQuery = postQuery.eq("category_id", category);
      }

      if (cursor) {
        postQuery = order === "old" ? postQuery.gt("created_at", cursor) : postQuery.lt("created_at", cursor);
      }

      const { data: posts, error: postError } = await postQuery;
      if (postError) {
        return NextResponse.json(failure("POSTS_FETCH_FAILED", postError.message), { status: 400 });
      }

      const postIds = [...new Set((posts ?? []).map((p) => p.id))];
      const { data: images, error: imageError } = postIds.length
        ? await guard.auth.supabase
            .from("post_images")
            .select("id,post_id,sort_order,bytes,content_type,created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: order === "old" })
        : { data: [] as any[], error: null as any };

      if (imageError) {
        return NextResponse.json(failure("POSTS_FETCH_FAILED", imageError.message), { status: 400 });
      }

      const postMap = new Map((posts ?? []).map((p) => [p.id, p]));

      const categoryIds = [...new Set((posts ?? []).map((p) => p.category_id).filter(Boolean))] as string[];
      const { data: categories } = categoryIds.length
        ? await guard.auth.supabase.from("post_categories").select("id,name,slug").in("id", categoryIds)
        : { data: [] as any[] };

      const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));

      const payload = (images ?? [])
        .map((img) => {
          const post = postMap.get(img.post_id);
          if (!post) return null;
          return {
            image: {
              id: img.id,
              sort_order: img.sort_order,
              bytes: Number(img.bytes ?? 0),
              content_type: img.content_type,
            },
            post_id: post.id,
            palette_id: post.palette_id,
            created_at: post.created_at,
            category: post.category_id ? categoryMap.get(post.category_id) ?? null : null,
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      const nextCursor = (posts ?? []).length ? (posts ?? [])[(posts ?? []).length - 1].created_at : null;
      const hasMore = (posts ?? []).length === postsLimit;

      return NextResponse.json(success({ view: "gallery", images: payload, nextCursor, hasMore }));
    }

    let postQuery = guard.auth.supabase
      .from("palette_posts")
      .select("id,palette_id,author_id,title,body,category_id,is_final,created_at,updated_at")
      .eq("palette_id", paletteId)
      .order("created_at", { ascending: order === "old" })
      .limit(limit);

    if (category) {
      postQuery = postQuery.eq("category_id", category);
    }

    if (cursor) {
      postQuery = order === "old" ? postQuery.gt("created_at", cursor) : postQuery.lt("created_at", cursor);
    }

    const { data: posts, error } = await postQuery;
    if (error) {
      return NextResponse.json(failure("POSTS_FETCH_FAILED", error.message), { status: 400 });
    }

    const postIds = [...new Set((posts ?? []).map((p) => p.id))];
    const authorIds = [...new Set((posts ?? []).map((p) => p.author_id))];
    const categoryIds = [...new Set((posts ?? []).map((p) => p.category_id).filter(Boolean))] as string[];

    const { data: images } = postIds.length
      ? await guard.auth.supabase
          .from("post_images")
          .select("id,post_id,sort_order,bytes,content_type")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true })
      : { data: [] as any[] };

    const { data: categories } = categoryIds.length
      ? await guard.auth.supabase.from("post_categories").select("id,name,slug").in("id", categoryIds)
      : { data: [] as any[] };

    const { data: authorProfiles } = authorIds.length
      ? await guard.auth.supabase.from("profiles").select(profileColumns).in("id", authorIds)
      : { data: [] as any[] };

    const imageGroups = new Map<string, any[]>();
    (images ?? []).forEach((img) => {
      const group = imageGroups.get(img.post_id) ?? [];
      group.push({
        id: img.id,
        sort_order: img.sort_order,
        bytes: Number(img.bytes ?? 0),
        content_type: img.content_type,
      });
      imageGroups.set(img.post_id, group);
    });

    const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
    const authorMap = new Map((authorProfiles ?? []).map((p) => [p.id, p]));

    const timeline = (posts ?? []).map((p) => ({
      post: {
        ...p,
        title: p.title ?? null,
        body: p.body ?? null,
      },
      category: p.category_id ? categoryMap.get(p.category_id) ?? null : null,
      images: imageGroups.get(p.id) ?? [],
      author_profile: authorMap.get(p.author_id) ?? null,
    }));

    const nextCursor = (posts ?? []).length ? (posts ?? [])[(posts ?? []).length - 1].created_at : null;
    const hasMore = (posts ?? []).length === limit;

    return NextResponse.json(success({ view: "timeline", posts: timeline, nextCursor, hasMore }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("POSTS_FETCH_FAILED", message), { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ paletteId: string }> }) {
  const { paletteId } = await params;
  const guard = await requirePaletteMember(paletteId, request);
  if (!guard.ok) {
    return guard.response;
  }

  try {
    const { data: palette } = await guard.auth.supabase.from("palettes").select("owner_id").eq("id", paletteId).single();
    if (!palette) {
      return NextResponse.json(failure("PALETTE_NOT_FOUND", "Palette not found."), { status: 404 });
    }

    if (palette.owner_id !== guard.auth.user.id) {
      return NextResponse.json(failure("FORBIDDEN", "Only palette owner can create posts."), { status: 403 });
    }

    const form = await request.formData();
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const categoryIdRaw = String(form.get("categoryId") ?? "").trim();
    const isFinalRaw = String(form.get("isFinal") ?? "").trim().toLowerCase();
    const isFinal = isFinalRaw === "true" || isFinalRaw === "on" || isFinalRaw === "1";

    const files = form.getAll("images").filter((value): value is File => value instanceof File);
    const hasImages = files.length > 0 && files.some((f) => f.size > 0);

    const maxFiles = 10;
    const maxPerFile = 10 * 1024 * 1024;
    const maxTotal = 50 * 1024 * 1024;

    if (files.length > maxFiles) {
      return NextResponse.json(failure("INVALID_INPUT", `images must be <= ${maxFiles}.`), { status: 400 });
    }

    const totalBytes = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    if (totalBytes > maxTotal) {
      return NextResponse.json(failure("INVALID_INPUT", "Total upload size is too large."), { status: 400 });
    }

    if (files.some((f) => f.size > maxPerFile)) {
      return NextResponse.json(failure("INVALID_INPUT", "One of images is too large."), { status: 400 });
    }

    if (!hasImages) {
      if (!validateRequiredText(body, 1, 20_000)) {
        return NextResponse.json(failure("INVALID_INPUT", "body is required when no image is attached."), { status: 400 });
      }
    } else {
      if (body.length > 20_000 || title.length > 120) {
        return NextResponse.json(failure("INVALID_INPUT", "title/body too long."), { status: 400 });
      }
    }

    let categoryId: string | null = categoryIdRaw || null;

    if (isFinal) {
      const finalId = await ensureFinalCategoryId(paletteId, request);
      if (!finalId.ok) {
        return finalId.response;
      }
      categoryId = finalId.id;
    } else if (categoryId) {
      const { data: cat } = await guard.auth.supabase
        .from("post_categories")
        .select("id")
        .eq("palette_id", paletteId)
        .eq("id", categoryId)
        .maybeSingle();
      if (!cat) {
        categoryId = null;
      }
    }

    if (!categoryId) {
      const { data: cat } = await guard.auth.supabase
        .from("post_categories")
        .select("id")
        .eq("palette_id", paletteId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      categoryId = cat?.id ?? null;
    }

    const now = new Date().toISOString();
    const { data: created, error: createError } = await guard.auth.supabase
      .from("palette_posts")
      .insert({
        palette_id: paletteId,
        author_id: guard.auth.user.id,
        title: title.length ? title : null,
        body: body.length ? body : null,
        category_id: categoryId,
        is_final: isFinal,
        updated_at: now,
      })
      .select("id")
      .single();

    if (createError || !created?.id) {
      return NextResponse.json(failure("POST_CREATE_FAILED", createError?.message ?? "Insert failed."), { status: 400 });
    }

    const postId = created.id as string;

    if (!hasImages) {
      return NextResponse.json(success({ postId }), { status: 201 });
    }

    const r2Env = readR2Env();
    if (!r2Env.ok) {
      return NextResponse.json(failure("R2_NOT_CONFIGURED", r2Env.message), { status: 500 });
    }

    const { client, bucket } = getR2Client();
    const uploadedKeys: string[] = [];

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (!file || file.size === 0) continue;

        const kind = detectImageKind(file.type, file.name);
        if (!kind) {
          throw new Error("Unsupported image type.");
        }

        const buffer = new Uint8Array(await file.arrayBuffer());
        const hashHex = sha256Hex(buffer);
        const key = buildR2Key(paletteId, postId, i, hashHex, kind);

        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: file.type || `image/${kind}`,
          }),
        );

        uploadedKeys.push(key);

        const { error: imgError } = await guard.auth.supabase.from("post_images").insert({
          post_id: postId,
          sort_order: i,
          r2_key: key,
          content_type: file.type || `image/${kind}`,
          bytes: file.size,
        });

        if (imgError) {
          throw new Error(imgError.message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      const errorId = crypto.randomBytes(6).toString("hex");

      await Promise.allSettled(
        uploadedKeys.map((key) => client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))),
      );
      await guard.auth.supabase.from("palette_posts").delete().eq("id", postId);

      return NextResponse.json(failure("POST_UPLOAD_FAILED", `${message} (${errorId})`), { status: 400 });
    }

    return NextResponse.json(success({ postId }), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("POST_CREATE_FAILED", message), { status: 500 });
  }
}
