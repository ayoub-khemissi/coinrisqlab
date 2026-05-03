"use client";

import { useState, useEffect } from "react";
import { Select, SelectItem } from "@heroui/select";

import { DataTable } from "@/components/admin/data-validation/data-table";
import { CsvDownloadButton } from "@/components/admin/data-validation/csv-download-button";

const COLUMNS = [
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "quantity", label: "Quantity" },
  { key: "avg_buy_price_usd", label: "Avg Buy Price (USD)" },
  { key: "current_price_usd", label: "Current Price (USD)" },
  { key: "current_value_usd", label: "Current Value (USD)" },
  { key: "pnl_usd", label: "PnL (USD)" },
  { key: "pnl_pct", label: "PnL %" },
  { key: "allocation_pct", label: "Allocation %" },
  { key: "first_buy_date", label: "First Buy" },
];

const PAGE_SIZE = 100;

export default function PortfolioConstituentsPage() {
  const [portfolios, setPortfolios] = useState<
    Array<{ id: number; name: string; email: string }>
  >([]);
  const [portfolioId, setPortfolioId] = useState<number | undefined>(undefined);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/data/portfolios")
      .then((r) => r.json())
      .then((d) => {
        setPortfolios(d.portfolios || []);
        if (d.portfolios?.[0]) setPortfolioId(d.portfolios[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    fetch(`/api/admin/data/portfolio-constituents?portfolioId=${portfolioId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [portfolioId]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Portfolio Constituents</h1>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          className="w-72"
          label="Portfolio"
          selectedKeys={portfolioId ? [String(portfolioId)] : []}
          size="sm"
          onSelectionChange={(keys) => {
            const k = Array.from(keys)[0];

            if (k) setPortfolioId(Number(k));
          }}
        >
          {portfolios.map((p) => (
            <SelectItem key={String(p.id)}>
              {p.name} ({p.email})
            </SelectItem>
          ))}
        </Select>
        {portfolioId != null && (
          <CsvDownloadButton
            endpoint="/api/admin/data/portfolio-constituents"
            filename={`portfolio_${portfolioId}_constituents.csv`}
            params={{ portfolioId: String(portfolioId) }}
          />
        )}
      </div>
      <DataTable
        columns={COLUMNS}
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
