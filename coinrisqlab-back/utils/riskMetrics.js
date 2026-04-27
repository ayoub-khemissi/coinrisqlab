/**
 * Risk metrics calculation utilities
 * Includes: Beta/Alpha, VaR, Skewness, Kurtosis, Stress Tests, SML
 */

import { mean, variance, standardDeviation, covariance } from './statistics.js';

/**
 * Calculate Beta and Alpha using linear regression (OLS)
 * Beta = Cov(Rcrypto, Rmarket) / Var(Rmarket)
 * Alpha = mean(Rcrypto) - Beta * mean(Rmarket)
 * R² = correlation²
 *
 * @param {number[]} cryptoReturns - Array of crypto log returns
 * @param {number[]} marketReturns - Array of market (index) log returns
 * @returns {{ beta: number, alpha: number, rSquared: number, correlation: number }}
 */
export function calculateBetaAlpha(cryptoReturns, marketReturns) {
  if (!cryptoReturns || !marketReturns || cryptoReturns.length < 2 || marketReturns.length < 2) {
    return { beta: 0, alpha: 0, rSquared: 0, correlation: 0 };
  }

  // Ensure same length
  const n = Math.min(cryptoReturns.length, marketReturns.length);
  const crypto = cryptoReturns.slice(0, n);
  const market = marketReturns.slice(0, n);

  const meanCrypto = mean(crypto);
  const meanMarket = mean(market);
  const varMarket = variance(market, meanMarket);
  const cov = covariance(crypto, market);

  // Avoid division by zero
  if (varMarket === 0) {
    return { beta: 0, alpha: 0, rSquared: 0, correlation: 0 };
  }

  const beta = cov / varMarket;
  const alpha = meanCrypto - beta * meanMarket;

  // Calculate R² (coefficient of determination)
  const stdCrypto = standardDeviation(crypto, meanCrypto);
  const stdMarket = standardDeviation(market, meanMarket);

  let correlation = 0;
  if (stdCrypto > 0 && stdMarket > 0) {
    correlation = cov / (stdCrypto * stdMarket);
  }
  const rSquared = correlation * correlation;

  return {
    beta: beta,
    alpha: alpha,
    rSquared: rSquared,
    correlation: correlation
  };
}

/**
 * Calculate historical Value at Risk (VaR)
 * VaR = -percentile(returns, 100 - confidence)
 *
 * @param {number[]} logReturns - Array of log returns
 * @param {number} confidenceLevel - Confidence level (e.g., 95 or 99)
 * @returns {number} VaR as a positive number (loss)
 */
export function calculateVaR(logReturns, confidenceLevel = 95) {
  if (!logReturns || logReturns.length < 2) {
    return 0;
  }

  // Sort returns ascending
  const sorted = [...logReturns].sort((a, b) => a - b);
  const percentile = 100 - confidenceLevel;
  // Use floor then -1 to take the lower observation (like numpy method='lower')
  // e.g. 365 × 0.05 = 18.25 → floor = 18 → index 17 = 18th observation
  const index = Math.max(0, Math.floor((percentile / 100) * sorted.length) - 1);

  // Return as positive number (represents potential loss)
  return -sorted[index];
}

/**
 * Calculate Conditional VaR (CVaR) / Expected Shortfall
 * Average of returns below the VaR threshold
 *
 * @param {number[]} logReturns - Array of log returns
 * @param {number} confidenceLevel - Confidence level (e.g., 95 or 99)
 * @returns {number} CVaR as a positive number
 */
export function calculateCVaR(logReturns, confidenceLevel = 95) {
  if (!logReturns || logReturns.length < 2) {
    return 0;
  }

  const sorted = [...logReturns].sort((a, b) => a - b);
  const percentile = 100 - confidenceLevel;
  const cutoffIndex = Math.max(0, Math.floor((percentile / 100) * sorted.length) - 1);

  // Average of returns in the tail (up to and including the cutoff observation)
  const tailReturns = sorted.slice(0, cutoffIndex + 1);
  const avgTail = mean(tailReturns);

  return -avgTail;
}

/**
 * Calculate Skewness (Fisher's definition)
 * Measures asymmetry of the distribution
 * Skewness = E[(X - μ)³] / σ³
 *
 * @param {number[]} values - Array of values
 * @returns {number} Skewness value
 */
export function calculateSkewness(values) {
  if (!values || values.length < 3) {
    return 0;
  }

  const n = values.length;
  const mu = mean(values);
  const sigma = standardDeviation(values, mu);

  if (sigma === 0) {
    return 0;
  }

  // Calculate third central moment
  let m3 = 0;
  for (const val of values) {
    m3 += Math.pow((val - mu) / sigma, 3);
  }

  // Apply bias correction for sample skewness
  const skewness = (n / ((n - 1) * (n - 2))) * m3;

  return skewness;
}

