export interface IndexConstituent {
  rank_position: number;
  coingecko_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: string;
  market_cap_usd: string;
  circulating_supply: string;
  weight_in_index: string;
  percent_change_24h: string;
  percent_change_7d: string;
  volume_24h_usd: string;
}

export interface IndexCurrent {
  index_level: number;
  timestamp: string;
  total_market_cap_usd: string;
  number_of_constituents: number;
  percent_change_1h: number;
}

export interface HistoricalValues {
  yesterday: number | null;
  lastWeek: number | null;
  lastMonth: number | null;
}

export interface IndexHistoryPoint {
  index_level: number;
  timestamp: string;
}

export interface IndexChanges {
  "1h": number | null;
  "24h": number | null;
  "7d": number | null;
  "30d": number | null;
}

export interface IndexDetailsResponse {
  data: {
    current: IndexCurrent | null;
    historicalValues: HistoricalValues;
    changes: IndexChanges;
    history: IndexHistoryPoint[];
    constituents: IndexConstituent[];
  };
}
