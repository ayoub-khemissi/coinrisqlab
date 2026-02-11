"use client";

import { useState, useEffect, useMemo } from "react";

import { title } from "@/components/primitives";
import { CryptoTable } from "@/components/crypto-table";
import { MetricsCards } from "@/components/metrics-cards";
import { PageLoader } from "@/components/page-loader";
import { Cryptocurrency, CryptocurrencyResponse } from "@/types/cryptocurrency";
import { MetricsResponse } from "@/types/metrics";
import { PortfolioVolatilityResponse } from "@/types/volatility";
import { BinancePricesProvider } from "@/contexts/BinancePricesContext";
import { API_BASE_URL } from "@/config/constants";

export default function Home() {
  const [data, setData] = useState<Cryptocurrency[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [metricsData, setMetricsData] = useState<
    MetricsResponse["data"] | null
  >(null);
  const [volatilityData, setVolatilityData] = useState<
    PortfolioVolatilityResponse["data"] | null
  >(null);

  useEffect(() => {
    fetchCryptocurrencies();
    fetchMetrics();
    fetchVolatility();
  }, [page, sortColumn, sortOrder, searchTerm]);

  // Scroll to crypto table if hash is present, then remove hash from URL
  useEffect(() => {
    if (window.location.hash === "#crypto-table" && data.length > 0) {
      // Wait for data to load and page to render
      const scrollToTable = () => {
        const element = document.getElementById("crypto-table");

        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          // Remove hash from URL to prevent auto-scroll on data updates
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
      };

      // Try after a delay to ensure DOM is ready
      const timeoutId = setTimeout(scrollToTable, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [data]);

  // Handle hash on mount (when returning from crypto detail page)
  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash === "#crypto-table") {
        const element = document.getElementById("crypto-table");

        if (element) {
          // Wait a bit for the page to fully render
          setTimeout(() => {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
            // Clean up the hash
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search,
            );
          }, 300);
        }
      }
    };

    // Check on mount
    handleHashScroll();

    // Also listen for hash changes
    window.addEventListener("hashchange", handleHashScroll);

    return () => window.removeEventListener("hashchange", handleHashScroll);
  }, []);

  const fetchCryptocurrencies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "100",
      });

      if (sortColumn && sortOrder) {
        params.set("sortBy", sortColumn);
        params.set("sortOrder", sortOrder);
      }

      if (searchTerm) {
        params.set("search", searchTerm);
      }

      const url = `${API_BASE_URL}/cryptocurrencies?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch cryptocurrencies");
      }

      const result: CryptocurrencyResponse = await response.json();

      setData(result.data);
      setTotalPages(result.pagination.totalPages);
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1); // Reset to first page when searching
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);

      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }

      const result: MetricsResponse = await response.json();

      setMetricsData(result.data);
    } catch { }
  };

  const fetchVolatility = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/volatility/portfolio`);

      if (!response.ok) {
        return;
      }

      const result: PortfolioVolatilityResponse = await response.json();

      setVolatilityData(result.data);
    } catch { }
  };

  const symbols = useMemo(() => data.map((crypto) => crypto.symbol), [data]);

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else if (sortOrder === "asc") {
        setSortColumn(null);
        setSortOrder(null);
      } else {
        setSortOrder("desc");
      }
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  if (isInitialLoading) {
    return <PageLoader message="Loading market data..." />;
  }

  return (
    <BinancePricesProvider symbols={symbols}>
      <section className="flex flex-col gap-6">
        <div className="text-center">
          <h1 className={title()}>CoinRisqLab</h1>
          <p className="text-lg text-default-600 mt-4">
            Track the performance of the top cryptocurrencies in real-time
          </p>
        </div>

        {metricsData && (
          <MetricsCards
            fearGreedData={metricsData.fearGreed}
            globalData={metricsData.global}
            indexData={metricsData.index}
            volatilityData={volatilityData}
          />
        )}

        <div id="crypto-table">
          <CryptoTable
            data={data}
            isLoading={isLoading}
            page={page}
            searchTerm={searchTerm}
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onSearchChange={handleSearchChange}
            onSort={handleSort}
          />
        </div>
      </section>
    </BinancePricesProvider>
  );
}
