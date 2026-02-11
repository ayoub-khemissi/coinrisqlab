import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio Risk Analysis",
};

export default function PortfolioRiskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
