"use client";

import { useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Search } from "lucide-react";

import { DataTable } from "@/components/admin/data-validation/data-table";
import { DataFilters } from "@/components/admin/data-validation/data-filters";
import { CsvDownloadButton } from "@/components/admin/data-validation/csv-download-button";

const HISTORY_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "index_level", label: "Index Level" },
  { key: "total_market_cap", label: "Market Cap" },
  { key: "num_constituents", label: "Constituents" },
];

const CONSTITUENTS_COLUMNS = [
  { key: "rank_position", label: "Rank" },
  { key: "symbol", label: "Symbol" },
  { key: "name", label: "Name" },
  { key: "price_usd", label: "Price (USD)" },
  { key: "circulating_supply", label: "Supply" },
  { key: "weight_in_index", label: "Weight" },
];

const PAGE_SIZE = 50;

export default function IndexPage() {
  const [tab, setTab] = useState("history");

  // History state
  const [historyRows, setHistoryRows] = useState<Record<string, unknown>[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyParams, setHistoryParams] = useState<Record<string, string>>(
    {},
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  // Constituents state
  const [constRows, setConstRows] = useState<Record<string, unknown>[]>([]);
  const [constDate, setConstDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [constLoading, setConstLoading] = useState(false);

  const fetchHistory = async (
    params: Record<string, string>,
    pageNum: number,
  ) => {
    setHistoryLoading(true);
    try {
      const query = new URLSearchParams({
        ...params,
        limit: String(PAGE_SIZE),
        offset: String((pageNum - 1) * PAGE_SIZE),
      });
      const res = await fetch(
        `/api/admin/data/index-history?${query.toString()}`,
      );
      const data = await res.json();

      setHistoryRows(data.rows || []);
      setHistoryTotal(data.total || 0);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchConstituents = async () => {
    setConstLoading(true);
    try {
      const res = await fetch(
        `/api/admin/data/index-constituents?date=${constDate}`,
      );
      const data = await res.json();

      setConstRows(data.rows || []);
    } catch {
      /* ignore */
    } finally {
      setConstLoading(false);
    }
  };

  const handleHistorySearch = (filters: { from: string; to: string }) => {
    const params: Record<string, string> = {};

    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    setHistoryParams(params);
    setHistoryPage(1);
    fetchHistory(params, 1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Index (CoinRisqLab 80)</h1>
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tab key="history" title="History" />
        <Tab key="constituents" title="Constituents" />
      </Tabs>

      {tab === "history" && (
        <>
          <DataFilters
            csvEndpoint="/api/admin/data/index-history"
            csvFilename="index_history_export.csv"
            defaultDays={90}
            loading={historyLoading}
            perCrypto={false}
            showCryptoSearch={false}
            onSearch={handleHistorySearch}
          />
          <DataTable
            columns={HISTORY_COLUMNS}
            loading={historyLoading}
            page={historyPage}
            pageSize={PAGE_SIZE}
            rows={historyRows}
            total={historyTotal}
            onPageChange={(p) => {
              setHistoryPage(p);
              fetchHistory(historyParams, p);
            }}
          />
        </>
      )}

      {tab === "constituents" && (
        <>
          <div className="flex items-end gap-3">
            <Input
              className="w-48"
              label="Date"
              size="sm"
              type="date"
              value={constDate}
              onValueChange={setConstDate}
            />
            <Button
              color="primary"
              isLoading={constLoading}
              size="sm"
              startContent={<Search size={16} />}
              onPress={fetchConstituents}
            >
              Load
            </Button>
            <CsvDownloadButton
              endpoint="/api/admin/data/index-constituents"
              filename={`index_constituents_${constDate}.csv`}
              params={{ date: constDate }}
            />
          </div>
          <DataTable
            columns={CONSTITUENTS_COLUMNS}
            loading={constLoading}
            page={1}
            pageSize={100}
            rows={constRows}
            total={constRows.length}
            onPageChange={() => {}}
          />
        </>
      )}
    </div>
  );
}
