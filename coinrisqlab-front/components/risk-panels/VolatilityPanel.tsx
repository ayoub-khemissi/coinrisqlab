"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useState } from "react";

import { MethodologyLink } from "./MethodologyLink";

import { RiskPeriod } from "@/types/risk-metrics";
import { useCryptoVolatility } from "@/hooks/useCryptoVolatility";
import { CryptoVolatility, VolatilityPeriod } from "@/types/volatility";

interface VolatilityPanelProps {
  cryptoId: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];
const PERIOD_MAP: Record<RiskPeriod, VolatilityPeriod> = {
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  "365d": "365d",
  all: "all",
};

// Risk zones (annualized) — boundaries match the Volatility methodology
// classification table: Low < 25%, Medium 25-60%, High 60-90%, Extreme ≥ 90%
const RISK_ZONES_ANNUAL = [
  { value: 90, label: "Extreme", color: "#ef4444" },
  { value: 60, label: "High", color: "#f97316" },
  { value: 25, label: "Medium", color: "#eab308" },
];

// Risk zones (daily) — Low < 1.31%, Medium 1.31-3.14%, High 3.14-4.71%, Extreme ≥ 4.71%
const RISK_ZONES_DAILY = [
  { value: 4.71, label: "Extreme", color: "#ef4444" },
  { value: 3.14, label: "High", color: "#f97316" },
  { value: 1.31, label: "Medium", color: "#eab308" },
];

function getRiskLevel(volatility: number, isAnnualized: boolean) {
  // Annualized scale (in %):  <25 low, 25-60 medium, 60-90 high, ≥90 extreme
  // Daily equivalent ≈ annualized / sqrt(365):
  //   25 / 19.10 ≈ 1.31
  //   60 / 19.10 ≈ 3.14
  //   90 / 19.10 ≈ 4.71
  const thresholds = isAnnualized
    ? { low: 25, medium: 60, high: 90 }
    : { low: 1.31, medium: 3.14, high: 4.71 };

  if (volatility >= thresholds.high)
    return { level: "Extreme", color: "#EA3943" };
  if (volatility >= thresholds.medium)
    return { level: "High", color: "#EA580C" };
  if (volatility >= thresholds.low)
    return { level: "Medium", color: "#F3D42F" };

  return { level: "Low", color: "#16C784" };
}

// Volatility delta percentages come from the backend's `changes` object —
// the front never derives them. Missing values surface as "no data".

