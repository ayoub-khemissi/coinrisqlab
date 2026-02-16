import Database from '../lib/database.js';
import log from '../lib/log.js';
import { isExcluded, getExclusionReason } from '../utils/exclusions.js';

const INDEX_NAME = 'CoinRisqLab 80';
const BASE_LEVEL = 100;
const MAX_CONSTITUENTS = 80;
const MIN_VOLUME_24H = 200_000;

/**
 * Main function to calculate the CoinRisqLab 80 Index
 * Now supports retroactive calculation for all missing timestamps
 */
async function calculateCoinRisqLab80() {
  const globalStartTime = Date.now();

  try {
    log.info('Starting CoinRisqLab 80 Index calculation...');

    // 1. Get or create index configuration
    const indexConfig = await getOrCreateIndexConfig();
    log.info(`Using index config ID: ${indexConfig.id}, Divisor: ${indexConfig.divisor}`);

    // 2. Find all market data timestamps that don't have an index calculation
    const missingTimestamps = await getMissingIndexTimestamps(indexConfig.id, indexConfig.base_date);

    if (missingTimestamps.length === 0) {
      log.info('All market data timestamps already have index calculations. Nothing to do.');
      return;
    }

    log.info(`Found ${missingTimestamps.length} timestamp(s) without index calculation`);

    // 3. Calculate index for each missing timestamp (oldest first)
    let successCount = 0;
    let errorCount = 0;
    const total = missingTimestamps.length;

    for (let i = 0; i < total; i++) {
      const timestamp = missingTimestamps[i];
      const isLast = i === total - 1;
      // Be verbose only for the last calculation (or if single timestamp)
      const verbose = isLast;

      try {
        await calculateIndexForTimestamp(indexConfig, timestamp, verbose);
        successCount++;
      } catch (error) {
        log.error(`Error calculating index for timestamp ${timestamp}: ${error.message}`);
        errorCount++;
      }
    }

    const totalDuration = Date.now() - globalStartTime;
    log.info(`Index calculation completed in ${totalDuration}ms`);
    log.info(`Results: ${successCount} successful, ${errorCount} failed out of ${missingTimestamps.length} timestamps`);

  } catch (error) {
    log.error(`Error calculating CoinRisqLab 80 Index: ${error.message}`);
    throw error;
  }
}

/**
 * Get all market data timestamps that don't have a corresponding index calculation
 */
async function getMissingIndexTimestamps(indexConfigId, baseDate) {
  const [rows] = await Database.execute(`
    SELECT DISTINCT md.timestamp
    FROM market_data md
    WHERE md.timestamp >= ?
      AND md.timestamp NOT IN (
        SELECT ih.timestamp
        FROM index_history ih
        WHERE ih.index_config_id = ?
      )
    ORDER BY md.timestamp ASC
  `, [baseDate, indexConfigId]);

  return rows.map(row => row.timestamp);
}

/**
 * Calculate the index for a specific timestamp
 * @param {boolean} verbose - Whether to log detailed information
 */
async function calculateIndexForTimestamp(indexConfig, timestamp, verbose = false) {
  const startTime = Date.now();

  log.info(`Calculating index for timestamp: ${timestamp}`);

  // Get market data for this specific timestamp
  const marketData = await getMarketDataForTimestamp(timestamp);

  if (marketData.length === 0) {
    throw new Error(`No market data found for timestamp ${timestamp}`);
  }

  // Filter out excluded symbols and select top 80 by market cap
  const constituents = selectConstituents(marketData, verbose);

  if (constituents.length < MAX_CONSTITUENTS) {
    throw new Error(`Not enough constituents for timestamp ${timestamp}: ${constituents.length}/${MAX_CONSTITUENTS}`);
  }

  // Calculate total market capitalization
  const totalMarketCap = constituents.reduce(
    (sum, c) => sum + (parseFloat(c.price_usd) * parseFloat(c.circulating_supply)),
    0
  );

  // Calculate index level
  const indexLevel = totalMarketCap / parseFloat(indexConfig.divisor);

  // Calculate duration
  const calculationDuration = Date.now() - startTime;

  // Store index history
  const indexHistoryId = await storeIndexHistory(
    indexConfig.id,
    timestamp,
    totalMarketCap,
    indexLevel,
    indexConfig.divisor,
    constituents.length,
    calculationDuration
  );

  // Store constituents
  await storeConstituents(indexHistoryId, constituents, totalMarketCap, verbose);

  log.info(`  -> Index Level: ${indexLevel.toFixed(8)} | Constituents: ${constituents.length} | Market Cap: $${(totalMarketCap / 1e9).toFixed(2)}B (${calculationDuration}ms)`);
}

