import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

import { PortfolioVolatilityConstituent } from "@/types/volatility";

interface VolatilityDistributionProps {
  /**
   * Array of constituents with volatility data
   */
  constituents: PortfolioVolatilityConstituent[];
  /**
   * Portfolio volatility for reference
   */
  portfolioVolatility: number;
  /**
   * Height of the chart
   */
  height?: number;
}

/**
 * Histogram showing the distribution of constituent volatilities
 */
export function VolatilityDistribution({
  constituents,
  portfolioVolatility,
  height = 300,
}: VolatilityDistributionProps) {
  // Calculate distribution bins
  const createBins = () => {
    const volatilities = constituents.map((c) => c.annualized_volatility * 100);
    const min = Math.min(...volatilities);
    const max = Math.max(...volatilities);

    // Create 10 bins
    const binCount = 10;
    const binSize = (max - min) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${(min + i * binSize).toFixed(0)}-${(min + (i + 1) * binSize).toFixed(0)}%`,
      rangeStart: min + i * binSize,
      rangeEnd: min + (i + 1) * binSize,
      count: 0,
    }));

    // Fill bins
    volatilities.forEach((vol) => {
      const binIndex = Math.min(
        Math.floor((vol - min) / binSize),
        binCount - 1,
      );

      bins[binIndex].count++;
    });

    return bins;
  };

  const bins = createBins();
  const portfolioVolPercent = portfolioVolatility * 100;

  // Calculate statistics
  const volatilities = constituents.map((c) => c.annualized_volatility * 100);
  const avgVolatility =
    volatilities.reduce((sum, vol) => sum + vol, 0) / volatilities.length;
  const minVolatility = Math.min(...volatilities);
  const maxVolatility = Math.max(...volatilities);

  // Find median
  const sortedVols = [...volatilities].sort((a, b) => a - b);
  const medianVolatility =
    sortedVols.length % 2 === 0
      ? (sortedVols[sortedVols.length / 2 - 1] +
          sortedVols[sortedVols.length / 2]) /
        2
      : sortedVols[Math.floor(sortedVols.length / 2)];

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">Minimum</p>
          <p className="font-bold text-success">{minVolatility.toFixed(2)}%</p>
        </div>
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">Average</p>
          <p className="font-bold">{avgVolatility.toFixed(2)}%</p>
        </div>
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">Median</p>
          <p className="font-bold">{medianVolatility.toFixed(2)}%</p>
        </div>
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">Maximum</p>
          <p className="font-bold text-danger">{maxVolatility.toFixed(2)}%</p>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={bins}>
            <XAxis
              dataKey="range"
              stroke="#6b7280"
              style={{ fontSize: "11px" }}
            />
            <YAxis
              label={{
                value: "Number of Cryptos",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: "12px", fill: "#6b7280" },
              }}
              stroke="#6b7280"
              style={{ fontSize: "12px" }}
            />

            {/* Portfolio volatility reference line */}
            <ReferenceLine
              label={{
                value: `Portfolio: ${portfolioVolPercent.toFixed(1)}%`,
                position: "top",
                style: {
                  fontSize: "11px",
                  fill: "#037bfc",
                  fontWeight: "bold",
                },
              }}
              stroke="#037bfc"
              strokeDasharray="5 5"
              strokeWidth={2}
              x={portfolioVolPercent}
            />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload[0]) {
                  const data = payload[0].payload;

                  return (
                    <div className="bg-content1 border border-default-200 rounded-lg p-3 shadow-lg">
                      <p className="text-sm font-semibold mb-1">{data.range}</p>
                      <p className="text-lg font-bold text-primary">
                        {data.count} cryptos
                      </p>
                    </div>
                  );
                }

                return null;
              }}
            />

            <Bar dataKey="count" fill="#037bfc" radius={[4, 4, 0, 0]}>
              {bins.map((entry, index) => {
                // Highlight bin containing portfolio volatility
                const isPortfolioBin =
                  portfolioVolPercent >= entry.rangeStart &&
                  portfolioVolPercent < entry.rangeEnd;

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isPortfolioBin ? "#22c55e" : "#037bfc"}
                    opacity={isPortfolioBin ? 1 : 0.7}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Explanation */}
      <div className="bg-primary/5 border-l-4 border-primary p-3 rounded">
        <p className="text-sm text-default-600">
          The distribution shows how constituent volatilities are spread. The
          portfolio volatility (
          <strong className="text-primary">
            {portfolioVolPercent.toFixed(2)}%
          </strong>
          ) is typically lower than most individual assets due to
          diversification.
        </p>
      </div>
    </div>
  );
}