export function VolatilityPanel({
  cryptoId,
  period,
  onPeriodChange,
}: VolatilityPanelProps) {
  const [mode, setMode] = useState<"annualized" | "daily">("annualized");
  // Fixed period fetch for stable current value & variations (upper card)
  const { data: infoData } = useCryptoVolatility([cryptoId], "90d");
  // Variable period fetch for chart
  const { data, isLoading, error } = useCryptoVolatility(
    [cryptoId],
    PERIOD_MAP[period],
  );

  // Stable data for upper card (always from 90d)
  const infoVolatilityData = infoData[0]?.data;
  const currentVol = infoVolatilityData?.latest;
  const infoHistory = infoVolatilityData?.history || [];

  // Chart data from period-dependent fetch
  const chartVolatilityData = data[0]?.data;
  const chartHistory = chartVolatilityData?.history || [];

  const chartData = chartHistory.map((h) => ({
    date: new Date(h.date).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
    }),
    volatility:
      mode === "annualized"
        ? Number(h.annualized_volatility) * 100
        : Number(h.daily_volatility) * 100,
    fullDate: h.date,
  }));

  const currentVolValue =
    mode === "annualized"
      ? currentVol
        ? Number(currentVol.annualized_volatility) * 100
        : null
      : currentVol
        ? Number(currentVol.daily_volatility) * 100
        : null;

  const riskInfo = currentVolValue
    ? getRiskLevel(currentVolValue, mode === "annualized")
    : null;
  const riskZones =
    mode === "annualized" ? RISK_ZONES_ANNUAL : RISK_ZONES_DAILY;

  const apiChanges = infoVolatilityData?.changes;
  const volatilityChanges: Record<string, number | null> = {
    "24h": apiChanges?.["24h"]?.[mode] ?? null,
    "7d": apiChanges?.["7d"]?.[mode] ?? null,
    "30d": apiChanges?.["30d"]?.[mode] ?? null,
    "90d": apiChanges?.["90d"]?.[mode] ?? null,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Current Volatility Card */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">
                {mode === "annualized" ? "Annualized" : "Daily"} Volatility
              </p>
              <div className="flex items-center gap-3">
                <p className="text-4xl font-bold">
                  {currentVolValue !== null
                    ? `${currentVolValue.toFixed(2)}%`
                    : "N/A"}
                </p>
                {riskInfo && (
                  <Chip
                    size="sm"
                    style={{
                      backgroundColor: `${riskInfo.color}33`,
                      color: riskInfo.color,
                      border: "none",
                    }}
                    variant="flat"
                  >
                    {riskInfo.level} Risk
                  </Chip>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {(["24h", "7d", "30d", "90d"] as const).map((key) => {
                  const change = volatilityChanges[key];
                  const hasValue = typeof change === "number";

                  if (!hasValue) return null;

                  const isPositive = change >= 0;
                  const color: "success" | "danger" | "default" = isPositive
                    ? "success"
                    : "danger";

                  return (
                    <Chip
                      key={key}
                      classNames={{
                        base: "h-7 px-2",
                      }}
                      color={color}
                      size="sm"
                      startContent={
                        change > 0 ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )
                      }
                      variant="flat"
                    >
                      <span className="text-xs opacity-70 mr-1">{key}</span>
                      {change > 0 ? "+" : ""}
                      {change.toFixed(2)}%
                    </Chip>
                  );
                })}
              </div>
              <div className="flex gap-2 sm:justify-end">
                <Button
                  size="sm"
                  variant={mode === "annualized" ? "solid" : "bordered"}
                  onPress={() => setMode("annualized")}
                >
                  Annualized
                </Button>
                <Button
                  size="sm"
                  variant={mode === "daily" ? "solid" : "bordered"}
                  onPress={() => setMode("daily")}
                >
                  Daily
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0 overflow-hidden">
          <h3 className="text-lg font-semibold flex-shrink-0">
            Volatility History
          </h3>
          <div className="flex gap-1 overflow-x-auto flex-nowrap min-w-0 max-w-full">
            {PERIODS.map((p) => (
              <Button
                key={p}
                className="flex-shrink-0"
                isDisabled={isLoading}
                size="sm"
                variant={period === p ? "solid" : "bordered"}
                onPress={() => onPeriodChange(p)}
              >
                {p === "all" ? "All" : p}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardBody className="p-4">
          {error ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-danger">Error loading data</p>
            </div>
          ) : !chartVolatilityData ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-default-500">Loading...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-default-500">No data available</p>
            </div>
          ) : (
            <div
              className="transition-opacity"
              style={{ opacity: isLoading ? 0.5 : 1 }}
            >
              <ResponsiveContainer height={300} width="100%">
                <LineChart data={chartData}>
                  <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    fontSize={12}
                    stroke="#888"
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, "auto"]}
                    fontSize={12}
                    stroke="#888"
                    tickFormatter={(value) => `${value.toFixed(0)}%`}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            <p className="text-sm text-default-500">
                              {new Date(data.fullDate).toLocaleDateString(
                                "fr-FR",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-lg font-semibold">
                              {data.volatility.toFixed(2)}%
                            </p>
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  {/* Risk zone lines */}
                  {riskZones.map((zone) => (
                    <ReferenceLine
                      key={zone.label}
                      stroke={zone.color}
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                      y={zone.value}
                    />
                  ))}
                  <Line
                    activeDot={false}
                    dataKey="volatility"
                    dot={false}
                    isAnimationActive={true}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    type="linear"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {chartVolatilityData && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {chartHistory.length} data points
            </p>
          )}
        </CardBody>
      </Card>

      {/* Risk Levels Legend — boundaries match the methodology table */}
      <Card>
        <CardBody className="p-4">
          <p className="text-sm font-semibold mb-3">Risk Levels</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-sm">
                Low (&lt;{mode === "annualized" ? "25%" : "1.31%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span className="text-sm">
                Medium ({mode === "annualized" ? "25-60%" : "1.31-3.14%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-sm">
                High ({mode === "annualized" ? "60-90%" : "3.14-4.71%"})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-danger" />
              <span className="text-sm">
                Extreme (&gt;{mode === "annualized" ? "90%" : "4.71%"})
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Volatility</strong> measures the degree of variation in an
              asset&apos;s returns over time. It reflects the typical magnitude
              of price fluctuations and therefore represents the level of risk
              or uncertainty associated with the asset&apos;s price movements.
              High volatility indicates larger and more unpredictable price
              swings, whereas low volatility corresponds to smaller and more
              stable price changes.
            </p>
            <MethodologyLink section="volatility" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
