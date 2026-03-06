"use client";

import Link from "next/link";
import {
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { UserCardOverlay } from "@/components/chat/UserCardOverlay";
import { PaletteSubNav } from "@/components/palette/PaletteSubNav";
import { apiFetch } from "@/lib/api/client";
import {
  formatDateSeparator,
  formatDisplayName,
  formatMessageTime,
  formatPublicId,
  messageAnchorId,
} from "@/lib/chat/format";
import { fetchPalette, fetchPaletteChannels, fetchPaletteMembers, joinPalette } from "@/lib/palette/client";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import type {
  ApiMessageCreate,
  ApiMessageList,
  ApiPaletteChannelCreate,
  MemberRole,
  Message,
  MessageReaction,
  Palette,
  PaletteChannel,
  UserProfile,
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

type ComposeMode = "normal" | "advanced";

function ensureTextareaHeight(node: HTMLTextAreaElement | null) {
  if (!node) {
    return;
  }

  node.style.height = "auto";
  node.style.height = `${Math.min(node.scrollHeight, 220)}px`;
}

export default function PaletteChatPage({ params }: { params: { paletteId: string } }) {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const realtimeRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [palette, setPalette] = useState<Palette | null>(null);
  const [channels, setChannels] = useState<PaletteChannel[]>([]);
  const [ownerId, setOwnerId] = useState("");
  const [viewerRole, setViewerRole] = useState<MemberRole>("member");

  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);

  const [content, setContent] = useState("");
  const [composeMode, setComposeMode] = useState<ComposeMode>("normal");
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showStructureMenu, setShowStructureMenu] = useState(false);

  const [creatingChannel, setCreatingChannel] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    message: null,
  });
  const [overlay, setOverlay] = useState<OverlayState>({ open: false, x: 0, y: 0, userId: "", profile: null });

  const isOwner = viewerRole === "owner" || user?.id === ownerId;
  const canModerate = viewerRole === "owner" || viewerRole === "moderator";
  const selectedChannel = channels.find((channel) => channel.id === selectedChannelId) ?? null;
  const messageMap = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

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

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const mergeUniqueMessages = (incoming: Message[], current: Message[]) => {
    const map = new Map<string, Message>();
    [...incoming, ...current].forEach((message) => {
      map.set(message.id, message);
    });

    return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
  };

  const loadMessages = useCallback(
    async (options?: { cursor?: string | null; prepend?: boolean }) => {
      const cursor = options?.cursor;
      const prepend = options?.prepend ?? false;
      const limit = 40;

      if (prepend) {
        setLoadingOlder(true);
      } else {
        setLoading(true);
      }

      const qs = new URLSearchParams({ paletteId: params.paletteId, limit: String(limit) });
      if (selectedChannelId) {
        qs.set("channelId", selectedChannelId);
      }
      if (cursor) {
        qs.set("cursor", cursor);
      }

      const response = await apiFetch<ApiMessageList>(`/api/messages?${qs.toString()}`, "GET");

      if (!response.success) {
        setErrorText(response.error.message);
        if (prepend) {
          setLoadingOlder(false);
        } else {
          setLoading(false);
        }
        return;
      }

      setMessages((prev) => {
        if (prepend) {
          return mergeUniqueMessages(response.data.messages, prev);
        }

        return response.data.messages;
      });
      setReactions(response.data.reactions);
      setNextCursor(response.data.nextCursor);
      setHasMore(response.data.hasMore);
      setErrorText("");

      if (prepend) {
        setLoadingOlder(false);
      } else {
        setLoading(false);
      }
    },
    [params.paletteId, selectedChannelId],
  );

  const scheduleLoadMessages = useCallback(() => {
    if (realtimeRefreshTimerRef.current !== null) {
      return;
    }

    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      void loadMessages();
    }, 120);
  }, [loadMessages]);

  const loadBase = useCallback(async () => {
    try {
      setLoading(true);
      await joinPalette(params.paletteId);

      const [paletteData, memberData, channelData] = await Promise.all([
        fetchPalette(params.paletteId),
        fetchPaletteMembers(params.paletteId),
        fetchPaletteChannels(params.paletteId),
      ]);

      setPalette(paletteData);
      setOwnerId(memberData.ownerId);
      setViewerRole(memberData.members.find((member) => member.user_id === user?.id)?.role ?? "member");
      setChannels(channelData);
      setErrorText("");

      setSelectedChannelId((prev) => {
        if (prev && channelData.some((channel) => channel.id === prev)) {
          return prev;
        }

        return channelData[0]?.id ?? "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "読み込みに失敗しました。";
      setErrorText(message);
    } finally {
      setLoading(false);
    }
  }, [params.paletteId, user?.id]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    const channel = supabase
      .channel(`palette-${params.paletteId}-chat`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `palette_id=eq.${params.paletteId}` },
        () => {
          scheduleLoadMessages();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
          filter: `palette_id=eq.${params.paletteId}`,
        },
        () => {
          scheduleLoadMessages();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "palette_channels",
          filter: `palette_id=eq.${params.paletteId}`,
        },
        () => {
          void loadBase();
        },
      )
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [loadBase, params.paletteId, scheduleLoadMessages]);

  useEffect(() => {
    const closeMenus = () => {
      setContextMenu((prev) => ({ ...prev, open: false }));
      setShowStructureMenu(false);
    };

    window.addEventListener("click", closeMenus);
    return () => window.removeEventListener("click", closeMenus);
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

  useEffect(() => {
    ensureTextareaHeight(textareaRef.current);
  }, [content, composeMode]);

  const sendMessage = async () => {
    if (!content.trim() || sending) {
      return;
    }

    setSending(true);
    const response = await apiFetch<ApiMessageCreate>("/api/messages", "POST", {
      paletteId: params.paletteId,
      channelId: selectedChannelId || null,
      content,
      replyToId: replyTarget?.id ?? null,
    });

    setSending(false);

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setContent("");
    setReplyTarget(null);
    await loadMessages();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleNormalModeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (composeMode !== "normal") {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const insertMarkdown = (prefix: string, suffix = "") => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }

    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`;

    setContent(next);

    requestAnimationFrame(() => {
      const cursor = start + prefix.length + selected.length + suffix.length;
      node.focus();
      node.setSelectionRange(cursor, cursor);
    });
  };

  const insertSnippet = (snippet: string) => {
    insertMarkdown(snippet, "");
    setShowStructureMenu(false);
  };

  const handleMessageContextMenu = (event: MouseEvent<HTMLDivElement>, message: Message) => {
    event.preventDefault();
    event.stopPropagation();
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

    const link = `${window.location.origin}/palette/${params.paletteId}/chat#${messageAnchorId(contextMenu.message.id)}`;
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
    await loadMessages();
  };

  const handleReplySelect = () => {
    if (!contextMenu.message) {
      return;
    }

    setReplyTarget(contextMenu.message);
    setContextMenu((prev) => ({ ...prev, open: false }));
    textareaRef.current?.focus();
  };

  const handleModerationAction = async (action: "hide" | "restore") => {
    if (!contextMenu.message) {
      return;
    }

    const reasonInput = window.prompt("理由を入力してください（任意）", "");
    if (reasonInput === null) {
      return;
    }

    const response = await apiFetch("/api/messages", "PATCH", {
      messageId: contextMenu.message.id,
      action,
      reason: reasonInput,
    });

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setContextMenu((prev) => ({ ...prev, open: false }));
    await loadMessages();
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

  const jumpToMessage = (messageId: string) => {
    const target = document.getElementById(messageAnchorId(messageId));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.history.replaceState({}, "", `#${messageAnchorId(messageId)}`);
    }
  };

  const createChannel = async () => {
    if (!channelName.trim() || creatingChannel) {
      return;
    }

    setCreatingChannel(true);
    const response = await apiFetch<ApiPaletteChannelCreate>(`/api/palettes/${params.paletteId}/channels`, "POST", {
      name: channelName,
      description: channelDescription,
    });
    setCreatingChannel(false);

    if (!response.success) {
      setErrorText(response.error.message);
      return;
    }

    setChannelName("");
    setChannelDescription("");
    setChannels((prev) => [...prev, response.data.channel]);
    setSelectedChannelId(response.data.channel.id);
    setShowChannelModal(false);
  };

  const selectedMessage = contextMenu.message;
  const canHideSelected =
    Boolean(selectedMessage) &&
    !selectedMessage?.deleted_at &&
    (canModerate || selectedMessage?.user_id === user?.id);
  const canRestoreSelected =
    Boolean(selectedMessage) &&
    Boolean(selectedMessage?.deleted_at) &&
    canModerate;

  return (
    <AuthGate>
      <main className="palette-chat-root">
        <section className="panel palette-chat-shell-v2">
          <div className="panel-header">
            <div>
              <h1>{palette?.title ?? "Palette"}</h1>
              <p className="small">{palette?.description || "説明はまだありません。"}</p>
            </div>
            <button className="button secondary palette-mobile-toggle" type="button" onClick={() => setDrawerOpen((prev) => !prev)}>
              チャンネル
            </button>
          </div>

          <PaletteSubNav paletteId={params.paletteId} isOwner={isOwner} canModerate={canModerate} />

          {errorText ? <p className="small error-text">{errorText}</p> : null}
          {loading ? <p className="small">読み込み中...</p> : null}

          <div className="palette-chat-layout">
            <aside className={`palette-channel-nav ${drawerOpen ? "open" : ""}`}>
              <div className="palette-channel-nav-head">
                <h3>チャンネル</h3>
                <button className="button secondary" type="button" onClick={() => setDrawerOpen(false)}>
                  閉じる
                </button>
              </div>

              <div className="palette-channel-list">
                {channels.length === 0 ? <p className="small">チャンネルが未作成です。generalとして投稿できます。</p> : null}
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className="palette-channel-item"
                    data-active={channel.id === selectedChannelId}
                    onClick={() => {
                      setSelectedChannelId(channel.id);
                      setDrawerOpen(false);
                    }}
                  >
                    <span>#{channel.name}</span>
                    {channel.description ? <small>{channel.description}</small> : null}
                  </button>
                ))}
              </div>

              {isOwner ? (
                <button
                  type="button"
                  className="palette-channel-create-trigger"
                  onClick={() => {
                    setShowChannelModal(true);
                    setDrawerOpen(false);
                  }}
                >
                  + チャンネル作成
                </button>
              ) : null}
            </aside>

            <article className="palette-chat-frame" data-mode={composeMode}>
              <header className="palette-chat-frame-head">
                <h2>{selectedChannel ? `#${selectedChannel.name}` : "#general"}</h2>
                <p className="small">固定幅チャット。メッセージ欄のみスクロールします。</p>
              </header>

              <div className="chat-list" role="log" aria-live="polite">
                {hasMore ? (
                  <div className="chat-load-more">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={loadingOlder || !nextCursor}
                      onClick={() => void loadMessages({ cursor: nextCursor, prepend: true })}
                    >
                      {loadingOlder ? "読み込み中..." : "以前の投稿を読み込む"}
                    </button>
                  </div>
                ) : null}
                {messages.map((message, index) => {
                  const previous = index > 0 ? messages[index - 1] : null;
                  const currentDay = new Date(message.created_at).toDateString();
                  const previousDay = previous ? new Date(previous.created_at).toDateString() : null;
                  const showDateDivider = !previousDay || previousDay !== currentDay;

                  const isMine = message.user_id === user?.id;
                  const publicId = formatPublicId(message.profile?.public_id, message.user_id);
                  const displayName = formatDisplayName(message.profile?.display_name, publicId);
                  const replySource = message.parent_message_id ? messageMap.get(message.parent_message_id) : null;

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
                            userId={publicId}
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
                                ↪ {formatDisplayName(replySource.profile?.display_name, formatPublicId(replySource.profile?.public_id, replySource.user_id))}: {replySource.content.replace(/\s+/g, " ").slice(0, 80)}
                              </button>
                            ) : null}
                            <ChatMarkdown content={message.content} />
                            <div className="reaction-line">
                              <button
                                className={`reaction-chip ${reactionSummary.mine.has(message.id) ? "active" : ""}`}
                                type="button"
                                onClick={() => {
                                  setContextMenu({ open: false, x: 0, y: 0, message });
                                  void (async () => {
                                    await apiFetch("/api/messages/reactions", "POST", {
                                      paletteId: params.paletteId,
                                      messageId: message.id,
                                      emoji: "❤️",
                                    });
                                    await loadMessages();
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
                            userId={publicId}
                            avatarUrl={message.profile?.avatar_url}
                            onClick={(event) => openUserCard(event, message)}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="chat-composer" onSubmit={handleSubmit}>
                <div className="chat-composer-scroll">
                  <div className="chat-composer-mode-tabs">
                    <button
                      type="button"
                      className="button secondary"
                      data-active={composeMode === "normal"}
                      onClick={() => {
                        setComposeMode("normal");
                        setShowStructureMenu(false);
                      }}
                    >
                      通常
                    </button>
                    <button
                      type="button"
                      className="button secondary"
                      data-active={composeMode === "advanced"}
                      onClick={() => setComposeMode("advanced")}
                    >
                      詳細
                    </button>
                    {composeMode === "normal" ? <span className="small">Shift+Enterで改行</span> : null}
                  </div>

                  {replyTarget ? (
                    <div className="reply-target">
                      <p>
                        返信先: {formatDisplayName(replyTarget.profile?.display_name, formatPublicId(replyTarget.profile?.public_id, replyTarget.user_id))} - {replyTarget.content.replace(/\s+/g, " ").slice(0, 120)}
                      </p>
                      <button type="button" className="button secondary" onClick={() => setReplyTarget(null)}>
                        返信解除
                      </button>
                    </div>
                  ) : null}

                  {composeMode === "advanced" ? (
                    <div className="markdown-tools-area" onClick={(event) => event.stopPropagation()}>
                      <div className="markdown-toolbar">
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("**", "**")}>B</button>
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("_", "_")}>I</button>
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("`", "`")}>Code</button>
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("[", "](https://)")}>Link</button>
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("- ")}>List</button>
                        <button type="button" className="button secondary mini" onClick={() => insertMarkdown("> ")}>Quote</button>
                        <button
                          type="button"
                          className="button secondary mini"
                          onClick={(event) => {
                            event.stopPropagation();
                            setShowStructureMenu((prev) => !prev);
                          }}
                        >
                          構造 ▾
                        </button>
                      </div>
                      {showStructureMenu ? (
                        <div className="markdown-structure-menu">
                          <button type="button" onClick={() => insertSnippet("# ")}>Heading 1</button>
                          <button type="button" onClick={() => insertSnippet("## ")}>Heading 2</button>
                          <button type="button" onClick={() => insertSnippet("### ")}>Heading 3</button>
                          <button type="button" onClick={() => insertSnippet("- item\n  - nested item\n    - deep item\n")}>ネストリスト</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <textarea
                    ref={textareaRef}
                    name="content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    onKeyDown={handleNormalModeKeyDown}
                    placeholder={composeMode === "normal" ? "メッセージを入力して Enter で送信" : "Markdown対応メッセージを入力"}
                    minLength={1}
                    maxLength={4000}
                    rows={composeMode === "normal" ? 1 : 6}
                    required
                  />

                  {composeMode === "advanced" ? (
                    <div className="markdown-detected">
                      <p className="small">プレビュー</p>
                      <div className="markdown-preview card">
                        <ChatMarkdown content={content || "(プレビューなし)"} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="chat-compose-actions">
                  <button type="submit" className="button" disabled={sending || !content.trim()}>
                    {sending ? "送信中..." : "送信"}
                  </button>
                  <Link className="button secondary" href={`/palette/${params.paletteId}`}>
                    概要へ戻る
                  </Link>
                </div>
              </form>
            </article>
          </div>
        </section>

        {showChannelModal ? (
          <>
            <button type="button" className="channel-modal-backdrop" onClick={() => setShowChannelModal(false)} aria-label="チャンネル作成を閉じる" />
            <section className="channel-modal" role="dialog" aria-modal="true" aria-label="チャンネル作成">
              <h3>チャンネル作成</h3>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void createChannel();
                }}
              >
                <label>
                  チャンネル名
                  <input
                    type="text"
                    value={channelName}
                    onChange={(event) => setChannelName(event.target.value)}
                    placeholder="日本語も入力できます"
                    minLength={1}
                    maxLength={40}
                    required
                  />
                </label>
                <label>
                  説明
                  <input
                    type="text"
                    value={channelDescription}
                    onChange={(event) => setChannelDescription(event.target.value)}
                    maxLength={120}
                  />
                </label>
                <div className="channel-modal-actions">
                  <button type="button" className="button secondary" onClick={() => setShowChannelModal(false)}>キャンセル</button>
                  <button type="submit" className="button" disabled={creatingChannel}>{creatingChannel ? "作成中..." : "作成"}</button>
                </div>
              </form>
            </section>
          </>
        ) : null}

        {contextMenu.open && contextMenu.message ? (
          <div className="chat-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button type="button" onClick={() => void handleCopyLink()}>その投稿へのリンクをコピー</button>
            <button type="button" onClick={() => void handleReactionToggle()}>リアクション（❤️）</button>
            <button type="button" onClick={handleReplySelect}>返信</button>
            {canHideSelected ? (
              <button type="button" className="danger" onClick={() => void handleModerationAction("hide")}>投稿を非表示</button>
            ) : null}
            {canRestoreSelected ? (
              <button type="button" onClick={() => void handleModerationAction("restore")}>投稿を復元</button>
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

