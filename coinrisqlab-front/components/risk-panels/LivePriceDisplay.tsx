"use client";

import { memo } from "react";

import { useBinancePrice } from "@/hooks/useBinancePrices";
import { formatCryptoPrice } from "@/lib/formatters";

interface LivePriceDisplayProps {
  symbol: string;
  initialPrice?: number | null;
  className?: string;
}

function LivePriceDisplayComponent({
  symbol,
  initialPrice,
  className = "text-4xl font-bold tabular-nums",
}: LivePriceDisplayProps) {
  const livePrice = useBinancePrice(symbol, initialPrice);
  const displayPrice = livePrice ?? initialPrice ?? 0;

  return <p className={className}>{formatCryptoPrice(displayPrice)}</p>;
}

export const LivePriceDisplay = memo(LivePriceDisplayComponent);
