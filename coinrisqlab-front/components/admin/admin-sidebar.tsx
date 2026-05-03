"use client";

import { useState } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import {
  Newspaper,
  LayoutDashboard,
  Database,
  ChevronDown,
  ChevronRight,
  DollarSign,
  TrendingUp,
  Activity,
  Shield,
  BarChart3,
  Percent,
  GitCompare,
  LineChart,
  Briefcase,
  TrendingDown,
  Gauge,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "Dashboard", href: "", icon: LayoutDashboard },
  { key: "News", href: "/news", icon: Newspaper },
];

const DATA_NAV_ITEMS = [
  { key: "Prices", href: "/data/prices", icon: DollarSign },
  { key: "Log Returns", href: "/data/log-returns", icon: TrendingUp },
  { key: "Simple Returns", href: "/data/simple-returns", icon: TrendingUp },
  { key: "Volatility", href: "/data/volatility", icon: Activity },
  { key: "MA 90d", href: "/data/ma-90d", icon: TrendingDown },
  { key: "RSI 14d", href: "/data/rsi-14d", icon: Gauge },
  { key: "VaR / CVaR", href: "/data/var", icon: Shield },
  { key: "Beta / SML", href: "/data/beta-sml", icon: BarChart3 },
  { key: "Distribution", href: "/data/distribution", icon: LineChart },
  { key: "Sharpe", href: "/data/sharpe", icon: Percent },
  { key: "Correlation", href: "/data/correlation", icon: GitCompare },
  { key: "Index", href: "/data/index", icon: LineChart },
  { key: "Portfolio", href: "/data/portfolio-analytics", icon: Briefcase },
  { key: "Portfolio Holdings", href: "/data/portfolio-constituents", icon: Briefcase },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const basePath = "/admin";
  const isDataSection = pathname.startsWith(`${basePath}/data`);
  const [dataOpen, setDataOpen] = useState(isDataSection);

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

          {/* Data Validation section */}
          <li>
            <button
              className={`flex items-center justify-between w-full gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isDataSection
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-default-500 hover:text-foreground hover:bg-default-100"
              }`}
              type="button"
              onClick={() => setDataOpen(!dataOpen)}
            >
              <span className="flex items-center gap-3">
                <Database size={18} />
                <span>Data Validation</span>
              </span>
              {dataOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>

            {dataOpen && (
              <ul className="mt-1 ml-4 space-y-0.5">
                {DATA_NAV_ITEMS.map((item) => {
                  const href = `${basePath}${item.href}`;
                  const isActive = pathname === href;
                  const Icon = item.icon;

                  return (
                    <li key={item.key}>
                      <NextLink
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? "text-primary bg-primary/5"
                            : "text-default-400 hover:text-foreground hover:bg-default-100"
                        }`}
                        href={href}
                      >
                        <Icon size={14} />
                        <span>{item.key}</span>
                      </NextLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        </ul>
      </nav>
    </aside>
  );
}
