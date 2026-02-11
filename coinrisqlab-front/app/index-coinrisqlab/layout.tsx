import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CoinRisqLab 80 Index",
};

export default function IndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
