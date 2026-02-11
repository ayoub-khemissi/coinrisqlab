import { Activity, AlertTriangle, TrendingUp, Zap } from "lucide-react";

import { RiskLevel } from "@/types/volatility";

interface RiskLevelIndicatorProps {
  /**
   * Risk level
   */
  level: RiskLevel;
  /**
   * Size of the indicator
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show label text
   */
  showLabel?: boolean;
}

/**
 * Visual indicator for risk level with icon and color
 */
export function RiskLevelIndicator({
  level,
  size = "md",
  showLabel = true,
}: RiskLevelIndicatorProps) {
  const config = {
    low: {
      icon: Activity,
      color: "text-success",
      bg: "bg-success/10",
      label: "Low Risk",
      description: "Stable and predictable",
    },
    medium: {
      icon: TrendingUp,
      color: "text-warning",
      bg: "bg-warning/10",
      label: "Medium Risk",
      description: "Moderate volatility",
    },
    high: {
      icon: AlertTriangle,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      label: "High Risk",
      description: "Significant volatility",
    },
    extreme: {
      icon: Zap,
      color: "text-danger",
      bg: "bg-danger/20",
      label: "Extreme Risk",
      description: "Very high volatility",
    },
  };

  const { icon: Icon, color, bg, label, description } = config[level];

  const iconSizeMap = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const textSizeMap = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-lg ${bg}`}>
        <Icon className={color} size={iconSizeMap[size]} />
      </div>
      {showLabel && (
        <div>
          <p className={`font-semibold ${textSizeMap[size]} ${color}`}>
            {label}
          </p>
          <p className="text-xs text-default-500">{description}</p>
        </div>
      )}
    </div>
  );
}
