import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Main function to fetch global cryptocurrency metrics from CoinMarketCap
 * and store them in the database.
 */
async function fetchGlobalMetrics() {
  try {
    log.info('Starting global metrics fetch...');

    // 1. Fetch data from CoinMarketCap API
    const response = await fetch(Constants.COINMARKETCAP_GLOBAL_METRICS, {
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

    if (!data.data) {
      throw new Error('Invalid response format from CoinMarketCap API');
    }

    const metrics = data.data;
    const quote = metrics.quote?.USD;

    if (!quote) {
      throw new Error('No USD quote data available in global metrics');
    }

    // 2. Calculate metrics
    const btcDominance = metrics.btc_dominance;
    const ethDominance = metrics.eth_dominance;
    const btcDominanceYesterday = metrics.btc_dominance_yesterday;
    const ethDominanceYesterday = metrics.eth_dominance_yesterday;

    // Calculate others dominance (100% - BTC - ETH)
    const othersDominance = 100 - btcDominance - ethDominance;
    const othersDominanceYesterday = 100 - btcDominanceYesterday - ethDominanceYesterday;

    // Calculate 24h changes
    const btcDominance24hChange = metrics.btc_dominance_24h_percentage_change;
    const ethDominance24hChange = metrics.eth_dominance_24h_percentage_change;
    const othersDominance24hChange = othersDominance - othersDominanceYesterday;

    // Market cap and volume
    const totalMarketCap = quote.total_market_cap;
    const totalMarketCapYesterday = quote.total_market_cap_yesterday;
    const totalMarketCap24hChange = quote.total_market_cap_yesterday_percentage_change;

    const totalVolume24h = quote.total_volume_24h;
    const totalVolume24hYesterday = quote.total_volume_24h_yesterday;
    const totalVolume24hChange = quote.total_volume_24h_yesterday_percentage_change;

    // Use the last_updated timestamp from CoinMarketCap
    const timestamp = new Date(metrics.last_updated).toISOString().slice(0, 19).replace('T', ' ');

    // 3. Insert into database
    await Database.execute(
      `INSERT INTO global_metrics
      (btc_dominance, btc_dominance_24h_change, eth_dominance, eth_dominance_24h_change,
       others_dominance, others_dominance_24h_change, total_market_cap_usd, total_market_cap_24h_change,
       total_volume_24h_usd, total_volume_24h_change, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      btc_dominance = VALUES(btc_dominance),
      btc_dominance_24h_change = VALUES(btc_dominance_24h_change),
      eth_dominance = VALUES(eth_dominance),
      eth_dominance_24h_change = VALUES(eth_dominance_24h_change),
      others_dominance = VALUES(others_dominance),
      others_dominance_24h_change = VALUES(others_dominance_24h_change),
      total_market_cap_usd = VALUES(total_market_cap_usd),
      total_market_cap_24h_change = VALUES(total_market_cap_24h_change),
      total_volume_24h_usd = VALUES(total_volume_24h_usd),
      total_volume_24h_change = VALUES(total_volume_24h_change)`,
      [
        btcDominance,
        btcDominance24hChange,
        ethDominance,
        ethDominance24hChange,
        othersDominance,
        othersDominance24hChange,
        totalMarketCap,
        totalMarketCap24hChange,
        totalVolume24h,
        totalVolume24hChange,
        timestamp,
      ]
    );

    log.info(`Global metrics inserted/updated successfully at ${timestamp}`);
    log.info(`BTC Dominance: ${btcDominance.toFixed(2)}% (${btcDominance24hChange >= 0 ? '+' : ''}${btcDominance24hChange.toFixed(2)}%)`);
    log.info(`ETH Dominance: ${ethDominance.toFixed(2)}% (${ethDominance24hChange >= 0 ? '+' : ''}${ethDominance24hChange.toFixed(2)}%)`);
    log.info(`Others Dominance: ${othersDominance.toFixed(2)}% (${othersDominance24hChange >= 0 ? '+' : ''}${othersDominance24hChange.toFixed(2)}%)`);
    log.info(`Total Market Cap: $${(totalMarketCap / 1e9).toFixed(2)}B (${totalMarketCap24hChange >= 0 ? '+' : ''}${totalMarketCap24hChange.toFixed(2)}%)`);
    log.info(`Total Volume 24h: $${(totalVolume24h / 1e9).toFixed(2)}B (${totalVolume24hChange >= 0 ? '+' : ''}${totalVolume24hChange.toFixed(2)}%)`);

  } catch (error) {
    log.error(`Error fetching global metrics: ${error.message}`);
    throw error;
  }
}

// Run the command
fetchGlobalMetrics()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
