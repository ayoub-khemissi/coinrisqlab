"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { DataTable } from "@/components/admin/data-validation/data-table";

const CRYPTO_COLUMNS = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "window_days", label: "Window" },
  { key: "daily_volatility", label: "Daily Vol" },
  { key: "annualized_volatility", label: "Ann Vol" },
  { key: "mean_return", label: "Mean Return" },
  { key: "num_observations", label: "Obs" },
];

const PORTFOLIO_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "window_days", label: "Window" },
  { key: "daily_volatility", label: "Daily Vol" },
  { key: "annualized_volatility", label: "Ann Vol" },
  { key: "num_constituents", label: "Constituents" },
  { key: "total_market_cap_usd", label: "Market Cap" },
];

const PAGE_SIZE = 50;

export default function VolatilityPage() {
  const [tab, setTab] = useState("crypto");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, string>>(
    {},
  );

  const endpoint =
    tab === "crypto"
      ? "/api/admin/data/volatility"
      : "/api/admin/data/portfolio-volatility";

  const fetchData = async (params: Record<string, string>, pageNum: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        ...params,
        limit: String(PAGE_SIZE),
        offset: String((pageNum - 1) * PAGE_SIZE),
      });
      const res = await fetch(`${endpoint}?${query.toString()}`);
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
    cryptos: string[];
    from: string;
    to: string;
    window: number;
  }) => {
    const params: Record<string, string> = {};

    if (filters.cryptos.length > 0) params.cryptos = filters.cryptos.join(",");
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    params.window = String(filters.window);
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
      <h1 className="text-xl font-bold">Volatility</h1>
      <Tabs
        selectedKey={tab}
        onSelectionChange={(k) => {
          setTab(String(k));
          setRows([]);
          setTotal(0);
        }}
      >
        <Tab key="crypto" title="Individual Crypto" />
        <Tab key="portfolio" title="Market Portfolio" />
      </Tabs>
      <DataFilters
        showWindowSelector
        csvEndpoint={endpoint}
        csvFilename={`${tab}_volatility_export.csv`}
        defaultWindow={90}
        loading={loading}
        showCryptoSearch={tab === "crypto"}
        onSearch={handleSearch}
      />
      <DataTable
        columns={tab === "crypto" ? CRYPTO_COLUMNS : PORTFOLIO_COLUMNS}
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
