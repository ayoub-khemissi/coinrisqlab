import Database from '../lib/database.js';
import log from '../lib/log.js';
import {
  getPortfolioHoldings,
  getAlignedReturns,
  getLatestBetaMap,
  getIndexLogReturnsMap,
  computeAnalyticsBundle,
} from '../utils/userPortfolioAnalytics.js';

/**
 * Daily historization of user portfolio analytics.
 *
 * For each active user portfolio, this script:
 *   1. Re-fetches the current composition (same as snapshotPortfolios.js — "composition courante")
 *   2. Computes the full analytics bundle via the SHARED pure function
 *      utils/userPortfolioAnalytics.js → computeAnalyticsBundle
 *   3. Upserts the result into user_portfolio_analytics (+ constituents breakdown)
 *
 * Because the computation function is shared with the /analytics-bundle API route,
 * what is stored here is GUARANTEED to match what is displayed to the user.
 *
 * This enables the business team to verify every value displayed in
 * /dashboard/portfolios/[id]/analytics against a persisted row in the DB, and
 * to cross-check against the CSV export produced by
 * commands/exportUserPortfolioAnalyticsValidation.js.
 *
 * Scheduling: run daily at 02:45 (after snapshotPortfolios.js @ 02:30).
 *
 * Idempotency: the unique key (portfolio_id, date, window_days) combined with
 * ON DUPLICATE KEY UPDATE makes it safe to re-run multiple times per day.
 *
 * Design notes:
 *   - `window_days` is always 90 (the target window) to keep the unique key stable;
 *     the actual number of observations used is stored in `data_points`.
 *   - `date` is always CURDATE() — there is no retroactive backfill because the
 *     portfolio composition at past dates is not reconstructible without replaying
 *     user_transactions (a separate workstream if ever needed).
 */

const TARGET_WINDOW_DAYS = 90;

/**
 * Convert non-finite numbers (NaN, ±Infinity) and undefined to null before
 * sending to the DB. MySQL rejects NaN/Infinity on DECIMAL columns.
 */
