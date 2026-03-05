export function formatDisplayName(input: string | null | undefined, fallbackId: string) {
  if (input && input.trim().length > 0) {
    return input.trim();
  }

  return `user-${fallbackId.slice(0, 6)}`;
}

export function avatarFallback(displayName: string, userId: string) {
  const normalized = displayName.trim();
  if (normalized.length > 0) {
    return normalized.slice(0, 1).toUpperCase();
  }

  return userId.slice(0, 1).toUpperCase();
}

export function formatDateSeparator(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function formatMessageTime(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function messageAnchorId(messageId: string) {
  return `message-${messageId}`;
}
