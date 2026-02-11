import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export historical prices for specified cryptos by coingecko_id
 * Usage: node commands/exportCryptoPrices.js <days> <coingecko_id1> <coingecko_id2> ...
 * Example: node commands/exportCryptoPrices.js 91 bitcoin rain ethereum
 * - First argument is the number of days to extract
 * - Remaining arguments are coingecko_ids from the cryptocurrencies table
 * - Only selects cryptos with complete price data for the requested period
 * - Retrieves closing prices from ohlc table
 * Output: CSV file with columns:
 *   Symbol, Name, then for each date: Date_Price
 */
async function exportCryptoPrices(priceDays, coingeckoIds) {
  const startTime = Date.now();

  try {
    if (!priceDays || !coingeckoIds || coingeckoIds.length === 0) {
      throw new Error('Usage: node commands/exportCryptoPrices.js <days> <coingecko_id1> <coingecko_id2> ...');
    }

    log.info(`Starting crypto prices export for: ${coingeckoIds.join(', ')} (${priceDays} days)`);

    // 1. Get the N most recent dates available in ohlc (D-1 to D-N)
    const [allDates] = await Database.execute(`
      SELECT DISTINCT DATE(timestamp) as price_date
      FROM ohlc
      WHERE DATE(timestamp) < CURDATE()
      ORDER BY price_date DESC
      LIMIT ${priceDays}
    `);

    const expectedDateCount = allDates.length;
    log.info(`Found ${expectedDateCount} distinct dates in ohlc (last ${priceDays} days up to D-1)`);

    if (expectedDateCount === 0) {
      throw new Error('No price data found in ohlc');
    }

    if (expectedDateCount < priceDays) {
      log.warn(`Only ${expectedDateCount} days available, expected ${priceDays}`);
    }

    // Get the date range for filtering
    const minDate = allDates[allDates.length - 1].price_date;
    const maxDate = allDates[0].price_date;

    // 2. Look up cryptos by coingecko_id (include all, even those with incomplete data)
    const placeholders = coingeckoIds.map(() => '?').join(',');
    const [cryptos] = await Database.execute(`
      SELECT c.id as crypto_id, c.symbol, c.name, c.coingecko_id
      FROM cryptocurrencies c
      WHERE c.coingecko_id IN (${placeholders})
    `, coingeckoIds);

    if (cryptos.length === 0) {
      throw new Error('No cryptos found for the given coingecko_ids');
    }

    // Warn about unknown coingecko_ids
    const foundIds = new Set(cryptos.map(c => c.coingecko_id));
    const unknown = coingeckoIds.filter(id => !foundIds.has(id));
    if (unknown.length > 0) {
      log.warn(`Unknown coingecko_ids (not in DB): ${unknown.join(', ')}`);
    }

    // Preserve the order from command-line arguments
    const orderedCryptos = [];
    for (const id of coingeckoIds) {
      const crypto = cryptos.find(c => c.coingecko_id === id);
      if (crypto) orderedCryptos.push(crypto);
    }

    log.info(`Selected cryptos: ${orderedCryptos.map(c => c.symbol).join(', ')}`);

    const cryptoIds = orderedCryptos.map(c => c.crypto_id);

    // 3. Get closing prices for these cryptos from ohlc (last 91 days)
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

    // Header row: Symbol;Name;Date1_Price;Date2_Price;...
    csvContent += 'Symbol;Name';
    for (const date of sortedDates) {
      csvContent += `;${date}_Price`;
    }
    csvContent += '\n';

    // Data rows: one per crypto
    for (const crypto of orderedCryptos) {
      csvContent += `${crypto.symbol};${crypto.name}`;

      for (const date of sortedDates) {
        const key = `${crypto.crypto_id}_${date}`;
        const data = dataMap.get(key);
        csvContent += `;${data ? formatNumber(data.price_usd) : ''}`;
      }
      csvContent += '\n';
    }

    // 6. Write to file
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Crypto_Prices_${sortedDates.length}days_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Crypto prices exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Exported ${orderedCryptos.length} cryptos x ${sortedDates.length} days`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting crypto prices: ${error.message}`);
    throw error;
  }
}

// Parse command-line arguments: first arg = days, rest = coingecko_ids
const args = process.argv.slice(2);
const priceDays = parseInt(args[0], 10);
const coingeckoIds = args.slice(1);

if (isNaN(priceDays) || priceDays < 1) {
  console.error('Error: first argument must be a positive number of days');
  console.error('Usage: node commands/exportCryptoPrices.js <days> <coingecko_id1> <coingecko_id2> ...');
  process.exit(1);
}

exportCryptoPrices(priceDays, coingeckoIds)
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
