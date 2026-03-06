"use client";

import Link from "next/link";
import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { UserCardOverlay } from "@/components/chat/UserCardOverlay";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { formatDisplayName, formatPublicId } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { MemberRole, Palette, PaletteMember, UserProfile } from "@/lib/types";

type OverlayState = {
  open: boolean;
  x: number;
  y: number;
  userId: string;
  profile: UserProfile | null;
};

export default function PaletteMembersPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [members, setMembers] = useState<PaletteMember[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [overlay, setOverlay] = useState<OverlayState>({ open: false, x: 0, y: 0, userId: "", profile: null });

  const isOwner = viewerRole === "owner" || user?.id === ownerId;
  const canModerate = useMemo(() => viewerRole === "owner" || viewerRole === "moderator", [viewerRole]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      await joinPalette(params.paletteId);

      const [paletteData, membersData] = await Promise.all([fetchPalette(params.paletteId), fetchPaletteMembers(params.paletteId)]);

      setPalette(paletteData);
      setMembers(membersData.members);
      setOwnerId(membersData.ownerId);
      setViewerRole(membersData.members.find((member) => member.user_id === user?.id)?.role ?? "member");
      setErrorText("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
      setErrorText(message);
    } finally {
      setLoading(false);
    }
  }, [params.paletteId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeMember = async (targetUserId: string) => {
    const response = await apiFetch(`/api/palettes/${params.paletteId}/members?userId=${targetUserId}`, "DELETE");
    if (!(response as { success?: boolean }).success) {
      const message = (response as { error?: { message?: string } }).error?.message ?? "削除に失敗しました。";
      setErrorText(message);
      return;
    }

    await load();
  };

  const changeRole = async (targetUserId: string, role: MemberRole) => {
    const response = await apiFetch(`/api/palettes/${params.paletteId}/members`, "PATCH", { userId: targetUserId, role });
    if (!(response as { success?: boolean }).success) {
      const message = (response as { error?: { message?: string } }).error?.message ?? "ロール更新に失敗しました。";
      setErrorText(message);
      return;
    }

    await load();
  };

  const openMemberCard = (event: MouseEvent<HTMLElement>, member: PaletteMember) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOverlay({
      open: true,
      x: Math.max(rect.left, 16),
      y: rect.bottom + 8,
      userId: member.user_id,
      profile: member.profile,
    });
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} のメンバー</h1>
              <p className="small">オーナーは参加メンバーを管理できます。</p>
            </div>
            <Link className="button secondary" href={`/palette/${params.paletteId}/chat`}>
              チャットへ
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}

          <div className="list">
            {members.map((member) => {
              const owner = member.user_id === ownerId;
              const publicId = formatPublicId(member.profile?.public_id, member.user_id);
              const displayName = formatDisplayName(member.profile?.display_name, publicId);

              return (
                <article className={`member-row ${owner ? "owner" : ""}`} key={`${member.palette_id}-${member.user_id}`}>
                  <button type="button" className="member-profile" onClick={(event) => openMemberCard(event, member)}>
                    <UserAvatar size="sm" displayName={displayName} userId={publicId} avatarUrl={member.profile?.avatar_url} />
                    <span>
                      {displayName} <small>@{publicId}</small>
                    </span>
                    {owner ? <strong>OWNER</strong> : null}
                    {!owner && member.role === "moderator" ? <strong>MOD</strong> : null}
                  </button>

                  <Link className="small" href={`/users/${publicId}`}>
                    ページ
                  </Link>

                  {isOwner && !owner ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(event) => void changeRole(member.user_id, event.target.value as MemberRole)}
                        className="small"
                      >
                        <option value="member">member</option>
                        <option value="moderator">moderator</option>
                      </select>
                      <button type="button" className="small action-link" onClick={() => void removeMember(member.user_id)}>
                        退出
                      </button>
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        {overlay.open ? (
          <UserCardOverlay
            profile={overlay.profile}
            userId={overlay.userId}
            position={{ x: overlay.x, y: overlay.y }}
            onClose={() => setOverlay((prev) => ({ ...prev, open: false }))}
          />
        ) : null}
      </main>
    </AuthGate>
  );
}
