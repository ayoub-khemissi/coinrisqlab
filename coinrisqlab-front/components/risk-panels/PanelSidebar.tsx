"use client";

import { memo } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import {
  DollarSign,
  Activity,
  AlertTriangle,
  Shield,
  TrendingUp,
  BarChart2,
  GitBranch,
} from "lucide-react";

import {
  RiskPanel,
  PANEL_CONFIGS,
  RiskSummaryData,
} from "@/types/risk-metrics";
import { formatCryptoPrice } from "@/lib/formatters";
import { useBinancePrice } from "@/hooks/useBinancePrices";

interface PanelSidebarProps {
  activePanel: RiskPanel;
  onPanelChange: (panel: RiskPanel) => void;
  currentPrice?: number | null;
  riskSummary?: RiskSummaryData | null;
  isLoading?: boolean;
  symbol: string;
  var99Override?: number | null;
  betaOverride?: number | null;
  skewnessOverride?: number | null;
  kurtosisOverride?: number | null;
  smlAlphaOverride?: number | null;
  stressImpactOverride?: number | null;
}

const PANEL_ICONS: Record<RiskPanel, React.ReactNode> = {
  price: <DollarSign size={18} />,
  volatility: <Activity size={18} />,
  "stress-test": <AlertTriangle size={18} />,
  var: <Shield size={18} />,
  beta: <TrendingUp size={18} />,
  skew: <BarChart2 size={18} />,
  kurtosis: <Activity size={18} />,
  sml: <GitBranch size={18} />,
};

// Memoized component for live price display to avoid re-rendering parent
const LivePriceValue = memo(function LivePriceValue({
  symbol,
  initialPrice,
}: {
  symbol: string;
  initialPrice?: number | null;
}) {
  const livePrice = useBinancePrice(symbol, initialPrice);
  const displayPrice = livePrice ?? initialPrice;

  if (!displayPrice) return null;

  return (
    <span className="text-xs text-foreground font-mono font-semibold ml-2">
      {formatCryptoPrice(displayPrice)}
    </span>
  );
});

// New component for dynamic stress test display
const LiveStressTestValue = memo(function LiveStressTestValue({
  symbol,
  initialPrice,
  impactPercentage,
}: {
  symbol: string;
  initialPrice?: number | null;
  impactPercentage: number;
}) {
  const livePrice = useBinancePrice(symbol, initialPrice);
  const displayPrice = livePrice ?? initialPrice;

  if (!displayPrice) {
    return (
      <span className="text-xs text-foreground font-mono font-semibold ml-2">
        N/A
      </span>
    );
  }

  // Calculate stressed price based on current live price
  const stressedPrice = displayPrice * (1 + impactPercentage / 100);

  return (
    <span className="text-xs text-foreground font-mono font-semibold ml-2">
      {formatCryptoPrice(stressedPrice)}
    </span>
  );
});

function formatMetricValue(
  panelId: RiskPanel,
  riskSummary?: RiskSummaryData | null,
  var99Override?: number | null,
  betaOverride?: number | null,
  skewnessOverride?: number | null,
  kurtosisOverride?: number | null,
  smlAlphaOverride?: number | null,
  stressImpactOverride?: number | null,
): string | null {
  if (!riskSummary) return null;

  switch (panelId) {
    case "volatility":
      return riskSummary?.volatility?.annualized != null
        ? `${riskSummary.volatility.annualized.toFixed(2)}%`
        : null;
    case "stress-test":
      const impact =
        stressImpactOverride ?? riskSummary?.stressTest?.impactPercentage;

      return impact != null ? `${impact.toFixed(2)}%` : null;
    case "var":
      // Use override (365d) if provided, otherwise summary value
      const varValue = var99Override ?? riskSummary?.var99;

      return varValue != null ? `-${varValue.toFixed(2)}%` : null;
    case "beta":
      const betaValue = betaOverride ?? riskSummary?.beta;

      return betaValue != null ? betaValue.toFixed(2) : null;
    case "skew":
      const skewValue = skewnessOverride ?? riskSummary?.skewness;

      return skewValue != null ? skewValue.toFixed(2) : null;
    case "kurtosis":
      const kurtValue = kurtosisOverride ?? riskSummary?.kurtosis;

      return kurtValue != null ? kurtValue.toFixed(2) : null;
    case "sml":
      const smlAlpha = smlAlphaOverride ?? riskSummary?.sml?.alpha;

      return smlAlpha != null
        ? `${smlAlpha >= 0 ? "+" : ""}${smlAlpha.toFixed(2)}%`
        : null;
    default:
      return null;
  }
}

