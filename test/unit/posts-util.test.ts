import { describe, expect, it } from "vitest";
import { buildR2Key, buildSlug, detectImageKind, resolveUniqueSlug, sha256Hex } from "@/lib/posts/util";

describe("posts util", () => {
  it("buildSlug uses ascii normalization when possible", () => {
    expect(buildSlug("Hello World!!")).toBe("hello-world");
  });

  it("buildSlug falls back for non-ascii", () => {
    const slug = buildSlug("完成版");
    expect(slug.startsWith("cat-")).toBe(true);
    expect(slug).toHaveLength(12);
  });

  it("resolveUniqueSlug adds suffix", () => {
    const existing = new Set(["draft", "draft-2", "draft-3"]);
    expect(resolveUniqueSlug("draft", existing)).toBe("draft-4");
  });

  it("detectImageKind checks content type and filename", () => {
    expect(detectImageKind("image/png", "a.png")).toBe("png");
    expect(detectImageKind("application/octet-stream", "a.webp")).toBe("webp");
    expect(detectImageKind("text/plain", "a.txt")).toBe(null);
  });

  it("sha256Hex generates stable hash", () => {
    const buf = new TextEncoder().encode("hello");
    expect(sha256Hex(buf)).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("buildR2Key composes immutable key", () => {
    expect(buildR2Key("pal", "post", 1, "deadbeef", "png")).toBe("palettes/pal/posts/post/1-deadbeef.png");
  });
});

