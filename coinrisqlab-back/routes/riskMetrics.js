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
  calculateAnnualizedReturn
} from '../utils/riskMetrics.js';
import { mean, standardDeviation } from '../utils/statistics.js';
import { getDateFilter, getMaxDataPoints } from '../utils/queryHelpers.js';

/**
 * Helper: Get crypto by symbol
 */
async function getCryptoBySymbol(symbol) {
  const [crypto] = await Database.execute(
    'SELECT id, symbol, name FROM cryptocurrencies WHERE UPPER(symbol) = ?',
    [symbol.toUpperCase()]
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
 * GET /risk/crypto/:symbol/price-history
 * Returns historical prices and percent changes
 */
api.get('/risk/crypto/:symbol/price-history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
      });
    }

    const dateFilter = getDateFilter(period, 'timestamp');
    const maxPoints = getMaxDataPoints(period);

    // Get price history with intelligent downsampling
    // Uses ROW_NUMBER to evenly sample data points for better chart visualization
    // Uses timestamp for granular data (hourly) instead of price_date (daily)
    const [prices] = await Database.execute(`
      SELECT date, price FROM (
        SELECT
          timestamp as date,
          price_usd as price,
          ROW_NUMBER() OVER (ORDER BY timestamp) as rn,
          COUNT(*) OVER () as total_count
        FROM market_data
        WHERE crypto_id = ?
          ${dateFilter}
      ) sub
      WHERE
        rn = 1
        OR rn = total_count
        OR MOD(rn - 1, GREATEST(1, FLOOR(total_count / ?))) = 0
      ORDER BY date ASC
    `, [crypto.id, maxPoints]);

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
            '30d': latest[0].percent_change_30d ? parseFloat(latest[0].percent_change_30d) : null
          }
        } : null,
        period,
        dataPoints: prices.length
      }
    });

    log.debug(`Fetched price history for ${symbol}`);
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
 * GET /risk/crypto/:symbol/beta
 * Returns beta, alpha, R² against CoinRisqLab 80 Index
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:symbol/beta', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '365d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
      });
    }

    // Map period to window days
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90, '365d': 365, 'all': null };
    const windowDays = windowDaysMap[period] ?? null;

    // Try to get historized stats first (for '365d', 'all' and '90d' periods)
    let beta, alpha, rSquared, correlation, dataPoints;
    let fromHistorized = false;

    if (period === '365d' || period === 'all' || period === '90d') {
      const historizedStats = await getHistorizedBetaStats(crypto.id, windowDays);
      if (historizedStats) {
        beta = parseFloat(historizedStats.beta);
        alpha = parseFloat(historizedStats.alpha);
        rSquared = parseFloat(historizedStats.r_squared);
        correlation = parseFloat(historizedStats.correlation);
        dataPoints = historizedStats.num_observations;
        fromHistorized = true;
        log.debug(`Using historized beta stats for ${symbol} (date: ${historizedStats.date}, window: ${historizedStats.window_days} days)`);
      }
    }

    const dateFilter = getDateFilter(period);

    // Get crypto log returns (always needed for scatter plot)
    const cryptoReturns = await getCryptoLogReturns(crypto.id, dateFilter);
    const indexReturns = await getIndexLogReturns(dateFilter);

    if (cryptoReturns.length < 5 || indexReturns.length < 5) {
      return res.json({
        data: {
          crypto: crypto,
          beta: null,
          alpha: null,
          rSquared: null,
          correlation: null,
          scatterData: [],
          period,
          dataPoints: 0,
          msg: 'Insufficient data points for beta calculation (minimum 5 required)'
        }
      });
    }

    // Align dates for scatter data
    const cryptoReturnsByDate = new Map(cryptoReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));
    const indexReturnsByDate = new Map(indexReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));

    const alignedData = [];
    for (const [date, cryptoReturn] of cryptoReturnsByDate) {
      if (indexReturnsByDate.has(date)) {
        alignedData.push({
          date,
          cryptoReturn,
          marketReturn: indexReturnsByDate.get(date)
        });
      }
    }

    if (alignedData.length < 5) {
      return res.json({
        data: {
          crypto: crypto,
          beta: null,
          alpha: null,
          rSquared: null,
          correlation: null,
          scatterData: [],
          period,
          dataPoints: alignedData.length,
          msg: 'Insufficient overlapping data points (minimum 5 required)'
        }
      });
    }

    // If not from historized data, calculate on-the-fly
    if (!fromHistorized) {
      const cryptoReturnArray = alignedData.map(d => d.cryptoReturn);
      const marketReturnArray = alignedData.map(d => d.marketReturn);
      const result = calculateBetaAlpha(cryptoReturnArray, marketReturnArray);
      beta = result.beta;
      alpha = result.alpha;
      rSquared = result.rSquared;
      correlation = result.correlation;
      dataPoints = alignedData.length;
      log.debug(`Calculated beta on-the-fly for ${symbol}`);
    }

    // Prepare scatter data for visualization
    const scatterData = alignedData.map(d => ({
      date: d.date,
      marketReturn: Number((d.marketReturn * 100).toFixed(4)),
      cryptoReturn: Number((d.cryptoReturn * 100).toFixed(4))
    }));

    // Calculate regression line endpoints for visualization
    const marketReturnArray = alignedData.map(d => d.marketReturn);
    const marketMin = Math.min(...marketReturnArray) * 100;
    const marketMax = Math.max(...marketReturnArray) * 100;
    const regressionLine = {
      slope: beta,
      intercept: alpha * 100,
      x1: marketMin,
      y1: alpha * 100 + beta * marketMin,
      x2: marketMax,
      y2: alpha * 100 + beta * marketMax
    };

    res.json({
      data: {
        crypto: crypto,
        beta,
        alpha: Number((alpha * 100).toFixed(4)),
        rSquared,
        correlation,
        scatterData,
        regressionLine,
        period,
        dataPoints,
        fromHistorized
      }
    });

    log.debug(`Beta for ${symbol}: ${beta}, historized=${fromHistorized}`);
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
 * GET /risk/crypto/:symbol/var
 * Returns VaR at 95% and 99% confidence levels with histogram data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:symbol/var', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '365d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
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
        log.debug(`Using historized VaR stats for ${symbol} (date: ${historizedStats.date}, window: ${historizedStats.window_days} days)`);
      }
    }

    // Get log returns for histogram (always needed for visualization)
    const dateFilter = getDateFilter(period);
    const returns = await getCryptoLogReturns(crypto.id, dateFilter);

    if (returns.length < 5) {
      return res.json({
        data: {
          crypto: crypto,
          var95: null,
          var99: null,
          cvar95: null,
          cvar99: null,
          histogram: null,
          period,
          dataPoints: returns.length,
          msg: 'Insufficient data points for VaR calculation (minimum 5 required)'
        }
      });
    }

    const logReturns = returns.map(r => parseFloat(r.log_return));

    // If not from historized data, calculate on-the-fly
    if (!fromHistorized) {
      var95 = calculateVaR(logReturns, 95);
      var99 = calculateVaR(logReturns, 99);
      cvar95 = calculateCVaR(logReturns, 95);
      cvar99 = calculateCVaR(logReturns, 99);
      meanReturn = mean(logReturns);
      stdDev = standardDeviation(logReturns);
      minReturn = Math.min(...logReturns);
      maxReturn = Math.max(...logReturns);
      dataPoints = logReturns.length;
      log.debug(`Calculated VaR on-the-fly for ${symbol}`);
    }

    // Generate histogram for visualization (always from current returns)
    const histogram = generateHistogramBins(logReturns, 30);

    // Convert histogram counts to percentages for chart
    const totalCount = logReturns.length;
    const histogramData = [];
    for (let i = 0; i < histogram.counts.length; i++) {
      const binStart = histogram.bins[i];
      const binEnd = histogram.bins[i + 1];
      const binCenter = (binStart + binEnd) / 2;
      histogramData.push({
        binStart: Number((binStart * 100).toFixed(4)),
        binEnd: Number((binEnd * 100).toFixed(4)),
        binCenter: Number((binCenter * 100).toFixed(4)),
        count: histogram.counts[i],
        percentage: Number(((histogram.counts[i] / totalCount) * 100).toFixed(2))
      });
    }

    res.json({
      data: {
        crypto: crypto,
        var95: Number((var95 * 100).toFixed(4)),
        var99: Number((var99 * 100).toFixed(4)),
        cvar95: Number((cvar95 * 100).toFixed(4)),
        cvar99: Number((cvar99 * 100).toFixed(4)),
        histogram: histogramData,
        statistics: {
          mean: Number((meanReturn * 100).toFixed(4)),
          stdDev: Number((stdDev * 100).toFixed(4)),
          min: Number((minReturn * 100).toFixed(4)),
          max: Number((maxReturn * 100).toFixed(4))
        },
        period,
        dataPoints,
        fromHistorized
      }
    });

    log.debug(`Calculated VaR for ${symbol}: 95%=${(var95 * 100).toFixed(2)}%, 99%=${(var99 * 100).toFixed(2)}%`);
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
 * GET /risk/crypto/:symbol/stress-test
 * Returns stress test scenarios based on beta with price history for charting
 */
