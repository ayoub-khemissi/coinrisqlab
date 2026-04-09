/**
 * Shared user portfolio analytics module.
 *
 * This module is the single source of truth for the calculations shown on
 * /dashboard/portfolios/[id]/analytics. It is used by:
 *   - routes/userAnalytics.js (real-time endpoint /user/portfolios/:id/analytics-bundle)
 *   - commands/calculateUserPortfolioAnalytics.js (nightly batch historization)
 *   - commands/exportUserPortfolioAnalyticsValidation.js (CSV export for business validation)
 *
 * Keeping this logic in one place guarantees that:
 *   - What the user sees on the frontend                  (route)
 *   - What is stored in user_portfolio_analytics          (batch)
 *   - What is shown in the validation export              (CSV)
 * all come from the exact same formulas.
 *
 * IMPORTANT: Do not modify the formulas here without business sign-off.
 */

import Database from '../lib/database.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility as calcPortfolioVol,
  annualizeVolatility,
  mean,
  standardDeviation,
  covariance as calcCovariance,
} from './statistics.js';
import {
  calculateVaR,
  calculateCVaR,
  calculateSharpeRatio,
  calculateStressTest,
  calculateBetaAlpha,
  calculateSkewness,
  calculateKurtosis,
} from './riskMetrics.js';
import { getDateFilter } from './queryHelpers.js';

// ─── DB FETCH HELPERS ──────────────────────────────────────────────────────

/**
 * Verify that a portfolio belongs to the given user.
 */
export async function verifyPortfolioOwnership(portfolioId, userId) {
  const [rows] = await Database.execute(
    'SELECT id FROM user_portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return rows.length > 0;
}

/**
 * Get holdings with current prices, computed weights and the shared totalValue.
 * Each holding object carries:
 *   crypto_id, symbol, crypto_name, image_url,
 *   quantity, avg_buy_price, current_price, percent_change_24h,
 *   current_value, weight, totalValue
 */
export async function getPortfolioHoldings(portfolioId) {
  const [holdings] = await Database.execute(
    `SELECT
      h.crypto_id,
      c.symbol,
      c.name AS crypto_name,
      c.image_url,
      h.quantity,
      h.avg_buy_price,
      md.price_usd AS current_price,
      md.percent_change_24h,
      (h.quantity * md.price_usd) AS current_value
    FROM user_portfolio_holdings h
    JOIN cryptocurrencies c ON c.id = h.crypto_id
    LEFT JOIN (
      SELECT crypto_id, MAX(timestamp) AS max_ts
      FROM market_data
      WHERE crypto_id IN (SELECT crypto_id FROM user_portfolio_holdings WHERE portfolio_id = ?)
      GROUP BY crypto_id
    ) latest ON latest.crypto_id = h.crypto_id
    LEFT JOIN market_data md ON md.crypto_id = latest.crypto_id AND md.timestamp = latest.max_ts
    WHERE h.portfolio_id = ?`,
    [portfolioId, portfolioId]
  );

  const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);

  return holdings.map(h => ({
    ...h,
    weight: totalValue > 0 ? h.current_value / totalValue : 0,
    totalValue,
  }));
}

/**
 * Get aligned log returns for multiple cryptos over a period.
 * Only dates where ALL cryptos have data are kept (inner-join behaviour).
 */
export async function getAlignedReturns(cryptoIds, period = '90d') {
  if (!cryptoIds || cryptoIds.length === 0) {
    return { alignedDates: [], returnsByCrypto: {} };
  }

  const dateFilter = getDateFilter(period);

  const [allReturns] = await Database.execute(
    `SELECT crypto_id, date, log_return
     FROM crypto_log_returns
     WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
       ${dateFilter}
     ORDER BY date ASC`,
    cryptoIds
  );

  const byDate = {};
  for (const row of allReturns) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    if (!byDate[dateStr]) byDate[dateStr] = {};
    byDate[dateStr][row.crypto_id] = parseFloat(row.log_return);
  }

  const alignedDates = Object.keys(byDate)
    .filter(date => cryptoIds.every(id => byDate[date][id] !== undefined))
    .sort();

  const returnsByCrypto = {};
  for (const id of cryptoIds) {
    returnsByCrypto[id] = alignedDates.map(date => byDate[date][id]);
  }

  return { alignedDates, returnsByCrypto };
}

/**
 * Get the latest beta for each crypto from crypto_beta.
 * Returns { [crypto_id]: beta }.
 */
