"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import { formatDisplayName, formatMessageTime, formatPublicId, messageAnchorId } from "@/lib/chat/format";
import { fetchPalette, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import type { ApiModerationLogs, MemberRole, ModerationLog, Palette } from "@/lib/types";

export default function PaletteSettingsPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");
  const [logs, setLogs] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ユーザーロード完了フラグ
  const [userLoaded, setUserLoaded] = useState(false);

  // 編集用状態
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");

  useEffect(() => {
    if (user?.id) {
      setUserLoaded(true);
    }
  }, [user?.id]);

  const isOwner = viewerRole === "owner" || ownerId === user?.id;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator";

  const load = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      await joinPalette(params.paletteId);

      const [paletteData, memberData] = await Promise.all([
        fetchPalette(params.paletteId),
        fetchPaletteMembers(params.paletteId),
      ]);

      setPalette(paletteData);
      setOwnerId(memberData.ownerId);
      setTitle(paletteData.title);
      setDescription(paletteData.description || "");
      setGenre(paletteData.genre || "");

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
    if (userLoaded) {
      void load();
    }
  }, [load, userLoaded]);

  const handleUpdatePalette = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isOwner) {
      setSaveMessage("オーナーのみパレット情報を編集できます。");
      return;
    }

    setSaveMessage("保存中...");

    const response = await apiFetch(`/api/palettes/${params.paletteId}`, "PATCH", {
      title: title.trim(),
      description: description.trim() || null,
      genre: genre.trim() || null,
    });

    if (!response.success) {
      setSaveMessage(`保存失敗: ${response.error.message}`);
      return;
    }

    setSaveMessage("パレット情報を保存しました。");
    await load();
  };

  const handleDeletePalette = async () => {
    if (!isOwner) {
      setSaveMessage("オーナーのみパレットを削除できます。");
      return;
    }

    if (deleteConfirm !== palette?.title) {
      setSaveMessage("確認のためパレット名を正確に入力してください。");
      return;
    }

    setSaveMessage("削除中...");

    const response = await apiFetch(`/api/palettes/${params.paletteId}`, "DELETE");

    if (!response.success) {
      setSaveMessage(`削除失敗: ${response.error.message}`);
      return;
    }

    // 削除成功後、マイページへリダイレクト
    window.location.href = "/mypage";
  };

  return (
    <AuthGate>
      <main>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"} の設定</h1>
              <p className="small">パレット情報の編集と管理ログの確認ができます。</p>
            </div>
            <Link className="button secondary" href={`/palette/${params.paletteId}`}>
              概要へ戻る
            </Link>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}
          {saveMessage ? <p className="small">{saveMessage}</p> : null}

          {/* パレット情報編集 */}
          {isOwner && !loading && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h3>パレット情報編集</h3>
              <form onSubmit={handleUpdatePalette}>
                <label>
                  タイトル
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    minLength={1}
                    maxLength={100}
                    required
                  />
                </label>
                <label>
                  説明
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    placeholder="パレットの説明を入力"
                  />
                </label>
                <label>
                  ジャンル
                  <input
                    type="text"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    maxLength={50}
                    placeholder="例: 漫画、イラスト、小説"
                  />
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" className="button">
                    保存
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* パレット削除 */}
          {isOwner && !loading && (
            <div className="card" style={{ marginTop: "1rem", borderColor: "var(--danger)" }}>
              <h3 style={{ color: "var(--danger)" }}>パレット削除</h3>
              <p className="small">
                パレットを削除すると、すべてのデータ（メッセージ、投票、漫画など）が完全に削除され、復元できません。
              </p>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  className="button danger"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  パレットを削除
                </button>
              ) : (
                <div style={{ marginTop: "1rem" }}>
                  <p className="small">
                    確認のため、削除するパレット名「<strong>{palette?.title}</strong>」を入力してください：
                  </p>
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={palette?.title}
                    style={{ marginTop: "0.5rem" }}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirm("");
                      }}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => void handleDeletePalette()}
                      disabled={deleteConfirm !== palette?.title}
                    >
                      削除する
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 管理ログ */}
          {!loading && canModerate && (
            <div style={{ marginTop: "2rem" }}>
              <h2>管理ログ</h2>
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
            </div>
          )}

          {!loading && !canModerate && !isOwner && (
            <p className="small">設定の編集と管理ログの閲覧はオーナーまたはモデレーターのみ可能です。</p>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
