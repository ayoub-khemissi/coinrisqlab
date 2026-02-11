export interface IndexMetric {
  index_level: number;
  percent_change_24h: number;
  timestamp: string;
}

export interface GlobalMetric {
  total_market_cap_usd: number;
  total_volume_24h_usd: number;
  btc_dominance: number;
  btc_dominance_24h_change: number;
  eth_dominance: number;
  eth_dominance_24h_change: number;
  others_dominance: number;
  others_dominance_24h_change: number;
  market_cap_change_24h: number;
  volume_change_24h: number;
  timestamp: string;
}

export interface FearGreedMetric {
  value: number;
  timestamp: string;
}

export interface MetricsResponse {
  data: {
    index: {
      current: IndexMetric | null;
      history: IndexMetric[];
    };
    global: {
      current: GlobalMetric | null;
      history: GlobalMetric[];
    };
    fearGreed: {
      current: FearGreedMetric | null;
      history: FearGreedMetric[];
    };
  };
}
