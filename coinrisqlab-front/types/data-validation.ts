export interface CryptoOption {
  id: number;
  symbol: string;
  name: string;
  coingecko_id: string;
  image_url: string | null;
}

export interface DataFiltersState {
  cryptos: string[]; // coingecko_ids
  from: string;
  to: string;
  window: number;
  portfolioId?: number;
  crypto1?: string;
  crypto2?: string;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  limit: number;
  offset: number;
}
