import Database from '../lib/database.js';
import log from '../lib/log.js';
import { simpleReturn } from '../utils/statistics.js';

/**
 * Calculate and store simple (arithmetic) returns for all cryptocurrencies
 * Formula: R_s = (P_t / P_t-1) - 1
 * This command should be run daily after market data is fetched
 */
async function calculateSimpleReturns() {
  const startTime = Date.now();

  try {
    log.info('Starting simple returns calculation...');

    // Get all cryptocurrencies with at least 2 days of OHLC data
    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol, c.name
      FROM cryptocurrencies c
      INNER JOIN ohlc o ON c.id = o.crypto_id
      WHERE o.close > 0
      GROUP BY c.id, c.symbol, c.name
      HAVING COUNT(DISTINCT DATE(o.timestamp)) >= 2
      ORDER BY c.symbol
    `);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient data`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let totalInvalid = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const calculated = await calculateSimpleReturnsForCrypto(crypto.id, crypto.symbol);
        totalCalculated += calculated.inserted;
        totalSkipped += calculated.skipped;
        totalInvalid += calculated.invalid;
      } catch (error) {
        log.error(`Error calculating simple returns for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Simple returns calculation completed in ${duration}ms`);
    log.info(
      `Total calculated: ${totalCalculated}, Skipped (existing): ${totalSkipped}, Invalid (non-consecutive or identical prices): ${totalInvalid}, Errors: ${errors}`
    );
  } catch (error) {
    log.error(`Error in calculateSimpleReturns: ${error.message}`);
    throw error;
  }
}

/**
 * Check if two dates are consecutive (date2 = date1 + 1 day)
 * @param {Date|string} date1 - Previous date
 * @param {Date|string} date2 - Current date
 * @returns {boolean}
 */
function areConsecutiveDays(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  // Set both to midnight UTC to compare dates only
  d1.setUTCHours(0, 0, 0, 0);
  d2.setUTCHours(0, 0, 0, 0);

  const oneDayMs = 24 * 60 * 60 * 1000;
  const diffDays = (d2.getTime() - d1.getTime()) / oneDayMs;

  return diffDays === 1;
}

/**
 * Calculate simple returns for a single cryptocurrency
 * @param {number} cryptoId - Cryptocurrency ID
 * @param {string} symbol - Cryptocurrency symbol (for logging)
 * @returns {Promise<{inserted: number, skipped: number, invalid: number}>}
 */
async function calculateSimpleReturnsForCrypto(cryptoId, symbol) {
  // Get daily closing prices from OHLC table
  const [prices] = await Database.execute(
    `
    SELECT
      DATE(timestamp) as date,
      close as price_usd
    FROM ohlc
    WHERE crypto_id = ?
      AND close > 0
    ORDER BY timestamp ASC
  `,
    [cryptoId]
  );

  if (prices.length < 2) {
    log.debug(`${symbol}: Insufficient data (${prices.length} days)`);
    return { inserted: 0, skipped: 0, invalid: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;

  // Calculate simple returns for each consecutive pair of days
  for (let i = 1; i < prices.length; i++) {
    const currentPrice = parseFloat(prices[i].price_usd);
    const previousPrice = parseFloat(prices[i - 1].price_usd);
    const currentDate = prices[i].date;
    const previousDate = prices[i - 1].date;

    // Check if this simple return already exists
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_simple_returns WHERE crypto_id = ? AND date = ?',
      [cryptoId, currentDate]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Validation: Dates must be consecutive (previous date = current date - 1 day)
    if (!areConsecutiveDays(previousDate, currentDate)) {
      log.debug(
        `${symbol}: Invalid simple return for ${currentDate} - non-consecutive dates (previous: ${previousDate})`
      );
      invalid++;
      continue;
    }

    // Calculate simple return
    const simpleRet = simpleReturn(currentPrice, previousPrice);

    // Insert into database
    await Database.execute(
      `
      INSERT INTO crypto_simple_returns
      (crypto_id, date, simple_return, price_current, price_previous)
      VALUES (?, ?, ?, ?, ?)
    `,
      [cryptoId, currentDate, simpleRet, currentPrice, previousPrice]
    );

    inserted++;
  }

  if (inserted > 0 || invalid > 0) {
    log.debug(
      `${symbol}: Calculated ${inserted} simple returns, skipped ${skipped}, invalid ${invalid}`
    );
  }

  return { inserted, skipped, invalid };
}

// Run the command
calculateSimpleReturns()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
