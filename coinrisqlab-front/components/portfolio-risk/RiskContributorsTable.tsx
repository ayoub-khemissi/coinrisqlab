"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Image } from "@heroui/image";
import { Search, AlertTriangle } from "lucide-react";

import { RiskContribution } from "@/types/volatility";
import { VolatilityBadge } from "@/components/volatility";
import { sStorage } from "@/lib/sessionStorage";

interface RiskContributorsTableProps {
  /**
   * Array of constituents with risk contributions
   */
  contributors: RiskContribution[];
}

type SortKey = "symbol" | "weight" | "volatility" | "risk";
type SortOrder = "asc" | "desc";

/**
 * Table showing risk contribution of each portfolio constituent
 */
export function RiskContributorsTable({
  contributors,
}: RiskContributorsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [volatilityMode, setVolatilityMode] = useState<"annualized" | "daily">(
    "annualized",
  );

  // Check for constituents with missing data
  const missingDataContributors = useMemo(() => {
    return contributors.filter(
      (c) => !c.annualized_volatility || c.annualized_volatility === 0,
    );
  }, [contributors]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = contributors.filter(
      (item) =>
        (item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.name.toLowerCase().includes(searchTerm.toLowerCase())) &&
        item.annualized_volatility > 0,
    );

    // Sort
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortKey) {
        case "symbol":
          return sortOrder === "asc"
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case "weight":
          aValue = a.weight;
          bValue = b.weight;
          break;
        case "volatility":
          aValue =
            volatilityMode === "annualized"
              ? a.annualized_volatility
              : a.daily_volatility;
          bValue =
            volatilityMode === "annualized"
              ? b.annualized_volatility
              : b.daily_volatility;
          break;
        case "risk":
          aValue = a.riskContribution;
          bValue = b.riskContribution;
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [contributors, searchTerm, sortKey, sortOrder, volatilityMode]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        {/* Search */}
        <Input
          isClearable
          className="w-full sm:max-w-xs"
          placeholder="Search by symbol or name..."
          startContent={<Search size={18} />}
          value={searchTerm}
          onClear={() => setSearchTerm("")}
          onValueChange={setSearchTerm}
        />

        {/* Volatility Toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={volatilityMode === "annualized" ? "solid" : "bordered"}
            onPress={() => setVolatilityMode("annualized")}
          >
            Annualized
          </Button>
          <Button
            size="sm"
            variant={volatilityMode === "daily" ? "solid" : "bordered"}
            onPress={() => setVolatilityMode("daily")}
          >
            Daily
          </Button>
        </div>
      </div>

      {/* Warning for insufficient data */}
      {missingDataContributors.length > 0 && (
        <div className="bg-warning/10 border border-warning rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="text-warning mt-0.5 flex-shrink-0"
              size={20}
            />
            <div>
              <h3 className="font-semibold text-warning mb-1">
                Limited Historical Data
              </h3>
              <p className="text-sm text-default-700">
                The following assets have insufficient historical data for
                volatility calculation:{" "}
                <strong>
                  {missingDataContributors
                    .map((c) => `${c.symbol} (${c.available_days ?? 0}d)`)
                    .join(", ")}
                </strong>
                . They will be included once they have 90 days of market data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Table key={volatilityMode} aria-label="Risk contributors table">
        <TableHeader>
          <TableColumn
            key="rank"
            allowsSorting
            className="cursor-pointer"
            onClick={() => handleSort("risk")}
          >
            RANK
          </TableColumn>
          <TableColumn
            key="crypto"
            allowsSorting
            className="cursor-pointer"
            onClick={() => handleSort("symbol")}
          >
            CRYPTOCURRENCY
          </TableColumn>
          <TableColumn
            key="weight"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("weight")}
          >
            WEIGHT
          </TableColumn>
          <TableColumn
            key="volatility"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("volatility")}
          >
            VOLATILITY ({volatilityMode === "annualized" ? "ANNUAL" : "DAILY"})
          </TableColumn>
          <TableColumn
            key="risk"
            allowsSorting
            className="cursor-pointer text-right"
            onClick={() => handleSort("risk")}
          >
            RISK CONTRIBUTION
          </TableColumn>
        </TableHeader>
        <TableBody items={filteredAndSortedData}>
          {(item) => (
            <TableRow
              key={item.crypto_id}
              className="cursor-pointer hover:bg-default-100 transition-colors"
              onClick={() => {
                sStorage.set(
                  "CRYPTO_RETURN_PATH",
                  "/portfolio-risk#risk-contributors",
                );
                router.push(`/crypto/${item.coingecko_id}?panel=volatility`);
              }}
            >
              <TableCell>
                <span className="text-sm text-default-500">
                  #{filteredAndSortedData.indexOf(item) + 1}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Image
                    alt={item.name}
                    className="rounded-full min-w-8 min-h-8"
                    height={32}
                    src={item.image_url || undefined}
                    width={32}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-sm text-default-500">
                      {item.symbol}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="text-right">
                  <p className="font-medium">
                    {(item.weight * 100).toFixed(2)}%
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <VolatilityBadge
                    type={
                      volatilityMode === "annualized" ? "annualized" : "daily"
                    }
                    value={
                      volatilityMode === "annualized"
                        ? item.annualized_volatility
                        : item.daily_volatility
                    }
                  />
                </div>
              </TableCell>
              <TableCell>
                <div className="text-right">
                  <p className="font-semibold text-primary">
                    {item.riskContributionPercentage.toFixed(1)}%
                  </p>
                  <p className="text-xs text-default-500">
                    {(item.riskContribution * 100).toFixed(2)}% gross
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
