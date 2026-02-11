import Database from '../lib/database.js';
import log from '../lib/log.js';
import { calculateBetaAlpha, calculateSML, calculateAnnualizedReturn } from '../utils/riskMetrics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7;

/**
 * Calculate and store SML (Security Market Line) statistics for cryptocurrencies
 * Uses a rolling window approach (default: 90 days)
 * Supports retroactive calculation for missing dates
 */
async function calculateSMLStats() {
  const startTime = Date.now();

  try {
    log.info('Starting SML statistics calculation...');

    await ensureTableExists();

    // Get all index log returns first
    const [indexReturns] = await Database.execute(`
      SELECT
        date,
        LN(index_level / LAG(index_level) OVER (ORDER BY date)) as log_return
      FROM (
        SELECT
          DATE(snapshot_date) as date,
          SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as index_level
        FROM index_history ih
        INNER JOIN index_config ic ON ih.index_config_id = ic.id
        WHERE ic.index_name = 'CoinRisqLab 80'
          AND DATE(snapshot_date) < CURDATE()
        GROUP BY DATE(snapshot_date)
      ) daily
      ORDER BY date ASC
    `);

    const indexReturnsByDate = new Map();
    for (const r of indexReturns) {
      if (r.log_return !== null) {
        indexReturnsByDate.set(r.date.toISOString().split('T')[0], parseFloat(r.log_return));
      }
    }

    log.info(`Loaded ${indexReturnsByDate.size} index return days`);

    if (indexReturnsByDate.size < MINIMUM_WINDOW_DAYS) {
      log.warn('Insufficient index data for SML calculation');
      return;
    }

    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN crypto_log_returns clr ON c.id = clr.crypto_id
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(*) >= ?
      ORDER BY c.symbol
    `, [MINIMUM_WINDOW_DAYS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateSMLForCrypto(crypto.id, crypto.symbol, indexReturnsByDate);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
      } catch (error) {
        log.error(`Error calculating SML for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`SML calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculateSMLStats: ${error.message}`);
    throw error;
  }
}

async function ensureTableExists() {
  try {
    await Database.execute(`
      CREATE TABLE IF NOT EXISTS crypto_sml (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        crypto_id INT UNSIGNED NOT NULL,
        date DATE NOT NULL,
        window_days INT UNSIGNED NOT NULL DEFAULT 90,
        beta DECIMAL(20, 12) NOT NULL,
        expected_return DECIMAL(20, 12) NOT NULL,
        actual_return DECIMAL(20, 12) NOT NULL,
        alpha DECIMAL(20, 12) NOT NULL,
        is_overvalued BOOLEAN NOT NULL,
        market_return DECIMAL(20, 12) NOT NULL,
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

async function calculateSMLForCrypto(cryptoId, symbol, indexReturnsByDate) {
  const [logReturns] = await Database.execute(`
    SELECT date, log_return
    FROM crypto_log_returns
    WHERE crypto_id = ?
      AND date < CURDATE()
    ORDER BY date ASC
  `, [cryptoId]);

  if (logReturns.length < MINIMUM_WINDOW_DAYS) {
    return { inserted: 0, skipped: 0 };
  }

  // Build crypto returns by date
  const cryptoReturnsByDate = new Map();
  for (const r of logReturns) {
    const dateStr = r.date.toISOString().split('T')[0];
    cryptoReturnsByDate.set(dateStr, {
      date: r.date,
      return: parseFloat(r.log_return)
    });
  }

  // Get all dates where we have both crypto and index returns
  const allDates = [...cryptoReturnsByDate.keys()]
    .filter(date => indexReturnsByDate.has(date))
    .sort();

  if (allDates.length < MINIMUM_WINDOW_DAYS) {
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = MINIMUM_WINDOW_DAYS - 1; i < allDates.length; i++) {
    const currentDateStr = allDates[i];
    const currentDate = cryptoReturnsByDate.get(currentDateStr).date;
    const actualWindowDays = Math.min(i + 1, DEFAULT_WINDOW_DAYS);

    const [existing] = await Database.execute(
      'SELECT id FROM crypto_sml WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, currentDate, actualWindowDays]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Get window of aligned returns
    const windowDates = allDates.slice(i - actualWindowDays + 1, i + 1);
    const cryptoReturns = windowDates.map(d => cryptoReturnsByDate.get(d).return);
    const marketReturns = windowDates.map(d => indexReturnsByDate.get(d));

    // Calculate beta
    const { beta } = calculateBetaAlpha(cryptoReturns, marketReturns);

    // Calculate annualized returns
    const cryptoAnnualReturn = calculateAnnualizedReturn(cryptoReturns);
    const marketAnnualReturn = calculateAnnualizedReturn(marketReturns);

    // Calculate SML (Rf = 0)
    const smlData = calculateSML(beta, cryptoAnnualReturn, marketAnnualReturn, 0);

    await Database.execute(`
      INSERT INTO crypto_sml
      (crypto_id, date, window_days, beta, expected_return, actual_return, alpha, is_overvalued, market_return, num_observations)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cryptoId,
      currentDate,
      actualWindowDays,
      beta,
      smlData.cryptoExpectedReturn / 100, // Store as decimal
      smlData.cryptoActualReturn / 100,
      smlData.alpha / 100,
      smlData.isOvervalued,
      marketAnnualReturn,
      windowDates.length
    ]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} SML points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

calculateSMLStats()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
