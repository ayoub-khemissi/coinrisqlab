"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { AlertTriangle } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useState, useMemo } from "react";

import { MethodologyLink } from "./MethodologyLink";

import { useVaR } from "@/hooks/useRiskMetrics";
import { useCryptoVolatility } from "@/hooks/useCryptoVolatility";

interface VaRPanelProps {
  symbol: string;
}

// Gaussian PDF function
function gaussianPDF(x: number, mean: number, stdDev: number): number {
  const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));

  return coefficient * Math.exp(exponent);
}

export function VaRPanel({ symbol }: VaRPanelProps) {
  const { data, isLoading, error } = useVaR(symbol, "365d");
  const { data: volatilityData } = useCryptoVolatility([symbol], "all");
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const dailyVolatility = volatilityData[0]?.data?.latest
    ? Number(volatilityData[0].data.latest.daily_volatility) * 100
    : null;

  const chartData = useMemo(() => {
    if (!data?.histogram) return [];

    const histogram = data.histogram;
    const stats = data.statistics;

    // Calculate total count and bin width for scaling
    const totalCount = histogram.reduce((sum, bin) => sum + bin.count, 0);
    const binWidth =
      histogram.length > 0 ? histogram[0].binEnd - histogram[0].binStart : 1;

    return histogram.map((bin) => {
      let normalCount = 0;

      if (stats && stats.stdDev > 0) {
        // Calculate the Gaussian PDF value and scale it to match histogram
        const pdfValue = gaussianPDF(bin.binCenter, stats.mean, stats.stdDev);

        normalCount = pdfValue * totalCount * binWidth;
      }

      return {
        x: bin.binCenter,
        count: bin.count,
        normalCount,
        percentage: bin.percentage,
        range: `${bin.binStart.toFixed(2)}% to ${bin.binEnd.toFixed(2)}%`,
      };
    });
  }, [data?.histogram, data?.statistics]);

  return (
    <div className="flex flex-col gap-4">
      {/* VaR Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">VaR 95%</p>
              <p className="text-3xl font-bold text-danger">
                {data?.var95 != null ? `-${data.var95.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Daily loss won&apos;t exceed this 95% of the time
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">VaR 99%</p>
              <p className="text-3xl font-bold text-danger">
                {data?.var99 != null ? `-${data.var99.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Daily loss won&apos;t exceed this 99% of the time
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">CVaR 95%</p>
              <p className="text-2xl font-bold text-warning">
                {data?.cvar95 != null ? `-${data.cvar95.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Expected loss when VaR is exceeded
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">CVaR 99%</p>
              <p className="text-2xl font-bold text-warning">
                {data?.cvar99 != null ? `-${data.cvar99.toFixed(2)}%` : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Expected Shortfall at 99%
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Returns Distribution</h3>
              {data && data.dataPoints < 365 && (
                <Tooltip
                  content={
                    <div className="p-2 max-w-xs">
                      <div className="font-semibold mb-1">
                        Less Than 1 Year of Data
                      </div>
                      <div className="text-tiny">
                        Only {data.dataPoints} days of historical data
                        available. VaR calculations are more reliable with at
                        least 365 days of data.
                      </div>
                    </div>
                  }
                  isOpen={isTooltipOpen}
                >
                  <AlertTriangle
                    className="text-warning cursor-help"
                    size={18}
                    onClick={() => setIsTooltipOpen(!isTooltipOpen)}
                    onMouseLeave={() => setIsTooltipOpen(false)}
                    onMouseOver={() => setIsTooltipOpen(true)}
                  />
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-default-500">
              Histogram of daily log returns
            </p>
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
                <ComposedChart data={chartData}>
                  <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    fontSize={12}
                    stroke="#888"
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    tickLine={false}
                  />
                  <YAxis
                    fontSize={12}
                    stroke="#888"
                    tickLine={false}
                    width={40}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const d = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            <p className="text-sm text-default-500">
                              {d.range}
                            </p>
                            <p className="text-sm">
                              <span className="text-primary">Actual:</span>{" "}
                              {d.count} days ({d.percentage.toFixed(1)}%)
                            </p>
                            {d.normalCount > 0 && (
                              <p className="text-sm">
                                <span className="text-warning">Normal:</span>{" "}
                                {d.normalCount.toFixed(1)} days
                              </p>
                            )}
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  {/* VaR 95% line */}
                  {data?.var95 && (
                    <ReferenceLine
                      label={{
                        value: "VaR 95%",
                        position: "top",
                        fill: "#ef4444",
                        fontSize: 12,
                      }}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      x={-data.var95}
                    />
                  )}
                  {/* VaR 99% line */}
                  {data?.var99 && (
                    <ReferenceLine
                      label={{
                        value: "VaR 99%",
                        position: "top",
                        fill: "#dc2626",
                        fontSize: 12,
                      }}
                      stroke="#dc2626"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      x={-data.var99}
                    />
                  )}
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    activeDot={false}
                    dataKey="normalCount"
                    dot={false}
                    name="Normal Distribution"
                    stroke="#f97316"
                    strokeWidth={2}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {data && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {data.dataPoints} observations
            </p>
          )}
        </CardBody>
      </Card>

      {/* Statistics Card */}
      {data?.statistics && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Return Statistics</h3>
          </CardHeader>
          <CardBody className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-default-500">Mean Return</p>
                <Chip
                  color={data.statistics.mean >= 0 ? "success" : "danger"}
                  variant="flat"
                >
                  {data.statistics.mean >= 0 ? "+" : ""}
                  {data.statistics.mean.toFixed(4)}%
                </Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Std Deviation</p>
                <Chip variant="flat">
                  {dailyVolatility != null
                    ? `${dailyVolatility.toFixed(2)}%`
                    : "N/A"}
                </Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Min Return</p>
                <Chip color="danger" variant="flat">
                  {data.statistics.min.toFixed(4)}%
                </Chip>
              </div>
              <div>
                <p className="text-sm text-default-500">Max Return</p>
                <Chip color="success" variant="flat">
                  +{data.statistics.max.toFixed(4)}%
                </Chip>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Value at Risk (VaR)</strong> estimates the maximum
              potential loss over a given period at a specific confidence level.
              A VaR 95% of {data?.var95?.toFixed(2)}% means there&apos;s only a
              5% chance of losing more than this amount in a single day.{" "}
              <strong>CVaR (Expected Shortfall)</strong> measures the average
              loss when the VaR threshold is exceeded.
            </p>
            <MethodologyLink section="var" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
