"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import { Chip } from "@heroui/chip";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Bell,
  FileText,
  Settings,
  CreditCard,
  ChevronDown,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

interface SidebarPortfolio {
  id: number;
  name: string;
}

const staticNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolios", href: "/dashboard/portfolios", icon: Briefcase },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { label: "Pricing", href: "/dashboard/pricing", icon: CreditCard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function DashboardSidebar({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUserAuth();
  const [portfolios, setPortfolios] = useState<SidebarPortfolio[]>([]);

  useEffect(() => {
    async function fetchPortfolios() {
      try {
        const res = await fetch(`${API_BASE_URL}/user/portfolios`, {
          credentials: "include",
        });
        const data = await res.json();

        if (Array.isArray(data.data)) {
          setPortfolios(
            data.data.map((p: SidebarPortfolio) => ({
              id: p.id,
              name: p.name,
            })),
          );
        }
      } catch {
        // ignore
      }
    }

    fetchPortfolios();

    // Refresh the list whenever a CRUD page broadcasts a change. This avoids
    // a stale sidebar when a user creates/deletes a portfolio without
    // navigating (or before the route transitions).
    const handler = () => fetchPortfolios();

    window.addEventListener("portfolios:changed", handler);

    return () => window.removeEventListener("portfolios:changed", handler);
  }, [pathname]);

  const analyticsHref =
    portfolios.length > 0
      ? `/dashboard/portfolios/${portfolios[0].id}/analytics`
      : "/dashboard/portfolios";

  const navItems = [
    staticNavItems[0], // Dashboard
    staticNavItems[1], // Portfolios
    {
      label: "Analytics",
      href: analyticsHref,
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

  const isActiveItem = (item: (typeof navItems)[number]) => {
    const activeMatch = "activeMatch" in item ? item.activeMatch : null;

    if (activeMatch) return pathname.includes(activeMatch as string);
    if (item.href === "/dashboard") return pathname === "/dashboard";
    if (item.href === "/dashboard/portfolios") {
      return (
        pathname.startsWith("/dashboard/portfolios") &&
        !pathname.includes("/analytics") &&
        !pathname.includes("/export")
      );
    }

    return pathname.startsWith(item.href);
  };

  const handlePortfolioAnalyticsSelect = (portfolioId: number) => {
    router.push(`/dashboard/portfolios/${portfolioId}/analytics`);
  };

  if (mobile) {
    const mobileItems = navItems.slice(0, 4);

    return (
      <nav className="flex items-center justify-around border-t border-default-200 bg-background py-2 px-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isPro = "pro" in item && item.pro;
          const isLocked = isPro && user?.plan !== "pro";
          const isActive = isActiveItem(item);
          const isAnalytics = item.label === "Analytics";
          const showDropdown =
            isAnalytics && !isLocked && portfolios.length > 1;

          const baseClass = `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors ${
            isLocked
              ? "text-default-400"
              : isActive
                ? "text-primary"
                : "text-default-500 hover:text-default-700"
          }`;

          if (showDropdown) {
            return (
              <Dropdown key={item.label} placement="top">
                <DropdownTrigger>
                  <button className={baseClass} type="button">
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Select portfolio for analytics"
                  onAction={(key) =>
                    handlePortfolioAnalyticsSelect(Number(key))
                  }
                >
                  {portfolios.map((p) => (
                    <DropdownItem key={String(p.id)}>{p.name}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            );
          }

          return (
            <NextLink
              key={item.label}
              className={baseClass}
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
          const isActive = isActiveItem(item);
          const isAnalytics = item.label === "Analytics";
          const showDropdown =
            isAnalytics && !isLocked && portfolios.length > 1;

          const baseClass = `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isLocked
              ? "text-default-400 hover:bg-default-100"
              : isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-default-600 hover:bg-default-100 hover:text-default-900"
          }`;

          if (showDropdown) {
            return (
              <Dropdown key={item.label} placement="right-start">
                <DropdownTrigger>
                  <button
                    className={`${baseClass} w-full text-left`}
                    type="button"
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    <ChevronDown className="ml-auto" size={14} />
                  </button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Select portfolio for analytics"
                  onAction={(key) =>
                    handlePortfolioAnalyticsSelect(Number(key))
                  }
                >
                  {portfolios.map((p) => (
                    <DropdownItem key={String(p.id)}>{p.name}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            );
          }

          return (
            <NextLink
              key={item.label}
              className={baseClass}
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
