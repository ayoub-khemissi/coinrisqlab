import { useEffect, useState, useRef, useCallback } from "react";

interface BinanceTicker {
  s: string;
  c: string;
}

interface BinanceMiniTicker {
  e: string;
  s: string;
  c: string;
}

const SINGLE_SYMBOL_THRESHOLD = 3;
const RECONNECT_BASE_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 5;
const MULTI_SYMBOL_THROTTLE = 5000;

/**
 * Hook to subscribe to crypto prices from Binance WebSocket.
 * - For 1-3 symbols: uses individual miniTicker streams (real-time updates)
 * - For 4+ symbols: uses combined ticker stream with 5s throttle
 *
 * @param symbols - Array of crypto symbols (e.g., ["BTC", "ETH"])
 * @returns Record of symbol -> price (as number)
 */
export function useBinancePrices(symbols: string[]): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const isMountedRef = useRef(true);
  const lastUpdateTimeRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const symbolsKey = symbols.join(",").toUpperCase();

  const connect = useCallback(() => {
    if (symbols.length === 0) return;

    const useIndividualStreams = symbols.length <= SINGLE_SYMBOL_THRESHOLD;

    let wsUrl: string;

    if (useIndividualStreams) {
      // Use combined stream URL for individual symbols
      const streams = symbols
        .map((s) => `${s.toLowerCase()}usdt@miniTicker`)
        .join("/");

      wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    } else {
      // Use all tickers stream for many symbols
      wsUrl = "wss://stream.binance.com:9443/ws/!ticker@arr";
    }

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

        if (useIndividualStreams) {
          // Combined stream format: { stream: "btcusdt@miniTicker", data: {...} }
          const data: BinanceMiniTicker = message.data;

          if (data?.c && data?.s) {
            const symbol = data.s.replace("USDT", "");

            setPrices((prev) => ({
              ...prev,
              [symbol]: parseFloat(data.c),
            }));
          }
        } else {
          // All tickers format: [{s: "BTCUSDT", c: "..."}, ...]
          const now = Date.now();

          if (now - lastUpdateTimeRef.current < MULTI_SYMBOL_THROTTLE) {
            return;
          }

          const tickers: BinanceTicker[] = message;
          const updates: Record<string, number> = {};

          symbols.forEach((symbol) => {
            const binanceSymbol = `${symbol.toUpperCase()}USDT`;
            const ticker = tickers.find((t) => t.s === binanceSymbol);

            if (ticker) {
              updates[symbol.toUpperCase()] = parseFloat(ticker.c);
            }
          });

          if (Object.keys(updates).length > 0) {
            setPrices((prev) => ({ ...prev, ...updates }));
            lastUpdateTimeRef.current = now;
          }
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