export async function getLatestBetaMap(cryptoIds) {
  if (!cryptoIds || cryptoIds.length === 0) return {};

  const [betaRows] = await Database.execute(
    `SELECT cb.crypto_id, cb.beta FROM crypto_beta cb
     INNER JOIN (
       SELECT crypto_id, MAX(date) AS max_date FROM crypto_beta
       WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
       GROUP BY crypto_id
     ) latest ON cb.crypto_id = latest.crypto_id AND cb.date = latest.max_date`,
    cryptoIds
  );

  const map = {};
  for (const row of betaRows) map[row.crypto_id] = parseFloat(row.beta);
  return map;
}

/**
 * Get daily log returns of the CoinRisqLab 80 index, derived on-the-fly from
 * index_history. Returns { [YYYY-MM-DD]: log_return }.
 *
 * The query is a verbatim copy of the one in /analytics-bundle:
 * same FILTER ('CoinRisqLab 80'), same grouping, same LAG window function.
 */
export async function getIndexLogReturnsMap() {
  const [indexReturns] = await Database.execute(`
    SELECT date, log_return FROM (
      SELECT date, LN(index_level / LAG(index_level) OVER (ORDER BY date)) as log_return
      FROM (
        SELECT DATE(snapshot_date) as date,
          SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as index_level
        FROM index_history ih INNER JOIN index_config ic ON ih.index_config_id = ic.id
        WHERE ic.index_name = 'CoinRisqLab 80' AND DATE(snapshot_date) < CURDATE()
        GROUP BY DATE(snapshot_date)
      ) daily
    ) with_returns WHERE log_return IS NOT NULL ORDER BY date ASC
  `);

  const map = {};
  for (const row of indexReturns) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    map[dateStr] = parseFloat(row.log_return);
  }
  return map;
}

// ─── PURE COMPUTATION ──────────────────────────────────────────────────────

/**
 * Compute the analytics bundle from pre-fetched inputs. PURE function (no DB).
 *
 * Returns two sibling objects:
 *   - `bundle`: the exact shape consumed by the frontend via /analytics-bundle
 *               (volatility, riskMetrics, correlation, stressTest). The route
 *               adds `performance` on top and spreads this into the response.
 *   - `raw`   : unrounded values used by the batch historization command and
 *               the CSV validation export. These never reach the frontend.
 *
 * Splitting the two ensures that the API contract stays byte-identical while
 * we get full precision for DB storage and business reproducibility.
 *
 * @param {Object} params
 * @param {Array} params.holdings                - From getPortfolioHoldings()
 * @param {Object} params.returnsByCrypto        - From getAlignedReturns()
 * @param {string[]} params.alignedDates         - From getAlignedReturns()
 * @param {Object} params.betaMap                - From getLatestBetaMap()
 * @param {Object} params.indexReturnMap         - From getIndexLogReturnsMap()
 * @param {boolean} [params.computeProMetrics]   - If false, skip VaR/CVaR/Sharpe/Beta/Alpha/
 *                                                 Skewness/Kurtosis/Correlation/StressTest.
 *                                                 The route uses this to gate Pro-only data;
 *                                                 the batch command should pass true.
 * @returns {{ bundle: Object, raw: Object }}
 */
