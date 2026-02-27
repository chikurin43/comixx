import Link from "next/link";

const navItems = [
  { href: "/login", label: "ログイン" },
  { href: "/main", label: "メイン" },
  { href: "/palette/demo", label: "パレット" },
  { href: "/mypage", label: "マイページ" },
];

export function NavBar() {
  return (
    <header>
      <nav>
        <Link className="brand" href="/">
          ComixX
        </Link>
        <ul className="nav-links">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
