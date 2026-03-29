"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { Chip } from "@heroui/chip";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Bell,
  FileText,
  Settings,
  CreditCard,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

const staticNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolios", href: "/dashboard/portfolios", icon: Briefcase },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { label: "Pricing", href: "/dashboard/pricing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const { user } = useUserAuth();
  const [firstPortfolioId, setFirstPortfolioId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchFirstPortfolio() {
      try {
        const res = await fetch(`${API_BASE_URL}/user/portfolios`, {
          credentials: "include",
        });
        const data = await res.json();

        if (data.data && data.data.length > 0) {
          setFirstPortfolioId(data.data[0].id);
        }
      } catch {
        // ignore
      }
    }

    fetchFirstPortfolio();
  }, []);

  // Build full nav items with dynamic analytics/reports links
  const navItems = [
    staticNavItems[0], // Dashboard
    staticNavItems[1], // Portfolios
    {
      label: "Analytics",
      href: firstPortfolioId
        ? `/dashboard/portfolios/${firstPortfolioId}/analytics`
        : "/dashboard/portfolios",
      icon: BarChart3,
      pro: true,
      activeMatch: "/analytics",
    },
    staticNavItems[2], // Alerts
    {
      label: "Reports",
      href: "/dashboard/reports",
      icon: FileText,
      pro: true,
      activeMatch: "/reports",
    },
    staticNavItems[3], // Pricing
    staticNavItems[4], // Settings
  ];

  if (mobile) {
    const mobileItems = navItems.slice(0, 4);

    return (
      <nav className="flex items-center justify-around border-t border-default-200 bg-background py-2 px-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isPro = "pro" in item && item.pro;
          const isLocked = isPro && user?.plan !== "pro";
          const activeMatch = "activeMatch" in item ? item.activeMatch : null;
          const isActive = activeMatch
            ? pathname.includes(activeMatch)
            : item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/dashboard/portfolios"
                ? pathname.startsWith("/dashboard/portfolios") && !pathname.includes("/analytics") && !pathname.includes("/export")
                : pathname.startsWith(item.href);

          return (
            <NextLink
              key={item.label}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors ${
                isLocked
                  ? "text-default-400"
                  : isActive
                    ? "text-primary"
                    : "text-default-500 hover:text-default-700"
              }`}
              href={isLocked ? "/dashboard/pricing" : item.href}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </NextLink>
          );
        })}
      </nav>
    );
  }

  return (
    <aside className="w-56 h-full flex flex-col border-r border-default-200 bg-background">
      <div className="p-4 border-b border-default-200">
        <NextLink className="text-lg font-bold text-primary" href="/">
          CoinRisqLab
        </NextLink>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isPro = "pro" in item && item.pro;
          const isLocked = isPro && user?.plan !== "pro";
          const activeMatch = "activeMatch" in item ? item.activeMatch : null;
          const isActive = activeMatch
            ? pathname.includes(activeMatch as string)
            : item.href === "/dashboard"
              ? pathname === "/dashboard"
              : item.href === "/dashboard/portfolios"
                ? pathname.startsWith("/dashboard/portfolios") && !pathname.includes("/analytics") && !pathname.includes("/export")
                : pathname.startsWith(item.href);

          return (
            <NextLink
              key={item.label}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isLocked
                  ? "text-default-400 hover:bg-default-100"
                  : isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-default-600 hover:bg-default-100 hover:text-default-900"
              }`}
              href={isLocked ? "/dashboard/pricing" : item.href}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {isLocked && (
                <Chip
                  className="ml-auto"
                  color="warning"
                  size="sm"
                  variant="flat"
                >
                  Pro
                </Chip>
              )}
            </NextLink>
          );
        })}
      </nav>
    </aside>
  );
}
