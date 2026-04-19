"use client";

import type { CorrelationMatrix } from "@/types/user";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Skeleton } from "@heroui/skeleton";
import { Button } from "@heroui/button";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Activity, TrendingDown, Shield } from "lucide-react";
import clsx from "clsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell as RechartsCell,
} from "recharts";

import { StressScenarioId, STRESS_SCENARIO_COLORS } from "@/types/risk-metrics";
import { formatCryptoPrice } from "@/lib/formatters";
import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import { ProUpgradeCta } from "@/components/dashboard/analytics/pro-upgrade-cta";

const COLORS = [
  "#FF6B35",
  "#3B82F6",
  "#10B981",
  "#EF4444",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
  "#14B8A6",
];

function getRiskLevel(
  annualizedVol: number,
): "low" | "medium" | "high" | "extreme" {
  if (annualizedVol < 30) return "low";
  if (annualizedVol < 60) return "medium";
  if (annualizedVol < 100) return "high";

  return "extreme";
}

function getRiskLevelColor(level: string): string {
  switch (level) {
    case "low":
      return "text-success";
    case "medium":
      return "text-warning";
    case "high":
      return "text-danger";
    case "extreme":
      return "text-danger";
    default:
      return "";
  }
}

export default function PortfolioAnalyticsPage() {
  const params = useParams();
  const portfolioId = parseInt(params.id as string);
  const { user } = useUserAuth();
  const isPro = user?.plan === "pro";
  const [selectedScenario, setSelectedScenario] = useState<string>("covid-19");
  const [volatilityMode, setVolatilityMode] = useState<"annualized" | "daily">(
    "annualized",
  );

  const [volatility, setVolatility] = useState<any>(null);
  const [riskMetrics, setRiskMetrics] = useState<any>(null);
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(
    null,
  );
  const [stressTest, setStressTest] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const res = await fetch(
          `${API_BASE_URL}/user/portfolios/${portfolioId}/analytics-bundle`,
          { credentials: "include" },
        );
        const json = await res.json();
        const d = json.data;

        if (d) {
          setVolatility(d.volatility);
          setPerformance(d.performance);
          setRiskMetrics(d.riskMetrics);
          setCorrelation(d.correlation);
          setStressTest(d.stressTest);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [portfolioId, isPro]);

  const riskLevel = useMemo(() => {
    if (!volatility?.annualizedVolatility) return null;

    return getRiskLevel(volatility.annualizedVolatility);
  }, [volatility]);

  const riskContributions = useMemo(() => {
    if (!volatility?.constituents) return [];

    return [...volatility.constituents]
      .map((c: any) => ({
        ...c,
        riskContribution:
          c.weight *
          (volatilityMode === "daily"
            ? c.daily_volatility
            : c.annualized_volatility / 100),
      }))
      .sort((a: any, b: any) => b.riskContribution - a.riskContribution);
  }, [volatility, volatilityMode]);

  const volDistributionData = useMemo(() => {
    if (!volatility?.constituents) return [];

    return [...volatility.constituents]
      .sort((a: any, b: any) =>
        volatilityMode === "daily"
          ? b.daily_volatility - a.daily_volatility
          : b.annualized_volatility - a.annualized_volatility,
      )
      .map((c: any) => ({
        name: c.symbol,
        volatility:
          volatilityMode === "daily"
            ? Number((c.daily_volatility * 100).toFixed(3))
            : c.annualized_volatility,
      }));
  }, [volatility, volatilityMode]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
        <Card>
          <CardHeader>
            <Skeleton className="w-48 h-4 rounded-lg" />
          </CardHeader>
          <CardBody>
            <Skeleton className="w-full h-72 rounded-lg" />
          </CardBody>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="gap-2">
                <Skeleton className="w-32 h-3 rounded-lg" />
                <Skeleton className="w-20 h-8 rounded-lg" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio Analytics</h1>

      {/* Performance vs Benchmark */}
      {performance && (
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex justify-between w-full">
              <h3 className="text-sm font-semibold">
                Performance vs CoinRisqLab 80
              </h3>
              <div className="flex gap-2">
                <Chip
                  color={
                    performance.portfolioReturn >= 0 ? "success" : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  Portfolio: {performance.portfolioReturn >= 0 ? "+" : ""}
                  {performance.portfolioReturn}%
                </Chip>
                <Chip
                  color={
                    performance.benchmarkReturn >= 0 ? "success" : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  Index: {performance.benchmarkReturn >= 0 ? "+" : ""}
                  {performance.benchmarkReturn}%
                </Chip>
              </div>
            </div>
            {performance.portfolio24hReturn !== undefined && (
              <div className="flex gap-2 w-full">
                <span className="text-xs text-default-500">24h Rolling:</span>
                <Chip
                  color={
                    (performance.portfolio24hReturn || 0) >= 0
                      ? "success"
                      : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  Portfolio:{" "}
                  {(performance.portfolio24hReturn || 0) >= 0 ? "+" : ""}
                  {performance.portfolio24hReturn || 0}%
                </Chip>
                <Chip
                  color={
                    (performance.benchmark24hReturn || 0) >= 0
                      ? "success"
                      : "danger"
                  }
                  size="sm"
                  variant="flat"
                >
                  Index: {(performance.benchmark24hReturn || 0) >= 0 ? "+" : ""}
                  {performance.benchmark24hReturn || 0}%
                </Chip>
              </div>
            )}
          </CardHeader>
          <CardBody>
            <div className="h-80">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart
                  data={performance.portfolio.map((p: any, i: number) => ({
                    date: p.date,
                    portfolio: p.value,
                    benchmark: performance.benchmark[i]?.value ?? null,
                  }))}
                >
                  <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    fontSize={12}
                    stroke="#6b7280"
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    fontSize={12}
                    stroke="#6b7280"
                    tickFormatter={(v) => `${v.toFixed(0)}`}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const d = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            <p className="text-sm text-default-500 mb-2">
                              {new Date(d.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: "#FF6B35" }}
                                />
                                <span className="text-sm">Portfolio:</span>
                                <span
                                  className="text-sm font-semibold"
                                  style={{ color: "#FF6B35" }}
                                >
                                  {d.portfolio?.toFixed(2)}
                                </span>
                              </div>
                              {d.benchmark != null && (
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: "#3B82F6" }}
                                  />
                                  <span className="text-sm">
                                    CoinRisqLab 80:
                                  </span>
                                  <span
                                    className="text-sm font-semibold"
                                    style={{ color: "#3B82F6" }}
                                  >
                                    {d.benchmark?.toFixed(2)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    activeDot={false}
                    dataKey="portfolio"
                    dot={false}
                    name="Portfolio"
                    stroke="#FF6B35"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Line
                    activeDot={false}
                    dataKey="benchmark"
                    dot={false}
                    name="CoinRisqLab 80"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-default-400 mt-2 text-right">
              Normalized to 100 at start of period
            </p>
          </CardBody>
        </Card>
      )}

      {/* Volatility Section — Market Volatility style */}
      {volatility && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Volatility</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={volatilityMode === "annualized" ? "solid" : "bordered"}
                onPress={() => setVolatilityMode("annualized")}
              >
                Annualized
              </Button>
              <Button
                size="sm"
                variant={volatilityMode === "daily" ? "solid" : "bordered"}
                onPress={() => setVolatilityMode("daily")}
              >
                Daily
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Current Volatility */}
            <Card>
              <CardBody className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="text-primary" size={20} />
                  <h3 className="font-semibold">Current Volatility</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p
                      className={clsx(
                        "text-3xl font-bold",
                        getRiskLevelColor(riskLevel || "low"),
                      )}
                    >
                      {volatilityMode === "daily"
                        ? `${(volatility.dailyVolatility * 100).toFixed(3)}%`
                        : `${volatility.annualizedVolatility}%`}
                    </p>
                    <p className="text-xs text-default-500">
                      {volatilityMode === "daily" ? "Daily" : "Annualized"}
                    </p>
                  </div>
                  {riskLevel && (
                    <div className="pt-2">
                      <Chip
                        color={
                          riskLevel === "low"
                            ? "success"
                            : riskLevel === "medium"
                              ? "warning"
                              : "danger"
                        }
                        size="sm"
                        variant="flat"
                      >
                        {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}{" "}
                        Risk
                      </Chip>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Beta */}
            <Card>
              <CardBody className="p-6">
                <h3 className="font-semibold mb-4">Portfolio Beta</h3>
                <p className="text-3xl font-bold">{volatility.beta}</p>
                <p className="text-xs text-default-400 mt-1">
                  {volatility.beta > 1
                    ? "More volatile than market"
                    : volatility.beta < 1
                      ? "Less volatile than market"
                      : "Market-neutral"}
                </p>
              </CardBody>
            </Card>

            {/* Diversification Benefit */}
            <Card>
              <CardBody className="p-6">
                <h3 className="font-semibold mb-4">Diversification Benefit</h3>
                <p className="text-3xl font-bold">
                  {volatility.diversificationBenefit || 0}%
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1 bg-default-100 rounded-full h-2">
                    <div
                      className="bg-success rounded-full h-2 transition-all"
                      style={{
                        width: `${Math.min(volatility.diversificationBenefit || 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-default-400 mt-1">
                  {volatility.holdingCount} holdings analyzed
                </p>
              </CardBody>
            </Card>
          </div>

          {/* Volatility Distribution */}
          {volDistributionData.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">
                  Volatility Distribution
                </h3>
              </CardHeader>
              <CardBody>
                <div className="h-64 md:h-80">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart
                      data={volDistributionData}
                      margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        fontSize={11}
                        stroke="#6b7280"
                        tickLine={false}
                      />
                      <YAxis
                        fontSize={11}
                        stroke="#6b7280"
                        tickFormatter={(v) => `${v}%`}
                        tickLine={false}
                        width={50}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length > 0) {
                            return (
                              <div className="bg-content1 border border-default-200 rounded-lg px-3 py-2 shadow-lg">
                                <p className="text-sm font-semibold">
                                  {payload[0].payload.name}
                                </p>
                                <p className="text-sm text-default-500">
                                  {payload[0].value}%
                                </p>
                              </div>
                            );
                          }

                          return null;
                        }}
                      />
                      <Bar dataKey="volatility" radius={[4, 4, 0, 0]}>
                        {volDistributionData.map((_: any, index: number) => (
                          <RechartsCell
                            key={index}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Risk Contributors */}
          {riskContributions.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Risk Contributors</h3>
              </CardHeader>
              <CardBody>
                <Table removeWrapper aria-label="Risk contributors">
                  <TableHeader>
                    <TableColumn>Asset</TableColumn>
                    <TableColumn>Weight</TableColumn>
                    <TableColumn>Volatility</TableColumn>
                    <TableColumn>Risk Contribution</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {riskContributions.map((c: any) => (
                      <TableRow key={c.crypto_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {c.image_url && (
                              <img
                                alt={c.symbol}
                                className="w-5 h-5 rounded-full"
                                src={c.image_url}
                              />
                            )}
                            <span className="font-medium">{c.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell>{(c.weight * 100).toFixed(2)}%</TableCell>
                        <TableCell>
                          {volatilityMode === "daily"
                            ? `${(c.daily_volatility * 100).toFixed(3)}%`
                            : `${c.annualized_volatility}%`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-24 bg-default-100 rounded-full h-2">
                              <div
                                className="bg-primary rounded-full h-2"
                                style={{
                                  width: `${Math.min(
                                    (c.riskContribution /
                                      (riskContributions[0]?.riskContribution ||
                                        1)) *
                                      100,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-xs">
                              {(c.riskContribution * 100).toFixed(3)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {/* Pro section */}
      {!isPro ? (
        <ProUpgradeCta
          description="Unlock VaR/CVaR, correlation matrix, stress tests, Sharpe ratio, and diversification analysis."
          feature="Advanced Risk Metrics"
        />
      ) : (
        <>
          {/* Risk Metrics — clean layout */}
          {riskMetrics && (
            <>
              {/* Value at Risk */}
              <Card>
                <CardBody className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Shield className="text-danger" size={20} />
                    <h3 className="font-semibold">Value at Risk</h3>
                    <span className="text-xs text-default-400 ml-auto">
                      {riskMetrics.dataPoints} observations
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: "VaR 95%",
                        value: riskMetrics.var95,
                        desc: "Max daily loss with 95% confidence",
                        tone: "danger",
                      },
                      {
                        label: "VaR 99%",
                        value: riskMetrics.var99,
                        desc: "Max daily loss with 99% confidence",
                        tone: "danger",
                      },
                      {
                        label: "CVaR 95%",
                        value: riskMetrics.cvar95,
                        desc: "Expected loss beyond VaR 95%",
                        tone: "warning",
                      },
                      {
                        label: "CVaR 99%",
                        value: riskMetrics.cvar99,
                        desc: "Expected loss beyond VaR 99%",
                        tone: "warning",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={clsx(
                          "text-center p-4 rounded-xl border",
                          item.tone === "warning"
                            ? "bg-warning/5 border-warning/10"
                            : "bg-danger/5 border-danger/10",
                        )}
                      >
                        <p className="text-xs text-default-500 mb-1">
                          {item.label}
                        </p>
                        <p
                          className={clsx(
                            "text-2xl font-bold",
                            item.tone === "warning"
                              ? "text-warning"
                              : "text-danger",
                          )}
                        >
                          -{item.value}%
                        </p>
                        <p className="text-[10px] text-default-400 mt-1">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Performance Summary — 3 key metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardBody className="p-6 text-center">
                    <p className="text-xs text-default-500 mb-2">
                      Sharpe Ratio
                    </p>
                    <p className="text-4xl font-bold">{riskMetrics.sharpe}</p>
                    <Chip
                      className="mt-2 mx-auto"
                      color={
                        riskMetrics.sharpe > 1
                          ? "success"
                          : riskMetrics.sharpe > 0
                            ? "warning"
                            : "danger"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {riskMetrics.sharpe > 1
                        ? "Good"
                        : riskMetrics.sharpe > 0
                          ? "Moderate"
                          : "Poor"}
                    </Chip>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-6 text-center">
                    <p className="text-xs text-default-500 mb-2">
                      Regression Beta
                    </p>
                    <p className="text-4xl font-bold">
                      {riskMetrics.beta ?? volatility?.beta ?? "—"}
                    </p>
                    <p className="text-xs text-default-400 mt-2">
                      {(riskMetrics.beta ?? volatility?.beta ?? 1) > 1
                        ? "Amplifies market moves"
                        : "Dampens market moves"}
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-6 text-center">
                    <p className="text-xs text-default-500 mb-2">
                      Alpha (annualized)
                    </p>
                    <p
                      className={clsx(
                        "text-4xl font-bold",
                        (riskMetrics.alpha || 0) >= 0
                          ? "text-success"
                          : "text-danger",
                      )}
                    >
                      {(riskMetrics.alpha || 0) >= 0 ? "+" : ""}
                      {riskMetrics.alpha || 0}%
                    </p>
                    <p className="text-xs text-default-400 mt-2">
                      {(riskMetrics.alpha || 0) > 0
                        ? "Outperforming benchmark"
                        : "Underperforming benchmark"}
                    </p>
                  </CardBody>
                </Card>
              </div>

              {/* Return Statistics + Distribution — side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Return Stats */}
                {riskMetrics.returnStats && (
                  <Card>
                    <CardBody className="p-6">
                      <h3 className="font-semibold mb-4">Return Statistics</h3>
                      <div className="space-y-3">
                        {[
                          {
                            label: "Annualized Return",
                            value: `${riskMetrics.returnStats.annualized >= 0 ? "+" : ""}${riskMetrics.returnStats.annualized}%`,
                            color:
                              riskMetrics.returnStats.annualized >= 0
                                ? "text-success"
                                : "text-danger",
                          },
                          {
                            label: "Mean Daily Return",
                            value: `${riskMetrics.returnStats.meanDaily >= 0 ? "+" : ""}${riskMetrics.returnStats.meanDaily}%`,
                            color:
                              riskMetrics.returnStats.meanDaily >= 0
                                ? "text-success"
                                : "text-danger",
                          },
                          {
                            label: "Daily Std Dev",
                            value: `${riskMetrics.returnStats.dailyStd}%`,
                            color: "",
                          },
                          {
                            label: "Best Day",
                            value: `+${riskMetrics.returnStats.max}%`,
                            color: "text-success",
                          },
                          {
                            label: "Worst Day",
                            value: `${riskMetrics.returnStats.min}%`,
                            color: "text-danger",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between py-1 border-b border-default-50 last:border-0"
                          >
                            <span className="text-sm text-default-500">
                              {item.label}
                            </span>
                            <span
                              className={clsx(
                                "text-sm font-semibold",
                                item.color,
                              )}
                            >
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardBody>
                  </Card>
                )}

                {/* Distribution Shape */}
                <Card>
                  <CardBody className="p-6">
                    <h3 className="font-semibold mb-4">Distribution Shape</h3>
                    <div className="space-y-5">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-default-500">
                            Skewness
                          </span>
                          <span className="text-sm font-semibold">
                            {riskMetrics.skewness ?? "—"}
                          </span>
                        </div>
                        <p className="text-xs text-default-400">
                          {(riskMetrics.skewness || 0) < -0.5
                            ? "Negatively skewed — heavier left tail (more extreme losses)"
                            : (riskMetrics.skewness || 0) > 0.5
                              ? "Positively skewed — heavier right tail"
                              : "Approximately symmetric distribution"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-default-500">
                            Excess Kurtosis
                          </span>
                          <span className="text-sm font-semibold">
                            {riskMetrics.kurtosis ?? "—"}
                          </span>
                        </div>
                        <p className="text-xs text-default-400">
                          {(riskMetrics.kurtosis || 0) > 3
                            ? "Leptokurtic — fat tails, higher risk of extreme events"
                            : (riskMetrics.kurtosis || 0) > 0
                              ? "Slightly fat-tailed compared to normal distribution"
                              : "Platykurtic — thin tails, fewer extreme events"}
                        </p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-default-500">
                            Diversification
                          </span>
                          <span className="text-sm font-semibold">
                            {riskMetrics.diversificationBenefit}%
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-default-100 rounded-full h-2">
                            <div
                              className="bg-success rounded-full h-2 transition-all"
                              style={{
                                width: `${Math.min(riskMetrics.diversificationBenefit, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-default-400 mt-1">
                          Volatility reduction from holding multiple assets
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </>
          )}

          {/* Correlation Matrix */}
          {correlation && correlation.symbols.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Correlation Matrix</h3>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="p-2" />
                        {correlation.symbols.map((s) => (
                          <th key={s} className="p-2 font-medium">
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {correlation.symbols.map((s, i) => (
                        <tr key={s}>
                          <td className="p-2 font-medium">{s}</td>
                          {correlation.matrix[i].map((val, j) => {
                            const absVal = Math.abs(val);
                            const bg =
                              i === j
                                ? "bg-default-100"
                                : absVal > 0.7
                                  ? val > 0
                                    ? "bg-danger/20"
                                    : "bg-success/20"
                                  : absVal > 0.4
                                    ? val > 0
                                      ? "bg-warning/10"
                                      : "bg-primary/10"
                                    : "";

                            return (
                              <td key={j} className={`p-2 text-center ${bg}`}>
                                {val.toFixed(2)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Stress Test */}
          {stressTest &&
            (() => {
              const scenarios = stressTest.portfolioScenarios || [];
              const activeScenario =
                scenarios.find((s: any) => s.id === selectedScenario) ||
                scenarios[0];
              const DARK_TEXT_SCENARIOS = [
                "covid-19",
                "china-mining-ban",
                "ust-crash",
              ];
              const totalVal = stressTest.totalValue || 0;
              const stressedValue = activeScenario
                ? activeScenario.newPrice
                : 0;
              const loss = totalVal - stressedValue;
              const lossPercent = totalVal > 0 ? (loss / totalVal) * 100 : 0;

              return (
                <div className="flex flex-col gap-4">
                  <Card>
                    <CardBody className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <p className="text-sm text-default-500 mb-1">
                            Portfolio Value
                          </p>
                          <p className="text-4xl font-bold">
                            {formatCryptoPrice(totalVal)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-default-500 mb-1">
                            Portfolio Beta
                          </p>
                          <Chip
                            color={
                              stressTest.portfolioBeta > 1.5
                                ? "danger"
                                : stressTest.portfolioBeta > 1
                                  ? "warning"
                                  : "success"
                            }
                            size="lg"
                            variant="flat"
                          >
                            {stressTest.portfolioBeta.toFixed(2)}
                          </Chip>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <div>
                        <h3 className="text-lg font-semibold">
                          Historical Scenarios
                        </h3>
                        <p className="text-sm text-default-500">
                          Select a crisis to simulate its impact on your
                          portfolio
                        </p>
                      </div>
                    </CardHeader>
                    <CardBody className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {scenarios.map((s: any) => {
                          const isSelected = selectedScenario === s.id;
                          const color =
                            STRESS_SCENARIO_COLORS[s.id as StressScenarioId] ||
                            "#EA3943";
                          const needsDarkText = DARK_TEXT_SCENARIOS.includes(
                            s.id,
                          );

                          return (
                            <Button
                              key={s.id}
                              className="h-auto py-2 px-4 transition-colors"
                              size="sm"
                              style={{
                                backgroundColor: isSelected
                                  ? color
                                  : "transparent",
                                borderColor: color,
                                color: isSelected
                                  ? needsDarkText
                                    ? "#000"
                                    : "#fff"
                                  : undefined,
                              }}
                              variant="bordered"
                              onPress={() => setSelectedScenario(s.id)}
                            >
                              <span className="flex flex-col items-start">
                                <span className="font-medium">{s.name}</span>
                                <span className="text-xs opacity-75">
                                  {s.marketShock.toFixed(1)}% shock
                                </span>
                              </span>
                            </Button>
                          );
                        })}
                      </div>

                      {activeScenario && (
                        <div
                          className="mt-4 p-4 rounded-lg border-2"
                          style={{
                            borderColor:
                              STRESS_SCENARIO_COLORS[
                                activeScenario.id as StressScenarioId
                              ] || "#EA3943",
                          }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold">
                                {activeScenario.name}
                              </h4>
                              <p className="text-sm text-default-500">
                                {activeScenario.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-center mb-3 p-3 bg-danger-50 dark:bg-danger-50/10 rounded-lg">
                            <p className="text-lg font-semibold text-danger">
                              Market falls{" "}
                              {Math.abs(activeScenario.marketShock).toFixed(1)}%
                              over {activeScenario.durationDays} days
                            </p>
                          </div>
                          <div className="text-center mb-2">
                            <p className="text-sm text-default-500">
                              Beta-adjusted loss for your portfolio:
                            </p>
                          </div>
                          <div className="flex items-center justify-center gap-3 sm:gap-8 py-2">
                            <div className="text-center min-w-0 flex-shrink">
                              <p className="text-xs text-default-500 mb-1">
                                Current
                              </p>
                              <p className="text-lg sm:text-2xl font-bold truncate">
                                {formatCryptoPrice(totalVal)}
                              </p>
                            </div>
                            <TrendingDown
                              className="text-danger flex-shrink-0"
                              size={24}
                            />
                            <div className="text-center min-w-0 flex-shrink">
                              <p className="text-xs text-default-500 mb-1">
                                Stressed
                              </p>
                              <p
                                className="text-lg sm:text-2xl font-bold truncate"
                                style={{
                                  color:
                                    STRESS_SCENARIO_COLORS[
                                      activeScenario.id as StressScenarioId
                                    ] || "#EA3943",
                                }}
                              >
                                {formatCryptoPrice(stressedValue)}
                              </p>
                            </div>
                          </div>
                          <div className="text-center mt-2">
                            <Chip color="danger" size="lg" variant="flat">
                              {lossPercent.toFixed(2)}% loss (
                              {formatCryptoPrice(loss)})
                            </Chip>
                          </div>
                        </div>
                      )}
                    </CardBody>
                  </Card>
                </div>
              );
            })()}
        </>
      )}
    </div>
  );
}
