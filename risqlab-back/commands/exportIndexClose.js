import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';

/**
 * Export daily close index levels (last index_level of each day)
 * Usage: node commands/exportIndexClose.js <days>
 * Example: node commands/exportIndexClose.js 90
 * Outputs to CSV file
 */
async function exportIndexClose(days) {
  const startTime = Date.now();

  try {
    log.info(`Fetching daily close index levels (last ${days} days)...`);

    const [results] = await Database.execute(`
      SELECT * FROM (
        SELECT
          DATE(snapshot_date) as date,
          SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as close_level,
          ic.index_name
        FROM index_history ih
        INNER JOIN index_config ic ON ih.index_config_id = ic.id
        WHERE ic.index_name = 'RisqLab 80'
          AND DATE(snapshot_date) < CURDATE()
        GROUP BY DATE(snapshot_date), ic.index_name
        ORDER BY date DESC
        LIMIT ${days}
      ) sub ORDER BY date ASC
    `);

    log.info(`Found ${results.length} daily close levels`);

    if (results.length === 0) {
      log.warn('No data found');
      return;
    }

    // Generate CSV content
    const headers = ['date', 'close_level', 'index_name'];
    const csvLines = [headers.join(';')];

    for (const row of results) {
      const date = row.date.toISOString().split('T')[0];
      csvLines.push(`${date};${row.close_level};${row.index_name}`);
    }

    const csvContent = csvLines.join('\n');

    // Write to file
    const outputDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().split('T')[0];
    const outputPath = path.join(outputDir, `index_close_${timestamp}.csv`);

    fs.writeFileSync(outputPath, csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Export completed in ${duration}ms`);
    log.info(`Output file: ${outputPath}`);

    // Also print to console
    console.log('\n--- Daily Close Index Levels ---');
    console.log(csvContent);
    console.log(`\nExported to: ${outputPath}`);

  } catch (error) {
    log.error(`Error exporting index close: ${error.message}`);
    throw error;
  }
}

const days = parseInt(process.argv[2], 10);

if (isNaN(days) || days < 1) {
  console.error('Error: first argument must be a positive number of days');
  console.error('Usage: node commands/exportIndexClose.js <days>');
  process.exit(1);
}

exportIndexClose(days)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
