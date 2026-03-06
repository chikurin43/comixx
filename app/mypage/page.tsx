"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { apiGet, apiPut } from "@/lib/api/client";
import { formatDisplayName, formatPublicId } from "@/lib/chat/format";
import { getBrowserSupabaseClient } from "@/lib/supabase/browser-client";
import { validatePublicId } from "@/lib/validation";
import type { ApiMessageList, ApiPaletteList, ApiProfile, Message, Palette, UserProfile } from "@/lib/types";

type SettingsState = {
  publicId: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  notifications: "all" | "vote-only" | "none";
  visibility: "public" | "private";
};

const defaultSettings: SettingsState = {
  publicId: "",
  displayName: "",
  avatarUrl: "",
  bio: "",
  notifications: "all",
  visibility: "public",
};

function profileToSettings(profile: UserProfile): SettingsState {
  return {
    publicId: profile.public_id ?? "",
    displayName: profile.display_name ?? "",
    avatarUrl: profile.avatar_url ?? "",
    bio: profile.bio ?? "",
    notifications:
      profile.notifications === "vote-only" || profile.notifications === "none" ? profile.notifications : "all",
    visibility: profile.visibility === "private" ? "private" : "public",
  };
}

export default function MyPage() {
  const { user, signOut } = useAuth();
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [myMessages, setMyMessages] = useState<Message[]>([]);
  const [errorText, setErrorText] = useState("");
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [password, setPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const loadMyPage = useCallback(async () => {
    const [profileResponse, paletteResponse] = await Promise.all([
      apiGet<ApiProfile>("/api/profile"),
      apiGet<ApiPaletteList>("/api/palettes"),
    ]);

    if (profileResponse.success) {
      setSettings(profileToSettings(profileResponse.data.profile));
    }

    if (!paletteResponse.success) {
      setErrorText(paletteResponse.error.message);
      setPalettes([]);
      setMyMessages([]);
      return;
    }

    const paletteItems = paletteResponse.data.palettes;
    setPalettes(paletteItems);
    setErrorText("");

    const messageJobs = paletteItems
      .slice(0, 12)
      .map((palette) => apiGet<ApiMessageList>(`/api/messages?paletteId=${palette.id}`));

    const messageResponses = await Promise.allSettled(messageJobs);

    const messages = messageResponses
      .flatMap((result) => {
        if (result.status !== "fulfilled" || !result.value.success) {
          return [];
        }

        return result.value.data.messages;
      })
      .filter((message) => message.user_id === user?.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    setMyMessages(messages.slice(0, 10));
  }, [user?.id]);

  useEffect(() => {
    void loadMyPage();
  }, [loadMyPage]);

  const ownedPalettes = useMemo(
    () => palettes.filter((palette) => palette.owner_id === user?.id),
    [palettes, user?.id],
  );

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validatePublicId(settings.publicId)) {
      setAccountMessage("ユーザーIDは3-24文字、英数字と_のみ使用できます。");
      return;
    }

    setAccountMessage("保存中...");

    const response = await apiPut<ApiProfile>("/api/profile", {
      publicId: settings.publicId,
      displayName: settings.displayName,
      avatarUrl: settings.avatarUrl,
      bio: settings.bio,
      notifications: settings.notifications,
      visibility: settings.visibility,
    });

    if (!response.success) {
      setAccountMessage(`保存失敗: ${response.error.message}`);
      return;
    }

    setSettings((prev) => ({ ...prev, publicId: response.data.profile.public_id ?? prev.publicId }));
    setAccountMessage("プロフィール設定を保存しました。");
  };

  const handlePasswordUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setAccountMessage("パスワードは8文字以上で入力してください。");
      return;
    }

    setAccountMessage("更新中...");
    const supabase = getBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setAccountMessage(`パスワード更新失敗: ${error.message}`);
      return;
    }

    setPassword("");
    setAccountMessage("パスワードを更新しました。");
  };

  const publicId = formatPublicId(settings.publicId, user?.id ?? "unknown");
  const displayName = formatDisplayName(settings.displayName, publicId);

  return (
    <AuthGate>
      <main className="split">
        <section className="panel">
          <h1>参加中のパレット</h1>
          {errorText ? <p className="small error-text">{errorText}</p> : null}
          <div className="list">
            {ownedPalettes.map((item) => (
              <article className="card" key={item.id}>
                <h3>{item.title}</h3>
                <p className="small">ジャンル: {item.genre}</p>
                <p className="small">作成日: {new Date(item.created_at).toLocaleString("ja-JP")}</p>
                <Link className="button secondary" href={`/palette/${item.id}`}>
                  開く
                </Link>
              </article>
            ))}
          </div>

          <h2 style={{ marginTop: "1.2rem" }}>活動履歴（最新）</h2>
          <div className="list">
            {myMessages.map((message) => (
              <article className="card" key={message.id}>
                <p>{message.content}</p>
                <p className="small">Palette: {message.palette_id}</p>
                <p className="small">{new Date(message.created_at).toLocaleString("ja-JP")}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>アカウント管理</h2>
          <p className="small">メール: {user?.email ?? "-"}</p>

          <div className="profile-icon-area">
            <UserAvatar displayName={displayName} userId={publicId} avatarUrl={settings.avatarUrl || null} />
            <Link className="button secondary" href={`/users/${publicId}`}>
              公開プロフィールを見る
            </Link>
          </div>

          <form onSubmit={handleProfileSave}>
            <label>
              ユーザーID（公開）
              <input
                type="text"
                value={settings.publicId}
                onChange={(event) => setSettings((prev) => ({ ...prev, publicId: event.target.value }))}
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                placeholder="comixx_user"
                required
              />
            </label>
            <label>
              表示名
              <input
                type="text"
                value={settings.displayName}
                onChange={(event) => setSettings((prev) => ({ ...prev, displayName: event.target.value }))}
                minLength={2}
                maxLength={40}
              />
            </label>
            <label>
              アイコン画像URL
              <input
                type="url"
                value={settings.avatarUrl}
                onChange={(event) => setSettings((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label>
              プロフィール
              <textarea
                value={settings.bio}
                onChange={(event) => setSettings((prev) => ({ ...prev, bio: event.target.value }))}
                maxLength={280}
              />
            </label>
            <label>
              メール通知設定
              <select
                value={settings.notifications}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, notifications: event.target.value as SettingsState["notifications"] }))
                }
              >
                <option value="all">すべて受け取る</option>
                <option value="vote-only">投票関連のみ</option>
                <option value="none">受け取らない</option>
              </select>
            </label>
            <label>
              プロフィール公開
              <select
                value={settings.visibility}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, visibility: event.target.value as SettingsState["visibility"] }))
                }
              >
                <option value="public">公開</option>
                <option value="private">非公開</option>
              </select>
            </label>
            <button type="submit" className="button">
              設定を保存
            </button>
          </form>

          <form onSubmit={handlePasswordUpdate} style={{ marginTop: "1rem" }}>
            <label>
              新しいパスワード
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                placeholder="8文字以上"
              />
            </label>
            <button type="submit" className="button secondary">
              パスワード更新
            </button>
          </form>

          {accountMessage ? <p className="small">{accountMessage}</p> : null}

          <div style={{ marginTop: "1rem" }}>
            <button className="button secondary" type="button" onClick={() => void signOut()}>
              この端末からログアウト
            </button>
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
