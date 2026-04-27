import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import {
  calculateBetaAlpha,
  calculateVaR,
  calculateCVaR,
  calculateSkewness,
  calculateKurtosis,
  generateHistogramBins,
  generateNormalCurve,
  calculateStressTest,
  calculateSML,
  calculateAnnualizedReturn,
  calculateSharpeRatio
} from '../utils/riskMetrics.js';
import { mean, standardDeviation } from '../utils/statistics.js';
import { getDateFilter } from '../utils/queryHelpers.js';

/**
 * Helper: Get crypto by coingecko_id
 */
async function getCryptoById(coingeckoId) {
  const [crypto] = await Database.execute(
    'SELECT id, symbol, name FROM cryptocurrencies WHERE coingecko_id = ?',
    [coingeckoId]
  );
  return crypto[0] || null;
}

/**
 * Helper: Get log returns for a crypto
 */
async function getCryptoLogReturns(cryptoId, dateFilter) {
  const [returns] = await Database.execute(`
    SELECT date, log_return
    FROM crypto_log_returns
    WHERE crypto_id = ?
      ${dateFilter}
    ORDER BY date ASC
  `, [cryptoId]);
  return returns;
}

/**
 * Helper: Get index (market) log returns
 * Calculates daily log returns from index_history level changes
 * Aggregates to daily level first (using last value of each day), then calculates returns
 */
async function getIndexLogReturns(dateFilter) {
  const [returns] = await Database.execute(`
    SELECT
      date,
      LN(index_level / LAG(index_level) OVER (ORDER BY date)) as log_return
    FROM (
      SELECT
        DATE(snapshot_date) as date,
        -- Get the last index_level of each day
        SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        ${dateFilter.replace(/date/g, 'DATE(snapshot_date)')}
      GROUP BY DATE(snapshot_date)
    ) daily
    ORDER BY date ASC
  `);
  // Filter out null log_return (first row)
  return returns.filter(r => r.log_return !== null);
}

// ============================================================================
// PRICE HISTORY ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/price-history
 * Returns historical prices and percent changes
 */
