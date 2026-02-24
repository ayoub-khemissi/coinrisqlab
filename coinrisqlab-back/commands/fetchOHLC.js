import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

const RECOVERY_WINDOW_DAYS = 730; // Max gap detection window (= API max on Basic plan: 2 years)
const API_DELAY_MS = 250;         // Rate limiting: 240 calls/min (Basic plan limit = 250/min)
const DAYS_BUFFER = 2;            // Extra margin beyond the oldest gap

/**
 * Main function: smart backfill via /market_chart.
 * Detects gaps in ohlc and backfills daily data (days=730).
 */
async function fetchDailyData() {
  const startTime = Date.now();

  try {
    log.info('Starting OHLC backfill (CoinGecko /market_chart)...');

    if (!config.COINGECKO_API_KEY) {
      throw new Error('COINGECKO_API_KEY is not configured');
    }

    const stats = await runDailyBackfill();

    const duration = Date.now() - startTime;
    log.info(`Backfill completed in ${(duration / 1000).toFixed(2)}s`);
    log.info(`API calls: ${stats.apiCalls}, OHLC inserted: ${stats.ohlcInserted}, errors: ${stats.apiErrors}`);

  } catch (error) {
    log.error(`Error in fetchDailyData: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// DAILY BACKFILL (Phase 1-2)
// ═══════════════════════════════════════════════════════════════

/**
 * Run the daily backfill: detect gaps in ohlc, fetch days=730 (daily auto).
 */
async function runDailyBackfill() {
  const stats = { apiCalls: 0, ohlcInserted: 0, apiErrors: 0 };

  const cryptosWithGaps = await detectCryptosWithDailyGaps();

  if (cryptosWithGaps.length === 0) {
    log.info('[Daily] No gaps detected - all cryptos are up to date');
    return stats;
  }

  log.info(`[Daily] Found ${cryptosWithGaps.length} crypto(s) with gaps to backfill`);

  for (const crypto of cryptosWithGaps) {
    try {
      const result = await processDailyBackfill(crypto.id, crypto.symbol, crypto.coingecko_id);
      stats.ohlcInserted += result.ohlcInserted;

      if (result.apiCalled) {
        stats.apiCalls++;
        await delay(API_DELAY_MS);
      }

      if (result.apiError) {
        stats.apiErrors++;
      }
    } catch (error) {
      log.error(`[Daily] Error processing ${crypto.symbol}: ${error.message}`);
      stats.apiErrors++;
    }
  }

  return stats;
}

/**
 * Detect all cryptos where yesterday is missing from ohlc.
 */
async function detectCryptosWithDailyGaps() {
  const [rows] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id
    FROM cryptocurrencies c
    WHERE c.coingecko_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ohlc o
        WHERE o.crypto_id = c.id
          AND o.timestamp = CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 00:00:00')
      )
    ORDER BY c.symbol
  `);

  return rows;
}

/**
 * Process daily backfill for a single crypto.
 */
async function processDailyBackfill(cryptoId, symbol, coingeckoId) {
  const gaps = await detectDetailedDailyGaps(cryptoId);

  if (gaps.ohlcMissing.size === 0) {
    log.debug(`${symbol}: No gaps on detailed check, skipping`);
    return { ohlcInserted: 0, apiCalled: false, apiError: false };
  }

  const daysNeeded = gaps.daysNeeded;
  log.debug(`${symbol}: ${gaps.ohlcMissing.size} ohlc gap(s), fetching days=${daysNeeded}`);

  const { data, error: apiError } = await fetchMarketChart(coingeckoId, daysNeeded);

  if (apiError) {
    log.warn(`${symbol}: API error - ${apiError}`);
    return { ohlcInserted: 0, apiCalled: true, apiError: true };
  }

  if (!data || !data.prices || data.prices.length === 0) {
    log.warn(`${symbol}: No data returned from API`);
    return { ohlcInserted: 0, apiCalled: true, apiError: true };
  }

  // Aggregate to daily data
  const dailyData = aggregateToDailyData(data);

  // Insert into ohlc (only missing dates)
  let ohlcInserted = 0;
  for (const [dateStr, dayData] of dailyData) {
    if (gaps.ohlcMissing.has(dateStr) && dayData.price > 0) {
      await insertOhlcRecord(cryptoId, dateStr, dayData.price);
      ohlcInserted++;
    }
  }

  if (ohlcInserted > 0) {
    log.debug(`${symbol}: Inserted ${ohlcInserted} ohlc record(s)`);
  }

  return { ohlcInserted, apiCalled: true, apiError: false };
}

/**
 * Detect detailed daily gaps in ohlc.
 */
async function detectDetailedDailyGaps(cryptoId) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const allDates = [];

  for (let i = 1; i <= RECOVERY_WINDOW_DAYS; i++) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - i);
    allDates.push(formatDateString(date));
  }

  const [existingOhlc] = await Database.execute(`
    SELECT DATE_FORMAT(timestamp, '%Y-%m-%d') as d
    FROM ohlc
    WHERE crypto_id = ?
      AND timestamp >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  `, [cryptoId, RECOVERY_WINDOW_DAYS]);

  const ohlcSet = new Set(existingOhlc.map(r => r.d));

  const ohlcMissing = new Set();
  let oldestGap = null;

  for (const dateStr of allDates) {
    if (!ohlcSet.has(dateStr)) {
      ohlcMissing.add(dateStr);
      if (!oldestGap || dateStr < oldestGap) oldestGap = dateStr;
    }
  }

  let daysNeeded = 3;
  if (oldestGap) {
    const gapDate = new Date(oldestGap + 'T00:00:00Z');
    const diffMs = now.getTime() - gapDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    daysNeeded = Math.min(diffDays + DAYS_BUFFER, RECOVERY_WINDOW_DAYS);
  }

  return { ohlcMissing, daysNeeded };
}

