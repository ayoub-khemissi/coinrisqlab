export default {
    JWT_EXPIRATION_TIME: "30d",
    JWT_ALGORITHM: "HS512",

    APP_ID: 1,

    LOG_LEVEL_DEBUG: 1,
    LOG_LEVEL_INFO: 2,
    LOG_LEVEL_WARN: 3,
    LOG_LEVEL_ERROR: 4,

    // CoinMarketCap API (global metrics + fear & greed only)
    get COINMARKETCAP_BASE_URL() {
        return 'https://pro-api.coinmarketcap.com';
    },
    get COINMARKETCAP_GLOBAL_METRICS() {
        return `${this.COINMARKETCAP_BASE_URL}/v1/global-metrics/quotes/latest`;
    },
    get COINMARKETCAP_FEAR_AND_GREED() {
        return `${this.COINMARKETCAP_BASE_URL}/v3/fear-and-greed/historical`;
    },

    // CoinGecko API
    get COINGECKO_BASE_URL() {
        return 'https://pro-api.coingecko.com/api/v3';
    },
    get COINGECKO_COINS_MARKETS() {
        return `${this.COINGECKO_BASE_URL}/coins/markets`;
    },
    get COINGECKO_COIN_DETAIL() {
        return `${this.COINGECKO_BASE_URL}/coins`;
    },
    get COINGECKO_COIN_OHLC() {
        return `${this.COINGECKO_BASE_URL}/coins`;
    },
    get COINGECKO_COIN_MARKET_CHART() {
        return `${this.COINGECKO_BASE_URL}/coins`;
    },
}
