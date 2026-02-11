"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Calculator, TrendingUp, ArrowRight, Shield } from "lucide-react";
import Link from "next/link";

import { title } from "@/components/primitives";

export default function MethodologyPage() {
  return (
    <section className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className={title()}>Methodology</h1>
        <p className="text-lg text-default-600 mt-4">
          Learn how we calculate the CoinRisqLab 80 Index and its metrics
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
        <Card className="hover:shadow-lg transition-shadow h-full">
          <CardBody className="p-8">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Calculator className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">Index Calculation</h2>
              </div>

              <p className="text-default-600">
                Discover how the CoinRisqLab 80 Index is calculated using market
                capitalization weighting, constituent selection criteria, and
                the mathematical formula behind the index level.
              </p>

              <div className="mt-auto pt-4">
                <Link href="/methodology/index-coinrisqlab">
                  <Button color="primary" endContent={<ArrowRight size={18} />}>
                    View Index Methodology
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:shadow-lg transition-shadow h-full">
          <CardBody className="p-8">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-success/10">
                  <TrendingUp className="w-8 h-8 text-success" />
                </div>
                <h2 className="text-2xl font-bold">Volatility Calculation</h2>
              </div>

              <p className="text-default-600">
                Understand how we measure risk through volatility calculations,
                including logarithmic returns, rolling windows, and
                portfolio-level volatility with covariance matrices.
              </p>

              <div className="mt-auto pt-4">
                <Link href="/methodology/volatility">
                  <Button color="success" endContent={<ArrowRight size={18} />}>
                    View Volatility Methodology
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="hover:shadow-lg transition-shadow h-full">
          <CardBody className="p-8">
            <div className="flex flex-col gap-4 h-full">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-danger/10">
                  <Shield className="w-8 h-8 text-danger" />
                </div>
                <h2 className="text-2xl font-bold">Risk Metrics</h2>
              </div>

              <p className="text-default-600">
                Learn how we calculate VaR, CVaR, Beta, Alpha, SML, Skewness,
                and Kurtosis to provide a comprehensive risk profile for each
                cryptocurrency.
              </p>

              <div className="mt-auto pt-4">
                <Link href="/methodology/risk-metrics">
                  <Button color="danger" endContent={<ArrowRight size={18} />}>
                    View Risk Metrics Methodology
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="max-w-6xl mx-auto w-full">
        <CardBody className="p-8">
          <h2 className="text-xl font-bold mb-4">Why Transparency Matters</h2>
          <p className="text-default-600 mb-4">
            At CoinRisqLab, we believe in full transparency. Our methodology
            documentation provides complete insights into how our index and
            metrics are calculated, allowing you to make informed investment
            decisions.
          </p>
          <ul className="list-disc list-inside text-default-600 space-y-2">
            <li>Clear mathematical formulas and calculation steps</li>
            <li>Detailed constituent selection criteria</li>
            <li>Real-world examples and use cases</li>
            <li>Academic references and industry best practices</li>
          </ul>
        </CardBody>
      </Card>
    </section>
  );
}
