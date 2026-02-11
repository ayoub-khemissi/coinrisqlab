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
  "stage3",
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
                  Stage 2: Crypto Volatility
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "stage3" ? "flat" : "light"}
                  onPress={() => scrollToSection("stage3")}
                >
                  Stage 3: Portfolio Volatility
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
                The CoinRisqLab 80 Volatility system calculates risk metrics for
                both individual cryptocurrencies and the CoinRisqLab 80 Index
                portfolio. Our methodology uses{" "}
                <strong>logarithmic returns</strong> and implements a{" "}
                <strong>rolling window approach</strong> to measure historical
                volatility.
              </p>
              <p className="text-default-600 mb-4">
                For portfolio-level calculations, we use proper{" "}
                <strong>market-cap weighting</strong> and full{" "}
                <strong>covariance matrix calculations</strong> to account for
                correlations between constituents, providing a comprehensive
                view of portfolio risk.
              </p>
              <p className="text-default-600">
                This approach is based on Modern Portfolio Theory and uses the
                same statistical methods employed by professional financial
                institutions to measure and manage risk.
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
                    A statistical measure of the dispersion of returns for a
                    given security or market index. Higher volatility means
                    higher risk and larger price swings.
                  </p>
                </div>

                <div className="border-l-4 border-success pl-4">
                  <h3 className="font-bold text-lg">Logarithmic Returns</h3>
                  <p className="text-default-600 mb-2">
                    The natural logarithm of the ratio of consecutive prices.
                    Logarithmic returns have better statistical properties than
                    simple percentage returns.
                  </p>
                  <code className="text-sm bg-default-100 px-2 py-1 rounded inline-block">
                    Log_Return = ln(Price_today / Price_yesterday)
                  </code>
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
                  <code className="text-sm bg-default-100 px-2 py-1 rounded inline-block">
                    Annual_Volatility = Daily_Volatility × √365
                  </code>
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
                    days of returns), we divide by <code>n-1</code> instead of{" "}
                    <code>n</code> to get an unbiased estimate. This is applied
                    to all our variance and covariance calculations.
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
                      <td className="py-3 px-4 font-semibold">&lt; 10%</td>
                      <td className="py-3 px-4 font-semibold">&lt; 0.52%</td>
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
                      <td className="py-3 px-4 font-semibold">10% - 30%</td>
                      <td className="py-3 px-4 font-semibold">0.52% - 1.57%</td>
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
                      <td className="py-3 px-4 font-semibold">30% - 60%</td>
                      <td className="py-3 px-4 font-semibold">1.57% - 3.14%</td>
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
                      <td className="py-3 px-4 font-semibold">≥ 60%</td>
                      <td className="py-3 px-4 font-semibold">≥ 3.14%</td>
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
                  <li>Portfolio risk level indicators on the dashboard</li>
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
                The volatility calculation follows a three-stage pipeline, where
                each stage builds upon the previous one:
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
                      <p className="font-bold">Individual Crypto Volatility</p>
                      <p className="text-sm text-default-600">
                        Calculate rolling volatility for each cryptocurrency
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="w-px h-8 bg-default-300" />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 items-center">
                    <Chip className="min-w-16 w-fit" color="warning" size="lg">
                      Stage 3
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
                    For each consecutive pair of days:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>Log_Return[t] = ln(Price[t] / Price[t-1])</div>
                    <div className="mt-2">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                      = ln(Price[t]) - ln(Price[t-1])
                    </div>
                  </div>
                  <p className="text-default-600 text-sm">
                    Where <code>ln()</code> is the natural logarithm function.
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

          {/* Stage 2: Crypto Volatility Section */}
          <Card id="stage2">
            <CardBody className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 items-center">
                <Chip color="success" size="lg">
                  Stage 2
                </Chip>
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Individual Crypto Volatility
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The second stage calculates rolling volatility for individual
                cryptocurrencies using the log returns from Stage 1.
              </p>

              <div className="space-y-6">
                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">
                    Rolling Window Setup
                  </h3>
                  <p className="text-default-600 mb-4">
                    For each cryptocurrency with sufficient data (≥90 log
                    returns):
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>
                      Window[i] = [Return[i-89], Return[i-88], ..., Return[i]]
                    </div>
                  </div>
                  <p className="text-default-600 mt-4 text-sm">
                    The window slides forward one day at a time, always
                    containing exactly 90 consecutive daily log returns.
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Statistical Calculations
                  </h3>
                  <p className="text-default-600 mb-4">
                    For each 90-day window, we calculate:
                  </p>

                  <div className="space-y-4">
                    <div>
                      <p className="font-bold mb-2">a) Mean Return</p>
                      <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                        <div>μ = (1/n) × Σ(i=1 to n) r[i]</div>
                        <div className="text-xs text-default-500 mt-2">
                          Where n = 90 (window size), r[i] = log return for day
                          i
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold mb-2">
                        b) Daily Volatility (Standard Deviation)
                      </p>
                      <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                        <div>
                          σ_daily = √[(1/(n-1)) × Σ(i=1 to n) (r[i] - μ)²]
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold mb-2">c) Annualized Volatility</p>
                      <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                        <div>σ_annual = σ_daily × √365</div>
                        <div className="text-xs text-default-500 mt-2">
                          Where 365 = trading days per year (crypto markets
                          24/7)
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    Why Multiply by √365?
                  </h3>
                  <p className="text-default-600">
                    The square root of time rule applies under the assumption of
                    independent and identically distributed returns. Since
                    cryptocurrency markets operate 24/7 throughout the year, we
                    use 365 days to convert daily volatility to an annual
                    measure that&apos;s comparable across different assets and
                    time periods.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stage 3: Portfolio Volatility Section */}
          <Card id="stage3">
            <CardBody className="p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 items-center">
                <Chip color="warning" size="lg">
                  Stage 3
                </Chip>
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Portfolio Volatility
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The third stage calculates the volatility of the CoinRisqLab 80
                Index portfolio using market-cap weights and the full covariance
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>w[i] = MarketCap[i] / Σ(j=1 to n) MarketCap[j]</div>
                    <div className="text-xs text-default-500 mt-2">
                      Where MarketCap[i] = Price[i] × CirculatingSupply[i]
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>
                      Cov(i,j) = (1/(T-1)) × Σ(t=1 to T) [(r[i,t] - μ[i]) ×
                      (r[j,t] - μ[j])]
                    </div>
                    <div className="text-xs text-default-500 mt-2">
                      Where r[i,t] = log return of asset i at time t, T = 90
                      (window size)
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
                    <pre className="text-xs sm:text-sm whitespace-pre">
                      {`σ²_portfolio = w' × Σ × w

Where:
  w  = column vector of weights [w₁, w₂, ..., wₙ]'
  Σ  = covariance matrix (n×n)
  w' = transpose of weight vector`}
                    </pre>
                  </div>
                  <p className="text-default-600 mb-4">Expanded form:</p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>
                      σ²_portfolio = Σ(i=1 to n) Σ(j=1 to n) w[i] × w[j] ×
                      Cov(i,j)
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Step 4: Annualization
                  </h3>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm space-y-2">
                    <div>σ_portfolio_daily = √(σ²_portfolio)</div>
                    <div>σ_portfolio_annual = σ_portfolio_daily × √365</div>
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
                <div className="bg-primary/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Example 1: Individual Crypto Volatility
                  </h3>
                  <p className="text-default-600 mb-4">
                    <strong>Given:</strong> Bitcoin (BTC) with 90-day log
                    returns
                  </p>
                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm">
                    <div>
                      Day 1: Price = $40,000 → $42,000, r₁ = ln(42000/40000) =
                      0.0488
                    </div>
                    <div>
                      Day 2: Price = $42,000 → $41,000, r₂ = ln(41000/42000) =
                      -0.0241
                    </div>
                    <div>...</div>
                    <div>
                      Day 90: Price = $45,000 → $46,000, r₉₀ = ln(46000/45000) =
                      0.0220
                    </div>
                    <div className="border-t border-default-200 pt-2 mt-2">
                      <strong>Mean return:</strong> μ = 0.0015
                    </div>
                    <div>
                      <strong>Daily volatility:</strong> σ_daily = 0.03 (3% per
                      day)
                    </div>
                    <div>
                      <strong>Annualized volatility:</strong> σ_annual = 0.03 ×
                      √365 = 0.573
                    </div>
                  </div>
                  <div className="text-default-600 mt-4">
                    <strong>Result:</strong> Bitcoin has an annualized
                    volatility of{" "}
                    <Chip className="ml-1" color="primary" size="sm">
                      57.3%
                    </Chip>
                  </div>
                </div>

                <div className="bg-success/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Example 2: Portfolio Volatility (Simplified)
                  </h3>
                  <p className="text-default-600 mb-4">
                    <strong>Given:</strong> 2-asset portfolio for simplicity
                  </p>
                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm mb-4">
                    <div>Asset 1 (BTC): weight = 0.60, σ₁ = 0.03</div>
                    <div>Asset 2 (ETH): weight = 0.40, σ₂ = 0.04</div>
                    <div>Correlation: ρ = 0.70</div>
                  </div>

                  <p className="text-default-600 mb-2">
                    <strong>Covariance matrix:</strong>
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-xs mb-4 overflow-x-auto">
                    <pre className="text-xs whitespace-pre">
                      {`Σ = [σ₁²           ρ×σ₁×σ₂  ]
    [ρ×σ₁×σ₂       σ₂²      ]

  = [0.0009         0.00084  ]
    [0.00084        0.0016   ]`}
                    </pre>
                  </div>

                  <p className="text-default-600 mb-2">
                    <strong>Portfolio variance:</strong>
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-xs mb-4 overflow-x-auto">
                    <pre className="text-xs whitespace-pre">
                      {`σ²_p = [0.6  0.4] × [0.0009    0.00084] × [0.6]
                     [0.00084   0.0016 ]   [0.4]

     = [0.6  0.4] × [0.000876]
                     [0.001144]

     = 0.000983`}
                    </pre>
                  </div>

                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm">
                    <div>
                      <strong>Daily portfolio volatility:</strong> σ_p =
                      √0.000983 = 0.0313 (3.13% per day)
                    </div>
                    <div>
                      <strong>Annualized portfolio volatility:</strong>{" "}
                      σ_p_annual = 0.0313 × √365 = 0.598
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
                <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                  <div>σ_portfolio ≤ Σ w[i] × σ[i]</div>
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
