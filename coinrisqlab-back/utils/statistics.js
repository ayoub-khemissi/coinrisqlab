/**
 * Statistical utilities for volatility calculations
 */

/**
 * Calculate the mean (average) of an array of numbers
 * @param {number[]} values - Array of numbers
 * @returns {number} Mean value
 */
export function mean(values) {
  if (!values || values.length === 0) {
    return 0;
  }
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate the sample variance of an array of numbers (using n-1 for unbiased estimator)
 * @param {number[]} values - Array of numbers
 * @param {number} [meanValue] - Pre-calculated mean (optional)
 * @returns {number} Sample variance
 */
export function variance(values, meanValue = null) {
  if (!values || values.length < 2) {
    return 0;
  }

  const mu = meanValue !== null ? meanValue : mean(values);
  const squaredDiffs = values.reduce((sum, val) => sum + Math.pow(val - mu, 2), 0);
  return squaredDiffs / (values.length - 1);
}

/**
 * Calculate the standard deviation of an array of numbers
 * @param {number[]} values - Array of numbers
 * @param {number} [meanValue] - Pre-calculated mean (optional)
 * @returns {number} Standard deviation
 */
export function standardDeviation(values, meanValue = null) {
  return Math.sqrt(variance(values, meanValue));
}

/**
 * Calculate logarithmic return: ln(price_t / price_t-1)
 * @param {number} currentPrice - Current price
 * @param {number} previousPrice - Previous price
 * @returns {number} Logarithmic return
 */
export function logReturn(currentPrice, previousPrice) {
  if (previousPrice <= 0 || currentPrice <= 0) {
    return 0;
  }
  return Math.log(currentPrice / previousPrice);
}

/**
 * Annualize volatility (daily to annual)
 * @param {number} dailyVolatility - Daily volatility (standard deviation)
 * @param {number} [tradingDays=365] - Number of trading days per year
 * @returns {number} Annualized volatility
 */
export function annualizeVolatility(dailyVolatility, tradingDays = 365) {
  return dailyVolatility * Math.sqrt(tradingDays);
}

/**
 * Calculate sample covariance between two arrays of returns (using n-1 for unbiased estimator)
 * @param {number[]} returns1 - Array of returns for asset 1
 * @param {number[]} returns2 - Array of returns for asset 2
 * @returns {number} Sample covariance
 */
export function covariance(returns1, returns2) {
  if (!returns1 || !returns2 || returns1.length !== returns2.length || returns1.length < 2) {
    return 0;
  }

  const mean1 = mean(returns1);
  const mean2 = mean(returns2);

  let cov = 0;
  for (let i = 0; i < returns1.length; i++) {
    cov += (returns1[i] - mean1) * (returns2[i] - mean2);
  }

  return cov / (returns1.length - 1);
}

/**
 * Build a covariance matrix for multiple assets
 * @param {Array<{id: number, returns: number[]}>} assets - Array of assets with their returns
 * @returns {number[][]} Covariance matrix
 */
export function buildCovarianceMatrix(assets) {
  const n = assets.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        // Diagonal: variance
        matrix[i][j] = variance(assets[i].returns);
      } else {
        // Off-diagonal: covariance
        matrix[i][j] = covariance(assets[i].returns, assets[j].returns);
      }
    }
  }

  return matrix;
}

/**
 * Calculate portfolio volatility using weights and covariance matrix
 * Formula: sqrt(w^T * Σ * w)
 * @param {number[]} weights - Array of portfolio weights (must sum to 1)
 * @param {number[][]} covMatrix - Covariance matrix
 * @returns {number} Portfolio volatility
 */
export function portfolioVolatility(weights, covMatrix) {
  const n = weights.length;

  if (covMatrix.length !== n || covMatrix[0].length !== n) {
    throw new Error('Covariance matrix dimensions must match number of weights');
  }

  // Calculate w^T * Σ * w
  let variance = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * covMatrix[i][j];
    }
  }

  // Return standard deviation (volatility)
  return Math.sqrt(variance);
}

/**
 * Validate that weights sum to approximately 1.0 (allowing for small rounding errors)
 * @param {number[]} weights - Array of weights
 * @param {number} [tolerance=0.0001] - Tolerance for rounding errors
 * @returns {boolean} True if weights are valid
 */
export function validateWeights(weights, tolerance = 0.0001) {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < tolerance;
}
