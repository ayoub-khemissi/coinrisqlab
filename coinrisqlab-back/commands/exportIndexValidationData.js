import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export validation data for index calculations to CSV
 * Exports: index_config, index_history (3 snapshots), and index_constituents (3 sets)
 */
async function exportIndexValidationData() {
  const startTime = Date.now();

  try {
    log.info('Starting validation data export...');

    // 1. Get index configuration
    const [configRows] = await Database.execute(`
      SELECT index_name, base_level, divisor, base_date, max_constituents
      FROM index_config
      WHERE is_active = TRUE
      LIMIT 1
    `);

    if (configRows.length === 0) {
      throw new Error('No active index configuration found');
    }

    const config = configRows[0];
    log.info(`Index config: ${config.index_name}`);

    // 2. Get 3 index history snapshots
    // - First snapshot where index_level is around 100
    // - Middle snapshot
    // - Recent snapshot

    const [firstSnapshot] = await Database.execute(`
      SELECT id, timestamp, total_market_cap_usd, index_level, divisor
      FROM index_history
      WHERE index_level >= 99.5 AND index_level <= 100.5
      ORDER BY timestamp ASC
      LIMIT 1
    `);

    if (firstSnapshot.length === 0) {
      throw new Error('No index history found with level around 100');
    }

    const [totalCount] = await Database.execute(`
      SELECT COUNT(*) as count
      FROM index_history
      WHERE id >= ?
    `, [firstSnapshot[0].id]);

    const count = totalCount[0].count;
    const middleOffset = Math.floor(count / 2);

    const [middleSnapshot] = await Database.execute(`
      SELECT id, timestamp, total_market_cap_usd, index_level, divisor
      FROM index_history
      WHERE id >= ?
      ORDER BY id ASC
      LIMIT 1 OFFSET ${middleOffset}
    `, [firstSnapshot[0].id]);

    const [recentSnapshot] = await Database.execute(`
      SELECT id, timestamp, total_market_cap_usd, index_level, divisor
      FROM index_history
      ORDER BY timestamp DESC
      LIMIT 1
    `);

    const snapshots = [
      firstSnapshot[0],
      middleSnapshot[0] || recentSnapshot[0],
      recentSnapshot[0]
    ];

    log.info(`Selected ${snapshots.length} snapshots`);

    // 3. Get constituents for each snapshot
    const constituentsData = [];

    for (const snapshot of snapshots) {
      const [constituents] = await Database.execute(`
        SELECT
          c.name as crypto_name,
          ic.rank_position,
          ic.price_usd,
          ic.circulating_supply,
          ic.weight_in_index
        FROM index_constituents ic
        INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
        WHERE ic.index_history_id = ?
        ORDER BY ic.rank_position ASC
      `, [snapshot.id]);

      constituentsData.push({
        snapshot,
        constituents
      });

      log.info(`Retrieved ${constituents.length} constituents for snapshot ${snapshot.timestamp}`);
    }

    // 4. Generate CSV content
    let csvContent = '';

    // Helper to format date
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Helper to format number (replace dot with comma for Excel)
    const formatNumber = (num) => {
      if (num === null || num === undefined) return '';
      return num.toString().replace('.', ',');
    };

    // Section 1: Index Config
    csvContent += '=== INDEX CONFIGURATION ===\n';
    csvContent += 'Index Name;Base Level;Divisor;Base Date;Max Constituents\n';
    csvContent += `${config.index_name};${formatNumber(config.base_level)};${formatNumber(config.divisor)};${formatDate(config.base_date)};${config.max_constituents}\n`;
    csvContent += '\n';

    // Section 2: Index History
    csvContent += '=== INDEX HISTORY (3 snapshots) ===\n';
    csvContent += 'Snapshot #;Date/Time;Total Market Cap (USD);Index Level;Divisor\n';
    snapshots.forEach((snapshot, index) => {
      csvContent += `${index + 1};${formatDate(snapshot.timestamp)};${formatNumber(snapshot.total_market_cap_usd)};${formatNumber(snapshot.index_level)};${formatNumber(snapshot.divisor)}\n`;
    });
    csvContent += '\n';

    // Section 3: Index Constituents (3 sets)
    constituentsData.forEach((data, setIndex) => {
      csvContent += `=== INDEX CONSTITUENTS - Snapshot ${setIndex + 1} (${formatDate(data.snapshot.timestamp)}) ===\n`;
      csvContent += 'Crypto Name;Rank;Price (USD);Circulating Supply;Weight\n';

      data.constituents.forEach(constituent => {
        csvContent += `${constituent.crypto_name};${constituent.rank_position};${formatNumber(constituent.price_usd)};${formatNumber(constituent.circulating_supply)};${formatNumber(constituent.weight_in_index)}\n`;
      });

      csvContent += '\n';
    });

    // 5. Write to file
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeIndexName = config.index_name.replace(/[^a-z0-9]/gi, '_');
    const filename = `${safeIndexName}_Validation_Export_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Validation data exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Total constituents exported: ${constituentsData.reduce((sum, d) => sum + d.constituents.length, 0)}`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting validation data: ${error.message}`);
    throw error;
  }
}

// Run the command
exportIndexValidationData()
  .then((filepath) => {
    log.info('Export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Export command failed: ${error.message}`);
    process.exit(1);
  });