api.get('/risk/crypto/:id/price-history', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    const dateFilter = getDateFilter(period, 'timestamp');

    let prices;

    // Interval strategy: 24h=5min, 7d=15min, 30d=1h, 90d=3h, 365d/all=daily
    const intervalMap = { '24h': 5, '7d': 15 };
    const intervalMinutes = intervalMap[period] || null;

    if (period === '24h' || period === '7d') {
      // Very short periods: use market_data only (sub-hourly granularity)
      [prices] = await Database.execute(`
        SELECT md.timestamp as date, md.price_usd as price
        FROM market_data md
        WHERE md.crypto_id = ? ${dateFilter}
          AND md.timestamp = (
            SELECT MIN(md2.timestamp)
            FROM market_data md2
            WHERE md2.crypto_id = md.crypto_id
              AND DATE(md2.timestamp) = DATE(md.timestamp)
              AND HOUR(md2.timestamp) = HOUR(md.timestamp)
              AND FLOOR(MINUTE(md2.timestamp) / ${intervalMinutes}) = FLOOR(MINUTE(md.timestamp) / ${intervalMinutes})
          )
        ORDER BY md.timestamp ASC
      `, [crypto.id]);
    } else if (period === '30d' || period === '90d') {
      // Medium periods: ohlc_hourly downsampled + ohlc daily for dates without hourly data
      const hourInterval = period === '30d' ? 1 : 3;
      [prices] = await Database.execute(`
        SELECT date, price FROM (
          SELECT oh.timestamp as date, oh.close as price
          FROM ohlc_hourly oh
          WHERE oh.crypto_id = ? ${dateFilter.replace(/timestamp/g, 'oh.timestamp')}
            AND MOD(HOUR(oh.timestamp), ${hourInterval}) = 0

          UNION ALL

          SELECT o.timestamp as date, o.close as price
          FROM ohlc o
          WHERE o.crypto_id = ? ${dateFilter.replace(/timestamp/g, 'o.timestamp')}
            AND NOT EXISTS (
              SELECT 1 FROM ohlc_hourly oh2
              WHERE oh2.crypto_id = o.crypto_id
                AND DATE(oh2.timestamp) = DATE(o.timestamp)
            )
        ) combined
        ORDER BY date ASC
      `, [crypto.id, crypto.id]);
    } else {
      // Long periods (365d, all): 1 point per day from ohlc
      [prices] = await Database.execute(`
        SELECT date, price FROM (
          SELECT DATE(o.timestamp) as date, o.close as price
          FROM ohlc o
          WHERE o.crypto_id = ? ${dateFilter.replace(/timestamp/g, 'o.timestamp')}

          UNION ALL

          SELECT md.price_date as date, md.price_usd as price
          FROM market_data md
          WHERE md.crypto_id = ? ${dateFilter.replace(/timestamp/g, 'md.timestamp')}
            AND md.timestamp = (
              SELECT MAX(md2.timestamp)
              FROM market_data md2
              WHERE md2.crypto_id = md.crypto_id
                AND md2.price_date = md.price_date
            )
            AND NOT EXISTS (
              SELECT 1 FROM ohlc o2
              WHERE o2.crypto_id = md.crypto_id
                AND DATE(o2.timestamp) = md.price_date
            )
        ) daily
        ORDER BY date ASC
      `, [crypto.id, crypto.id]);
    }

    // Get latest market data with percent changes
    const [latest] = await Database.execute(`
      SELECT
        price_usd,
        percent_change_1h,
        percent_change_24h,
        percent_change_7d,
        percent_change_30d
      FROM market_data
      WHERE crypto_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [crypto.id]);

    // CoinGecko exposes 1h/24h/7d/30d but not 90d. Compute it server-side
    // from the ohlc table so the front never has to derive a metric:
    //   change_90d = (close[N-1] / close[N-91]) - 1
    const [r90Rows] = await Database.execute(`
      SELECT (o1.close / NULLIF(o2.close, 0)) - 1 AS change_90d
      FROM ohlc o1
      LEFT JOIN ohlc o2 ON o2.crypto_id = o1.crypto_id
                       AND o2.timestamp = DATE_SUB(o1.timestamp, INTERVAL 90 DAY)
      WHERE o1.crypto_id = ?
      ORDER BY o1.timestamp DESC
      LIMIT 1
    `, [crypto.id]);

    const change90d = r90Rows.length > 0 && r90Rows[0].change_90d !== null
      ? parseFloat(r90Rows[0].change_90d) * 100
      : null;

    res.json({
      data: {
        crypto: crypto,
        prices: prices.map(p => ({
          date: p.date,
          price: parseFloat(p.price)
        })),
        current: latest[0] ? {
          price: parseFloat(latest[0].price_usd),
          changes: {
            '1h': latest[0].percent_change_1h ? parseFloat(latest[0].percent_change_1h) : null,
            '24h': latest[0].percent_change_24h ? parseFloat(latest[0].percent_change_24h) : null,
            '7d': latest[0].percent_change_7d ? parseFloat(latest[0].percent_change_7d) : null,
            '30d': latest[0].percent_change_30d ? parseFloat(latest[0].percent_change_30d) : null,
            '90d': change90d
          }
        } : null,
        period,
        dataPoints: prices.length
      }
    });

    log.debug(`Fetched price history for ${coingeckoId}`);
  } catch (error) {
    log.error(`Error fetching price history: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch price history'
    });
  }
});

