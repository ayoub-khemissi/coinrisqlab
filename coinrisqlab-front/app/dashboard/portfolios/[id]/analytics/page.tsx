"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { TrendingDown } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  StressScenarioId,
  STRESS_SCENARIO_COLORS,
} from "@/types/risk-metrics";
import { formatCryptoPrice } from "@/lib/formatters";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";
import { ProUpgradeCta } from "@/components/dashboard/analytics/pro-upgrade-cta";
import type {
  PortfolioVolatility,
  PortfolioRiskMetrics,
  CorrelationMatrix,
} from "@/types/user";

export default function PortfolioAnalyticsPage() {
  const params = useParams();
  const portfolioId = parseInt(params.id as string);
  const { user } = useUserAuth();
  const isPro = user?.plan === "pro";
  const [selectedScenario, setSelectedScenario] = useState<string>("covid-19");

  const [volatility, setVolatility] = useState<PortfolioVolatility | null>(
    null,
  );
  const [riskMetrics, setRiskMetrics] = useState<PortfolioRiskMetrics | null>(
    null,
  );
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(
    null,
  );
  const [stressTest, setStressTest] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const opts = { credentials: "include" as const };

      try {
        const [volRes, perfRes] = await Promise.all([
          fetch(
            `${API_BASE_URL}/user/portfolios/${portfolioId}/volatility`,
            opts,
          ),
          fetch(
            `${API_BASE_URL}/user/portfolios/${portfolioId}/performance?period=30d`,
            opts,
          ),
        ]);

        const volData = await volRes.json();
        const perfData = await perfRes.json();

        setVolatility(volData.data);
        setPerformance(perfData.data);

        // Pro metrics
        if (isPro) {
          const [riskRes, corrRes, stressRes] = await Promise.all([
            fetch(
              `${API_BASE_URL}/user/portfolios/${portfolioId}/risk-metrics`,
              opts,
            ),
            fetch(
              `${API_BASE_URL}/user/portfolios/${portfolioId}/correlation`,
              opts,
            ),
            fetch(
              `${API_BASE_URL}/user/portfolios/${portfolioId}/stress-test`,
              opts,
            ),
          ]);

          const riskData = await riskRes.json();
          const corrData = await corrRes.json();
          const stressData = await stressRes.json();

          setRiskMetrics(riskData.data);
          setCorrelation(corrData.data);
          setStressTest(stressData.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [portfolioId, isPro]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Portfolio Analytics</h1>

      {/* Performance vs Benchmark */}
      {performance && (
        <Card>
          <CardHeader className="flex justify-between">
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
          </CardHeader>
          <CardBody>
            <div className="h-72">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(d) =>
                      new Date(d).toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })
                    }
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    data={performance.portfolio}
                    dataKey="value"
                    dot={false}
                    name="Portfolio"
                    stroke="#FF6B35"
                    strokeWidth={2}
                  />
                  <Line
                    data={performance.benchmark}
                    dataKey="value"
                    dot={false}
                    name="CoinRisqLab 80"
                    stroke="#3B82F6"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Volatility & Beta */}
      {volatility && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardBody className="gap-1">
              <p className="text-sm text-default-500">
                Annualized Volatility
              </p>
              <p className="text-2xl font-bold">
                {volatility.annualizedVolatility}%
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-1">
              <p className="text-sm text-default-500">Portfolio Beta</p>
              <p className="text-2xl font-bold">{volatility.beta}</p>
              <p className="text-xs text-default-400">
                {volatility.beta > 1
                  ? "More volatile than market"
                  : volatility.beta < 1
                    ? "Less volatile than market"
                    : "Market-neutral"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="gap-1">
              <p className="text-sm text-default-500">Data Points</p>
              <p className="text-2xl font-bold">{volatility.dataPoints}</p>
              <p className="text-xs text-default-400">
                {volatility.holdingCount} holdings analyzed
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Pro section */}
      {!isPro ? (
        <ProUpgradeCta
          description="Unlock VaR/CVaR, correlation matrix, stress tests, Sharpe ratio, and diversification analysis."
          feature="Advanced Risk Metrics"
        />
      ) : (
        <>
          {/* VaR / CVaR / Sharpe */}
          {riskMetrics && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold">Risk Metrics</h3>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-default-500">VaR 95%</p>
                    <p className="text-lg font-bold text-danger">
                      -{riskMetrics.var95}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">VaR 99%</p>
                    <p className="text-lg font-bold text-danger">
                      -{riskMetrics.var99}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">CVaR 95%</p>
                    <p className="text-lg font-bold text-danger">
                      -{riskMetrics.cvar95}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-default-500">Sharpe Ratio</p>
                    <p className="text-lg font-bold">{riskMetrics.sharpe}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-default-500">
                    Diversification Benefit
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-default-100 rounded-full h-3">
                      <div
                        className="bg-success rounded-full h-3 transition-all"
                        style={{
                          width: `${Math.min(riskMetrics.diversificationBenefit, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {riskMetrics.diversificationBenefit}%
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
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
                              <td
                                key={j}
                                className={`p-2 text-center ${bg}`}
                              >
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

          {/* Stress Test — same style as crypto detail StressTestPanel */}
          {stressTest && (() => {
            const scenarios = stressTest.portfolioScenarios || [];
            const activeScenario = scenarios.find((s: any) => s.id === selectedScenario) || scenarios[0];
            const DARK_TEXT_SCENARIOS = ["covid-19", "china-mining-ban", "ust-crash"];
            const totalVal = stressTest.totalValue || 0;

            // Compute impact for active scenario
            const stressedValue = activeScenario ? activeScenario.newPrice : 0;
            const loss = totalVal - stressedValue;
            const lossPercent = totalVal > 0 ? (loss / totalVal) * 100 : 0;

            return (
              <div className="flex flex-col gap-4">
                {/* Summary Card */}
                <Card>
                  <CardBody className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-sm text-default-500 mb-1">Portfolio Value</p>
                        <p className="text-4xl font-bold">{formatCryptoPrice(totalVal)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-default-500 mb-1">Portfolio Beta</p>
                        <Chip
                          color={stressTest.portfolioBeta > 1.5 ? "danger" : stressTest.portfolioBeta > 1 ? "warning" : "success"}
                          size="lg"
                          variant="flat"
                        >
                          {stressTest.portfolioBeta.toFixed(2)}
                        </Chip>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Scenario Selection */}
                <Card>
                  <CardHeader>
                    <div>
                      <h3 className="text-lg font-semibold">Historical Scenarios</h3>
                      <p className="text-sm text-default-500">Select a crisis to simulate its impact on your portfolio</p>
                    </div>
                  </CardHeader>
                  <CardBody className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {scenarios.map((s: any) => {
                        const isSelected = selectedScenario === s.id;
                        const color = STRESS_SCENARIO_COLORS[s.id as StressScenarioId] || "#EA3943";
                        const needsDarkText = DARK_TEXT_SCENARIOS.includes(s.id);

                        return (
                          <Button
                            key={s.id}
                            className="h-auto py-2 px-4 transition-colors"
                            size="sm"
                            style={{
                              backgroundColor: isSelected ? color : "transparent",
                              borderColor: color,
                              color: isSelected ? (needsDarkText ? "#000" : "#fff") : undefined,
                            }}
                            variant="bordered"
                            onPress={() => setSelectedScenario(s.id)}
                          >
                            <span className="flex flex-col items-start">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs opacity-75">{s.marketShock.toFixed(1)}% shock</span>
                            </span>
                          </Button>
                        );
                      })}
                    </div>

                    {/* Impact details */}
                    {activeScenario && (
                      <div
                        className="mt-4 p-4 rounded-lg border-2"
                        style={{ borderColor: STRESS_SCENARIO_COLORS[activeScenario.id as StressScenarioId] || "#EA3943" }}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-semibold">{activeScenario.name}</h4>
                            <p className="text-sm text-default-500">{activeScenario.description}</p>
                          </div>
                        </div>

                        <div className="text-center mb-3 p-3 bg-danger-50 dark:bg-danger-50/10 rounded-lg">
                          <p className="text-lg font-semibold text-danger">
                            Market falls {Math.abs(activeScenario.marketShock).toFixed(1)}% over {activeScenario.durationDays} days
                          </p>
                        </div>

                        <div className="text-center mb-2">
                          <p className="text-sm text-default-500">Beta-adjusted loss for your portfolio:</p>
                        </div>

                        <div className="flex items-center justify-center gap-3 sm:gap-8 py-2">
                          <div className="text-center min-w-0 flex-shrink">
                            <p className="text-xs text-default-500 mb-1">Current</p>
                            <p className="text-lg sm:text-2xl font-bold truncate">{formatCryptoPrice(totalVal)}</p>
                          </div>
                          <TrendingDown className="text-danger flex-shrink-0" size={24} />
                          <div className="text-center min-w-0 flex-shrink">
                            <p className="text-xs text-default-500 mb-1">Stressed</p>
                            <p
                              className="text-lg sm:text-2xl font-bold truncate"
                              style={{ color: STRESS_SCENARIO_COLORS[activeScenario.id as StressScenarioId] || "#EA3943" }}
                            >
                              {formatCryptoPrice(stressedValue)}
                            </p>
                          </div>
                        </div>

                        <div className="text-center mt-2">
                          <Chip color="danger" size="lg" variant="flat">
                            {lossPercent.toFixed(2)}% loss ({formatCryptoPrice(loss)})
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
