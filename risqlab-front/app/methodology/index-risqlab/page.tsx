"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Calculator,
  TrendingUp,
  Filter,
  Scale,
  ArrowLeft,
  BookOpen,
} from "lucide-react";

import { title } from "@/components/primitives";
import { useScrollSpy } from "@/hooks/useScrollSpy";

const INDEX_SECTIONS = [
  "overview",
  "glossary",
  "parameters",
  "constituents",
  "calculation",
  "weighting",
  "example",
  "rebalancing",
];

export default function IndexMethodologyPage() {
  const router = useRouter();
  const spyActiveSection = useScrollSpy(INDEX_SECTIONS);
  const [clickedSection, setClickedSection] = useState<string | null>(null);

  const activeSection = clickedSection || spyActiveSection;

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);

    if (element) {
      setClickedSection(sectionId);
      element.scrollIntoView({ behavior: "smooth", block: "start" });

      // Reset clicked section after transition to let scroll-spy take over
      setTimeout(() => {
        setClickedSection(null);
      }, 1000);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      {/* Back Button */}
      <div>
        <Button
          startContent={<ArrowLeft size={18} />}
          variant="light"
          onPress={() => router.push("/methodology")}
        >
          Back
        </Button>
      </div>

      {/* Header */}
      <div className="text-center md:text-left">
        <h1 className={title()}>RisqLab 80 Index - Methodology</h1>
        <p className="text-lg text-default-600 mt-2">
          How we calculate the RisqLab 80 Index
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Table of Contents */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardBody className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5" />
                <h2 className="text-lg font-bold">Table of Contents</h2>
              </div>
              <nav className="flex flex-col gap-2">
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "overview" ? "flat" : "light"}
                  onPress={() => scrollToSection("overview")}
                >
                  Overview
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "glossary" ? "flat" : "light"}
                  onPress={() => scrollToSection("glossary")}
                >
                  Glossary
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "parameters" ? "flat" : "light"}
                  onPress={() => scrollToSection("parameters")}
                >
                  Base Parameters
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "constituents" ? "flat" : "light"}
                  onPress={() => scrollToSection("constituents")}
                >
                  Constituent Selection
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "calculation" ? "flat" : "light"}
                  onPress={() => scrollToSection("calculation")}
                >
                  Index Calculation
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "weighting" ? "flat" : "light"}
                  onPress={() => scrollToSection("weighting")}
                >
                  Weighting
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "example" ? "flat" : "light"}
                  onPress={() => scrollToSection("example")}
                >
                  Example
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "rebalancing" ? "flat" : "light"}
                  onPress={() => scrollToSection("rebalancing")}
                >
                  Rebalancing
                </Button>
              </nav>
            </CardBody>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Overview Section */}
          <Card id="overview">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Calculator className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Overview
                </h2>
              </div>
              <p className="text-default-600 mb-4">
                The <strong>RisqLab 80</strong> is a market-capitalization
                weighted cryptocurrency index that tracks the performance of the
                top 80 cryptocurrencies. This index provides a comprehensive
                view of the cryptocurrency market by focusing on the most
                significant assets while excluding stablecoins, wrapped tokens,
                and staked tokens.
              </p>
              <p className="text-default-600">
                Similar to traditional financial indices like the S&amp;P 500,
                the RisqLab 80 uses market capitalization weighting, meaning
                larger cryptocurrencies have a proportionally greater influence
                on the index value. This approach reflects actual market size
                and liquidity, automatically adjusting to market movements
                without arbitrary weighting decisions.
              </p>
            </CardBody>
          </Card>

          {/* Glossary Section */}
          <Card id="glossary">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">
                Glossary
              </h2>
              <div className="grid gap-4">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-bold text-lg">Market Capitalization</h3>
                  <p className="text-default-600">
                    The total market value of a cryptocurrency, calculated by
                    multiplying its current price by its circulating supply.
                  </p>
                  <code className="text-sm bg-default-100 px-2 py-1 rounded mt-2 inline-block">
                    Market Cap = Price × Circulating Supply
                  </code>
                </div>

                <div className="border-l-4 border-success pl-4">
                  <h3 className="font-bold text-lg">Index Level</h3>
                  <p className="text-default-600">
                    A numerical value representing the overall performance of
                    the index, starting from a base level of 100. Changes in the
                    index level indicate the percentage change in the total
                    market capitalization of the constituents.
                  </p>
                </div>

                <div className="border-l-4 border-warning pl-4">
                  <h3 className="font-bold text-lg">Divisor</h3>
                  <p className="text-default-600">
                    A constant value used to normalize the index to the base
                    level of 100. The divisor is calculated once at
                    initialization and remains constant unless manually adjusted
                    for methodology changes.
                  </p>
                </div>

                <div className="border-l-4 border-danger pl-4">
                  <h3 className="font-bold text-lg">Constituent</h3>
                  <p className="text-default-600">
                    A cryptocurrency included in the index. The RisqLab 80 Index
                    has up to 80 constituents selected based on market
                    capitalization and exclusion criteria.
                  </p>
                </div>

                <div className="border-l-4 border-secondary pl-4">
                  <h3 className="font-bold text-lg">Stablecoin</h3>
                  <p className="text-default-600">
                    Cryptocurrencies pegged to fiat currencies (like USDT, USDC)
                    that are excluded from the index as they don&apos;t reflect
                    crypto market dynamics.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-bold text-lg">Wrapped Token</h3>
                  <p className="text-default-600">
                    Derivative representations of existing assets (like WBTC for
                    Bitcoin) that are excluded to avoid double-counting.
                  </p>
                </div>

                <div className="border-l-4 border-success pl-4">
                  <h3 className="font-bold text-lg">Staked Token</h3>
                  <p className="text-default-600">
                    Tokens representing staked assets (like stETH for staked
                    Ethereum) that are excluded to prevent double-counting.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Base Parameters Section */}
          <Card id="parameters">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Scale className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Base Parameters
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-default-200">
                      <th className="text-left py-3 px-4">Parameter</th>
                      <th className="text-left py-3 px-4">Value</th>
                      <th className="text-left py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">Index Name</td>
                      <td className="py-3 px-4">
                        <Chip color="primary" size="sm">
                          RisqLab 80
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Official name of the index
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">Base Level</td>
                      <td className="py-3 px-4">
                        <Chip color="success" size="sm">
                          100
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Starting index level
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Max Constituents
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="warning" size="sm">
                          80
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Maximum number of cryptocurrencies in the index
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">
                        Update Frequency
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="danger" size="sm">
                          15 minutes
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Configurable recalculation interval
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Constituent Selection Section */}
          <Card id="constituents">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Filter className="w-6 h-6 text-warning" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Constituent Selection
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The selection process follows three main steps to identify the
                top 80 cryptocurrencies:
              </p>

              <div className="space-y-6">
                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 1: Market Data Retrieval
                  </h3>
                  <p className="text-default-600 mb-4">
                    We retrieve the most recent market data for all
                    cryptocurrencies, filtering for:
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>Only cryptocurrencies with Market Cap &gt; 0</li>
                    <li>Latest timestamp per cryptocurrency</li>
                    <li>Sorted by market capitalization (descending)</li>
                  </ul>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 2: Exclusion Filtering
                  </h3>
                  <p className="text-default-600 mb-4">
                    We exclude specific types of cryptocurrencies to ensure the
                    index accurately represents the true cryptocurrency market:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-left py-2 px-3">Reason</th>
                          <th className="text-left py-2 px-3">Examples</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-2 px-3">
                            <Chip color="danger" size="sm" variant="flat">
                              Stablecoins
                            </Chip>
                          </td>
                          <td className="py-2 px-3 text-sm text-default-600">
                            Pegged to fiat, don&apos;t reflect crypto dynamics
                          </td>
                          <td className="py-2 px-3 text-sm">USDT, USDC, DAI</td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-2 px-3">
                            <Chip color="warning" size="sm" variant="flat">
                              Wrapped Tokens
                            </Chip>
                          </td>
                          <td className="py-2 px-3 text-sm text-default-600">
                            Derivative representations of existing assets
                          </td>
                          <td className="py-2 px-3 text-sm">WBTC, WETH</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3">
                            <Chip color="secondary" size="sm" variant="flat">
                              Staked
                            </Chip>
                          </td>
                          <td className="py-2 px-3 text-sm text-default-600">
                            Would create double-counting
                          </td>
                          <td className="py-2 px-3 text-sm">stETH, rETH</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 3: Final Selection
                  </h3>
                  <p className="text-default-600">
                    After applying all filters, the top{" "}
                    <strong>80 cryptocurrencies</strong> by market
                    capitalization are selected as index constituents.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Index Calculation Section */}
          <Card id="calculation">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Calculator className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Index Calculation
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The index calculation follows a mathematical formula that
                ensures the index reflects the true market performance:
              </p>

              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-bold mb-3">
                    1. Divisor Initialization
                  </h3>
                  <p className="text-default-600 mb-4">
                    The divisor is calculated only once during the first
                    execution to anchor the index to the base level of 100:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div className="mb-2">
                      Divisor = Initial_Total_Market_Cap / Base_Level
                    </div>
                    <div>Divisor = Initial_Market_Cap / 100</div>
                  </div>
                  <p className="text-default-600 mt-4 text-sm">
                    <strong>Note:</strong> The divisor remains constant unless
                    manually adjusted for methodology changes.
                  </p>
                </div>

                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">
                    2. Total Market Capitalization
                  </h3>
                  <p className="text-default-600 mb-4">
                    Calculate the sum of all constituent market capitalizations:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>
                      Total_Market_Cap = Σ(Price_USD × Circulating_Supply)
                    </div>
                    <div className="text-xs text-default-500 mt-2">
                      for all 80 constituents
                    </div>
                  </div>
                </div>

                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    3. Index Level Calculation
                  </h3>
                  <p className="text-default-600 mb-4">
                    Divide the total market cap by the divisor:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>Index_Level = Total_Market_Cap / Divisor</div>
                  </div>
                  <p className="text-default-600 mb-4">Complete formula:</p>
                  <div className="bg-content1 p-6 rounded-lg overflow-x-auto">
                    <pre className="text-xs sm:text-sm whitespace-pre">
                      {`                n=80
                Σ  (P[i] × Q[i])
               i=1
Index_Level = ─────────────────────
                     D

Where:
  P[i] = USD price of cryptocurrency i
  Q[i] = Circulating supply of cryptocurrency i
  D    = Divisor (constant)
  n    = 80 constituents`}
                    </pre>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Weighting Section */}
          <Card id="weighting">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Constituent Weights
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Each constituent&apos;s weight in the index represents its
                proportion of the total market capitalization:
              </p>
              <div className="bg-default-50 p-6 rounded-lg">
                <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                  <div>
                    Weight[i] = (Market_Cap[i] / Total_Market_Cap) × 100
                  </div>
                  <div className="text-xs text-default-500 mt-2">
                    Where: Market_Cap[i] = Price_USD[i] × Circulating_Supply[i]
                  </div>
                </div>
                <ul className="list-disc list-inside text-default-600 space-y-2">
                  <li>Weights are expressed as percentages</li>
                  <li>All weights sum to 100%</li>
                  <li>
                    Larger market cap cryptocurrencies have proportionally
                    higher weights
                  </li>
                  <li>Weights automatically adjust with price movements</li>
                </ul>
              </div>
            </CardBody>
          </Card>

          {/* Example Section */}
          <Card id="example">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">
                Calculation Example
              </h2>

              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Initial Setup</h3>
                  <p className="text-default-600 mb-4">
                    Assume 80 selected cryptocurrencies with:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg space-y-2">
                    <div>
                      <strong>Total Market Cap:</strong> $2,500,000,000,000
                      ($2.5 Trillion)
                    </div>
                    <div>
                      <strong>Base Level:</strong> 100
                    </div>
                    <div className="pt-4 border-t border-default-200 mt-4">
                      <strong>Calculated Divisor:</strong> 2,500,000,000,000 /
                      100 ={" "}
                      <Chip className="ml-2" color="primary" size="sm">
                        25,000,000,000
                      </Chip>
                    </div>
                  </div>
                </div>

                <div className="bg-success/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Subsequent Calculation
                  </h3>
                  <p className="text-default-600 mb-4">
                    Later, the market has grown:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg space-y-2">
                    <div>
                      <strong>New Total Market Cap:</strong> $2,750,000,000,000
                      ($2.75 Trillion)
                    </div>
                    <div>
                      <strong>Divisor:</strong> 25,000,000,000 (constant)
                    </div>
                    <div className="pt-4 border-t border-default-200 mt-4">
                      <strong>New Index Level:</strong> 2,750,000,000,000 /
                      25,000,000,000 ={" "}
                      <Chip className="ml-2" color="success" size="sm">
                        110
                      </Chip>
                    </div>
                  </div>
                  <p className="text-default-600 mt-4">
                    This represents a <strong>10% increase</strong> from the
                    base level, directly reflecting the 10% growth in total
                    market capitalization.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Rebalancing Section */}
          <Card id="rebalancing">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">
                Maintenance &amp; Rebalancing
              </h2>

              <div className="space-y-4">
                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Automatic Rebalancing
                  </h3>
                  <p className="text-default-600 mb-4">
                    The index automatically rebalances on each calculation
                    (every 15 minutes):
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>
                      Constituents may enter or exit based on market cap ranking
                    </li>
                    <li>
                      Weights adjust automatically based on price movements
                    </li>
                    <li>No manual intervention required</li>
                  </ul>
                </div>

                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    Divisor Adjustments
                  </h3>
                  <p className="text-default-600 mb-4">
                    The divisor should only be manually adjusted for:
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>Corporate actions (splits, mergers)</li>
                    <li>Methodology changes</li>
                    <li>Index reconstitution events</li>
                  </ul>
                  <p className="text-default-600 mt-4 text-sm">
                    <strong>Note:</strong> Manual divisor adjustments are rare
                    and documented for transparency.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Back to Top */}
          <div className="flex justify-center">
            <Button
              color="primary"
              variant="flat"
              onPress={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Back to Top
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
