"use client";

import React, { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Image } from "@heroui/image";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { TrendingUp, TrendingDown, Search } from "lucide-react";

import { PriceCell } from "./PriceCell";
import { MarketCapCell } from "./MarketCapCell";

import { IndexConstituent } from "@/types/index-details";
import {
  formatUSD,
  formatPercentage,
  getPercentageColor,
} from "@/lib/formatters";
import { sStorage } from "@/lib/sessionStorage";

interface ConstituentsTableProps {
  constituents: IndexConstituent[];
}

function ConstituentsTableComponent({ constituents }: ConstituentsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);

  const columns = [
    { key: "rank_position", label: "Rank", sortable: true },
    { key: "name", label: "Cryptocurrency", sortable: true },
    { key: "price_usd", label: "Price", sortable: true },
    { key: "percent_change_24h", label: "24h %", sortable: true },
    { key: "percent_change_7d", label: "7d %", sortable: true },
    { key: "market_cap_usd", label: "Market Cap", sortable: true },
    { key: "volume_24h_usd", label: "24h Volume", sortable: true },
    { key: "weight_in_index", label: "Weight", sortable: true },
  ];

  const filteredAndSortedConstituents = useMemo(() => {
    let filtered = constituents;

    // Filter by search term
    if (searchTerm) {
      filtered = constituents.filter(
        (c) =>
          c.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.name.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    // Sort if needed
    if (!sortColumn || !sortOrder) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let aValue: any = a[sortColumn as keyof IndexConstituent];
      let bValue: any = b[sortColumn as keyof IndexConstituent];

      if (sortColumn === "name") {
        aValue = a.name;
        bValue = b.name;
      } else {
        aValue = parseFloat(aValue?.toString() || "0");
        bValue = parseFloat(bValue?.toString() || "0");
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [constituents, searchTerm, sortColumn, sortOrder]);

  const handleSort = (column: string) => {
    if (column === sortColumn) {
      if (sortOrder === "desc") {
        setSortOrder("asc");
      } else if (sortOrder === "asc") {
        setSortColumn(null);
        setSortOrder(null);
      } else {
        setSortOrder("desc");
      }
    } else {
      setSortColumn(column);
      setSortOrder("desc");
    }
  };

  const renderCell = (constituent: IndexConstituent, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank_position":
        return (
          <div className="text-default-600 font-semibold">
            #{constituent.rank_position}
          </div>
        );

      case "name":
        return (
          <div className="flex items-center gap-3">
            <Image
              alt={constituent.name}
              className="rounded-full min-w-8 min-h-8"
              height={32}
              src={constituent.image_url || undefined}
              width={32}
            />
            <div className="flex flex-col">
              <span className="font-semibold">{constituent.name}</span>
              <span className="text-sm text-default-500">
                {constituent.symbol}
              </span>
            </div>
          </div>
        );

      case "price_usd":
        return (
          <PriceCell
            fallbackPrice={constituent.price_usd}
            symbol={constituent.symbol}
          />
        );

      case "percent_change_24h": {
        const value = parseFloat(constituent.percent_change_24h || "0");
        const color = getPercentageColor(value);

        return (
          <Chip
            color={color}
            size="sm"
            startContent={
              value > 0 ? (
                <TrendingUp size={14} />
              ) : value < 0 ? (
                <TrendingDown size={14} />
              ) : null
            }
            variant="flat"
          >
            {formatPercentage(value)}
          </Chip>
        );
      }

      case "percent_change_7d": {
        const value = parseFloat(constituent.percent_change_7d || "0");
        const color = getPercentageColor(value);

        return (
          <Chip
            color={color}
            size="sm"
            startContent={
              value > 0 ? (
                <TrendingUp size={14} />
              ) : value < 0 ? (
                <TrendingDown size={14} />
              ) : null
            }
            variant="flat"
          >
            {formatPercentage(value)}
          </Chip>
        );
      }

      case "market_cap_usd":
        return (
          <MarketCapCell
            circulatingSupply={constituent.circulating_supply}
            fallbackPrice={constituent.price_usd}
            symbol={constituent.symbol}
          />
        );

      case "weight_in_index": {
        const weight = parseFloat(constituent.weight_in_index || "0");

        return <div className="font-mono">{weight.toFixed(2)}%</div>;
      }

      case "volume_24h_usd":
        return (
          <div className="font-mono">
            {formatUSD(constituent.volume_24h_usd)}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Table
      aria-label="CoinRisqLab 80 Index constituents table"
      classNames={{
        wrapper: "",
      }}
      sortDescriptor={
        sortColumn && sortOrder
          ? {
            column: sortColumn,
            direction: sortOrder === "asc" ? "ascending" : "descending",
          }
          : undefined
      }
      topContent={
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold">
            CoinRisqLab 80 Index Constituents
          </h2>
          <Input
            isClearable
            className="w-full sm:max-w-xs"
            placeholder="Search by symbol or name..."
            startContent={<Search size={18} />}
            value={searchTerm}
            onClear={() => setSearchTerm("")}
            onValueChange={setSearchTerm}
          />
        </div>
      }
      onSortChange={(descriptor) => {
        if (descriptor.column) {
          handleSort(descriptor.column.toString());
        }
      }}
    >
      <TableHeader columns={columns}>
        {(column) => (
          <TableColumn key={column.key} allowsSorting={column.sortable}>
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody
        emptyContent={"No constituents found"}
        items={filteredAndSortedConstituents}
      >
        {(item) => (
          <TableRow
            key={item.symbol}
            className="cursor-pointer hover:bg-default-100 transition-colors"
            onClick={() => {
              sStorage.set(
                "CRYPTO_RETURN_PATH",
                "/index-coinrisqlab#constituents-table",
              );
              router.push(`/crypto/${item.symbol}`);
            }}
          >
            {(columnKey) => (
              <TableCell>{renderCell(item, columnKey)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

// Export with memo to prevent unnecessary re-renders
export const ConstituentsTable = memo(ConstituentsTableComponent);
