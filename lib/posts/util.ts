import crypto from "node:crypto";

export type ImageKind = "jpg" | "png" | "webp";

export function buildSlug(input: string) {
  const trimmed = input.trim();
  const ascii = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii.length) {
    return ascii.slice(0, 48);
  }

  // Fallback for non-ascii names (e.g. Japanese): stable short hash.
  return `cat-${crypto.createHash("sha1").update(trimmed).digest("hex").slice(0, 8)}`;
}

export function resolveUniqueSlug(base: string, existing: Set<string>) {
  if (!existing.has(base)) {
    return base;
  }

  for (let i = 2; i < 200; i += 1) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
}

export function detectImageKind(contentType: string, filename: string | null): ImageKind | null {
  const ct = contentType.toLowerCase();
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return "jpg";
  if (ct.includes("image/png")) return "png";
  if (ct.includes("image/webp")) return "webp";

  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";

  return null;
}

export function sha256Hex(data: ArrayBuffer | Uint8Array) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function buildR2Key(paletteId: string, postId: string, sortOrder: number, hashHex: string, ext: ImageKind) {
  return `palettes/${paletteId}/posts/${postId}/${sortOrder}-${hashHex}.${ext}`;
}

