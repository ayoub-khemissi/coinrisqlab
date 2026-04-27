"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  TrendingUp,
  Activity,
  Calculator,
  ArrowLeft,
  BookOpen,
  GitBranch,
  BarChart3,
} from "lucide-react";

import { Math } from "@/components/math";
import { title } from "@/components/primitives";
import { useScrollSpy } from "@/hooks/useScrollSpy";

const VOLATILITY_SECTIONS = [
  "overview",
  "glossary",
  "risk-levels",
  "parameters",
  "pipeline",
  "stage1",
  "stage2",
  "examples",
  "diversification",
];

export default function VolatilityMethodologyPage() {
  const router = useRouter();
  const spyActiveSection = useScrollSpy(VOLATILITY_SECTIONS);
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
        <h1 className={title()}>Volatility Calculation - Methodology</h1>
        <p className="text-lg text-default-600 mt-2">
          How we measure risk and volatility
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
                  variant={activeSection === "risk-levels" ? "flat" : "light"}
                  onPress={() => scrollToSection("risk-levels")}
                >
                  Risk Levels
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
                  variant={activeSection === "pipeline" ? "flat" : "light"}
                  onPress={() => scrollToSection("pipeline")}
                >
                  Calculation Pipeline
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "stage1" ? "flat" : "light"}
                  onPress={() => scrollToSection("stage1")}
                >
                  Stage 1: Log Returns
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "stage2" ? "flat" : "light"}
                  onPress={() => scrollToSection("stage2")}
                >
                  Stage 2: Portfolio Volatility
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "examples" ? "flat" : "light"}
                  onPress={() => scrollToSection("examples")}
                >
                  Examples
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={
                    activeSection === "diversification" ? "flat" : "light"
                  }
                  onPress={() => scrollToSection("diversification")}
                >
                  Diversification Benefit
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
                <TrendingUp className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Overview
                </h2>
              </div>
              <p className="text-default-600 mb-4">
                Market volatility measures the overall risk of the CoinRisqLab
                80 Index portfolio. It captures how the combined value of the
                portfolio fluctuates over time, accounting for both individual
                asset movements and the correlations between them.
              </p>
              <p className="text-default-600 mb-4">
                Portfolio volatility is estimated using historical price data
                over a <strong>90-day rolling window</strong>. The procedure
                consists of two main steps: computing{" "}
                <strong>logarithmic returns</strong> for each constituent, then
                calculating portfolio-level volatility using{" "}
                <strong>market-cap weighting</strong> and the full{" "}
                <strong>covariance matrix</strong> to account for correlations
                between constituents.
              </p>
              <p className="text-default-600">
                For individual cryptocurrency volatility, see the{" "}
                <a
                  className="text-primary hover:underline"
                  href="/methodology/risk-metrics#volatility"
                >
                  Risk Metrics methodology
                </a>
                .
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
                  <h3 className="font-bold text-lg">Volatility</h3>
                  <p className="text-default-600">
                    Measures the degree of variation in an asset&apos;s returns
                    over time. It reflects the typical magnitude of price
                    fluctuations and represents the level of risk or uncertainty
                    associated with the asset&apos;s price movements.
                  </p>
                </div>

                <div className="border-l-4 border-success pl-4">
                  <h3 className="font-bold text-lg">Logarithmic Returns</h3>
                  <p className="text-default-600 mb-2">
                    The natural logarithm of the ratio of consecutive prices.
                    Logarithmic returns have better statistical properties than
                    simple percentage returns.
                  </p>
                  <Math>
                    {
                      "r_t = \\ln\\left(\\frac{P_{\\text{today}}}{P_{\\text{yesterday}}}\\right)"
                    }
                  </Math>
                </div>

                <div className="border-l-4 border-warning pl-4">
                  <h3 className="font-bold text-lg">Standard Deviation</h3>
                  <p className="text-default-600">
                    A measure of the amount of variation in a set of values. In
                    finance, the standard deviation of returns is used as a
                    measure of volatility.
                  </p>
                </div>

                <div className="border-l-4 border-danger pl-4">
                  <h3 className="font-bold text-lg">Annualization</h3>
                  <p className="text-default-600 mb-2">
                    The process of converting a daily volatility measure to an
                    annual equivalent by multiplying by the square root of the
                    number of trading periods in a year.
                  </p>
                  <Math>
                    {
                      "\\sigma_{\\text{annual}} = \\sigma_{\\text{daily}} \\times \\sqrt{365}"
                    }
                  </Math>
                </div>

                <div className="border-l-4 border-secondary pl-4">
                  <h3 className="font-bold text-lg">Rolling Window</h3>
                  <p className="text-default-600">
                    A fixed-size time period (e.g., 90 days) that slides forward
                    in time. Each calculation uses the most recent N
                    observations, providing a moving view of volatility.
                  </p>
                </div>

                <div className="border-l-4 border-primary pl-4">
                  <h3 className="font-bold text-lg">Covariance Matrix</h3>
                  <p className="text-default-600">
                    A square matrix showing the covariance between pairs of
                    assets. Used to capture how different assets move together,
                    essential for portfolio risk calculations.
                  </p>
                </div>

                <div className="border-l-4 border-success pl-4">
                  <h3 className="font-bold text-lg">Portfolio Volatility</h3>
                  <p className="text-default-600">
                    The volatility of a portfolio that accounts for both
                    individual asset volatilities and their correlations.
                    Usually lower than the weighted average of individual
                    volatilities due to diversification.
                  </p>
                </div>

                <div className="border-l-4 border-warning pl-4">
                  <h3 className="font-bold text-lg">Trading Days</h3>
                  <p className="text-default-600">
                    For annualization purposes, we use 365 trading days per
                    year. Unlike traditional financial markets that close on
                    weekends and holidays, cryptocurrency markets operate 24/7,
                    365 days a year.
                  </p>
                </div>

                <div className="border-l-4 border-secondary pl-4">
                  <h3 className="font-bold text-lg">
                    Bessel&apos;s Correction
                  </h3>
                  <p className="text-default-600">
                    When calculating variance from a sample of data (like 90
                    days of returns), we divide by <Math>{"n-1"}</Math> instead
                    of <Math>{"n"}</Math> to get an unbiased estimate. This is
                    applied to all our variance and covariance calculations.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Risk Levels Section */}
          <Card id="risk-levels">
            <CardBody className="p-8">
              <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">
                Risk Level Classification
              </h2>
              <p className="text-default-600 mb-6">
                We classify volatility into four risk levels using rigorous
                analytical standards calibrated for cryptocurrency markets. This
                classification covers both annualized and daily volatility,
                providing an intuitive way to understand and compare risk across
                different time scales.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-default-300">
                      <th className="text-left py-3 px-4">Risk Level</th>
                      <th className="text-left py-3 px-4">Annualized</th>
                      <th className="text-left py-3 px-4">Daily</th>
                      <th className="text-left py-3 px-4">Color</th>
                      <th className="text-left py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4">
                        <Chip color="success" size="sm" variant="flat">
                          Low Risk
                        </Chip>
                      </td>
                      <td className="py-3 px-4 font-semibold">&lt; 25%</td>
                      <td className="py-3 px-4 font-semibold">&lt; 1.31%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-success" />
                          <span className="text-sm">Green</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Stable mature cryptos, low risk
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4">
                        <Chip color="warning" size="sm" variant="flat">
                          Medium Risk
                        </Chip>
                      </td>
                      <td className="py-3 px-4 font-semibold">25% - 60%</td>
                      <td className="py-3 px-4 font-semibold">1.31% - 3.14%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-warning" />
                          <span className="text-sm">Yellow</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Moderate volatility, established assets with
                        fluctuations
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4">
                        <Chip
                          className="bg-orange-500/10 text-orange-500"
                          size="sm"
                          variant="flat"
                        >
                          High Risk
                        </Chip>
                      </td>
                      <td className="py-3 px-4 font-semibold">60% - 90%</td>
                      <td className="py-3 px-4 font-semibold">3.14% - 4.71%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-orange-500" />
                          <span className="text-sm">Orange</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        High volatility, speculative assets or unstable phases
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4">
                        <Chip color="danger" size="sm" variant="flat">
                          Extreme Risk
                        </Chip>
                      </td>
                      <td className="py-3 px-4 font-semibold">≥ 90%</td>
                      <td className="py-3 px-4 font-semibold">≥ 4.71%</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-danger" />
                          <span className="text-sm">Red</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Extreme volatility, high-risk altcoins or strong market
                        turbulence
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
                <p className="text-sm text-default-700 mb-2">
                  <strong>Application Usage:</strong>
                </p>
                <ul className="list-disc list-inside text-sm text-default-600 space-y-1">
                  <li>Market volatility level indicators on the dashboard</li>
                  <li>Individual cryptocurrency volatility badges</li>
                  <li>Risk contribution analysis in portfolio breakdown</li>
                  <li>Volatility gauge on the main dashboard</li>
                </ul>
              </div>

              <div className="bg-warning/5 border-l-4 border-warning p-4 rounded mt-4">
                <p className="text-sm text-default-700">
                  <strong>Note:</strong> These thresholds are calibrated for
                  cryptocurrency markets, which typically exhibit higher
                  volatility than traditional financial assets. A &quot;low
                  risk&quot; crypto asset (5% annualized volatility) would still
                  be considered moderate to high risk in traditional equity
                  markets.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Base Parameters Section */}
          <Card id="parameters">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Activity className="w-6 h-6 text-warning" />
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
                      <td className="py-3 px-4 font-semibold">Window Period</td>
                      <td className="py-3 px-4">
                        <Chip color="primary" size="sm">
                          90 days
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Rolling window for volatility calculations
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">Return Type</td>
                      <td className="py-3 px-4">
                        <Chip color="success" size="sm">
                          Logarithmic
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Natural logarithm of price ratios
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Annualization Factor
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="warning" size="sm">
                          √365 ≈ 19.10
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Assumes 365 trading days per year (crypto markets 24/7)
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Minimum Data Points
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="danger" size="sm">
                          90 observations
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Required for volatility calculation
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Calculation Pipeline Section */}
          <Card id="pipeline">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <GitBranch className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Calculation Pipeline
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The market volatility calculation follows a two-stage pipeline,
                where each stage builds upon the previous one:
              </p>
              <div className="bg-default-50 p-6 rounded-lg">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 items-center">
                    <Chip className="min-w-16 w-fit" color="primary" size="lg">
                      Stage 1
                    </Chip>
                    <div className="text-center sm:text-left">
                      <p className="font-bold">Log Returns Calculation</p>
                      <p className="text-sm text-default-600">
                        Calculate daily logarithmic returns for all
                        cryptocurrencies
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-8 bg-default-300" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 items-center">
                    <Chip className="min-w-16 w-fit" color="success" size="lg">
                      Stage 2
                    </Chip>
                    <div className="text-center sm:text-left">
                      <p className="font-bold">Portfolio Volatility</p>
                      <p className="text-sm text-default-600">
                        Calculate index-level volatility using covariance matrix
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stage 1: Log Returns Section */}
          <Card id="stage1">
            <CardBody className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 items-center">
                <Chip color="primary" size="lg">
                  Stage 1
                </Chip>
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Logarithmic Returns
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The first stage calculates daily logarithmic returns for all
                cryptocurrencies, which serve as the foundation for all
                subsequent volatility calculations.
              </p>

              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-bold mb-3">
                    What are Log Returns?
                  </h3>
                  <p className="text-default-600 mb-4">
                    Logarithmic returns measure the continuously compounded rate
                    of return between two periods. They have several advantages
                    over simple percentage returns:
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>
                      <strong>Time-additive:</strong> Returns over multiple
                      periods sum algebraically
                    </li>
                    <li>
                      <strong>Symmetric:</strong> A +10% gain and -10% loss
                      produce equal absolute log returns
                    </li>
                    <li>
                      <strong>Better statistics:</strong> More suitable for
                      normal distribution assumptions
                    </li>
                    <li>
                      <strong>Approximation:</strong> For small changes, log
                      returns ≈ percentage changes
                    </li>
                  </ul>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Calculation Formula
                  </h3>
                  <p className="text-default-600 mb-4">
                    Daily returns are calculated using logarithmic returns,
                    which are widely used in financial analysis due to their
                    desirable statistical properties and time additivity:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {"r_t = \\ln\\left(\\frac{P_t}{P_{t-1}}\\right)"}
                    </Math>
                  </div>
                  <p className="text-default-600 text-sm">
                    Where <Math>{"P_t"}</Math> is the closing price at time{" "}
                    <Math>{"t"}</Math> and <Math>{"P_{t-1}"}</Math> is the
                    closing price at time <Math>{"t-1"}</Math>.
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Data Selection</h3>
                  <p className="text-default-600 mb-4">
                    We select the latest price for each day:
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>End-of-day snapshot (latest timestamp per day)</li>
                    <li>Only positive prices (price_usd &gt; 0)</li>
                    <li>Ordered chronologically</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stage 2: Portfolio Volatility Section */}
          <Card id="stage2">
            <CardBody className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 items-center">
                <Chip color="success" size="lg">
                  Stage 2
                </Chip>
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Portfolio Volatility
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The third stage calculates the volatility of the top 40
                portfolio using market-cap weights and the full covariance
                matrix to account for correlations between constituents.
              </p>

              <div className="space-y-6">
                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    Why Use a Covariance Matrix?
                  </h3>
                  <p className="text-default-600 mb-4">
                    Simply taking a weighted average of individual volatilities
                    would overestimate portfolio risk. The covariance matrix
                    captures how assets move together:
                  </p>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>
                      Assets that move in opposite directions reduce portfolio
                      risk
                    </li>
                    <li>
                      Imperfect correlation provides diversification benefits
                    </li>
                    <li>
                      Portfolio volatility is typically lower than weighted
                      average of individual volatilities
                    </li>
                  </ul>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 1: Weight Calculation
                  </h3>
                  <p className="text-default-600 mb-4">
                    Weights are based on market capitalization:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "w_i = \\frac{\\text{MarketCap}_i}{\\sum_{j=1}^{n} \\text{MarketCap}_j}"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where{" "}
                      <Math>
                        {
                          "\\text{MarketCap}_i = \\text{Price}_i \\times \\text{CirculatingSupply}_i"
                        }
                      </Math>
                    </div>
                  </div>
                  <p className="text-default-600 text-sm">
                    <strong>Important:</strong> Weights must sum to 1.0 (100%)
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 2: Covariance Matrix Construction
                  </h3>
                  <p className="text-default-600 mb-4">
                    Build the covariance matrix for all constituent pairs:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "\\text{Cov}(i,j) = \\frac{1}{T-1} \\sum_{t=1}^{T} \\left(r_{i,t} - \\mu_i\\right)\\left(r_{j,t} - \\mu_j\\right)"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where <Math>{"r_{i,t}"}</Math> = log return of asset{" "}
                      <Math>{"i"}</Math> at time <Math>{"t"}</Math>,{" "}
                      <Math>{"T = 90"}</Math> (window size)
                    </div>
                  </div>
                  <p className="text-default-600 text-sm mb-4">
                    The covariance matrix is an n×n symmetric matrix where:
                  </p>
                  <ul className="list-disc list-inside text-default-600 text-sm space-y-1">
                    <li>Diagonal elements: variances of individual assets</li>
                    <li>
                      Off-diagonal elements: covariances between asset pairs
                    </li>
                    <li>Captures the correlation structure of the portfolio</li>
                  </ul>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 3: Portfolio Variance Calculation
                  </h3>
                  <p className="text-default-600 mb-4">
                    Using modern portfolio theory:
                  </p>
                  <div className="bg-content1 p-6 rounded-lg mb-4 overflow-x-auto">
                    <Math display>
                      {
                        "\\sigma^2_p = \\mathbf{w}^\\top \\Sigma \\, \\mathbf{w}"
                      }
                    </Math>
                    <div className="text-sm text-default-600 mt-3 space-y-1">
                      <div>Where:</div>
                      <div className="pl-4">
                        <Math>{"\\mathbf{w}"}</Math> = column vector of weights{" "}
                        <Math>{"[w_1, w_2, \\ldots, w_n]^\\top"}</Math>
                      </div>
                      <div className="pl-4">
                        <Math>{"\\Sigma"}</Math> = covariance matrix (
                        <Math>{"n \\times n"}</Math>)
                      </div>
                      <div className="pl-4">
                        <Math>{"\\mathbf{w}^\\top"}</Math> = transpose of weight
                        vector
                      </div>
                    </div>
                  </div>
                  <p className="text-default-600 mb-4">Expanded form:</p>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\sigma^2_p = \\sum_{i=1}^{n} \\sum_{j=1}^{n} w_i \\, w_j \\, \\text{Cov}(i,j)"
                      }
                    </Math>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 4: Annualization
                  </h3>
                  <div className="bg-content1 p-4 rounded-lg space-y-4">
                    <Math display>
                      {"\\sigma_{\\text{daily}} = \\sqrt{\\sigma^2_p}"}
                    </Math>
                    <Math display>
                      {
                        "\\sigma_{\\text{annual}} = \\sigma_{\\text{daily}} \\times \\sqrt{365}"
                      }
                    </Math>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Examples Section */}
          <Card id="examples">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Calculation Examples
                </h2>
              </div>

              <div className="space-y-6">
                <div className="bg-success/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Portfolio Volatility Example (Simplified)
                  </h3>
                  <p className="text-default-600 mb-4">
                    <strong>Given:</strong> 2-asset portfolio for simplicity
                  </p>
                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm mb-4">
                    <div>
                      Asset 1 (BTC): weight <Math>{"w_1 = 0.60"}</Math>,{" "}
                      <Math>{"\\sigma_1 = 0.03"}</Math>
                    </div>
                    <div>
                      Asset 2 (ETH): weight <Math>{"w_2 = 0.40"}</Math>,{" "}
                      <Math>{"\\sigma_2 = 0.04"}</Math>
                    </div>
                    <div>
                      Correlation: <Math>{"\\rho = 0.70"}</Math>
                    </div>
                  </div>

                  <p className="text-default-600 mb-2">
                    <strong>Covariance matrix:</strong>
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4 overflow-x-auto">
                    <Math display>
                      {
                        "\\Sigma = \\begin{bmatrix} \\sigma_1^2 & \\rho \\, \\sigma_1 \\, \\sigma_2 \\\\ \\rho \\, \\sigma_1 \\, \\sigma_2 & \\sigma_2^2 \\end{bmatrix} = \\begin{bmatrix} 0.0009 & 0.00084 \\\\ 0.00084 & 0.0016 \\end{bmatrix}"
                      }
                    </Math>
                  </div>

                  <p className="text-default-600 mb-2">
                    <strong>Portfolio variance:</strong>
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4 overflow-x-auto">
                    <Math display>
                      {
                        "\\begin{aligned} \\sigma^2_p &= \\begin{bmatrix} 0.6 & 0.4 \\end{bmatrix} \\begin{bmatrix} 0.0009 & 0.00084 \\\\ 0.00084 & 0.0016 \\end{bmatrix} \\begin{bmatrix} 0.6 \\\\ 0.4 \\end{bmatrix} \\\\\\\\ &= \\begin{bmatrix} 0.6 & 0.4 \\end{bmatrix} \\begin{bmatrix} 0.000876 \\\\ 0.001144 \\end{bmatrix} \\\\\\\\ &= 0.000983 \\end{aligned}"
                      }
                    </Math>
                  </div>

                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm">
                    <div>
                      <strong>Daily portfolio volatility:</strong>{" "}
                      <Math>{"\\sigma_p = \\sqrt{0.000983} = 0.0313"}</Math>{" "}
                      (3.13% per day)
                    </div>
                    <div>
                      <strong>Annualized portfolio volatility:</strong>{" "}
                      <Math>
                        {
                          "\\sigma_{p,\\text{annual}} = 0.0313 \\times \\sqrt{365} = 0.598"
                        }
                      </Math>
                    </div>
                  </div>
                  <div className="text-default-600 mt-4">
                    <strong>Result:</strong> Portfolio volatility is{" "}
                    <Chip className="ml-1" color="success" size="sm">
                      59.8%
                    </Chip>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Diversification Benefit Section */}
          <Card id="diversification">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Calculator className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Diversification Benefit
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The portfolio volatility calculation demonstrates a key
                principle of Modern Portfolio Theory: diversification reduces
                risk.
              </p>

              <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success mb-6">
                <h3 className="text-xl font-bold mb-3">
                  The Diversification Effect
                </h3>
                <p className="text-default-600 mb-4">From Example 2 above:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-default-600">
                      Bitcoin individual volatility:
                    </span>
                    <Chip color="primary" size="sm">
                      57.3%
                    </Chip>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-default-600">
                      Ethereum individual volatility:
                    </span>
                    <Chip color="primary" size="sm">
                      76.4%
                    </Chip>
                  </div>
                  <div className="flex justify-between items-center border-t border-default-200 pt-2 mt-2">
                    <span className="text-default-600">
                      Weighted average volatility:
                    </span>
                    <Chip color="warning" size="sm">
                      64.9%
                    </Chip>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-default-600 font-bold">
                      Actual portfolio volatility:
                    </span>
                    <Chip color="success" size="sm">
                      59.8%
                    </Chip>
                  </div>
                </div>
                <p className="text-default-600 mt-4">
                  The portfolio volatility (59.8%) is{" "}
                  <strong className="text-success">5.1% lower</strong> than the
                  weighted average (64.9%), demonstrating the benefit of
                  diversification!
                </p>
              </div>

              <div className="bg-default-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3">
                  Mathematical Relationship
                </h3>
                <p className="text-default-600 mb-4">The general principle:</p>
                <div className="bg-content1 p-4 rounded-lg">
                  <Math display>
                    {"\\sigma_p \\leq \\sum_{i=1}^{n} w_i \\, \\sigma_i"}
                  </Math>
                  <div className="text-xs text-default-500 mt-2">
                    (Portfolio volatility ≤ Weighted average of individual
                    volatilities)
                  </div>
                </div>
                <p className="text-default-600 mt-4">
                  This inequality holds as long as assets are not perfectly
                  correlated. The benefit is greater when:
                </p>
                <ul className="list-disc list-inside text-default-600 space-y-2 mt-2">
                  <li>Correlations between assets are lower</li>
                  <li>The portfolio is more diversified (more constituents)</li>
                  <li>Asset weights are more balanced</li>
                </ul>
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
