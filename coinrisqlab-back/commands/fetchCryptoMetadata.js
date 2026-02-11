import config from '../utils/config.js';
import Constants from '../utils/constants.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { isStablecoin, isWrapped, isStaked } from '../utils/exclusions.js';

const API_DELAY_MS = 100; // Rate limiting: ~10 req/sec

/**
 * Main function to fetch cryptocurrency metadata from CoinGecko
 * and store it in the database for filtering purposes.
 * Uses /coins/{id} endpoint (1 call per coin).
 */
async function fetchCryptoMetadata() {
  try {
    log.info('Starting cryptocurrency metadata fetch (CoinGecko)...');

    if (!config.COINGECKO_API_KEY) {
      throw new Error('COINGECKO_API_KEY is not configured');
    }

    // Get all cryptocurrencies from our database that have a coingecko_id
    const [cryptos] = await Database.execute(`
      SELECT id, symbol, name, coingecko_id
      FROM cryptocurrencies
      WHERE coingecko_id IS NOT NULL
      ORDER BY id
    `);

    if (cryptos.length === 0) {
      log.warn('No cryptocurrencies with coingecko_id found in database. Run fetchCryptoMarketData first.');
      return;
    }

    log.info(`Found ${cryptos.length} cryptocurrencies to fetch metadata for`);

    let totalSuccess = 0;
    let totalErrors = 0;

    for (const crypto of cryptos) {
      try {
        await processMetadataForCrypto(crypto);
        totalSuccess++;
      } catch (error) {
        totalErrors++;
        log.error(`Error processing metadata for ${crypto.symbol}: ${error.message}`);
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
    }

    log.info(`Metadata fetch completed: ${totalSuccess} successful, ${totalErrors} errors out of ${cryptos.length} total`);

    // Log summary of exclusions
    const [allMetadata] = await Database.execute(`
      SELECT categories FROM cryptocurrency_metadata WHERE categories IS NOT NULL
    `);

    let stablecoins = 0, wrapped = 0, staked = 0, totalExcluded = 0;
    for (const row of allMetadata) {
      const s = isStablecoin(row.categories);
      const w = isWrapped(row.categories);
      const l = isStaked(row.categories);
      if (s) stablecoins++;
      if (w) wrapped++;
      if (l) staked++;
      if (s || w || l) totalExcluded++;
    }

    log.info('=== Exclusion Summary ===');
    log.info(`Stablecoins: ${stablecoins}`);
    log.info(`Wrapped tokens: ${wrapped}`);
    log.info(`Staked tokens: ${staked}`);
    log.info(`Total excluded: ${totalExcluded}`);

  } catch (error) {
    log.error(`Error fetching crypto metadata: ${error.message}`);
    throw error;
  }
}

/**
 * Fetch and store metadata for a single cryptocurrency
 * @param {Object} crypto - { id, symbol, name, coingecko_id }
 */
async function processMetadataForCrypto(crypto) {
  const url = `${Constants.COINGECKO_COIN_DETAIL}/${crypto.coingecko_id}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`;

  const response = await fetch(url, {
    headers: {
      'x-cg-pro-api-key': config.COINGECKO_API_KEY,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  // Extract fields from CoinGecko response
  const categories = data.categories || [];
  const description = data.description?.en || null;
  const logoUrl = data.image?.large || null;
  const websiteUrl = data.links?.homepage?.[0] || null;
  const whitepaperUrl = data.links?.whitepaper || null;
  const twitterUrl = data.links?.twitter_screen_name
    ? `https://x.com/${data.links.twitter_screen_name}`
    : null;
  const redditUrl = data.links?.subreddit_url || null;
  const telegramUrl = data.links?.telegram_channel_identifier
    ? `https://t.me/${data.links.telegram_channel_identifier}`
    : null;
  const githubUrl = data.links?.repos_url?.github?.[0] || null;
  const platform = data.asset_platform_id || null;
  const dateLaunched = data.genesis_date || null;

  // Store metadata in database
  await Database.execute(
    `INSERT INTO cryptocurrency_metadata
    (crypto_id, cmc_id, categories, description, logo_url, website_url,
     whitepaper_url, twitter_url, reddit_url, telegram_url, github_url,
     platform, date_launched)
    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    categories = VALUES(categories),
    description = VALUES(description),
    logo_url = VALUES(logo_url),
    website_url = VALUES(website_url),
    whitepaper_url = VALUES(whitepaper_url),
    twitter_url = VALUES(twitter_url),
    reddit_url = VALUES(reddit_url),
    telegram_url = VALUES(telegram_url),
    github_url = VALUES(github_url),
    platform = VALUES(platform),
    date_launched = VALUES(date_launched),
    updated_at = CURRENT_TIMESTAMP`,
    [
      crypto.id,
      JSON.stringify(categories),
      description,
      logoUrl,
      websiteUrl,
      whitepaperUrl,
      twitterUrl,
      redditUrl,
      telegramUrl,
      githubUrl,
      platform,
      dateLaunched,
    ]
  );

  log.debug(`${crypto.symbol} metadata fetched`);
}

// Run the command
fetchCryptoMetadata()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