api.get('/risk/crypto/:symbol/stress-test', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '30d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
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
        msg: `No price data found for ${symbol}`
      });
    }

    const currentPrice = parseFloat(priceData[0].price_usd);

    // Get price history for the chart
    const priceDateFilter = getDateFilter(period, 'timestamp');
    const maxPoints = getMaxDataPoints(period);

    const [priceHistory] = await Database.execute(`
      SELECT date, price FROM (
        SELECT
          timestamp as date,
          price_usd as price,
          ROW_NUMBER() OVER (ORDER BY timestamp) as rn,
          COUNT(*) OVER () as total_count
        FROM market_data
        WHERE crypto_id = ?
          ${priceDateFilter}
      ) sub
      WHERE
        rn = 1
        OR rn = total_count
        OR MOD(rn - 1, GREATEST(1, FLOOR(total_count / ?))) = 0
      ORDER BY date ASC
    `, [crypto.id, maxPoints]);

    // Calculate beta for stress test (use 365d period as per requirements)
    const dateFilter = getDateFilter('365d');
    const cryptoReturns = await getCryptoLogReturns(crypto.id, dateFilter);
    const indexReturns = await getIndexLogReturns(dateFilter);

    // Align returns
    const cryptoReturnsByDate = new Map(cryptoReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));
    const indexReturnsByDate = new Map(indexReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));

    const alignedCrypto = [];
    const alignedMarket = [];
    for (const [date, cryptoReturn] of cryptoReturnsByDate) {
      if (indexReturnsByDate.has(date)) {
        alignedCrypto.push(cryptoReturn);
        alignedMarket.push(indexReturnsByDate.get(date));
      }
    }

    let beta = 1; // Default beta
    if (alignedCrypto.length >= 7) {
      const result = calculateBetaAlpha(alignedCrypto, alignedMarket);
      beta = result.beta;
    }

    // Calculate stress test scenarios
    const scenarios = calculateStressTest(beta, currentPrice);

    res.json({
      data: {
        crypto: crypto,
        currentPrice: currentPrice,
        beta: Number(beta.toFixed(4)),
        scenarios,
        priceHistory: priceHistory.map(p => ({
          date: p.date,
          price: parseFloat(p.price)
        })),
        period,
        dataPoints: alignedCrypto.length
      }
    });

    log.debug(`Calculated stress test for ${symbol}`);
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
  const [stats] = await Database.execute(`
    SELECT
      skewness,
      kurtosis,
      mean_return,
      std_dev,
      num_observations,
      date
    FROM crypto_distribution_stats
    WHERE crypto_id = ?
      AND window_days = ?
    ORDER BY date DESC
    LIMIT 1
  `, [cryptoId, windowDays]);
  return stats[0] || null;
}

