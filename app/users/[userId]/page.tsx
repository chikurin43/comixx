"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/auth/AuthGate";
import { apiFetch } from "@/lib/api/client";
import type { ApiUserPage, UserProfile } from "@/lib/types";
import { formatDisplayName } from "@/lib/chat/format";
import { UserAvatar } from "@/components/chat/UserAvatar";

export default function UserPage({ params }: { params: { userId: string } }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [paletteCount, setPaletteCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const run = async () => {
      const response = await apiFetch<ApiUserPage>(`/api/users/${params.userId}`, "GET");
      if (!response.success) {
        setErrorText(response.error.message);
        return;
      }

      setProfile(response.data.profile);
      setPaletteCount(response.data.paletteCount);
      setMessageCount(response.data.messageCount);
    };

    void run();
  }, [params.userId]);

  const displayName = formatDisplayName(profile?.display_name, params.userId);

  return (
    <AuthGate>
      <main>
        <section className="panel user-page">
          <div className="user-page-head">
            <UserAvatar displayName={displayName} userId={params.userId} avatarUrl={profile?.avatar_url} />
            <div>
              <h1>{displayName}</h1>
              <p className="small">ユーザーID: {params.userId}</p>
            </div>
          </div>
          {errorText ? <p className="small error-text">{errorText}</p> : null}
          <p>{profile?.bio || "自己紹介はまだありません。"}</p>
          <div className="user-stats">
            <article className="card">
              <h3>作成パレット</h3>
              <p>{paletteCount}</p>
            </article>
            <article className="card">
              <h3>投稿メッセージ</h3>
              <p>{messageCount}</p>
            </article>
          </div>
          <Link className="button secondary" href="/main">
            メインへ戻る
          </Link>
        </section>
      </main>
    </AuthGate>
  );
}
