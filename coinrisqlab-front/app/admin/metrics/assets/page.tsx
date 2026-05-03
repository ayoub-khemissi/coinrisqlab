"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";

import { KpiCard } from "@/components/admin/metrics/kpi-card";

interface AssetsData {
  counts: Record<string, number>;
  depthDistribution: Record<string, number>;
  topHeld: Array<{
    symbol: string;
    name: string;
    portfolios_holding: number;
    aum_usd: number;
  }>;
  indexNow: {
    index_level: number;
    total_market_cap_usd: number;
    number_of_constituents: number;
    timestamp: string;
  } | null;
}

const fmtN = (n: number | undefined) =>
  n != null ? Number(n).toLocaleString("en-US") : "—";
const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export default function MetricsAssetsPage() {
  const [data, setData] = useState<AssetsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics/assets")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Metrics — Assets</h1>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  if (!data) return <p>Failed to load.</p>;
  const c = data.counts;
  const d = data.depthDistribution;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Metrics — Assets</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Coverage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Cryptocurrencies (DB)" value={fmtN(c.total_cryptos)} />
          <KpiCard
            label="In market_data"
            value={fmtN(c.in_market_data)}
            hint="At least one snapshot"
          />
          <KpiCard label="In OHLC" value={fmtN(c.in_ohlc)} />
          <KpiCard
            label="In CoinRisqLab 80"
            value={fmtN(c.in_latest_index)}
            tone="primary"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Risk metrics coverage
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Log returns" value={fmtN(c.in_log_returns)} />
          <KpiCard
            label="Simple returns"
            value={fmtN(c.in_simple_returns)}
          />
          <KpiCard label="Volatility (90d)" value={fmtN(c.with_vol_90)} />
          <KpiCard label="Distribution (90d)" value={fmtN(c.with_distribution)} />
          <KpiCard label="VaR (365d)" value={fmtN(c.with_var_365)} />
          <KpiCard label="Sharpe (365d)" value={fmtN(c.with_sharpe_365)} />
          <KpiCard label="Moving Average (90d)" value={fmtN(c.with_ma_90)} />
          <KpiCard label="RSI (14d)" value={fmtN(c.with_rsi_14)} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          OHLC depth distribution
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <KpiCard label="≥ 365 days" value={fmtN(d.over_365d)} tone="success" />
          <KpiCard label="180–364" value={fmtN(d.d_180_365)} />
          <KpiCard label="90–179" value={fmtN(d.d_90_180)} />
          <KpiCard label="30–89" value={fmtN(d.d_30_90)} tone="warning" />
          <KpiCard label="< 30 days" value={fmtN(d.under_30d)} tone="danger" />
        </div>
      </section>

      {data.indexNow && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
            CoinRisqLab 80 — current snapshot
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard
              label="Index level"
              value={Number(data.indexNow.index_level).toFixed(2)}
              tone="primary"
            />
            <KpiCard
              label="Total market cap"
              value={fmtUsd(Number(data.indexNow.total_market_cap_usd))}
            />
            <KpiCard
              label="Constituents"
              value={fmtN(data.indexNow.number_of_constituents)}
            />
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Most-held cryptos in user portfolios</h3>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Top held">
            <TableHeader>
              <TableColumn>Symbol</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>Portfolios holding</TableColumn>
              <TableColumn>AUM</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No data">
              {data.topHeld.map((row) => (
                <TableRow key={row.symbol}>
                  <TableCell>{row.symbol}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{fmtN(row.portfolios_holding)}</TableCell>
                  <TableCell>{fmtUsd(Number(row.aum_usd))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
