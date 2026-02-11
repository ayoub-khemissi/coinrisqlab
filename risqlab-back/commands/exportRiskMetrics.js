import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DAYS = 10;

/**
 * Export the last 10 days of risk metrics for specified cryptos by coingecko_id
 * Usage: node commands/exportRiskMetrics.js bitcoin rain ethereum
 *
 * Tables exported (one sheet/section per table):
 *   crypto_beta, crypto_distribution_stats, crypto_log_returns,
 *   crypto_sml, crypto_var, crypto_volatility
 *
 * Output: one CSV file per metric table, all placed in exports/
 */

const METRIC_TABLES = [
  {
    name: 'beta',
    table: 'crypto_beta',
    columns: ['beta', 'alpha', 'r_squared', 'correlation'],
  },
  {
    name: 'distribution_stats',
    table: 'crypto_distribution_stats',
    columns: ['skewness', 'kurtosis', 'mean_return', 'std_dev'],
  },
  {
    name: 'log_returns',
    table: 'crypto_log_returns',
    columns: ['log_return', 'price_current', 'price_previous'],
  },
  {
    name: 'sml',
    table: 'crypto_sml',
    columns: ['beta', 'expected_return', 'actual_return', 'alpha', 'is_overvalued', 'market_return'],
  },
  {
    name: 'var',
    table: 'crypto_var',
    columns: ['var_95', 'var_99', 'cvar_95', 'cvar_99', 'mean_return', 'std_dev', 'min_return', 'max_return'],
  },
  {
    name: 'volatility',
    table: 'crypto_volatility',
    columns: ['daily_volatility', 'annualized_volatility', 'mean_return'],
  },
];

async function exportRiskMetrics(coingeckoIds) {
  const startTime = Date.now();

  try {
    if (!coingeckoIds || coingeckoIds.length === 0) {
      throw new Error('Usage: node commands/exportRiskMetrics.js <coingecko_id1> <coingecko_id2> ...');
    }

    log.info(`Starting risk metrics export for: ${coingeckoIds.join(', ')}`);

    // 1. Look up cryptos by coingecko_id
    const placeholders = coingeckoIds.map(() => '?').join(',');
    const [cryptos] = await Database.execute(
      `SELECT id as crypto_id, symbol, name, coingecko_id
       FROM cryptocurrencies
       WHERE coingecko_id IN (${placeholders})`,
      coingeckoIds
    );

    if (cryptos.length === 0) {
      throw new Error('No cryptos found for the given coingecko_ids');
    }

    // Warn about missing cryptos
    const foundIds = new Set(cryptos.map(c => c.coingecko_id));
    const missing = coingeckoIds.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      log.warn(`coingecko_ids not found: ${missing.join(', ')}`);
    }

    // Preserve command-line order
    const orderedCryptos = [];
    for (const id of coingeckoIds) {
      const crypto = cryptos.find(c => c.coingecko_id === id);
      if (crypto) orderedCryptos.push(crypto);
    }

    log.info(`Selected cryptos: ${orderedCryptos.map(c => c.symbol).join(', ')}`);

    const cryptoIds = orderedCryptos.map(c => c.crypto_id);
    const cryptoIdPlaceholders = cryptoIds.map(() => '?').join(',');

    // 2. Prepare export directory
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const files = [];

    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    // 3. Export each metric table
    for (const metric of METRIC_TABLES) {
      log.info(`Exporting ${metric.name}...`);

      // Get last DAYS distinct dates for this table and these cryptos
      const [dates] = await Database.execute(
        `SELECT DISTINCT date
         FROM ${metric.table}
         WHERE crypto_id IN (${cryptoIdPlaceholders})
         ORDER BY date DESC
         LIMIT ${DAYS}`,
        [...cryptoIds]
      );

      if (dates.length === 0) {
        log.warn(`No data found in ${metric.table} for selected cryptos, skipping`);
        continue;
      }

      const sortedDates = dates.map(d => {
        const dt = d.date instanceof Date ? d.date : new Date(d.date);
        return dt.toISOString().split('T')[0];
      }).sort();

      const minDate = sortedDates[0];
      const maxDate = sortedDates[sortedDates.length - 1];

      // Fetch all data for the date range
      const selectCols = metric.columns.map(c => `t.${c}`).join(', ');
      const [rows] = await Database.execute(
        `SELECT t.crypto_id, t.date, ${selectCols}
         FROM ${metric.table} t
         WHERE t.crypto_id IN (${cryptoIdPlaceholders})
           AND t.date >= ?
           AND t.date <= ?
         ORDER BY t.date ASC`,
        [...cryptoIds, minDate, maxDate]
      );

      // Build lookup: crypto_id + date + column -> value
      const dataMap = new Map();
      for (const row of rows) {
        const dateKey = row.date instanceof Date
          ? row.date.toISOString().split('T')[0]
          : new Date(row.date).toISOString().split('T')[0];
        for (const col of metric.columns) {
          const key = `${row.crypto_id}_${dateKey}_${col}`;
          dataMap.set(key, row[col]);
        }
      }

      // Build CSV: one row per crypto per column, dates as columns
      let csvContent = '';

      // Header
      csvContent += 'Symbol;Name;Metric';
      for (const date of sortedDates) {
        csvContent += `;${date}`;
      }
      csvContent += '\n';

      // Data rows
      for (const crypto of orderedCryptos) {
        for (const col of metric.columns) {
          csvContent += `${crypto.symbol};${crypto.name};${col}`;
          for (const date of sortedDates) {
            const key = `${crypto.crypto_id}_${date}_${col}`;
            const value = dataMap.get(key);
            csvContent += `;${value !== undefined ? formatNumber(value) : ''}`;
          }
          csvContent += '\n';
        }
      }

      const filename = `RiskMetrics_${metric.name}_${sortedDates.length}days_${timestamp}.csv`;
      const filepath = path.join(exportDir, filename);
      fs.writeFileSync(filepath, csvContent, 'utf8');
      files.push(filepath);

      log.info(`  -> ${filename} (${orderedCryptos.length} cryptos x ${metric.columns.length} metrics x ${sortedDates.length} days)`);
    }

    const duration = Date.now() - startTime;
    log.info(`Risk metrics export completed in ${duration}ms`);
    log.info(`${files.length} files exported`);

    return files;

  } catch (error) {
    log.error(`Error exporting risk metrics: ${error.message}`);
    throw error;
  }
}

// Parse command-line arguments
const coingeckoIds = process.argv.slice(2);

exportRiskMetrics(coingeckoIds)
  .then((files) => {
    log.info('Export command completed successfully');
    files.forEach(f => log.info(`  ${f}`));
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