// ============================================================================
// BETA ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/beta
 * Returns beta, alpha, R² against CoinRisqLab 80 Index
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:id/beta', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '365d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // Map period to window days
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, 'all': null };
    const windowDays = windowDaysMap[period] ?? null;

    // Beta read straight from crypto_beta (log returns, batch-computed).
    // Falls back to widest available window if exact requested window is
    // missing (e.g. crypto younger than 365 days). No on-the-fly compute.
    const historizedStats = await getHistorizedBetaStats(crypto.id, windowDays);

    if (!historizedStats) {
      return res.json({
        data: {
          crypto: crypto,
          beta: null,
          alpha: null,
          rSquared: null,
          correlation: null,
          sharpeRatio: null,
          scatterData: [],
          regressionLine: null,
          period,
          dataPoints: 0,
          msg: 'No historized beta data available for this crypto yet',
        },
      });
    }

    const beta = parseFloat(historizedStats.beta);
    const alpha = parseFloat(historizedStats.alpha);
    const rSquared = parseFloat(historizedStats.r_squared);
    const correlation = parseFloat(historizedStats.correlation);
    const dataPoints = historizedStats.num_observations;

    // Scatter data + regression line are visualisation only — they read the
    // raw log returns from BDD (no metric derivation, just plotting).
    const dateFilter = getDateFilter(period);
    const cryptoReturns = await getCryptoLogReturns(crypto.id, dateFilter);
    const indexReturns = await getIndexLogReturns(dateFilter);

    const cryptoReturnsByDate = new Map(cryptoReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));
    const indexReturnsByDate = new Map(indexReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));

    const alignedData = [];

    for (const [date, cryptoReturn] of cryptoReturnsByDate) {
      if (indexReturnsByDate.has(date)) {
        alignedData.push({
          date,
          cryptoReturn,
          marketReturn: indexReturnsByDate.get(date),
        });
      }
    }

    const scatterData = alignedData.map(d => ({
      date: d.date,
      marketReturn: (d.marketReturn * 100),
      cryptoReturn: (d.cryptoReturn * 100),
    }));

    let regressionLine = null;

    if (alignedData.length >= 2) {
      const marketReturnArray = alignedData.map(d => d.marketReturn);
      const marketMin = Math.min(...marketReturnArray) * 100;
      const marketMax = Math.max(...marketReturnArray) * 100;

      regressionLine = {
        slope: beta,
        intercept: alpha * 100,
        x1: marketMin,
        y1: alpha * 100 + beta * marketMin,
        x2: marketMax,
        y2: alpha * 100 + beta * marketMax,
      };
    }

    // Sharpe read from crypto_sharpe (no fallback to recompute).
    let sharpeRatio = null;
    const historizedSharpe = await getHistorizedSharpeStats(crypto.id);

    if (historizedSharpe) {
      sharpeRatio = parseFloat(historizedSharpe.sharpe_ratio);
    }

    res.json({
      data: {
        crypto: crypto,
        beta,
        alpha: (alpha * 100),
        rSquared,
        correlation,
        sharpeRatio,
        scatterData,
        regressionLine,
        period,
        dataPoints,
        fromHistorized: true,
      }
    });

    log.debug(`Beta for ${coingeckoId}: ${beta} (window=${historizedStats.window_days})`);
  } catch (error) {
    log.error(`Error calculating beta: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to calculate beta'
    });
  }
});

// ============================================================================
// VAR ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/var
 * Returns VaR at 95% and 99% confidence levels with histogram data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:id/var', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '365d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // Map period to window days
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, 'all': null };
    const windowDays = windowDaysMap[period] ?? null;

    // Try to get historized stats first (for '365d', 'all' and '90d' periods)
    let var95, var99, cvar95, cvar99, meanReturn, stdDev, minReturn, maxReturn, dataPoints;
    let fromHistorized = false;

    if (period === '365d' || period === 'all' || period === '90d') {
      const historizedStats = await getHistorizedVaRStats(crypto.id, windowDays);
      if (historizedStats) {
        var95 = parseFloat(historizedStats.var_95);
        var99 = parseFloat(historizedStats.var_99);
        cvar95 = parseFloat(historizedStats.cvar_95);
        cvar99 = parseFloat(historizedStats.cvar_99);
        meanReturn = parseFloat(historizedStats.mean_return);
        stdDev = parseFloat(historizedStats.std_dev);
        minReturn = parseFloat(historizedStats.min_return);
        maxReturn = parseFloat(historizedStats.max_return);
        dataPoints = historizedStats.num_observations;
        fromHistorized = true;
        log.debug(`Using historized VaR stats for ${coingeckoId} (date: ${historizedStats.date}, window: ${historizedStats.window_days} days)`);
      }
    }

    // No on-the-fly fallback: VaR/CVaR are read from crypto_var (simple
    // returns, batch-computed nightly). If the crypto has no historized row
    // we surface "no data" instead of recomputing with mismatched semantics.
    if (!fromHistorized) {
      return res.json({
        data: {
          crypto: crypto,
          var95: null,
          var99: null,
          cvar95: null,
          cvar99: null,
          histogram: null,
          period,
          dataPoints: 0,
          msg: 'No historized VaR data available for this crypto yet',
        },
      });
    }

    // Histogram visualisation: read the same simple returns the VaR was
    // computed on, so the chart axis matches the VaR semantics.
    const dateFilter = getDateFilter(period);
    const [simpleReturnsRows] = await Database.execute(
      `SELECT date, simple_return
       FROM crypto_simple_returns
       WHERE crypto_id = ?
         ${dateFilter}
       ORDER BY date ASC`,
      [crypto.id],
    );
    const returns = simpleReturnsRows;
    const simpleReturns = simpleReturnsRows.map(r => parseFloat(r.simple_return));
    const histogram = generateHistogramBins(simpleReturns, 30);

    // Convert histogram counts to percentages for chart
    const totalCount = simpleReturns.length;
    const histogramData = [];
    for (let i = 0; i < histogram.counts.length; i++) {
      const binStart = histogram.bins[i];
      const binEnd = histogram.bins[i + 1];
      const binCenter = (binStart + binEnd) / 2;
      histogramData.push({
        binStart: (binStart * 100),
        binEnd: (binEnd * 100),
        binCenter: (binCenter * 100),
        count: histogram.counts[i],
        percentage: ((histogram.counts[i] / totalCount) * 100)
      });
    }

    res.json({
      data: {
        crypto: crypto,
        var95: (var95 * 100),
        var99: (var99 * 100),
        cvar95: (cvar95 * 100),
        cvar99: (cvar99 * 100),
        histogram: histogramData,
        statistics: {
          mean: (meanReturn * 100),
          stdDev: (stdDev * 100),
          min: (minReturn * 100),
          max: (maxReturn * 100)
        },
        period,
        dataPoints,
        fromHistorized
      }
    });

    log.debug(`Calculated VaR for ${coingeckoId}: 95%=${(var95 * 100).toFixed(2)}%, 99%=${(var99 * 100).toFixed(2)}%`);
  } catch (error) {
    log.error(`Error calculating VaR: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to calculate VaR'
    });
  }
});

