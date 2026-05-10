"use client";

import { useState, useEffect, useMemo } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Listbox, ListboxItem } from "@heroui/listbox";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Search, X, ChevronDown } from "lucide-react";

import type { CryptoOption } from "@/types/data-validation";

import { CsvDownloadButton } from "./csv-download-button";

interface WindowMeta {
  windows: number[];
  canonical: number;
  default: number;
}

interface DataFiltersProps {
  showCryptoSearch?: boolean;
  showCryptoSearch2?: boolean;
  showDateRange?: boolean;
  showPortfolioSelector?: boolean;
  /** Number of days the default date range should span (to - from + 1). */
  defaultDays?: number;
  /** Metric key — when set, fetches DISTINCT window_days from BDD via
   *  /api/admin/data/windows?metric=… and renders a Select. Omit when the
   *  table has no window_days column (prices, returns, correlation, …). */
  metric?: string;
  /** Whether the metric is per-crypto (multiplies row count by # cryptos
   *  in the live preview). Defaults to true when showCryptoSearch is on. */
  perCrypto?: boolean;
  portfolios?: Array<{ id: number; name: string; email: string }>;
  csvEndpoint: string;
  csvFilename: string;
  onSearch: (filters: {
    cryptos: string[];
    from: string;
    to: string;
    window?: number;
    portfolioId?: number;
    crypto1?: string;
    crypto2?: string;
  }) => void;
  loading?: boolean;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();

  if (isNaN(f) || isNaN(t) || t < f) return 0;

  return Math.round((t - f) / 86400000) + 1;
}

