import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRICE_DAYS = 91; // 91 prices to calculate 90 returns

/**
 * Export historical prices for 3 random cryptos that have NEVER been in the top 80
 * - Selects cryptos that have never appeared in portfolio_volatility_constituents
 * - Only selects cryptos with complete price data for the last 91 days (D-1 to D-91)
 * - Retrieves closing prices from ohlc table
 * Output: CSV file with columns:
 *   Symbol, Name, then for each date: Date_Price
 */
async function exportRandomNonTop80Prices() {
  const startTime = Date.now();

  try {
    log.info('Starting random non-top80 prices export...');

    // 1. Get the 91 most recent dates available in ohlc (D-1 to D-91)
    const [allDates] = await Database.execute(`
      SELECT DISTINCT DATE(timestamp) as price_date
      FROM ohlc
      WHERE DATE(timestamp) < CURDATE()
      ORDER BY price_date DESC
      LIMIT ${PRICE_DAYS}
    `);

    const expectedDateCount = allDates.length;
    log.info(`Found ${expectedDateCount} distinct dates in ohlc (last ${PRICE_DAYS} days up to D-1)`);

    if (expectedDateCount === 0) {
      throw new Error('No price data found in ohlc');
    }

    if (expectedDateCount < PRICE_DAYS) {
      log.warn(`Only ${expectedDateCount} days available, expected ${PRICE_DAYS}`);
    }

    // Get the date range for filtering
    const minDate = allDates[allDates.length - 1].price_date;
    const maxDate = allDates[0].price_date;

    // 2. Get Bitcoin first (must have complete data)
    const [btcResult] = await Database.execute(`
      SELECT c.id as crypto_id, c.symbol, c.name
      FROM cryptocurrencies c
      WHERE c.symbol = 'BTC'
      AND (
        SELECT COUNT(DISTINCT DATE(o.timestamp))
        FROM ohlc o
        WHERE o.crypto_id = c.id
AND DATE(o.timestamp) >= ?
          AND DATE(o.timestamp) <= ?
      ) = ?
      LIMIT 1
    `, [minDate, maxDate, expectedDateCount]);

    if (btcResult.length === 0) {
      throw new Error('Bitcoin not found with complete price data');
    }

    // 3. Get 2 random cryptos that:
    //    - Have NEVER been in portfolio_volatility_constituents
    //    - Have prices for ALL dates in the range (91 days)
    //    - Have NO zero prices in the range
    const [randomCryptos] = await Database.execute(`
      SELECT c.id as crypto_id, c.symbol, c.name
      FROM cryptocurrencies c
      WHERE c.id NOT IN (
        SELECT DISTINCT pvc.crypto_id
        FROM portfolio_volatility_constituents pvc
      )
      AND (
        SELECT COUNT(DISTINCT DATE(o.timestamp))
        FROM ohlc o
        WHERE o.crypto_id = c.id
AND DATE(o.timestamp) >= ?
          AND DATE(o.timestamp) <= ?
      ) = ?
      AND NOT EXISTS (
        SELECT 1
        FROM ohlc o2
        WHERE o2.crypto_id = c.id
          AND DATE(o2.timestamp) >= ?
          AND DATE(o2.timestamp) <= ?
          AND o2.close = 0
      )
      ORDER BY RAND()
      LIMIT 2
    `, [minDate, maxDate, expectedDateCount, minDate, maxDate]);

    if (randomCryptos.length === 0) {
      throw new Error('No cryptos found that have never been in top 80 with complete price data');
    }

    // Combine: Bitcoin first, then 2 random non-top80 cryptos
    const allCryptos = [btcResult[0], ...randomCryptos];

    log.info(`Selected cryptos: ${allCryptos.map(c => c.symbol).join(', ')}`);

    const cryptoIds = allCryptos.map(c => c.crypto_id);

    // 4. Get closing prices for these cryptos from ohlc (last 91 days)
    const [pricesData] = await Database.execute(`
      SELECT
        o.crypto_id,
        DATE(o.timestamp) as price_date,
        o.close as price_usd
      FROM ohlc o
      WHERE o.crypto_id IN (${cryptoIds.join(',')})
        AND DATE(o.timestamp) >= ?
        AND DATE(o.timestamp) <= ?
      ORDER BY o.timestamp ASC
    `, [minDate, maxDate]);

    log.info(`Retrieved ${pricesData.length} price records`);

    // 5. Build a map for quick lookup: crypto_id + date -> price
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

    // 6. Build CSV content
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    let csvContent = '';

    // Header row: Symbol;Name;Date1_Price;Date2_Price;...
    csvContent += 'Symbol;Name';
    for (const date of sortedDates) {
      csvContent += `;${date}_Price`;
    }
    csvContent += '\n';

    // Data rows: one per crypto
    for (const crypto of allCryptos) {
      csvContent += `${crypto.symbol};${crypto.name}`;

      for (const date of sortedDates) {
        const key = `${crypto.crypto_id}_${date}`;
        const data = dataMap.get(key);
        csvContent += `;${data ? formatNumber(data.price_usd) : ''}`;
      }
      csvContent += '\n';
    }

    // 7. Write to file
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Random_NonTop80_Prices_${sortedDates.length}days_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Random non-top80 prices exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Exported ${allCryptos.length} cryptos x ${sortedDates.length} days`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting random non-top80 prices: ${error.message}`);
    throw error;
  }
}

// Run the command
exportRandomNonTop80Prices()
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
