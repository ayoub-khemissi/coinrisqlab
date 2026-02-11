"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { Info, Activity, AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Select, SelectItem } from "@heroui/select";

import { title } from "@/components/primitives";
import { PageLoader } from "@/components/page-loader";
import {
  usePortfolioVolatility,
  usePortfolioConstituentsVolatility,
  calculateDiversificationBenefit,
  calculateRiskContributions,
  getRiskLevel,
  getRiskLevelColorClass,
} from "@/hooks/usePortfolioVolatility";
import {
  RiskLevelIndicator,
  DiversificationMeter,
} from "@/components/volatility";
import {
  VolatilityChart,
  RiskContributorsTable,
  VolatilityDistribution,
  CorrelationCard,
} from "@/components/portfolio-risk";
import { useCryptoVolatility } from "@/hooks/useCryptoVolatility";
import { lStorage } from "@/lib/localStorage";

type Period = "7d" | "30d" | "90d" | "all";

export default function PortfolioRiskPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("90d");
  const [volatilityMode, setVolatilityMode] = useState<"annualized" | "daily">(
    "annualized",
  );
  const [selectedComparisonCryptos, setSelectedComparisonCryptos] = useState<
    string[]
  >([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [warningFading, setWarningFading] = useState(false);
  const [isConstituentsTooltipOpen, setIsConstituentsTooltipOpen] =
    useState(false);

  // Fetch portfolio volatility data
  const {
    data: volatilityData,
    isLoading: volatilityLoading,
    error: volatilityError,
  } = usePortfolioVolatility(selectedPeriod);

  // Fetch constituents volatility data
  const {
    data: constituentsData,
    isLoading: constituentsLoading,
    error: constituentsError,
  } = usePortfolioConstituentsVolatility();

  // Fetch comparison data
  const { data: comparisonData, isLoading: comparisonLoading } =
    useCryptoVolatility(selectedComparisonCryptos, selectedPeriod);

  // Update initial loading state
  if (isInitialLoading && !volatilityLoading && !constituentsLoading) {
    setIsInitialLoading(false);
  }

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load warning dismissed state from localStorage
  useEffect(() => {
    const dismissed = lStorage.get("PORTFOLIO_RISK_WARNING_DISMISSED");

    if (dismissed === "true") {
      setWarningDismissed(true);
    }
  }, []);

  // Calculate derived data
  const diversificationBenefit = useMemo(() => {
    if (!volatilityData?.current || !constituentsData) return null;

    return calculateDiversificationBenefit(
      volatilityData.current.annualized_volatility,
      constituentsData,
    );
  }, [volatilityData, constituentsData]);

  const riskContributions = useMemo(() => {
    if (!constituentsData) return [];

    return calculateRiskContributions(constituentsData);
  }, [constituentsData]);

  const riskLevel = useMemo(() => {
    if (!volatilityData?.current) return null;

    return getRiskLevel(volatilityData.current.annualized_volatility);
  }, [volatilityData]);

  // Scroll to risk contributors table if hash is present, then remove hash from URL
  useEffect(() => {
    if (
      window.location.hash === "#risk-contributors" &&
      riskContributions?.length > 0
    ) {
      // Wait for data to load and page to render
      const scrollToTable = () => {
        const element = document.getElementById("risk-contributors");

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          // Remove hash from URL to prevent auto-scroll on data updates
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      };

      // Try after a delay to ensure DOM is ready
      const timeoutId = setTimeout(scrollToTable, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [riskContributions]);

  // Handle hash on mount (when returning from crypto detail page)
  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash === "#risk-contributors") {
        const element = document.getElementById("risk-contributors");

        if (element) {
          // Wait a bit for the page to fully render
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            // Clean up the hash
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }, 300);
        }
      }
    };

    // Check on mount
    handleHashScroll();

    // Also listen for hash changes
    window.addEventListener("hashchange", handleHashScroll);

    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  // Loading state (only show full-page loader on initial load)
  if (isInitialLoading) {
    return <PageLoader message="Loading portfolio risk data..." />;
  }

  // Error state
  if (volatilityError || constituentsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg text-danger mb-2">
            Error loading portfolio risk data
          </p>
          <p className="text-sm text-default-500">
            {volatilityError?.message || constituentsError?.message}
          </p>
        </div>
      </div>
    );
  }

  // No data state
  if (!volatilityData?.current || !constituentsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-lg mb-2">No portfolio risk data available</p>
          <p className="text-sm text-default-500">
            Please check back later when data has been calculated.
          </p>
        </div>
      </div>
    );
  }

  const { current, history } = volatilityData;

  return (
    <section className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-3">
          <h1 className={title()}>Portfolio Risk Analysis</h1>
          <Link href="/methodology/volatility">
            <Button
              isIconOnly
              aria-label="How is volatility calculated?"
              color="primary"
              size="sm"
              title="How is volatility calculated?"
              variant="flat"
            >
              <Info size={18} />
            </Button>
          </Link>
        </div>
        <p className="text-lg text-default-600 mt-4">
          Comprehensive risk analysis for the CoinRisqLab 80 Index
        </p>
      </div>

      {/* Warning for insufficient data */}
      {current.window_days < 90 && !warningDismissed && (
        <Card
          className={`bg-warning/10 border border-warning transition-opacity duration-300 ${warningFading ? "opacity-0" : "opacity-100"}`}
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <AlertTriangle
                  className="text-warning mt-0.5 flex-shrink-0"
                  size={20}
                />
                <div>
                  <h3 className="font-semibold text-warning mb-1">
                    Limited Historical Data
                  </h3>
                  <p className="text-sm text-default-700">
                    The portfolio volatility calculations are currently based on{" "}
                    <strong>{current.window_days} days</strong> of historical
                    data. For optimal statistical accuracy, we recommend at
                    least <strong>90 days</strong> of data. Results may be less
                    reliable until sufficient historical data is available.
                  </p>
                </div>
              </div>
              <Button
                isIconOnly
                className="flex-shrink-0"
                size="sm"
                variant="light"
                onPress={() => {
                  setWarningFading(true);
                  setTimeout(() => {
                    setWarningDismissed(true);
                    lStorage.set("PORTFOLIO_RISK_WARNING_DISMISSED", "true");
                  }, 300); // Wait for fade-out animation to complete
                }}
              >
                <X className="text-warning" size={18} />
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Current Volatility */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-primary" size={20} />
              <h3 className="font-semibold">Current Volatility</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p
                  className={clsx(
                    "text-3xl font-bold",
                    getRiskLevelColorClass(riskLevel || "low"),
                  )}
                >
                  {(current.annualized_volatility * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-default-500">Annualized</p>
              </div>
              <div>
                <p
                  className={clsx(
                    "text-lg",
                    getRiskLevelColorClass(riskLevel || "low"),
                  )}
                >
                  {(current.daily_volatility * 100).toFixed(3)}%
                </p>
                <p className="text-xs text-default-500">Daily</p>
              </div>
              <div className="pt-2">
                {riskLevel && (
                  <RiskLevelIndicator level={riskLevel} size="lg" />
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Correlation */}
        <Card>
          <CardBody className="p-6">
            <CorrelationCard constituents={constituentsData} />
          </CardBody>
        </Card>

        {/* Portfolio Info */}
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="text-primary" size={20} />
              <h3 className="font-semibold">Portfolio Details</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Constituents</span>
                <div className="flex items-center gap-2">
                  {current.num_constituents < 80 && (
                    <Tooltip
                      content={
                        <div className="px-1 py-2 max-w-xs">
                          <div className="text-small font-bold">
                            Fewer Than 80 Constituents
                          </div>
                          <div className="text-tiny">
                            The index has fewer than 80 constituents due to
                            insufficient historical data for some candidates.
                          </div>
                        </div>
                      }
                      isOpen={isConstituentsTooltipOpen}
                    >
                      <AlertTriangle
                        className="text-warning cursor-help"
                        size={16}
                        onClick={() =>
                          setIsConstituentsTooltipOpen(
                            !isConstituentsTooltipOpen,
                          )
                        }
                        onMouseLeave={() => setIsConstituentsTooltipOpen(false)}
                        onMouseOver={() => setIsConstituentsTooltipOpen(true)}
                      />
                    </Tooltip>
                  )}
                  <Chip color="primary" size="sm" variant="flat">
                    {current.num_constituents}
                  </Chip>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Window</span>
                <span className="text-sm font-medium">
                  {current.window_days} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-default-500">Last Updated</span>
                <span className="text-sm font-medium">
                  {new Date(current.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Volatility Timeline Chart */}
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold">Volatility Over Time</h2>
              <div className="flex gap-2">
                {(["7d", "30d", "90d", "all"] as Period[]).map((period) => (
                  <Button
                    key={period}
                    isDisabled={volatilityLoading}
                    size="sm"
                    variant={selectedPeriod === period ? "solid" : "bordered"}
                    onPress={() => setSelectedPeriod(period)}
                  >
                    {period === "all" ? "All" : period}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={
                    volatilityMode === "annualized" ? "solid" : "bordered"
                  }
                  onPress={() => setVolatilityMode("annualized")}
                >
                  Annualized
                </Button>
                <Button
                  size="sm"
                  variant={volatilityMode === "daily" ? "solid" : "bordered"}
                  onPress={() => setVolatilityMode("daily")}
                >
                  Daily
                </Button>
              </div>

              <div className="w-full sm:w-72">
                <Select
                  aria-label="Compare with cryptocurrencies"
                  isDisabled={!constituentsData}
                  placeholder="Compare with..."
                  selectedKeys={selectedComparisonCryptos}
                  selectionMode="multiple"
                  size="sm"
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys) as string[];

                    if (selected.length <= 5) {
                      setSelectedComparisonCryptos(selected);
                    }
                  }}
                >
                  {(constituentsData || []).map((c) => (
                    <SelectItem key={c.coingecko_id} textValue={c.symbol}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{c.symbol}</span>
                        <span className="text-tiny text-default-400 truncate max-w-[100px]">
                          {c.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </Select>
                <p className="text-tiny text-default-400 mt-1 ml-1">
                  Select up to 5 cryptocurrencies to compare
                </p>
              </div>
            </div>
          </div>

          <div
            className="h-64 md:h-96 transition-opacity"
            style={{
              opacity: volatilityLoading || comparisonLoading ? 0.5 : 1,
            }}
          >
            <VolatilityChart
              comparisonData={comparisonData}
              data={history}
              mode={volatilityMode}
            />
          </div>
          {history && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {history.length} data points
            </p>
          )}
        </CardBody>
      </Card>

      {/* Diversification Benefit */}
      {diversificationBenefit && (
        <Card>
          <CardBody className="p-6">
            <DiversificationMeter benefit={diversificationBenefit} size="md" />
          </CardBody>
        </Card>
      )}

      {/* Risk Contributors */}
      <Card id="risk-contributors">
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold mb-4">Risk Contributors</h2>
          <p className="text-sm text-default-500 mb-6">
            How each constituent contributes to the overall portfolio risk
          </p>
          <RiskContributorsTable contributors={riskContributions} />
        </CardBody>
      </Card>

      {/* Volatility Distribution */}
      <Card>
        <CardBody className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Volatility Distribution
          </h2>
          <p className="text-sm text-default-500 mb-6">
            Distribution of individual constituent volatilities
          </p>
          <VolatilityDistribution
            constituents={constituentsData}
            height={isMobile ? 250 : 350}
            portfolioVolatility={current.annualized_volatility}
          />
          {constituentsData && (
            <p className="text-xs text-default-400 mt-2 text-right">
              {constituentsData.length} constituents
            </p>
          )}
        </CardBody>
      </Card>

      {/* Methodology Link */}
      <Card className="bg-primary/5 border border-primary/20">
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">
                How is volatility calculated?
              </h3>
              <p className="text-sm text-default-600">
                Learn about the mathematical methodology behind our volatility
                calculations, including logarithmic returns, covariance
                matrices, and the diversification benefit.
              </p>
            </div>
            <Link href="/methodology/volatility">
              <Button color="primary" endContent={<Info size={18} />}>
                View Methodology
              </Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    </section>
  );
}
