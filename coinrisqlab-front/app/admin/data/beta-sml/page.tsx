"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { DataTable } from "@/components/admin/data-validation/data-table";

const BETA_COLUMNS = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "window_days", label: "Window" },
  { key: "beta", label: "Beta" },
  { key: "alpha", label: "Alpha" },
  { key: "r_squared", label: "R-squared" },
  { key: "correlation", label: "Correlation" },
  { key: "num_observations", label: "Obs" },
];

const SML_COLUMNS = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "beta", label: "Beta" },
  { key: "expected_return", label: "Expected Return" },
  { key: "actual_return", label: "Actual Return" },
  { key: "alpha", label: "Alpha" },
  { key: "is_overvalued", label: "Overvalued?" },
  { key: "market_return", label: "Market Return" },
];

const PAGE_SIZE = 50;

export default function BetaSmlPage() {
  const [tab, setTab] = useState("beta");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, string>>({});

  const endpoint = tab === "beta" ? "/api/admin/data/beta" : "/api/admin/data/sml";

  const fetchData = async (params: Record<string, string>, pageNum: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ ...params, limit: String(PAGE_SIZE), offset: String((pageNum - 1) * PAGE_SIZE) });
      const res = await fetch(`${endpoint}?${query.toString()}`);
      const data = await res.json();

      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: { cryptos: string[]; from: string; to: string; window: number }) => {
    const params: Record<string, string> = {};

    if (filters.cryptos.length > 0) params.cryptos = filters.cryptos.join(",");
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    params.window = String(filters.window);
    setCurrentParams(params);
    setPage(1);
    fetchData(params, 1);
  };

  const handlePageChange = (p: number) => { setPage(p); fetchData(currentParams, p); };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Beta / Alpha / SML</h1>
      <Tabs selectedKey={tab} onSelectionChange={(k) => { setTab(String(k)); setRows([]); setTotal(0); }}>
        <Tab key="beta" title="Beta / Alpha" />
        <Tab key="sml" title="SML (CAPM)" />
      </Tabs>
      <DataFilters
        showWindowSelector
        csvEndpoint={endpoint}
        csvFilename={`${tab}_export.csv`}
        loading={loading}
        windowOptions={[30, 46, 90]}
        onSearch={handleSearch}
      />
      <DataTable
        columns={tab === "beta" ? BETA_COLUMNS : SML_COLUMNS}
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
