"use client";

import { usePathname } from "next/navigation";

export function ConditionalFooter() {
  const pathname = usePathname();
  const isChatPage = pathname?.includes("/palette/") && pathname?.endsWith("/chat");

  if (isChatPage) {
    return null;
  }

  return <footer className="site-footer">©ComixX All rights reserved.</footer>;
}
