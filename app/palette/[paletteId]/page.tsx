"use client";

import Link from "next/link";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { UserCardOverlay } from "@/components/chat/UserCardOverlay";
import { apiFetch } from "@/lib/api/client";
import { formatDateSeparator, formatDisplayName, formatMessageTime, messageAnchorId } from "@/lib/chat/format";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { summarizeVotes } from "@/lib/vote-policy";
import type {
  ApiMessageCreate,
  ApiMessageList,
  ApiPaletteDetail,
  ApiPaletteMembers,
  ApiVoteCreate,
  ApiVoteList,
  Message,
  MessageReaction,
  Palette,
  PaletteMember,
  UserProfile,
  Vote,
} from "@/lib/types";

type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
  message: Message | null;
};

type OverlayState = {
  open: boolean;
  x: number;
  y: number;
  userId: string;
  profile: UserProfile | null;
};

const topic = "story_direction";
const voteOptions = ["転校生を登場", "伏線を回収", "バトル回に進む"];

export default function PalettePage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const [palette, setPalette] = useState<Palette | null>(null);
  const [members, setMembers] = useState<PaletteMember[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ open: false, x: 0, y: 0, message: null });
  const [overlay, setOverlay] = useState<OverlayState>({ open: false, x: 0, y: 0, userId: "", profile: null });

  const isOwner = user?.id === ownerId;

  const voteSummary = useMemo(() => summarizeVotes(votes, topic), [votes]);

  const messageMap = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const reactionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    const mine = new Set<string>();

    reactions.forEach((reaction) => {
      counts.set(reaction.message_id, (counts.get(reaction.message_id) ?? 0) + 1);
      if (reaction.user_id === user?.id) {
        mine.add(reaction.message_id);
      }
    });

    return { counts, mine };
  }, [reactions, user?.id]);

  const loadPalette = useCallback(async () => {
    const response = await apiFetch<ApiPaletteDetail>(`/api/palettes/${params.paletteId}`, "GET");
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setPalette(response.data.palette);
    setOwnerId(response.data.palette.owner_id);
  }, [params.paletteId]);

  const loadMembers = useCallback(async () => {
    const response = await apiFetch<ApiPaletteMembers>(`/api/palettes/${params.paletteId}/members`, "GET");
    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setMembers(response.data.members);
    setOwnerId(response.data.ownerId);
  }, [params.paletteId]);

  const loadMessagesAndVotes = useCallback(async () => {
    const [messagesResponse, votesResponse] = await Promise.all([
      apiFetch<ApiMessageList>(`/api/messages?paletteId=${params.paletteId}`, "GET"),
      apiFetch<ApiVoteList>(`/api/votes?paletteId=${params.paletteId}&topic=${topic}`, "GET"),
    ]);

    if (!messagesResponse.success) {
      setErrorText(messagesResponse.error.message);
      return;
    }

    if (!votesResponse.success) {
      setErrorText(votesResponse.error.message);
      return;
    }

    setMessages(messagesResponse.data.messages);
    setReactions(messagesResponse.data.reactions);
    setVotes(votesResponse.data.votes);
  }, [params.paletteId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadPalette(), loadMembers(), loadMessagesAndVotes()]);
    setLoading(false);
  }, [loadMembers, loadMessagesAndVotes, loadPalette]);

  useEffect(() => {
    const joinAndLoad = async () => {
      await apiFetch(`/api/palettes/${params.paletteId}/members`, "POST");
      await refreshAll();
    };

    void joinAndLoad();
  }, [params.paletteId, refreshAll]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const channel = supabase
      .channel(`palette-${params.paletteId}-stream`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `palette_id=eq.${params.paletteId}` },
        () => {
          void loadMessagesAndVotes();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions", filter: `palette_id=eq.${params.paletteId}` },
        () => {
          void loadMessagesAndVotes();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `palette_id=eq.${params.paletteId}` },
        () => {
          void loadMessagesAndVotes();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMessagesAndVotes, params.paletteId]);

  useEffect(() => {
    const close = () => setContextMenu((prev) => ({ ...prev, open: false }));
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#message-")) {
      return;
    }

    const target = document.querySelector(hash);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [messages]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const content = String(formData.get("content") ?? "");

    const response = await apiFetch<ApiMessageCreate>("/api/messages", "POST", {
      paletteId: params.paletteId,
      content,
      replyToId: replyTarget?.id ?? null,
    });

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    form.reset();
    setReplyTarget(null);
    await loadMessagesAndVotes();
  };

  const handleVote = async (optionKey: string) => {
    const response = await apiFetch<ApiVoteCreate>("/api/votes", "POST", {
      paletteId: params.paletteId,
      topic,
      optionKey,
    });

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    await loadMessagesAndVotes();
  };

  const handleMessageContextMenu = (event: MouseEvent<HTMLDivElement>, message: Message) => {
    event.preventDefault();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      message,
    });
  };

  const handleCopyLink = async () => {
    if (!contextMenu.message) {
      return;
    }

    const link = `${window.location.origin}/palette/${params.paletteId}#${messageAnchorId(contextMenu.message.id)}`;
    await navigator.clipboard.writeText(link);
    setContextMenu((prev) => ({ ...prev, open: false }));
  };

  const handleReactionToggle = async () => {
    if (!contextMenu.message) {
      return;
    }

    await apiFetch("/api/messages/reactions", "POST", {
      paletteId: params.paletteId,
      messageId: contextMenu.message.id,
      emoji: "❤️",
    });

    setContextMenu((prev) => ({ ...prev, open: false }));
    await loadMessagesAndVotes();
  };

  const handleReplySelect = () => {
    if (!contextMenu.message) {
      return;
    }

    setReplyTarget(contextMenu.message);
    setContextMenu((prev) => ({ ...prev, open: false }));
  };

  const handleDeleteMessage = async () => {
    if (!contextMenu.message) {
      return;
    }

    await apiFetch(`/api/messages?messageId=${contextMenu.message.id}`, "DELETE");
    setContextMenu((prev) => ({ ...prev, open: false }));
    await loadMessagesAndVotes();
  };

  const openUserCard = (event: MouseEvent<HTMLElement>, message: Message) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOverlay({
      open: true,
      x: Math.max(rect.left, 16),
      y: rect.bottom + 8,
      userId: message.user_id,
      profile: message.profile,
    });
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

  const jumpToMessage = (messageId: string) => {
    const target = document.getElementById(messageAnchorId(messageId));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.history.replaceState({}, "", `#${messageAnchorId(messageId)}`);
    }
  };

  const removeMember = async (targetUserId: string) => {
    await apiFetch(`/api/palettes/${params.paletteId}/members?userId=${targetUserId}`, "DELETE");
    await loadMembers();
  };

  return (
    <AuthGate>
      <main className="palette-main">
        <section className="palette-shell">
          <article className="panel palette-chat-panel">
            <div className="palette-chat-head">
              <div>
                <h1>{palette?.title ?? `Palette ${params.paletteId}`}</h1>
                <p className="small">{palette?.description || "説明はまだありません。"}</p>
              </div>
              <span className="small">ジャンル: {palette?.genre ?? "-"}</span>
            </div>

            {errorText ? <p className="small error-text">{errorText}</p> : null}
            {loading ? <p className="small">読み込み中...</p> : null}

            <div className="chat-list" role="log" aria-live="polite">
              {messages.map((message, index) => {
                const previous = index > 0 ? messages[index - 1] : null;
                const currentDay = new Date(message.created_at).toDateString();
                const previousDay = previous ? new Date(previous.created_at).toDateString() : null;
                const showDateDivider = !previousDay || previousDay !== currentDay;

                const isMine = message.user_id === user?.id;
                const displayName = formatDisplayName(message.profile?.display_name, message.user_id);
                const replySource = message.reply_to_id ? messageMap.get(message.reply_to_id) : null;

                return (
                  <div key={message.id}>
                    {showDateDivider ? (
                      <div className="date-separator">
                        <span>{formatDateSeparator(message.created_at)}</span>
                      </div>
                    ) : null}

                    <div
                      id={messageAnchorId(message.id)}
                      className={`chat-row ${isMine ? "mine" : "other"}`}
                      onContextMenu={(event) => handleMessageContextMenu(event, message)}
                    >
                      {!isMine ? (
                        <UserAvatar
                          size="sm"
                          displayName={displayName}
                          userId={message.user_id}
                          avatarUrl={message.profile?.avatar_url}
                          onClick={(event) => openUserCard(event, message)}
                        />
                      ) : null}

                      <div className="chat-bubble-wrap">
                        <div className={`chat-meta ${isMine ? "mine" : "other"}`}>
                          {!isMine ? (
                            <button
                              className="chat-user-button"
                              type="button"
                              onClick={(event) => openUserCard(event, message)}
                            >
                              {displayName}
                            </button>
                          ) : null}
                          <time>{formatMessageTime(message.created_at)}</time>
                          {isMine ? (
                            <button
                              className="chat-user-button"
                              type="button"
                              onClick={(event) => openUserCard(event, message)}
                            >
                              {displayName}
                            </button>
                          ) : null}
                        </div>
                        <div className="chat-bubble">
                          {replySource ? (
                            <button
                              className="reply-preview"
                              type="button"
                              onClick={() => jumpToMessage(replySource.id)}
                            >
                              ↪ {formatDisplayName(replySource.profile?.display_name, replySource.user_id)}: {replySource.content.replace(/\s+/g, " ").slice(0, 80)}
                            </button>
                          ) : null}
                          <ChatMarkdown content={message.content} />
                          <div className="reaction-line">
                            <button
                              className={`reaction-chip ${reactionSummary.mine.has(message.id) ? "active" : ""}`}
                              type="button"
                              onClick={() => {
                                setContextMenu({ open: false, x: 0, y: 0, message: message });
                                void (async () => {
                                  await apiFetch("/api/messages/reactions", "POST", {
                                    paletteId: params.paletteId,
                                    messageId: message.id,
                                    emoji: "❤️",
                                  });
                                  await loadMessagesAndVotes();
                                })();
                              }}
                            >
                              ❤️ {reactionSummary.counts.get(message.id) ?? 0}
                            </button>
                          </div>
                        </div>
                      </div>

                      {isMine ? (
                        <UserAvatar
                          size="sm"
                          displayName={displayName}
                          userId={message.user_id}
                          avatarUrl={message.profile?.avatar_url}
                          onClick={(event) => openUserCard(event, message)}
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <form className="chat-composer" onSubmit={handleSendMessage}>
              {replyTarget ? (
                <div className="reply-target">
                  <p>
                    返信先: {formatDisplayName(replyTarget.profile?.display_name, replyTarget.user_id)} - {replyTarget.content.replace(/\s+/g, " ").slice(0, 120)}
                  </p>
                  <button type="button" className="button secondary" onClick={() => setReplyTarget(null)}>
                    返信解除
                  </button>
                </div>
              ) : null}
              <textarea name="content" placeholder="メッセージを入力（改行・リンク・Markdown対応）" minLength={1} maxLength={4000} rows={4} required />
              <button type="submit" className="button">送信</button>
            </form>
          </article>

          <aside className="panel palette-side-panel">
            <section className="card">
              <h3>投票</h3>
              <p className="small">同一ユーザーはトピックごとに1票（上書き）。</p>
              <div className="list">
                {voteOptions.map((option) => (
                  <button key={option} type="button" className="button secondary" onClick={() => void handleVote(option)}>
                    {option} ({voteSummary[option] || 0}票)
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <h3>参加メンバー</h3>
              <div className="list">
                {members.map((member) => {
                  const displayName = formatDisplayName(member.profile?.display_name, member.user_id);
                  const owner = member.user_id === ownerId;

                  return (
                    <article className={`member-row ${owner ? "owner" : ""}`} key={`${member.palette_id}-${member.user_id}`}>
                      <button type="button" className="member-profile" onClick={(event) => openMemberCard(event, member)}>
                        <UserAvatar
                          size="sm"
                          displayName={displayName}
                          userId={member.user_id}
                          avatarUrl={member.profile?.avatar_url}
                        />
                        <span>{displayName}</span>
                        {owner ? <strong>OWNER</strong> : null}
                      </button>
                      <Link className="small" href={`/users/${member.user_id}`}>
                        ページ
                      </Link>
                      {isOwner && !owner ? (
                        <button type="button" className="small action-link" onClick={() => void removeMember(member.user_id)}>
                          退出
                        </button>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="card">
              <h3>今後の拡張予定</h3>
              <ul>
                <li>目的別チャンネル機能</li>
                <li>画像投稿機能</li>
                <li>Markdown記法入力の支援UI</li>
              </ul>
            </section>
          </aside>
        </section>

        {contextMenu.open && contextMenu.message ? (
          <div className="chat-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" onClick={() => void handleCopyLink()}>その投稿へのリンクをコピー</button>
            <button type="button" onClick={() => void handleReactionToggle()}>リアクション（❤️）</button>
            <button type="button" onClick={handleReplySelect}>返信</button>
            {isOwner || contextMenu.message.user_id === user?.id ? (
              <button type="button" className="danger" onClick={() => void handleDeleteMessage()}>投稿を削除</button>
            ) : null}
          </div>
        ) : null}

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
