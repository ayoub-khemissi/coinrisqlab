"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  ComposedChart,
  Line,
  Scatter,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Tooltip } from "@heroui/tooltip";
import { AlertTriangle } from "lucide-react";

import { MethodologyLink } from "./MethodologyLink";

import { Math as MathFormula } from "@/components/math";
import { useSML } from "@/hooks/useRiskMetrics";

interface SMLPanelProps {
  cryptoId: string;
  symbol: string;
}

interface ScatterPoint {
  beta: number;
  return: number;
  name: string;
  color: string;
}

export function SMLPanel({ cryptoId, symbol }: SMLPanelProps) {
  const { data, isLoading, error } = useSML(cryptoId, "90d");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    points: ScatterPoint[];
  } | null>(null);

  const cryptoColor = data?.isOvervalued ? "#ef4444" : "#22c55e";

  // All scatter points combined into one array for working tooltips
  const scatterPoints = data
    ? [
        {
          beta: 1,
          return: data.marketReturn,
          name: "Market (CoinRisqLab 80)",
          color: "#f97316",
        },
        {
          beta: data.cryptoBeta,
          return: data.cryptoExpectedReturn,
          name: "Expected",
          color: "#888888",
        },
        {
          beta: data.cryptoBeta,
          return: data.cryptoActualReturn,
          name: symbol.toUpperCase(),
          color: cryptoColor,
        },
      ]
    : [];

  // Compute axis domains zoomed around the actual points (not full SML range)
  const xDomain: [number, number] | undefined = data
    ? (() => {
        const betas = [data.cryptoBeta, 1]; // crypto beta + market beta
        const minB = Math.min(...betas);
        const maxB = Math.max(...betas);
        const span = Math.max(maxB - minB, 0.3);
        const pad = span * 0.8;

        return [
          Math.max(0, Math.floor((minB - pad) * 10) / 10),
          Math.ceil((maxB + pad) * 10) / 10,
        ];
      })()
    : undefined;

  const yDomain: [number, number] | undefined = data
    ? (() => {
        const returns = [
          data.cryptoActualReturn,
          data.cryptoExpectedReturn,
          data.marketReturn,
        ];
        const min = Math.min(...returns);
        const max = Math.max(...returns);
        const span = Math.max(max - min, 0.2);
        const pad = span * 0.8;

        return [
          Math.floor((min - pad) * 100) / 100,
          Math.ceil((max + pad) * 100) / 100,
        ];
      })()
    : undefined;

  // SML line points clipped to visible X range
  const visibleSmlLine =
    data?.smlLine?.filter(
      (p: { beta: number }) =>
        xDomain && p.beta >= xDomain[0] && p.beta <= xDomain[1],
    ) || [];

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
              <p className="text-xs text-default-400">Excess return</p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">Mean Return</p>
              <p
                className={`text-2xl font-bold ${data?.cryptoActualReturn && data.cryptoActualReturn >= 0 ? "text-success" : "text-danger"}`}
              >
                {data?.cryptoActualReturn !== undefined
                  ? `${data.cryptoActualReturn >= 0 ? "+" : ""}${data.cryptoActualReturn.toFixed(2)}%`
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">
                Expected Market Mean Return
              </p>
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
              style={{
                opacity: isLoading ? 0.5 : 1,
                position: "relative",
              }}
            >
              <ResponsiveContainer height={350} width="100%">
                <ComposedChart margin={{ bottom: 20 }}>
                  <CartesianGrid opacity={0.1} strokeDasharray="3 3" />
                  <XAxis
                    allowDataOverflow
                    dataKey="beta"
                    domain={xDomain}
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
                    allowDataOverflow
                    domain={yDomain}
                    fontSize={12}
                    label={{
                      value: "Expected Market Mean Return (%)",
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
                  <ReferenceLine stroke="#888" strokeOpacity={0.3} x={1} />
                  <ReferenceLine stroke="#888" strokeOpacity={0.3} y={0} />
                  {/* SML Line */}
                  <Line
                    activeDot={false}
                    data={visibleSmlLine}
                    dataKey="expectedReturn"
                    dot={false}
                    isAnimationActive={false}
                    name="SML"
                    stroke="#888"
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    style={{ pointerEvents: "none" }}
                    type="linear"
                  />
                  {/* Points with per-point mouse handlers */}
                  <Scatter
                    data={scatterPoints}
                    dataKey="return"
                    isAnimationActive={false}
                    name="Points"
                    onMouseEnter={(pointData: any) => {
                      const point = pointData.payload || pointData;
                      const pointsAtBeta = scatterPoints.filter(
                        (p) => p.beta === point.beta,
                      );

                      setTooltip({
                        x: pointData.cx,
                        y: pointData.cy,
                        points: pointsAtBeta,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {scatterPoints.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Scatter>
                </ComposedChart>
              </ResponsiveContainer>
              {tooltip && (
                <div
                  className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg"
                  style={{
                    position: "absolute",
                    left: tooltip.x + 15,
                    top: tooltip.y - 15,
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  <p className="text-sm mb-1">
                    Beta: {tooltip.points[0]?.beta?.toFixed(2)}
                  </p>
                  {tooltip.points.map((p) => (
                    <p
                      key={p.name}
                      className="text-sm"
                      style={{ color: p.color }}
                    >
                      {p.name}: {p.return?.toFixed(2)}%
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {data && (
            <div className="flex justify-between items-center mt-2">
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-dashed border-[#888]" />
                  <span>SML</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cryptoColor }}
                  />
                  <span>{symbol.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: "#f97316" }}
                  />
                  <span>Market</span>
                </div>
                <div className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: "#888888" }}
                  />
                  <span>Expected</span>
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
                <MathFormula display>
                  {"\\mathbb{E}(R) = R_f + \\beta \\times (R_m - R_f)"}
                </MathFormula>
                <p className="text-xs text-default-500 mt-2">
                  With <MathFormula>{"R_f = 0\\%"}</MathFormula>:{" "}
                  <MathFormula>
                    {"\\mathbb{E}(R) = \\beta \\times R_m"}
                  </MathFormula>
                </p>
              </div>
              <div className="p-4 bg-default-100 rounded-lg">
                <p className="text-sm font-semibold mb-2">
                  Jensen&apos;s Alpha
                </p>
                <MathFormula display>
                  {"\\alpha = \\bar{R} - \\mathbb{E}(R)"}
                </MathFormula>
                <p className="text-xs text-default-500 mt-2">
                  Positive <MathFormula>{"\\alpha"}</MathFormula> =
                  outperformance
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
              The <strong>Security Market Line (SML)</strong> measures whether a
              crypto-asset is fairly priced relative to its systematic risk. It
              is derived from the Capital Asset Pricing Model (CAPM). Assets
              above the SML are considered potentially undervalued (generating
              positive alpha), while those below are considered potentially
              overvalued.
            </p>
            <MethodologyLink section="sml" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
