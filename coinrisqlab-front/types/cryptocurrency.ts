export interface Cryptocurrency {
  id: number;
  coingecko_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  price_usd: string;
  market_cap_usd: string;
  volume_24h_usd: string;
  circulating_supply: string;
  percent_change_24h: string | null;
  percent_change_7d: string | null;
  timestamp: string;
  rank: number;
  ma_90d: string | null;
  beta: string | null;
}

export interface CryptocurrencyResponse {
  data: Cryptocurrency[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
