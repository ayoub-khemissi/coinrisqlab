// Type definitions for cryptocurrency detail page

export interface CryptoBasicInfo {
  id: number;
  symbol: string;
  name: string;
  image_url: string | null;
  logo_url: string | null;
  description: string | null;
  categories: string[];
  metadata_updated_at: string | null;
}

export interface CryptoLinks {
  website: string | null;
  whitepaper: string | null;
  twitter: string | null;
  reddit: string | null;
  telegram: string | null;
  github: string | null;
}

export interface CryptoLaunch {
  date: string | null;
  platform: string | null;
}

export interface CryptoMarket {
  price_usd: number;
  market_cap_usd: number;
  volume_24h_usd: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  fully_diluted_valuation: number | null;
  rank: number | null;
  index_rank: number | null;
  market_cap_rank: number | null;
  percent_change_1h: number | null;
  percent_change_24h: number | null;
  percent_change_7d: number | null;
  percent_change_14d: number | null;
  percent_change_30d: number | null;
  percent_change_200d: number | null;
  percent_change_1y: number | null;
  last_updated: string;
}

export interface CryptoDetail {
  basic: CryptoBasicInfo;
  links: CryptoLinks;
  launch: CryptoLaunch;
  market: CryptoMarket;
}

export interface CryptoDetailResponse {
  data: CryptoDetail;
}
