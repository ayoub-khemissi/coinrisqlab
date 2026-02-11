import Database from '../lib/database.js';
import log from '../lib/log.js';
import { mean, standardDeviation, annualizeVolatility } from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7; // Minimum days for statistical validity

/**
 * Calculate and store individual cryptocurrency volatility
 * Uses a rolling window approach (default: 90 days)
 */
async function calculateCryptoVolatility() {
  const startTime = Date.now();

  try {
    log.info('Starting cryptocurrency volatility calculation...');

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
        const calculated = await calculateVolatilityForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating volatility for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Volatility calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateCryptoVolatility: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate volatility for a single cryptocurrency using rolling window
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number}>}
 */
async function calculateVolatilityForCrypto(cryptoId, symbol) {
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

  // Calculate volatility for each possible window
  // Start from MINIMUM_WINDOW_DAYS (7) to have enough data for statistical validity
  // Window size grows from MINIMUM_WINDOW_DAYS up to DEFAULT_WINDOW_DAYS (90)
  for (let i = MINIMUM_WINDOW_DAYS - 1; i < logReturns.length; i++) {
    const windowEnd = logReturns[i];
    const currentDate = windowEnd.date;

    // Determine actual window size for this date
    const actualWindowDays = Math.min(i + 1, DEFAULT_WINDOW_DAYS);

    // Check if volatility already exists for this date
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_volatility WHERE crypto_id = ? AND date = ? AND window_days = ?',
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
    const dailyVol = standardDeviation(windowReturns, meanReturn);
    const annualizedVol = annualizeVolatility(dailyVol);

    // Insert into database
    await Database.execute(`
      INSERT INTO crypto_volatility
      (crypto_id, date, window_days, daily_volatility, annualized_volatility, num_observations, mean_return)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [cryptoId, currentDate, actualWindowDays, dailyVol, annualizedVol, windowReturns.length, meanReturn]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} volatility points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

// Run the command
calculateCryptoVolatility()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
