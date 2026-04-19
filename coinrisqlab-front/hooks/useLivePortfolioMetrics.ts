import { useMemo } from "react";

import { HoldingWithPortfolio } from "@/types/user";
import { useBinancePrices } from "@/hooks/useBinancePrices";

export interface LiveHolding extends HoldingWithPortfolio {
  live_price: number;
  live_value: number;
  live_pnl: number;
}

export interface PortfolioAggregate {
  id: number;
  name: string;
  value: number;
  pnl: number;
  holdingCount: number;
}

export interface LivePortfolioMetrics {
  holdings: LiveHolding[];
  totalValue: number;
  totalPnl: number;
  byPortfolio: Record<number, PortfolioAggregate>;
}

/**
 * Recompute holding values and aggregates on top of live Binance prices.
 * Falls back to the DB-computed `current_price` for any symbol the
 * WebSocket hasn't reported yet (non-USDT pairs, pre-connect, etc.).
 */
export function useLivePortfolioMetrics(
  holdings: HoldingWithPortfolio[],
): LivePortfolioMetrics {
  const symbols = useMemo(
    () => Array.from(new Set(holdings.map((h) => h.symbol))),
    [holdings],
  );

  const livePrices = useBinancePrices(symbols);

  return useMemo(() => {
    const liveHoldings: LiveHolding[] = holdings.map((h) => {
      const livePrice =
        livePrices[h.symbol.toUpperCase()] ?? Number(h.current_price) ?? 0;
      const quantity = Number(h.quantity) || 0;
      const avgBuy = Number(h.avg_buy_price) || 0;
      const liveValue = quantity * livePrice;
      const livePnl = quantity * (livePrice - avgBuy);

      return {
        ...h,
        live_price: livePrice,
        live_value: liveValue,
        live_pnl: livePnl,
      };
    });

    const byPortfolio: Record<number, PortfolioAggregate> = {};
    let totalValue = 0;
    let totalPnl = 0;

    for (const h of liveHoldings) {
      totalValue += h.live_value;
      totalPnl += h.live_pnl;

      const existing = byPortfolio[h.portfolio_id];

      if (existing) {
        existing.value += h.live_value;
        existing.pnl += h.live_pnl;
        existing.holdingCount += 1;
      } else {
        byPortfolio[h.portfolio_id] = {
          id: h.portfolio_id,
          name: h.portfolio_name,
          value: h.live_value,
          pnl: h.live_pnl,
          holdingCount: 1,
        };
      }
    }

    return { holdings: liveHoldings, totalValue, totalPnl, byPortfolio };
  }, [holdings, livePrices]);
}
