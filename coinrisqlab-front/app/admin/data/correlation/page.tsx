"use client";

import { useState } from "react";
import { Chip } from "@heroui/chip";

import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { DataTable } from "@/components/admin/data-validation/data-table";

const PAGE_SIZE = 50;

export default function CorrelationPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [correlation, setCorrelation] = useState<number | null>(null);
  const [symbols, setSymbols] = useState<string[]>([]);
  const [dataPoints, setDataPoints] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (filters: {
    crypto1?: string;
    crypto2?: string;
    from: string;
    to: string;
  }) => {
    if (!filters.crypto1 || !filters.crypto2) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();

      params.set("crypto1", filters.crypto1);
      params.set("crypto2", filters.crypto2);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(
        `/api/admin/data/correlation?${params.toString()}`,
      );
      const data = await res.json();

      setRows(data.rows || []);
      setCorrelation(data.correlation ?? null);
      setSymbols(data.symbols || []);
      setDataPoints(data.dataPoints || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: "date", label: "Date" },
    {
      key: "return_1",
      label: symbols[0] ? `${symbols[0]} Return` : "Crypto 1 Return",
    },
    {
      key: "return_2",
      label: symbols[1] ? `${symbols[1]} Return` : "Crypto 2 Return",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Correlation</h1>
      <DataFilters
        showCryptoSearch2
        csvEndpoint="/api/admin/data/correlation"
        csvFilename="correlation_export.csv"
        defaultDays={365}
        loading={loading}
        showCryptoSearch={false}
        onSearch={handleSearch}
      />

      {correlation !== null && (
        <div className="flex items-center gap-4">
          <Chip
            color={
              Math.abs(correlation) > 0.7
                ? "danger"
                : Math.abs(correlation) > 0.4
                  ? "warning"
                  : "success"
            }
            size="lg"
            variant="flat"
          >
            Correlation: {correlation.toFixed(6)}
          </Chip>
          <span className="text-sm text-default-500">
            {symbols.join(" vs ")} | {dataPoints} aligned data points
          </span>
        </div>
      )}

      <DataTable
        columns={columns}
        loading={loading}
        page={1}
        pageSize={PAGE_SIZE}
        rows={rows}
        total={rows.length}
        onPageChange={() => {}}
      />
    </div>
  );
}
