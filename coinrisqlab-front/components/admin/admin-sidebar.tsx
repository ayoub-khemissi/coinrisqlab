"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Newspaper, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { key: "Dashboard", href: "", icon: LayoutDashboard },
  { key: "News", href: "/news", icon: Newspaper },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const basePath = "/admin";

  return (
    <aside className="w-64 min-h-screen bg-background border-r border-divider flex flex-col">
      <div className="p-6 border-b border-divider">
        <NextLink className="flex items-center gap-2" href={basePath}>
          <span className="font-bold text-lg text-primary uppercase">
            CoinRisqLab
          </span>
        </NextLink>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const href = `${basePath}${item.href}`;
            const isActive =
              item.href === ""
                ? pathname === basePath || pathname === `${basePath}/`
                : pathname.startsWith(href);

            const Icon = item.icon;

            return (
              <li key={item.key}>
                <NextLink
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-default-500 hover:text-foreground hover:bg-default-100"
                  }`}
                  href={href}
                >
                  <Icon size={18} />
                  <span>{item.key}</span>
                </NextLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
