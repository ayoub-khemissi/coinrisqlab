import Database from '../lib/database.js';
import log from '../lib/log.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility,
  annualizeVolatility,
  validateWeights,
  variance
} from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7; // Minimum days for statistical validity
const INDEX_NAME = 'CoinRisqLab 80';

/**
 * Calculate and store portfolio volatility for the CoinRisqLab 80 Index
 * Uses market cap weighted approach with full covariance matrix
 */
async function calculatePortfolioVolatility() {
  const startTime = Date.now();

  try {
    log.info('Starting portfolio volatility calculation...');

    // Get active index configuration
    const indexConfig = await getIndexConfig();
    log.info(`Using index config ID: ${indexConfig.id}`);

    // Get dates where we have index history (one row per day, with latest timestamp)
    // Exclude current day - we only calculate for D-1 and earlier
    const [indexDates] = await Database.execute(`
      SELECT snapshot_date as date, MAX(timestamp) as timestamp
      FROM index_history
      WHERE index_config_id = ?
        AND snapshot_date < CURDATE()
      GROUP BY snapshot_date
      ORDER BY snapshot_date DESC
      LIMIT 100
    `, [indexConfig.id]);

    log.info(`Found ${indexDates.length} index calculation dates`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const dateRow of indexDates) {
      try {
        const result = await calculatePortfolioVolatilityForDate(
          indexConfig.id,
          dateRow.date,
          dateRow.timestamp
        );

        if (result.calculated) {
          totalCalculated++;
        } else {
          totalSkipped++;
        }
      } catch (error) {
        log.error(`Error calculating portfolio volatility for ${dateRow.date}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Portfolio volatility calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);

  } catch (error) {
    log.error(`Error in calculatePortfolioVolatility: ${error.message}`);
    throw error;
  }
}

/**
 * Get the active index configuration
 */
async function getIndexConfig() {
  const [rows] = await Database.execute(
    'SELECT * FROM index_config WHERE index_name = ? AND is_active = TRUE LIMIT 1',
    [INDEX_NAME]
  );

  if (rows.length === 0) {
    throw new Error('No active index configuration found');
  }

  return rows[0];
}

/**
 * Calculate portfolio volatility for a specific date
 * @param {number} indexConfigId - Index configuration ID
 * @param {string} date - Date for calculation
 * @param {string} timestamp - Full timestamp from index history
 * @returns {Promise<{calculated: boolean}>}
 */
async function calculatePortfolioVolatilityForDate(indexConfigId, date, timestamp) {
  const calcStartTime = Date.now();

  // We'll determine the actual window days after checking constituent data
  // For now, just check if any calculation exists for this date
  const [existing] = await Database.execute(
    'SELECT id FROM portfolio_volatility WHERE index_config_id = ? AND date = ?',
    [indexConfigId, date]
  );

  if (existing.length > 0) {
    return { calculated: false };
  }

  // Get constituents for this date (uses ohlc + market_data)
  const constituents = await getConstituentsForDate(indexConfigId, timestamp, date);

  if (constituents.length === 0) {
    log.debug(`No constituents found for ${date}`);
    return { calculated: false };
  }

  log.debug(`${date}: Processing ${constituents.length} constituents`);

  // Get log returns for all constituents over the window period
  const constituentReturns = await getConstituentReturns(constituents, date);

  // Check if any constituent has no returns at all
  const constituentsWithReturns = constituentReturns.filter(c => c.returns.length > 0);
  const constituentsWithoutReturns = constituentReturns.filter(c => c.returns.length === 0);

  if (constituentsWithoutReturns.length > 0) {
    log.warn(`${date}: ${constituentsWithoutReturns.length} constituents have no log returns: ${constituentsWithoutReturns.map(c => c.symbol).join(', ')}`);
  }

  if (constituentsWithReturns.length < 10) {
    log.debug(`${date}: Insufficient data - only ${constituentsWithReturns.length} constituents with any returns`);
    return { calculated: false };
  }

  // Target DEFAULT_WINDOW_DAYS (90j) - use max available if no one has 90 days yet
  const maxAvailableDays = Math.max(...constituentsWithReturns.map(c => c.returns.length));
  let effectiveWindowDays = Math.min(maxAvailableDays, DEFAULT_WINDOW_DAYS);

  // Minimum threshold for statistical validity
  if (effectiveWindowDays < MINIMUM_WINDOW_DAYS) {
    log.debug(`${date}: Window too small (${effectiveWindowDays} days) - need at least ${MINIMUM_WINDOW_DAYS}`);
    return { calculated: false };
  }

  // Filter constituents that have enough data for the target window
  const eligibleConstituents = constituentsWithReturns.filter(c => c.returns.length >= effectiveWindowDays);
  const excludedConstituents = constituentsWithReturns.filter(c => c.returns.length < effectiveWindowDays);

  if (excludedConstituents.length > 0) {
    const excludedInfo = excludedConstituents.map(c => `${c.symbol}(${c.returns.length}d)`).join(', ');
    log.warn(`${date}: ${excludedConstituents.length} constituents excluded (insufficient data): ${excludedInfo}`);
  }

  if (eligibleConstituents.length < 10) {
    log.debug(`${date}: Not enough eligible constituents (${eligibleConstituents.length}) for ${effectiveWindowDays} days window`);
    return { calculated: false };
  }

  log.debug(`${date}: Using ${effectiveWindowDays} days window (${eligibleConstituents.length} constituents, ${excludedConstituents.length} excluded)`);

  // Truncate all eligible constituents' returns to the same window size
  const normalizedConstituents = eligibleConstituents.map(c => ({
    ...c,
    returns: c.returns.slice(-effectiveWindowDays)
  }));

  // Calculate total market cap and weights
  const totalMarketCap = normalizedConstituents.reduce((sum, c) => sum + c.marketCap, 0);
  const weights = normalizedConstituents.map(c => c.marketCap / totalMarketCap);

  // Validate weights
  if (!validateWeights(weights)) {
    log.warn(`${date}: Invalid weights (sum = ${weights.reduce((a, b) => a + b, 0)})`);
  }

  // Build covariance matrix
  const assets = normalizedConstituents.map((c, i) => ({
    id: c.crypto_id,
    returns: c.returns
  }));

  const covMatrix = buildCovarianceMatrix(assets);

  // Calculate portfolio volatility
  const dailyVol = portfolioVolatility(weights, covMatrix);
  const annualizedVol = annualizeVolatility(dailyVol);

  const calculationDuration = Date.now() - calcStartTime;

  // Store portfolio volatility
  const [result] = await Database.execute(`
    INSERT INTO portfolio_volatility
    (index_config_id, date, window_days, daily_volatility, annualized_volatility,
     num_constituents, total_market_cap_usd, calculation_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    indexConfigId,
    date,
    effectiveWindowDays,
    dailyVol,
    annualizedVol,
    normalizedConstituents.length,
    totalMarketCap,
    calculationDuration
  ]);

  const portfolioVolatilityId = result.insertId;

  // Store constituent details
  await storeConstituentVolatilities(portfolioVolatilityId, normalizedConstituents, weights);

  log.info(`${date}: Portfolio volatility = ${(annualizedVol * 100).toFixed(2)}% (${normalizedConstituents.length} constituents, ${effectiveWindowDays} days window)`);

  return { calculated: true };
}

/**
 * Get index constituents for a specific date
 * Uses ohlc for close price and market_data for circulating_supply
 */
async function getConstituentsForDate(indexConfigId, timestamp, date) {
  // Get the list of constituents from index_constituents
  const [constituents] = await Database.execute(`
    SELECT
      ic.crypto_id,
      c.symbol,
      c.name
    FROM index_constituents ic
    INNER JOIN index_history ih ON ic.index_history_id = ih.id
    INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
    WHERE ih.index_config_id = ?
      AND ih.timestamp = ?
    ORDER BY ic.rank_position ASC
  `, [indexConfigId, timestamp]);

  if (constituents.length === 0) {
    return [];
  }

  const cryptoIds = constituents.map(c => c.crypto_id);

  // Get close price from ohlc and circulating_supply from market_data
  // For market_data, use the most recent record on or before the date
  const [ohlcData] = await Database.execute(`
    SELECT
      o.crypto_id,
      o.close as price_usd,
      md.circulating_supply,
      (o.close * md.circulating_supply) as market_cap_usd
    FROM (
      SELECT crypto_id, close,
             ROW_NUMBER() OVER (PARTITION BY crypto_id ORDER BY timestamp DESC) as rn
      FROM ohlc
      WHERE crypto_id IN (${cryptoIds.join(',')})
        AND DATE(timestamp) = ?
        AND close > 0
    ) o
    INNER JOIN (
      SELECT crypto_id, circulating_supply,
             ROW_NUMBER() OVER (PARTITION BY crypto_id ORDER BY timestamp DESC) as rn
      FROM market_data
      WHERE crypto_id IN (${cryptoIds.join(',')})
        AND price_date <= ?
        AND circulating_supply > 0
    ) md ON o.crypto_id = md.crypto_id AND md.rn = 1
    WHERE o.rn = 1
  `, [date, date]);

  // Build a map of crypto_id -> data
  const dataMap = new Map();
  for (const row of ohlcData) {
    dataMap.set(row.crypto_id, row);
  }

  // Log any missing constituents for debugging
  const missingConstituents = constituents.filter(c => !dataMap.has(c.crypto_id));
  if (missingConstituents.length > 0) {
    log.warn(`${date}: ${missingConstituents.length} constituents missing ohlc/market data: ${missingConstituents.map(c => c.symbol).join(', ')}`);
  }

  // Combine constituents with their data
  return constituents
    .filter(c => dataMap.has(c.crypto_id))
    .map(c => {
      const data = dataMap.get(c.crypto_id);
      return {
        crypto_id: c.crypto_id,
        symbol: c.symbol,
        name: c.name,
        marketCap: parseFloat(data.market_cap_usd)
      };
    });
}

/**
 * Get log returns for all constituents over the window period
 */
async function getConstituentReturns(constituents, endDate) {
  const results = [];

  for (const constituent of constituents) {
    // Get log returns for the last DEFAULT_WINDOW_DAYS before endDate
    const [returns] = await Database.execute(`
      SELECT log_return
      FROM crypto_log_returns
      WHERE crypto_id = ?
        AND date <= ?
      ORDER BY date DESC
      LIMIT ${DEFAULT_WINDOW_DAYS}
    `, [constituent.crypto_id, endDate]);

    // Reverse to get chronological order
    const returnsArray = returns.map(r => parseFloat(r.log_return)).reverse();

    results.push({
      crypto_id: constituent.crypto_id,
      symbol: constituent.symbol,
      marketCap: constituent.marketCap,
      returns: returnsArray
    });
  }

  return results;
}

/**
 * Store individual constituent volatilities
 */
async function storeConstituentVolatilities(portfolioVolatilityId, constituents, weights) {
  for (let i = 0; i < constituents.length; i++) {
    const constituent = constituents[i];
    const weight = weights[i];

    // Calculate individual volatility from returns (using n-1 for sample variance)
    const returns = constituent.returns;
    const dailyVol = Math.sqrt(variance(returns));
    const annualizedVol = annualizeVolatility(dailyVol);

    await Database.execute(`
      INSERT INTO portfolio_volatility_constituents
      (portfolio_volatility_id, crypto_id, weight, daily_volatility,
       annualized_volatility, market_cap_usd)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      portfolioVolatilityId,
      constituent.crypto_id,
      weight,
      dailyVol,
      annualizedVol,
      constituent.marketCap
    ]);
  }
}

// Run the command
calculatePortfolioVolatility()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