export function computeAnalyticsBundle({
  holdings,
  returnsByCrypto,
  alignedDates,
  betaMap,
  indexReturnMap,
  computeProMetrics = true,
}) {
  const bundle = {
    volatility: null,
    riskMetrics: null,
    correlation: null,
    stressTest: null,
  };

  const raw = {
    numHoldings: holdings ? holdings.length : 0,
    totalValue: 0,
    dataPoints: alignedDates ? alignedDates.length : 0,
    hasEnoughData: false,
    portfolioBetaWeighted: 0,
    // Volatility
    dailyVolatility: null,
    annualizedVolatility: null,
    weightedAvgVolatility: null,
    diversificationBenefit: null,
    // Return stats (raw portfolio returns)
    portfolioReturns: null,
    meanDailyReturn: null,
    dailyStd: null,
    minReturn: null,
    maxReturn: null,
    annualizedReturn: null,
    // VaR / CVaR
    var95: null,
    var99: null,
    cvar95: null,
    cvar99: null,
    // Distribution
    skewness: null,
    kurtosis: null,
    // Sharpe
    sharpeRatio: null,
    // Beta / Alpha regression vs index
    betaRegression: null,
    alphaRegression: null,
    rSquared: null,
    correlationWithIndex: null,
    betaAlphaObservations: null,
    // Correlation matrix
    correlationSymbols: null,
    correlationMatrix: null,
    // Per-constituent breakdown
    constituents: [],
  };

  if (!holdings || holdings.length === 0) {
    return { bundle, raw };
  }

  const cryptoIds = holdings.map(h => h.crypto_id);
  const weights = holdings.map(h => h.weight);
  const totalValue = holdings[0].totalValue;
  raw.totalValue = totalValue;

  // ── Weighted portfolio beta (always computed, cheap) ────────────────────
  let portfolioBeta = 0;
  for (let i = 0; i < holdings.length; i++) {
    portfolioBeta += weights[i] * (betaMap[cryptoIds[i]] || 1);
  }
  raw.portfolioBetaWeighted = portfolioBeta;

  const hasEnoughData = alignedDates.length >= 10;
  raw.hasEnoughData = hasEnoughData;

  if (hasEnoughData) {
    // ── Volatility ────────────────────────────────────────────────────────
    const assets = cryptoIds.map(id => ({ id, returns: returnsByCrypto[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const dailyVol = calcPortfolioVol(weights, covMatrix);
    const annualVol = annualizeVolatility(dailyVol);

    const constituentsPublic = [];
    const constituentsRaw = [];
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      const returns = returnsByCrypto[h.crypto_id] || [];
      const indivDailyVol = standardDeviation(returns);
      const indivAnnualVol = annualizeVolatility(indivDailyVol);
      constituentsPublic.push({
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        image_url: h.image_url,
        weight: Number(h.weight.toFixed(4)),
        daily_volatility: Number(indivDailyVol.toFixed(6)),
        annualized_volatility: Number((indivAnnualVol * 100).toFixed(2)),
        current_value: Number((h.current_value || 0).toFixed(2)),
      });
      constituentsRaw.push({
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        weight: h.weight,
        quantity: parseFloat(h.quantity),
        avg_buy_price: h.avg_buy_price != null ? parseFloat(h.avg_buy_price) : null,
        current_price: h.current_price != null ? parseFloat(h.current_price) : null,
        current_value: h.current_value,
        daily_volatility: indivDailyVol,
        annualized_volatility: indivAnnualVol,
        beta: betaMap[h.crypto_id] != null ? betaMap[h.crypto_id] : null,
      });
    }

    const weightedAvgVol = weights.reduce(
      (sum, w, i) => sum + w * standardDeviation(assets[i].returns),
      0
    );
    const diversificationBenefit = weightedAvgVol > 0
      ? Number((((weightedAvgVol - dailyVol) / weightedAvgVol) * 100).toFixed(2))
      : 0;

    bundle.volatility = {
      dailyVolatility: Number(dailyVol.toFixed(6)),
      annualizedVolatility: Number((annualVol * 100).toFixed(2)),
      beta: Number(portfolioBeta.toFixed(4)),
      holdingCount: holdings.length,
      dataPoints: alignedDates.length,
      diversificationBenefit,
      constituents: constituentsPublic,
    };

    raw.dailyVolatility = dailyVol;
    raw.annualizedVolatility = annualVol;
    raw.weightedAvgVolatility = weightedAvgVol;
    raw.diversificationBenefit = diversificationBenefit;
    raw.constituents = constituentsRaw;

    if (computeProMetrics) {
      // ── Risk Metrics ────────────────────────────────────────────────────
      const portfolioReturns = alignedDates.map((_, dayIdx) => {
        let dayReturn = 0;
        for (let i = 0; i < cryptoIds.length; i++) {
          dayReturn += weights[i] * returnsByCrypto[cryptoIds[i]][dayIdx];
        }
        return dayReturn;
      });

      const var95 = calculateVaR(portfolioReturns, 95);
      const var99 = calculateVaR(portfolioReturns, 99);
      const cvar95 = calculateCVaR(portfolioReturns, 95);
      const cvar99 = calculateCVaR(portfolioReturns, 99);
      const sharpe = calculateSharpeRatio(portfolioReturns);
      const skewness = calculateSkewness(portfolioReturns);
      const kurtosis = calculateKurtosis(portfolioReturns);
      const meanReturn = mean(portfolioReturns);
      const dailyStd = standardDeviation(portfolioReturns);
      const minReturn = Math.min(...portfolioReturns);
      const maxReturn = Math.max(...portfolioReturns);

      // Align portfolio returns with CoinRisqLab 80 returns
      const alignedP = [];
      const alignedM = [];
      for (let i = 0; i < alignedDates.length; i++) {
        if (indexReturnMap[alignedDates[i]] !== undefined) {
          alignedP.push(portfolioReturns[i]);
          alignedM.push(indexReturnMap[alignedDates[i]]);
        }
      }
      const betaAlpha = calculateBetaAlpha(alignedP, alignedM);

      bundle.riskMetrics = {
        var95: Number((var95 * 100).toFixed(4)),
        var99: Number((var99 * 100).toFixed(4)),
        cvar95: Number((cvar95 * 100).toFixed(4)),
        cvar99: Number((cvar99 * 100).toFixed(4)),
        sharpe: Number(sharpe.toFixed(4)),
        beta: betaAlpha.beta,
        alpha: Number((betaAlpha.alpha * 36500).toFixed(4)),
        skewness,
        kurtosis,
        returnStats: {
          meanDaily: Number((meanReturn * 100).toFixed(4)),
          annualized: Number((meanReturn * 36500).toFixed(2)),
          dailyStd: Number((dailyStd * 100).toFixed(4)),
          min: Number((minReturn * 100).toFixed(4)),
          max: Number((maxReturn * 100).toFixed(4)),
        },
        diversificationBenefit,
        dailyVolatility: Number(dailyVol.toFixed(6)),
        annualizedVolatility: Number((annualVol * 100).toFixed(2)),
        dataPoints: alignedDates.length,
      };

      raw.portfolioReturns = portfolioReturns;
      raw.meanDailyReturn = meanReturn;
      raw.dailyStd = dailyStd;
      raw.minReturn = minReturn;
      raw.maxReturn = maxReturn;
      raw.annualizedReturn = meanReturn * 365;
      raw.var95 = var95;
      raw.var99 = var99;
      raw.cvar95 = cvar95;
      raw.cvar99 = cvar99;
      raw.sharpeRatio = sharpe;
      raw.skewness = skewness;
      raw.kurtosis = kurtosis;
      raw.betaRegression = betaAlpha.beta;
      raw.alphaRegression = betaAlpha.alpha;
      raw.rSquared = betaAlpha.rSquared;
      raw.correlationWithIndex = betaAlpha.correlation;
      raw.betaAlphaObservations = alignedP.length;

      // ── Correlation matrix ──────────────────────────────────────────────
      if (cryptoIds.length >= 2) {
        const n = cryptoIds.length;
        const matrix = Array(n).fill(null).map(() => Array(n).fill(0));
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i === j) {
              matrix[i][j] = 1;
            } else {
              const cov = calcCovariance(returnsByCrypto[cryptoIds[i]], returnsByCrypto[cryptoIds[j]]);
              const std1 = standardDeviation(returnsByCrypto[cryptoIds[i]]);
              const std2 = standardDeviation(returnsByCrypto[cryptoIds[j]]);
              matrix[i][j] = std1 > 0 && std2 > 0 ? Number((cov / (std1 * std2)).toFixed(4)) : 0;
            }
          }
        }
        const symbols = holdings.map(h => h.symbol);
        bundle.correlation = {
          symbols,
          matrix,
          dataPoints: alignedDates.length,
        };
        raw.correlationSymbols = symbols;
        raw.correlationMatrix = matrix;
      }
    }
  } else if (holdings.length > 0) {
    // Not enough data: still capture the composition for validation
    for (const h of holdings) {
      raw.constituents.push({
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        weight: h.weight,
        quantity: parseFloat(h.quantity),
        avg_buy_price: h.avg_buy_price != null ? parseFloat(h.avg_buy_price) : null,
        current_price: h.current_price != null ? parseFloat(h.current_price) : null,
        current_value: h.current_value,
        daily_volatility: null,
        annualized_volatility: null,
        beta: betaMap[h.crypto_id] != null ? betaMap[h.crypto_id] : null,
      });
    }
  }

  // ── Stress test (betas-based, independent from hasEnoughData) ───────────
  if (computeProMetrics) {
    const stressResults = calculateStressTest(portfolioBeta, totalValue);
    const holdingImpacts = holdings.map(h => {
      const beta = betaMap[h.crypto_id] || 1;
      return {
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        value: h.current_value,
        beta,
        scenarios: calculateStressTest(beta, h.current_value),
      };
    });
    bundle.stressTest = {
      portfolioBeta: Number(portfolioBeta.toFixed(4)),
      totalValue: Number(totalValue.toFixed(2)),
      portfolioScenarios: stressResults,
      holdingImpacts,
    };
  }

  return { bundle, raw };
}
