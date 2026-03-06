"use client";

import Link from "next/link";
import type { UserProfile } from "@/lib/types";
import { formatDisplayName, formatPublicId } from "@/lib/chat/format";
import { UserAvatar } from "@/components/chat/UserAvatar";

type UserCardOverlayProps = {
  profile: UserProfile | null;
  userId: string;
  position: { x: number; y: number };
  onClose: () => void;
};

export function UserCardOverlay({ profile, userId, position, onClose }: UserCardOverlayProps) {
  const publicId = formatPublicId(profile?.public_id, userId);
  const displayName = formatDisplayName(profile?.display_name, publicId);

  return (
    <>
      <button className="overlay-backdrop" onClick={onClose} type="button" aria-label="閉じる" />
      <section className="user-overlay-card" style={{ left: position.x, top: position.y }}>
        <div className="user-overlay-head">
          <UserAvatar displayName={displayName} userId={publicId} avatarUrl={profile?.avatar_url} />
          <div>
            <h4>{displayName}</h4>
            <p className="small">@{publicId}</p>
          </div>
        </div>
        <p className="small">{profile?.bio || "自己紹介はまだ設定されていません。"}</p>
        <Link className="button secondary" href={`/users/${publicId}`}>
          ユーザーページを開く
        </Link>
      </section>
    </>
  );
}
