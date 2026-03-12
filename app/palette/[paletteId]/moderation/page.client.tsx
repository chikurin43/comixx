"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { formatDisplayName, formatMessageTime, formatPublicId, messageAnchorId } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { ApiModerationLogs, MemberRole, ModerationLog, Palette } from "@/lib/types";

export default function PaletteModerationPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const isOwner = viewerRole === "owner" || ownerId === user?.id;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator";

  const load = useCallback(async () => {
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

      if (role === "owner" || role === "moderator") {
        const logsRes = await apiFetch<ApiModerationLogs>(`/api/palettes/${params.paletteId}/moderation-logs?limit=60`, "GET");
        if (!logsRes.success) {
          setLogs([]);
          setErrorText(logsRes.error.message);
        } else {
          setLogs(logsRes.data.logs);
          setErrorText("");
        }
      } else {
        setLogs([]);
        setErrorText("");
      }
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

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の管理ログ</h1>
              <p className="small">投稿管理の監査ログを確認できます。</p>
            </div>
            <Link className="button secondary" href={`/palette/${params.paletteId}/chat`}>
              チャットへ
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}

          {!loading && !canModerate ? (
            <p className="small">このページはオーナーまたはモデレーターのみ閲覧できます。</p>
          ) : null}

          {!loading && canModerate ? (
            <div className="list moderation-log-list">
              {logs.length === 0 ? <p className="small">まだ管理ログはありません。</p> : null}
              {logs.map((log) => {
                const actorPublicId = formatPublicId(log.actor_profile?.public_id, log.actor_id);
                const actorDisplayName = formatDisplayName(log.actor_profile?.display_name, actorPublicId);

                return (
                  <article key={log.id} className="card moderation-log-item">
                    <div className="moderation-log-head">
                      <strong>{log.action}</strong>
                      <time>{formatMessageTime(log.created_at)}</time>
                    </div>
                    <p className="small">
                      実行者: {actorDisplayName} (@{actorPublicId})
                    </p>
                    <p className="small">理由: {log.reason ?? "(未設定)"}</p>
                    {log.message ? (
                      <p>
                        対象:{" "}
                        <Link href={`/palette/${params.paletteId}/chat#${messageAnchorId(log.message.id)}`}>
                          {log.message.content.slice(0, 120)}
                        </Link>
                      </p>
                    ) : (
                      <p className="small">対象メッセージは参照できません。</p>
                    )}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </main>
    </AuthGate>
  );
}
