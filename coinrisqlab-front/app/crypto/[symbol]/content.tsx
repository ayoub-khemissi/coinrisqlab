"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import {
  ArrowLeft,
  Globe,
  FileText,
  Twitter,
  MessageCircle,
  Github,
} from "lucide-react";

import { CryptoDetailResponse } from "@/types/crypto-detail";
import { RiskPanel, RiskPeriod } from "@/types/risk-metrics";
import { formatUSD, formatNumber } from "@/lib/formatters";
import { title } from "@/components/primitives";
import { API_BASE_URL } from "@/config/constants";
import { sStorage } from "@/lib/sessionStorage";
import {
  PanelSidebar,
  PricePanel,
  VolatilityPanel,
  StressTestPanel,
  VaRPanel,
  BetaPanel,
  SkewPanel,
  KurtosisPanel,
  SMLPanel,
} from "@/components/risk-panels";
import {
  useRiskSummary,
  usePriceHistory,
  useVaR,
  useBeta,
  useDistribution,
  useSML,
  useStressTest,
} from "@/hooks/useRiskMetrics";

const VALID_PANELS: RiskPanel[] = [
  "price",
  "volatility",
  "stress-test",
  "var",
  "beta",
  "skew",
  "kurtosis",
  "sml",
];

const CATEGORIES_VISIBLE = 5;

