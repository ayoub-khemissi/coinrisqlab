import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { requirePro } from '../middleware/requirePro.js';
import {
  buildCovarianceMatrix,
  portfolioVolatility as calcPortfolioVol,
  annualizeVolatility,
  mean,
  standardDeviation,
  covariance as calcCovariance,
} from '../utils/statistics.js';
import {
  calculateVaR,
  calculateCVaR,
  calculateSharpeRatio,
  calculateStressTest,
  calculateBetaAlpha,
  calculateSkewness,
  calculateKurtosis,
} from '../utils/riskMetrics.js';
import { getDateFilter } from '../utils/queryHelpers.js';
import {
  computeAnalyticsBundle,
  getLatestBetaMap,
  getIndexLogReturnsMap,
  getAlignedReturns,
} from '../utils/userPortfolioAnalytics.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyPortfolioOwnership(portfolioId, userId) {
  const [rows] = await Database.execute(
    'SELECT id FROM user_portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return rows.length > 0;
}

/**
 * Get holdings with current prices and weights.
 */
async function getPortfolioHoldings(portfolioId) {
  // Get max timestamps for relevant cryptos first, then join — avoids correlated subquery on 4.7M rows
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

  return holdings.map((h) => ({
    ...h,
    weight: totalValue > 0 ? h.current_value / totalValue : 0,
    totalValue,
  }));
}

// ─── Portfolio Overview ─────────────────────────────────────────────────────

api.get('/user/portfolios/:id/overview', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdings = await getPortfolioHoldings(portfolioId);
    const totalValue = holdings.length > 0 ? holdings[0].totalValue : 0;
    const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.avg_buy_price, 0);
    const totalPnl = totalValue - totalCost;
    const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    const allocation = holdings.map((h) => ({
      crypto_id: h.crypto_id,
      symbol: h.symbol,
      name: h.crypto_name,
      image_url: h.image_url,
      value: h.current_value,
      weight: Number((h.weight * 100).toFixed(2)),
      pnl: h.current_value - h.quantity * h.avg_buy_price,
    }));

    res.json({
      data: {
        totalValue: Number(totalValue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        totalPnl: Number(totalPnl.toFixed(2)),
        pnlPercent: Number(pnlPercent.toFixed(2)),
        holdingCount: holdings.length,
        allocation,
      },
    });
  } catch (error) {
    log.error(`Portfolio overview error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute portfolio overview' });
  }
});

// ─── Portfolio Evolution (Snapshots) ────────────────────────────────────────

api.get('/user/portfolios/:id/evolution', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    let { period = '30d' } = req.query;

    // Free plan: max 30d
    const proPeriods = ['90d', '365d', 'all'];
    if (req.user.plan === 'free' && proPeriods.includes(period)) {
      period = '30d';
    }

    const dateFilter = getDateFilter(period, 'snapshot_date');

    const [snapshots] = await Database.execute(
      `SELECT snapshot_date, total_value_usd, total_pnl_usd
       FROM user_portfolio_snapshots
       WHERE portfolio_id = ?
         ${dateFilter}
       ORDER BY snapshot_date ASC`,
      [portfolioId]
    );

    res.json({ data: snapshots });
  } catch (error) {
    log.error(`Portfolio evolution error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch portfolio evolution' });
  }
});

// ─── Portfolio Volatility + Beta ────────────────────────────────────────────

