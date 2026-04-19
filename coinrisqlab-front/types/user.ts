export interface User {
  id: number;
  email: string;
  displayName: string;
  plan: "free" | "pro";
  planExpiresAt: string | null;
}

export interface Portfolio {
  id: number;
  name: string;
  description: string | null;
  holding_count: number;
  latest_value: number | null;
  latest_pnl: number | null;
  created_at: string;
  updated_at: string;
}

export interface Holding {
  id: number;
  crypto_id: number;
  symbol: string;
  crypto_name: string;
  image_url: string | null;
  quantity: number;
  avg_buy_price: number;
  first_buy_date: string | null;
  current_price: number;
  current_value: number;
  unrealized_pnl: number;
  pnl_percent: number;
  percent_change_24h: number;
  allocation_pct: number;
}

export interface Transaction {
  id: number;
  crypto_id: number;
  symbol: string;
  crypto_name: string;
  image_url: string | null;
  type: "buy" | "sell" | "transfer";
  quantity: number;
  price_usd: number;
  fee_usd: number;
  timestamp: string;
  notes: string | null;
  created_at: string;
}

export interface Alert {
  id: number;
  crypto_id: number;
  symbol: string;
  crypto_name: string;
  image_url: string | null;
  alert_type:
    | "price"
    | "volatility"
    | "drawdown"
    | "var_breach"
    | "rebalancing";
  threshold_value: number;
  direction: "above" | "below";
  is_active: boolean;
  current_price: number;
  last_triggered_at: string | null;
  created_at: string;
}

export interface PortfolioOverview {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  pnlPercent: number;
  holdingCount: number;
  allocation: {
    crypto_id: number;
    symbol: string;
    name: string;
    image_url: string | null;
    value: number;
    weight: number;
    pnl: number;
  }[];
}

export interface PortfolioVolatility {
  dailyVolatility: number;
  annualizedVolatility: number;
  beta: number;
  holdingCount: number;
  dataPoints: number;
}

export interface PortfolioRiskMetrics {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
  sharpe: number;
  diversificationBenefit: number;
  dailyVolatility: number;
  annualizedVolatility: number;
  dataPoints: number;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  dataPoints: number;
}
