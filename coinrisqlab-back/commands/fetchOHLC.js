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
    if (!config.COINGECKO_API_KEY) {
      throw new Error('COINGECKO_API_KEY is not configured');
    }

    const isMarketCapBackfill = process.argv.includes('--backfill-mcap');
    const isHourlyBackfill = process.argv.includes('--backfill-hourly');
    const isRecentBackfill = process.argv.includes('--backfill-recent');

    if (isRecentBackfill) {
      log.info('Starting recent (5-min) backfill for active cryptos (days=1)...');
      const stats = await runRecentBackfill();
      const duration = Date.now() - startTime;
      log.info(`Recent backfill completed in ${(duration / 1000).toFixed(2)}s`);
      log.info(`API calls: ${stats.apiCalls}, cryptos touched: ${stats.cryptosTouched}, rows upgraded: ${stats.rowsUpgraded}, rows inserted: ${stats.rowsInserted}, errors: ${stats.apiErrors}`);
    } else if (isHourlyBackfill) {
      log.info('Starting hourly backfill for all cryptos (days=90)...');
      const stats = await runHourlyBackfill();
      const duration = Date.now() - startTime;
      log.info(`Hourly backfill completed in ${(duration / 1000).toFixed(2)}s`);
      log.info(`API calls: ${stats.apiCalls}, hourly inserted: ${stats.hourlyInserted}, errors: ${stats.apiErrors}`);
    } else if (isMarketCapBackfill) {
      log.info('Starting market cap backfill for all cryptos (days=730)...');
      const stats = await runMarketCapBackfill();
      const duration = Date.now() - startTime;
      log.info(`Market cap backfill completed in ${(duration / 1000).toFixed(2)}s`);
      log.info(`API calls: ${stats.apiCalls}, OHLC updated: ${stats.ohlcUpdated}, errors: ${stats.apiErrors}`);
    } else {
      log.info('Starting OHLC backfill (CoinGecko /market_chart)...');
      const stats = await runDailyBackfill();
      const duration = Date.now() - startTime;
      log.info(`Backfill completed in ${(duration / 1000).toFixed(2)}s`);
      log.info(`API calls: ${stats.apiCalls}, OHLC inserted: ${stats.ohlcInserted}, errors: ${stats.apiErrors}`);
    }

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
      await insertOhlcRecord(cryptoId, dateStr, dayData.price, dayData.marketCap || null, dayData.volume || null);
      ohlcInserted++;
    }
  }

  if (ohlcInserted > 0) {
    log.debug(`${symbol}: Inserted ${ohlcInserted} ohlc record(s)`);
  }

  // Also insert hourly data into ohlc_hourly
  const hourlyData = aggregateToHourlyData(data);
  let hourlyInserted = 0;
  for (const [tsStr, hourData] of hourlyData) {
    if (hourData.price > 0) {
      await insertOhlcHourlyRecord(cryptoId, tsStr, hourData.price, hourData.marketCap || null, hourData.volume || null);
      hourlyInserted++;
    }
  }

  if (hourlyInserted > 0) {
    log.debug(`${symbol}: Inserted ${hourlyInserted} ohlc_hourly record(s)`);
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
// MARKET CAP BACKFILL (--backfill-mcap)
// ═══════════════════════════════════════════════════════════════

/**
 * Backfill market_cap + volume for ALL cryptos (days=730).
 * Updates existing ohlc records via ON DUPLICATE KEY UPDATE.
 */
async function runMarketCapBackfill() {
  const stats = { apiCalls: 0, ohlcUpdated: 0, apiErrors: 0 };

  const [cryptos] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id
    FROM cryptocurrencies c
    WHERE c.coingecko_id IS NOT NULL
    ORDER BY c.symbol
  `);

  log.info(`[McapBackfill] Found ${cryptos.length} crypto(s) to backfill`);

  for (const crypto of cryptos) {
    try {
      const { data, error: apiError } = await fetchMarketChart(crypto.coingecko_id, RECOVERY_WINDOW_DAYS);
      stats.apiCalls++;

      if (apiError) {
        log.warn(`${crypto.symbol}: API error - ${apiError}`);
        stats.apiErrors++;
        await delay(API_DELAY_MS);
        continue;
      }

      if (!data || !data.prices || data.prices.length === 0) {
        log.warn(`${crypto.symbol}: No data returned from API`);
        stats.apiErrors++;
        await delay(API_DELAY_MS);
        continue;
      }

      const dailyData = aggregateToDailyData(data);
      let updated = 0;

      for (const [dateStr, dayData] of dailyData) {
        if (dayData.price > 0) {
          await insertOhlcRecord(crypto.id, dateStr, dayData.price, dayData.marketCap || null, dayData.volume || null);
          updated++;
        }
      }

      stats.ohlcUpdated += updated;
      log.info(`${crypto.symbol}: Updated ${updated} records with market_cap/volume`);

      await delay(API_DELAY_MS);
    } catch (error) {
      log.error(`[McapBackfill] Error processing ${crypto.symbol}: ${error.message}`);
      stats.apiErrors++;
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════
// RECENT BACKFILL (--backfill-recent)
// Daily refresh of every active crypto's last 24h via CoinGecko
// /market_chart?days=1 (only window where 5-min granularity is available
// on the Basic plan). Two roles:
//   1. Fill any gap left by the */5 cron (server downtime, transient
//      CoinGecko misses, etc.).
//   2. Upgrade precision: /coins/markets (used by the live */5) truncates
//      prices to 2 decimals for cryptos in the $1–$100 range; /market_chart
//      returns full-precision prices. We UPDATE in place so existing rows
//      keep their original timestamps but adopt the higher-precision value.
// Cost: ~500 credits/day (one call per active crypto, ~15K/month vs 100K
// quota). Cheaper alternatives (gap detection only) miss the precision
// upgrade for every healthy crypto.
// ═══════════════════════════════════════════════════════════════

const RECENT_BACKFILL_DAYS = 1;
const RECENT_SLOT_TOLERANCE_SEC = 150; // Match an existing row within ±2.5min for in-place UPDATE

async function runRecentBackfill() {
  const stats = { apiCalls: 0, rowsInserted: 0, rowsUpgraded: 0, cryptosTouched: 0, apiErrors: 0 };

  // Active cryptos = those with at least one market_data row in the last 24h.
  // Anything that hasn't been touched by the */5 cron in 24h is out of scope
  // (probably delisted or never indexed).
  const [cryptos] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id
    FROM cryptocurrencies c
    INNER JOIN (
      SELECT DISTINCT crypto_id
      FROM market_data
      WHERE timestamp >= NOW() - INTERVAL 24 HOUR
    ) active ON active.crypto_id = c.id
    WHERE c.coingecko_id IS NOT NULL
    ORDER BY c.symbol
  `);

  if (cryptos.length === 0) {
    log.info(`[RecentBackfill] No active cryptos in the last 24h — nothing to backfill`);
    return stats;
  }

  log.info(`[RecentBackfill] ${cryptos.length} active crypto(s) — fetching /market_chart?days=1 for full precision`);

  for (const crypto of cryptos) {
    try {
      const { data, error } = await fetchMarketChart(crypto.coingecko_id, RECENT_BACKFILL_DAYS);
      stats.apiCalls++;

      if (error || !data || !data.prices || data.prices.length === 0) {
        log.warn(`${crypto.symbol}: ${error || 'no data'}`);
        stats.apiErrors++;
        await delay(API_DELAY_MS);
        continue;
      }

      // Pre-load existing rows in the same window so we can UPDATE in place
      // when a /coins/markets row exists nearby (precision upgrade), or
      // INSERT when the slot is empty (gap fill).
      const minTs = data.prices[0][0];
      const maxTs = data.prices[data.prices.length - 1][0];
      const [existingRows] = await Database.execute(
        `SELECT id, UNIX_TIMESTAMP(timestamp) * 1000 AS ts
         FROM market_data
         WHERE crypto_id = ?
           AND timestamp >= FROM_UNIXTIME(? / 1000)
           AND timestamp <= FROM_UNIXTIME(? / 1000)`,
        [crypto.id, minTs, maxTs]
      );
      const existing = existingRows.map(r => ({ id: r.id, ts: Number(r.ts) }));

      let inserted = 0, upgraded = 0;
      for (let i = 0; i < data.prices.length; i++) {
        const [ts, price] = data.prices[i];
        const mcap = data.market_caps?.[i]?.[1];
        const vol = data.total_volumes?.[i]?.[1];

        if (price <= 0) continue;

        const supply = (mcap && price > 0) ? (mcap / price) : null;

        // Find the closest existing row within tolerance — UPDATE its price
        // in place to upgrade precision (keeps original timestamp from */5).
        let nearest = null;
        let nearestDist = RECENT_SLOT_TOLERANCE_SEC * 1000;

        for (const e of existing) {
          const dist = Math.abs(e.ts - ts);

          if (dist < nearestDist) { nearest = e; nearestDist = dist; }
        }

        if (nearest) {
          // UPDATE in place — only price (precision upgrade), keep supply/vol
          // from the original cron unless ours is non-null.
          await Database.execute(
            `UPDATE market_data
             SET price_usd = ?,
                 circulating_supply = COALESCE(?, circulating_supply),
                 volume_24h_usd = COALESCE(?, volume_24h_usd)
             WHERE id = ?`,
            [price, supply, vol || null, nearest.id]
          );
          upgraded++;
        } else {
          // No nearby row — INSERT a new market_data point at CoinGecko's timestamp
          const tsStr = new Date(ts).toISOString().slice(0, 19).replace('T', ' ');

          await Database.execute(
            `INSERT INTO market_data (crypto_id, price_usd, circulating_supply, volume_24h_usd, timestamp)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               price_usd = VALUES(price_usd),
               circulating_supply = COALESCE(VALUES(circulating_supply), circulating_supply),
               volume_24h_usd = COALESCE(VALUES(volume_24h_usd), volume_24h_usd)`,
            [crypto.id, price, supply, vol || 0, tsStr]
          );
          existing.push({ id: null, ts }); // Avoid re-inserting same point
          inserted++;
        }
      }

      stats.rowsInserted += inserted;
      stats.rowsUpgraded += upgraded;
      if (inserted > 0 || upgraded > 0) {
        stats.cryptosTouched++;
        if (inserted > 0) {
          log.info(`${crypto.symbol}: ${upgraded} upgraded, ${inserted} inserted`);
        }
      }

      await delay(API_DELAY_MS);
    } catch (e) {
      log.error(`[RecentBackfill] Error processing ${crypto.symbol}: ${e.message}`);
      stats.apiErrors++;
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════
// HOURLY BACKFILL (--backfill-hourly)
// ═══════════════════════════════════════════════════════════════

const HOURLY_BACKFILL_DAYS = 90; // CoinGecko returns hourly data for days<=90
// We check the LAST 30 DAYS density (not 90d) because some cryptos can have
// dense old history but sparse recent data (e.g. RAVEDAO had 24h/day for
// J-60 but only 1/day for J-30 since the daily-backfill cron, when finding
// no daily gap, never re-pulled the hourly granularity for the recent past).
// Threshold = 30d × 24h × 0.7 = 504 — leaves margin for transient API misses.
const HOURLY_RECENT_WINDOW_DAYS = 30;
const HOURLY_RECENT_THRESHOLD = 504;

/**
 * Backfill ohlc_hourly for cryptos whose recent 30-day hourly history is
 * sparse. CoinGecko returns hourly granularity when days<=90.
 *
 * Designed to run daily as a safety net — cryptos that are already dense
 * cost 0 credits, only newly-added or sparsely-tracked cryptos pay.
 */
async function runHourlyBackfill() {
  const stats = { apiCalls: 0, hourlyInserted: 0, apiErrors: 0 };

  const [cryptos] = await Database.execute(`
    SELECT c.id, c.symbol, c.coingecko_id, COALESCE(oh_count.n, 0) AS recent_hourly_rows
    FROM cryptocurrencies c
    INNER JOIN (
      SELECT DISTINCT crypto_id
      FROM market_data
      WHERE timestamp >= NOW() - INTERVAL 24 HOUR
    ) active ON active.crypto_id = c.id
    LEFT JOIN (
      SELECT crypto_id, COUNT(*) AS n
      FROM ohlc_hourly
      WHERE timestamp >= NOW() - INTERVAL ${HOURLY_RECENT_WINDOW_DAYS} DAY
      GROUP BY crypto_id
    ) oh_count ON oh_count.crypto_id = c.id
    WHERE c.coingecko_id IS NOT NULL
      AND COALESCE(oh_count.n, 0) < ${HOURLY_RECENT_THRESHOLD}
    ORDER BY recent_hourly_rows ASC
  `);

  if (cryptos.length === 0) {
    log.info(`[HourlyBackfill] All active cryptos have ≥${HOURLY_RECENT_THRESHOLD} rows in last ${HOURLY_RECENT_WINDOW_DAYS}d — nothing to backfill (0 credits spent)`);
    return stats;
  }

  log.info(`[HourlyBackfill] Found ${cryptos.length} crypto(s) below ${HOURLY_RECENT_THRESHOLD}/${HOURLY_RECENT_WINDOW_DAYS}d threshold to backfill`);

  for (const crypto of cryptos) {
    try {
      const { data, error: apiError } = await fetchMarketChart(crypto.coingecko_id, HOURLY_BACKFILL_DAYS);
      stats.apiCalls++;

      if (apiError) {
        log.warn(`${crypto.symbol}: API error - ${apiError}`);
        stats.apiErrors++;
        await delay(API_DELAY_MS);
        continue;
      }

      if (!data || !data.prices || data.prices.length === 0) {
        log.warn(`${crypto.symbol}: No data returned from API`);
        stats.apiErrors++;
        await delay(API_DELAY_MS);
        continue;
      }

      const hourlyData = aggregateToHourlyData(data);
      let inserted = 0;

      for (const [tsStr, hourData] of hourlyData) {
        if (hourData.price > 0) {
          await insertOhlcHourlyRecord(crypto.id, tsStr, hourData.price, hourData.marketCap || null, hourData.volume || null);
          inserted++;
        }
      }

      stats.hourlyInserted += inserted;
      log.info(`${crypto.symbol}: had ${crypto.recent_hourly_rows}/${HOURLY_RECENT_WINDOW_DAYS * 24} rows in last ${HOURLY_RECENT_WINDOW_DAYS}d, inserted ${inserted} hourly records`);

      await delay(API_DELAY_MS);
    } catch (error) {
      log.error(`[HourlyBackfill] Error processing ${crypto.symbol}: ${error.message}`);
      stats.apiErrors++;
    }
  }

  return stats;
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
 * Aggregate market_chart data into hourly data (last point per UTC hour).
 * Excludes the current hour (incomplete).
 */
function aggregateToHourlyData(data) {
  const now = new Date();
  const currentHourStr = formatHourString(now);

  const pricesByHour = new Map();
  const mcapsByHour = new Map();
  const volumesByHour = new Map();

  for (const [ts, val] of data.prices) {
    const hourStr = formatHourString(new Date(ts));
    if (hourStr === currentHourStr) continue;
    pricesByHour.set(hourStr, val);
  }

  if (data.market_caps) {
    for (const [ts, val] of data.market_caps) {
      const hourStr = formatHourString(new Date(ts));
      if (hourStr === currentHourStr) continue;
      mcapsByHour.set(hourStr, val);
    }
  }

  if (data.total_volumes) {
    for (const [ts, val] of data.total_volumes) {
      const hourStr = formatHourString(new Date(ts));
      if (hourStr === currentHourStr) continue;
      volumesByHour.set(hourStr, val);
    }
  }

  const hourlyData = new Map();
  for (const [hourStr, price] of pricesByHour) {
    hourlyData.set(hourStr, {
      price,
      marketCap: mcapsByHour.get(hourStr) || 0,
      volume: volumesByHour.get(hourStr) || 0,
    });
  }

  return hourlyData;
}

/**
 * Insert an OHLC record (daily only). open=high=low=close=price.
 */
async function insertOhlcRecord(cryptoId, dateStr, price, marketCap = null, volume = null) {
  const timestamp = `${dateStr} 00:00:00`;
  await Database.execute(`
    INSERT INTO ohlc (crypto_id, timestamp, open, high, low, close, market_cap, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    open = VALUES(open),
    high = VALUES(high),
    low = VALUES(low),
    close = VALUES(close),
    market_cap = VALUES(market_cap),
    volume = VALUES(volume)
  `, [cryptoId, timestamp, price, price, price, price, marketCap, volume]);
}

/**
 * Insert an hourly record into ohlc_hourly.
 */
async function insertOhlcHourlyRecord(cryptoId, timestampStr, price, marketCap = null, volume = null) {
  await Database.execute(`
    INSERT INTO ohlc_hourly (crypto_id, timestamp, close, market_cap, volume)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    close = VALUES(close),
    market_cap = VALUES(market_cap),
    volume = VALUES(volume)
  `, [cryptoId, timestampStr, price, marketCap, volume]);
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
 * Format a Date as YYYY-MM-DD HH:00:00 string (UTC, rounded to hour).
 */
function formatHourString(date) {
  const dateStr = formatDateString(date);
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${dateStr} ${hour}:00:00`;
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
