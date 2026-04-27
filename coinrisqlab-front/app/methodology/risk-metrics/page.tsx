"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Shield,
  TrendingUp,
  BarChart2,
  GitBranch,
  GitCompare,
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  Target,
  Activity,
} from "lucide-react";

import { Math } from "@/components/math";
import { title } from "@/components/primitives";
import { useScrollSpy } from "@/hooks/useScrollSpy";

const RISK_METRICS_SECTIONS = [
  "overview",
  "return-types",
  "volatility",
  "var",
  "cvar",
  "beta",
  "alpha",
  "correlation",
  "sharpe",
  "sml",
  "skewness",
  "kurtosis",
  "stress-test",
  "parameters",
];

export default function RiskMetricsMethodologyPage() {
  const router = useRouter();
  const spyActiveSection = useScrollSpy(RISK_METRICS_SECTIONS);
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
        <h1 className={title()}>Risk Metrics - Methodology</h1>
        <p className="text-lg text-default-600 mt-2">
          How we calculate risk indicators for cryptocurrencies
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
                  variant={activeSection === "return-types" ? "flat" : "light"}
                  onPress={() => scrollToSection("return-types")}
                >
                  Return Types
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "volatility" ? "flat" : "light"}
                  onPress={() => scrollToSection("volatility")}
                >
                  Volatility
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "var" ? "flat" : "light"}
                  onPress={() => scrollToSection("var")}
                >
                  Value at Risk (VaR)
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "cvar" ? "flat" : "light"}
                  onPress={() => scrollToSection("cvar")}
                >
                  CVaR / Expected Shortfall
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "beta" ? "flat" : "light"}
                  onPress={() => scrollToSection("beta")}
                >
                  Beta
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "alpha" ? "flat" : "light"}
                  onPress={() => scrollToSection("alpha")}
                >
                  Alpha
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "correlation" ? "flat" : "light"}
                  onPress={() => scrollToSection("correlation")}
                >
                  Correlation
                </Button>
                <Button
                  className="justify-start pl-6"
                  size="sm"
                  variant={activeSection === "sharpe" ? "flat" : "light"}
                  onPress={() => scrollToSection("sharpe")}
                >
                  Sharpe Ratio
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "sml" ? "flat" : "light"}
                  onPress={() => scrollToSection("sml")}
                >
                  Security Market Line (SML)
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "skewness" ? "flat" : "light"}
                  onPress={() => scrollToSection("skewness")}
                >
                  Skewness
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "kurtosis" ? "flat" : "light"}
                  onPress={() => scrollToSection("kurtosis")}
                >
                  Kurtosis
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "stress-test" ? "flat" : "light"}
                  onPress={() => scrollToSection("stress-test")}
                >
                  Stress Test
                </Button>
                <Button
                  className="justify-start"
                  size="sm"
                  variant={activeSection === "parameters" ? "flat" : "light"}
                  onPress={() => scrollToSection("parameters")}
                >
                  Parameters
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
                <Shield className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Overview
                </h2>
              </div>
              <p className="text-default-600 mb-4">
                CoinRisqLab provides a comprehensive suite of risk metrics to
                help investors understand and quantify the risk profile of
                cryptocurrencies. These metrics are based on{" "}
                <strong>Modern Portfolio Theory</strong> and industry-standard
                risk management practices.
              </p>
              <p className="text-default-600 mb-4">
                Metrics use different calculation windows based on their
                purpose: <strong>Volatility uses a 90-day window</strong> for
                recent risk assessment,{" "}
                <strong>VaR, Beta, and Sharpe Ratio use 365 days</strong> for
                more stable risk estimates, while{" "}
                <strong>Skewness, Kurtosis, and SML use 90 days</strong> to
                capture recent distribution characteristics.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <Activity className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="font-bold">Volatility</p>
                  <p className="text-xs text-default-500">Price Uncertainty</p>
                </div>
                <div className="text-center p-4 bg-danger/10 rounded-lg">
                  <Shield className="w-8 h-8 text-danger mx-auto mb-2" />
                  <p className="font-bold">VaR/CVaR</p>
                  <p className="text-xs text-default-500">Downside Risk</p>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-bold">Beta/Alpha/Sharpe</p>
                  <p className="text-xs text-default-500">
                    Market Sensitivity & Risk-Adjusted Return
                  </p>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <BarChart2 className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="font-bold">Skew/Kurtosis</p>
                  <p className="text-xs text-default-500">Distribution Shape</p>
                </div>
                <div className="text-center p-4 bg-secondary/10 rounded-lg">
                  <GitBranch className="w-8 h-8 text-secondary mx-auto mb-2" />
                  <p className="font-bold">SML</p>
                  <p className="text-xs text-default-500">CAPM Valuation</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Return Types Section */}
          <Card id="return-types">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <GitCompare className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Return Types: Logarithmic vs Simple
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Les métriques descriptives de distribution (volatilité,
                asymétrie, kurtosis, bêta statistique) sont estimées sur
                rendements logarithmiques pour des raisons de stabilité
                statistique. Les métriques d&apos;interprétation économique et
                de risque portefeuille (performance, VaR, CVaR, stress tests,
                SML) sont calculées en rendements simples ou en PnL afin de
                conserver une lecture économique directement exploitable.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">
                    Logarithmic Returns
                  </h3>
                  <div className="bg-content1 p-4 rounded-lg mb-3">
                    <Math display>
                      {
                        "R_{\\text{log}} = \\ln\\!\\left(\\frac{P_t}{P_{t-1}}\\right)"
                      }
                    </Math>
                  </div>
                  <p className="text-default-600 text-sm mb-3">
                    Used for <strong>statistical distribution metrics</strong>,
                    where additivity over time and symmetry around zero matter.
                  </p>
                  <ul className="list-disc list-inside text-default-600 text-sm space-y-1">
                    <li>Volatility (σ)</li>
                    <li>Skewness</li>
                    <li>Kurtosis</li>
                    <li>Beta (statistical — OLS regression)</li>
                    <li>Correlation matrix</li>
                  </ul>
                </div>

                <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-bold mb-3">Simple Returns</h3>
                  <div className="bg-content1 p-4 rounded-lg mb-3">
                    <Math display>
                      {
                        "R_{\\text{simple}} = \\frac{P_t - P_{t-1}}{P_{t-1}} = \\frac{P_t}{P_{t-1}} - 1"
                      }
                    </Math>
                  </div>
                  <p className="text-default-600 text-sm mb-3">
                    Used for{" "}
                    <strong>economic interpretation and portfolio risk</strong>,
                    where the result must read as an actual profit or loss.
                  </p>
                  <ul className="list-disc list-inside text-default-600 text-sm space-y-1">
                    <li>VaR / CVaR</li>
                    <li>Sharpe ratio</li>
                    <li>Security Market Line (SML)</li>
                    <li>Min / Max / Mean return</li>
                    <li>Stress tests &amp; PnL</li>
                  </ul>
                </div>
              </div>

              <div className="bg-default-50 p-6 rounded-lg mt-6">
                <h3 className="text-lg font-bold mb-2">Why the split?</h3>
                <p className="text-default-600 text-sm">
                  Log returns are <strong>additive over time</strong> (
                  <Math>{"\\sum r_t = \\ln(P_n / P_0)"}</Math>) and better
                  approximate a normal distribution, which stabilises variance,
                  regression, and higher-moment estimators. Simple returns are{" "}
                  <strong>additive across assets</strong> (a portfolio simple
                  return is exactly the weighted sum of its constituents&apos;
                  simple returns) and align with how gains and losses are
                  realised in practice, so they are the right basis for
                  risk-at-loss and performance metrics shown to investors.
                </p>
              </div>
            </CardBody>
          </Card>

          {/* Volatility Section */}
          <Card id="volatility">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Activity className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Volatility
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Volatility measures the degree of variation in a
                cryptocurrency&apos;s returns over time. It is estimated as the
                unbiased standard deviation of logarithmic returns computed over
                the previous <strong>90 trading days</strong>.
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
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\text{Window}[i] = \\bigl[r_{i-89},\\; r_{i-88},\\; \\ldots,\\; r_i\\bigr]"
                      }
                    </Math>
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
                      <p className="font-bold mb-2">
                        a) Unbiased Variance Estimation
                      </p>
                      <div className="bg-content1 p-4 rounded-lg">
                        <Math display>
                          {
                            "s^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(r_i - \\bar{r})^2"
                          }
                        </Math>
                        <div className="text-xs text-default-500 mt-2">
                          Where <Math>{"r_i"}</Math> = logarithmic return at
                          observation <Math>{"i"}</Math>,{" "}
                          <Math>{"\\bar{r}"}</Math> = average logarithmic return
                          over the sample, <Math>{"n = 90"}</Math> observations
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold mb-2">
                        b) Daily Volatility (Standard Deviation)
                      </p>
                      <div className="bg-content1 p-4 rounded-lg">
                        <Math display>{"\\sigma = \\sqrt{s^2}"}</Math>
                        <div className="text-xs text-default-500 mt-2">
                          This measure captures the magnitude of return
                          fluctuations over the selected time window and
                          reflects the level of uncertainty associated with the
                          asset&apos;s price movements.
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold mb-2">c) Annualized Volatility</p>
                      <div className="bg-content1 p-4 rounded-lg">
                        <Math display>
                          {
                            "\\sigma_{\\text{annual}} = \\sigma \\times \\sqrt{365}"
                          }
                        </Math>
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

                <div className="bg-primary/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Example</h3>
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
              </div>
            </CardBody>
          </Card>

          {/* VaR Section */}
          <Card id="var">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Shield className="w-6 h-6 text-danger" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Value at Risk (VaR)
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Value at Risk (VaR) is a statistical measure that quantifies the
                potential loss in value of an asset over a defined period for a
                given confidence level. It answers the question:{" "}
                <em>
                  &quot;What is the maximum loss I can expect with X%
                  confidence?&quot;
                </em>
              </p>

              <div className="space-y-6">
                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Definition</h3>
                  <p className="text-default-600 mb-4">
                    VaR at confidence level α represents the (1-α) percentile of
                    the return distribution. For example, VaR 95% indicates the
                    loss that will not be exceeded 95% of the time.
                  </p>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\text{VaR}(\\alpha) = -\\text{Percentile}(\\text{Returns},\\; 100 - \\alpha)"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where <Math>{"\\alpha"}</Math> = confidence level (95% or
                      99%)
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Historical VaR Method
                  </h3>
                  <p className="text-default-600 mb-4">
                    We use the <strong>Historical Simulation</strong> method,
                    which makes no assumptions about the distribution of
                    returns:
                  </p>
                  <ol className="list-decimal list-inside text-default-600 space-y-2">
                    <li>Collect up to 365 days of daily logarithmic returns</li>
                    <li>Sort returns from lowest to highest</li>
                    <li>Find the return at the (100-α) percentile position</li>
                    <li>Report the absolute value as potential loss</li>
                  </ol>
                  <p className="text-default-600 mt-4 text-sm">
                    <strong>Note:</strong> The volatility (standard deviation)
                    used in VaR calculations is computed over a{" "}
                    <strong>365-day window</strong>, unlike the standalone
                    volatility metric which uses a 90-day window and is then
                    annualized. This longer window provides more stable risk
                    estimates for downside risk measurement.
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Confidence Levels</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Level</th>
                          <th className="text-left py-3 px-4">Percentile</th>
                          <th className="text-left py-3 px-4">
                            Interpretation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              VaR 95%
                            </Chip>
                          </td>
                          <td className="py-3 px-4">5th percentile</td>
                          <td className="py-3 px-4 text-default-600">
                            Loss exceeded only 5% of days (1 in 20)
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              VaR 99%
                            </Chip>
                          </td>
                          <td className="py-3 px-4">1st percentile</td>
                          <td className="py-3 px-4 text-default-600">
                            Loss exceeded only 1% of days (1 in 100)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-primary/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Example</h3>
                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm">
                    <div>
                      <strong>Asset:</strong> Bitcoin (BTC)
                    </div>
                    <div>
                      <strong>Period:</strong> 365 days
                    </div>
                    <div>
                      <strong>VaR 95%:</strong> 4.5%
                    </div>
                    <div>
                      <strong>VaR 99%:</strong> 8.2%
                    </div>
                    <div className="pt-2 border-t border-default-200 mt-2 text-default-600">
                      <strong>Interpretation:</strong> With 95% confidence, the
                      daily loss will not exceed 4.5%. Only on 5% of days
                      (approximately 18 days per year) should we expect losses
                      greater than 4.5%.
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* CVaR Section */}
          <Card id="cvar">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-danger" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Conditional VaR (CVaR) / Expected Shortfall
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                CVaR, also known as Expected Shortfall (ES), addresses a key
                limitation of VaR: it tells you the{" "}
                <strong>average loss when VaR is exceeded</strong>. It answers:{" "}
                <em>&quot;When things go bad, how bad do they get?&quot;</em>
              </p>

              <div className="space-y-6">
                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Formula</h3>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\text{CVaR}(\\alpha) = -\\mathbb{E}\\bigl[R \\;\\big|\\; R < -\\text{VaR}(\\alpha)\\bigr]"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Average of all returns in the tail beyond VaR
                    </div>
                  </div>
                </div>

                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    VaR vs CVaR Comparison
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Metric</th>
                          <th className="text-left py-3 px-4">Question</th>
                          <th className="text-left py-3 px-4">Property</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4 font-semibold">VaR</td>
                          <td className="py-3 px-4 text-default-600">
                            What&apos;s the threshold loss?
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Single point estimate
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">CVaR</td>
                          <td className="py-3 px-4 text-default-600">
                            What&apos;s the average extreme loss?
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Tail average (coherent risk measure)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-default-600 mt-4 text-sm">
                    <strong>Note:</strong> CVaR is always greater than or equal
                    to VaR. It provides a more complete picture of tail risk.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Beta Section */}
          <Card id="beta">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Beta (Market Sensitivity)
                </h2>
              </div>
              <p className="text-default-600 mb-4">
                Beta measures the sensitivity of an asset&apos;s returns to
                market movements. It indicates how much an asset tends to move
                relative to the overall market (CoinRisqLab 80 Index).
              </p>
              <p className="text-default-600 mb-6">
                For each asset, beta is estimated over a 365-day rolling window
                using daily logarithmic returns. The market benchmark used is
                the CoinRisqLab 80 Index, which represents the aggregated
                performance of a universe of 80 crypto-assets.
              </p>

              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-bold mb-3">
                    OLS Regression Model
                  </h3>
                  <p className="text-default-600 mb-4">
                    The estimation is based on a simple linear regression using
                    the Ordinary Least Squares (OLS) method:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "R_{i,t} = \\alpha_i + \\beta_i \\times R_{m,t} + \\varepsilon_t"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where <Math>{"R_{i,t}"}</Math> = logarithmic return of
                      asset <Math>{"i"}</Math> at time <Math>{"t"}</Math>,{" "}
                      <Math>{"R_{m,t}"}</Math> = logarithmic return of the
                      CoinRisqLab 80 Index, <Math>{"\\beta_i"}</Math> =
                      sensitivity of the asset to market movements
                    </div>
                  </div>
                  <p className="text-default-600 mb-4">
                    Within this framework, the beta coefficient estimated by OLS
                    is equivalent to:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "\\beta_i = \\frac{\\text{Cov}(R_i,\\, R_m)}{\\text{Var}(R_m)}"
                      }
                    </Math>
                  </div>
                  <p className="text-default-600">
                    This formula compares the covariance between the asset and
                    the market (their tendency to move together) to the variance
                    of the market (the magnitude of market fluctuations).
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Beta Interpretation
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Beta Value</th>
                          <th className="text-left py-3 px-4">Category</th>
                          <th className="text-left py-3 px-4">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="primary" size="sm">
                              β &lt; 0
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Inverse</td>
                          <td className="py-3 px-4 text-default-600">
                            Moves opposite to the market
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm">
                              0 &lt; β &lt; 1
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Defensive</td>
                          <td className="py-3 px-4 text-default-600">
                            Less volatile than market
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="default" size="sm">
                              β = 1
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Market</td>
                          <td className="py-3 px-4 text-default-600">
                            Moves exactly like the market
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              1 &lt; β &lt; 2
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Aggressive</td>
                          <td className="py-3 px-4 text-default-600">
                            Amplifies market movements
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              β &gt; 2
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Speculative</td>
                          <td className="py-3 px-4 text-default-600">
                            Extreme market sensitivity
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Additional Regression Metrics
                  </h3>
                  <div className="grid gap-4">
                    <div className="border-l-4 border-success pl-4">
                      <h4 className="font-bold">R-Squared (R²)</h4>
                      <p className="text-default-600 text-sm">
                        Percentage of asset variance explained by market
                        movements. Higher R² means the asset tracks the market
                        more closely.
                      </p>
                    </div>
                    <div className="border-l-4 border-warning pl-4">
                      <h4 className="font-bold">Correlation</h4>
                      <p className="text-default-600 text-sm">
                        Strength and direction of linear relationship with the
                        market. Ranges from -1 (perfect inverse) to +1 (perfect
                        positive).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Alpha Section */}
          <Card id="alpha">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Target className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Alpha (Excess Return)
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Alpha measures the excess return of an asset beyond what would
                be predicted by its beta. A positive alpha indicates
                outperformance; negative alpha indicates underperformance.
              </p>

              <div className="space-y-6">
                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">Formula</h3>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\alpha = \\overline{R}_{\\text{asset}} - \\beta \\times \\overline{R}_{\\text{market}}"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      The y-intercept of the regression line
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Interpretation</h3>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>
                      <strong>Positive Alpha:</strong> Asset generates returns
                      above what beta predicts (skilled selection or unique
                      value)
                    </li>
                    <li>
                      <strong>Negative Alpha:</strong> Asset underperforms
                      relative to its market risk
                    </li>
                    <li>
                      <strong>Zero Alpha:</strong> Returns fully explained by
                      market exposure
                    </li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Correlation Section */}
          <Card id="correlation">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <GitCompare className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Pairwise Correlation
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Correlation measures the strength and direction of the linear
                relationship between the returns of two assets. It is the
                standardized version of covariance and ranges from{" "}
                <strong>-1</strong> (perfect inverse) to <strong>+1</strong>{" "}
                (perfect co-movement).
              </p>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">
                    Pearson Correlation Coefficient
                  </h3>
                  <p className="text-default-600 text-sm mb-3">
                    Given two series of daily log returns <Math>{"R_A"}</Math>{" "}
                    and <Math>{"R_B"}</Math>:
                  </p>
                  <Math display>
                    {
                      "\\rho_{A,B} = \\frac{\\text{Cov}(R_A, R_B)}{\\sigma_A \\times \\sigma_B} = \\frac{\\sum_{t=1}^{n}(R_{A,t} - \\bar{R}_A)(R_{B,t} - \\bar{R}_B)}{\\sqrt{\\sum_{t=1}^{n}(R_{A,t} - \\bar{R}_A)^2} \\times \\sqrt{\\sum_{t=1}^{n}(R_{B,t} - \\bar{R}_B)^2}}"
                    }
                  </Math>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Interpretation</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="border-l-4 border-danger pl-4">
                      <h4 className="font-bold">
                        <Math>{"\\rho \\to +1"}</Math>
                      </h4>
                      <p className="text-default-600 text-sm">
                        Strong positive correlation. The two assets tend to move
                        in the same direction. Holding both provides limited
                        diversification.
                      </p>
                    </div>
                    <div className="border-l-4 border-default-300 pl-4">
                      <h4 className="font-bold">
                        <Math>{"\\rho \\approx 0"}</Math>
                      </h4>
                      <p className="text-default-600 text-sm">
                        No linear relationship. Movements are independent. Good
                        diversification potential.
                      </p>
                    </div>
                    <div className="border-l-4 border-success pl-4">
                      <h4 className="font-bold">
                        <Math>{"\\rho \\to -1"}</Math>
                      </h4>
                      <p className="text-default-600 text-sm">
                        Strong negative correlation. The assets move in opposite
                        directions. Excellent diversification — rare in crypto.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Key Details</h3>
                  <ul className="list-disc pl-5 space-y-1 text-default-600 text-sm">
                    <li>
                      Computed from <strong>aligned daily log returns</strong> —
                      only dates where both assets have data are used.
                    </li>
                    <li>
                      Uses <strong>sample covariance</strong> (n-1 denominator)
                      for an unbiased estimate.
                    </li>
                    <li>
                      The correlation matrix on the portfolio analytics page
                      applies this formula to every pair of holdings.
                    </li>
                    <li>
                      Correlation does not imply causation — two assets can be
                      highly correlated due to shared market exposure without
                      directly influencing each other.
                    </li>
                    <li>
                      In crypto markets, most major assets are positively
                      correlated (typically <Math>{"0.4 < \\rho < 0.9"}</Math>)
                      because they share the overall market sentiment.
                    </li>
                  </ul>
                </div>

                <div className="bg-default-100 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">
                    Relation to Covariance & Volatility
                  </h4>
                  <p className="text-default-600 text-sm mb-2">
                    Covariance, correlation, and volatility are related:
                  </p>
                  <Math display>
                    {
                      "\\text{Cov}(R_A, R_B) = \\rho_{A,B} \\times \\sigma_A \\times \\sigma_B"
                    }
                  </Math>
                  <p className="text-default-600 text-sm mt-2">
                    This relationship is at the heart of{" "}
                    <strong>portfolio volatility</strong> calculation: the
                    off-diagonal entries of the covariance matrix equal{" "}
                    <Math>{"\\rho_{i,j} \\sigma_i \\sigma_j"}</Math>.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Sharpe Ratio Section */}
          <Card id="sharpe">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Sharpe Ratio
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The Sharpe Ratio measures the risk-adjusted return of an asset.
                It tells you how much excess return you receive for the extra
                volatility you endure — essentially, the return per unit of
                risk.
              </p>

              <div className="space-y-6">
                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Formula</h3>
                  <div className="bg-default-100 p-4 rounded-lg text-center mb-4">
                    <Math display>{"S = \\frac{R_p - R_f}{\\sigma_p}"}</Math>
                  </div>
                  <div className="text-default-600 space-y-2">
                    <p>
                      <Math>{"R_p"}</Math> = Mean daily return of the asset
                    </p>
                    <p>
                      <Math>{"R_f"}</Math> = Risk-free rate (0% for crypto)
                    </p>
                    <p>
                      <Math>{"\\sigma_p"}</Math> = Standard deviation of daily
                      returns
                    </p>
                    <p className="text-sm text-default-500 mt-3">
                      The daily Sharpe Ratio is annualized by multiplying by{" "}
                      <Math>{"\\sqrt{365}"}</Math>, giving a comparable annual
                      figure.
                    </p>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Interpretation</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Sharpe Ratio</th>
                          <th className="text-left py-3 px-4">Quality</th>
                          <th className="text-left py-3 px-4">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-100">
                          <td className="py-3 px-4 font-mono">{"< 0"}</td>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm" variant="flat">
                              Negative
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-500">
                            The asset loses money or underperforms the risk-free
                            rate
                          </td>
                        </tr>
                        <tr className="border-b border-default-100">
                          <td className="py-3 px-4 font-mono">0 - 1</td>
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm" variant="flat">
                              Low
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-500">
                            Positive return but low reward relative to risk
                            taken
                          </td>
                        </tr>
                        <tr className="border-b border-default-100">
                          <td className="py-3 px-4 font-mono">1 - 2</td>
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm" variant="flat">
                              Good
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-500">
                            Good risk-adjusted return — the strategy is
                            efficient
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-mono">{"> 2"}</td>
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm" variant="flat">
                              Excellent
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-500">
                            Excellent risk-adjusted return — very efficient
                            strategy
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Our Implementation</h3>
                  <ul className="list-disc list-inside text-default-600 space-y-2">
                    <li>
                      Calculated using <strong>365 days</strong> of daily log
                      returns
                    </li>
                    <li>
                      Risk-free rate set to <strong>0%</strong> (standard for
                      crypto markets)
                    </li>
                    <li>
                      Annualized via <Math>{"\\sqrt{365}"}</Math> to give a
                      yearly comparable figure
                    </li>
                    <li>
                      Historized daily in the database and recalculated with
                      each new day of data
                    </li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* SML Section */}
          <Card id="sml">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <GitBranch className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Security Market Line (SML)
                </h2>
              </div>
              <p className="text-default-600 mb-4">
                The Security Market Line (SML) measures whether a crypto-asset
                is fairly priced relative to its systematic risk. It is derived
                from the Capital Asset Pricing Model (CAPM) and describes the
                relationship between expected return and systematic risk (Beta).
              </p>
              <p className="text-default-600 mb-4">
                The SML allows us to determine whether an asset is undervalued,
                fairly valued, or overvalued relative to the market. To
                represent the crypto market, we use the CoinRisqLab 80 Index,
                which tracks the performance of 80 liquid cryptocurrencies,
                providing a broad representation of the crypto market.
              </p>
              <p className="text-default-600 mb-6">
                All calculations are performed using a rolling 90-day window.
                This period balances statistical robustness and market
                responsiveness. Using shorter windows would increase noise,
                while longer windows could dilute recent market dynamics.
              </p>

              <div className="space-y-6">
                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">Methodology</h3>
                  <p className="text-default-600 mb-4">
                    For each asset and for the market index, we compute daily
                    logarithmic returns. The expected market return is estimated
                    as the mean of daily returns of the CoinRisqLab 80 Index
                    over the last 90 days. The beta of each crypto-asset, based
                    on 90 days, measures its sensitivity to market movements.
                  </p>
                  <p className="text-default-600 mb-4">
                    The expected return predicted by the CAPM is:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "\\mathbb{E}(R_i) = r_f + \\beta_i \\times \\bigl(\\mathbb{E}(R_M) - r_f\\bigr)"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      This represents the return an asset should deliver given
                      its systematic risk.
                    </div>
                  </div>
                  <p className="text-default-600 text-sm">
                    <strong>Note:</strong> We use <Math>{"r_f = 0"}</Math>{" "}
                    (simplified model for crypto markets where traditional
                    risk-free rates are less relevant).
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Jensen&apos;s Alpha
                  </h3>
                  <p className="text-default-600 mb-4">
                    We compare the CAPM expected return to the realized return
                    over the same 90-day period:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>{"\\alpha_i = R_i - \\mathbb{E}(R_i)"}</Math>
                    <div className="text-xs text-default-500 mt-2">
                      <Math>{"\\alpha > 0"}</Math> → asset outperforms CAPM →
                      potentially undervalued | <Math>{"\\alpha < 0"}</Math> →
                      asset underperforms CAPM → potentially overvalued
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Position</th>
                          <th className="text-left py-3 px-4">
                            Interpretation
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm">
                              Above SML
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Asset delivers higher return than its risk →
                            potentially undervalued
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="default" size="sm">
                              On SML
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Fairly priced
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              Below SML
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Return too low for its risk → potentially overvalued
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Skewness Section */}
          <Card id="skewness">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <BarChart2 className="w-6 h-6 text-warning" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Skewness
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Skewness measures the asymmetry of the return distribution. It
                indicates whether extreme returns are more likely to be positive
                or negative.
              </p>

              <div className="space-y-6">
                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    Fisher&apos;s Skewness Formula
                  </h3>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\text{Skewness} = \\frac{n}{(n-1)(n-2)} \\sum_{i=1}^{n} \\left(\\frac{x_i - \\mu}{\\sigma}\\right)^{3}"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Third standardized moment with sample bias correction
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Interpretation</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Value</th>
                          <th className="text-left py-3 px-4">Type</th>
                          <th className="text-left py-3 px-4">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              &lt; -0.5
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Negative Skew</td>
                          <td className="py-3 px-4 text-default-600">
                            Left tail is longer - more extreme losses than gains
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="default" size="sm">
                              -0.5 to 0.5
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Symmetric</td>
                          <td className="py-3 px-4 text-default-600">
                            Balanced distribution of returns
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm">
                              &gt; 0.5
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Positive Skew</td>
                          <td className="py-3 px-4 text-default-600">
                            Right tail is longer - more extreme gains than
                            losses
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Risk Implication</h3>
                  <p className="text-default-600">
                    <strong>Negative skewness is concerning</strong> for
                    investors because it means the asset has a higher
                    probability of extreme negative returns (crash risk). Most
                    cryptocurrencies exhibit negative skewness during market
                    stress periods.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Kurtosis Section */}
          <Card id="kurtosis">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Activity className="w-6 h-6 text-warning" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Kurtosis
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Kurtosis measures the &quot;tailedness&quot; of the return
                distribution - how likely extreme values (outliers) are compared
                to a normal distribution.
              </p>

              <div className="space-y-6">
                <div className="bg-warning/5 p-6 rounded-lg border-l-4 border-warning">
                  <h3 className="text-xl font-bold mb-3">
                    Excess Kurtosis Formula (Fisher)
                  </h3>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "\\text{Excess Kurtosis} = \\frac{(n+1)\\,n}{(n-1)(n-2)(n-3)} \\sum_{i=1}^{n} \\left(\\frac{x_i - \\mu}{\\sigma}\\right)^{4} - \\frac{3(n-1)^2}{(n-2)(n-3)}"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Fourth standardized moment minus 3 (so normal distribution
                      = 0)
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Interpretation</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Value</th>
                          <th className="text-left py-3 px-4">Type</th>
                          <th className="text-left py-3 px-4">Meaning</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="success" size="sm">
                              &lt; -1
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Platykurtic</td>
                          <td className="py-3 px-4 text-default-600">
                            Thin tails - fewer extreme events than normal
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="default" size="sm">
                              -1 to 1
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Mesokurtic</td>
                          <td className="py-3 px-4 text-default-600">
                            Normal-like tails
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              &gt; 1
                            </Chip>
                          </td>
                          <td className="py-3 px-4">Leptokurtic</td>
                          <td className="py-3 px-4 text-default-600">
                            Fat tails - more extreme events than normal
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Risk Implication</h3>
                  <p className="text-default-600">
                    <strong>High kurtosis (leptokurtic)</strong> is important
                    for risk management because it means extreme moves happen
                    more often than a normal distribution would predict.
                    Cryptocurrencies typically have high positive kurtosis,
                    meaning &quot;black swan&quot; events are more common than
                    in traditional markets.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Stress Test Section */}
          <Card id="stress-test">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-danger" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Stress Test
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                Stress testing estimates the potential impact of historical
                crisis events on an asset, using its beta to project how it
                would react to similar market shocks. For each historical
                scenario, we select the relevant crisis window, compute the
                aggregate crypto market return over that period, and use the
                cumulative decline as the market shock.
              </p>

              <div className="space-y-6">
                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Methodology</h3>
                  <p className="text-default-600 mb-4">
                    For each stress scenario, we first define a historical event
                    window corresponding to a major crypto market disruption. We
                    then retrieve the total crypto market capitalization over
                    that period and compute the daily log returns:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {"r_t = \\ln\\!\\left(\\frac{M_t}{M_{t-1}}\\right)"}
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where <Math>{"M_t"}</Math> is the total crypto market
                      capitalization at time <Math>{"t"}</Math>
                    </div>
                  </div>
                  <p className="text-default-600 mb-4">
                    The cumulative market move over the scenario window is
                    obtained by summing the log returns:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {"R_{\\text{market,log}} = \\sum_{t=1}^{n} r_t"}
                    </Math>
                  </div>
                  <p className="text-default-600 mb-4">
                    The cumulative market shock is then expressed in standard
                    return terms:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {
                        "\\text{Shock}_{\\text{market}} = e^{R_{\\text{market,log}}} - 1"
                      }
                    </Math>
                  </div>
                  <p className="text-default-600 mb-4">
                    To account for differences in asset sensitivity, the market
                    shock is scaled by each asset&apos;s historical beta. For
                    stress testing purposes, negative betas are floored at 0:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg mb-4">
                    <Math display>
                      {"\\beta_{i,\\text{stress}} = \\max(\\beta_i,\\; 0)"}
                    </Math>
                    <Math display>
                      {
                        "\\text{Shock}_i = \\beta_{i,\\text{stress}} \\times \\text{Shock}_{\\text{market}}"
                      }
                    </Math>
                  </div>
                  <p className="text-default-600 mb-4">
                    The stressed price of each asset is then computed as:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg">
                    <Math display>
                      {
                        "P_{i,\\text{stress}} = P_{i,0} \\times (1 + \\text{Shock}_i)"
                      }
                    </Math>
                    <div className="text-xs text-default-500 mt-2">
                      Where <Math>{"P_{i,0}"}</Math> is the current asset price
                    </div>
                  </div>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Historical Scenarios
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-default-200">
                          <th className="text-left py-3 px-4">Event</th>
                          <th className="text-left py-3 px-4">Period</th>
                          <th className="text-left py-3 px-4">Market Shock</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4 font-semibold">
                            COVID-19 Crash
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Feb-Mar 2020
                          </td>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              -50.42%
                            </Chip>
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4 font-semibold">
                            China Mining Ban
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            May 2021
                          </td>
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              -25.07%
                            </Chip>
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4 font-semibold">
                            UST/Luna Crash
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            May 2022
                          </td>
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              -4.73%
                            </Chip>
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 font-semibold">
                            FTX Collapse
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Nov 2022
                          </td>
                          <td className="py-3 px-4">
                            <Chip color="warning" size="sm">
                              -2.64%
                            </Chip>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-primary/5 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">Example</h3>
                  <div className="bg-content1 p-4 rounded-lg space-y-2 text-sm">
                    <div>
                      <strong>Asset:</strong> Ethereum (ETH)
                    </div>
                    <div>
                      <strong>Current Price (P_i,0):</strong> $2,500
                    </div>
                    <div>
                      <strong>Beta (β_i):</strong> 1.2
                    </div>
                    <div>
                      <strong>Scenario:</strong> COVID-19 (Shock_market =
                      -50.42%)
                    </div>
                    <div className="pt-2 border-t border-default-200 mt-2">
                      <div>β_i_stress = max(1.2, 0) = 1.2</div>
                      <div>Shock_i = 1.2 × (-50.42%) = -60.50%</div>
                      <div>
                        P_i_stress = $2,500 × (1 - 0.605) ={" "}
                        <strong>$987.50</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Parameters Section */}
          <Card id="parameters">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <Activity className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Calculation Parameters
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
                      <td className="py-3 px-4 font-semibold">
                        VaR / Beta / Sharpe Window
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="primary" size="sm">
                          365 days
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Longer window for stable risk estimates
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Skew / Kurtosis / SML Window
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="warning" size="sm">
                          90 days
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Shorter window to capture recent distribution
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Return Type (statistical)
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="success" size="sm">
                          Logarithmic
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Volatility, skewness, kurtosis, beta, correlation, Sharpe
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Return Type (economic)
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="primary" size="sm">
                          Simple
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        VaR, CVaR, SML, min/max/mean return
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Market Benchmark
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="primary" size="sm">
                          CoinRisqLab 80
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Index used for Beta/SML calculations
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Risk-Free Rate
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="default" size="sm">
                          0%
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Simplified assumption for crypto markets
                      </td>
                    </tr>
                    <tr className="border-b border-default-200">
                      <td className="py-3 px-4 font-semibold">
                        Min. Data Points
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="danger" size="sm">
                          7 days
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Minimum required for statistical validity
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold">
                        Update Frequency
                      </td>
                      <td className="py-3 px-4">
                        <Chip color="secondary" size="sm">
                          Daily (2 AM)
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        All metrics recalculated daily
                      </td>
                    </tr>
                  </tbody>
                </table>
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
