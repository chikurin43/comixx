"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { formatDisplayName, formatPublicId } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteChannels, fetchPaletteMembers, fetchPalettePolls, joinPalette } from "@/lib/palette/client";
import type { ApiProfile, Palette, PaletteChannel, PaletteMember, PalettePoll, UserProfile } from "@/lib/types";

export default function PaletteOverviewPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [members, setMembers] = useState<PaletteMember[]>([]);
  const [channels, setChannels] = useState<PaletteChannel[]>([]);
  const [polls, setPolls] = useState<PalettePoll[]>([]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoading(true);
        await joinPalette(params.paletteId);

        const [paletteData, memberData, channelsData, pollsData, profileResponse] = await Promise.all([
          fetchPalette(params.paletteId),
          fetchPaletteMembers(params.paletteId),
          fetchPaletteChannels(params.paletteId),
          fetchPalettePolls(params.paletteId),
          apiFetch<ApiProfile>("/api/profile", "GET"),
        ]);

        setPalette(paletteData);
        setMembers(memberData.members);
        setOwnerId(memberData.ownerId);
        setChannels(channelsData);
        setPolls(pollsData);

        if (profileResponse.success) {
          setMyProfile(profileResponse.data.profile);
        }

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
  const viewerMember = members.find((member) => member.user_id === user?.id) ?? null;
  const viewerRole = viewerMember?.role ?? "member";
  const canModerate = viewerRole === "owner" || viewerRole === "moderator" || user?.id === ownerId;

  const ownerProfile = useMemo(
    () => members.find((member) => member.user_id === ownerId)?.profile ?? palette?.owner_profile ?? null,
    [members, ownerId, palette?.owner_profile],
  );

  const ownerIdentity = ownerProfile?.public_id || ownerId || "owner";
  const ownerDisplayName = formatDisplayName(ownerProfile?.display_name, ownerIdentity);
  const ownerPublicId = formatPublicId(ownerProfile?.public_id, ownerId || "owner");
  const myPublicId = formatPublicId(myProfile?.public_id, user?.id ?? "me");

  return (
    <AuthGate>
      <main>
        <section className="panel palette-overview">
          <div className="panel-header">
            <h1>{palette?.title ?? "Palette"}</h1>
            <Link className="button secondary" href={`/palette/${params.paletteId}/chat`}>
              チャットへ
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}

          <div className="overview-grid">
            <article className="card">
              <h3>概要</h3>
              <p>{palette?.description || "説明はまだありません。"}</p>
              <p className="small">ジャンル: {palette?.genre ?? "-"}</p>
              <p className="small">
                オーナー: {ownerDisplayName} (@{ownerPublicId})
              </p>
              <p className="small">あなた: @{myPublicId}</p>
            </article>

            <article className="card">
              <h3>チャンネル</h3>
              <p className="small">{channels.length} チャンネル</p>
              <ul>
                {channels.slice(0, 6).map((channel) => (
                  <li key={channel.id}>
                    <code>#{channel.name}</code>
                  </li>
                ))}
              </ul>
            </article>

            <article className="card">
              <h3>進行中の投票</h3>
              <p className="small">{polls.filter((poll) => poll.active).length} 件</p>
              <ul>
                {polls.slice(0, 5).map((poll) => (
                  <li key={poll.id}>{poll.title}</li>
                ))}
              </ul>
              <Link className="small" href={`/palette/${params.paletteId}/votes`}>
                投票ページへ
              </Link>
            </article>

            <article className="card">
              <h3>参加メンバー</h3>
              <p className="small">{members.length} 人</p>
              <ul>
                {members.slice(0, 6).map((member) => {
                  const displayName = formatDisplayName(
                    member.profile?.display_name,
                    member.profile?.public_id ?? member.user_id,
                  );
                  const publicId = formatPublicId(member.profile?.public_id, member.user_id);
                  return (
                    <li key={`${member.palette_id}-${member.user_id}`}>
                      {displayName} (@{publicId})
                    </li>
                  );
                })}
              </ul>
              <Link className="small" href={`/palette/${params.paletteId}/members`}>
                メンバー一覧へ
              </Link>
            </article>
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
