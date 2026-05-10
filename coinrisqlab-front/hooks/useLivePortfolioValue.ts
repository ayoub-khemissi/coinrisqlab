import { useMemo } from "react";

import { useBinancePrices } from "@/hooks/useBinancePrices";

export interface ConstituentForLive {
  symbol: string;
  quantity: number;
  current_price?: number | null;
  current_value?: number | null;
}

/**
 * Live USD portfolio value derived from Binance miniTicker streams.
 * Falls back to the back-end's `current_value` (or `quantity * current_price`)
 * for any symbol the WebSocket hasn't reported yet — non-USDT pairs,
 * pre-connect ticks, etc.
 *
 * Designed to be called from leaf components that render only their own
 * USD value (portfolio value chip, VaR $ loss, stressed $ value). Each
 * caller opens its own subscription, so heavy parents (charts, tables)
 * never re-render when a price ticks.
 */
export function useLivePortfolioValue(
  constituents: ConstituentForLive[] | undefined,
): number {
  const symbols = useMemo(
    () =>
      Array.from(
        new Set(
          (constituents ?? [])
            .map((c) => c.symbol?.toUpperCase())
            .filter(Boolean) as string[],
        ),
      ),
    [constituents],
  );

  const livePrices = useBinancePrices(symbols);

  return useMemo(() => {
    if (!constituents || constituents.length === 0) return 0;
    let total = 0;

    for (const c of constituents) {
      const sym = c.symbol?.toUpperCase();
      const live = sym ? livePrices[sym] : undefined;
      const fallback =
        c.current_price != null && c.quantity != null
          ? c.quantity * c.current_price
          : (c.current_value ?? 0);
      const liveVal =
        live != null ? c.quantity * live : fallback;

      total += liveVal || 0;
    }

    return total;
  }, [constituents, livePrices]);
}
