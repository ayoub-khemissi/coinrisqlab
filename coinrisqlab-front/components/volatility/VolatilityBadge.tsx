import { Chip } from "@heroui/chip";

import {
  getRiskLevel,
  getRiskLevelColor,
} from "@/hooks/usePortfolioVolatility";

interface VolatilityBadgeProps {
  /**
   * Volatility value (annualized, as decimal, e.g., 0.45 for 45%)
   */
  value: number;
  /**
   * Type of volatility
   */
  type?: "annualized" | "daily";
  /**
   * Display format
   */
  format?: "percentage" | "decimal";
  /**
   * Size of the badge
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show risk level text
   */
  showRiskLevel?: boolean;
  /**
   * Variant of the chip
   */
  variant?: "solid" | "flat" | "bordered" | "light";
}

/**
 * Badge component to display volatility with appropriate color coding
 */
export function VolatilityBadge({
  value,
  type = "annualized",
  format = "percentage",
  size = "sm",
  showRiskLevel = false,
  variant = "flat",
}: VolatilityBadgeProps) {
  // Calculate risk level based on annualized value
  // If daily, approximate annualized for color coding: daily * sqrt(365) ~ daily * 19.1
  const annualizedValue = type === "daily" ? value * 19.1 : value;
  const riskLevel = getRiskLevel(annualizedValue);
  const color = getRiskLevelColor(riskLevel);

  // Format the value
  const displayValue =
    format === "percentage" ? `${(value * 100).toFixed(2)}%` : value.toFixed(4);

  // Get risk level label
  const riskLabelMap = {
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
    extreme: "Extreme Risk",
  };

  // Use custom styling for "high" risk level to get orange color
  if (riskLevel === "high") {
    return (
      <Chip
        className="bg-orange-500/10 text-orange-500"
        size={size}
        variant={variant}
      >
        {showRiskLevel ? riskLabelMap[riskLevel] : displayValue}
      </Chip>
    );
  }

  return (
    <Chip color={color} size={size} variant={variant}>
      {showRiskLevel ? riskLabelMap[riskLevel] : displayValue}
    </Chip>
  );
}
