import Database from '../lib/database.js';
import log from '../lib/log.js';
import { isExcluded } from '../utils/exclusions.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility,
  annualizeVolatility,
  validateWeights,
  variance
} from '../utils/statistics.js';

const DEFAULT_WINDOW_DAYS = 90;
const MINIMUM_WINDOW_DAYS = 7; // Minimum days for statistical validity
const MAX_CONSTITUENTS = 40;
const CANDIDATE_POOL_SIZE = 80;
const MIN_VOLUME_24H = 2_000_000;

/**
 * Calculate and store portfolio volatility for the top 40 cryptos by market cap
 * Uses market cap weighted approach with full covariance matrix
 */
async function calculatePortfolioVolatility() {
  const startTime = Date.now();

  try {
    log.info('Starting portfolio volatility calculation...');

    // Get active index config ID (FK for portfolio_volatility)
    const indexConfigId = await getIndexConfigId();
    log.info(`Using index config ID: ${indexConfigId}`);

    // Get dates from crypto_log_returns not yet in portfolio_volatility
    const [dates] = await Database.execute(`
      SELECT DISTINCT clr.date
      FROM crypto_log_returns clr
      WHERE clr.date < CURDATE()
        AND clr.date NOT IN (
          SELECT date FROM portfolio_volatility WHERE index_config_id = ?
        )
      ORDER BY date DESC
    `, [indexConfigId]);

    log.info(`Found ${dates.length} dates to calculate`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const dateRow of dates) {
      try {
        const result = await calculatePortfolioVolatilityForDate(
          indexConfigId,
          dateRow.date
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
 * Get the active index configuration ID
 */
async function getIndexConfigId() {
  const [rows] = await Database.execute(
    'SELECT id FROM index_config WHERE is_active = TRUE LIMIT 1'
  );

  if (rows.length === 0) {
    throw new Error('No active index configuration found');
  }

  return rows[0].id;
}

/**
 * Get top cryptos by market cap for a specific date
 * Filters out excluded categories and requires minimum volume
 * @param {string} date - Date for which to get top cryptos
 * @returns {Promise<Array>} Top candidates sorted by market cap desc
 */
async function getTopCryptosForDate(date) {
  // Get candidates from ohlc for this date (market_cap + volume persisted by fetchOHLC)
  const [candidates] = await Database.execute(`
    SELECT
      o.crypto_id,
      c.symbol,
      c.name,
      cm.categories,
      o.volume,
      o.market_cap
    FROM ohlc o
    INNER JOIN cryptocurrencies c ON o.crypto_id = c.id
    LEFT JOIN cryptocurrency_metadata cm ON c.id = cm.crypto_id
    WHERE o.timestamp = CONCAT(?, ' 00:00:00')
      AND o.market_cap > 0
      AND o.volume >= ?
    ORDER BY o.market_cap DESC
  `, [date, MIN_VOLUME_24H]);

  // Filter excluded cryptos (stablecoins, wrapped, staked)
  const filtered = candidates.filter(c => !isExcluded(c));

  // Return top CANDIDATE_POOL_SIZE
  return filtered.slice(0, CANDIDATE_POOL_SIZE).map(c => ({
    crypto_id: c.crypto_id,
    symbol: c.symbol,
    name: c.name,
    marketCap: parseFloat(c.market_cap)
  }));
}

/**
 * Select top MAX_CONSTITUENTS candidates that have sufficient log return data
 * @param {Array} candidates - Candidates sorted by market cap desc
 * @param {string} date - Target date
 * @returns {Promise<Array>} Selected constituents with sufficient data
 */
async function selectConstituentsWithData(candidates, date) {
  if (candidates.length === 0) return [];

  const cryptoIds = candidates.map(c => c.crypto_id);

  // Batch query: count available log return days for each candidate
  const [dayCounts] = await Database.execute(`
    SELECT crypto_id, COUNT(*) as num_days
    FROM crypto_log_returns
    WHERE crypto_id IN (${cryptoIds.join(',')})
      AND date <= ?
    GROUP BY crypto_id
  `, [date]);

  const dayCountMap = new Map(dayCounts.map(d => [d.crypto_id, d.num_days]));

  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= MAX_CONSTITUENTS) break;

    const availableDays = dayCountMap.get(candidate.crypto_id) || 0;
    if (availableDays >= MINIMUM_WINDOW_DAYS) {
      selected.push(candidate);
    } else {
      log.debug(`${candidate.symbol}: skipped (only ${availableDays} days of data)`);
    }
  }

  return selected;
}

/**
 * Calculate portfolio volatility for a specific date
 * @param {number} indexConfigId - Index configuration ID (FK)
 * @param {string} date - Date for calculation
 * @returns {Promise<{calculated: boolean}>}
 */
async function calculatePortfolioVolatilityForDate(indexConfigId, date) {
  const calcStartTime = Date.now();

  // Get top cryptos for this date
  const candidates = await getTopCryptosForDate(date);

  if (candidates.length === 0) {
    log.debug(`No candidates found for ${date}`);
    return { calculated: false };
  }

  // Select constituents with sufficient data
  const constituents = await selectConstituentsWithData(candidates, date);

  if (constituents.length === 0) {
    log.debug(`No constituents with sufficient data for ${date}`);
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
