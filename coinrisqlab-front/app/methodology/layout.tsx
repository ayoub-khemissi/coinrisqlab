import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology",
};

export default function MethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
