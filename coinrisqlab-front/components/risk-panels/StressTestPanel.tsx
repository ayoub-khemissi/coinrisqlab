"use client";

import { useState, useMemo, memo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

import { MethodologyLink } from "./MethodologyLink";

import { useStressTest } from "@/hooks/useRiskMetrics";
import { useBinancePrice } from "@/hooks/useBinancePrices";
import { formatCryptoPrice } from "@/lib/formatters";
import {
  StressScenarioId,
  STRESS_SCENARIO_COLORS,
  StressScenario,
} from "@/types/risk-metrics";

interface StressTestPanelProps {
  symbol: string;
}

// Scenarios that need dark text for better contrast (light background colors)
const DARK_TEXT_SCENARIOS: StressScenarioId[] = [
  "covid-19",
  "china-mining-ban",
  "ust-crash",
];

// Isolated button component to prevent chart re-renders on hover
const ScenarioButton = memo(function ScenarioButton({
  scenario,
  isSelected,
  onSelect,
}: {
  scenario: StressScenario;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isActive = isSelected || isHovered;
  const needsDarkText = DARK_TEXT_SCENARIOS.includes(scenario.id);

  return (
    <Button
      className="h-auto py-2 px-4 transition-colors"
      size="sm"
      style={{
        backgroundColor: isActive
          ? STRESS_SCENARIO_COLORS[scenario.id]
          : "transparent",
        borderColor: STRESS_SCENARIO_COLORS[scenario.id],
        color: isActive ? (needsDarkText ? "#000" : "#fff") : undefined,
      }}
      variant="bordered"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPress={onSelect}
    >
      <span className="flex flex-col items-start">
        <span className="font-medium">{scenario.name}</span>
        <span className="text-xs opacity-75">
          {scenario.marketShock.toFixed(1)}% shock
        </span>
      </span>
    </Button>
  );
});

// Component for the live price section to prevent re-rendering the whole panel
const LivePriceSection = memo(function LivePriceSection({
  symbol,
  initialPrice,
}: {
  symbol: string;
  initialPrice?: number | null;
}) {
  const livePrice = useBinancePrice(symbol, initialPrice);
  const currentPrice = livePrice ?? initialPrice ?? 0;

  return (
    <p className="text-4xl font-bold">
      {currentPrice ? formatCryptoPrice(currentPrice) : "N/A"}
    </p>
  );
});

// Component for the detailed impact visualization to prevent re-rendering the whole panel
const LiveImpactDetails = memo(function LiveImpactDetails({
  symbol,
  activeScenario,
  initialPrice,
}: {
  symbol: string;
  activeScenario: StressScenario;
  initialPrice?: number | null;
}) {
  const livePrice = useBinancePrice(symbol, initialPrice);
  const currentPrice = livePrice ?? initialPrice ?? 0;

  // Calculate the impact summary for the selected scenario using live price
  const impactSummary = useMemo(() => {
    if (!activeScenario || !currentPrice) return null;

    // Use pre-calculated impact from API to ensure consistency with sidebar summary
    // Formula: Stressed Price = Current Price x (1 + expectedImpact / 100)
    const impactMultiplier = 1 + activeScenario.expectedImpact / 100;
    const stressedPrice = currentPrice * impactMultiplier;
    const loss = currentPrice - stressedPrice;
    const lossPercent = (loss / currentPrice) * 100;

    return {
      startPrice: currentPrice,
      endPrice: stressedPrice,
      loss,
      lossPercent,
    };
  }, [activeScenario, currentPrice]);

  if (!impactSummary) return null;

  return (
    <div
      className="mt-4 p-4 rounded-lg border-2"
      style={{
        borderColor: STRESS_SCENARIO_COLORS[activeScenario.id],
      }}
    >
      {/* Scenario info header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-semibold">{activeScenario.name}</h4>
          <p className="text-sm text-default-500">
            {activeScenario.description}
          </p>
          <p className="text-xs text-default-400 mt-1">
            {new Date(activeScenario.startDate).toLocaleDateString("fr-FR")}{" "}
            {" \u2192 "}
            {new Date(activeScenario.endDate).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <Chip color="danger" size="sm" variant="flat">
          {activeScenario.marketShock.toFixed(2)}%
        </Chip>
      </div>

      {/* Impact visualization */}
      <div className="text-center mb-2">
        <p className="text-sm text-default-500">
          If we relived <strong>{activeScenario.name}</strong>:
        </p>
      </div>
      <div className="flex items-center justify-center gap-3 sm:gap-8 py-2">
        <div className="text-center min-w-0 flex-shrink">
          <p className="text-xs text-default-500 mb-1">Current</p>
          <p className="text-lg sm:text-2xl font-bold truncate">
            {formatCryptoPrice(impactSummary.startPrice)}
          </p>
        </div>
        <TrendingDown className="text-danger flex-shrink-0" size={24} />
        <div className="text-center min-w-0 flex-shrink">
          <p className="text-xs text-default-500 mb-1">Stressed</p>
          <p
            className="text-lg sm:text-2xl font-bold truncate"
            style={{ color: STRESS_SCENARIO_COLORS[activeScenario.id] }}
          >
            {formatCryptoPrice(impactSummary.endPrice)}
          </p>
        </div>
      </div>

      {/* Loss chip */}
      <div className="text-center mt-2">
        <Chip color="danger" size="lg" variant="flat">
          {impactSummary.lossPercent.toFixed(2)}% loss (
          {formatCryptoPrice(impactSummary.loss)})
        </Chip>
      </div>
    </div>
  );
});

export function StressTestPanel({ symbol }: StressTestPanelProps) {
  const { data, isLoading, error } = useStressTest(symbol);
  const [selectedScenario, setSelectedScenario] =
    useState<StressScenarioId | null>("covid-19");

  // Get selected scenario details
  const activeScenario = useMemo(() => {
    if (!selectedScenario || !data?.scenarios) return null;

    return data.scenarios.find((s) => s.id === selectedScenario) || null;
  }, [selectedScenario, data?.scenarios]);

  // Build chart data with stressed price projection
  const chartData = useMemo(() => {
    if (!data?.priceHistory) return [];

    return data.priceHistory.map((p, index) => {
      const baseData: {
        index: number;
        timestamp: number;
        dateLabel: string;
        price: number;
        fullDateTime: string;
        stressedPrice: number | null;
      } = {
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
        stressedPrice: null,
      };

      // Calculate stressed price if a scenario is selected
      if (activeScenario && data.beta) {
        // Formula: Prix stresse = Prix x (1 + choc x beta)
        // marketShock is already in percentage (e.g., -50.42), so divide by 100
        const impactMultiplier =
          1 + (activeScenario.marketShock / 100) * data.beta;

        baseData.stressedPrice = p.price * impactMultiplier;
      }

      return baseData;
    });
  }, [data?.priceHistory, activeScenario, data?.beta]);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Card with current price and beta */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-sm text-default-500 mb-1">Current Price</p>
              <LivePriceSection
                initialPrice={data?.currentPrice}
                symbol={symbol}
              />
            </div>
            <div>
              <p className="text-sm text-default-500 mb-1">
                Beta (vs CoinRisqLab 80)
              </p>
              <Chip
                color={
                  data?.beta && data.beta > 1.5
                    ? "danger"
                    : data?.beta && data.beta > 1
                      ? "warning"
                      : "success"
                }
                size="lg"
                variant="flat"
              >
                {data?.beta?.toFixed(2) || "N/A"}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Scenario Selection Buttons */}
      <Card>
        <CardHeader>
          <div>
            <h3 className="text-lg font-semibold">Historical Scenarios</h3>
            <p className="text-sm text-default-500">
              Select a crisis to simulate its impact on your position
            </p>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <div className="flex flex-wrap gap-2">
            {data?.scenarios.map((scenario) => (
              <ScenarioButton
                key={scenario.id}
                isSelected={selectedScenario === scenario.id}
                scenario={scenario}
                onSelect={() =>
                  setSelectedScenario(
                    selectedScenario === scenario.id ? null : scenario.id,
                  )
                }
              />
            ))}
          </div>

          {/* Selected scenario details + Impact Summary (merged) - Isolated component */}
          {activeScenario && data && (
            <LiveImpactDetails
              activeScenario={activeScenario}
              initialPrice={data.currentPrice}
              symbol={symbol}
            />
          )}
        </CardBody>
      </Card>

      {/* Chart Card - Only shown when scenario selected */}
      {selectedScenario && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-0">
            <h3 className="text-lg font-semibold">Price Projection</h3>
          </CardHeader>
          <CardBody className="p-4">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-default-500">Loading...</p>
              </div>
            ) : error ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-danger">Error loading data</p>
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
                          const d = payload[0].payload;

                          return (
                            <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                              <p className="text-sm text-default-500 mb-2">
                                {d.fullDateTime}
                              </p>
                              <div className="space-y-1">
                                <p>
                                  <span className="text-default-500">
                                    Actual:{" "}
                                  </span>
                                  <span
                                    className="font-semibold"
                                    style={{ color: "#3b82f6" }}
                                  >
                                    {formatCryptoPrice(d.price)}
                                  </span>
                                </p>
                                {d.stressedPrice !== null && (
                                  <p>
                                    <span className="text-default-500">
                                      Stressed:{" "}
                                    </span>
                                    <span
                                      className="font-semibold"
                                      style={{
                                        color:
                                          STRESS_SCENARIO_COLORS[
                                          selectedScenario!
                                          ],
                                      }}
                                    >
                                      {formatCryptoPrice(d.stressedPrice)}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      }}
                    />
                    {/* Actual price line */}
                    <Line
                      activeDot={false}
                      dataKey="price"
                      dot={false}
                      isAnimationActive={true}
                      name="Actual Price"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      type="linear"
                    />
                    {/* Stressed price line */}
                    <Line
                      activeDot={false}
                      dataKey="stressedPrice"
                      dot={false}
                      isAnimationActive={true}
                      name="Stressed Price"
                      stroke={STRESS_SCENARIO_COLORS[selectedScenario]}
                      strokeWidth={2}
                      type="linear"
                    />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {data && (
              <p className="text-xs text-default-400 mt-2 text-right">
                {chartData.length} data points
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Explanation Card */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <p className="text-sm text-default-500 flex-1">
              <strong>Stress test</strong> simulates historical market crashes
              on your position using the formula:{" "}
              <code className="bg-default-100 px-1 rounded">
                Stressed Price = Current Price x (1 + Shock x Beta)
              </code>
              . A beta of {data?.beta?.toFixed(2) || "1.0"} means this crypto
              {data?.beta && data.beta > 1
                ? ` amplifies market movements by ${((data.beta - 1) * 100).toFixed(0)}%`
                : data?.beta && data.beta < 1
                  ? ` dampens market movements by ${((1 - data.beta) * 100).toFixed(0)}%`
                  : " moves exactly like the market"}
              .
            </p>
            <MethodologyLink section="stress-test" variant="full" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
