"use client";

import { useState, useEffect } from "react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Tooltip } from "@heroui/tooltip";
import { Search, X, Info } from "lucide-react";

const WINDOW_MIN = 1;
const WINDOW_MAX = 730;

import { CsvDownloadButton } from "./csv-download-button";

import type { CryptoOption } from "@/types/data-validation";

interface DataFiltersProps {
  showCryptoSearch?: boolean;
  showCryptoSearch2?: boolean;
  showDateRange?: boolean;
  showWindowSelector?: boolean;
  showPortfolioSelector?: boolean;
  /** Default value for the free-input window field. Per methodology:
   *  Volatility/Distribution/SML = 90, VaR/Beta/Sharpe = 365. */
  defaultWindow?: number;
  portfolios?: Array<{ id: number; name: string; email: string }>;
  csvEndpoint: string;
  csvFilename: string;
  onSearch: (filters: {
    cryptos: string[];
    from: string;
    to: string;
    window: number;
    portfolioId?: number;
    crypto1?: string;
    crypto2?: string;
  }) => void;
  loading?: boolean;
}

export function DataFilters({
  showCryptoSearch = true,
  showCryptoSearch2 = false,
  showDateRange = true,
  showWindowSelector = false,
  showPortfolioSelector = false,
  defaultWindow = 90,
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
  const [windowDays, setWindowDays] = useState<number>(defaultWindow);
  const [windowInput, setWindowInput] = useState<string>(String(defaultWindow));
  const [portfolioId, setPortfolioId] = useState<number | undefined>(
    portfolios?.[0]?.id,
  );

  useEffect(() => {
    if (!showCryptoSearch && !showCryptoSearch2) return;
    fetch("/api/admin/data/cryptos?search=")
      .then((r) => r.json())
      .then((d) => setAllCryptos(d.cryptos || []))
      .catch(() => {});
  }, [showCryptoSearch, showCryptoSearch2]);

  const handleAddCrypto = (coingeckoId: string) => {
    if (selectedCryptoObjects.some((c) => c.coingecko_id === coingeckoId))
      return;
    const crypto = allCryptos.find((c) => c.coingecko_id === coingeckoId);

    if (crypto) {
      setSelectedCryptoObjects((prev) => [...prev, crypto]);
    }
  };

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
    if (showWindowSelector) p.window = String(windowDays);
    if (portfolioId) p.portfolioId = String(portfolioId);

    return p;
  };

  return (
    <div className="space-y-4">
      {/* Filter inputs row */}
      <div className="flex flex-wrap items-end gap-3">
        {showCryptoSearch && !showCryptoSearch2 && (
          <Select
            aria-label="Add cryptocurrencies"
            className="w-72"
            classNames={{ trigger: "cursor-pointer" }}
            items={allCryptos}
            label="Add cryptocurrencies"
            placeholder="Pick one or more..."
            renderValue={(items) => (
              <span className="text-xs text-default-500">
                {items.length} selected
              </span>
            )}
            selectedKeys={
              new Set(selectedCryptoObjects.map((c) => c.coingecko_id))
            }
            selectionMode="multiple"
            size="sm"
            onSelectionChange={(keys) => {
              const ids = Array.from(keys as Set<string>);

              setSelectedCryptoObjects(
                allCryptos.filter((c) => ids.includes(c.coingecko_id)),
              );
            }}
            // closeOnSelect is supported at runtime by HeroUI Select but missing
            // from its TS types — keeps the popover open while picking multiple.
            {...({ closeOnSelect: false } as Record<string, unknown>)}
          >
            {(item) => (
              <SelectItem
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
              </SelectItem>
            )}
          </Select>
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
              classNames={{ input: "cursor-pointer" }}
              className="w-40"
              label="From"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={from}
              onValueChange={setFrom}
            />
            <Input
              classNames={{ input: "cursor-pointer" }}
              className="w-40"
              label="To"
              placeholder="YYYY-MM-DD"
              size="sm"
              type="date"
              value={to}
              onValueChange={setTo}
            />
          </>
        )}

        {showWindowSelector && (
          <Input
            aria-label="Window"
            className="w-36"
            endContent={
              <div className="flex items-center gap-1 text-default-400">
                <span className="text-xs">days</span>
                <Tooltip content={`${windowDays + 1} prices needed`}>
                  <Info className="cursor-help" size={14} />
                </Tooltip>
              </div>
            }
            label="Window"
            max={WINDOW_MAX}
            min={WINDOW_MIN}
            size="sm"
            step={1}
            type="number"
            value={windowInput}
            onValueChange={(v) => {
              setWindowInput(v);
              const n = parseInt(v, 10);

              if (!isNaN(n) && n >= WINDOW_MIN && n <= WINDOW_MAX) {
                setWindowDays(n);
              }
            }}
          />
        )}

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
              <SelectItem key={String(p.id)}>
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