// ============================================================================
// STRESS TEST ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/stress-test
 * Returns stress test scenarios based on beta with price history for charting
 */
api.get('/risk/crypto/:id/stress-test', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '30d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // Get current price
    const [priceData] = await Database.execute(`
      SELECT price_usd
      FROM market_data
      WHERE crypto_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [crypto.id]);

    if (priceData.length === 0) {
      return res.status(404).json({
        data: null,
        msg: `No price data found for ${coingeckoId}`
      });
    }

    const currentPrice = parseFloat(priceData[0].price_usd);

    // Get daily price history for the chart (from ohlc table)
    const priceDateFilter = getDateFilter(period, 'timestamp');

    const [priceHistory] = await Database.execute(`
      SELECT
        timestamp as date,
        \`close\` as price
      FROM ohlc
      WHERE crypto_id = ?
        ${priceDateFilter}
      ORDER BY timestamp ASC
    `, [crypto.id]);

    // Beta read from crypto_beta (log returns, statistical version) — no
    // on-the-fly recompute. If the crypto has no historized beta yet,
    // surface "no data" so the caller doesn't see a fabricated default.
    const historizedBeta = await getHistorizedBetaStats(crypto.id, 365);

    if (!historizedBeta) {
      return res.json({
        data: {
          crypto: crypto,
          currentPrice: currentPrice,
          beta: null,
          scenarios: [],
          priceHistory: priceHistory.map(p => ({
            date: p.date,
            price: parseFloat(p.price),
          })),
          period,
          dataPoints: 0,
          msg: 'No historized beta available — stress test cannot be derived',
        },
      });
    }

    const beta = parseFloat(historizedBeta.beta);

    // Stress-test scenarios = beta × shock × current price. The shocks are
    // hardcoded historical-crisis constants (utils/riskMetrics.js); applying
    // them to the live price is a trivial multiplication, not a risk-metric
    // derivation. Beta + currentPrice both come from BDD.
    const scenarios = calculateStressTest(beta, currentPrice);

    res.json({
      data: {
        crypto: crypto,
        currentPrice: currentPrice,
        beta: beta,
        scenarios,
        priceHistory: priceHistory.map(p => ({
          date: p.date,
          price: parseFloat(p.price)
        })),
        period,
        dataPoints: historizedBeta.num_observations,
      }
    });

    log.debug(`Stress test for ${coingeckoId} (beta from window=${historizedBeta.window_days})`);
  } catch (error) {
    log.error(`Error calculating stress test: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to calculate stress test'
    });
  }
});

// ============================================================================
// DISTRIBUTION (SKEWNESS/KURTOSIS) ENDPOINT
// ============================================================================

/**
 * Helper: Get historized distribution stats from database
 * Returns the latest stats for the specified window (default 90 days)
 */
async function getHistorizedDistributionStats(cryptoId, windowDays = 90) {
  // Exact requested window first, then fall back to the latest available
  // window for that crypto (cryptos newer than `windowDays` still surface
  // their largest computed window instead of nothing).
  const [exact] = await Database.execute(`
    SELECT skewness, kurtosis, num_observations, window_days, date
    FROM crypto_distribution_stats
    WHERE crypto_id = ? AND window_days = ?
    ORDER BY date DESC LIMIT 1
  `, [cryptoId, windowDays]);

  if (exact.length > 0) return exact[0];

  const [latest] = await Database.execute(`
    SELECT skewness, kurtosis, num_observations, window_days, date
    FROM crypto_distribution_stats
    WHERE crypto_id = ?
    ORDER BY date DESC LIMIT 1
  `, [cryptoId]);

  return latest[0] || null;
}

/**
 * Helper: Get historized VaR stats from database
 * @param {number} cryptoId - The crypto ID
 * @param {number|null} windowDays - Window days to filter by, or null for "all" (latest entry regardless of window)
 */
async function getHistorizedVaRStats(cryptoId, windowDays = null) {
  // Try the requested window first (exact match), then fall back to the
  // largest available window for that crypto. Cryptos newer than the
  // requested window won't have a 365-day row but should still surface
  // their latest entry instead of forcing the caller to recompute.
  let query = `
    SELECT
      var_95,
      var_99,
      cvar_95,
      cvar_99,
      mean_return,
      std_dev,
      min_return,
      max_return,
      num_observations,
      window_days,
      date
    FROM crypto_var
    WHERE crypto_id = ?
  `;
  const params = [cryptoId];

  if (windowDays !== null) {
    // Try exact match first; if no row exists for that window (e.g. crypto
    // is younger than the requested window) the caller falls back below.
    const [exact] = await Database.execute(
      query + ' AND window_days = ? ORDER BY date DESC LIMIT 1',
      [...params, windowDays],
    );

    if (exact.length > 0) return exact[0];
  }

  // Fallback: latest row regardless of window — surfaces the most recent
  // VaR available (the largest window the crypto's history can support).
  query += ' ORDER BY date DESC LIMIT 1';

  const [stats] = await Database.execute(query, params);

  return stats[0] || null;
}

/**
 * Helper: Get historized Beta stats from database
 * @param {number} cryptoId - The crypto ID
 * @param {number|null} windowDays - Window days to filter by, or null for latest entry regardless of window
 */
async function getHistorizedSharpeStats(cryptoId) {
  const [stats] = await Database.execute(`
    SELECT sharpe_ratio, mean_return, std_return, num_observations, window_days, date
    FROM crypto_sharpe
    WHERE crypto_id = ?
    ORDER BY date DESC LIMIT 1
  `, [cryptoId]);
  return stats[0] || null;
}

async function getHistorizedBetaStats(cryptoId, windowDays = null) {
  // Exact requested window first, then fall back to latest row (max window)
  // for that crypto. log return type only — see methodology split.
  if (windowDays !== null) {
    const [exact] = await Database.execute(`
      SELECT beta, alpha, r_squared, correlation, num_observations, window_days, date
      FROM crypto_beta
      WHERE crypto_id = ? AND return_type = 'log' AND window_days = ?
      ORDER BY date DESC LIMIT 1
    `, [cryptoId, windowDays]);

    if (exact.length > 0) return exact[0];
  }

  const [latest] = await Database.execute(`
    SELECT beta, alpha, r_squared, correlation, num_observations, window_days, date
    FROM crypto_beta
    WHERE crypto_id = ? AND return_type = 'log'
    ORDER BY date DESC LIMIT 1
  `, [cryptoId]);

  return latest[0] || null;
}

/**
 * Helper: Get historized SML stats from database
 */
async function getHistorizedSMLStats(cryptoId, windowDays = 90) {
  // Exact requested window first, then fall back to latest row (max window).
  const [exact] = await Database.execute(`
    SELECT beta, expected_return, actual_return, alpha, is_overvalued,
           market_return, num_observations, window_days, date
    FROM crypto_sml
    WHERE crypto_id = ? AND window_days = ?
    ORDER BY date DESC LIMIT 1
  `, [cryptoId, windowDays]);

  if (exact.length > 0) return exact[0];

  const [latest] = await Database.execute(`
    SELECT beta, expected_return, actual_return, alpha, is_overvalued,
           market_return, num_observations, window_days, date
    FROM crypto_sml
    WHERE crypto_id = ?
    ORDER BY date DESC LIMIT 1
  `, [cryptoId]);

  return latest[0] || null;
}

/**
 * GET /risk/crypto/:id/distribution
 * Returns skewness, kurtosis, and distribution data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:id/distribution', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // Map period to window days for historized lookup
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const windowDays = windowDaysMap[period] || 90;

    // Skewness/kurtosis read straight from crypto_distribution_stats.
    // No on-the-fly fallback — if the table has no row, surface "no data".
    const historizedStats = await getHistorizedDistributionStats(crypto.id, windowDays);

    if (!historizedStats) {
      return res.json({
        data: {
          crypto: crypto,
          skewness: null,
          kurtosis: null,
          histogram: null,
          normalCurve: null,
          period,
          dataPoints: 0,
          msg: 'No historized distribution data available for this crypto yet',
        },
      });
    }

    const skewness = parseFloat(historizedStats.skewness);
    const kurtosis = parseFloat(historizedStats.kurtosis);
    const dataPoints = historizedStats.num_observations;

    // Histogram + normal-curve overlay are visualisation-only — they read
    // log returns straight from BDD (no metric derivation, just plotting).
    // mu/sigma here are descriptive of the histogram's distribution and
    // not exposed as user-facing metrics.
    const dateFilter = getDateFilter(period);
    const returns = await getCryptoLogReturns(crypto.id, dateFilter);
    const logReturns = returns.map(r => parseFloat(r.log_return));

    if (logReturns.length === 0) {
      return res.json({
        data: {
          crypto: crypto,
          skewness,
          kurtosis,
          histogram: [],
          normalCurve: [],
          period,
          dataPoints,
        },
      });
    }

    const mu = mean(logReturns);
    const sigma = standardDeviation(logReturns);

    // Generate histogram from current log returns (for visualization)
    const histogram = generateHistogramBins(logReturns, 30);

    // Generate normal curve for overlay
    const normalCurve = generateNormalCurve(mu, sigma, histogram.min, histogram.max, 100);

    // Convert to percentages for chart
    const totalCount = logReturns.length;
    const histogramData = [];
    for (let i = 0; i < histogram.counts.length; i++) {
      const binStart = histogram.bins[i];
      const binEnd = histogram.bins[i + 1];
      const binCenter = (binStart + binEnd) / 2;

      // Calculate normal curve value at bin center for overlay
      const normalY = normalCurve.find(p => Math.abs(p.x - binCenter) < histogram.binWidth / 2);

      histogramData.push({
        binStart: (binStart * 100),
        binEnd: (binEnd * 100),
        binCenter: (binCenter * 100),
        count: histogram.counts[i],
        density: ((histogram.counts[i] / totalCount) / histogram.binWidth),
        normalDensity: normalY ? normalY.y : 0
      });
    }

    // Scale normal curve to match histogram scale
    const normalCurveScaled = normalCurve.map(p => ({
      x: (p.x * 100),
      y: p.y
    }));

    res.json({
      data: {
        crypto: crypto,
        skewness,
        kurtosis,
        mean: (mu * 100),
        stdDev: (sigma * 100),
        histogram: histogramData,
        normalCurve: normalCurveScaled,
        interpretation: {
          skewness: skewness < -0.5 ? 'negative' : skewness > 0.5 ? 'positive' : 'symmetric',
          kurtosis: kurtosis > 1 ? 'leptokurtic' : kurtosis < -1 ? 'platykurtic' : 'mesokurtic'
        },
        period,
        dataPoints,
        fromHistorized: true,
      }
    });

    log.debug(`Distribution for ${coingeckoId}: skew=${skewness}, kurt=${kurtosis} (window=${historizedStats.window_days})`);
  } catch (error) {
    log.error(`Error calculating distribution: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to calculate distribution'
    });
  }
});

