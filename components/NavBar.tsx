"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

type NavItem = {
  href: Route;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/main", label: "メイン" },
  { href: "/mypage", label: "マイページ" },
];

export function NavBar() {
  const { status, signOut } = useAuth();
  const pathname = usePathname();

  return (
    <header>
      <nav>
        <Link className="brand" href="/main">
          ComixX
        </Link>
        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link data-active={pathname === item.href} href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
          {status === "authenticated" ? (
            <li>
              <button className="button secondary" onClick={() => void signOut()} type="button">
                ログアウト
              </button>
            </li>
          ) : (
            <li>
              <Link href="/login">ログイン</Link>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