/**
 * Helper: Get historized VaR stats from database
 * @param {number} cryptoId - The crypto ID
 * @param {number|null} windowDays - Window days to filter by, or null for "all" (latest entry regardless of window)
 */
async function getHistorizedVaRStats(cryptoId, windowDays = null) {
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
    query += ' AND window_days = ?';
    params.push(windowDays);
  }

  query += ' ORDER BY date DESC LIMIT 1';

  const [stats] = await Database.execute(query, params);
  return stats[0] || null;
}

/**
 * Helper: Get historized Beta stats from database
 * @param {number} cryptoId - The crypto ID
 * @param {number|null} windowDays - Window days to filter by, or null for latest entry regardless of window
 */
async function getHistorizedBetaStats(cryptoId, windowDays = null) {
  let query = `
    SELECT
      beta,
      alpha,
      r_squared,
      correlation,
      num_observations,
      window_days,
      date
    FROM crypto_beta
    WHERE crypto_id = ?
  `;
  const params = [cryptoId];

  if (windowDays !== null) {
    query += ' AND window_days = ?';
    params.push(windowDays);
  }

  query += ' ORDER BY date DESC LIMIT 1';

  const [stats] = await Database.execute(query, params);
  return stats[0] || null;
}

/**
 * Helper: Get historized SML stats from database
 */
