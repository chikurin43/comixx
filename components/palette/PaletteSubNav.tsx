"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PaletteSubNavProps = {
  paletteId: string;
  isOwner: boolean;
  canModerate?: boolean;
  vertical?: boolean;
};

type PaletteNavItem = {
  href: string;
  label: string;
};

function normalizePaletteRoute(path: string) {
  return path.replace(/\/$/, "");
}

function isOverviewActive(current: string, base: string): boolean {
  // 設定ページでも概要タブをアクティブにする
  return current === base || current === `${base}/settings`;
}

export function PaletteSubNav({ paletteId, isOwner, canModerate = false, vertical = false }: PaletteSubNavProps) {
  const pathname = usePathname();
  const base = `/palette/${paletteId}`;

  const items: PaletteNavItem[] = [
    { href: base, label: "概要" },
    { href: `${base}/chat`, label: "チャット" },
    { href: `${base}/votes`, label: "投票" },
    { href: `${base}/manga`, label: "漫画" },
    { href: `${base}/members`, label: "メンバー" },
  ];

  const current = normalizePaletteRoute(pathname);

  return (
    <nav className="palette-subnav" aria-label="パレットメニュー" data-vertical={vertical}>
      {items.map((item) => {
        const normalizedHref = normalizePaletteRoute(item.href);
        const isVotesRoot = normalizedHref === `${base}/votes`;
        const isOverview = normalizedHref === base;
        const active =
          (isOverview && isOverviewActive(current, base)) ||
          current === normalizedHref ||
          (isVotesRoot && current.startsWith(`${base}/votes`));

        return (
          <Link key={item.href} className="palette-subnav-link" data-active={active} href={item.href as Route}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
