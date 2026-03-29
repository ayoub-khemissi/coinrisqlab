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
} from '../utils/riskMetrics.js';
import { getDateFilter } from '../utils/queryHelpers.js';

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
  const [holdings] = await Database.execute(
    `SELECT
      h.crypto_id,
      c.symbol,
      c.name AS crypto_name,
      c.image_url,
      h.quantity,
      h.avg_buy_price,
      md.price_usd AS current_price,
      (h.quantity * md.price_usd) AS current_value
    FROM user_portfolio_holdings h
    JOIN cryptocurrencies c ON c.id = h.crypto_id
    LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
      AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
    WHERE h.portfolio_id = ?`,
    [portfolioId]
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
 */
async function getAlignedReturns(cryptoIds, period = '90d') {
  const dateFilter = getDateFilter(period);

  // Get all returns for all cryptos
  const [allReturns] = await Database.execute(
    `SELECT crypto_id, date, log_return
     FROM crypto_log_returns
     WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
       ${dateFilter}
     ORDER BY date ASC`,
    cryptoIds
  );

  // Group by date — only keep dates where ALL cryptos have data
  const byDate = {};
  for (const row of allReturns) {
    const dateStr = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
    if (!byDate[dateStr]) byDate[dateStr] = {};
    byDate[dateStr][row.crypto_id] = parseFloat(row.log_return);
  }

  const alignedDates = Object.keys(byDate).filter(
    date => cryptoIds.every(id => byDate[date][id] !== undefined)
  ).sort();

  const returnsByCrypto = {};
  for (const id of cryptoIds) {
    returnsByCrypto[id] = alignedDates.map(date => byDate[date][id]);
  }

  return { alignedDates, returnsByCrypto };
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
    const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.avg_buy_price), 0);
    const totalPnl = totalValue - totalCost;
    const pnlPercent = totalCost > 0 ? ((totalPnl / totalCost) * 100) : 0;

    const allocation = holdings.map(h => ({
      crypto_id: h.crypto_id,
      symbol: h.symbol,
      name: h.crypto_name,
      image_url: h.image_url,
      value: h.current_value,
      weight: Number((h.weight * 100).toFixed(2)),
      pnl: h.current_value - (h.quantity * h.avg_buy_price),
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

    const holdings = await getPortfolioHoldings(portfolioId);
    if (holdings.length === 0) {
      return res.json({ data: { dailyVolatility: 0, annualizedVolatility: 0, beta: 0, holdingCount: 0 } });
    }

    const cryptoIds = holdings.map(h => h.crypto_id);
    const weights = holdings.map(h => h.weight);

    const { returnsByCrypto, alignedDates } = await getAlignedReturns(cryptoIds, '90d');

    if (alignedDates.length < 10) {
      return res.json({
        data: { dailyVolatility: 0, annualizedVolatility: 0, beta: 0, holdingCount: holdings.length, msg: 'Not enough data points' },
      });
    }

    // Build assets array for covariance matrix
    const assets = cryptoIds.map(id => ({ id, returns: returnsByCrypto[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const dailyVol = calcPortfolioVol(weights, covMatrix);
    const annualVol = annualizeVolatility(dailyVol);

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

    res.json({
      data: {
        dailyVolatility: Number(dailyVol.toFixed(6)),
        annualizedVolatility: Number((annualVol * 100).toFixed(2)),
        beta: Number(portfolioBeta.toFixed(4)),
        holdingCount: holdings.length,
        dataPoints: alignedDates.length,
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

    // Normalize both to 100 at start
    const portfolioNormalized = snapshots.length > 0
      ? snapshots.map(s => ({
          date: s.snapshot_date,
          value: Number(((s.total_value_usd / snapshots[0].total_value_usd) * 100).toFixed(2)),
        }))
      : [];

    const indexNormalized = indexHistory.length > 0
      ? indexHistory.map(h => ({
          date: h.snapshot_date,
          value: Number(((h.index_level / indexHistory[0].index_level) * 100).toFixed(2)),
        }))
      : [];

    res.json({
      data: {
        portfolio: portfolioNormalized,
        benchmark: indexNormalized,
        portfolioReturn: snapshots.length >= 2
          ? Number((((snapshots[snapshots.length - 1].total_value_usd / snapshots[0].total_value_usd) - 1) * 100).toFixed(2))
          : 0,
        benchmarkReturn: indexHistory.length >= 2
          ? Number((((indexHistory[indexHistory.length - 1].index_level / indexHistory[0].index_level) - 1) * 100).toFixed(2))
          : 0,
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

    const cryptoIds = holdings.map(h => h.crypto_id);
    const weights = holdings.map(h => h.weight);
    const { returnsByCrypto, alignedDates } = await getAlignedReturns(cryptoIds, '90d');

    if (alignedDates.length < 10) {
      return res.json({ data: null, msg: 'Not enough data points' });
    }

    // Synthetic portfolio returns
    const portfolioReturns = alignedDates.map((_, dayIdx) => {
      let dayReturn = 0;
      for (let i = 0; i < cryptoIds.length; i++) {
        dayReturn += weights[i] * returnsByCrypto[cryptoIds[i]][dayIdx];
      }
      return dayReturn;
    });

    // VaR / CVaR
    const var95 = calculateVaR(portfolioReturns, 95);
    const var99 = calculateVaR(portfolioReturns, 99);
    const cvar95 = calculateCVaR(portfolioReturns, 95);
    const cvar99 = calculateCVaR(portfolioReturns, 99);

    // Sharpe
    const sharpe = calculateSharpeRatio(portfolioReturns);

    // Diversification benefit
    const assets = cryptoIds.map(id => ({ id, returns: returnsByCrypto[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const portfolioDailyVol = calcPortfolioVol(weights, covMatrix);

    const weightedAvgVol = weights.reduce((sum, w, i) => {
      return sum + w * standardDeviation(assets[i].returns);
    }, 0);

    const diversificationBenefit = weightedAvgVol > 0
      ? Number((((weightedAvgVol - portfolioDailyVol) / weightedAvgVol) * 100).toFixed(2))
      : 0;

    res.json({
      data: {
        var95: Number((var95 * 100).toFixed(4)),
        var99: Number((var99 * 100).toFixed(4)),
        cvar95: Number((cvar95 * 100).toFixed(4)),
        cvar99: Number((cvar99 * 100).toFixed(4)),
        sharpe: Number(sharpe.toFixed(4)),
        diversificationBenefit,
        dailyVolatility: Number(portfolioDailyVol.toFixed(6)),
        annualizedVolatility: Number((annualizeVolatility(portfolioDailyVol) * 100).toFixed(2)),
        dataPoints: alignedDates.length,
        portfolioReturns,
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

    const cryptoIds = holdings.map(h => h.crypto_id);
    const symbols = holdings.map(h => h.symbol);
    const { returnsByCrypto, alignedDates } = await getAlignedReturns(cryptoIds, '90d');

    if (alignedDates.length < 10) {
      return res.json({ data: null, msg: 'Not enough data points' });
    }

    // Build correlation matrix
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
    const cryptoIds = holdings.map(h => h.crypto_id);
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
    const weights = holdings.map(h => h.weight);
    let portfolioBeta = 0;
    for (let i = 0; i < holdings.length; i++) {
      portfolioBeta += weights[i] * (betaMap[cryptoIds[i]] || 1);
    }

    // Stress test on portfolio
    const stressResults = calculateStressTest(portfolioBeta, totalValue);

    // Also compute per-holding impact
    const holdingImpacts = holdings.map(h => {
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
