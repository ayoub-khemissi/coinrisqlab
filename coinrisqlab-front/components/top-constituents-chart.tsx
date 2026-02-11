"use client";

import { useMemo, memo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useRouter } from "next/navigation";

import { IndexConstituent } from "@/types/index-details";

interface TopConstituentsChartProps {
  constituents: IndexConstituent[];
}

const COLORS = [
  "#FF6B35", // Orange
  "#3B82F6", // Blue
  "#10B981", // Green
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#14B8A6", // Teal
  "#94A3B8", // Slate gray for "Others"
];

// Threshold for constituents to be displayed
const THRESHOLD = 2;

function TopConstituentsChartComponent({
  constituents,
}: TopConstituentsChartProps) {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleClick = (symbol: string) => {
    if (symbol !== "Others") {
      router.push(`/crypto/${symbol}`);
    }
  };

  const chartData = useMemo(() => {
    if (!constituents || constituents.length === 0) return [];

    // Sort by weight descending
    const sorted = [...constituents].sort(
      (a, b) => parseFloat(b.weight_in_index) - parseFloat(a.weight_in_index),
    );

    // Split constituents: those >= THRESHOLD and those < THRESHOLD
    const aboveThreshold = sorted.filter(
      (c) => parseFloat(c.weight_in_index) >= THRESHOLD,
    );
    const belowThreshold = sorted.filter(
      (c) => parseFloat(c.weight_in_index) < THRESHOLD,
    );

    const data = aboveThreshold.map((constituent) => ({
      name: constituent.symbol,
      value: parseFloat(constituent.weight_in_index),
      displayValue: `${parseFloat(constituent.weight_in_index).toFixed(2)}%`,
    }));

    // Add "Others" if there are constituents below THRESHOLD
    if (belowThreshold.length > 0) {
      const othersWeight = belowThreshold.reduce(
        (sum, constituent) => sum + parseFloat(constituent.weight_in_index),
        0,
      );

      data.push({
        name: "Others",
        value: othersWeight,
        displayValue: `${othersWeight.toFixed(2)}%`,
      });
    }

    return data;
  }, [constituents]);

  const totalConstituents = constituents?.length || 0;

  // Adjust dimensions based on screen size
  const outerRadius = isMobile ? 100 : 140;
  const innerRadius = isMobile ? 60 : 80;
  const labelDistance = isMobile ? 15 : 25;

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius: currentOuterRadius,
    percent,
  }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = currentOuterRadius + labelDistance;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        className="fill-gray-900 dark:fill-white"
        dominantBaseline="central"
        fontSize={isMobile ? 10 : 12}
        fontWeight={600}
        textAnchor={x > cx ? "start" : "end"}
        x={x}
        y={y}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-content1 border border-default-200 rounded-lg shadow-lg px-4 py-2">
          <p className="text-sm font-semibold">{payload[0].name}</p>
          <p className="text-sm text-default-500">
            {payload[0].payload.displayValue}
          </p>
        </div>
      );
    }

    return null;
  };

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-[400px] text-default-500">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 w-full">
      <div
        className="w-full lg:w-1/2"
        style={{ height: isMobile ? "275px" : "400px" }}
      >
        <ResponsiveContainer
          height="100%"
          minHeight={isMobile ? 275 : 400}
          width="100%"
        >
          <PieChart>
            <Pie
              cx="50%"
              cy="50%"
              data={chartData}
              dataKey="value"
              fill="#8884d8"
              innerRadius={innerRadius}
              label={renderCustomLabel}
              labelLine={false}
              outerRadius={outerRadius}
              stroke="none"
              onClick={(data) => handleClick(data.name)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  style={{
                    cursor: entry.name !== "Others" ? "pointer" : "default",
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <text
              dominantBaseline="central"
              textAnchor="middle"
              x="50%"
              y="50%"
            >
              <tspan
                className="fill-gray-900 dark:fill-white"
                dy="-0.5em"
                fontSize={isMobile ? 24 : 32}
                fontWeight={700}
                x="50%"
              >
                {totalConstituents}
              </tspan>
              <tspan
                className="fill-gray-600 dark:fill-gray-400"
                dy="1.5em"
                fontSize={isMobile ? 12 : 14}
                x="50%"
              >
                Assets
              </tspan>
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full lg:w-1/2">
        <ul className="flex flex-col gap-3">
          {chartData.map((entry, index) => (
            <li key={`legend-${index}`}>
              {entry.name !== "Others" ? (
                <button
                  className="flex items-center justify-between gap-4 w-full cursor-pointer hover:bg-default-100 rounded-lg p-2 transition-colors text-left"
                  onClick={() => handleClick(entry.name)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{entry.name}</span>
                  </div>
                  <span className="text-sm text-default-500">
                    {entry.displayValue}
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-between gap-4 p-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{entry.name}</span>
                  </div>
                  <span className="text-sm text-default-500">
                    {entry.displayValue}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Export with memo to prevent unnecessary re-renders
export const TopConstituentsChart = memo(TopConstituentsChartComponent);
