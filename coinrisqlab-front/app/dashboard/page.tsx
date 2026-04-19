"use client";

import type { Portfolio, Holding } from "@/types/user";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Skeleton } from "@heroui/skeleton";
import NextLink from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  BarChart3,
  Download,
  Lock,
} from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

export default function DashboardPage() {
  const { user } = useUserAuth();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [fearGreed, setFearGreed] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch portfolios
        const pRes = await fetch(`${API_BASE_URL}/user/portfolios`, {
          credentials: "include",
        });
        const pData = await pRes.json();
        const portfolioList: Portfolio[] = pData.data || [];

        setPortfolios(portfolioList);

        // Fetch holdings for first portfolio
        if (portfolioList.length > 0) {
          const hRes = await fetch(
            `${API_BASE_URL}/user/portfolios/${portfolioList[0].id}/holdings`,
            { credentials: "include" },
          );
          const hData = await hRes.json();

          setHoldings(hData.data || []);
          setTotalValue(hData.totalValue || 0);

          const pnl = (hData.data || []).reduce(
            (sum: number, h: Holding) => sum + (h.unrealized_pnl || 0),
            0,
          );

          setTotalPnl(pnl);
        }

        // Fetch fear & greed
        const mRes = await fetch(`${API_BASE_URL}/metrics`);
        const mData = await mRes.json();

        if (mData.data?.fearAndGreed?.[0]) {
          setFearGreed(mData.data.fearAndGreed[0].value);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-64 h-8 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody className="gap-2">
                <Skeleton className="w-24 h-3 rounded-lg" />
                <Skeleton className="w-32 h-8 rounded-lg" />
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="w-40 h-4 rounded-lg" />
              </CardHeader>
              <CardBody className="gap-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="w-full h-5 rounded-lg" />
                ))}
              </CardBody>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="w-28 h-4 rounded-lg" />
          </CardHeader>
          <CardBody className="flex flex-row gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-32 h-8 rounded-lg" />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  // Top 3 performers (by 24h change)
  const topPerformers = [...holdings]
    .sort((a, b) => (b.percent_change_24h || 0) - (a.percent_change_24h || 0))
    .slice(0, 3);

  const worstPerformers = [...holdings]
    .sort((a, b) => (a.percent_change_24h || 0) - (b.percent_change_24h || 0))
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Welcome{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
      </div>

      {/* Main metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="gap-1">
            <p className="text-sm text-default-500">Portfolio Value</p>
            <p className="text-2xl font-bold">
              $
              {totalValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-1">
            <p className="text-sm text-default-500">Total PnL</p>
            <div className="flex items-center gap-2">
              <p
                className={`text-2xl font-bold ${totalPnl >= 0 ? "text-success" : "text-danger"}`}
              >
                {totalPnl >= 0 ? "+" : ""}$
                {Math.abs(totalPnl).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              {totalPnl >= 0 ? (
                <TrendingUp className="text-success" size={20} />
              ) : (
                <TrendingDown className="text-danger" size={20} />
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-1">
            <p className="text-sm text-default-500">Holdings</p>
            <p className="text-2xl font-bold">{holdings.length}</p>
            <p className="text-xs text-default-400">
              across {portfolios.length} portfolio
              {portfolios.length !== 1 ? "s" : ""}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="gap-1">
            <p className="text-sm text-default-500">Fear & Greed</p>
            <p className="text-2xl font-bold">
              {fearGreed !== null ? fearGreed : "—"}
            </p>
            <p className="text-xs text-default-400">
              {fearGreed !== null
                ? fearGreed <= 25
                  ? "Extreme Fear"
                  : fearGreed <= 45
                    ? "Fear"
                    : fearGreed <= 55
                      ? "Neutral"
                      : fearGreed <= 75
                        ? "Greed"
                        : "Extreme Greed"
                : ""}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Top/Worst performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="text-success" size={16} />
              Top Performers (24h)
            </h3>
          </CardHeader>
          <CardBody className="gap-2 pt-0">
            {topPerformers.length === 0 ? (
              <p className="text-sm text-default-400">No holdings yet</p>
            ) : (
              topPerformers.map((h) => (
                <div
                  key={h.crypto_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {h.image_url && (
                      <img
                        alt={h.symbol}
                        className="w-5 h-5 rounded-full"
                        src={h.image_url}
                      />
                    )}
                    <span className="text-sm font-medium">{h.symbol}</span>
                  </div>
                  <Chip
                    color={
                      (h.percent_change_24h || 0) >= 0 ? "success" : "danger"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {(h.percent_change_24h || 0) >= 0 ? "+" : ""}
                    {(h.percent_change_24h || 0).toFixed(2)}%
                  </Chip>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingDown className="text-danger" size={16} />
              Worst Performers (24h)
            </h3>
          </CardHeader>
          <CardBody className="gap-2 pt-0">
            {worstPerformers.length === 0 ? (
              <p className="text-sm text-default-400">No holdings yet</p>
            ) : (
              worstPerformers.map((h) => (
                <div
                  key={h.crypto_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {h.image_url && (
                      <img
                        alt={h.symbol}
                        className="w-5 h-5 rounded-full"
                        src={h.image_url}
                      />
                    )}
                    <span className="text-sm font-medium">{h.symbol}</span>
                  </div>
                  <Chip
                    color={
                      (h.percent_change_24h || 0) >= 0 ? "success" : "danger"
                    }
                    size="sm"
                    variant="flat"
                  >
                    {(h.percent_change_24h || 0) >= 0 ? "+" : ""}
                    {(h.percent_change_24h || 0).toFixed(2)}%
                  </Chip>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold">Quick Actions</h3>
        </CardHeader>
        <CardBody className="flex flex-row flex-wrap gap-3">
          <Button
            as={NextLink}
            href="/dashboard/portfolios"
            size="sm"
            startContent={<Plus size={16} />}
            variant="flat"
          >
            Manage Holdings
          </Button>
          <Button
            as={NextLink}
            href={
              user?.plan === "pro"
                ? "/dashboard/portfolios"
                : "/dashboard/pricing"
            }
            size="sm"
            startContent={<BarChart3 size={16} />}
            variant="flat"
          >
            View Analytics
            {user?.plan !== "pro" && <Lock className="ml-1" size={12} />}
          </Button>
          <Button
            as={NextLink}
            href={
              user?.plan === "pro"
                ? "/dashboard/portfolios"
                : "/dashboard/pricing"
            }
            size="sm"
            startContent={<Download size={16} />}
            variant="flat"
          >
            Export Report
            {user?.plan !== "pro" && <Lock className="ml-1" size={12} />}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
