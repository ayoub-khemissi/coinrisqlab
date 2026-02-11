import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

const RECOVERY_WINDOW_DAYS = 730; // Max gap detection window (= API max on Basic plan: 2 years)
const HOURLY_BACKFILL_DAYS = 90;  // CoinGecko returns hourly auto for days <= 90
const HOURLY_ENTRY_THRESHOLD = 500; // If a crypto has fewer entries in 90 days, needs hourly backfill
const API_DELAY_MS = 250;         // Rate limiting: 240 calls/min (Basic plan limit = 250/min)
const DAYS_BUFFER = 2;            // Extra margin beyond the oldest gap

/**
 * Main function: smart backfill via /market_chart.
 * Phase 1-2: Daily backfill into ohlc + market_data (days=730, daily granularity)
 * Phase 3-4: Hourly backfill into market_data only (days=90, hourly auto granularity)
 */
async function fetchDailyData() {
  const startTime = Date.now();

  try {
    log.info('Starting data backfill (CoinGecko /market_chart)...');

    if (!config.COINGECKO_API_KEY) {
      throw new Error('COINGECKO_API_KEY is not configured');
    }

    // ── Phase 1-2: Daily backfill (ohlc + market_data) ──
    const dailyStats = await runDailyBackfill();

    // ── Phase 3-4: Hourly backfill (market_data only) ──
    const hourlyStats = await runHourlyBackfill();

    // ── Phase 5: Summary ──
    const duration = Date.now() - startTime;
    log.info(`Backfill completed in ${(duration / 1000).toFixed(2)}s`);
    log.info(`Daily  -> API calls: ${dailyStats.apiCalls}, OHLC inserted: ${dailyStats.ohlcInserted}, market_data inserted: ${dailyStats.mdInserted}, errors: ${dailyStats.apiErrors}`);
    log.info(`Hourly -> API calls: ${hourlyStats.apiCalls}, market_data inserted: ${hourlyStats.mdInserted}, errors: ${hourlyStats.apiErrors}`);
    log.info(`Total API credits used: ${dailyStats.apiCalls + hourlyStats.apiCalls}`);

  } catch (error) {
    log.error(`Error in fetchDailyData: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════
// DAILY BACKFILL (Phase 1-2)
// ═══════════════════════════════════════════════════════════════

/**
 * Run the daily backfill: detect gaps in ohlc/market_data, fetch days=730 (daily auto).
 */
async function runDailyBackfill() {
  const stats = { apiCalls: 0, ohlcInserted: 0, mdInserted: 0, apiErrors: 0 };

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
      stats.mdInserted += result.mdInserted;

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
 * Detect all cryptos where yesterday is missing from ohlc OR market_data.
 */
async function detectCryptosWithDailyGaps() {
  const [rows] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id
    FROM cryptocurrencies c
    WHERE c.coingecko_id IS NOT NULL
      AND (
        NOT EXISTS (
          SELECT 1 FROM ohlc o
          WHERE o.crypto_id = c.id
            AND o.timestamp = CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 00:00:00')
        )
        OR NOT EXISTS (
          SELECT 1 FROM market_data md
          WHERE md.crypto_id = c.id
            AND md.price_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        )
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

  if (gaps.ohlcMissing.size === 0 && gaps.mdMissing.size === 0) {
    log.debug(`${symbol}: No gaps on detailed check, skipping`);
    return { ohlcInserted: 0, mdInserted: 0, apiCalled: false, apiError: false };
  }

  const daysNeeded = gaps.daysNeeded;
  log.debug(`${symbol}: ${gaps.ohlcMissing.size} ohlc gap(s), ${gaps.mdMissing.size} md gap(s), fetching days=${daysNeeded}`);

  const { data, error: apiError } = await fetchMarketChart(coingeckoId, daysNeeded);

  if (apiError) {
    log.warn(`${symbol}: API error - ${apiError}`);
    return { ohlcInserted: 0, mdInserted: 0, apiCalled: true, apiError: true };
  }

  if (!data || !data.prices || data.prices.length === 0) {
    log.warn(`${symbol}: No data returned from API`);
    return { ohlcInserted: 0, mdInserted: 0, apiCalled: true, apiError: true };
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

  // Insert into market_data (only missing dates, daily timestamp)
  let mdInserted = 0;
  for (const [dateStr, dayData] of dailyData) {
    if (gaps.mdMissing.has(dateStr) && dayData.price > 0 && dayData.marketCap > 0) {
      const circulatingSupply = dayData.marketCap / dayData.price;
      const timestamp = `${dateStr} 00:00:00`;
      await insertMarketDataRecord(cryptoId, timestamp, dayData.price, circulatingSupply, dayData.volume);
      mdInserted++;
    }
  }

  if (ohlcInserted > 0 || mdInserted > 0) {
    log.debug(`${symbol}: Inserted ${ohlcInserted} ohlc + ${mdInserted} market_data record(s)`);
  }

  return { ohlcInserted, mdInserted, apiCalled: true, apiError: false };
}

/**
 * Detect detailed daily gaps in ohlc and market_data.
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

  const [existingMd] = await Database.execute(`
    SELECT DISTINCT DATE_FORMAT(price_date, '%Y-%m-%d') as d
    FROM market_data
    WHERE crypto_id = ?
      AND price_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  `, [cryptoId, RECOVERY_WINDOW_DAYS]);

  const mdSet = new Set(existingMd.map(r => r.d));

  const ohlcMissing = new Set();
  const mdMissing = new Set();
  let oldestGap = null;

  for (const dateStr of allDates) {
    if (!ohlcSet.has(dateStr)) {
      ohlcMissing.add(dateStr);
      if (!oldestGap || dateStr < oldestGap) oldestGap = dateStr;
    }
    if (!mdSet.has(dateStr)) {
      mdMissing.add(dateStr);
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

  return { ohlcMissing, mdMissing, daysNeeded };
}

// ═══════════════════════════════════════════════════════════════
// HOURLY BACKFILL (Phase 3-4)
// ═══════════════════════════════════════════════════════════════

/**
 * Run the hourly backfill: fetch days=90 (hourly auto), insert into market_data only.
 * Skips cryptos that already have sufficient entries (from live cron or previous backfill).
 */
async function runHourlyBackfill() {
  const stats = { apiCalls: 0, mdInserted: 0, apiErrors: 0 };

  const cryptos = await detectCryptosNeedingHourlyBackfill();

  if (cryptos.length === 0) {
    log.info('[Hourly] All cryptos have sufficient hourly data');
    return stats;
  }

  log.info(`[Hourly] Found ${cryptos.length} crypto(s) needing hourly backfill`);

  for (const crypto of cryptos) {
    try {
      const result = await processHourlyBackfill(crypto.id, crypto.symbol, crypto.coingecko_id);
      stats.mdInserted += result.mdInserted;

      if (result.apiCalled) {
        stats.apiCalls++;
        await delay(API_DELAY_MS);
      }

      if (result.apiError) {
        stats.apiErrors++;
      }
    } catch (error) {
      log.error(`[Hourly] Error processing ${crypto.symbol}: ${error.message}`);
      stats.apiErrors++;
    }
  }

  return stats;
}

/**
 * Detect cryptos that lack hourly data in market_data for the last 90 days.
 * If a crypto has fewer than HOURLY_ENTRY_THRESHOLD entries, it needs hourly backfill.
 */
async function detectCryptosNeedingHourlyBackfill() {
  const [rows] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id, COUNT(md.id) as entry_count
    FROM cryptocurrencies c
    LEFT JOIN market_data md
      ON md.crypto_id = c.id
      AND md.price_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    WHERE c.coingecko_id IS NOT NULL
    GROUP BY c.id, c.symbol, c.coingecko_id
    HAVING entry_count < ?
    ORDER BY c.symbol
  `, [HOURLY_BACKFILL_DAYS, HOURLY_ENTRY_THRESHOLD]);

  return rows;
}

/**
 * Process hourly backfill for a single crypto.
 * Fetches days=90 (auto hourly granularity), inserts each hourly point into market_data.
 * Does NOT touch the ohlc table (stays daily for log returns).
 */
async function processHourlyBackfill(cryptoId, symbol, coingeckoId) {
  const { data, error: apiError } = await fetchMarketChart(coingeckoId, HOURLY_BACKFILL_DAYS);

  if (apiError) {
    log.warn(`${symbol}: Hourly API error - ${apiError}`);
    return { mdInserted: 0, apiCalled: true, apiError: true };
  }

  if (!data || !data.prices || data.prices.length === 0) {
    log.warn(`${symbol}: No hourly data returned from API`);
    return { mdInserted: 0, apiCalled: true, apiError: true };
  }

  const todayStr = formatDateString(new Date());
  let mdInserted = 0;

  for (let i = 0; i < data.prices.length; i++) {
    const [ts, price] = data.prices[i];

    // Skip today (incomplete)
    const dateStr = formatDateString(new Date(ts));
    if (dateStr === todayStr) continue;
    if (!price || price <= 0) continue;

    const marketCap = data.market_caps?.[i]?.[1] || 0;
    const volume = data.total_volumes?.[i]?.[1] || 0;
    if (marketCap <= 0) continue;

    const circulatingSupply = marketCap / price;
    const timestamp = formatHourlyTimestamp(new Date(ts));

    await insertMarketDataRecord(cryptoId, timestamp, price, circulatingSupply, volume);
    mdInserted++;
  }

  if (mdInserted > 0) {
    log.debug(`${symbol}: Hourly backfill inserted ${mdInserted} market_data record(s)`);
  }

  return { mdInserted, apiCalled: true, apiError: false };
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
 * Insert a market_data record (daily or hourly).
 * ON DUPLICATE KEY: does NOT overwrite existing non-zero values
 * (live cron snapshots are more complete).
 */
async function insertMarketDataRecord(cryptoId, timestamp, priceUsd, circulatingSupply, volume24h) {
  await Database.execute(`
    INSERT INTO market_data (crypto_id, price_usd, circulating_supply, volume_24h_usd, timestamp)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    price_usd = IF(price_usd = 0, VALUES(price_usd), price_usd),
    circulating_supply = IF(circulating_supply = 0, VALUES(circulating_supply), circulating_supply),
    volume_24h_usd = IF(volume_24h_usd = 0, VALUES(volume_24h_usd), volume_24h_usd)
  `, [cryptoId, priceUsd, circulatingSupply, volume24h, timestamp]);
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
 * Format a Date as YYYY-MM-DD HH:00:00 string (UTC, rounded to the hour).
 */
function formatHourlyTimestamp(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:00:00`;
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
