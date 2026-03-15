import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { failure } from "@/lib/api/response";
import { requireAuthUser } from "@/lib/supabase/route-client";
import { getR2Client } from "@/lib/r2/client";

function bodyToWebStream(body: any): ReadableStream<Uint8Array> | null {
  if (!body) {
    return null;
  }

  if (body instanceof Readable) {
    return Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>;
  }

  if (body instanceof Uint8Array) {
    return new Response(body).body;
  }

  // AWS SDK in some runtimes returns a web ReadableStream already.
  if (typeof body?.getReader === "function") {
    return body as ReadableStream<Uint8Array>;
  }

  return null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    const { data: image, error: imageError } = await auth.supabase
      .from("post_images")
      .select("id,post_id,r2_key,content_type,bytes")
      .eq("id", imageId)
      .single();

    if (imageError || !image) {
      return NextResponse.json(failure("IMAGE_NOT_FOUND", imageError?.message ?? "Image not found."), { status: 404 });
    }

    const { data: post } = await auth.supabase
      .from("palette_posts")
      .select("palette_id")
      .eq("id", image.post_id)
      .single();

    if (!post) {
      return NextResponse.json(failure("IMAGE_NOT_FOUND", "Post not found."), { status: 404 });
    }

    const { data: member } = await auth.supabase
      .from("palette_members")
      .select("user_id")
      .eq("palette_id", post.palette_id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(failure("FORBIDDEN", "Palette membership required."), { status: 403 });
    }

    const { client, bucket } = getR2Client();
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: image.r2_key }));

    const stream = bodyToWebStream(object.Body);
    if (!stream) {
      return NextResponse.json(failure("IMAGE_FETCH_FAILED", "Empty object body."), { status: 500 });
    }

    const headers = new Headers();
    headers.set("Content-Type", image.content_type || object.ContentType || "application/octet-stream");
    if (object.ContentLength) {
      headers.set("Content-Length", String(object.ContentLength));
    } else if (image.bytes) {
      headers.set("Content-Length", String(image.bytes));
    }
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    if (object.ETag) {
      headers.set("ETag", object.ETag);
    }

    return new NextResponse(stream, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("IMAGE_FETCH_FAILED", message), { status: 500 });
  }
}
