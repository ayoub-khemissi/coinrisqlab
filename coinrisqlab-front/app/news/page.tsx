import type { Metadata } from "next";

import { NewsList } from "@/components/news-list";

export const metadata: Metadata = {
  title: "News",
  description:
    "Stay up to date with the latest CoinRisqLab news, crypto market insights, and platform updates.",
};

export default function NewsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-6 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-3">
          News
        </h1>
        <p className="text-default-400">
          Stay up to date with the latest CoinRisqLab news and updates
        </p>
      </div>
      <NewsList />
    </div>
  );
}
