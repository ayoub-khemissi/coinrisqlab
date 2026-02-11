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
    beta: Number(beta.toFixed(4)),
    alpha: Number(alpha.toFixed(6)),
    rSquared: Number(rSquared.toFixed(4)),
    correlation: Number(correlation.toFixed(4))
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
  const index = Math.floor((percentile / 100) * sorted.length);

  // Return as positive number (represents potential loss)
  return -sorted[Math.max(0, index)];
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
  const cutoffIndex = Math.floor((percentile / 100) * sorted.length);

  // Average of returns in the tail
  const tailReturns = sorted.slice(0, Math.max(1, cutoffIndex + 1));
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

  return Number(skewness.toFixed(4));
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

  return Number(kurtosis.toFixed(4));
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
    bins.push(Number((min + i * binWidth).toFixed(6)));
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
    binWidth: Number(binWidth.toFixed(6)),
    min: Number(min.toFixed(6)),
    max: Number(max.toFixed(6))
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
      x: Number(x.toFixed(6)),
      y: Number(y.toFixed(6))
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
 * @param {Array<{ id: string, name: string, shock: number, startDate: string, endDate: string, description: string }>} scenarios - Stress scenarios
 * @returns {Array<{ id: string, name: string, marketShock: number, expectedImpact: number, newPrice: number, priceChange: number, startDate: string, endDate: string, description: string }>}
 */
export function calculateStressTest(beta, currentPrice, scenarios = null) {
  const defaultScenarios = [
    {
      id: 'covid-19',
      name: 'Covid-19',
      shock: -0.5042,
      startDate: '2020-02-20',
      endDate: '2020-03-13',
      description: 'Global pandemic market crash'
    },
    {
      id: 'china-mining-ban',
      name: 'Ban Mining China',
      shock: -0.2507,
      startDate: '2021-05-12',
      endDate: '2021-05-23',
      description: 'China cryptocurrency mining ban'
    },
    {
      id: 'ust-crash',
      name: 'Crash UST',
      shock: -0.0473,
      startDate: '2022-05-07',
      endDate: '2022-05-12',
      description: 'Terra/Luna stablecoin collapse'
    },
    {
      id: 'ftx-crash',
      name: 'Crash FTX',
      shock: -0.0264,
      startDate: '2022-11-05',
      endDate: '2022-11-09',
      description: 'FTX exchange collapse'
    }
  ];

  const scenariosToUse = scenarios || defaultScenarios;

  return scenariosToUse.map(scenario => {
    const expectedImpact = beta * scenario.shock;
    const newPrice = currentPrice * (1 + expectedImpact);
    const priceChange = newPrice - currentPrice;

    return {
      id: scenario.id,
      name: scenario.name,
      marketShock: Number((scenario.shock * 100).toFixed(2)),
      expectedImpact: Number((expectedImpact * 100).toFixed(2)),
      newPrice: newPrice,
      priceChange: priceChange,
      startDate: scenario.startDate,
      endDate: scenario.endDate,
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
      beta: Number(beta.toFixed(1)),
      expectedReturn: Number((expectedReturn * 100).toFixed(2))
    });
  }

  return {
    cryptoBeta: Number(cryptoBeta.toFixed(4)),
    cryptoExpectedReturn: Number((cryptoExpectedReturn * 100).toFixed(2)),
    cryptoActualReturn: Number((cryptoActualReturn * 100).toFixed(2)),
    alpha: Number((alpha * 100).toFixed(2)),
    isOvervalued,
    smlLine
  };
}

/**
 * Calculate annualized return from array of log returns
 *
 * @param {number[]} logReturns - Array of daily log returns
 * @param {number} tradingDays - Trading days per year (default: 365)
 * @returns {number} Annualized return
 */
export function calculateAnnualizedReturn(logReturns, tradingDays = 365) {
  if (!logReturns || logReturns.length === 0) {
    return 0;
  }

  // Sum of log returns = total log return
  const totalLogReturn = logReturns.reduce((sum, r) => sum + r, 0);

  // Daily average return
  const dailyReturn = totalLogReturn / logReturns.length;

  // Annualize
  const annualizedReturn = dailyReturn * tradingDays;

  return annualizedReturn;
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
