"use client";

import { useMemo } from "react";
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
} from "recharts";

import { MethodologyLink } from "./MethodologyLink";

import { useDistribution } from "@/hooks/useRiskMetrics";
import { useCryptoVolatility } from "@/hooks/useCryptoVolatility";
import { getKurtosisInterpretation } from "@/types/risk-metrics";

// Gaussian PDF function
function gaussianPDF(x: number, mean: number, stdDev: number): number {
  const coefficient = 1 / (stdDev * Math.sqrt(2 * Math.PI));
  const exponent = -Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2));

  return coefficient * Math.exp(exponent);
}

export function KurtosisPanel({ symbol }: { symbol: string }) {
  // Hardcoded to 90d as per requirements
  const { data, isLoading, error } = useDistribution(symbol, "90d");
  const { data: volatilityData } = useCryptoVolatility([symbol], "90d");

  const dailyVolatility = volatilityData[0]?.data?.latest
    ? Number(volatilityData[0].data.latest.daily_volatility) * 100
    : null;

  const kurtosisInterp =
    data?.kurtosis != null ? getKurtosisInterpretation(data.kurtosis) : null;

  // Combine histogram and Gaussian curve for overlay
  const chartData = useMemo(() => {
    if (!data?.histogram) return [];

    const histogram = data.histogram;
    const mean = data.mean;
    const stdDev = data.stdDev;

    // Calculate total count and bin width for scaling
    const totalCount = histogram.reduce((sum, bin) => sum + bin.count, 0);
    const binWidth =
      histogram.length > 0 ? histogram[0].binEnd - histogram[0].binStart : 1;

    return histogram.map((bin) => {
      let normalCount = 0;

      if (stdDev > 0) {
        // Calculate the Gaussian PDF value and scale it to match histogram
        const pdfValue = gaussianPDF(bin.binCenter, mean, stdDev);

        normalCount = pdfValue * totalCount * binWidth;
      }

      return {
        x: bin.binCenter,
        count: bin.count,
        normalCount,
        density: bin.density,
        range: `${bin.binStart.toFixed(2)}% to ${bin.binEnd.toFixed(2)}%`,
      };
    });
  }, [data?.histogram, data?.mean, data?.stdDev]);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Kurtosis</p>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">
                  {data?.kurtosis != null ? data.kurtosis.toFixed(2) : "N/A"}
                </p>
              </div>
              {kurtosisInterp && (
                <Chip
                  className="mt-1"
                  color={
                    kurtosisInterp.type === "leptokurtic"
                      ? "warning"
                      : kurtosisInterp.type === "platykurtic"
                        ? "success"
                        : "default"
                  }
                  size="sm"
                  variant="flat"
                >
                  {kurtosisInterp.label}
                </Chip>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Mean Return</p>
              <p className="text-2xl font-bold">
                {data?.mean !== undefined
                  ? `${data.mean >= 0 ? "+" : ""}${data.mean.toFixed(4)}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Std Deviation</p>
              <p className="text-2xl font-bold">
                {dailyVolatility != null
                  ? `${dailyVolatility.toFixed(2)}%`
                  : "N/A"}
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
              <h3 className="text-lg font-semibold">Kurtosis Analysis</h3>
              {data && data.dataPoints < 90 && (
                <Tooltip
                  content={
                    <div className="p-2 max-w-xs">
                      <div className="font-semibold mb-1">
                        Less Than 90 Days of Data
                      </div>
                      <div className="text-tiny">
                        Only {data.dataPoints} days of historical data
                        available. Kurtosis calculations are more reliable with
                        at least 90 days of data.
                      </div>
                    </div>
                  }
                >
                  <AlertTriangle
                    className="text-warning cursor-help"
                    size={18}
                  />
                </Tooltip>
              )}
            </div>
            <p className="text-sm text-default-500">
              Histogram with normal distribution overlay
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
              <p className="text-default-500">
                {data?.msg || "No data available"}
              </p>
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
                    width={50}
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
                              {d.count} days
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
                  <Bar
                    dataKey="count"
                    fill="#3b82f6"
                    fillOpacity={0.6}
                    name="Actual Distribution"
                    radius={[2, 2, 0, 0]}
                  />
                  <Line
                    activeDot={false}
                    dataKey="normalCount"
                    dot={false}
                    isAnimationActive={true}
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
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-primary rounded" />
                  <span>Actual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-warning rounded" />
                  <span>Normal</span>
                </div>
              </div>
              <p className="text-xs text-default-400">
                {data.dataPoints} observations
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Kurtosis Interpretation Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Kurtosis Interpretation</h3>
        </CardHeader>
        <CardBody className="p-4">
          {kurtosisInterp ? (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl font-bold">
                  {data?.kurtosis?.toFixed(2)}
                </span>
                <Chip
                  color={
                    kurtosisInterp.type === "leptokurtic"
                      ? "warning"
                      : kurtosisInterp.type === "platykurtic"
                        ? "success"
                        : "default"
                  }
                  variant="flat"
                >
                  {kurtosisInterp.label}
                </Chip>
              </div>
              <p className="text-sm text-default-600">
                {kurtosisInterp.description}
              </p>
              <div className="mt-4 p-3 bg-default-100 rounded-lg">
                <p className="text-xs text-default-500">
                  {kurtosisInterp.type === "leptokurtic"
                    ? "Fat tails (excess kurtosis > 0) mean extreme price movements occur more frequently than a normal distribution would predict. Higher tail risk."
                    : kurtosisInterp.type === "platykurtic"
                      ? "Thin tails (excess kurtosis < 0) mean extreme price movements occur less frequently than expected. Lower tail risk."
                      : "The distribution has similar tail behavior to a normal distribution (excess kurtosis ≈ 0)."}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-default-500">No data available</p>
          )}
        </CardBody>
      </Card>

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Kurtosis</strong> measures the &quot;peakedness&quot; and
              distribution of tails. A high kurtosis (leptokurtic) indicates a
              higher probability of extreme outcomes (fat tails), while a low
              kurtosis (platykurtic) suggests more moderate variations.
            </p>
            <MethodologyLink section="kurtosis" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
