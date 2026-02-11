"use client";

import { memo } from "react";

import { useBinancePriceFromContext } from "@/contexts/BinancePricesContext";
import { formatUSD } from "@/lib/formatters";

interface MarketCapCellProps {
  symbol: string;
  fallbackPrice: string;
  circulatingSupply: string;
}

// This component re-render only when its price changes
function MarketCapCellComponent({
  symbol,
  fallbackPrice,
  circulatingSupply,
}: MarketCapCellProps) {
  const livePrice = useBinancePriceFromContext(symbol);
  const displayPrice = livePrice ?? parseFloat(fallbackPrice);
  const marketCap = displayPrice * parseFloat(circulatingSupply);

  return <div className="font-mono">{formatUSD(marketCap.toString())}</div>;
}

export const MarketCapCell = memo(MarketCapCellComponent);
