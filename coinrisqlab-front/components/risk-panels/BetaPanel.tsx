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

  // Generate regression line points
  const regressionLineData = data?.regressionLine
    ? [
        { x: data.regressionLine.x1, y: data.regressionLine.y1 },
        { x: data.regressionLine.x2, y: data.regressionLine.y2 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Beta Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
              className="transition-opacity"
              style={{ opacity: isLoading ? 0.5 : 1 }}
            >
              <ResponsiveContainer height={350} width="100%">
                <ComposedChart margin={{ bottom: 20 }}>
                  <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    domain={["auto", "auto"]}
                    fontSize={12}
                    label={{
                      value: "Market Return (%)",
                      position: "bottom",
                      offset: 0,
                    }}
                    stroke="#888"
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    dataKey="y"
                    domain={["auto", "auto"]}
                    fontSize={12}
                    label={{
                      value: `${symbol.toUpperCase()} Return (%)`,
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle" },
                      dx: 15,
                    }}
                    stroke="#888"
                    tickFormatter={(value) => `${value.toFixed(1)}%`}
                    tickLine={false}
                    type="number"
                    width={80}
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
                  <ReferenceLine stroke="#888" strokeOpacity={0.5} x={0} />
                  <ReferenceLine stroke="#888" strokeOpacity={0.5} y={0} />
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
        </CardBody>
      </Card>

      {/* Explanation Card */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Beta</strong> measures the volatility of an asset relative
              to the market. It is calculated using the covariance of returns
              divided by the variance of market returns:{" "}
              <code className="bg-default-100 px-1 rounded">
                Beta = Cov(R_crypto, R_market) / Var(R_market)
              </code>
              . Alpha is the excess return not explained by beta:{" "}
              <code className="bg-default-100 px-1 rounded">
                Alpha = Mean(R_crypto) - Beta * Mean(R_market)
              </code>
              .
            </p>
            <MethodologyLink section="beta" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