// ============================================================================
// SML (SECURITY MARKET LINE) ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/sml
 * Returns SML positioning data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:id/sml', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // Map period to window days
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const windowDays = windowDaysMap[period] || 90;

    // SML read straight from crypto_sml. No on-the-fly fallback — if no
    // row, surface "no data".
    const historizedStats = await getHistorizedSMLStats(crypto.id, windowDays);

    if (!historizedStats) {
      return res.json({
        data: {
          crypto: crypto,
          sml: null,
          period,
          dataPoints: 0,
          msg: 'No historized SML data available for this crypto yet',
        },
      });
    }

    const beta = parseFloat(historizedStats.beta);
    const expectedReturn = parseFloat(historizedStats.expected_return) * 100;
    const actualReturn = parseFloat(historizedStats.actual_return) * 100;
    const alpha = parseFloat(historizedStats.alpha) * 100;
    const marketReturn = parseFloat(historizedStats.market_return) * 100;
    const dataPoints = historizedStats.num_observations;

    // SML reference line (visualisation): pure plotting, no metric derived
    const smlLine = [];

    for (let b = 0; b <= 2.5; b += 0.1) {
      smlLine.push({ beta: b, expectedReturn: b * marketReturn });
    }

    const smlData = {
      cryptoBeta: beta,
      cryptoExpectedReturn: expectedReturn,
      cryptoActualReturn: actualReturn,
      alpha,
      isOvervalued: historizedStats.is_overvalued === 1,
      smlLine,
    };

    res.json({
      data: {
        crypto: crypto,
        ...smlData,
        marketReturn,
        period,
        dataPoints,
        fromHistorized: true,
      },
    });

    log.debug(`SML for ${coingeckoId}: beta=${smlData.cryptoBeta}, alpha=${smlData.alpha}% (window=${historizedStats.window_days})`);
  } catch (error) {
    log.error(`Error calculating SML: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to calculate SML'
    });
  }
});

// ============================================================================
// COMBINED RISK METRICS ENDPOINT
// ============================================================================

/**
 * GET /risk/crypto/:id/summary
 * Returns a summary of all risk metrics for quick loading
 */
api.get('/risk/crypto/:id/summary', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoById(coingeckoId);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    // 1. Get Price Data
    const [latest] = await Database.execute(`
      SELECT
        price_usd,
        percent_change_1h,
        percent_change_24h,
        percent_change_7d,
        percent_change_30d
      FROM market_data
      WHERE crypto_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [crypto.id]);

    const currentPrice = latest[0] ? parseFloat(latest[0].price_usd) : 0;
    const priceChanges = latest[0] ? {
      '1h': latest[0].percent_change_1h ? parseFloat(latest[0].percent_change_1h) : null,
      '24h': latest[0].percent_change_24h ? parseFloat(latest[0].percent_change_24h) : null,
      '7d': latest[0].percent_change_7d ? parseFloat(latest[0].percent_change_7d) : null,
      '30d': latest[0].percent_change_30d ? parseFloat(latest[0].percent_change_30d) : null
    } : null;

    // All risk metrics read straight from their batch-historized tables.
    // No on-the-fly recompute. Each helper falls back to the latest row
    // available for the crypto if the exact requested window is missing.

    let var95 = null;
    let var99 = null;
    let cvar99 = null;
    let skewness = null;
    let kurtosis = null;
    let beta = null;
    let alpha = null;
    let smlData = null;
    let stressTest = null;

    // VaR/CVaR — crypto_var (simple returns), default 365d window
    const varStats = await getHistorizedVaRStats(crypto.id, 365);

    if (varStats) {
      var95 = parseFloat(varStats.var_95);
      var99 = parseFloat(varStats.var_99);
      cvar99 = parseFloat(varStats.cvar_99);
    }

    // Skewness/Kurtosis — crypto_distribution_stats, 90d window
    const distStats = await getHistorizedDistributionStats(crypto.id, 90);

    if (distStats) {
      skewness = parseFloat(distStats.skewness);
      kurtosis = parseFloat(distStats.kurtosis);
    }

    // Beta — crypto_beta (log return type), 365d window
    const betaStats = await getHistorizedBetaStats(crypto.id, 365);

    if (betaStats) {
      beta = parseFloat(betaStats.beta);
      alpha = parseFloat(betaStats.alpha) * 100;
    }

    // SML — crypto_sml, 90d window
    const smlStats = await getHistorizedSMLStats(crypto.id, 90);

    if (smlStats) {
      smlData = {
        alpha: parseFloat(smlStats.alpha) * 100,
        isOvervalued: smlStats.is_overvalued === 1,
      };
    }

    // Stress test — beta × shock × current price (trivial multiplication;
    // beta + currentPrice both come from BDD, shock is a hardcoded historical
    // crisis constant from utils/riskMetrics.js).
    if (currentPrice > 0 && beta !== null) {
      const scenarios = calculateStressTest(beta, currentPrice);
      const covidScenario = scenarios.find(s => s.id === 'covid-19');

      if (covidScenario) {
        stressTest = {
          newPrice: covidScenario.newPrice,
          priceChange: covidScenario.priceChange,
          impactPercentage: covidScenario.expectedImpact,
        };
      }
    }

    // Volatility + deltas — read straight from crypto_volatility via a
    // single self-join per period. No JS-side derivation.
    const [currentVolRows] = await Database.execute(`
      SELECT date, daily_volatility, annualized_volatility
      FROM crypto_volatility
      WHERE crypto_id = ?
      ORDER BY date DESC
      LIMIT 1
    `, [crypto.id]);

    const currentVol = currentVolRows[0] || null;
    let volChanges = null;

    if (currentVol) {
      const computeDelta = async (days) => {
        const [rows] = await Database.execute(`
          SELECT cv_now.annualized_volatility AS ann_now,
                 cv_past.annualized_volatility AS ann_past
          FROM crypto_volatility cv_now
          LEFT JOIN crypto_volatility cv_past
            ON cv_past.crypto_id = cv_now.crypto_id
           AND cv_past.date = DATE_SUB(cv_now.date, INTERVAL ? DAY)
          WHERE cv_now.crypto_id = ?
          ORDER BY cv_now.date DESC
          LIMIT 1
        `, [days, crypto.id]);

        if (rows.length === 0 || rows[0].ann_past === null) return null;

        const aNow = parseFloat(rows[0].ann_now);
        const aPast = parseFloat(rows[0].ann_past);

        return aPast > 0 ? ((aNow - aPast) / aPast) : null;
      };

      const [d24, d7, d30, d90] = await Promise.all([
        computeDelta(1),
        computeDelta(7),
        computeDelta(30),
        computeDelta(90),
      ]);

      volChanges = { '24h': d24, '7d': d7, '30d': d30, '90d': d90 };
    }

    res.json({
      data: {
        crypto: crypto,
        // hasData = true if at least one historized risk metric is available
        hasData: !!(varStats || distStats || betaStats || smlStats || currentVol),
        price: {
          current: currentPrice,
          changes: priceChanges
        },
        volatility: currentVol ? {
          daily: (parseFloat(currentVol.daily_volatility) * 100),
          annualized: (parseFloat(currentVol.annualized_volatility) * 100),
          changes: volChanges ? {
            '24h': volChanges['24h'] ? (volChanges['24h'] * 100) : null,
            '7d': volChanges['7d'] ? (volChanges['7d'] * 100) : null,
            '30d': volChanges['30d'] ? (volChanges['30d'] * 100) : null,
            '90d': volChanges['90d'] ? (volChanges['90d'] * 100) : null
          } : null
        } : null,
        beta,
        alpha, // Regression Alpha
        sml: smlData ? {
          alpha: smlData.alpha, // Jensen's Alpha
          isOvervalued: smlData.isOvervalued
        } : null,
        var95: var95 !== null ? var95 * 100 : null,
        var99: var99 !== null ? var99 * 100 : null,
        cvar99: cvar99 !== null ? cvar99 * 100 : null,
        stressTest,
        skewness,
        kurtosis,
        period,
        dataPoints: varStats?.num_observations ?? betaStats?.num_observations ?? distStats?.num_observations ?? 0,
      }
    });

    log.debug(`Fetched risk summary for ${coingeckoId}`);
  } catch (error) {
    log.error(`Error fetching risk summary: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch risk summary'
    });
  }
});
