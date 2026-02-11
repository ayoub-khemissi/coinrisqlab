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
} from "recharts";

import { LivePriceDisplay } from "./LivePriceDisplay";

import { usePriceHistory } from "@/hooks/useRiskMetrics";
import { RiskPeriod } from "@/types/risk-metrics";
import {
  formatCryptoPrice,
  formatPercentage,
  getPercentageColor,
} from "@/lib/formatters";

interface PricePanelProps {
  symbol: string;
  period: RiskPeriod;
  onPeriodChange: (period: RiskPeriod) => void;
}

const PERIODS: RiskPeriod[] = ["7d", "30d", "90d", "all"];

// Helper to calculate changes from history (for 90d which might be missing from current.changes)
function calculatePriceChanges(
  history: { date: string; price: number }[],
  currentPrice: number,
): Record<string, number | null> {
  if (!currentPrice || history.length === 0) return {};

  const changes: Record<string, number | null> = {};
  const periods = {
    "90d": 90,
  };

  const targetDate = new Date();

  for (const [key, days] of Object.entries(periods)) {
    const pastTargetDate = new Date(targetDate);

    pastTargetDate.setDate(pastTargetDate.getDate() - days);

    // Find closest entry
    let closestEntry: { date: string; price: number } | null = null;
    let minDiff = Infinity;

    for (const entry of history) {
      const entryDate = new Date(entry.date);
      const diff = Math.abs(entryDate.getTime() - pastTargetDate.getTime());

      if (diff < minDiff) {
        minDiff = diff;
        closestEntry = entry;
      }
    }

    if (closestEntry) {
      // Tolerance check (2 days)
      if (minDiff <= 2 * 24 * 60 * 60 * 1000) {
        const pastValue = closestEntry.price;

        if (pastValue !== 0) {
          changes[key] = ((currentPrice - pastValue) / pastValue) * 100;
        } else {
          changes[key] = null;
        }
      } else {
        changes[key] = null;
      }
    } else {
      changes[key] = null;
    }
  }

  return changes;
}

export function PricePanel({
  symbol,
  period,
  onPeriodChange,
}: PricePanelProps) {
  const { data, isLoading, error } = usePriceHistory(symbol, period);

  const currentPrice = data?.current?.price ?? 0;

  const chartData =
    data?.prices.map((p, index) => ({
      index,
      timestamp: new Date(p.date).getTime(),
      dateLabel: new Date(p.date).toLocaleDateString("fr-FR", {
        month: "short",
        day: "numeric",
      }),
      price: p.price,
      fullDateTime: new Date(p.date).toLocaleString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })) || [];

  // Calculate extra changes (90d)
  const history = data?.prices || [];
  const computedChanges = calculatePriceChanges(history, currentPrice);

  // Merge API changes with computed changes
  const displayChanges: Record<string, number | null> = {
    ...data?.current?.changes,
    ...computedChanges,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Current Price Card */}
      {(data?.current || currentPrice > 0) && (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-default-500 mb-1">
                  {symbol.toUpperCase()} Price
                </p>
                <div className="flex items-center gap-3">
                  <LivePriceDisplay
                    initialPrice={currentPrice}
                    symbol={symbol}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["24h", "7d", "30d", "90d"] as const).map((key) => {
                  const change = displayChanges[key];
                  const hasValue = typeof change === "number";

                  if (!hasValue) return null;

                  const isPositive = change > 0;
                  const color = getPercentageColor(change);

                  return (
                    <Chip
                      key={key}
                      classNames={{
                        base: "h-7 px-2",
                      }}
                      color={color}
                      size="sm"
                      startContent={
                        isPositive ? (
                          <TrendingUp size={12} />
                        ) : (
                          <TrendingDown size={12} />
                        )
                      }
                      variant="flat"
                    >
                      <span className="text-xs opacity-70 mr-1">{key}</span>
                      {formatPercentage(change)}
                    </Chip>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <h3 className="text-lg font-semibold">Price History</h3>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p}
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
          ) : !data ? (
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
                    dataKey="timestamp"
                    fontSize={12}
                    stroke="#888"
                    tickFormatter={(value) => {
                      const date = new Date(value);

                      return date.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      });
                    }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    fontSize={12}
                    stroke="#888"
                    tickFormatter={(value) => formatCryptoPrice(value)}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            <p className="text-sm text-default-500">
                              {data.fullDateTime}
                            </p>
                            <p className="text-lg font-semibold">
                              {formatCryptoPrice(data.price)}
                            </p>
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  <Line
                    activeDot={false}
                    dataKey="price"
                    dot={false}
                    isAnimationActive={true}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    type="linear"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {data && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {data.dataPoints} data points
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
