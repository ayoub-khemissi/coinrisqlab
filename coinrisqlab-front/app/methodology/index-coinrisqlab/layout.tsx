import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Index Methodology | CoinRisqLab",
};

export default function IndexMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
