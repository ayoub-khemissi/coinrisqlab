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
  getAlignedReturnsFilled,
} from '../utils/userPortfolioAnalytics.js';
import { computePortfolioTWR } from '../utils/userPortfolioPerformance.js';

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
      weight: (h.weight * 100),
      pnl: h.current_value - h.quantity * h.avg_buy_price,
    }));

    res.json({
      data: {
        totalValue: totalValue,
        totalCost: totalCost,
        totalPnl: totalPnl,
        pnlPercent: pnlPercent,
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
        weight: h.weight,
        daily_volatility: indivDailyVol,
        annualized_volatility: (indivAnnualVol * 100),
        current_value: (h.current_value || 0),
      };
    });

    // Portfolio beta: weighted sum of individual statistical betas (log returns)
    const [betaRows] = await Database.execute(
      `SELECT crypto_id, beta FROM crypto_beta cb_outer
       WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
         AND return_type = 'log'
         AND date = (SELECT MAX(date) FROM crypto_beta WHERE crypto_id = cb_outer.crypto_id AND return_type = 'log')`,
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
        ? (((weightedAvgVol - dailyVol) / weightedAvgVol) * 100)
        : 0;

    res.json({
      data: {
        dailyVolatility: dailyVol,
        annualizedVolatility: (annualVol * 100),
        beta: portfolioBeta,
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

    // Portfolio time-weighted return series (replays transactions, isolates
    // price effect from capital flows — see utils/userPortfolioPerformance.js)
    const twr = await computePortfolioTWR(portfolioId, period);

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

    // Clip the index series to start on the same day as the portfolio
    // series so both chips read over the same window — otherwise a
    // 5-day-old portfolio would show its 5d return next to a 30d index
    // return, which is not a fair comparison.
    const portfolioStartDate = twr.series.length > 0 ? twr.series[0].date : null;
    const toIsoDate = (d) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const clippedIndex = (portfolioStartDate
      ? indexHistory.filter((h) => toIsoDate(h.snapshot_date) >= portfolioStartDate)
      : indexHistory).map((h) => ({
        date: toIsoDate(h.snapshot_date),
        index_level: parseFloat(h.index_level),
      }));

    const indexNormalized =
      clippedIndex.length > 0
        ? clippedIndex.map((h) => ({
            date: h.date,
            value: ((h.index_level / clippedIndex[0].index_level) * 100),
          }))
        : [];

    res.json({
      data: {
        portfolio: twr.series,
        benchmark: indexNormalized,
        portfolioReturn: twr.totalReturn,
        benchmarkReturn:
          clippedIndex.length >= 2
            ? (
                  (clippedIndex[clippedIndex.length - 1].index_level / clippedIndex[0].index_level -
                    1) *
                  100
                )
            : 0,
        portfolio24hReturn: portfolio24hReturn,
        benchmark24hReturn: benchmark24hReturn,
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
    // Use the zero-fill variant so portfolios with one young crypto (e.g.
    // RAVE with only 137 days) still get the full 365-day window for
    // VaR / CVaR / Sharpe / Beta — see /methodology/risk-metrics and the
    // Excel example sheet `Feuil1`.
    const { returnsByCryptoLog, returnsByCryptoSimple, alignedDates } = await getAlignedReturnsFilled(
      cryptoIds,
      '365d'
    );

    if (alignedDates.length < 10) {
      return res.json({ data: null, msg: 'Not enough data points' });
    }

    // Window slicing per methodology:
    //   - Vol / Skew / Kurto / Correlation: 90-day window
    //   - Sharpe / VaR / CVaR / Beta-Alpha: 365-day window
    // Aligned returns are fetched over 365 days; 90-day series is the tail.
    const SHORT_WINDOW = 90;
    const sliceLast = (arr, n) => (arr.length > n ? arr.slice(arr.length - n) : arr);
    const log90Map = Object.fromEntries(
      cryptoIds.map((id) => [id, sliceLast(returnsByCryptoLog[id] || [], SHORT_WINDOW)]),
    );
    const simple90Map = Object.fromEntries(
      cryptoIds.map((id) => [id, sliceLast(returnsByCryptoSimple[id] || [], SHORT_WINDOW)]),
    );
    const dates90 = sliceLast(alignedDates, SHORT_WINDOW);

    const buildSeries = (returnsByCrypto, dates) =>
      dates.map((_, dayIdx) => {
        let dayReturn = 0;
        for (let i = 0; i < cryptoIds.length; i++) {
          dayReturn += weights[i] * returnsByCrypto[cryptoIds[i]][dayIdx];
        }
        return dayReturn;
      });

    const portfolioReturnsLog365 = buildSeries(returnsByCryptoLog, alignedDates);
    const portfolioReturnsSimple365 = buildSeries(returnsByCryptoSimple, alignedDates);
    const portfolioReturnsLog90 = buildSeries(log90Map, dates90);
    const portfolioReturnsSimple90 = buildSeries(simple90Map, dates90);

    // 365-day window (per methodology: VaR / Sharpe)
    const var95 = calculateVaR(portfolioReturnsSimple365, 95);
    const var99 = calculateVaR(portfolioReturnsSimple365, 99);
    const cvar95 = calculateCVaR(portfolioReturnsSimple365, 95);
    const cvar99 = calculateCVaR(portfolioReturnsSimple365, 99);
    const sharpe = calculateSharpeRatio(portfolioReturnsLog365);

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

    // Beta/Alpha regression vs index — 365-day window both sides
    const alignedPortfolioReturns = [];
    const alignedMarketReturns = [];
    for (let i = 0; i < alignedDates.length; i++) {
      if (indexReturnMap[alignedDates[i]] !== undefined) {
        alignedPortfolioReturns.push(portfolioReturnsLog365[i]);
        alignedMarketReturns.push(indexReturnMap[alignedDates[i]]);
      }
    }

    const betaAlpha = calculateBetaAlpha(alignedPortfolioReturns, alignedMarketReturns);

    // Skewness & Kurtosis (90-day log returns — per methodology)
    const skewness = calculateSkewness(portfolioReturnsLog90);
    const kurtosis = calculateKurtosis(portfolioReturnsLog90);

    // Return statistics: Best/Worst/Mean/Annualized on the 365-day simple
    // series so the labels "Best Day (Xd)" stay honest. dailyStd is the
    // daily portfolio volatility (= 90d log std), kept aligned with the
    // value displayed in the Volatility card.
    const meanReturn = mean(portfolioReturnsSimple365);
    const dailyStd = standardDeviation(portfolioReturnsLog90);
    const minReturn = Math.min(...portfolioReturnsSimple365);
    const maxReturn = Math.max(...portfolioReturnsSimple365);
    const annualizedReturn = meanReturn * 365;

    // Diversification benefit (90-day log returns — same window as Volatility)
    const assets = cryptoIds.map((id) => ({ id, returns: log90Map[id] }));
    const covMatrix = buildCovarianceMatrix(assets);
    const portfolioDailyVol = calcPortfolioVol(weights, covMatrix);

    const weightedAvgVol = weights.reduce((sum, w, i) => {
      return sum + w * standardDeviation(assets[i].returns);
    }, 0);

    const diversificationBenefit =
      weightedAvgVol > 0
        ? (((weightedAvgVol - portfolioDailyVol) / weightedAvgVol) * 100)
        : 0;

    res.json({
      data: {
        var95: (var95 * 100),
        var99: (var99 * 100),
        cvar95: (cvar95 * 100),
        cvar99: (cvar99 * 100),
        sharpe: sharpe,
        beta: betaAlpha.beta,
        alpha: (betaAlpha.alpha * 36500), // annualized alpha in %
        skewness,
        kurtosis,
        returnStats: {
          meanDaily: (meanReturn * 100),
          annualized: (annualizedReturn * 100),
          dailyStd: (dailyStd * 100),
          min: (minReturn * 100),
          max: (maxReturn * 100),
        },
        diversificationBenefit,
        dailyVolatility: portfolioDailyVol,
        annualizedVolatility: (annualizeVolatility(portfolioDailyVol) * 100),
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
    // Correlation between two cryptos requires both having data on the same
    // day — use intersection (getAlignedReturns), not the zero-fill helper.
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
          matrix[i][j] = std1 > 0 && std2 > 0 ? (cov / (std1 * std2)) : 0;
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
           AND return_type = 'log'
         GROUP BY crypto_id
       ) latest ON cb.crypto_id = latest.crypto_id AND cb.date = latest.max_date
       WHERE cb.return_type = 'log'`,
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
        portfolioBeta: portfolioBeta,
        totalValue: totalValue,
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
        getAlignedReturnsFilled(cryptoIds, '365d'),
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

    // ── Performance (TWR series + index) ─────────────────────────────────
    let period = '30d';
    const dateFilter = getDateFilter(period, 'snapshot_date');

    // Compute portfolio TWR (replays transactions, excludes capital flows)
    // and fetch the matching index history in parallel.
    const [twr, indexResult, benchmarkResult] = await Promise.all([
      computePortfolioTWR(portfolioId, period),
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

    // Clip the index series to the portfolio's actual lifetime so the
    // cumulative chips compare like-for-like windows. Normalise dates to
    // 'YYYY-MM-DD' strings so they align with the TWR helper's output —
    // otherwise the front's date Map can't intersect the two series.
    const portfolioStartDate = twr.series.length > 0 ? twr.series[0].date : null;
    const toIsoDate = (d) =>
      d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const clippedIndex = (portfolioStartDate
      ? indexHistory.filter((h) => toIsoDate(h.snapshot_date) >= portfolioStartDate)
      : indexHistory).map((h) => ({
        date: toIsoDate(h.snapshot_date),
        index_level: parseFloat(h.index_level),
      }));

    // 24h rolling: portfolio side comes from the TWR helper (proper daily
    // weighted simple return), index side from successive index_level diffs.
    const benchmark24hSeries =
      clippedIndex.length >= 2
        ? clippedIndex.map((h, i) => {
            if (i === 0) return { date: h.date, pct: null };
            const curr = h.index_level;
            const prev = clippedIndex[i - 1].index_level;
            const pct = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
            return { date: h.date, pct: pct };
          })
        : [];

    result.performance = {
      portfolio: twr.series,
      benchmark:
        clippedIndex.length > 0
          ? clippedIndex.map((h) => ({
              date: h.date,
              value: ((h.index_level / clippedIndex[0].index_level) * 100),
            }))
          : [],
      portfolioReturn: twr.totalReturn,
      benchmarkReturn:
        clippedIndex.length >= 2
          ? (
                (clippedIndex[clippedIndex.length - 1].index_level / clippedIndex[0].index_level -
                  1) *
                100
              )
          : 0,
      portfolio24hReturn: portfolio24hReturn,
      benchmark24hReturn: benchmark24hReturn,
      portfolio24hSeries: twr.dailyReturns,
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