api.get('/user/portfolios/:id/volatility', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { period = '90d' } = req.query;

    const holdings = await getPortfolioHoldings(portfolioId);
    if (holdings.length === 0) {
      return res.json({
        data: {
          dailyVolatility: 0,
          annualizedVolatility: 0,
          beta: 0,
          holdingCount: 0,
          constituents: [],
        },
      });
    }

    const cryptoIds = holdings.map((h) => h.crypto_id);
    const weights = holdings.map((h) => h.weight);

    const { returnsByCryptoLog, alignedDates } = await getAlignedReturns(cryptoIds, period);

    if (alignedDates.length < 10) {
      return res.json({
        data: {
          dailyVolatility: 0,
          annualizedVolatility: 0,
          beta: 0,
          holdingCount: holdings.length,
          constituents: [],
          msg: 'Not enough data points',
        },
      });
    }

    // Build assets array for covariance matrix (log returns — statistical)
    const assets = cryptoIds.map((id) => ({ id, returns: returnsByCryptoLog[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const dailyVol = calcPortfolioVol(weights, covMatrix);
    const annualVol = annualizeVolatility(dailyVol);

    // Individual constituent volatility
    const constituents = holdings.map((h, i) => {
      const returns = returnsByCryptoLog[h.crypto_id] || [];
      const indivDailyVol = standardDeviation(returns);
      const indivAnnualVol = annualizeVolatility(indivDailyVol);

      return {
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        image_url: h.image_url,
        weight: Number(h.weight.toFixed(4)),
        daily_volatility: Number(indivDailyVol.toFixed(6)),
        annualized_volatility: Number((indivAnnualVol * 100).toFixed(2)),
        current_value: Number((h.current_value || 0).toFixed(2)),
      };
    });

    // Portfolio beta: weighted sum of individual betas
    const [betaRows] = await Database.execute(
      `SELECT crypto_id, beta FROM crypto_beta
       WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
         AND date = (SELECT MAX(date) FROM crypto_beta WHERE crypto_id = crypto_beta.crypto_id)`,
      cryptoIds
    );

    const betaMap = {};
    for (const row of betaRows) {
      betaMap[row.crypto_id] = parseFloat(row.beta);
    }

    let portfolioBeta = 0;
    for (let i = 0; i < holdings.length; i++) {
      portfolioBeta += weights[i] * (betaMap[cryptoIds[i]] || 1);
    }

    // Weighted average volatility (for diversification benefit)
    const weightedAvgVol = weights.reduce((sum, w, i) => {
      return sum + w * standardDeviation(assets[i].returns);
    }, 0);

    const diversificationBenefit =
      weightedAvgVol > 0
        ? Number((((weightedAvgVol - dailyVol) / weightedAvgVol) * 100).toFixed(2))
        : 0;

    res.json({
      data: {
        dailyVolatility: Number(dailyVol.toFixed(6)),
        annualizedVolatility: Number((annualVol * 100).toFixed(2)),
        beta: Number(portfolioBeta.toFixed(4)),
        holdingCount: holdings.length,
        dataPoints: alignedDates.length,
        diversificationBenefit,
        constituents,
      },
    });
  } catch (error) {
    log.error(`Portfolio volatility error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute portfolio volatility' });
  }
});

// ─── Portfolio Performance vs Benchmark ─────────────────────────────────────

api.get('/user/portfolios/:id/performance', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    let { period = '30d' } = req.query;
    if (req.user.plan === 'free' && ['90d', '365d', 'all'].includes(period)) {
      period = '30d';
    }

    const dateFilter = getDateFilter(period, 'snapshot_date');

    // Portfolio snapshots
    const [snapshots] = await Database.execute(
      `SELECT snapshot_date, total_value_usd
       FROM user_portfolio_snapshots
       WHERE portfolio_id = ? ${dateFilter}
       ORDER BY snapshot_date ASC`,
      [portfolioId]
    );

    // Index history (one per day)
    const indexDateFilter = getDateFilter(period, 'snapshot_date');
    const [indexHistory] = await Database.execute(
      `SELECT snapshot_date, index_level
       FROM index_history
       WHERE index_config_id = 1 ${indexDateFilter}
       AND timestamp = (
         SELECT MAX(timestamp) FROM index_history ih2
         WHERE ih2.index_config_id = 1 AND ih2.snapshot_date = index_history.snapshot_date
       )
       ORDER BY snapshot_date ASC`,
      []
    );

    // 24h rolling performance — weighted sum of each holding's percent_change_24h
    const holdings = await getPortfolioHoldings(portfolioId);
    let portfolio24hReturn = 0;
    if (holdings.length > 0) {
      const cryptoIds = holdings.map((h) => h.crypto_id);
      const [marketRows] = await Database.execute(
        `SELECT crypto_id, percent_change_24h
         FROM market_data md
         WHERE md.crypto_id IN (${cryptoIds.map(() => '?').join(',')})
           AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = md.crypto_id)`,
        cryptoIds
      );

      const changeMap = {};
      for (const row of marketRows) {
        changeMap[row.crypto_id] = parseFloat(row.percent_change_24h) || 0;
      }

      for (const h of holdings) {
        portfolio24hReturn += h.weight * (changeMap[h.crypto_id] || 0);
      }
    }

    // Benchmark 24h return from latest two index snapshots
    const [benchmarkRows] = await Database.execute(
      `SELECT index_level FROM index_history
       WHERE index_config_id = 1
       ORDER BY snapshot_date DESC, timestamp DESC
       LIMIT 2`,
      []
    );

    let benchmark24hReturn = 0;
    if (benchmarkRows.length >= 2) {
      const latest = parseFloat(benchmarkRows[0].index_level);
      const prev = parseFloat(benchmarkRows[1].index_level);
      benchmark24hReturn = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
    }

    // Normalize both to 100 at start
    const portfolioNormalized =
      snapshots.length > 0
        ? snapshots.map((s) => ({
            date: s.snapshot_date,
            value: Number(((s.total_value_usd / snapshots[0].total_value_usd) * 100).toFixed(2)),
          }))
        : [];

    const indexNormalized =
      indexHistory.length > 0
        ? indexHistory.map((h) => ({
            date: h.snapshot_date,
            value: Number(((h.index_level / indexHistory[0].index_level) * 100).toFixed(2)),
          }))
        : [];

    res.json({
      data: {
        portfolio: portfolioNormalized,
        benchmark: indexNormalized,
        portfolioReturn:
          snapshots.length >= 2
            ? Number(
                (
                  (snapshots[snapshots.length - 1].total_value_usd / snapshots[0].total_value_usd -
                    1) *
                  100
                ).toFixed(2)
              )
            : 0,
        benchmarkReturn:
          indexHistory.length >= 2
            ? Number(
                (
                  (indexHistory[indexHistory.length - 1].index_level / indexHistory[0].index_level -
                    1) *
                  100
                ).toFixed(2)
              )
            : 0,
        portfolio24hReturn: Number(portfolio24hReturn.toFixed(2)),
        benchmark24hReturn: Number(benchmark24hReturn.toFixed(2)),
      },
    });
  } catch (error) {
    log.error(`Portfolio performance error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute portfolio performance' });
  }
});

// ─── Pro: Full Risk Metrics ─────────────────────────────────────────────────

api.get('/user/portfolios/:id/risk-metrics', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdings = await getPortfolioHoldings(portfolioId);
    if (holdings.length === 0) {
      return res.json({ data: null, msg: 'No holdings' });
    }

    const cryptoIds = holdings.map((h) => h.crypto_id);
    const weights = holdings.map((h) => h.weight);
    const { returnsByCryptoLog, returnsByCryptoSimple, alignedDates } = await getAlignedReturns(
      cryptoIds,
      '90d'
    );

    if (alignedDates.length < 10) {
      return res.json({ data: null, msg: 'Not enough data points' });
    }

    // Synthetic portfolio returns — dual series (see /methodology/risk-metrics):
    //   log    → statistical metrics (skewness, kurtosis, beta regression)
    //   simple → economic metrics (VaR, CVaR, Sharpe, min/max/mean)
    const portfolioReturnsLog = alignedDates.map((_, dayIdx) => {
      let dayReturn = 0;
      for (let i = 0; i < cryptoIds.length; i++) {
        dayReturn += weights[i] * returnsByCryptoLog[cryptoIds[i]][dayIdx];
      }
      return dayReturn;
    });
    const portfolioReturnsSimple = alignedDates.map((_, dayIdx) => {
      let dayReturn = 0;
      for (let i = 0; i < cryptoIds.length; i++) {
        dayReturn += weights[i] * returnsByCryptoSimple[cryptoIds[i]][dayIdx];
      }
      return dayReturn;
    });

    // VaR / CVaR (simple returns)
    const var95 = calculateVaR(portfolioReturnsSimple, 95);
    const var99 = calculateVaR(portfolioReturnsSimple, 99);
    const cvar95 = calculateCVaR(portfolioReturnsSimple, 95);
    const cvar99 = calculateCVaR(portfolioReturnsSimple, 99);

    // Sharpe (simple returns)
    const sharpe = calculateSharpeRatio(portfolioReturnsSimple);

    // Alpha + Beta (portfolio vs market index)
    // Compute index log returns on-the-fly from index_history
    const [indexReturns] = await Database.execute(`
      SELECT date, log_return FROM (
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
      ) with_returns
      WHERE log_return IS NOT NULL
      ORDER BY date ASC
    `);

    const indexReturnMap = {};
    for (const row of indexReturns) {
      const dateStr =
        row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
      indexReturnMap[dateStr] = parseFloat(row.log_return);
    }

    // Align portfolio log returns with market log returns for beta/alpha regression
    const alignedPortfolioReturns = [];
    const alignedMarketReturns = [];
    for (let i = 0; i < alignedDates.length; i++) {
      if (indexReturnMap[alignedDates[i]] !== undefined) {
        alignedPortfolioReturns.push(portfolioReturnsLog[i]);
        alignedMarketReturns.push(indexReturnMap[alignedDates[i]]);
      }
    }

    const betaAlpha = calculateBetaAlpha(alignedPortfolioReturns, alignedMarketReturns);

    // Skewness & Kurtosis (log returns — statistical distribution shape)
    const skewness = calculateSkewness(portfolioReturnsLog);
    const kurtosis = calculateKurtosis(portfolioReturnsLog);

    // Return statistics (simple returns — economic interpretation)
    const meanReturn = mean(portfolioReturnsSimple);
    const dailyStd = standardDeviation(portfolioReturnsSimple);
    const minReturn = Math.min(...portfolioReturnsSimple);
    const maxReturn = Math.max(...portfolioReturnsSimple);
    const annualizedReturn = meanReturn * 365;

    // Diversification benefit (log returns — volatility is statistical)
    const assets = cryptoIds.map((id) => ({ id, returns: returnsByCryptoLog[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const portfolioDailyVol = calcPortfolioVol(weights, covMatrix);

    const weightedAvgVol = weights.reduce((sum, w, i) => {
      return sum + w * standardDeviation(assets[i].returns);
    }, 0);

    const diversificationBenefit =
      weightedAvgVol > 0
        ? Number((((weightedAvgVol - portfolioDailyVol) / weightedAvgVol) * 100).toFixed(2))
        : 0;

    res.json({
      data: {
        var95: Number((var95 * 100).toFixed(4)),
        var99: Number((var99 * 100).toFixed(4)),
        cvar95: Number((cvar95 * 100).toFixed(4)),
        cvar99: Number((cvar99 * 100).toFixed(4)),
        sharpe: Number(sharpe.toFixed(4)),
        beta: betaAlpha.beta,
        alpha: Number((betaAlpha.alpha * 36500).toFixed(4)), // annualized alpha in %
        skewness,
        kurtosis,
        returnStats: {
          meanDaily: Number((meanReturn * 100).toFixed(4)),
          annualized: Number((annualizedReturn * 100).toFixed(2)),
          dailyStd: Number((dailyStd * 100).toFixed(4)),
          min: Number((minReturn * 100).toFixed(4)),
          max: Number((maxReturn * 100).toFixed(4)),
        },
        diversificationBenefit,
        dailyVolatility: Number(portfolioDailyVol.toFixed(6)),
        annualizedVolatility: Number((annualizeVolatility(portfolioDailyVol) * 100).toFixed(2)),
        dataPoints: alignedDates.length,
      },
    });
  } catch (error) {
    log.error(`Risk metrics error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute risk metrics' });
  }
});

// ─── Pro: Correlation Matrix ────────────────────────────────────────────────

api.get('/user/portfolios/:id/correlation', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdings = await getPortfolioHoldings(portfolioId);
    if (holdings.length < 2) {
      return res.json({ data: null, msg: 'Need at least 2 holdings for correlation' });
    }

    const cryptoIds = holdings.map((h) => h.crypto_id);
    const symbols = holdings.map((h) => h.symbol);
    const { returnsByCryptoLog, alignedDates } = await getAlignedReturns(cryptoIds, '90d');

    if (alignedDates.length < 10) {
      return res.json({ data: null, msg: 'Not enough data points' });
    }

    // Build correlation matrix (log returns — statistical stability)
    const n = cryptoIds.length;
    const matrix = Array(n)
      .fill(null)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const cov = calcCovariance(
            returnsByCryptoLog[cryptoIds[i]],
            returnsByCryptoLog[cryptoIds[j]]
          );
          const std1 = standardDeviation(returnsByCryptoLog[cryptoIds[i]]);
          const std2 = standardDeviation(returnsByCryptoLog[cryptoIds[j]]);
          matrix[i][j] = std1 > 0 && std2 > 0 ? Number((cov / (std1 * std2)).toFixed(4)) : 0;
        }
      }
    }

    res.json({
      data: { symbols, matrix, dataPoints: alignedDates.length },
    });
  } catch (error) {
    log.error(`Correlation matrix error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute correlation matrix' });
  }
});

// ─── Pro: Stress Test ───────────────────────────────────────────────────────

api.get('/user/portfolios/:id/stress-test', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdings = await getPortfolioHoldings(portfolioId);
    if (holdings.length === 0) {
      return res.json({ data: null, msg: 'No holdings' });
    }

    const totalValue = holdings[0].totalValue;

    // Get betas for each holding
    const cryptoIds = holdings.map((h) => h.crypto_id);
    const [betaRows] = await Database.execute(
      `SELECT cb.crypto_id, cb.beta FROM crypto_beta cb
       INNER JOIN (
         SELECT crypto_id, MAX(date) AS max_date FROM crypto_beta
         WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
         GROUP BY crypto_id
       ) latest ON cb.crypto_id = latest.crypto_id AND cb.date = latest.max_date`,
      cryptoIds
    );

    const betaMap = {};
    for (const row of betaRows) {
      betaMap[row.crypto_id] = parseFloat(row.beta);
    }

    // Weighted portfolio beta
    const weights = holdings.map((h) => h.weight);
    let portfolioBeta = 0;
    for (let i = 0; i < holdings.length; i++) {
      portfolioBeta += weights[i] * (betaMap[cryptoIds[i]] || 1);
    }

    // Stress test on portfolio
    const stressResults = calculateStressTest(portfolioBeta, totalValue);

    // Also compute per-holding impact
    const holdingImpacts = holdings.map((h) => {
      const beta = betaMap[h.crypto_id] || 1;
      const scenarios = calculateStressTest(beta, h.current_value);
      return {
        crypto_id: h.crypto_id,
        symbol: h.symbol,
        name: h.crypto_name,
        value: h.current_value,
        beta,
        scenarios,
      };
    });

    res.json({
      data: {
        portfolioBeta: Number(portfolioBeta.toFixed(4)),
        totalValue: Number(totalValue.toFixed(2)),
        portfolioScenarios: stressResults,
        holdingImpacts,
      },
    });
  } catch (error) {
    log.error(`Stress test error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute stress test' });
  }
});

// ─── Analytics Bundle (single request, all data) ────────────────────────────

api.get('/user/portfolios/:id/analytics-bundle', authenticateUser, async (req, res) => {
  const startTime = Date.now();
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const isPro =
      req.user.plan === 'pro' &&
      (!req.user.planExpiresAt || new Date(req.user.planExpiresAt) > new Date());
    const holdings = await getPortfolioHoldings(portfolioId);

    const result = {
      volatility: null,
      performance: null,
      riskMetrics: null,
      correlation: null,
      stressTest: null,
    };

    if (holdings.length === 0) {
      return res.json({ data: result });
    }

    const cryptoIds = holdings.map((h) => h.crypto_id);

    // ── Shared data: aligned returns (log + simple) + beta map ───────────
    // Pro-only: fetch the index returns in parallel (needed for beta/alpha regression).
    const [{ returnsByCryptoLog, returnsByCryptoSimple, alignedDates }, betaMap, indexReturnMap] =
      await Promise.all([
        getAlignedReturns(cryptoIds, '90d'),
        getLatestBetaMap(cryptoIds),
        isPro ? getIndexLogReturnsMap() : Promise.resolve({}),
      ]);

    // ── Compute everything via the shared pure function ──────────────────
    // This is the single source of truth shared with
    // commands/calculateUserPortfolioAnalytics.js (historization) and
    // commands/exportUserPortfolioAnalyticsValidation.js (business validation CSV).
    const { bundle } = computeAnalyticsBundle({
      holdings,
      returnsByCryptoLog,
      returnsByCryptoSimple,
      alignedDates,
      betaMap,
      indexReturnMap,
      computeProMetrics: isPro,
    });

    result.volatility = bundle.volatility;
    result.riskMetrics = bundle.riskMetrics;
    result.correlation = bundle.correlation;
    result.stressTest = bundle.stressTest;

    // ── Performance (snapshots — lightweight) ───────────────────────────
    let period = '30d';
    const dateFilter = getDateFilter(period, 'snapshot_date');

    // Run snapshot + index queries in parallel
    const [snapshotResult, indexResult, benchmarkResult] = await Promise.all([
      Database.execute(
        `SELECT snapshot_date, total_value_usd FROM user_portfolio_snapshots WHERE portfolio_id = ? ${dateFilter} ORDER BY snapshot_date ASC`,
        [portfolioId]
      ),
      Database.execute(
        `SELECT snapshot_date, index_level FROM (
           SELECT snapshot_date, index_level, ROW_NUMBER() OVER (PARTITION BY snapshot_date ORDER BY timestamp DESC) AS rn
           FROM index_history WHERE index_config_id = 1 ${dateFilter}
         ) ranked WHERE rn = 1 ORDER BY snapshot_date ASC`,
        []
      ),
      Database.execute(
        `SELECT index_level FROM (
           SELECT index_level, ROW_NUMBER() OVER (ORDER BY timestamp DESC) AS rn
           FROM index_history WHERE index_config_id = 1
         ) ranked WHERE rn <= 2`,
        []
      ),
    ]);

    const snapshots = snapshotResult[0];
    const indexHistory = indexResult[0];
    const benchmarkRows = benchmarkResult[0];

    // 24h returns — use percent_change_24h already in holdings (no extra query)
    let portfolio24hReturn = 0;
    for (const h of holdings) {
      portfolio24hReturn += h.weight * (parseFloat(h.percent_change_24h) || 0);
    }

    let benchmark24hReturn = 0;
    if (benchmarkRows.length >= 2) {
      const latest = parseFloat(benchmarkRows[0].index_level);
      const prev = parseFloat(benchmarkRows[1].index_level);
      benchmark24hReturn = prev > 0 ? ((latest - prev) / prev) * 100 : 0;
    }

    // 24h rolling series: (close_t − close_{t-1}) / close_t × 100 for each day
    const portfolio24hSeries =
      snapshots.length >= 2
        ? snapshots.map((s, i) => {
            if (i === 0) return { date: s.snapshot_date, pct: null };
            const curr = parseFloat(s.total_value_usd);
            const prev = parseFloat(snapshots[i - 1].total_value_usd);
            const pct = curr > 0 ? ((curr - prev) / curr) * 100 : 0;
            return { date: s.snapshot_date, pct: Number(pct.toFixed(4)) };
          })
        : [];

    const benchmark24hSeries =
      indexHistory.length >= 2
        ? indexHistory.map((h, i) => {
            if (i === 0) return { date: h.snapshot_date, pct: null };
            const curr = parseFloat(h.index_level);
            const prev = parseFloat(indexHistory[i - 1].index_level);
            const pct = curr > 0 ? ((curr - prev) / curr) * 100 : 0;
            return { date: h.snapshot_date, pct: Number(pct.toFixed(4)) };
          })
        : [];

    result.performance = {
      portfolio:
        snapshots.length > 0
          ? snapshots.map((s) => ({
              date: s.snapshot_date,
              value: Number(((s.total_value_usd / snapshots[0].total_value_usd) * 100).toFixed(2)),
            }))
          : [],
      benchmark:
        indexHistory.length > 0
          ? indexHistory.map((h) => ({
              date: h.snapshot_date,
              value: Number(((h.index_level / indexHistory[0].index_level) * 100).toFixed(2)),
            }))
          : [],
      portfolioReturn:
        snapshots.length >= 2
          ? Number(
              (
                (snapshots[snapshots.length - 1].total_value_usd / snapshots[0].total_value_usd -
                  1) *
                100
              ).toFixed(2)
            )
          : 0,
      benchmarkReturn:
        indexHistory.length >= 2
          ? Number(
              (
                (indexHistory[indexHistory.length - 1].index_level / indexHistory[0].index_level -
                  1) *
                100
              ).toFixed(2)
            )
          : 0,
      portfolio24hReturn: Number(portfolio24hReturn.toFixed(2)),
      benchmark24hReturn: Number(benchmark24hReturn.toFixed(2)),
      portfolio24hSeries,
      benchmark24hSeries,
    };

    res.json({ data: result });
    log.debug(
      `Analytics bundle: ${Date.now() - startTime}ms, ${alignedDates.length} points, pro=${isPro}`
    );
  } catch (error) {
    log.error(`Analytics bundle error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to compute analytics' });
  }
});
