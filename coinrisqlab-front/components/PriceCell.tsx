"use client";

import { memo } from "react";

import { useBinancePriceFromContext } from "@/contexts/BinancePricesContext";
import { formatCryptoPrice } from "@/lib/formatters";

interface PriceCellProps {
  symbol: string;
  fallbackPrice: string;
}

// Ce composant re-render UNIQUEMENT quand SON prix change
function PriceCellComponent({ symbol, fallbackPrice }: PriceCellProps) {
  const livePrice = useBinancePriceFromContext(symbol);
  const displayPrice = livePrice ?? parseFloat(fallbackPrice);

  return (
    <div className="font-mono" title={`$${displayPrice}`}>
      {formatCryptoPrice(displayPrice)}
    </div>
  );
}

export const PriceCell = memo(PriceCellComponent);
