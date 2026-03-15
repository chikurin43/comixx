"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { PostImageModal } from "@/components/posts/PostImageModal";
import { apiFetch } from "@/lib/api/client";
import { formatMessageTime } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { ApiPostCategories, ApiPostList, MemberRole, TimelinePostCard, GalleryImage, Palette } from "@/lib/types";

type ViewMode = "timeline" | "gallery";
type SortOrder = "new" | "old";

export default function PalettePostsPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [view, setView] = useState<ViewMode>("timeline");
  const [order, setOrder] = useState<SortOrder>("new");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const [timeline, setTimeline] = useState<TimelinePostCard[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalImages, setModalImages] = useState<Array<{ id: string; alt?: string }>>([]);
  const [modalIndex, setModalIndex] = useState(0);

  const isOwner = viewerRole === "owner" || user?.id === ownerId;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator" || user?.id === ownerId;

  const openImageModal = (images: Array<{ id: string; alt?: string }>, index: number) => {
    setModalImages(images);
    setModalIndex(index);
    setModalOpen(true);
  };

  const loadCategories = useCallback(async () => {
    const response = await apiFetch<ApiPostCategories>(`/api/palettes/${params.paletteId}/post-categories`, "GET");
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setCategories(response.data.categories);
  }, [params.paletteId]);

  const loadPosts = useCallback(
    async (options?: { cursor?: string | null; append?: boolean }) => {
      const cursor = options?.cursor ?? null;
      const append = options?.append ?? false;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const qs = new URLSearchParams({
        view,
        order,
        limit: view === "gallery" ? "60" : "20",
      });
      if (categoryFilter) qs.set("category", categoryFilter);
      if (cursor) qs.set("cursor", cursor);

      const response = await apiFetch<ApiPostList>(`/api/palettes/${params.paletteId}/posts?${qs.toString()}`, "GET");
      if (!response.success) {
        setErrorText(response.error.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      setErrorText("");
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);

      if (response.data.view === "timeline") {
        const posts = response.data.posts;
        setTimeline((prev) => (append ? [...prev, ...posts] : posts));
        setGallery([]);
      } else {
        const images = response.data.images;
        setGallery((prev) => (append ? [...prev, ...images] : images));
        setTimeline([]);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [categoryFilter, order, params.paletteId, view],
  );

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await joinPalette(params.paletteId);
      const [paletteData, memberData] = await Promise.all([fetchPalette(params.paletteId), fetchPaletteMembers(params.paletteId)]);
      setPalette(paletteData);
      setOwnerId(memberData.ownerId);
      setViewerRole(memberData.members.find((m) => m.user_id === user?.id)?.role ?? "member");
      setErrorText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
      setErrorText(message);
    } finally {
      setLoading(false);
    }
  }, [params.paletteId, user?.id]);

  useEffect(() => {
    void bootstrap();
    void loadCategories();
  }, [bootstrap, loadCategories]);

  useEffect(() => {
    setNextCursor(null);
    setHasMore(false);
    void loadPosts();
  }, [categoryFilter, loadPosts, order, view]);

  const selectedCategoryLabel = useMemo(() => {
    if (!categoryFilter) return "すべて";
    return categories.find((c) => c.id === categoryFilter)?.name ?? "すべて";
  }, [categories, categoryFilter]);

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の投稿</h1>
              <p className="small">制作途中の共有や日記などの投稿を集約します。</p>
            </div>
            {isOwner ? (
              <Link className="button" href={`/palette/${params.paletteId}/posts/new`}>
                + 新規投稿
              </Link>
            ) : null}
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}

          <div className="posts-toolbar">
            <div className="posts-view-tabs" role="tablist" aria-label="表示切替">
              <button type="button" className="posts-view-tab" data-active={view === "timeline"} onClick={() => setView("timeline")}>
                タイムライン
              </button>
              <button type="button" className="posts-view-tab" data-active={view === "gallery"} onClick={() => setView("gallery")}>
                ギャラリー
              </button>
            </div>

            <div className="posts-filters">
              <label className="small">
                カテゴリ
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">すべて</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="small">
                並び
                <select value={order} onChange={(event) => setOrder(event.target.value as SortOrder)}>
                  <option value="new">新しい順</option>
                  <option value="old">古い順</option>
                </select>
              </label>
            </div>
          </div>

          {loading ? <p className="small">読み込み中...</p> : null}

          {view === "timeline" ? (
            <div className="posts-timeline">
              {timeline.length === 0 && !loading ? (
                <p className="small posts-empty">投稿がありません（カテゴリ: {selectedCategoryLabel}）。</p>
              ) : null}

              {timeline.map((card) => {
                const firstImage = card.images[0] ?? null;
                const moreCount = Math.max(0, card.images.length - 1);
                const title = card.post.title?.trim();
                const body = card.post.body?.trim();
                const createdAt = card.post.created_at;

                return (
                  <article key={card.post.id} className="post-card">
                    <div className="post-card-main">
                      <div className="post-card-meta">
                        <span className="badge">{card.category?.name ?? "未分類"}</span>
                        {card.post.is_final ? <span className="badge strong">完成版</span> : null}
                      </div>
                      {title ? <h2 className="post-card-title">{title}</h2> : null}
                      {body ? (
                        <div className="post-card-body">
                          <ChatMarkdown content={body} />
                        </div>
                      ) : null}
                      <time className="post-card-time">{formatMessageTime(createdAt)}</time>
                    </div>

                    {firstImage ? (
                      <button
                        type="button"
                        className="post-card-image"
                        onClick={() =>
                          openImageModal(
                            card.images.map((img) => ({ id: img.id, alt: title ?? "" })),
                            0,
                          )
                        }
                      >
                        <img src={`/api/post-images/${firstImage.id}`} alt={title ?? ""} loading="lazy" />
                        {moreCount ? <span className="post-card-more">+{moreCount}</span> : null}
                      </button>
                    ) : null}
                  </article>
                );
              })}

              {hasMore ? (
                <div className="posts-load-more">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={loadingMore || !nextCursor}
                    onClick={() => void loadPosts({ cursor: nextCursor, append: true })}
                  >
                    {loadingMore ? "読み込み中..." : "さらに読み込む"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="posts-gallery">
              {gallery.length === 0 && !loading ? <p className="small posts-empty">画像投稿がありません。</p> : null}
              <div className="posts-gallery-grid">
                {gallery.map((row, idx) => (
                  <button
                    type="button"
                    key={row.image.id}
                    className="posts-gallery-item"
                    onClick={() =>
                      openImageModal(
                        gallery.map((img) => ({ id: img.image.id, alt: img.category?.name ?? "" })),
                        idx,
                      )
                    }
                    aria-label={`画像 ${idx + 1}`}
                  >
                    <img src={`/api/post-images/${row.image.id}`} alt={row.category?.name ?? ""} loading="lazy" />
                    {row.category ? <span className="posts-gallery-tag">{row.category.name}</span> : null}
                  </button>
                ))}
              </div>

              {hasMore ? (
                <div className="posts-load-more">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={loadingMore || !nextCursor}
                    onClick={() => void loadPosts({ cursor: nextCursor, append: true })}
                  >
                    {loadingMore ? "読み込み中..." : "さらに読み込む"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <PostImageModal
          open={modalOpen}
          images={modalImages}
          initialIndex={modalIndex}
          onClose={() => setModalOpen(false)}
        />
      </main>
    </AuthGate>
  );
}
