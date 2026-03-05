"use client";

import Link from "next/link";
import type { UserProfile } from "@/lib/types";
import { formatDisplayName } from "@/lib/chat/format";
import { UserAvatar } from "@/components/chat/UserAvatar";

type UserCardOverlayProps = {
  profile: UserProfile | null;
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
};

export function UserCardOverlay({ profile, userId, position, onClose }: UserCardOverlayProps) {
  const displayName = formatDisplayName(profile?.display_name, userId);

  return (
    <>
      <button className="overlay-backdrop" onClick={onClose} type="button" aria-label="閉じる" />
      <section className="user-overlay-card" style={{ left: position.x, top: position.y }}>
        <div className="user-overlay-head">
          <UserAvatar displayName={displayName} userId={userId} avatarUrl={profile?.avatar_url} />
          <div>
            <h4>{displayName}</h4>
            <p className="small">@{userId.slice(0, 8)}</p>
          </div>
        </div>
        <p className="small">{profile?.bio || "自己紹介はまだ設定されていません。"}</p>
        <Link className="button secondary" href={`/users/${userId}`}>
          ユーザーページを開く
        </Link>
      </section>
    </>
  );
}
