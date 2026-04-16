"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Line,
  ComposedChart,
} from "recharts";
import { Tooltip } from "@heroui/tooltip";
import { AlertTriangle } from "lucide-react";

import { MethodologyLink } from "./MethodologyLink";

import { useBeta } from "@/hooks/useRiskMetrics";
import { getBetaInterpretation } from "@/types/risk-metrics";

export function BetaPanel({
  cryptoId,
  symbol,
}: {
  cryptoId: string;
  symbol: string;
}) {
  const { data, isLoading, error } = useBeta(cryptoId, "365d");

  const betaInterpretation =
    data && data.beta !== null && data.beta !== undefined
      ? getBetaInterpretation(data.beta)
      : null;

  // Compute axis domains centered on origin (0,0) with symmetric padding
  const scatterDomain = (() => {
    if (!data?.scatterData || data.scatterData.length === 0) return null;
    const xs = data.scatterData.map((d) => d.marketReturn);
    const ys = data.scatterData.map((d) => d.cryptoReturn);
    const xAbsMax = Math.max(Math.abs(Math.min(...xs)), Math.abs(Math.max(...xs)));
    const yAbsMax = Math.max(Math.abs(Math.min(...ys)), Math.abs(Math.max(...ys)));
    // Use the larger absolute range so origin is centered and both axes match
    const absMax = Math.max(xAbsMax, yAbsMax);
    const pad = absMax * 0.3; // generous padding for a dezoom effect
    const extent = Math.ceil((absMax + pad) * 10) / 10;

    return {
      x: [-extent, extent] as [number, number],
      y: [-extent, extent] as [number, number],
    };
  })();

  // Generate regression line points extended to fill the visible domain
  const regressionLineData = (() => {
    if (!data?.regressionLine || !scatterDomain) return [];
    const { slope, intercept } = data.regressionLine;
    const x1 = scatterDomain.x[0];
    const x2 = scatterDomain.x[1];

    return [
      { x: x1, y: intercept + slope * x1 },
      { x: x2, y: intercept + slope * x2 },
    ];
  })();

  const sharpeColor =
    data?.sharpeRatio != null
      ? data.sharpeRatio >= 2
        ? "text-success"
        : data.sharpeRatio >= 1
          ? "text-success"
          : data.sharpeRatio >= 0
            ? "text-warning"
            : "text-danger"
      : "";

  const sharpeLabel =
    data?.sharpeRatio != null
      ? data.sharpeRatio >= 2
        ? "Excellent"
        : data.sharpeRatio >= 1
          ? "Good"
          : data.sharpeRatio >= 0
            ? "Low"
            : "Negative"
      : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Beta Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Beta</p>
              <p className="text-4xl font-bold">
                {data?.beta != null ? data.beta.toFixed(2) : "N/A"}
              </p>
              {betaInterpretation && (
                <Chip
                  className="mt-1"
                  color={betaInterpretation.color}
                  size="sm"
                  variant="flat"
                >
                  {betaInterpretation.label}
                </Chip>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Sharpe Ratio</p>
              <p className={`text-3xl font-bold ${sharpeColor}`}>
                {data?.sharpeRatio != null
                  ? data.sharpeRatio.toFixed(2)
                  : "N/A"}
              </p>
              {sharpeLabel && (
                <p className="text-xs text-default-400">{sharpeLabel}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Alpha (daily)</p>
              <p className="text-2xl font-bold">
                {data?.alpha != null
                  ? `${data.alpha >= 0 ? "+" : ""}${data.alpha.toFixed(4)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                {data?.alpha && data.alpha > 0
                  ? "Outperforming"
                  : data?.alpha && data.alpha < 0
                    ? "Underperforming"
                    : ""}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">R-squared</p>
              <p className="text-2xl font-bold">
                {data?.rSquared != null
                  ? `${(data.rSquared * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">Model fit quality</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Scatter Plot Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Returns Regression</h3>
              {data && data.dataPoints < 365 && (
                <Tooltip
                  content={
                    <div className="p-2 max-w-xs">
                      <div className="font-semibold mb-1">
                        Less Than 1 Year of Data
                      </div>
                      <div className="text-tiny">
                        Only {data.dataPoints} days of historical data
                        available. Beta calculations are more reliable with at
                        least 365 days of data.
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
              {symbol.toUpperCase()} vs CoinRisqLab 80 Index
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          {error ? (
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-danger">Error loading data</p>
            </div>
          ) : !data ? (
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-default-500">Loading...</p>
            </div>
          ) : !data.scatterData || data.scatterData.length === 0 ? (
            <div className="h-[350px] flex items-center justify-center">
              <p className="text-default-500">
                {data?.msg || "No data available"}
              </p>
            </div>
          ) : (
            <div
              className="transition-opacity relative"
              style={{ opacity: isLoading ? 0.5 : 1 }}
            >
              {/* Beta & Alpha overlay top-right */}
              {data && (
                <div className="absolute top-2 right-4 z-10">
                  <div className="bg-content1/80 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-default-200 flex items-center gap-2 text-[11px]">
                    <span className="text-default-400">Beta</span>
                    <span className="font-semibold">{data.beta?.toFixed(2) ?? "—"}</span>
                    <span className="text-default-200">|</span>
                    <span className="text-default-400">Alpha</span>
                    <span className={`font-semibold ${(data.alpha || 0) >= 0 ? "text-success" : "text-danger"}`}>
                      {data.alpha != null ? `${data.alpha >= 0 ? "+" : ""}${data.alpha.toFixed(4)}%` : "—"}
                    </span>
                  </div>
                </div>
              )}
              <ResponsiveContainer height={500} width="100%">
                <ComposedChart margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  {/* Hidden external axes — only for domain and data binding */}
                  <XAxis
                    allowDataOverflow
                    hide
                    dataKey="x"
                    domain={scatterDomain?.x ?? ["auto", "auto"]}
                    type="number"
                  />
                  <YAxis
                    allowDataOverflow
                    hide
                    dataKey="y"
                    domain={scatterDomain?.y ?? ["auto", "auto"]}
                    type="number"
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const d = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            {d.date && (
                              <p className="text-sm text-default-500 mb-1">
                                {d.date}
                              </p>
                            )}
                            <p className="text-sm">
                              Market:{" "}
                              {d.marketReturn?.toFixed(2) || d.x?.toFixed(2)}%
                            </p>
                            <p className="text-sm">
                              {symbol.toUpperCase()}:{" "}
                              {d.cryptoReturn?.toFixed(2) || d.y?.toFixed(2)}%
                            </p>
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  {/* Central axes through origin */}
                  <ReferenceLine
                    label={{ value: `Market Return (%)`, position: "insideBottomRight", fontSize: 10, fill: "#888" }}
                    stroke="#888"
                    strokeOpacity={0.6}
                    y={0}
                  />
                  <ReferenceLine
                    label={{ value: `${symbol.toUpperCase()} Return (%)`, position: "insideTopLeft", fontSize: 10, fill: "#888" }}
                    stroke="#888"
                    strokeOpacity={0.6}
                    x={0}
                  />
                  {/* Scatter points */}
                  <Scatter
                    data={data.scatterData.map((d) => ({
                      x: d.marketReturn,
                      y: d.cryptoReturn,
                      date: d.date,
                      marketReturn: d.marketReturn,
                      cryptoReturn: d.cryptoReturn,
                    }))}
                    fill="#3b82f6"
                    name="Returns"
                  />
                  {/* Regression line */}
                  {regressionLineData.length > 0 && (
                    <Line
                      activeDot={false}
                      data={regressionLineData}
                      dataKey="y"
                      dot={false}
                      isAnimationActive={true}
                      stroke="#ef4444"
                      strokeWidth={2}
                      type="linear"
                    />
                  )}
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

      {/* Interpretation Card */}
      {betaInterpretation && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Beta Interpretation</h3>
          </CardHeader>
          <CardBody className="p-4">
            <div className="flex items-start gap-4">
              <Chip
                className="min-w-[100px] justify-center"
                color={betaInterpretation.color}
                size="lg"
                variant="flat"
              >
                {betaInterpretation.label}
              </Chip>
              <div>
                <p className="text-default-700">
                  {betaInterpretation.description}
                </p>
                <p className="text-sm text-default-500 mt-2">
                  {data?.beta && data.beta > 1
                    ? `When the market moves 1%, ${symbol.toUpperCase()} is expected to move ${data.beta.toFixed(2)}%`
                    : data?.beta && data.beta < 1 && data.beta > 0
                      ? `When the market moves 1%, ${symbol.toUpperCase()} is expected to move only ${data.beta.toFixed(2)}%`
                      : data?.beta && data.beta < 0
                        ? `When the market moves 1%, ${symbol.toUpperCase()} tends to move ${Math.abs(data.beta).toFixed(2)}% in the opposite direction`
                        : `${symbol.toUpperCase()} moves in line with the market`}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Beta Reference Table */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Beta Reference</h3>
        </CardHeader>
        <CardBody className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default-200">
                  <th className="text-left py-2 px-3">Beta Range</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-left py-2 px-3">Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">{"< 0"}</td>
                  <td className="py-2 px-3">
                    <Chip color="primary" size="sm" variant="flat">
                      Inverse
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Moves opposite to market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">0 - 1</td>
                  <td className="py-2 px-3">
                    <Chip color="success" size="sm" variant="flat">
                      Defensive
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Less volatile than market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">= 1</td>
                  <td className="py-2 px-3">
                    <Chip size="sm" variant="flat">
                      Market
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Moves like the market
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">1 - 2</td>
                  <td className="py-2 px-3">
                    <Chip color="warning" size="sm" variant="flat">
                      Aggressive
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Amplifies market movements
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">{"> 2"}</td>
                  <td className="py-2 px-3">
                    <Chip color="danger" size="sm" variant="flat">
                      Speculative
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Extreme market sensitivity
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-default-500 mt-4">
            Beta captures systematic risk, which is the risk related to overall
            market movements.
          </p>
        </CardBody>
      </Card>

      {/* Sharpe Ratio Reference */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Sharpe Ratio Reference</h3>
        </CardHeader>
        <CardBody className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default-200">
                  <th className="text-left py-2 px-3">Sharpe Ratio</th>
                  <th className="text-left py-2 px-3">Quality</th>
                  <th className="text-left py-2 px-3">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">{"< 0"}</td>
                  <td className="py-2 px-3">
                    <Chip color="danger" size="sm" variant="flat">
                      Negative
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Negative average return relative to risk taken
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">{"0 – 1"}</td>
                  <td className="py-2 px-3">
                    <Chip color="warning" size="sm" variant="flat">
                      Low
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Low return per unit of risk
                  </td>
                </tr>
                <tr className="border-b border-default-100">
                  <td className="py-2 px-3">{"1 – 2"}</td>
                  <td className="py-2 px-3">
                    <Chip color="success" size="sm" variant="flat">
                      Good
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Good risk-adjusted return
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3">{"> 2"}</td>
                  <td className="py-2 px-3">
                    <Chip color="success" size="sm" variant="flat">
                      Excellent
                    </Chip>
                  </td>
                  <td className="py-2 px-3 text-default-500">
                    Strong risk-adjusted performance
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-default-500 mt-4">
            The higher the ratio, the better the return compensates for the risk
            taken.
          </p>
        </CardBody>
      </Card>

      {/* Explanation Card */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="text-sm text-default-500 flex-1 space-y-2">
              <p>
                <strong>Beta</strong> measures the sensitivity of a
                security&apos;s returns to movements in the market.
              </p>
              <p>
                <strong>Sharpe Ratio</strong> measures excess return per unit of
                risk. It answers the question: How much additional return does
                an investor obtain for each unit of volatility taken?
              </p>
            </div>
            <MethodologyLink section="beta" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