async function getHistorizedSMLStats(cryptoId, windowDays = 90) {
  const [stats] = await Database.execute(`
    SELECT
      beta,
      expected_return,
      actual_return,
      alpha,
      is_overvalued,
      market_return,
      num_observations,
      date
    FROM crypto_sml
    WHERE crypto_id = ?
      AND window_days = ?
    ORDER BY date DESC
    LIMIT 1
  `, [cryptoId, windowDays]);
  return stats[0] || null;
}

/**
 * GET /risk/crypto/:symbol/distribution
 * Returns skewness, kurtosis, and distribution data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:symbol/distribution', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
      });
    }

    // Map period to window days for historized lookup
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const windowDays = windowDaysMap[period] || 90;

    // Try to get historized stats first (for 90d period)
    let skewness, kurtosis, mu, sigma, dataPoints;
    let fromHistorized = false;

    if (period === '90d') {
      const historizedStats = await getHistorizedDistributionStats(crypto.id, windowDays);
      if (historizedStats) {
        skewness = parseFloat(historizedStats.skewness);
        kurtosis = parseFloat(historizedStats.kurtosis);
        mu = parseFloat(historizedStats.mean_return);
        sigma = parseFloat(historizedStats.std_dev);
        dataPoints = historizedStats.num_observations;
        fromHistorized = true;
        log.debug(`Using historized distribution stats for ${symbol} (date: ${historizedStats.date})`);
      }
    }

    // Get log returns for histogram generation (always needed for visualization)
    const dateFilter = getDateFilter(period);
    const returns = await getCryptoLogReturns(crypto.id, dateFilter);

    if (returns.length < 5) {
      return res.json({
        data: {
          crypto: crypto,
          skewness: null,
          kurtosis: null,
          histogram: null,
          normalCurve: null,
          period,
          dataPoints: returns.length,
          msg: 'Insufficient data points for distribution analysis (minimum 5 required)'
        }
      });
    }

    const logReturns = returns.map(r => parseFloat(r.log_return));

    // If not from historized data, calculate on-the-fly
    if (!fromHistorized) {
      skewness = calculateSkewness(logReturns);
      kurtosis = calculateKurtosis(logReturns);
      mu = mean(logReturns);
      sigma = standardDeviation(logReturns);
      dataPoints = logReturns.length;
      log.debug(`Calculated distribution on-the-fly for ${symbol}`);
    }

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
        binStart: Number((binStart * 100).toFixed(4)),
        binEnd: Number((binEnd * 100).toFixed(4)),
        binCenter: Number((binCenter * 100).toFixed(4)),
        count: histogram.counts[i],
        density: Number(((histogram.counts[i] / totalCount) / histogram.binWidth).toFixed(4)),
        normalDensity: normalY ? normalY.y : 0
      });
    }

    // Scale normal curve to match histogram scale
    const normalCurveScaled = normalCurve.map(p => ({
      x: Number((p.x * 100).toFixed(4)),
      y: p.y
    }));

    res.json({
      data: {
        crypto: crypto,
        skewness,
        kurtosis,
        mean: Number((mu * 100).toFixed(4)),
        stdDev: Number((sigma * 100).toFixed(4)),
        histogram: histogramData,
        normalCurve: normalCurveScaled,
        interpretation: {
          skewness: skewness < -0.5 ? 'negative' : skewness > 0.5 ? 'positive' : 'symmetric',
          kurtosis: kurtosis > 1 ? 'leptokurtic' : kurtosis < -1 ? 'platykurtic' : 'mesokurtic'
        },
        period,
        dataPoints,
        fromHistorized
      }
    });

    log.debug(`Distribution for ${symbol}: skew=${skewness}, kurt=${kurtosis}, historized=${fromHistorized}`);
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
 * GET /risk/crypto/:symbol/sml
 * Returns SML positioning data
 * Uses historized data when available, falls back to on-the-fly calculation
 */