export function PanelSidebar({
  activePanel,
  onPanelChange,
  currentPrice,
  riskSummary,
  isLoading,
  symbol,
  var99Override,
  betaOverride,
  skewnessOverride,
  kurtosisOverride,
  smlAlphaOverride,
  stressImpactOverride,
}: PanelSidebarProps) {
  const handleSelectionChange = (keys: "all" | Set<React.Key>) => {
    if (keys !== "all" && keys.size > 0) {
      const selectedKey = Array.from(keys)[0] as RiskPanel;

      onPanelChange(selectedKey);
    }
  };

  const activeConfig = PANEL_CONFIGS.find((p) => p.id === activePanel);

  // Render metric value - use LivePriceValue for price panel
  const renderMetricValue = (panelId: RiskPanel, isSmall = false) => {
    if (panelId === "price") {
      return <LivePriceValue initialPrice={currentPrice} symbol={symbol} />;
    }

    if (
      panelId === "stress-test" &&
      (stressImpactOverride || riskSummary?.stressTest)
    ) {
      return (
        <LiveStressTestValue
          impactPercentage={
            stressImpactOverride ?? riskSummary!.stressTest!.impactPercentage
          }
          initialPrice={currentPrice}
          symbol={symbol}
        />
      );
    }

    const metricValue = formatMetricValue(
      panelId,
      riskSummary,
      var99Override,
      betaOverride,
      skewnessOverride,
      kurtosisOverride,
      smlAlphaOverride,
      stressImpactOverride,
    );

    if (!metricValue || isLoading) return null;

    return (
      <span
        className={`text-xs font-mono ${isSmall ? "text-default-500 ml-2" : "text-foreground font-semibold ml-2"}`}
      >
        {metricValue}
      </span>
    );
  };

  return (
    <>
      {/* Mobile: Select dropdown in card */}
      <Card className="md:hidden sticky top-4 z-10">
        <CardBody className="p-3">
          <p className="text-sm font-semibold text-default-500 mb-3 text-center">
            Select a risk metric
          </p>
          <Select
            aria-label="Select risk metric"
            classNames={{
              trigger: "bg-default-100",
              value: "text-small",
            }}
            renderValue={() => (
              <div className="flex items-center justify-between w-full">
                <span>{activeConfig?.label}</span>
                {renderMetricValue(activePanel, true)}
              </div>
            )}
            selectedKeys={[activePanel]}
            size="sm"
            startContent={PANEL_ICONS[activePanel]}
            onSelectionChange={handleSelectionChange}
          >
            {PANEL_CONFIGS.map((panel) => (
              <SelectItem
                key={panel.id}
                startContent={PANEL_ICONS[panel.id]}
                textValue={panel.label}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{panel.label}</span>
                  {renderMetricValue(panel.id, true)}
                </div>
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Desktop: Expanded button list */}
      <Card className="hidden md:block sticky top-6">
        <CardBody className="p-3">
          <p className="text-sm font-semibold text-default-500 mb-3 px-1">
            Risk Metrics
          </p>

          <div className="flex flex-col gap-1">
            {PANEL_CONFIGS.map((panel) => (
              <Button
                key={panel.id}
                className="justify-between h-auto py-2.5 px-3"
                size="sm"
                variant={activePanel === panel.id ? "flat" : "light"}
                onPress={() => onPanelChange(panel.id)}
              >
                <div className="flex items-center gap-2">
                  {PANEL_ICONS[panel.id]}
                  <span>{panel.label}</span>
                </div>
                {renderMetricValue(panel.id)}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