export function DataFilters({
  showCryptoSearch = true,
  showCryptoSearch2 = false,
  showDateRange = true,
  showPortfolioSelector = false,
  defaultDays,
  metric,
  perCrypto,
  portfolios,
  csvEndpoint,
  csvFilename,
  onSearch,
  loading = false,
}: DataFiltersProps) {
  const [allCryptos, setAllCryptos] = useState<CryptoOption[]>([]);
  const [selectedCryptoObjects, setSelectedCryptoObjects] = useState<
    CryptoOption[]
  >([]);
  const [crypto1, setCrypto1] = useState<string>("");
  const [crypto2, setCrypto2] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [windowMeta, setWindowMeta] = useState<WindowMeta | null>(null);
  const [windowDays, setWindowDays] = useState<number | undefined>(undefined);
  const [portfolioId, setPortfolioId] = useState<number | undefined>(
    portfolios?.[0]?.id,
  );
  const [cryptoSearch, setCryptoSearch] = useState("");

  // Sync portfolioId once the parent's async fetch resolves — useState only
  // captures the initial (empty) prop, so without this the Select would
  // stay blank until the user manually opens the dropdown.
  useEffect(() => {
    if (portfolioId == null && portfolios && portfolios.length > 0) {
      setPortfolioId(portfolios[0].id);
    }
  }, [portfolios, portfolioId]);

  const filteredCryptos = useMemo(() => {
    const q = cryptoSearch.trim().toLowerCase();

    if (!q) return allCryptos;

    return allCryptos.filter(
      (c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q),
    );
  }, [allCryptos, cryptoSearch]);

  // Initialize default date range: to = yesterday, from = to - defaultDays + 1
  useEffect(() => {
    if (!showDateRange) return;
    if (from || to) return; // already set
    const yesterday = new Date();

    yesterday.setUTCHours(0, 0, 0, 0);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const days = defaultDays && defaultDays > 0 ? defaultDays : 90;
    const fromDate = new Date(yesterday);

    fromDate.setUTCDate(fromDate.getUTCDate() - (days - 1));
    setTo(isoDate(yesterday));
    setFrom(isoDate(fromDate));
  }, [defaultDays, showDateRange, from, to]);

  // Fetch crypto list for the multi-pickers
  useEffect(() => {
    if (!showCryptoSearch && !showCryptoSearch2) return;
    fetch("/api/admin/data/cryptos?search=")
      .then((r) => r.json())
      .then((d) => setAllCryptos(d.cryptos || []))
      .catch(() => {});
  }, [showCryptoSearch, showCryptoSearch2]);

  // Fetch available windows for this metric
  useEffect(() => {
    if (!metric) {
      setWindowMeta(null);
      setWindowDays(undefined);

      return;
    }
    fetch(`/api/admin/data/windows?metric=${encodeURIComponent(metric)}`)
      .then((r) => r.json())
      .then((d: WindowMeta) => {
        if (d && Array.isArray(d.windows)) {
          setWindowMeta(d);
          setWindowDays(d.default);
        }
      })
      .catch(() => {});
  }, [metric]);

  const handleRemoveCrypto = (coingeckoId: string) => {
    setSelectedCryptoObjects((prev) =>
      prev.filter((c) => c.coingecko_id !== coingeckoId),
    );
  };

  const handleSearch = () => {
    onSearch({
      cryptos: selectedCryptoObjects.map((c) => c.coingecko_id),
      from,
      to,
      window: windowDays,
      portfolioId,
      crypto1,
      crypto2,
    });
  };

  const buildParams = (): Record<string, string> => {
    const p: Record<string, string> = {};
    const ids = selectedCryptoObjects.map((c) => c.coingecko_id);

    if (ids.length > 0) p.cryptos = ids.join(",");
    if (crypto1) p.crypto1 = crypto1;
    if (crypto2) p.crypto2 = crypto2;
    if (from) p.from = from;
    if (to) p.to = to;
    if (windowDays != null) p.window = String(windowDays);
    if (portfolioId) p.portfolioId = String(portfolioId);

    return p;
  };

  // Live row-count preview
  const isPerCrypto = perCrypto ?? showCryptoSearch;
  const dayCount = daysBetween(from, to);
  const cryptoCount = selectedCryptoObjects.length;
  const previewLine = (() => {
    if (!showDateRange) return null;
    if (dayCount === 0) return null;

    if (showCryptoSearch2) {
      // Correlation: 2 cryptos required, 1 row per shared date
      return `≈ ${dayCount} days × 1 pair = ~${dayCount.toLocaleString("en-US")} rows`;
    }
    if (isPerCrypto) {
      const multiplier = cryptoCount > 0 ? cryptoCount : "all cryptos";
      const total =
        cryptoCount > 0
          ? `~${(dayCount * cryptoCount).toLocaleString("en-US")} rows`
          : `~${dayCount.toLocaleString("en-US")} rows / crypto`;

      return `≈ ${dayCount} days × ${multiplier} = ${total}`;
    }

    return `≈ ${dayCount.toLocaleString("en-US")} rows`;
  })();

  const renderWindowField = () => {
    if (!metric || !windowMeta) return null;

    if (windowMeta.windows.length <= 1) {
      const only = windowMeta.windows[0] ?? windowMeta.canonical;

      return (
        <div className="flex flex-col">
          <span className="text-xs text-default-500 mb-1 px-1">Window</span>
          <Chip size="md" variant="flat">
            {only} days
          </Chip>
        </div>
      );
    }

    return (
      <Select
        aria-label="Window"
        className="w-32"
        label="Window"
        selectedKeys={windowDays != null ? [String(windowDays)] : []}
        size="sm"
        onSelectionChange={(keys) => {
          const k = Array.from(keys)[0];

          if (k) setWindowDays(Number(k));
        }}
      >
        {windowMeta.windows.map((w) => (
          <SelectItem key={String(w)} textValue={`${w} days`}>
            {w} days{w === windowMeta.canonical ? " (methodology)" : ""}
          </SelectItem>
        ))}
      </Select>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filter inputs row */}
      <div className="flex flex-wrap items-end gap-3">
        {showCryptoSearch && !showCryptoSearch2 && (
          <div className="w-72">
            <label
              className="block text-xs text-default-500 mb-1 px-1"
              htmlFor="crypto-picker-trigger"
            >
              Add cryptocurrencies
            </label>
            <Popover
              placement="bottom-start"
              shouldCloseOnInteractOutside={(el) => {
                return !el.closest("[data-crypto-picker-popover]");
              }}
            >
              <PopoverTrigger>
                <Button
                  className="w-full justify-between font-normal"
                  endContent={<ChevronDown size={14} />}
                  id="crypto-picker-trigger"
                  size="sm"
                  variant="bordered"
                >
                  <span className="text-xs text-default-500">
                    {selectedCryptoObjects.length > 0
                      ? `${selectedCryptoObjects.length} selected`
                      : "Pick one or more..."}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="p-2 w-72"
                data-crypto-picker-popover
              >
                <Input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  className="mb-2"
                  placeholder="Search by symbol or name..."
                  size="sm"
                  startContent={<Search size={14} />}
                  value={cryptoSearch}
                  onValueChange={setCryptoSearch}
                />
                <Listbox
                  aria-label="Cryptocurrencies"
                  className="max-h-64 overflow-y-auto"
                  emptyContent="No match"
                  items={filteredCryptos}
                  selectedKeys={
                    new Set(
                      selectedCryptoObjects.map((c) => c.coingecko_id),
                    )
                  }
                  selectionMode="multiple"
                  onSelectionChange={(keys) => {
                    const ids = Array.from(keys as Set<string>);

                    setSelectedCryptoObjects(
                      allCryptos.filter((c) =>
                        ids.includes(c.coingecko_id),
                      ),
                    );
                  }}
                >
                  {(item) => (
                    <ListboxItem
                      key={item.coingecko_id}
                      textValue={`${item.symbol} ${item.name}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {item.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={item.symbol}
                            className="w-5 h-5 rounded-full flex-shrink-0"
                            src={item.image_url}
                          />
                        )}
                        <span className="font-medium flex-shrink-0">
                          {item.symbol}
                        </span>
                        <span className="text-default-400 text-sm truncate">
                          {item.name}
                        </span>
                      </div>
                    </ListboxItem>
                  )}
                </Listbox>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showCryptoSearch2 && (
          <>
            <Autocomplete
              className="w-56"
              defaultItems={allCryptos}
              label="Crypto 1"
              placeholder="Search..."
              size="sm"
              onSelectionChange={(key) => {
                if (key) setCrypto1(String(key));
              }}
            >
              {(item) => (
                <AutocompleteItem
                  key={item.coingecko_id}
                  textValue={`${item.symbol} ${item.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={item.symbol}
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        src={item.image_url}
                      />
                    )}
                    <span className="font-medium flex-shrink-0">
                      {item.symbol}
                    </span>
                    <span className="text-default-400 text-sm truncate">
                      {item.name}
                    </span>
                  </div>
                </AutocompleteItem>
              )}
            </Autocomplete>
            <Autocomplete
              className="w-56"
              defaultItems={allCryptos}
              label="Crypto 2"
              placeholder="Search..."
              size="sm"
              onSelectionChange={(key) => {
                if (key) setCrypto2(String(key));
              }}
            >
              {(item) => (
                <AutocompleteItem
                  key={item.coingecko_id}
                  textValue={`${item.symbol} ${item.name}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={item.symbol}
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        src={item.image_url}
                      />
                    )}
                    <span className="font-medium flex-shrink-0">
                      {item.symbol}
                    </span>
                    <span className="text-default-400 text-sm truncate">
                      {item.name}
                    </span>
                  </div>
                </AutocompleteItem>
              )}
            </Autocomplete>
          </>
        )}

        {showDateRange && (
          <>
            <Input
              className="w-40"
              classNames={{ input: "cursor-pointer" }}
              label="From"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={from}
              onValueChange={setFrom}
            />
            <Input
              className="w-40"
              classNames={{ input: "cursor-pointer" }}
              label="To"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={to}
              onValueChange={setTo}
            />
          </>
        )}

        {renderWindowField()}

        {showPortfolioSelector && portfolios && (
          <Select
            className="w-56"
            label="Portfolio"
            selectedKeys={portfolioId ? [String(portfolioId)] : []}
            size="sm"
            onSelectionChange={(keys) => {
              const k = Array.from(keys)[0];

              if (k) setPortfolioId(Number(k));
            }}
          >
            {portfolios.map((p) => (
              <SelectItem key={String(p.id)} textValue={`${p.name} (${p.email})`}>
                {p.name} ({p.email})
              </SelectItem>
            ))}
          </Select>
        )}

        <Button
          color="primary"
          isLoading={loading}
          size="sm"
          startContent={<Search size={16} />}
          onPress={handleSearch}
        >
          Search
        </Button>

        <CsvDownloadButton
          endpoint={csvEndpoint}
          filename={csvFilename}
          params={buildParams()}
        />
      </div>

      {previewLine && (
        <p className="text-xs text-default-500 px-1">{previewLine}</p>
      )}

      {/* Selected cryptos display */}
      {showCryptoSearch &&
        !showCryptoSearch2 &&
        selectedCryptoObjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedCryptoObjects.map((crypto) => (
              <Chip
                key={crypto.coingecko_id}
                classNames={{
                  base: "pl-1 gap-1",
                  content: "flex items-center gap-1.5",
                }}
                endContent={
                  <button
                    className="text-default-400 hover:text-danger transition-colors ml-1"
                    type="button"
                    onClick={() => handleRemoveCrypto(crypto.coingecko_id)}
                  >
                    <X size={12} />
                  </button>
                }
                size="md"
                variant="flat"
              >
                {crypto.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={crypto.symbol}
                    className="w-4 h-4 rounded-full"
                    src={crypto.image_url}
                  />
                )}
                <span className="font-medium text-xs">{crypto.symbol}</span>
                <span className="text-default-400 text-xs">{crypto.name}</span>
              </Chip>
            ))}
            <button
              className="text-xs text-default-400 hover:text-danger transition-colors px-2"
              type="button"
              onClick={() => setSelectedCryptoObjects([])}
            >
              Clear all
            </button>
          </div>
        )}
    </div>
  );
}
