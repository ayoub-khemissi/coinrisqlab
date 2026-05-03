"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@heroui/skeleton";

import { KpiCard } from "@/components/admin/metrics/kpi-card";

interface Overview {
  users: { total: number; pro: number; new_7d: number; active_7d: number };
  portfolios: { total: number; users_with_portfolio: number };
  holdings: { total_holdings: number; unique_cryptos: number };
  aum_usd: number;
  assets: { total: number; tracked: number; in_index: number };
  transactions: { total: number };
}

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

const fmtN = (n: number | undefined) =>
  n != null ? Number(n).toLocaleString("en-US") : "—";

export default function AdminMetricsOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics/overview")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Metrics — Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Metrics — Overview</h1>
        <p className="text-default-500">Failed to load metrics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Metrics — Overview</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Users
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total users" value={fmtN(data.users.total)} />
          <KpiCard
            label="Pro users"
            value={fmtN(data.users.pro)}
            hint={`${data.users.total > 0 ? ((data.users.pro / data.users.total) * 100).toFixed(1) : 0}% conversion`}
            tone="primary"
          />
          <KpiCard
            label="New (7d)"
            value={fmtN(data.users.new_7d)}
            tone="success"
          />
          <KpiCard
            label="Active (7d)"
            value={fmtN(data.users.active_7d)}
            hint="Logged in last 7 days"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Portfolios &amp; Holdings
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total portfolios"
            value={fmtN(data.portfolios.total)}
          />
          <KpiCard
            label="Users with a portfolio"
            value={fmtN(data.portfolios.users_with_portfolio)}
          />
          <KpiCard
            label="Total holdings"
            value={fmtN(data.holdings.total_holdings)}
            hint={`${fmtN(data.holdings.unique_cryptos)} unique cryptos`}
          />
          <KpiCard
            label="Total AUM"
            value={fmtUsd(data.aum_usd)}
            tone="success"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Assets &amp; Activity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Cryptocurrencies in DB"
            value={fmtN(data.assets.total)}
          />
          <KpiCard
            label="Tracked (market_data)"
            value={fmtN(data.assets.tracked)}
          />
          <KpiCard
            label="In CoinRisqLab 80"
            value={fmtN(data.assets.in_index)}
            tone="primary"
          />
          <KpiCard
            label="Transactions logged"
            value={fmtN(data.transactions.total)}
          />
        </div>
      </section>
    </div>
  );
}