api.get('/risk/crypto/:symbol/sml', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
      });
    }

    // Map period to window days
    const windowDaysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const windowDays = windowDaysMap[period] || 90;

    // Try to get historized stats first (for 90d period)
    let smlData, marketReturn, dataPoints;
    let fromHistorized = false;

    if (period === '90d') {
      const historizedStats = await getHistorizedSMLStats(crypto.id, windowDays);
      if (historizedStats) {
        const beta = parseFloat(historizedStats.beta);
        const expectedReturn = parseFloat(historizedStats.expected_return) * 100;
        const actualReturn = parseFloat(historizedStats.actual_return) * 100;
        const alpha = parseFloat(historizedStats.alpha) * 100;
        marketReturn = parseFloat(historizedStats.market_return) * 100;

        // Generate SML line points (from beta 0 to beta 2.5)
        const smlLine = [];
        for (let b = 0; b <= 2.5; b += 0.1) {
          const expReturn = b * marketReturn;
          smlLine.push({
            beta: Number(b.toFixed(1)),
            expectedReturn: Number(expReturn.toFixed(2))
          });
        }

        smlData = {
          cryptoBeta: Number(beta.toFixed(4)),
          cryptoExpectedReturn: Number(expectedReturn.toFixed(2)),
          cryptoActualReturn: Number(actualReturn.toFixed(2)),
          alpha: Number(alpha.toFixed(2)),
          isOvervalued: historizedStats.is_overvalued === 1,
          smlLine
        };
        dataPoints = historizedStats.num_observations;
        fromHistorized = true;
        log.debug(`Using historized SML stats for ${symbol} (date: ${historizedStats.date})`);
      }
    }

    // If not from historized, calculate on-the-fly
    if (!fromHistorized) {
      const dateFilter = getDateFilter(period);
      const cryptoReturns = await getCryptoLogReturns(crypto.id, dateFilter);
      const indexReturns = await getIndexLogReturns(dateFilter);

      if (cryptoReturns.length < 5 || indexReturns.length < 5) {
        return res.json({
          data: {
            crypto: crypto,
            sml: null,
            period,
            dataPoints: 0,
            msg: 'Insufficient data points for SML calculation'
          }
        });
      }

      // Align returns
      const cryptoReturnsByDate = new Map(cryptoReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));
      const indexReturnsByDate = new Map(indexReturns.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));

      const alignedCrypto = [];
      const alignedMarket = [];
      for (const [date, cryptoReturn] of cryptoReturnsByDate) {
        if (indexReturnsByDate.has(date)) {
          alignedCrypto.push(cryptoReturn);
          alignedMarket.push(indexReturnsByDate.get(date));
        }
      }

      if (alignedCrypto.length < 5) {
        return res.json({
          data: {
            crypto: crypto,
            sml: null,
            period,
            dataPoints: alignedCrypto.length,
            msg: 'Insufficient overlapping data points'
          }
        });
      }

      // Calculate beta
      const { beta } = calculateBetaAlpha(alignedCrypto, alignedMarket);

      // Calculate annualized returns
      const cryptoAnnualReturn = calculateAnnualizedReturn(alignedCrypto);
      const marketAnnualReturn = calculateAnnualizedReturn(alignedMarket);

      // Calculate SML data (Rf = 0)
      smlData = calculateSML(beta, cryptoAnnualReturn, marketAnnualReturn, 0);
      marketReturn = Number((marketAnnualReturn * 100).toFixed(2));
      dataPoints = alignedCrypto.length;
      log.debug(`Calculated SML on-the-fly for ${symbol}`);
    }

    res.json({
      data: {
        crypto: crypto,
        ...smlData,
        marketReturn,
        period,
        dataPoints,
        fromHistorized
      }
    });

    log.debug(`SML for ${symbol}: beta=${smlData.cryptoBeta}, alpha=${smlData.alpha}%, historized=${fromHistorized}`);
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
 * GET /risk/crypto/:symbol/summary
 * Returns a summary of all risk metrics for quick loading
 */
