import { useEffect, useState, useRef, useCallback } from "react";

interface BinanceMiniTicker {
  e: string;
  s: string;
  c: string;
}

const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Hook to subscribe to crypto prices from Binance WebSocket.
 * Uses combined miniTicker streams for all symbols (up to 1024).
 *
 * @param symbols - Array of crypto symbols (e.g., ["BTC", "ETH"])
 * @returns Record of symbol -> price (as number)
 */
export function useBinancePrices(symbols: string[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const symbolsKey = symbols.join(",").toUpperCase();

  const connect = useCallback(() => {
    if (symbols.length === 0) return;

    // Always use combined individual streams (Binance supports up to 1024)
    const streams = symbols
      .map((s) => `${s.toLowerCase()}usdt@miniTicker`)
      .join("/");

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const ws = new WebSocket(wsUrl);

    wsRef.current = ws;

    ws.onopen = () => {
      if (isMountedRef.current) {
        reconnectAttemptsRef.current = 0;
      }
    };

    ws.onmessage = (event) => {
      if (!isMountedRef.current) return;

      try {
        const message = JSON.parse(event.data);

        // Combined stream format: { stream: "btcusdt@miniTicker", data: {...} }
        const data: BinanceMiniTicker = message.data;

        if (data?.c && data?.s) {
          const symbol = data.s.replace("USDT", "");

          setPrices((prev) => {
            const prevPrice = prev[symbol];
            const newPrice = parseFloat(data.c);

            // Only update if price actually changed
            if (prevPrice === newPrice) return prev;

            return { ...prev, [symbol]: newPrice };
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!isMountedRef.current) return;

      // Attempt reconnect with exponential backoff
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay =
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttemptsRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      }
    };
  }, [symbolsKey]);

  useEffect(() => {
    isMountedRef.current = true;

    if (symbols.length === 0) {
      setPrices({});

      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    connect();

    return () => {
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [symbolsKey, connect]);

  return prices;
}

/**
 * Convenience hook for a single symbol.
 * @param symbol - Single crypto symbol (e.g., "BTC")
 * @param initialPrice - Optional initial price before WebSocket connects
 * @returns The current price as a number, or initialPrice/null
 */
export function useBinancePrice(
  symbol: string | null,
  initialPrice?: number | null,
): number | null {
  const symbols = symbol ? [symbol] : [];
  const prices = useBinancePrices(symbols);

  if (!symbol) return null;

  const upperSymbol = symbol.toUpperCase();

  return prices[upperSymbol] ?? initialPrice ?? null;
}
