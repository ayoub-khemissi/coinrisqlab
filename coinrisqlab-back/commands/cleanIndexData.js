import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Clean all index-related data from the database
 * Tables cleaned (in order due to foreign keys):
 * 1. index_constituents (has FK to index_history)
 * 2. index_history (has FK to index_config)
 * 3. index_config
 */
async function cleanIndexData() {
  const startTime = Date.now();
  const connection = await Database.getConnection();

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Index Data');
    log.info('='.repeat(60));

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Truncate index_constituents
    log.info('\n[1/3] Truncating index_constituents...');
    await connection.execute('TRUNCATE TABLE index_constituents');
    log.info('Truncated index_constituents');

    // 2. Truncate index_history
    log.info('\n[2/3] Truncating index_history...');
    await connection.execute('TRUNCATE TABLE index_history');
    log.info('Truncated index_history');

    // 3. Truncate index_config
    log.info('\n[3/3] Truncating index_config...');
    await connection.execute('TRUNCATE TABLE index_config');
    log.info('Truncated index_config');

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Index data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    log.error(`Failed to clean index data: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

cleanIndexData()
  .then(() => {
    log.info('Clean completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Clean failed: ${error.message}`);
    process.exit(1);
  });
