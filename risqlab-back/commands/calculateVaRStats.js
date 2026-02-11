import Database from '../lib/database.js';
import log from '../lib/log.js';
import { mean, standardDeviation } from '../utils/statistics.js';
import { calculateVaR, calculateCVaR } from '../utils/riskMetrics.js';

const MINIMUM_DATA_POINTS = 7;
const MAX_WINDOW_DAYS = 365;

/**
 * Calculate and store VaR/CVaR statistics for cryptocurrencies
 * Uses up to 365 days of historical data
 * Stores one entry per crypto per date
 */
async function calculateVaRStats() {
  const startTime = Date.now();

  try {
    log.info('Starting VaR statistics calculation...');

    await ensureTableExists();

    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN crypto_log_returns clr ON c.id = clr.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(*) >= ?
      ORDER BY c.symbol
    `, [MINIMUM_DATA_POINTS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateVaRForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating VaR for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`VaR calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateVaRStats: ${error.message}`);
    throw error;
  }
}

async function ensureTableExists() {
  try {
    await Database.execute(`
      CREATE TABLE IF NOT EXISTS crypto_var (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        crypto_id INT UNSIGNED NOT NULL,
        date DATE NOT NULL,
        window_days INT UNSIGNED NOT NULL DEFAULT 90,
        var_95 DECIMAL(20, 12) NOT NULL,
        var_99 DECIMAL(20, 12) NOT NULL,
        cvar_95 DECIMAL(20, 12) NOT NULL,
        cvar_99 DECIMAL(20, 12) NOT NULL,
        mean_return DECIMAL(20, 12) NOT NULL,
        std_dev DECIMAL(20, 12) NOT NULL,
        min_return DECIMAL(20, 12) NOT NULL,
        max_return DECIMAL(20, 12) NOT NULL,
        num_observations INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_crypto_date_window (crypto_id, date, window_days),
        KEY idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      log.debug(`Table check: ${error.message}`);
    }
  }
}

async function calculateVaRForCrypto(cryptoId, symbol) {
  // Get all log returns for this crypto
  const [logReturns] = await Database.execute(`
    SELECT date, log_return
    FROM crypto_log_returns
    WHERE crypto_id = ?
      AND date < CURDATE()
    ORDER BY date ASC
  `, [cryptoId]);

  if (logReturns.length < MINIMUM_DATA_POINTS) {
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  // Calculate VaR for each date with enough data (backfill)
  for (let i = MINIMUM_DATA_POINTS - 1; i < logReturns.length; i++) {
    const currentDate = logReturns[i].date;

    // Window: up to MAX_WINDOW_DAYS returns ending at current date
    const windowStart = Math.max(0, i - MAX_WINDOW_DAYS + 1);
    const windowReturns = logReturns.slice(windowStart, i + 1).map(r => parseFloat(r.log_return));
    const windowDays = windowReturns.length;

    // Check if already exists
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_var WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, currentDate, windowDays]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const meanReturn = mean(windowReturns);
    const stdDev = standardDeviation(windowReturns, meanReturn);
    const var95 = calculateVaR(windowReturns, 95);
    const var99 = calculateVaR(windowReturns, 99);
    const cvar95 = calculateCVaR(windowReturns, 95);
    const cvar99 = calculateCVaR(windowReturns, 99);
    const minReturn = Math.min(...windowReturns);
    const maxReturn = Math.max(...windowReturns);

    await Database.execute(`
      INSERT INTO crypto_var
      (crypto_id, date, window_days, var_95, var_99, cvar_95, cvar_99, mean_return, std_dev, min_return, max_return, num_observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, windowDays, var95, var99, cvar95, cvar99, meanReturn, stdDev, minReturn, maxReturn, windowDays]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} VaR points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

calculateVaRStats()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
