import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

const DELAY_BETWEEN_PAGES_MS = 1000;

/**
 * Main function to fetch cryptocurrency market data from CoinGecko
 * and store it in the database.
 * Fetches 2 pages of 250 for top 500 cryptos.
 */
async function fetchCryptoMarketData() {
  try {
    log.info('Starting cryptocurrency market data fetch (CoinGecko)...');

    if (!config.COINGECKO_API_KEY) {
      throw new Error('COINGECKO_API_KEY is not configured');
    }

    // Generate a single timestamp for this entire fetch batch
    const fetchTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    log.info(`Fetch timestamp: ${fetchTimestamp}`);

    let successCount = 0;
    let errorCount = 0;

    // Fetch 2 pages of 250 cryptos each
    for (let page = 1; page <= 2; page++) {
      const url = `${Constants.COINGECKO_COINS_MARKETS}?vs_currency=usd&per_page=250&page=${page}&order=market_cap_desc&price_change_percentage=1h,24h,7d,14d,30d,200d,1y`;

      log.info(`Fetching page ${page}/2...`);

      const response = await fetch(url, {
        headers: {
          'x-cg-pro-api-key': config.COINGECKO_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const cryptos = await response.json();

      if (!Array.isArray(cryptos)) {
        throw new Error(`Invalid response format from CoinGecko API (page ${page})`);
      }

      log.info(`Page ${page}: fetched ${cryptos.length} cryptocurrencies`);

      // Process each cryptocurrency
      for (const item of cryptos) {
        try {
          await processCrypto(item, fetchTimestamp);
          successCount++;
        } catch (error) {
          errorCount++;
          log.error(`Error processing ${item.symbol}: ${error.message}`);
        }
      }

      // Delay between pages
      if (page < 2) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PAGES_MS));
      }
    }

    log.info(`Processing complete: ${successCount} successful, ${errorCount} errors`);
  } catch (error) {
    log.error(`Error fetching crypto market data: ${error.message}`);
    throw error;
  }
}

/**
 * Process a single cryptocurrency: ensure it exists in the database
 * and insert its market data.
 * @param {Object} item - Cryptocurrency data from CoinGecko /coins/markets
 * @param {string} fetchTimestamp - Timestamp for this fetch batch
 */
async function processCrypto(item, fetchTimestamp) {
  const symbol = item.symbol.toUpperCase();
  const name = item.name;
  const coingeckoId = item.id;
  const imageUrl = item.image || null;

  // Get or create cryptocurrency record
  const cryptoId = await getCryptoId(symbol, name, coingeckoId, imageUrl);

  // Insert market data
  await insertMarketData(cryptoId, item, fetchTimestamp);
}

/**
 * Get the cryptocurrency ID from the database, or create a new record if it doesn't exist.
 * Updates coingecko_id and image_url if not set.
 * @param {string} symbol - Cryptocurrency symbol (e.g., BTC, ETH)
 * @param {string} name - Cryptocurrency name
 * @param {string} coingeckoId - CoinGecko ID (e.g., "bitcoin")
 * @param {string|null} imageUrl - CoinGecko image URL
 * @returns {number} The cryptocurrency ID
 */
async function getCryptoId(symbol, name, coingeckoId, imageUrl) {
  // Check if cryptocurrency exists by symbol
  const [rows] = await Database.execute(
    'SELECT id FROM cryptocurrencies WHERE symbol = ?',
    [symbol]
  );

  if (rows.length > 0) {
    // Update coingecko_id and image_url
    await Database.execute(
      'UPDATE cryptocurrencies SET coingecko_id = ?, image_url = ? WHERE id = ? AND coingecko_id IS NULL',
      [coingeckoId, imageUrl, rows[0].id]
    );
    // Always update image_url (it can change)
    await Database.execute(
      'UPDATE cryptocurrencies SET image_url = ? WHERE id = ?',
      [imageUrl, rows[0].id]
    );
    return rows[0].id;
  }

  // Insert new cryptocurrency
  log.info(`Creating new cryptocurrency record: ${symbol} (${name}) - CoinGecko ID: ${coingeckoId}`);
  const [result] = await Database.execute(
    'INSERT INTO cryptocurrencies (symbol, name, coingecko_id, image_url) VALUES (?, ?, ?, ?)',
    [symbol, name, coingeckoId, imageUrl]
  );

  return result.insertId;
}

/**
 * Insert market data for a cryptocurrency.
 * @param {number} cryptoId - The cryptocurrency ID
 * @param {Object} item - Cryptocurrency data from CoinGecko
 * @param {string} fetchTimestamp - Timestamp for this fetch batch
 */
async function insertMarketData(cryptoId, item, fetchTimestamp) {
  await Database.execute(
    `INSERT INTO market_data
    (crypto_id, price_usd, circulating_supply, volume_24h_usd,
     percent_change_1h, percent_change_24h, percent_change_7d, percent_change_14d,
     percent_change_30d, percent_change_200d, percent_change_1y,
     market_cap_rank, total_supply, max_supply, fully_diluted_valuation, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    price_usd = VALUES(price_usd),
    circulating_supply = VALUES(circulating_supply),
    volume_24h_usd = VALUES(volume_24h_usd),
    percent_change_1h = VALUES(percent_change_1h),
    percent_change_24h = VALUES(percent_change_24h),
    percent_change_7d = VALUES(percent_change_7d),
    percent_change_14d = VALUES(percent_change_14d),
    percent_change_30d = VALUES(percent_change_30d),
    percent_change_200d = VALUES(percent_change_200d),
    percent_change_1y = VALUES(percent_change_1y),
    market_cap_rank = VALUES(market_cap_rank),
    total_supply = VALUES(total_supply),
    max_supply = VALUES(max_supply),
    fully_diluted_valuation = VALUES(fully_diluted_valuation)`,
    [
      cryptoId,
      item.current_price || 0,
      item.circulating_supply || 0,
      item.total_volume || 0,
      item.price_change_percentage_1h_in_currency ?? null,
      item.price_change_percentage_24h ?? null,
      item.price_change_percentage_7d_in_currency ?? null,
      item.price_change_percentage_14d_in_currency ?? null,
      item.price_change_percentage_30d_in_currency ?? null,
      item.price_change_percentage_200d_in_currency ?? null,
      item.price_change_percentage_1y_in_currency ?? null,
      item.market_cap_rank || null,
      item.total_supply || null,
      item.max_supply || null,
      item.fully_diluted_valuation || null,
      fetchTimestamp,
    ]
  );

  log.debug(`Inserted/updated market data for ${item.symbol.toUpperCase()} at ${fetchTimestamp}`);
}

// Run the command
fetchCryptoMarketData()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
