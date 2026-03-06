"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { avatarFallback } from "@/lib/chat/format";

type UserAvatarProps = {
  displayName: string;
  userId: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

function AvatarContent({ avatarUrl, displayName, userId, size }: Pick<UserAvatarProps, "avatarUrl" | "displayName" | "userId" | "size">) {
  if (!avatarUrl) {
    return <span>{avatarFallback(displayName, userId)}</span>;
  }

  const pixelSize = size === "sm" ? 32 : 44;

  return (
    <Image
      src={avatarUrl}
      alt={displayName}
      width={pixelSize}
      height={pixelSize}
      className="user-avatar-image"
      unoptimized
    />
  );
}

export function UserAvatar({ displayName, userId, avatarUrl, size = "md", onClick }: UserAvatarProps) {
  const className = `user-avatar user-avatar-${size}`;
  const label = `${displayName} のプロフィールを表示`;

  if (onClick) {
    return (
      <button aria-label={label} className={className} type="button" onClick={onClick}>
        <AvatarContent avatarUrl={avatarUrl} displayName={displayName} userId={userId} size={size} />
      </button>
    );
  }

  return (
    <span className={className}>
      <AvatarContent avatarUrl={avatarUrl} displayName={displayName} userId={userId} size={size} />
    </span>
  );
}
