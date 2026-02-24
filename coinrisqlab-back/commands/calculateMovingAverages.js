import Database from '../lib/database.js';
import log from '../lib/log.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7;

/**
 * Calculate and store moving averages (SMA) for all cryptocurrencies
 * Uses OHLC close prices over a rolling window (default: 90 days)
 */
async function calculateMovingAverages() {
  const startTime = Date.now();

  try {
    log.info('Starting moving averages calculation...');

    // Get all cryptocurrencies with sufficient OHLC data
    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN ohlc o ON c.id = o.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(DISTINCT DATE(o.timestamp)) >= ?
      ORDER BY c.symbol
    `, [MINIMUM_WINDOW_DAYS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient OHLC data (>= ${MINIMUM_WINDOW_DAYS} days)`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const result = await calculateMAForCrypto(crypto.id, crypto.symbol);
        totalCalculated += result.inserted;
        totalSkipped += result.skipped;
      } catch (error) {
        log.error(`Error calculating MA for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Moving averages calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateMovingAverages: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate moving averages for a single cryptocurrency
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number}>}
 */
async function calculateMAForCrypto(cryptoId, symbol) {
  // Get daily close prices (one per day, latest timestamp wins)
  // Exclude current day
  const [dailyCloses] = await Database.execute(`
    SELECT
      DATE(o.timestamp) as date,
      o.close
    FROM ohlc o
    INNER JOIN (
      SELECT crypto_id, DATE(timestamp) as d, MAX(timestamp) as max_ts
      FROM ohlc
      WHERE crypto_id = ?
        AND DATE(timestamp) < CURDATE()
        AND close > 0
      GROUP BY crypto_id, DATE(timestamp)
    ) latest ON o.crypto_id = latest.crypto_id
      AND o.timestamp = latest.max_ts
    WHERE o.crypto_id = ?
    ORDER BY date ASC
  `, [cryptoId, cryptoId]);

  if (dailyCloses.length < MINIMUM_WINDOW_DAYS) {
    log.debug(`${symbol}: Insufficient OHLC data (${dailyCloses.length} days, need at least ${MINIMUM_WINDOW_DAYS})`);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  // Calculate SMA for each possible window
  for (let i = MINIMUM_WINDOW_DAYS - 1; i < dailyCloses.length; i++) {
    const currentDate = dailyCloses[i].date;
    const actualWindowDays = Math.min(i + 1, DEFAULT_WINDOW_DAYS);

    // Check if already calculated
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_moving_averages WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, currentDate, actualWindowDays]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Get the window of close prices
    const windowCloses = dailyCloses
      .slice(i - actualWindowDays + 1, i + 1)
      .map(r => parseFloat(r.close));

    // Calculate simple moving average
    const sum = windowCloses.reduce((acc, val) => acc + val, 0);
    const sma = sum / windowCloses.length;

    await Database.execute(`
      INSERT INTO crypto_moving_averages
      (crypto_id, date, window_days, moving_average, num_observations)
      VALUES (?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, actualWindowDays, sma, windowCloses.length]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} MA points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

// Run the command
calculateMovingAverages()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
