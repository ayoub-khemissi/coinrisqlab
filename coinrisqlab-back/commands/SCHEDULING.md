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
   - Simple (arithmetic) returns calculation
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

## Recent (5-min) Backfill — Daily Refresh of the Last 24h

`fetchOHLC.js --backfill-recent` refreshes the last 24h of every active
crypto from CoinGecko `/market_chart?days=1` (the only window where the
Basic plan exposes 5-min granularity). It serves two purposes:

1. **Gap fill** — if the live `*/5` cron has missed snapshots (server
   downtime, transient API misses), the missing 5-min slots are inserted.
2. **Precision upgrade** — `/coins/markets` (used by the live `*/5`)
   truncates prices to 2 decimals for cryptos in the $1–$100 range.
   `/market_chart` returns full precision. We `UPDATE` existing rows in
   place to upgrade the price without changing the timestamp, so existing
   `*/5` rows keep their slot but adopt the higher-precision value.

**Algorithm per crypto**

- Pre-load all market_data rows in the same 24h window
- For each CoinGecko 5-min point:
  - If a row exists within ±150s → `UPDATE price_usd in place` (precision upgrade)
  - Otherwise → `INSERT` new row (gap fill)
- Orphan timestamps from gap fills (where only a subset of cryptos got a
  new point) are filtered out by `MIN_CRYPTOS_PER_TIMESTAMP = 100` in
  `calculateCoinRisqLab80.js getMissingIndexTimestamps`, so the index calc
  doesn't try to compute partial snapshots.

**Cost profile**

| Scenario | API calls |
| :--- | :--- |
| Healthy day (just precision upgrade) | ~500 (one per active crypto) |
| `*/5` cron outage on top of normal day | ~500 (same) |

~500 credits/day = 15K/month on a 100K quota. The trade-off vs the old
"gap-only" mode is precision: every $1–$100 crypto gets full-precision
prices on the price-history charts, not the 2-decimal CoinGecko/markets
truncation.

Recommended cron: daily at `30 0 * * *` — runs after the previous day
fully closes.

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

# Recent 5-min safety net (00:30, ≤500 credits CoinGecko, usually 0)
# Detects market_data gaps in the last 24h and refills via /market_chart?days=1
30 0 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchOHLC.js --backfill-recent

# Hourly density safety net (00:45, ≤500 credits CoinGecko, usually 0)
# Backfills ohlc_hourly for cryptos newly entered the universe (or otherwise
# below the HOURLY_ENTRY_THRESHOLD of 500 rows in 90d) so the 30d/90d charts
# always have hourly granularity instead of falling back to daily-only.
45 0 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/fetchOHLC.js --backfill-hourly

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

# === User Space (0 credits) ===

# Portfolio value snapshots (02:30, after risk metrics)
30 2 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/snapshotPortfolios.js

# User portfolio analytics historization (02:45, after snapshots)
# Historizes all metrics displayed on /dashboard/portfolios/[id]/analytics so the
# business team can verify calculations against the UI. Uses the same shared module
# (utils/userPortfolioAnalytics.js) as the /analytics-bundle API route → values in DB
# are guaranteed to match what the user sees on the page.
45 2 * * * cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/calculateUserPortfolioAnalytics.js

# Clean expired user sessions (weekly, Sunday 04:00)
0 4 * * 0 cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back && node commands/cleanExpiredSessions.js
```

## User Portfolio Analytics Validation Export

`commands/exportUserPortfolioAnalyticsValidation.js` is an on-demand CLI tool for
the business team. It re-runs the shared calculation module for a given portfolio
and produces a CSV with raw inputs, intermediate steps and final metrics, plus a
cross-check against the row persisted by the nightly job.

```bash
node commands/exportUserPortfolioAnalyticsValidation.js <portfolio_id>
```

The generated CSV includes, for the given portfolio:
- Portfolio + user metadata
- Base parameters (window, formulas, annualization)
- Composition (quantities, prices, weights, betas, individual vols)
- Aligned log returns matrix (all constituents + synthetic portfolio return per day)
- Covariance matrix and portfolio volatility derivation
- Sorted portfolio returns → VaR 95/99, CVaR 95/99
- Sharpe, Skewness, Kurtosis with formulas
- Beta/Alpha OLS regression vs CoinRisqLab 80
- Correlation matrix of constituents
- DB row cross-check (field-by-field OK/DIFF) against `user_portfolio_analytics`

## Index Calculation Resilience

`calculateCoinRisqLab80.js` includes a safety net against transient
CoinGecko API misses. Without it, a missing top crypto (ex: ETH absent from
one fetch) silently lets a small-cap climb into the top 80 → the index
level drops by ~10–15% for a few cycles before recovering, polluting the
intra-day chart.

**How the safety net works** — for every snapshot:

1. Load the top `PROTECTED_TOP_RANK = 20` constituents from the previous
   valid snapshot
2. Detect any of them missing from the current `market_data` fetch
3. For each missing crypto, fall back to its most recent `market_data` row
   (within `MAX_FALLBACK_AGE_MS = 60min`) and merge it into the candidate
   set before computing the index
4. Each fallback is logged via `log.warn` (visible in the `log` table)
5. If more than `MAX_FALLBACKS_PER_SNAPSHOT = 3` constituents are missing,
   the whole snapshot is skipped — the next cron run will retry once the
   API recovers

**Retroactive repair** — if a corrupted snapshot is already in
`index_history` (e.g. created before the safety net existed), use:

```bash
node commands/repairCorruptedIndexSnapshots.js <snapshot_id_1> [<snapshot_id_2> ...]
```

This reconstitutes each snapshot from the previous valid one using the
same fallback logic and updates `index_history.index_level`,
`total_market_cap_usd` and the full `index_constituents` set in a single
transaction. All operations are logged via `log.warn` for audit.

**Note on impact on downstream calculations** — daily aggregates
(`crypto_beta`, `crypto_sml`, `portfolio_volatility`, `user_portfolio_analytics`)
take the **last** index_level of each day via
`SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1)`.
Intra-day corruption is therefore overwritten by later snapshots and does
NOT affect daily metrics. The only visible impact is the intra-day chart.

### Crontab Notes:

*   `cd /home/ubuntu/coinrisqlab/coinrisqlab/coinrisqlab-back`: Ensures scripts run from the correct directory for resolving local dependencies (`.env`, `utils`, etc.).
*   `&&`: Chains commands so the next one only runs if the previous succeeds.
*   Execution times for less frequent jobs are offset to prevent overlap with the main pipeline.