// ═══════════════════════════════════════════════════════════════
// SHARED FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch /coins/{id}/market_chart from CoinGecko (1 credit).
 */
async function fetchMarketChart(coingeckoId, days) {
  const url = `${Constants.COINGECKO_COIN_MARKET_CHART}/${coingeckoId}/market_chart?vs_currency=usd&days=${days}`;

  try {
    const response = await fetch(url, {
      headers: {
        'x-cg-pro-api-key': config.COINGECKO_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { data: null, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();

    if (!data.prices || !Array.isArray(data.prices)) {
      return { data: null, error: 'Invalid response format (missing prices array)' };
    }

    return { data, error: null };

  } catch (error) {
    return { data: null, error: error.message };
  }
}

/**
 * Aggregate market_chart data into daily data (last point per UTC day).
 * Excludes today (incomplete day).
 */
function aggregateToDailyData(data) {
  const todayStr = formatDateString(new Date());

  const pricesByDay = new Map();
  const mcapsByDay = new Map();
  const volumesByDay = new Map();

  for (const [ts, val] of data.prices) {
    const dateStr = formatDateString(new Date(ts));
    if (dateStr === todayStr) continue;
    pricesByDay.set(dateStr, val);
  }

  if (data.market_caps) {
    for (const [ts, val] of data.market_caps) {
      const dateStr = formatDateString(new Date(ts));
      if (dateStr === todayStr) continue;
      mcapsByDay.set(dateStr, val);
    }
  }

  if (data.total_volumes) {
    for (const [ts, val] of data.total_volumes) {
      const dateStr = formatDateString(new Date(ts));
      if (dateStr === todayStr) continue;
      volumesByDay.set(dateStr, val);
    }
  }

  const dailyData = new Map();
  for (const [dateStr, price] of pricesByDay) {
    dailyData.set(dateStr, {
      price,
      marketCap: mcapsByDay.get(dateStr) || 0,
      volume: volumesByDay.get(dateStr) || 0,
    });
  }

  return dailyData;
}

/**
 * Insert an OHLC record (daily only). open=high=low=close=price.
 */
async function insertOhlcRecord(cryptoId, dateStr, price) {
  const timestamp = `${dateStr} 00:00:00`;
  await Database.execute(`
    INSERT INTO ohlc (crypto_id, timestamp, open, high, low, close)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    open = VALUES(open),
    high = VALUES(high),
    low = VALUES(low),
    close = VALUES(close)
  `, [cryptoId, timestamp, price, price, price, price]);
}

/**
 * Format a Date as YYYY-MM-DD string (UTC).
 */
function formatDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Delay execution for specified milliseconds.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the command
fetchDailyData()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