function CategoriesList({ categories }: { categories: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = categories.length > CATEGORIES_VISIBLE;
  const visible = expanded
    ? categories
    : categories.slice(0, CATEGORIES_VISIBLE);

  return (
    <div className="mt-4">
      <p className="text-sm text-default-500 mb-2">Categories:</p>
      <div className="flex flex-wrap gap-2 items-center">
        {visible.map((cat, index) => (
          <Chip key={index} size="sm" variant="flat">
            {cat}
          </Chip>
        ))}
        {hasMore && (
          <button
            className="text-xs text-primary cursor-pointer hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? "Show less"
              : `+${categories.length - CATEGORIES_VISIBLE} more`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function CryptoDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const symbol = params.symbol as string;

  const [data, setData] = useState<CryptoDetailResponse["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string>("/");

  // Get initial panel from URL or default to "price"
  const panelFromUrl = searchParams.get("panel") as RiskPanel | null;
  const initialPanel =
    panelFromUrl && VALID_PANELS.includes(panelFromUrl)
      ? panelFromUrl
      : "price";

  // Panel state
  const [activePanel, setActivePanel] = useState<RiskPanel>(initialPanel);
  const [period, setPeriod] = useState<RiskPeriod>("90d");

  // Risk metrics for sidebar
  const { data: riskSummary, isLoading: isRiskSummaryLoading } = useRiskSummary(
    symbol,
    period,
  );
  const { data: priceData } = usePriceHistory(symbol, period);

  // Fetch specific periods for sidebar consistency (stable vs recent estimates)
  const { data: var365Data } = useVaR(symbol, "365d");
  const { data: beta365Data } = useBeta(symbol, "365d");
  const { data: dist90Data } = useDistribution(symbol, "90d");
  const { data: sml90Data } = useSML(symbol, "90d");
  const { data: stressTestData } = useStressTest(symbol);

  // Update URL when panel changes
  const handlePanelChange = useCallback(
    (panel: RiskPanel) => {
      const params = new URLSearchParams(searchParams.toString());

      if (panel === "price") {
        params.delete("panel");
      } else {
        params.set("panel", panel);
      }

      router.replace(`?${params.toString()}`, { scroll: false });

      requestAnimationFrame(() => {
        const mainGrid = document.getElementById("main-grid");

        if (mainGrid) {
          const top =
            mainGrid.getBoundingClientRect().top + window.scrollY - 70;

          window.scrollTo({ behavior: "smooth", top });
        }
      });
    },
    [router, searchParams],
  );

  // Sync activePanel with URL on mount/URL change
  useEffect(() => {
    const panelParam = searchParams.get("panel") as RiskPanel | null;
    const validPanel =
      panelParam && VALID_PANELS.includes(panelParam) ? panelParam : "price";

    if (validPanel !== activePanel) {
      setActivePanel(validPanel);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCryptoDetail();

    // Get return path from sessionStorage
    const savedReturnPath = sStorage.get("CRYPTO_RETURN_PATH");

    if (savedReturnPath) {
      setReturnPath(savedReturnPath);
    }
  }, [symbol]);

  const fetchCryptoDetail = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/cryptocurrency/${symbol.toUpperCase()}`,
      );

      if (!response.ok) {
        if (response.status === 404) {
          setError(`Cryptocurrency ${symbol.toUpperCase()} not found`);
        } else {
          throw new Error("Failed to fetch cryptocurrency details");
        }

        return;
      }

      const result: CryptoDetailResponse = await response.json();

      setData(result.data);
    } catch {
      setError("Failed to load cryptocurrency details");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-lg text-danger">
          {error || "No data available"}
        </div>
        <Button onPress={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const { basic, links, launch, market } = data;

  const supplyPercentage = market.max_supply
    ? (market.circulating_supply / market.max_supply) * 100
    : market.total_supply
      ? (market.circulating_supply / market.total_supply) * 100
      : 0;

  const renderActivePanel = () => {
    switch (activePanel) {
      case "price":
        return (
          <PricePanel
            period={period}
            symbol={symbol}
            onPeriodChange={setPeriod}
          />
        );
      case "volatility":
        return (
          <VolatilityPanel
            period={period}
            symbol={symbol}
            onPeriodChange={setPeriod}
          />
        );
      case "stress-test":
        return <StressTestPanel symbol={symbol} />;
      case "var":
        return <VaRPanel symbol={symbol} />;
      case "beta":
        return <BetaPanel symbol={symbol} />;
      case "skew":
        return <SkewPanel symbol={symbol} />;
      case "kurtosis":
        return <KurtosisPanel symbol={symbol} />;
      case "sml":
        return <SMLPanel symbol={symbol} />;
      default:
        return null;
    }
  };

  return (
    <section className="flex flex-col gap-6">
      {/* Back Button */}
      <div>
        <Button
          startContent={<ArrowLeft size={18} />}
          variant="light"
          onPress={() => {
            router.push(returnPath);
          }}
        >
          Back
        </Button>
      </div>

      {/* Header - Always visible */}
      <div className="flex items-center gap-4">
        {basic.logo_url && (
          <Image
            alt={basic.name}
            className="w-16 h-16"
            height={64}
            src={basic.logo_url}
            width={64}
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={title()}>{basic.name}</h1>
            <Chip size="lg" variant="flat">
              {basic.symbol}
            </Chip>
            {market.rank && (
              <Chip color="default" size="sm" variant="bordered">
                Rank #{market.rank}
              </Chip>
            )}
            {market.index_rank && (
              <Chip color="primary" size="sm" variant="flat">
                CoinRisqLab 80 #{market.index_rank}
              </Chip>
            )}
          </div>
          {basic.categories.length > 0 && (
            <p className="text-default-500 mt-2">
              Category: {basic.categories[0]}
            </p>
          )}
        </div>
      </div>

      {/* Links */}
      {(links.website ||
        links.whitepaper ||
        links.twitter ||
        links.reddit ||
        links.telegram ||
        links.github) && (
          <div className="flex flex-wrap gap-2">
            {links.website && (
              <Button
                as="a"
                href={links.website}
                rel="noopener noreferrer"
                size="sm"
                startContent={<Globe size={16} />}
                target="_blank"
                variant="bordered"
              >
                Website
              </Button>
            )}
            {links.whitepaper && (
              <Button
                as="a"
                href={links.whitepaper}
                rel="noopener noreferrer"
                size="sm"
                startContent={<FileText size={16} />}
                target="_blank"
                variant="bordered"
              >
                Whitepaper
              </Button>
            )}
            {links.twitter && (
              <Button
                as="a"
                href={links.twitter}
                rel="noopener noreferrer"
                size="sm"
                startContent={<Twitter size={16} />}
                target="_blank"
                variant="bordered"
              >
                Twitter
              </Button>
            )}
            {links.telegram && (
              <Button
                as="a"
                href={links.telegram}
                rel="noopener noreferrer"
                size="sm"
                startContent={<MessageCircle size={16} />}
                target="_blank"
                variant="bordered"
              >
                Telegram
              </Button>
            )}
            {links.github && (
              <Button
                as="a"
                href={links.github}
                rel="noopener noreferrer"
                size="sm"
                startContent={<Github size={16} />}
                target="_blank"
                variant="bordered"
              >
                GitHub
              </Button>
            )}
          </div>
        )}

      {/* Main Grid: Sidebar + Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="main-grid">
        {/* Sidebar - First on mobile, sticky on desktop */}
        <div className="lg:col-span-1 order-1 lg:order-1">
          <PanelSidebar
            activePanel={activePanel}
            betaOverride={beta365Data?.beta}
            currentPrice={priceData?.current?.price}
            isLoading={isRiskSummaryLoading}
            kurtosisOverride={dist90Data?.kurtosis}
            riskSummary={riskSummary}
            skewnessOverride={dist90Data?.skewness}
            smlAlphaOverride={sml90Data?.alpha}
            stressImpactOverride={
              stressTestData?.scenarios.find((s) => s.id === "covid-19")
                ?.expectedImpact
            }
            symbol={symbol}
            var99Override={var365Data?.var99}
            onPanelChange={handlePanelChange}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 order-2 lg:order-2">
          {renderActivePanel()}
        </div>
      </div>

      {/* Market Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Market Cap</p>
            <p className="text-lg font-bold">
              {formatUSD(market.market_cap_usd)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Volume 24h</p>
            <p className="text-lg font-bold">
              {formatUSD(market.volume_24h_usd)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-sm text-default-500">Circulating Supply</p>
            <p className="text-lg font-bold">
              {formatNumber(market.circulating_supply)} {basic.symbol}
            </p>
          </CardBody>
        </Card>
        {market.fully_diluted_valuation && (
          <Card>
            <CardBody className="p-4">
              <p className="text-sm text-default-500">
                Fully Diluted Valuation
              </p>
              <p className="text-lg font-bold">
                {formatUSD(market.fully_diluted_valuation)}
              </p>
            </CardBody>
          </Card>
        )}
      </div>

      {/* Supply Information */}
      {(market.max_supply || market.total_supply) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Supply Information</h2>
          </CardHeader>
          <CardBody className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-default-500">Circulating</span>
                <span className="font-medium">
                  {formatNumber(market.circulating_supply)} {basic.symbol}
                </span>
              </div>
              {market.total_supply && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-default-500">Total Supply</span>
                  <span className="font-medium">
                    {formatNumber(market.total_supply)} {basic.symbol}
                  </span>
                </div>
              )}
              {market.max_supply && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-default-500">Max Supply</span>
                  <span className="font-medium">
                    {formatNumber(market.max_supply)} {basic.symbol}
                  </span>
                </div>
              )}
              {supplyPercentage > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-default-500">
                      Circulating %
                    </span>
                    <span className="font-medium">
                      {supplyPercentage.toFixed(2)}%
                    </span>
                  </div>
                  <Progress color="primary" value={supplyPercentage} />
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* About */}
      {basic.description && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">About {basic.name}</h2>
          </CardHeader>
          <CardBody className="p-6">
            <p className="text-default-700 whitespace-pre-wrap">
              {basic.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {launch.platform && (
                <div>
                  <span className="text-sm text-default-500">Platform: </span>
                  <span className="text-sm font-medium">{launch.platform}</span>
                </div>
              )}
              {launch.date && (
                <div>
                  <span className="text-sm text-default-500">Launched: </span>
                  <span className="text-sm font-medium">
                    {new Date(launch.date).toLocaleDateString()}
                  </span>
                </div>
              )}
              {basic.metadata_updated_at && (
                <div>
                  <span className="text-sm text-default-500">
                    Last updated:{" "}
                  </span>
                  <span className="text-sm font-medium">
                    {new Date(basic.metadata_updated_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            {basic.categories.length > 0 && (
              <CategoriesList categories={basic.categories} />
            )}
          </CardBody>
        </Card>
      )}
    </section>
  );
}
