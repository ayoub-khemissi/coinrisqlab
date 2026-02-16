# Data Orchestration & Scheduling

This document outlines the strategy for scheduling the data fetching and processing scripts using **CoinGecko** (Basic plan, 100K credits/month) as the primary data source, and **CoinMarketCap** (10K credits/month) for global metrics and fear & greed only.

## API Credit Cost Analysis

### CoinGecko (100K credits/month)

Each call to a CoinGecko API endpoint costs 1 credit.

| Task | Frequency | Calls/run | Credits/month |
| :--- | :--- | :--- | :--- |
| **Market Data + Index** (`/coins/markets`) | Every 5 min | 2 (pages) | 17,280 |
| **Daily Backfill** (`/coins/{id}/market_chart`) | 1x/day 01:00 | ~500 | 15,000 |
| **Metadata** (`/coins/{id}`) | 1x/week | ~500 | 2,150 |
| **Total CoinGecko** | | | **~34,430** (34%) |

### CoinMarketCap (10K credits/month, reduced usage)

| Task | Frequency | Calls/run | Credits/month |
| :--- | :--- | :--- | :--- |
| **Global Metrics** | Every hour | 1 | 720 |
| **Fear & Greed** | 2x/day (08:00, 20:00) | 1 | 60 |
| **Total CMC** | | | **~780** (7.8%) |

### Internal (no API credits)

1. **`calculateCoinRisqLab80.js`**: Internal calculations on local database for the CoinRisqLab80 index. No external API calls.

2. **`updateVolatility.js`**: Orchestrates the full risk metrics pipeline:
   - Logarithmic returns calculation
   - Individual cryptocurrency volatility
   - Portfolio volatility
   - Distribution statistics (skewness & kurtosis)
   - VaR/CVaR statistics
   - Beta/Alpha statistics
   - SML statistics

   All risk metrics support **retroactive backfill** - they automatically calculate missing historical values.

## Daily Backfill Strategy (`fetchOHLC.js`)

The `fetchOHLC.js` script uses CoinGecko's `/coins/{id}/market_chart` endpoint to run two backfill passes:

1. **Daily pass** (`days=730`) → fills `ohlc` + `market_data` with daily data for up to 2 years
2. **Hourly pass** (`days=90`) → fills `market_data` only with hourly data for the last 90 days (~2,160 points/crypto)

### Pass 1: Daily backfill

1. **Batch gap detection**: A single SQL query identifies all cryptos where yesterday is missing from either `ohlc` or `market_data`. Cryptos that are fully up-to-date cost 0 credits.

2. **Detailed gap analysis**: For each crypto with gaps, the script generates all expected dates within the `RECOVERY_WINDOW_DAYS` and compares them against both tables to find exact missing dates - including intermediate gaps.

3. **Adaptive lookback**: The API `days` parameter is set to `(today - oldest_gap) + DAYS_BUFFER`, capped at `RECOVERY_WINDOW_DAYS`. If only yesterday is missing, `days=3`. If 30 days are missing, `days=32`.

4. **Dual insertion**: Each API call returns `prices[]`, `market_caps[]`, and `total_volumes[]`. The script inserts into:
   - `ohlc`: `open=high=low=close=price` (only close is used by log returns)
   - `market_data`: `price_usd`, `circulating_supply` (derived: `market_cap / price`), `volume_24h_usd`

### Pass 2: Hourly backfill

1. **Detection**: Counts `market_data` entries per crypto in the last 90 days. If fewer than 500 entries, hourly data is missing.

2. **Fetch**: Calls `/market_chart?days=90` (CoinGecko auto-returns hourly granularity for ≤90 days).

3. **Insert**: Each hourly data point is inserted into `market_data` with timestamp `YYYY-MM-DD HH:00:00`. Does NOT touch `ohlc` (stays daily for log returns).

4. **Idempotent**: After the first run + a few days of the live `*/5` cron, cryptos naturally exceed the 500-entry threshold → hourly backfill skips them (0 credits).

### Common behavior

- **Safe inserts**: `ON DUPLICATE KEY UPDATE` ensures idempotency. For `market_data`, existing records from the live cron are preserved (not overwritten).
- **Today excluded**: Data for the current day is always excluded since it's incomplete.

### Recovery scenarios

| Scenario | Daily pass | Hourly pass | Total credits |
| :--- | :--- | :--- | :--- |
| Normal day (yesterday missing) | ~500 (`days=3`) | 0 (skipped) | ~500 |
| All up-to-date | 0 | 0 | 0 |
| After 3-day outage | ~500 (`days=5`) | 0 | ~500 |
| After 7-day outage | ~500 (`days=9`) | 0 | ~500 |
| First run (empty tables) | ~500 (`days=730`) | ~500 (`days=90`) | ~1,000 |

### Configuration

| Parameter | Value | Description |
| :--- | :--- | :--- |
| `RECOVERY_WINDOW_DAYS` | 730 | Max daily gap detection window (= API max on Basic plan: 2 years) |
| `HOURLY_BACKFILL_DAYS` | 90 | Hourly backfill window (CoinGecko auto-hourly for ≤90 days) |
| `HOURLY_ENTRY_THRESHOLD` | 500 | Skip hourly backfill if crypto has ≥500 entries in 90 days |
| `API_DELAY_MS` | 250 | Rate limit safety: 240 calls/min (Basic limit: 250/min) |
| `DAYS_BUFFER` | 2 | Extra margin beyond the oldest daily gap |

## Crontab Configuration for Ubuntu

**Important:** The paths below are configured for the project located at `/home/ubuntu/coinrisqlab/coinrisqlab`.

```cron
# =================================================================
# CoinRisqLab Crypto Dashboard - CRON Jobs
# =================================================================

# === CoinGecko ===

# Market data + CoinRisqLab80 index (every 5 min, 2 credits CoinGecko)
*/5 * * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchCryptoMarketData.js && node commands/calculateCoinRisqLab80.js

# Daily Backfill via /market_chart (01:00, ~500 credits CoinGecko)
# Fills gaps in both ohlc and market_data tables
0 1 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchOHLC.js

# Metadata weekly, Sunday 03:05 (~500 credits CoinGecko)
5 3 * * 0 cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchCryptoMetadata.js

# === CoinMarketCap ===

# Global Metrics (every hour, 1 credit CMC)
0 * * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchGlobalMetrics.js

# Fear & Greed (2x/day at 08:00 and 20:00, 1 credit CMC — daily metric)
0 8,20 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchFearAndGreed.js

# === Internal (0 credits) ===

# Risk Metrics (02:00, after daily backfill)
0 2 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/updateVolatility.js
```

### Crontab Notes:

*   `cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back`: Ensures scripts run from the correct directory for resolving local dependencies (`.env`, `utils`, etc.).
*   `&&`: Chains commands so the next one only runs if the previous succeeds.
*   Execution times for less frequent jobs are offset to prevent overlap with the main pipeline.
