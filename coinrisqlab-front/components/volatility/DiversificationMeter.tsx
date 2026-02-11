import { Progress } from "@heroui/progress";
import { TrendingDown } from "lucide-react";

import { DiversificationBenefit } from "@/types/volatility";

interface DiversificationMeterProps {
  /**
   * Diversification benefit data
   */
  benefit: DiversificationBenefit;
  /**
   * Size of the meter
   */
  size?: "sm" | "md" | "lg";
}

/**
 * Visual meter showing the diversification benefit
 * Displays how much risk is reduced by diversification
 */
export function DiversificationMeter({
  benefit,
  size = "md",
}: DiversificationMeterProps) {
  const {
    benefitPercentage,
    benefitAbsolute,
    portfolioVolatility,
    weightedAverageVolatility,
  } = benefit;

  // Calculate progress value (0-100)
  const progressValue = Math.min(Math.max(benefitPercentage, 0), 100);

  // Determine color based on benefit level
  const getColor = () => {
    if (benefitPercentage >= 20) return "success";
    if (benefitPercentage >= 10) return "warning";

    return "default";
  };

  const textSizeMap = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="text-success" size={20} />
          <h3 className={`font-semibold ${textSizeMap[size]}`}>
            Diversification Benefit
          </h3>
        </div>
        <div className="text-right">
          <p className="text-success font-bold text-lg">
            {benefitPercentage.toFixed(1)}%
          </p>
          <p className="text-xs text-default-500">Risk Reduction</p>
        </div>
      </div>

      {/* Progress bar */}
      <Progress
        aria-label="Diversification benefit"
        color={getColor()}
        size={size}
        value={progressValue}
      />

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">Portfolio Volatility</p>
          <p className="font-semibold text-success">
            {(portfolioVolatility * 100).toFixed(2)}%
          </p>
        </div>
        <div className="text-center p-3 bg-default-50 rounded-lg">
          <p className="text-xs text-default-500 mb-1">
            Weighted Avg Volatility
          </p>
          <p className="font-semibold text-default-600">
            {(weightedAverageVolatility * 100).toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-success/5 border-l-4 border-success p-3 rounded">
        <p className="text-xs text-default-600">
          Your portfolio volatility is{" "}
          <strong className="text-success">
            {(benefitAbsolute * 100).toFixed(2)}% lower
          </strong>{" "}
          than the weighted average of individual assets, thanks to
          diversification.
        </p>
      </div>
    </div>
  );
}
