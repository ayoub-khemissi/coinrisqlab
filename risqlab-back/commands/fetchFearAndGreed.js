import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

const MAX_BACKFILL_DAYS = 730;

/**
 * Main function to fetch Fear and Greed Index from CoinMarketCap.
 * Smart backfill: detects missing days and fetches only what's needed (1 credit).
 */
async function fetchFearAndGreed() {
  try {
    log.info('Starting Fear and Greed Index fetch...');

    // 1. Detect how many days are missing
    const missingDays = await countMissingDays();
    const limit = Math.min(Math.max(missingDays, 1), MAX_BACKFILL_DAYS);

    log.info(`Missing days: ${missingDays}, fetching limit=${limit}`);

    // 2. Fetch data from CoinMarketCap API (1 credit regardless of limit)
    const response = await fetch(`${Constants.COINMARKETCAP_FEAR_AND_GREED}?limit=${limit}`, {
      headers: {
        'X-CMC_PRO_API_KEY': Config.COINMARKETCAP_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('Invalid response format from CoinMarketCap API');
    }

    log.info(`API returned ${data.data.length} data point(s)`);

    // 3. Insert all data points
    let inserted = 0;
    for (const entry of data.data) {
      const timestamp = new Date(parseInt(entry.timestamp) * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');

      await Database.execute(
        `INSERT INTO fear_and_greed (value, timestamp)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
        value = VALUES(value)`,
        [entry.value, timestamp]
      );

      inserted++;
    }

    log.info(`Inserted/updated ${inserted} Fear and Greed record(s)`);

  } catch (error) {
    log.error(`Error fetching Fear and Greed Index: ${error.message}`);
    throw error;
  }
}

/**
 * Count how many days are missing from the fear_and_greed table
 * within the backfill window.
 * @returns {Promise<number>}
 */
async function countMissingDays() {
  const [rows] = await Database.execute(`
    SELECT DATEDIFF(CURDATE(), COALESCE(DATE(MAX(timestamp)), DATE_SUB(CURDATE(), INTERVAL ? DAY))) as missing
    FROM fear_and_greed
  `, [MAX_BACKFILL_DAYS]);

  return rows[0]?.missing || MAX_BACKFILL_DAYS;
}

// Run the command
fetchFearAndGreed()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
