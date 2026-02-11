import Database from '../lib/database.js';
import log from '../lib/log.js';
import { mean, standardDeviation } from '../utils/statistics.js';
import { calculateSkewness, calculateKurtosis } from '../utils/riskMetrics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7; // Minimum days for statistical validity (kurtosis needs 4, we use 7 for reliability)

/**
 * Calculate and store distribution statistics (skewness and kurtosis) for cryptocurrencies
 * Uses a rolling window approach (default: 90 days)
 * Supports retroactive calculation for missing dates
 */
async function calculateDistributionStats() {
  const startTime = Date.now();

  try {
    log.info('Starting distribution statistics calculation (skewness & kurtosis)...');

    // Ensure the table exists
    await ensureTableExists();

    // Get all cryptocurrencies with sufficient log returns data
    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN crypto_log_returns clr ON c.id = clr.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(*) >= ?
      ORDER BY c.symbol
    `, [MINIMUM_WINDOW_DAYS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data (>= ${MINIMUM_WINDOW_DAYS} log returns)`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateStatsForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating distribution stats for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Distribution stats calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateDistributionStats: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure the crypto_distribution_stats table exists
 */
async function ensureTableExists() {
  try {
    await Database.execute(`
      CREATE TABLE IF NOT EXISTS crypto_distribution_stats (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        crypto_id INT UNSIGNED NOT NULL,
        date DATE NOT NULL COMMENT 'Date for which distribution stats are calculated',
        window_days INT UNSIGNED NOT NULL DEFAULT 90 COMMENT 'Rolling window size in days',
        skewness DECIMAL(20, 12) NOT NULL COMMENT 'Fisher skewness of log returns',
        kurtosis DECIMAL(20, 12) NOT NULL COMMENT 'Excess kurtosis (Fisher) of log returns',
        mean_return DECIMAL(20, 12) NOT NULL COMMENT 'Mean of log returns over the window',
        std_dev DECIMAL(20, 12) NOT NULL COMMENT 'Standard deviation of log returns',
        num_observations INT UNSIGNED NOT NULL COMMENT 'Number of data points used in calculation',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_crypto_date_window (crypto_id, date, window_days),
        KEY idx_date (date),
        KEY idx_skewness (skewness),
        KEY idx_kurtosis (kurtosis)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    log.debug('Table crypto_distribution_stats verified/created');
  } catch (error) {
    // Table likely exists with foreign key - ignore
    if (!error.message.includes('already exists')) {
      log.debug(`Table check: ${error.message}`);
    }
  }
}

/**
 * Calculate distribution stats for a single cryptocurrency using rolling window
 * Supports retroactive calculation - will fill in any missing dates
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number}>}
 */
async function calculateStatsForCrypto(cryptoId, symbol) {
  // Get all log returns for this crypto, ordered by date
  // Exclude current day - we only calculate for D-1 and earlier
  const [logReturns] = await Database.execute(`
    SELECT
      date,
      log_return
    FROM crypto_log_returns
    WHERE crypto_id = ?
      AND date < CURDATE()
    ORDER BY date ASC
  `, [cryptoId]);

  if (logReturns.length < MINIMUM_WINDOW_DAYS) {
    log.debug(`${symbol}: Insufficient data (${logReturns.length} returns, need at least ${MINIMUM_WINDOW_DAYS})`);
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  // Calculate distribution stats for each possible window
  // Start from MINIMUM_WINDOW_DAYS (7) to have enough data for statistical validity
  // Window size grows from MINIMUM_WINDOW_DAYS up to DEFAULT_WINDOW_DAYS (90)
  for (let i = MINIMUM_WINDOW_DAYS - 1; i < logReturns.length; i++) {
    const windowEnd = logReturns[i];
    const currentDate = windowEnd.date;

    // Determine actual window size for this date
    const actualWindowDays = Math.min(i + 1, DEFAULT_WINDOW_DAYS);

    // Check if stats already exist for this date (retroactive support)
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_distribution_stats WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, currentDate, actualWindowDays]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Get the window of returns (last actualWindowDays)
    const windowReturns = logReturns
      .slice(i - actualWindowDays + 1, i + 1)
      .map(r => parseFloat(r.log_return));

    // Calculate statistics
    const meanReturn = mean(windowReturns);
    const stdDev = standardDeviation(windowReturns, meanReturn);
    const skewness = calculateSkewness(windowReturns);
    const kurtosis = calculateKurtosis(windowReturns);

    // Insert into database
    await Database.execute(`
      INSERT INTO crypto_distribution_stats
      (crypto_id, date, window_days, skewness, kurtosis, mean_return, std_dev, num_observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, actualWindowDays, skewness, kurtosis, meanReturn, stdDev, windowReturns.length]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} distribution stat points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

// Run the command
calculateDistributionStats()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
