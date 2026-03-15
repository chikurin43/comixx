"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { MemberRole, Palette } from "@/lib/types";

export default function PaletteMangaPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
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
  }, [params.paletteId, user?.id]);

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

        <div className="palette-manga-content">
          <section className="palette-manga-placeholder">
            <p>漫画ページ（完成版専用）は後で実装します。制作途中の共有は「投稿」タブを使ってください。</p>
          </section>
        </div>
      </main>
    </AuthGate>
  );
}
