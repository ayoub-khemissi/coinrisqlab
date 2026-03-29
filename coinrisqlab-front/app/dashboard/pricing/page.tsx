"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Check, X } from "lucide-react";

import { API_BASE_URL } from "@/config/constants";
import { useUserAuth } from "@/lib/user-auth-context";

const freeFeatures = [
  { text: "1 portfolio", included: true },
  { text: "10 cryptos max", included: true },
  { text: "30-day history", included: true },
  { text: "Portfolio volatility & beta", included: true },
  { text: "3 price alerts", included: true },
  { text: "CSV export (positions)", included: true },
  { text: "Unlimited portfolios", included: false },
  { text: "VaR / CVaR / Sharpe", included: false },
  { text: "Correlation matrix", included: false },
  { text: "Stress tests", included: false },
  { text: "PDF reports", included: false },
];

const proFeatures = [
  { text: "Unlimited portfolios", included: true },
  { text: "Unlimited cryptos", included: true },
  { text: "Full history", included: true },
  { text: "All risk metrics (VaR, CVaR, Sharpe)", included: true },
  { text: "Correlation matrix", included: true },
  { text: "Stress test reports", included: true },
  { text: "Unlimited alerts (all types)", included: true },
  { text: "CSV & PDF exports", included: true },
  { text: "CSV import", included: true },
  { text: "Alpha & tracking error", included: true },
  { text: "Diversification analysis", included: true },
];

export default function PricingPage() {
  const { user } = useUserAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/user/stripe/create-checkout-session`,
        { method: "POST", credentials: "include" },
      );
      const data = await res.json();

      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-default-500 mt-2">
          Unlock advanced risk analytics for your portfolio
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free */}
        <Card className={user?.plan === "free" ? "border-2 border-primary" : ""}>
          <CardHeader className="flex-col gap-1 pb-0">
            <h2 className="text-xl font-bold">Free</h2>
            <p className="text-3xl font-bold">
              $0<span className="text-sm font-normal text-default-500">/mo</span>
            </p>
          </CardHeader>
          <CardBody className="gap-2">
            {freeFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {f.included ? (
                  <Check className="text-success shrink-0" size={16} />
                ) : (
                  <X className="text-default-300 shrink-0" size={16} />
                )}
                <span className={f.included ? "" : "text-default-400"}>
                  {f.text}
                </span>
              </div>
            ))}
          </CardBody>
          <CardFooter>
            {user?.plan === "free" ? (
              <Chip className="w-full justify-center" color="primary" variant="flat">
                Current Plan
              </Chip>
            ) : (
              <Button fullWidth isDisabled variant="flat">
                Free
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Pro */}
        <Card className={user?.plan === "pro" ? "border-2 border-warning" : "border-2 border-warning/30"}>
          <CardHeader className="flex-col gap-1 pb-0">
            <Chip color="warning" size="sm" variant="flat">
              Recommended
            </Chip>
            <h2 className="text-xl font-bold">Pro</h2>
            <p className="text-3xl font-bold">
              $9.99<span className="text-sm font-normal text-default-500">/mo</span>
            </p>
          </CardHeader>
          <CardBody className="gap-2">
            {proFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Check className="text-warning shrink-0" size={16} />
                <span>{f.text}</span>
              </div>
            ))}
          </CardBody>
          <CardFooter>
            {user?.plan === "pro" ? (
              <Chip className="w-full justify-center" color="warning" variant="flat">
                Current Plan
              </Chip>
            ) : (
              <Button
                fullWidth
                color="warning"
                isLoading={loading}
                variant="solid"
                onPress={handleUpgrade}
              >
                Upgrade to Pro
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
