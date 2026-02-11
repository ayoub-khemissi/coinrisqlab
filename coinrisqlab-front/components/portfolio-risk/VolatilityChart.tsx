import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";

import {
  PortfolioVolatility,
  CryptoVolatilityResponse,
} from "@/types/volatility";

interface ComparisonData {
  symbol: string;
  data: CryptoVolatilityResponse["data"];
  color: string;
}

interface VolatilityChartProps {
  /**
   * Historical volatility data
   */
  data: PortfolioVolatility[];
  /**
   * Comparison data for selected cryptocurrencies
   */
  comparisonData?: ComparisonData[];
  /**
   * Display mode: annualized or daily
   */
  mode?: "annualized" | "daily";
  /**
   * Height of the chart (optional - defaults to 100% of parent container)
   */
  height?: number | string;
}

/**
 * Line chart showing portfolio volatility over time
 */
export function VolatilityChart({
  data,
  comparisonData = [],
  mode = "annualized",
  height = "100%",
}: VolatilityChartProps) {
  // Transform data for chart
  // We need to merge portfolio data with comparison data based on date
  const chartData = data.map((item) => {
    const dataPoint: any = {
      date: item.date,
      portfolio:
        mode === "annualized"
          ? item.annualized_volatility * 100
          : item.daily_volatility * 100,
      timestamp: new Date(item.date).getTime(),
    };

    // Add comparison data
    comparisonData.forEach((comp) => {
      const compItem = comp.data.history.find(
        (h) => h.date.split("T")[0] === item.date.split("T")[0],
      );

      if (compItem) {
        dataPoint[comp.symbol] =
          mode === "annualized"
            ? compItem.annualized_volatility * 100
            : compItem.daily_volatility * 100;
      }
    });

    return dataPoint;
  });

  // Calculate average volatility for portfolio
  const avgVolatility =
    chartData.reduce((sum, item) => sum + item.portfolio, 0) / chartData.length;

  // Define risk zones based on mode
  const riskZones =
    mode === "annualized"
      ? [
          { value: 60, label: "Extreme Risk (≥60%)", color: "#ef4444" },
          { value: 30, label: "High Risk (≥30%)", color: "#ea580c" },
          { value: 10, label: "Medium Risk (≥10%)", color: "#F3D42F" },
        ]
      : [
          { value: 3.0, label: "Extreme Risk (≥3.0%)", color: "#ef4444" },
          { value: 1.5, label: "High Risk (≥1.5%)", color: "#ea580c" },
          { value: 0.5, label: "Medium Risk (≥0.5%)", color: "#F3D42F" },
        ];

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={chartData}>
          <CartesianGrid opacity={0.1} strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) => {
              const date = new Date(value);

              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
          />

          <YAxis
            domain={["auto", "auto"]}
            label={{
              value: `${mode === "annualized" ? "Annualized" : "Daily"} Volatility (%)`,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: "12px", fill: "#6b7280" },
            }}
            stroke="#6b7280"
            style={{ fontSize: "12px" }}
            tickFormatter={(value) =>
              `${value.toFixed(mode === "annualized" ? 0 : 1)}%`
            }
          />

          {/* Reference line for average */}
          <ReferenceLine
            label={{
              value: `Avg: ${avgVolatility.toFixed(mode === "annualized" ? 1 : 2)}%`,
              position: "right",
              style: { fontSize: "11px", fill: "#6b7280" },
            }}
            stroke="#6b7280"
            strokeDasharray="5 5"
            y={avgVolatility}
          />

          {/* Risk zones */}
          {riskZones.map((zone) => (
            <ReferenceLine
              key={zone.value}
              label={{
                value: zone.label,
                position: "right",
                style: { fontSize: "10px", fill: zone.color },
              }}
              stroke={zone.color}
              strokeDasharray="3 3"
              strokeOpacity={0.3}
              y={zone.value}
            />
          ))}

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload;

                return (
                  <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-semibold mb-2">
                      {new Date(data.date).toLocaleString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>

                    {/* Portfolio */}
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#037bfc]" />
                        <span className="text-sm text-default-500">
                          Portfolio
                        </span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {data.portfolio.toFixed(2)}%
                      </span>
                    </div>

                    {/* Comparison Cryptos */}
                    {comparisonData.map((comp) => {
                      if (data[comp.symbol] !== undefined) {
                        return (
                          <div
                            key={comp.symbol}
                            className="flex items-center justify-between gap-4 mb-1"
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: comp.color }}
                              />
                              <span className="text-sm text-default-500">
                                {comp.symbol}
                              </span>
                            </div>
                            <span
                              className="text-sm font-bold"
                              style={{ color: comp.color }}
                            >
                              {data[comp.symbol].toFixed(2)}%
                            </span>
                          </div>
                        );
                      }

                      return null;
                    })}
                  </div>
                );
              }

              return null;
            }}
          />

          <Legend />

          <Line
            activeDot={{ r: 6 }}
            dataKey="portfolio"
            dot={false}
            name="Portfolio"
            stroke="#037bfc"
            strokeWidth={3}
            type="linear"
          />

          {comparisonData.map((comp) => (
            <Line
              key={comp.symbol}
              activeDot={{ r: 6 }}
              dataKey={comp.symbol}
              dot={false}
              name={comp.symbol}
              stroke={comp.color}
              strokeWidth={2}
              type="linear"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