/**
 * Calculate Excess Kurtosis (Fisher's definition)
 * Measures "tailedness" of the distribution
 * Excess Kurtosis = E[(X - μ)⁴] / σ⁴ - 3
 * Normal distribution has excess kurtosis = 0
 *
 * @param {number[]} values - Array of values
 * @returns {number} Excess kurtosis value
 */
export function calculateKurtosis(values) {
  if (!values || values.length < 4) {
    return 0;
  }

  const n = values.length;
  const mu = mean(values);
  const sigma = standardDeviation(values, mu);

  if (sigma === 0) {
    return 0;
  }

  // Calculate sum of fourth powers (not divided by n - the formula handles normalization)
  let m4 = 0;
  for (const val of values) {
    m4 += Math.pow((val - mu) / sigma, 4);
  }

  // Apply bias correction for sample excess kurtosis (Fisher's formula)
  const kurtosis = ((n + 1) * n / ((n - 1) * (n - 2) * (n - 3))) * m4 -
                   (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));

  return kurtosis;
}

/**
 * Generate histogram bins from an array of values
 *
 * @param {number[]} values - Array of values
 * @param {number} numBins - Number of bins (default: 30)
 * @returns {{ bins: number[], counts: number[], binWidth: number, min: number, max: number }}
 */
export function generateHistogramBins(values, numBins = 30) {
  if (!values || values.length === 0) {
    return { bins: [], counts: [], binWidth: 0, min: 0, max: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Add small padding to include edge values
  const range = max - min || 1;
  const binWidth = range / numBins;

  const bins = [];
  const counts = Array(numBins).fill(0);

  // Create bin edges
  for (let i = 0; i <= numBins; i++) {
    bins.push((min + i * binWidth));
  }

  // Count values in each bin
  for (const val of values) {
    let binIndex = Math.floor((val - min) / binWidth);
    // Handle edge case where val === max
    if (binIndex >= numBins) {
      binIndex = numBins - 1;
    }
    counts[binIndex]++;
  }

  return {
    bins,
    counts,
    binWidth: binWidth,
    min: min,
    max: max
  };
}

/**
 * Generate normal distribution curve points for overlay
 *
 * @param {number} mu - Mean
 * @param {number} sigma - Standard deviation
 * @param {number} min - Minimum x value
 * @param {number} max - Maximum x value
 * @param {number} points - Number of points (default: 100)
 * @returns {Array<{ x: number, y: number }>}
 */
export function generateNormalCurve(mu, sigma, min, max, points = 100) {
  if (sigma === 0) {
    return [];
  }

  const curve = [];
  const step = (max - min) / points;

  for (let i = 0; i <= points; i++) {
    const x = min + i * step;
    // Normal distribution PDF: (1 / (σ√(2π))) * e^(-(x-μ)²/(2σ²))
    const exponent = -Math.pow(x - mu, 2) / (2 * Math.pow(sigma, 2));
    const y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(exponent);

    curve.push({
      x: x,
      y: y
    });
  }

  return curve;
}

/**
 * Calculate stress test scenarios based on historical market crises
 * Impact = Beta × Market Shock
 *
 * @param {number} beta - Crypto beta relative to market
 * @param {number} currentPrice - Current crypto price
 * @param {Array<{ id: string, name: string, shock: number, startDate: string, endDate: string, durationDays: number, description: string }>} scenarios - Stress scenarios
 * @returns {Array<{ id: string, name: string, marketShock: number, expectedImpact: number, newPrice: number, priceChange: number, startDate: string, endDate: string, durationDays: number, description: string }>}
 */
export function calculateStressTest(beta, currentPrice, scenarios = null) {
  const defaultScenarios = [
    {
      id: 'covid-19',
      name: 'Covid-19',
      shock: -0.5164,
      startDate: '2020-02-20',
      endDate: '2020-03-13',
      durationDays: 22,
      description: 'Global pandemic market crash'
    },
    {
      id: 'china-mining-ban',
      name: 'Ban Mining China',
      shock: -0.3687,
      startDate: '2021-05-12',
      endDate: '2021-05-23',
      durationDays: 11,
      description: 'China cryptocurrency mining ban'
    },
    {
      id: 'ust-crash',
      name: 'Crash UST',
      shock: -0.2428,
      startDate: '2022-05-07',
      endDate: '2022-05-12',
      durationDays: 5,
      description: 'Terra/Luna stablecoin collapse'
    },
    {
      id: 'ftx-crash',
      name: 'Crash FTX',
      shock: -0.1270,
      startDate: '2022-10-31',
      endDate: '2022-11-04',
      durationDays: 4,
      description: 'FTX exchange collapse'
    }
  ];

  const scenariosToUse = scenarios || defaultScenarios;

  return scenariosToUse.map(scenario => {
    // A negative beta would otherwise produce a fake gain in a crash
    // (negative × negative = positive). In a catastrophe scenario all betas
    // tend toward 1 in practice, so we apply the raw market shock instead of
    // amplifying or dampening it for negative-beta assets.
    const effectiveBeta = beta < 0 ? 1 : beta;
    // Cap the loss at 100%: a high-beta asset (e.g. β=2 with a -50% shock)
    // would mathematically project a -100%+ loss, which is impossible — an
    // asset can lose at most its full value.
    const expectedImpact = Math.max(effectiveBeta * scenario.shock, -1);
    const newPrice = currentPrice * (1 + expectedImpact);
    const priceChange = newPrice - currentPrice;

    return {
      id: scenario.id,
      name: scenario.name,
      marketShock: (scenario.shock * 100),
      expectedImpact: (expectedImpact * 100),
      newPrice: newPrice,
      priceChange: priceChange,
      startDate: scenario.startDate,
      endDate: scenario.endDate,
      durationDays: scenario.durationDays,
      description: scenario.description
    };
  });
}

/**
 * Calculate Security Market Line (SML) data
 * E(R) = Rf + β × (Rm - Rf)
 * With Rf = 0 (simplified): E(R) = β × Rm
 *
 * @param {number} cryptoBeta - Crypto's beta
 * @param {number} cryptoActualReturn - Crypto's actual annualized return
 * @param {number} marketReturn - Market's annualized return
 * @param {number} riskFreeRate - Risk-free rate (default: 0)
 * @returns {{ cryptoBeta: number, cryptoExpectedReturn: number, cryptoActualReturn: number, alpha: number, isOvervalued: boolean, smlLine: Array<{ beta: number, expectedReturn: number }> }}
 */
export function calculateSML(cryptoBeta, cryptoActualReturn, marketReturn, riskFreeRate = 0) {
  // Expected return according to CAPM
  const cryptoExpectedReturn = riskFreeRate + cryptoBeta * (marketReturn - riskFreeRate);

  // Jensen's Alpha (actual - expected)
  const alpha = cryptoActualReturn - cryptoExpectedReturn;

  // Is the crypto overvalued? (actual return < expected return means it's overvalued)
  const isOvervalued = cryptoActualReturn < cryptoExpectedReturn;

  // Generate SML line points (from beta 0 to beta 2.5)
  const smlLine = [];
  for (let beta = 0; beta <= 2.5; beta += 0.1) {
    const expectedReturn = riskFreeRate + beta * (marketReturn - riskFreeRate);
    smlLine.push({
      beta: beta,
      expectedReturn: (expectedReturn * 100)
    });
  }

  return {
    cryptoBeta: cryptoBeta,
    cryptoExpectedReturn: (cryptoExpectedReturn * 100),
    cryptoActualReturn: (cryptoActualReturn * 100),
    alpha: (alpha * 100),
    isOvervalued,
    smlLine
  };
}

/**
 * Calculate mean daily return from array of log returns
 *
 * @param {number[]} logReturns - Array of daily log returns
 * @returns {number} Mean daily return
 */
export function calculateAnnualizedReturn(logReturns) {
  if (!logReturns || logReturns.length === 0) {
    return 0;
  }

  return logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;
}

/**
 * Calculate Sharpe Ratio
 * S = (Rp - Rf) / σp
 * Using daily returns: annualized via √365
 *
 * @param {number[]} logReturns - Array of daily log returns
 * @param {number} riskFreeRate - Annual risk-free rate (default: 0)
 * @returns {number} Sharpe ratio (annualized)
 */
export function calculateSharpeRatio(logReturns, riskFreeRate = 0) {
  if (!logReturns || logReturns.length < 2) {
    return 0;
  }

  const meanReturn = mean(logReturns);
  const stdReturn = standardDeviation(logReturns);

  if (stdReturn === 0) {
    return 0;
  }

  // Daily risk-free rate from annual
  const dailyRf = riskFreeRate / 365;

  // Sharpe = (mean daily return - daily Rf) / daily std * √365
  return (((meanReturn - dailyRf) / stdReturn) * Math.sqrt(365));
}

/**
 * Percentile calculation helper
 *
 * @param {number[]} values - Sorted array of values
 * @param {number} p - Percentile (0-100)
 * @returns {number}
 */
export function percentile(values, p) {
  if (!values || values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) {
    return sorted[sorted.length - 1];
  }

  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}
