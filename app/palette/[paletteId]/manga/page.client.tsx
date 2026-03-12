"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { MemberRole, Palette } from "@/lib/types";

type MangaTab = "view" | "post";

export default function PaletteMangaPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [activeTab, setActiveTab] = useState<MangaTab>("view");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await joinPalette(params.paletteId);

        const [paletteData, memberData] = await Promise.all([
          fetchPalette(params.paletteId),
          fetchPaletteMembers(params.paletteId),
        ]);

        setPalette(paletteData);
        setOwnerId(memberData.ownerId);
        const role = memberData.members.find((member) => member.user_id === user?.id)?.role ?? "member";
        setViewerRole(role);
        setErrorText("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
        setErrorText(message);
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, [params.paletteId]);

  const isOwner = user?.id === ownerId;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator" || user?.id === ownerId;

  return (
    <AuthGate>
      <main>
        <div className="palette-manga-header">
          <h1>{palette?.title ?? "Palette"}</h1>
        </div>

        <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

        {errorText ? <p className="small error-text">{errorText}</p> : null}
        {loading ? <p className="small">読み込み中...</p> : null}

        <div className="palette-manga-tabs">
          <button
            type="button"
            className="palette-manga-tab"
            data-active={activeTab === "view"}
            onClick={() => setActiveTab("view")}
          >
            漫画閲覧
          </button>
          {isOwner ? (
            <button
              type="button"
              className="palette-manga-tab"
              data-active={activeTab === "post"}
              onClick={() => setActiveTab("post")}
            >
              漫画投稿
            </button>
          ) : null}
        </div>

        <div className="palette-manga-content">
          {activeTab === "view" ? (
            <section className="palette-manga-placeholder">
              <p>このパレットの漫画一覧です。準備中です。</p>
            </section>
          ) : (
            <section className="palette-manga-placeholder">
              <p>オーナーはここから漫画を投稿できます。準備中です。</p>
            </section>
          )}
        </div>
      </main>
    </AuthGate>
  );
}
