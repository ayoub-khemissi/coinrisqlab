import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";

interface VolatilitySparklineProps {
  /**
   * Array of volatility values
   */
  data: Array<{
    date: string;
    annualized_volatility: number;
  }>;
  /**
   * Height of the sparkline
   */
  height?: number;
  /**
   * Width of the sparkline
   */
  width?: number | `${number}%`;
  /**
   * Color of the line
   */
  color?: string;
}

/**
 * Mini sparkline chart for volatility trend visualization
 */
export function VolatilitySparkline({
  data,
  height = 40,
  width = "100%",
  color = "#037bfc",
}: VolatilitySparklineProps) {
  // Transform data for recharts
  const chartData = data.map((item) => ({
    value: item.annualized_volatility * 100, // Convert to percentage
  }));

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-default-100 rounded"
        style={{ height, width }}
      >
        <span className="text-xs text-default-400">No data</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer height={height} width={width}>
      <LineChart data={chartData}>
        <YAxis hide domain={["auto", "auto"]} />
        <Line
          activeDot={false}
          dataKey="value"
          dot={false}
          stroke={color}
          strokeWidth={2}
          type="linear"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
