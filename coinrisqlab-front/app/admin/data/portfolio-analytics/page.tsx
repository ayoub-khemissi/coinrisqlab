"use client";

import { useState, useEffect } from "react";

import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { DataTable } from "@/components/admin/data-validation/data-table";

const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "total_value_usd", label: "Value (USD)" },
  { key: "num_holdings", label: "Holdings" },
  { key: "daily_volatility", label: "Daily Vol" },
  { key: "annualized_volatility", label: "Ann Vol" },
  { key: "var_95", label: "VaR 95%" },
  { key: "var_99", label: "VaR 99%" },
  { key: "sharpe_ratio", label: "Sharpe" },
  { key: "portfolio_beta_weighted", label: "Beta (w)" },
  { key: "beta_regression", label: "Beta (reg)" },
  { key: "alpha_regression", label: "Alpha" },
  { key: "r_squared", label: "R-squared" },
];

const PAGE_SIZE = 50;

export default function PortfolioAnalyticsPage() {
  const [portfolios, setPortfolios] = useState<
    Array<{ id: number; name: string; email: string }>
  >([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    fetch("/api/admin/data/portfolios")
      .then((r) => r.json())
      .then((d) => setPortfolios(d.portfolios || []))
      .catch(() => {});
  }, []);

  const fetchData = async (
    params: Record<string, string>,
    pageNum: number,
  ) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        ...params,
        limit: String(PAGE_SIZE),
        offset: String((pageNum - 1) * PAGE_SIZE),
      });
      const res = await fetch(
        `/api/admin/data/portfolio-analytics?${query.toString()}`,
      );
      const data = await res.json();

      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: {
    from: string;
    to: string;
    portfolioId?: number;
  }) => {
    if (!filters.portfolioId) return;
    const params: Record<string, string> = {
      portfolioId: String(filters.portfolioId),
    };

    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    setCurrentParams(params);
    setPage(1);
    fetchData(params, 1);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchData(currentParams, p);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Portfolio Analytics</h1>
      <DataFilters
        showCryptoSearch={false}
        showPortfolioSelector
        csvEndpoint="/api/admin/data/portfolio-analytics"
        csvFilename="portfolio_analytics_export.csv"
        loading={loading}
        portfolios={portfolios}
        onSearch={handleSearch}
      />
      <DataTable
        columns={COLUMNS}
        loading={loading}
        page={page}
        pageSize={PAGE_SIZE}
        rows={rows}
        total={total}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
