import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market Volatility",
};

export default function MarketVolatilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
