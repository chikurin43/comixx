"use client";

import type { MouseEvent } from "react";
import { avatarFallback } from "@/lib/chat/format";

type UserAvatarProps = {
  displayName: string;
  userId: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function UserAvatar({ displayName, userId, avatarUrl, size = "md", onClick }: UserAvatarProps) {
  const className = `user-avatar user-avatar-${size}`;
  const label = `${displayName} のプロフィールを表示`;

  if (onClick) {
    return (
      <button aria-label={label} className={className} type="button" onClick={onClick}>
        {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{avatarFallback(displayName, userId)}</span>}
      </button>
    );
  }

  return (
    <span className={className}>
      {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{avatarFallback(displayName, userId)}</span>}
    </span>
  );
}
