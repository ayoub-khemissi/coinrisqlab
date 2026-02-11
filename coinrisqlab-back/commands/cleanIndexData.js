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

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Index Data');
    log.info('='.repeat(60));

    // 1. Delete index_constituents (has FK to index_history)
    log.info('\n[1/3] Deleting index_constituents...');
    const [icResult] = await Database.execute('DELETE FROM index_constituents');
    log.info(`Deleted ${icResult.affectedRows} rows from index_constituents`);

    // 2. Delete index_history (has FK to index_config)
    log.info('\n[2/3] Deleting index_history...');
    const [ihResult] = await Database.execute('DELETE FROM index_history');
    log.info(`Deleted ${ihResult.affectedRows} rows from index_history`);

    // 3. Delete index_config
    log.info('\n[3/3] Deleting index_config...');
    const [icfResult] = await Database.execute('DELETE FROM index_config');
    log.info(`Deleted ${icfResult.affectedRows} rows from index_config`);

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Index data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    log.error(`Failed to clean index data: ${error.message}`);
    throw error;
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
