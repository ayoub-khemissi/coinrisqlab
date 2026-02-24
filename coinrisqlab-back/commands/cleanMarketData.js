import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Clean all market_data and dependent index data.
 * Tables cleaned (in order due to foreign keys):
 * 1. index_constituents (has FK to market_data)
 * 2. index_history (has FK from index_constituents)
 * 3. market_data
 */
async function cleanMarketData() {
  const startTime = Date.now();
  const connection = await Database.getConnection();

  try {
    log.info('='.repeat(60));
    log.info('Cleaning market_data + dependent index data');
    log.info('='.repeat(60));

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    log.info('\n[1/3] Truncating index_constituents...');
    await connection.execute('TRUNCATE TABLE index_constituents');
    log.info('Truncated index_constituents');

    log.info('\n[2/3] Truncating index_history...');
    await connection.execute('TRUNCATE TABLE index_history');
    log.info('Truncated index_history');

    log.info('\n[3/3] Truncating market_data...');
    await connection.execute('TRUNCATE TABLE market_data');
    log.info('Truncated market_data');

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Cleanup done in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    log.error(`Failed to clean market_data: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

cleanMarketData()
  .then(() => {
    log.info('Clean completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Clean failed: ${error.message}`);
    process.exit(1);
  });
