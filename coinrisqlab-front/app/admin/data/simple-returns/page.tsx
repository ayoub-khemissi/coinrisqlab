"use client";

import { useState } from "react";

import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { DataTable } from "@/components/admin/data-validation/data-table";

const COLUMNS = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "date", label: "Date" },
  { key: "simple_return", label: "Simple Return" },
  { key: "price_current", label: "Price Current" },
  { key: "price_previous", label: "Price Previous" },
];

const PAGE_SIZE = 50;

export default function SimpleReturnsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [currentParams, setCurrentParams] = useState<Record<string, string>>(
    {},
  );

  const fetchData = async (params: Record<string, string>, pageNum: number) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        ...params,
        limit: String(PAGE_SIZE),
        offset: String((pageNum - 1) * PAGE_SIZE),
      });
      const res = await fetch(
        `/api/admin/data/simple-returns?${query.toString()}`,
      );
      const data = await res.json();

      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (filters: {
    cryptos: string[];
    from: string;
    to: string;
  }) => {
    const params: Record<string, string> = {};

    if (filters.cryptos.length > 0) params.cryptos = filters.cryptos.join(",");
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
      <h1 className="text-xl font-bold">Simple Returns</h1>
      <DataFilters
        csvEndpoint="/api/admin/data/simple-returns"
        csvFilename="simple_returns_export.csv"
        defaultDays={90}
        loading={loading}
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
