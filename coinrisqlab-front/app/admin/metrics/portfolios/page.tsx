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

interface PortfoliosData {
  totals: Record<string, number>;
  aum_usd: number;
  portfoliosPerUser: Array<{ n_portfolios: number; users: number }>;
  holdingsPerPortfolio: Array<{ n_holdings: number; portfolios: number }>;
  topPortfolios: Array<{
    id: number;
    name: string;
    email: string;
    holdings: number;
    aum_usd: number;
  }>;
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

export default function MetricsPortfoliosPage() {
  const [data, setData] = useState<PortfoliosData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics/portfolios")
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold">Metrics — Portfolios</h1>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  if (!data) return <p>Failed to load.</p>;
  const t = data.totals;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Metrics — Portfolios</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-default-500 uppercase tracking-wide">
          Portfolios
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total portfolios" value={fmtN(t.total_portfolios)} />
          <KpiCard
            label="Users with a portfolio"
            value={fmtN(t.users_with_portfolio)}
          />
          <KpiCard
            label="Total holdings"
            value={fmtN(t.total_holdings)}
            hint={`${fmtN(t.unique_cryptos_held)} unique cryptos`}
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
          Transactions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Total" value={fmtN(t.total_transactions)} />
          <KpiCard label="Buys" value={fmtN(t.buys)} tone="success" />
          <KpiCard label="Sells" value={fmtN(t.sells)} tone="danger" />
          <KpiCard label="Transfers" value={fmtN(t.transfers)} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Portfolios per user</h3>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Portfolios per user">
              <TableHeader>
                <TableColumn># portfolios</TableColumn>
                <TableColumn># users</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No data">
                {data.portfoliosPerUser.map((row) => (
                  <TableRow key={row.n_portfolios}>
                    <TableCell>{row.n_portfolios}</TableCell>
                    <TableCell>{fmtN(row.users)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold">Holdings per portfolio</h3>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Holdings per portfolio">
              <TableHeader>
                <TableColumn># holdings</TableColumn>
                <TableColumn># portfolios</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No data">
                {data.holdingsPerPortfolio.map((row) => (
                  <TableRow key={row.n_holdings}>
                    <TableCell>{row.n_holdings}</TableCell>
                    <TableCell>{fmtN(row.portfolios)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Top portfolios by AUM</h3>
        </CardHeader>
        <CardBody>
          <Table removeWrapper aria-label="Top portfolios">
            <TableHeader>
              <TableColumn>ID</TableColumn>
              <TableColumn>Name</TableColumn>
              <TableColumn>User</TableColumn>
              <TableColumn>Holdings</TableColumn>
              <TableColumn>AUM</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No data">
              {data.topPortfolios.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.id}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{fmtN(p.holdings)}</TableCell>
                  <TableCell>{fmtUsd(Number(p.aum_usd))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