api.get('/risk/crypto/:symbol/summary', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '90d' } = req.query;

    const crypto = await getCryptoBySymbol(symbol);
    if (!crypto) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
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

    const dateFilter = getDateFilter(period);
    const cryptoReturns = await getCryptoLogReturns(crypto.id, dateFilter);
    const indexReturns = await getIndexLogReturns(dateFilter);

    // Also fetch 365d returns for VaR/Beta if needed
    let cryptoReturns365 = cryptoReturns;
    let indexReturns365 = indexReturns;
    if (period !== '365d') {
      const dateFilter365 = getDateFilter('365d');
      cryptoReturns365 = await getCryptoLogReturns(crypto.id, dateFilter365);
      indexReturns365 = await getIndexLogReturns(dateFilter365);
    }

    if (cryptoReturns.length < 5) {
      return res.json({
        data: {
          crypto: crypto,
          hasData: false,
          period,
          dataPoints: cryptoReturns.length,
          msg: 'Insufficient data points'
        }
      });
    }

    const logReturns = cryptoReturns.map(r => parseFloat(r.log_return));
    const logReturns365 = cryptoReturns365.map(r => parseFloat(r.log_return));

    // 2. Calculate Basic Metrics with FIXED periods per metric
    // VaR/Beta: 365 days (null = latest entry)
    // Skewness/Kurtosis/SML: 90 days
    let var95, var99, cvar99, skewness, kurtosis;

    // VaR always uses 365 days
    const varStats = await getHistorizedVaRStats(crypto.id, 365);
    if (varStats) {
      var95 = parseFloat(varStats.var_95);
      var99 = parseFloat(varStats.var_99);
      cvar99 = parseFloat(varStats.cvar_99);
    }

    // Skewness/Kurtosis always use 90 days
    const distStats = await getHistorizedDistributionStats(crypto.id, 90);
    if (distStats) {
      skewness = parseFloat(distStats.skewness);
      kurtosis = parseFloat(distStats.kurtosis);
    }

    // Fallback to on-the-fly calculation
    if (var95 === undefined && logReturns365.length >= 5) {
      var95 = calculateVaR(logReturns365, 95);
      var99 = calculateVaR(logReturns365, 99);
      cvar99 = calculateCVaR(logReturns365, 99);
    }
    if (skewness === undefined) {
      skewness = calculateSkewness(logReturns);
      kurtosis = calculateKurtosis(logReturns);
    }

    // 3. Calculate Beta/Alpha & SML & Stress Test
    let beta = null;
    let alpha = null;
    let smlData = null;
    let stressTest = null;

    // Beta always uses 365 days
    const betaStats = await getHistorizedBetaStats(crypto.id, 365);
    if (betaStats) {
      beta = parseFloat(betaStats.beta);
      alpha = Number((parseFloat(betaStats.alpha) * 100).toFixed(4));
    }

    // SML always uses 90 days
    const smlStats = await getHistorizedSMLStats(crypto.id, 90);
    if (smlStats) {
      smlData = {
        alpha: parseFloat(smlStats.alpha) * 100,
        isOvervalued: smlStats.is_overvalued === 1
      };
    }

    // Fallback to on-the-fly calculation for Beta/SML if needed
    if (beta === null && indexReturns365.length >= 7) {
      const cryptoReturnsByDate = new Map(cryptoReturns365.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));
      const indexReturnsByDate = new Map(indexReturns365.map(r => [r.date.toISOString().split('T')[0], parseFloat(r.log_return)]));

      const alignedCrypto = [];
      const alignedMarket = [];
      for (const [date, cryptoReturn] of cryptoReturnsByDate) {
        if (indexReturnsByDate.has(date)) {
          alignedCrypto.push(cryptoReturn);
          alignedMarket.push(indexReturnsByDate.get(date));
        }
      }

      if (alignedCrypto.length >= 7) {
        const result = calculateBetaAlpha(alignedCrypto, alignedMarket);
        beta = result.beta;
        alpha = Number((result.alpha * 100).toFixed(4));

        // SML fallback still uses the current period returns (usually 90d) if requested, 
        // but if no smlData from 90d historized, we'll use whatever returns we have.
        if (!smlData) {
          const cryptoAnnualReturn = calculateAnnualizedReturn(alignedCrypto);
          const marketAnnualReturn = calculateAnnualizedReturn(alignedMarket);
          const smlResult = calculateSML(beta, cryptoAnnualReturn, marketAnnualReturn, 0);
          smlData = {
            alpha: smlResult.alpha,
            isOvervalued: smlResult.isOvervalued
          };
        }
      }
    }

    // Calculate Stress Test (Covid only) - always needs current price and beta
    if (currentPrice > 0 && beta !== null) {
      const scenarios = calculateStressTest(beta, currentPrice);
      const covidScenario = scenarios.find(s => s.id === 'covid-19');
      if (covidScenario) {
        stressTest = {
          newPrice: Number(covidScenario.newPrice.toFixed(2)),
          priceChange: Number(covidScenario.priceChange.toFixed(2)),
          impactPercentage: Number(covidScenario.expectedImpact.toFixed(2))
        };
      }
    }

    // 4. Get Volatility
    const [volatilityHistory] = await Database.execute(`
      SELECT date, daily_volatility, annualized_volatility
      FROM crypto_volatility
      WHERE crypto_id = ?
        AND date >= DATE_SUB(NOW(), INTERVAL 100 DAY)
      ORDER BY date DESC
    `, [crypto.id]);

    const currentVol = volatilityHistory[0] || null;
    let volChanges = null;

    if (currentVol) {
      // Helper to find vol at specific past interval (approximate)
      const getPastVol = (days) => {
        const targetDate = new Date(currentVol.date);
        targetDate.setDate(targetDate.getDate() - days);
        // Find closest date in history (assuming sorted DESC)
        return volatilityHistory.find(v => new Date(v.date) <= targetDate);
      };

      const vol1d = volatilityHistory[1]; // Yesterday (approx)
      const vol7d = getPastVol(7);
      const vol30d = getPastVol(30);
      const vol90d = getPastVol(90);

      const currentAnnualized = parseFloat(currentVol.annualized_volatility);

      const calcChange = (pastVol) => {
        if (!pastVol) return null;
        const pastAnnualized = parseFloat(pastVol.annualized_volatility);

        if (pastAnnualized === 0) return null;

        // Return relative percentage change (e.g. 0.05 for 5%)
        return Number(((currentAnnualized - pastAnnualized) / pastAnnualized).toFixed(4));
      };

      volChanges = {
        '24h': calcChange(vol1d),
        '7d': calcChange(vol7d),
        '30d': calcChange(vol30d),
        '90d': calcChange(vol90d)
      };
    }

    res.json({
      data: {
        crypto: crypto,
        hasData: true,
        price: {
          current: currentPrice,
          changes: priceChanges
        },
        volatility: currentVol ? {
          daily: Number((parseFloat(currentVol.daily_volatility) * 100).toFixed(2)),
          annualized: Number((parseFloat(currentVol.annualized_volatility) * 100).toFixed(2)),
          changes: volChanges ? {
            '24h': volChanges['24h'] ? Number((volChanges['24h'] * 100).toFixed(2)) : null,
            '7d': volChanges['7d'] ? Number((volChanges['7d'] * 100).toFixed(2)) : null,
            '30d': volChanges['30d'] ? Number((volChanges['30d'] * 100).toFixed(2)) : null,
            '90d': volChanges['90d'] ? Number((volChanges['90d'] * 100).toFixed(2)) : null
          } : null
        } : null,
        beta,
        alpha, // Regression Alpha
        sml: smlData ? {
          alpha: smlData.alpha, // Jensen's Alpha
          isOvervalued: smlData.isOvervalued
        } : null,
        var95: Number((var95 * 100).toFixed(2)),
        var99: Number((var99 * 100).toFixed(2)),
        cvar99: Number((cvar99 * 100).toFixed(2)),
        stressTest,
        skewness,
        kurtosis,
        period,
        dataPoints: logReturns.length
      }
    });

    log.debug(`Fetched risk summary for ${symbol}`);
  } catch (error) {
    log.error(`Error fetching risk summary: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch risk summary'
    });
  }
});