function safeNum(value) {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

async function calculateUserPortfolioAnalytics() {
  const startTime = Date.now();

  try {
    log.info('Starting user portfolio analytics calculation...');

    // Index log returns are shared across all portfolios — fetch once.
    const indexReturnMap = await getIndexLogReturnsMap();
    log.debug(`Loaded ${Object.keys(indexReturnMap).length} index return dates`);

    // Fetch all active user portfolios
    const [portfolios] = await Database.execute(`
      SELECT up.id AS portfolio_id, up.user_id
      FROM user_portfolios up
      INNER JOIN users u ON up.user_id = u.id
      WHERE u.is_active = 1
    `);

    if (portfolios.length === 0) {
      log.info('No active portfolios to process.');
      return;
    }

    log.info(`Found ${portfolios.length} portfolios to process.`);

    let processed = 0;
    let skippedEmpty = 0;
    let skippedInsufficient = 0;
    let errors = 0;

    for (const portfolio of portfolios) {
      try {
        const result = await processPortfolio(portfolio.portfolio_id, indexReturnMap);
        if (result === 'processed') processed++;
        else if (result === 'empty') skippedEmpty++;
        else if (result === 'insufficient') skippedInsufficient++;
      } catch (error) {
        log.error(`Error processing portfolio ${portfolio.portfolio_id}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(
      `User portfolio analytics complete: ${processed} processed, ` +
        `${skippedEmpty} empty, ${skippedInsufficient} insufficient data, ` +
        `${errors} errors, ${duration}ms`
    );
  } catch (error) {
    log.error(`calculateUserPortfolioAnalytics error: ${error.message}`);
    throw error;
  }
}

/**
 * Process a single portfolio: compute + persist.
 * @returns {'processed'|'empty'|'insufficient'}
 */
async function processPortfolio(portfolioId, indexReturnMap) {
  const calcStart = Date.now();

  // 1. Fetch holdings (composition courante)
  const holdings = await getPortfolioHoldings(portfolioId);
  if (holdings.length === 0) {
    log.debug(`Portfolio ${portfolioId}: no holdings, skipped`);
    return 'empty';
  }

  const cryptoIds = holdings.map((h) => h.crypto_id);

  // 2. Fetch aligned returns (log + simple) + beta map in parallel
  const [{ returnsByCryptoLog, returnsByCryptoSimple, alignedDates }, betaMap] = await Promise.all([
    getAlignedReturns(cryptoIds, '90d'),
    getLatestBetaMap(cryptoIds),
  ]);

  // 3. Compute analytics via the shared pure function
  //    computeProMetrics=true → always compute everything for validation
  const { raw } = computeAnalyticsBundle({
    holdings,
    returnsByCryptoLog,
    returnsByCryptoSimple,
    alignedDates,
    betaMap,
    indexReturnMap,
    computeProMetrics: true,
  });

  const calculationDurationMs = Date.now() - calcStart;

  // 4. Persist (even if hasEnoughData === false — we still track composition + totalValue)
  await persistAnalytics({
    portfolioId,
    raw,
    calculationDurationMs,
  });

  if (!raw.hasEnoughData) {
    log.debug(
      `Portfolio ${portfolioId}: persisted (insufficient data, only ${raw.dataPoints} points)`
    );
    return 'insufficient';
  }

  log.debug(
    `Portfolio ${portfolioId}: persisted — vol=${raw.annualizedVolatility !== null ? (raw.annualizedVolatility * 100).toFixed(2) + '%' : 'n/a'}, ` +
      `${raw.numHoldings} holdings, ${raw.dataPoints} points, ${calculationDurationMs}ms`
  );
  return 'processed';
}

/**
 * Upsert the analytics row + its constituents breakdown.
 * Uses LAST_INSERT_ID(id) on duplicate to always get a valid id back.
 */
async function persistAnalytics({ portfolioId, raw, calculationDurationMs }) {
  const correlationJson = raw.correlationMatrix
    ? JSON.stringify({ symbols: raw.correlationSymbols, matrix: raw.correlationMatrix })
    : null;

  // 1. Upsert user_portfolio_analytics
  const [upsertResult] = await Database.execute(
    `INSERT INTO user_portfolio_analytics (
      portfolio_id, date, window_days,
      total_value_usd, num_holdings, data_points,
      daily_volatility, annualized_volatility, weighted_avg_volatility, diversification_benefit,
      mean_daily_return, daily_std, min_return, max_return, annualized_return,
      var_95, var_99, cvar_95, cvar_99,
      skewness, kurtosis,
      sharpe_ratio,
      portfolio_beta_weighted, beta_regression, alpha_regression, r_squared,
      correlation_with_index, beta_alpha_observations,
      correlation_matrix,
      calculation_duration_ms
    ) VALUES (?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      id = LAST_INSERT_ID(id),
      total_value_usd = VALUES(total_value_usd),
      num_holdings = VALUES(num_holdings),
      data_points = VALUES(data_points),
      daily_volatility = VALUES(daily_volatility),
      annualized_volatility = VALUES(annualized_volatility),
      weighted_avg_volatility = VALUES(weighted_avg_volatility),
      diversification_benefit = VALUES(diversification_benefit),
      mean_daily_return = VALUES(mean_daily_return),
      daily_std = VALUES(daily_std),
      min_return = VALUES(min_return),
      max_return = VALUES(max_return),
      annualized_return = VALUES(annualized_return),
      var_95 = VALUES(var_95),
      var_99 = VALUES(var_99),
      cvar_95 = VALUES(cvar_95),
      cvar_99 = VALUES(cvar_99),
      skewness = VALUES(skewness),
      kurtosis = VALUES(kurtosis),
      sharpe_ratio = VALUES(sharpe_ratio),
      portfolio_beta_weighted = VALUES(portfolio_beta_weighted),
      beta_regression = VALUES(beta_regression),
      alpha_regression = VALUES(alpha_regression),
      r_squared = VALUES(r_squared),
      correlation_with_index = VALUES(correlation_with_index),
      beta_alpha_observations = VALUES(beta_alpha_observations),
      correlation_matrix = VALUES(correlation_matrix),
      calculation_duration_ms = VALUES(calculation_duration_ms)`,
    [
      portfolioId,
      TARGET_WINDOW_DAYS,
      safeNum(raw.totalValue) ?? 0,
      raw.numHoldings,
      raw.dataPoints,
      safeNum(raw.dailyVolatility),
      safeNum(raw.annualizedVolatility),
      safeNum(raw.weightedAvgVolatility),
      safeNum(raw.diversificationBenefit),
      safeNum(raw.meanDailyReturn),
      safeNum(raw.dailyStd),
      safeNum(raw.minReturn),
      safeNum(raw.maxReturn),
      safeNum(raw.annualizedReturn),
      safeNum(raw.var95),
      safeNum(raw.var99),
      safeNum(raw.cvar95),
      safeNum(raw.cvar99),
      safeNum(raw.skewness),
      safeNum(raw.kurtosis),
      safeNum(raw.sharpeRatio),
      safeNum(raw.portfolioBetaWeighted),
      safeNum(raw.betaRegression),
      safeNum(raw.alphaRegression),
      safeNum(raw.rSquared),
      safeNum(raw.correlationWithIndex),
      raw.betaAlphaObservations,
      correlationJson,
      calculationDurationMs,
    ]
  );

  const analyticsId = upsertResult.insertId;

  // 2. Refresh constituents: delete old rows for this analytics_id, insert fresh.
  //    Composition may differ between runs on the same date (if the user edited
  //    holdings mid-day), so a full refresh is safer than per-row upsert.
  await Database.execute(
    'DELETE FROM user_portfolio_analytics_constituents WHERE user_portfolio_analytics_id = ?',
    [analyticsId]
  );

  if (raw.constituents.length === 0) return;

  const placeholders = raw.constituents.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = [];
  for (const c of raw.constituents) {
    values.push(
      analyticsId,
      c.crypto_id,
      safeNum(c.weight) ?? 0,
      safeNum(c.quantity) ?? 0,
      safeNum(c.avg_buy_price),
      safeNum(c.current_price),
      safeNum(c.current_value),
      safeNum(c.daily_volatility),
      safeNum(c.annualized_volatility),
      safeNum(c.beta)
    );
  }

  await Database.execute(
    `INSERT INTO user_portfolio_analytics_constituents (
      user_portfolio_analytics_id, crypto_id, weight, quantity, avg_buy_price,
      current_price, current_value_usd, daily_volatility, annualized_volatility, beta
    ) VALUES ${placeholders}`,
    values
  );
}

// Run the command
calculateUserPortfolioAnalytics()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
