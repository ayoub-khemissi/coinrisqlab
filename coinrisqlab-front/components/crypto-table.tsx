"use client";

import React, { memo } from "react";
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
import { Pagination } from "@heroui/pagination";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { TrendingUp, TrendingDown, Search } from "lucide-react";

import { PriceCell } from "./PriceCell";
import { MarketCapCell } from "./MarketCapCell";

import { Cryptocurrency } from "@/types/cryptocurrency";
import {
  formatUSD,
  formatCryptoPrice,
  formatCirculatingSupply,
  formatPercentage,
  getPercentageColor,
} from "@/lib/formatters";
import { sStorage } from "@/lib/sessionStorage";

interface CryptoTableProps {
  data: Cryptocurrency[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSort: (column: string) => void;
  sortColumn: string | null;
  sortOrder: "asc" | "desc" | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

function CryptoTableComponent({
  data,
  isLoading = false,
  page,
  totalPages,
  onPageChange,
  onSort,
  sortColumn,
  sortOrder,
  searchTerm,
  onSearchChange,
}: CryptoTableProps) {
  const router = useRouter();

  const columns = [
    { key: "rank", label: "Rank", sortable: true, dbColumn: "market_cap_usd" },
    { key: "name", label: "Cryptocurrency", sortable: true },
    { key: "price_usd", label: "Price", sortable: true },
    { key: "percent_change_24h", label: "24h %", sortable: true },
    { key: "percent_change_7d", label: "7d %", sortable: true },
    { key: "market_cap_usd", label: "Market Cap", sortable: true },
    { key: "circulating_supply", label: "Circulating Supply", sortable: true },
    { key: "volume_24h_usd", label: "24h Volume", sortable: true },
    { key: "ma_90d", label: "MA 90d", sortable: true },
    { key: "beta", label: "Beta", sortable: true },
  ];

  const renderCell = (crypto: Cryptocurrency, columnKey: React.Key) => {
    switch (columnKey) {
      case "rank":
        return (
          <div className="text-default-600 font-semibold">#{crypto.rank}</div>
        );

      case "name":
        return (
          <div className="flex items-center gap-3">
            <Image
              alt={crypto.name}
              className="rounded-full min-w-8 min-h-8"
              height={32}
              src={crypto.image_url || undefined}
              width={32}
            />
            <div className="flex flex-col">
              <span className="font-semibold">{crypto.name}</span>
              <span className="text-sm text-default-500">{crypto.symbol}</span>
            </div>
          </div>
        );

      case "price_usd":
        return (
          <PriceCell fallbackPrice={crypto.price_usd} symbol={crypto.symbol} />
        );

      case "percent_change_24h": {
        const value = parseFloat(crypto.percent_change_24h || "0");
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
        const value = parseFloat(crypto.percent_change_7d || "0");
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
            circulatingSupply={crypto.circulating_supply}
            fallbackPrice={crypto.price_usd}
            symbol={crypto.symbol}
          />
        );

      case "circulating_supply":
        return (
          <div className="font-mono text-sm">
            {formatCirculatingSupply(crypto.circulating_supply, crypto.symbol)}
          </div>
        );

      case "volume_24h_usd":
        return (
          <div className="font-mono">{formatUSD(crypto.volume_24h_usd)}</div>
        );

      case "ma_90d":
        return (
          <div className="font-mono">
            {crypto.ma_90d ? formatCryptoPrice(crypto.ma_90d) : "—"}
          </div>
        );

      case "beta": {
        const betaValue = crypto.beta ? parseFloat(crypto.beta) : null;

        return (
          <div className="font-mono">
            {betaValue !== null ? betaValue.toFixed(2) : "—"}
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Table
      aria-label="Cryptocurrency table"
      bottomContent={
        totalPages > 1 ? (
          <div className="flex w-full justify-center">
            <Pagination
              isCompact
              showControls
              showShadow
              color="primary"
              page={page}
              total={totalPages}
              onChange={onPageChange}
            />
          </div>
        ) : null
      }
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
          <h2 className="text-lg font-semibold">All Cryptocurrencies</h2>
          <Input
            isClearable
            className="w-full sm:max-w-xs"
            placeholder="Search by symbol or name..."
            startContent={<Search size={18} />}
            value={searchTerm}
            onClear={() => onSearchChange("")}
            onValueChange={onSearchChange}
          />
        </div>
      }
      onSortChange={(descriptor) => {
        if (descriptor.column) {
          const column = descriptor.column as string;
          const columnConfig = columns.find((col) => col.key === column);
          const dbColumn = columnConfig?.dbColumn || column;

          onSort(dbColumn);
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
        emptyContent={"No cryptocurrencies found"}
        isLoading={isLoading}
        items={data}
        loadingContent={<Spinner label="Loading..." />}
      >
        {(item) => (
          <TableRow
            key={item.id}
            className="cursor-pointer hover:bg-default-100 transition-colors"
            onClick={() => {
              sStorage.set("CRYPTO_RETURN_PATH", "/#crypto-table");
              router.push(`/crypto/${item.coingecko_id}`);
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
export const CryptoTable = memo(CryptoTableComponent);
