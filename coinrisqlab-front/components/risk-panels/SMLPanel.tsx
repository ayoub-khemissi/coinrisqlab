"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Tooltip } from "@heroui/tooltip";
import { AlertTriangle } from "lucide-react";

import { MethodologyLink } from "./MethodologyLink";

import { useSML } from "@/hooks/useRiskMetrics";

interface SMLPanelProps {
  cryptoId: string;
  symbol: string;
}

export function SMLPanel({ cryptoId, symbol }: SMLPanelProps) {
  const { data, isLoading, error } = useSML(cryptoId, "90d");

  // Crypto point for scatter
  const cryptoPoint = data
    ? [
        {
          beta: data.cryptoBeta,
          return: data.cryptoActualReturn,
          name: symbol.toUpperCase(),
          type: "actual",
        },
      ]
    : [];

  // Expected point on SML
  const expectedPoint = data
    ? [
        {
          beta: data.cryptoBeta,
          return: data.cryptoExpectedReturn,
          name: "Expected",
          type: "expected",
        },
      ]
    : [];

  // Market point (beta = 1)
  const marketPoint = data
    ? [
        {
          beta: 1,
          return: data.marketReturn,
          name: "Market (CoinRisqLab 80)",
          type: "market",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Card */}
      <Card>
        <CardBody className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Position</p>
              <Chip
                color={data?.isOvervalued ? "danger" : "success"}
                size="lg"
                variant="flat"
              >
                {data?.isOvervalued ? "Overvalued" : "Undervalued"}
              </Chip>
              <p className="text-xs text-default-400 mt-1">
                {data?.isOvervalued
                  ? "Below SML - returns lower than expected"
                  : "Above SML - returns higher than expected"}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">
                Alpha (Jensen&apos;s)
              </p>
              <p
                className={`text-3xl font-bold ${data?.alpha && data.alpha >= 0 ? "text-success" : "text-danger"}`}
              >
                {data?.alpha !== undefined
                  ? `${data.alpha >= 0 ? "+" : ""}${data.alpha.toFixed(2)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">
                Annualized excess return
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Actual Return</p>
              <p
                className={`text-2xl font-bold ${data?.cryptoActualReturn && data.cryptoActualReturn >= 0 ? "text-success" : "text-danger"}`}
              >
                {data?.cryptoActualReturn !== undefined
                  ? `${data.cryptoActualReturn >= 0 ? "+" : ""}${data.cryptoActualReturn.toFixed(2)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">Annualized</p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Expected Return</p>
              <p className="text-2xl font-bold">
                {data?.cryptoExpectedReturn !== undefined
                  ? `${data.cryptoExpectedReturn >= 0 ? "+" : ""}${data.cryptoExpectedReturn.toFixed(2)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-default-400">Per CAPM (Rf = 0%)</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* SML Chart Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Security Market Line</h3>
              {data && data.dataPoints < 90 && (
                <Tooltip
                  content={
                    <div className="p-2 max-w-xs">
                      <div className="font-semibold mb-1">
                        Less Than 90 Days of Data
                      </div>
                      <div className="text-tiny">
                        Only {data.dataPoints} days of historical data
                        available. SML calculations are more reliable with at
                        least 90 days of data.
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
              Expected return vs Beta (systematic risk)
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
          ) : !data.smlLine ? (
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
                    dataKey="beta"
                    domain={[0, 2.5]}
                    fontSize={12}
                    label={{
                      value: "Beta (Systematic Risk)",
                      position: "bottom",
                      offset: 0,
                    }}
                    stroke="#888"
                    tickLine={false}
                    type="number"
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    fontSize={12}
                    label={{
                      value: "Expected Return (%)",
                      angle: -90,
                      position: "insideLeft",
                      style: { textAnchor: "middle" },
                      dx: 15,
                    }}
                    stroke="#888"
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    width={80}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length > 0) {
                        const d = payload[0].payload;

                        return (
                          <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                            <p className="font-semibold mb-1">
                              {d.name || "SML Point"}
                            </p>
                            <p className="text-sm">
                              Beta:{" "}
                              {d.beta?.toFixed(2) ||
                                payload[0].payload?.beta?.toFixed(2)}
                            </p>
                            <p className="text-sm">
                              Return:{" "}
                              {d.return?.toFixed(2) ||
                                d.expectedReturn?.toFixed(2)}
                              %
                            </p>
                          </div>
                        );
                      }

                      return null;
                    }}
                  />
                  <ReferenceLine stroke="#888" strokeOpacity={0.3} x={1} />
                  <ReferenceLine stroke="#888" strokeOpacity={0.3} y={0} />
                  {/* SML Line */}
                  <Line
                    activeDot={false}
                    data={data.smlLine}
                    dataKey="expectedReturn"
                    dot={false}
                    isAnimationActive={true}
                    name="SML"
                    stroke="#888"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    type="linear"
                  />
                  {/* Market point */}
                  <Scatter
                    data={marketPoint.map((p) => ({
                      ...p,
                      return: p.return,
                    }))}
                    dataKey="return"
                    fill="#f97316"
                    name="Market"
                    shape="diamond"
                  />
                  {/* Expected point on SML */}
                  <Scatter
                    data={expectedPoint.map((p) => ({
                      ...p,
                      return: p.return,
                    }))}
                    dataKey="return"
                    fill="#888"
                    name="Expected"
                    shape="circle"
                  />
                  {/* Actual crypto point */}
                  <Scatter
                    data={cryptoPoint.map((p) => ({
                      ...p,
                      return: p.return,
                    }))}
                    dataKey="return"
                    fill={data.isOvervalued ? "#ef4444" : "#22c55e"}
                    name={symbol.toUpperCase()}
                    shape="star"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          {data && (
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-dashed border-default-400" />
                  <span>SML</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className={`w-3 h-3 ${data.isOvervalued ? "bg-danger" : "bg-success"}`}
                    style={{
                      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    }}
                  />
                  <span>{symbol.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 bg-warning"
                    style={{
                      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                    }}
                  />
                  <span>Market</span>
                </div>
              </div>
              <p className="text-xs text-default-400">
                {data.dataPoints} observations
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Interpretation Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">SML Interpretation</h3>
        </CardHeader>
        <CardBody className="p-4">
          <div className="space-y-4">
            <div
              className={`p-4 rounded-lg ${data?.isOvervalued ? "bg-danger-50" : "bg-success-50"}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Chip
                  color={data?.isOvervalued ? "danger" : "success"}
                  variant="flat"
                >
                  {data?.isOvervalued ? "Below SML" : "Above SML"}
                </Chip>
                <span className="font-semibold">
                  {data?.isOvervalued
                    ? "Potentially Overvalued"
                    : "Potentially Undervalued"}
                </span>
              </div>
              <p className="text-sm text-default-600">
                {data?.isOvervalued
                  ? `${symbol.toUpperCase()} is generating ${Math.abs(data?.alpha || 0).toFixed(2)}% less return than expected for its level of systematic risk (beta = ${data?.cryptoBeta?.toFixed(2)}). This suggests the asset may be overvalued or experiencing negative alpha.`
                  : `${symbol.toUpperCase()} is generating ${Math.abs(data?.alpha || 0).toFixed(2)}% more return than expected for its level of systematic risk (beta = ${data?.cryptoBeta?.toFixed(2)}). This suggests the asset may be undervalued or the strategy is generating positive alpha.`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-default-100 rounded-lg">
                <p className="text-sm font-semibold mb-2">CAPM Formula</p>
                <code className="text-xs bg-default-200 px-2 py-1 rounded">
                  E(R) = Rf + β × (Rm - Rf)
                </code>
                <p className="text-xs text-default-500 mt-2">
                  With Rf = 0%: E(R) = β × Rm
                </p>
              </div>
              <div className="p-4 bg-default-100 rounded-lg">
                <p className="text-sm font-semibold mb-2">
                  Jensen&apos;s Alpha
                </p>
                <code className="text-xs bg-default-200 px-2 py-1 rounded">
                  α = Actual Return - Expected Return
                </code>
                <p className="text-xs text-default-500 mt-2">
                  Positive α = outperformance
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Explanation */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Security Market Line (SML)</strong> is a visual
              representation of the Capital Asset Pricing Model (CAPM). It plots
              the relationship between an asset&apos;s systematic risk (beta)
              and its expected return. Assets above the SML are considered
              undervalued (generating positive alpha), while those below are
              considered overvalued.
            </p>
            <MethodologyLink section="sml" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
