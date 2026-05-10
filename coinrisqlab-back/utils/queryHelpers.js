/**
 * SQL Query Helpers
 * Shared utilities for building SQL queries across routes
 */

/**
 * Get SQL date filter clause based on period
 * @param {string} period - Period identifier ('24h', '7d', '30d', '90d', '365d', 'all')
 * @param {string} dateColumn - Column name to filter on (default: 'date')
 * @param {number} extraDays - Days of buffer added before the period start.
 *   Use this when the consumer needs the day BEFORE the period start (e.g.
 *   the Performance vs Index chart uses one extra anchor day so the 30-day
 *   period actually shows 30 daily returns rather than 29).
 * @returns {string} SQL WHERE clause fragment (starts with AND)
 */
export function getDateFilter(period, dateColumn = 'date', extraDays = 0) {
  const buf = Math.max(0, extraDays);
  switch (period) {
    case '24h':
      return `AND ${dateColumn} >= DATE_SUB(NOW(), INTERVAL ${1 + buf} DAY)`;
    case '7d':
      return `AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL ${7 + buf} DAY)`;
    case '30d':
      return `AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL ${30 + buf} DAY)`;
    case '90d':
      return `AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL ${90 + buf} DAY)`;
    case '365d':
      return `AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL ${365 + buf} DAY)`;
    case 'all':
      return ''; // No date filter for 'all'
    default:
      return `AND ${dateColumn} >= DATE_SUB(CURDATE(), INTERVAL ${90 + buf} DAY)`;
  }
}

/**
 * Get target number of data points for chart visualization based on period
 * Used for intelligent downsampling of time series data
 * @param {string} period - Period identifier ('24h', '7d', '30d', '90d', 'all')
 * @returns {number} Target number of data points
 */
export function getMaxDataPoints(period) {
  switch (period) {
    case '24h':
      return 100;  // ~100 points for 24 hours
    case '7d':
      return 200;  // ~200 points for 7 days
    case '30d':
      return 300;  // ~300 points for 30 days
    case '90d':
      return 350;  // ~350 points for 90 days
    case 'all':
      return 400;  // ~400 points for all data
    default:
      return 300;
  }
}
