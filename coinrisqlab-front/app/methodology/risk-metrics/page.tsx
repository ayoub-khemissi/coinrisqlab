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
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  Target,
  Activity,
} from "lucide-react";

import { title } from "@/components/primitives";
import { useScrollSpy } from "@/hooks/useScrollSpy";

const RISK_METRICS_SECTIONS = [
  "overview",
  "var",
  "cvar",
  "beta",
  "alpha",
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
                purpose: <strong>VaR and Beta use 365 days</strong> for more
                stable risk estimates, while{" "}
                <strong>Skewness, Kurtosis, and SML use 90 days</strong> to
                capture recent distribution characteristics.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="text-center p-4 bg-danger/10 rounded-lg">
                  <Shield className="w-8 h-8 text-danger mx-auto mb-2" />
                  <p className="font-bold">VaR/CVaR</p>
                  <p className="text-xs text-default-500">Downside Risk</p>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-bold">Beta/Alpha</p>
                  <p className="text-xs text-default-500">Market Sensitivity</p>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <BarChart2 className="w-8 h-8 text-warning mx-auto mb-2" />
                  <p className="font-bold">Skew/Kurtosis</p>
                  <p className="text-xs text-default-500">Distribution Shape</p>
                </div>
                <div className="text-center p-4 bg-success/10 rounded-lg">
                  <GitBranch className="w-8 h-8 text-success mx-auto mb-2" />
                  <p className="font-bold">SML</p>
                  <p className="text-xs text-default-500">CAPM Valuation</p>
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>VaR(α) = -Percentile(Returns, 100 - α)</div>
                    <div className="text-xs text-default-500 mt-2">
                      Where α = confidence level (95% or 99%)
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>
                      CVaR(α) = -Average(Returns where Return &lt; -VaR(α))
                    </div>
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
              <p className="text-default-600 mb-6">
                Beta measures the sensitivity of an asset&apos;s returns to
                market movements. It indicates how much an asset tends to move
                relative to the overall market (CoinRisqLab 80 Index).
              </p>

              <div className="space-y-6">
                <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                  <h3 className="text-xl font-bold mb-3">Formula</h3>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>Beta = Cov(R_asset, R_market) / Var(R_market)</div>
                    <div className="text-xs text-default-500 mt-2">
                      Where R = logarithmic returns
                    </div>
                  </div>
                  <p className="text-default-600">
                    Beta is calculated using Ordinary Least Squares (OLS)
                    regression of asset returns against market returns.
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>Alpha = Mean(R_asset) - Beta × Mean(R_market)</div>
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

          {/* SML Section */}
          <Card id="sml">
            <CardBody className="p-8">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <GitBranch className="w-6 h-6 text-success" />
                <h2 className="text-2xl font-bold text-center sm:text-left">
                  Security Market Line (SML)
                </h2>
              </div>
              <p className="text-default-600 mb-6">
                The Security Market Line is a graphical representation of the
                Capital Asset Pricing Model (CAPM). It shows the theoretical
                relationship between systematic risk (beta) and expected return.
              </p>

              <div className="space-y-6">
                <div className="bg-success/5 p-6 rounded-lg border-l-4 border-success">
                  <h3 className="text-xl font-bold mb-3">CAPM Formula</h3>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>E(R) = Rf + Beta × (Rm - Rf)</div>
                    <div className="text-xs text-default-500 mt-2">
                      Where: E(R) = Expected Return, Rf = Risk-free Rate, Rm =
                      Market Return
                    </div>
                  </div>
                  <p className="text-default-600 text-sm">
                    <strong>Note:</strong> We use Rf = 0 (simplified model for
                    crypto markets where traditional risk-free rates are less
                    relevant).
                  </p>
                </div>

                <div className="bg-default-50 p-6 rounded-lg">
                  <h3 className="text-xl font-bold mb-3">
                    Jensen&apos;s Alpha
                  </h3>
                  <p className="text-default-600 mb-4">
                    The vertical distance between an asset&apos;s actual return
                    and the SML represents Jensen&apos;s Alpha:
                  </p>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm mb-4">
                    <div>
                      Jensen&apos;s Alpha = Actual Return - Expected Return
                      (from CAPM)
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
                            Undervalued - Generates excess returns for its risk
                            level
                          </td>
                        </tr>
                        <tr className="border-b border-default-200">
                          <td className="py-3 px-4">
                            <Chip color="default" size="sm">
                              On SML
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Fairly valued - Return matches risk
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4">
                            <Chip color="danger" size="sm">
                              Below SML
                            </Chip>
                          </td>
                          <td className="py-3 px-4 text-default-600">
                            Overvalued - Insufficient return for risk taken
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>Skewness = (n / ((n-1)(n-2))) × Σ((x - μ) / σ)³</div>
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
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>
                      Excess Kurtosis = ((n+1)n / ((n-1)(n-2)(n-3))) × Σ((x - μ)
                      / σ)⁴ - 3(n-1)² / ((n-2)(n-3))
                    </div>
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
                would react to similar market shocks.
              </p>

              <div className="space-y-6">
                <div className="bg-danger/5 p-6 rounded-lg border-l-4 border-danger">
                  <h3 className="text-xl font-bold mb-3">Formula</h3>
                  <div className="bg-content1 p-4 rounded-lg font-mono text-sm">
                    <div>Expected Impact = Beta × Market Shock</div>
                    <div>New Price = Current Price × (1 + Expected Impact)</div>
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
                      <strong>Current Price:</strong> $2,500
                    </div>
                    <div>
                      <strong>Beta:</strong> 1.2
                    </div>
                    <div>
                      <strong>Scenario:</strong> COVID-19 (-50.42%)
                    </div>
                    <div className="pt-2 border-t border-default-200 mt-2">
                      <div>Expected Impact = 1.2 × (-50.42%) = -60.50%</div>
                      <div>
                        New Price = $2,500 × (1 - 0.605) ={" "}
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
                        VaR / Beta Window
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
                      <td className="py-3 px-4 font-semibold">Return Type</td>
                      <td className="py-3 px-4">
                        <Chip color="success" size="sm">
                          Logarithmic
                        </Chip>
                      </td>
                      <td className="py-3 px-4 text-default-600">
                        Natural log of price ratios
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