/**
 * Get existing index configuration or calculate divisor if needed.
 * The divisor is based on the OLDEST market_data timestamp so the index starts at 100.
 */
async function getOrCreateIndexConfig() {
  // Try to get active index config
  const [rows] = await Database.execute(
    'SELECT * FROM index_config WHERE index_name = ? AND is_active = TRUE LIMIT 1',
    [INDEX_NAME]
  );

  // If index config exists and divisor already initialized, return as-is
  if (rows.length > 0 && parseFloat(rows[0].divisor) !== 1.0) {
    return rows[0];
  }

  // Divisor needs initialization — use the OLDEST market data as base
  log.info('Divisor not yet calculated, initializing with oldest market data...');

  const { marketData, baseDate } = await getOldestMarketData();
  const constituents = selectConstituents(marketData, true);

  if (constituents.length === 0) {
    throw new Error('Cannot initialize index: no valid constituents found. Please run fetch-crypto-data first.');
  }

  const baseMarketCap = constituents.reduce((sum, c) => sum + (parseFloat(c.price_usd) * parseFloat(c.circulating_supply)), 0);
  const calculatedDivisor = baseMarketCap / BASE_LEVEL;

  if (rows.length > 0) {
    // Update existing config
    const config = rows[0];

    await Database.execute(
      `UPDATE index_config
       SET divisor = ?, base_date = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [calculatedDivisor, baseDate, config.id]
    );

    log.info(`Initialized divisor: ${calculatedDivisor}`);
    log.info(`Base market cap: $${(baseMarketCap / 1e9).toFixed(2)}B`);
    log.info(`Base date (oldest data): ${baseDate}`);

    return {
      ...config,
      divisor: calculatedDivisor,
      base_date: baseDate,
    };
  }

  // Create new index config
  log.info('No active index config found, creating new one...');

  const [result] = await Database.execute(
    `INSERT INTO index_config
    (index_name, base_level, divisor, base_date, max_constituents, is_active)
    VALUES (?, ?, ?, ?, ?, TRUE)`,
    [INDEX_NAME, BASE_LEVEL, calculatedDivisor, baseDate, MAX_CONSTITUENTS]
  );

  log.info(`Created new index config with divisor: ${calculatedDivisor}`);
  log.info(`Base market cap: $${(baseMarketCap / 1e9).toFixed(2)}B`);
  log.info(`Base date (oldest data): ${baseDate}`);

  return {
    id: result.insertId,
    index_name: INDEX_NAME,
    base_level: BASE_LEVEL,
    divisor: calculatedDivisor,
    base_date: baseDate,
    max_constituents: MAX_CONSTITUENTS,
    is_active: true,
  };
}

/**
 * Get market data for a specific timestamp with metadata
 */
async function getMarketDataForTimestamp(timestamp) {
  const [rows] = await Database.execute(`
    SELECT
      md.id as market_data_id,
      md.crypto_id,
      c.symbol,
      c.name,
      md.price_usd,
      md.circulating_supply,
      md.volume_24h_usd,
      (md.price_usd * md.circulating_supply) as market_cap_usd,
      md.percent_change_24h,
      md.percent_change_7d,
      md.timestamp,
      cm.categories
    FROM market_data md
    INNER JOIN cryptocurrencies c ON md.crypto_id = c.id
    LEFT JOIN cryptocurrency_metadata cm ON c.id = cm.crypto_id
    WHERE md.timestamp = ?
      AND (md.price_usd * md.circulating_supply) > 0
    ORDER BY (md.price_usd * md.circulating_supply) DESC
  `, [timestamp]);

  return rows;
}

/**
 * Get the oldest market data (used for initial divisor calculation).
 * The index base level (100) is anchored to the oldest available timestamp.
 * @returns {Promise<{marketData: Array, baseDate: string}>}
 */
async function getOldestMarketData() {
  const [rows] = await Database.execute(`
    SELECT
      md.id as market_data_id,
      md.crypto_id,
      c.symbol,
      c.name,
      md.price_usd,
      md.circulating_supply,
      md.volume_24h_usd,
      (md.price_usd * md.circulating_supply) as market_cap_usd,
      md.percent_change_24h,
      md.percent_change_7d,
      md.timestamp,
      cm.categories
    FROM market_data md
    INNER JOIN cryptocurrencies c ON md.crypto_id = c.id
    LEFT JOIN cryptocurrency_metadata cm ON c.id = cm.crypto_id
    WHERE md.timestamp = (SELECT MIN(timestamp) FROM market_data)
      AND (md.price_usd * md.circulating_supply) > 0
    ORDER BY (md.price_usd * md.circulating_supply) DESC
  `);

  const baseDate = rows.length > 0
    ? new Date(rows[0].timestamp).toISOString().slice(0, 19).replace('T', ' ')
    : new Date().toISOString().slice(0, 19).replace('T', ' ');

  return { marketData: rows, baseDate };
}

/**
 * Select top constituents after filtering exclusions
 * @param {boolean} verbose - Whether to log detailed information
 */
function selectConstituents(marketData, verbose = false) {
  // Filter out excluded symbols using metadata-aware function
  const filtered = marketData.filter(crypto => {
    if (isExcluded(crypto)) return false;
    if (parseFloat(crypto.volume_24h_usd) < MIN_VOLUME_24H) return false;
    return true;
  });

  if (verbose) {
    const excludedCount = marketData.length - filtered.length;
    const lowVolumeCount = marketData.filter(crypto => !isExcluded(crypto) && parseFloat(crypto.volume_24h_usd) < MIN_VOLUME_24H).length;
    log.info(`Filtered out ${excludedCount} symbols (${excludedCount - lowVolumeCount} excluded, ${lowVolumeCount} low volume < $${MIN_VOLUME_24H.toLocaleString()})`);

    // Log some examples of excluded cryptos for debugging
    const excluded = marketData.filter(crypto => isExcluded(crypto)).slice(0, 10);
    if (excluded.length > 0) {
      log.debug('Examples of excluded cryptos:');
      excluded.forEach(crypto => {
        const reason = getExclusionReason(crypto) || 'unknown';
        log.debug(`  - ${crypto.symbol}: ${reason}`);
      });
    }
  }

  // Select top MAX_CONSTITUENTS by market cap
  const selected = filtered.slice(0, MAX_CONSTITUENTS);

  return selected;
}

/**
 * Store index history record
 */
async function storeIndexHistory(
  indexConfigId,
  timestamp,
  totalMarketCap,
  indexLevel,
  divisor,
  numberOfConstituents,
  calculationDuration
) {
  const [result] = await Database.execute(
    `INSERT INTO index_history
    (index_config_id, timestamp, total_market_cap_usd, index_level, divisor, number_of_constituents, calculation_duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    total_market_cap_usd = VALUES(total_market_cap_usd),
    index_level = VALUES(index_level),
    divisor = VALUES(divisor),
    number_of_constituents = VALUES(number_of_constituents),
    calculation_duration_ms = VALUES(calculation_duration_ms)`,
    [indexConfigId, timestamp, totalMarketCap, indexLevel, divisor, numberOfConstituents, calculationDuration]
  );

  // Get the index_history_id (either inserted or existing)
  if (result.insertId > 0) {
    return result.insertId;
  }

  // If it was an update (duplicate key), retrieve the ID
  const [rows] = await Database.execute(
    'SELECT id FROM index_history WHERE index_config_id = ? AND timestamp = ?',
    [indexConfigId, timestamp]
  );

  return rows[0].id;
}

/**
 * Store index constituents
 * @param {boolean} verbose - Whether to log detailed information
 */
async function storeConstituents(indexHistoryId, constituents, totalMarketCap, verbose = false) {
  // Delete existing constituents for this index history (in case of recalculation)
  await Database.execute(
    'DELETE FROM index_constituents WHERE index_history_id = ?',
    [indexHistoryId]
  );

  // Insert new constituents
  for (let i = 0; i < constituents.length; i++) {
    const crypto = constituents[i];
    const marketCap = parseFloat(crypto.price_usd) * parseFloat(crypto.circulating_supply);
    const weight = (marketCap / totalMarketCap) * 100;

    await Database.execute(
      `INSERT INTO index_constituents
      (index_history_id, crypto_id, market_data_id, rank_position, price_usd,
       circulating_supply, weight_in_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        indexHistoryId,
        crypto.crypto_id,
        crypto.market_data_id,
        i + 1, // rank_position (1-based)
        crypto.price_usd,
        crypto.circulating_supply,
        weight,
      ]
    );
  }

  if (verbose) {
    log.info(`Stored ${constituents.length} constituents`);

    // Log top 10 constituents
    log.info('Top 10 constituents:');
    for (let i = 0; i < Math.min(10, constituents.length); i++) {
      const crypto = constituents[i];
      const marketCap = parseFloat(crypto.price_usd) * parseFloat(crypto.circulating_supply);
      const weight = (marketCap / totalMarketCap) * 100;
      log.info(`  ${i + 1}. ${crypto.symbol} (${crypto.name}) - Weight: ${weight.toFixed(2)}%`);
    }
  }
}

// Run the command
calculateCoinRisqLab80()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
