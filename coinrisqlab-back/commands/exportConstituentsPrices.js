import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export historical prices for portfolio volatility constituents
 * - Uses the same crypto list as the frontend (from portfolio_volatility_constituents)
 * - Retrieves prices from market_data for the window period
 * Output: CSV file with columns:
 *   Rank, Symbol, Name, Weight, then for each date: Date_Price
 */
async function exportConstituentsPrices() {
  const startTime = Date.now();

  try {
    log.info('Starting constituents prices export...');

    // 1. Get the latest portfolio volatility record (same as frontend API)
    const [pvRecords] = await Database.execute(`
      SELECT pv.id, pv.date, pv.window_days, pv.index_config_id
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (pvRecords.length === 0) {
      throw new Error('No portfolio volatility data found');
    }

    const { id: pvId, date: pvDate, window_days: windowDays } = pvRecords[0];
    const pvDateStr = pvDate instanceof Date
      ? pvDate.toISOString().split('T')[0]
      : new Date(pvDate).toISOString().split('T')[0];

    log.info(`Using portfolio volatility from ${pvDateStr} (${windowDays} days window)`);

    // 2. Get constituents from portfolio_volatility_constituents (same source as frontend)
    const [constituents] = await Database.execute(`
      SELECT
        pvc.crypto_id,
        c.symbol,
        c.name,
        pvc.weight,
        pvc.annualized_volatility,
        pvc.market_cap_usd
      FROM portfolio_volatility_constituents pvc
      INNER JOIN cryptocurrencies c ON pvc.crypto_id = c.id
      WHERE pvc.portfolio_volatility_id = ?
      ORDER BY pvc.weight DESC
    `, [pvId]);

    log.info(`Found ${constituents.length} constituents from volatility calculation`);

    if (constituents.length === 0) {
      throw new Error('No constituents found in portfolio volatility');
    }

    const cryptoIds = constituents.map(c => c.crypto_id);

    // 3. Get historical prices for constituents from market_data (D-1 to D-1-window, excludes today)
    const [pricesData] = await Database.execute(`
      SELECT
        md.crypto_id,
        md.price_date,
        md.price_usd
      FROM market_data md
      WHERE md.crypto_id IN (${cryptoIds.join(',')})
        AND md.price_date > DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 1 DAY), INTERVAL ${windowDays} DAY)
        AND md.price_date <= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        AND md.timestamp = (
          SELECT MAX(md2.timestamp)
          FROM market_data md2
          WHERE md2.crypto_id = md.crypto_id
            AND md2.price_date = md.price_date
        )
      ORDER BY md.price_date ASC
    `);

    log.info(`Retrieved ${pricesData.length} price records`);

    // 4. Build a map for quick lookup: crypto_id + date -> price
    const dataMap = new Map();
    const datesSet = new Set();

    for (const row of pricesData) {
      const dateKey = row.price_date instanceof Date
        ? row.price_date.toISOString().split('T')[0]
        : new Date(row.price_date).toISOString().split('T')[0];
      const key = `${row.crypto_id}_${dateKey}`;
      dataMap.set(key, row);
      datesSet.add(dateKey);
    }

    const sortedDates = [...datesSet].sort();

    // 5. Build CSV content
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    let csvContent = '';

    // Header row: Rank;Symbol;Name;Weight;Date1_Price;Date2_Price;...
    csvContent += 'Rank;Symbol;Name;Weight';
    for (const date of sortedDates) {
      csvContent += `;${date}_Price`;
    }
    csvContent += '\n';

    // Data rows: one per constituent (sorted by weight desc)
    constituents.forEach((crypto, index) => {
      csvContent += `${index + 1};${crypto.symbol};${crypto.name};${formatNumber(crypto.weight)}`;

      for (const date of sortedDates) {
        const key = `${crypto.crypto_id}_${date}`;
        const data = dataMap.get(key);
        csvContent += `;${data ? formatNumber(data.price_usd) : ''}`;
      }
      csvContent += '\n';
    });

    // 6. Write to file
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Constituents_Prices_${windowDays}days_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Constituents prices exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Exported ${constituents.length} cryptos x ${sortedDates.length} days`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting constituents prices: ${error.message}`);
    throw error;
  }
}

// Run the command
exportConstituentsPrices()
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
