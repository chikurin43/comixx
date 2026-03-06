"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PaletteSubNavProps = {
  paletteId: string;
  isOwner: boolean;
};

type PaletteNavItem = {
  href: string;
  label: string;
};

function normalizePaletteRoute(path: string) {
  return path.replace(/\/$/, "");
}

export function PaletteSubNav({ paletteId, isOwner }: PaletteSubNavProps) {
  const pathname = usePathname();
  const base = `/palette/${paletteId}`;

  const items: PaletteNavItem[] = [
    { href: base, label: "概要" },
    { href: `${base}/chat`, label: "チャット" },
    { href: `${base}/votes`, label: "投票" },
    { href: `${base}/members`, label: "メンバー" },
  ];

  if (isOwner) {
    items.splice(3, 0, { href: `${base}/votes/new`, label: "投票作成" });
  }

  const current = normalizePaletteRoute(pathname);

  return (
    <nav className="palette-subnav" aria-label="パレットメニュー">
      {items.map((item) => {
        const active = current === normalizePaletteRoute(item.href);

        return (
          <Link key={item.href} className="palette-subnav-link" data-active={active} href={item.href as Route}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
