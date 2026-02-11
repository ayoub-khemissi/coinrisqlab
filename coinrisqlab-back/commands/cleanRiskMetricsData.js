import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Clean all risk metrics data from the database
 * Tables cleaned (no FK dependencies between them):
 * 1. crypto_sml
 * 2. crypto_beta
 * 3. crypto_var
 * 4. crypto_distribution_stats
 */
async function cleanRiskMetricsData() {
  const startTime = Date.now();
  const connection = await Database.getConnection();

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Risk Metrics Data');
    log.info('='.repeat(60));

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Truncate crypto_sml
    log.info('\n[1/4] Truncating crypto_sml...');
    await connection.execute('TRUNCATE TABLE crypto_sml');
    log.info('Truncated crypto_sml');

    // 2. Truncate crypto_beta
    log.info('\n[2/4] Truncating crypto_beta...');
    await connection.execute('TRUNCATE TABLE crypto_beta');
    log.info('Truncated crypto_beta');

    // 3. Truncate crypto_var
    log.info('\n[3/4] Truncating crypto_var...');
    await connection.execute('TRUNCATE TABLE crypto_var');
    log.info('Truncated crypto_var');

    // 4. Truncate crypto_distribution_stats
    log.info('\n[4/4] Truncating crypto_distribution_stats...');
    await connection.execute('TRUNCATE TABLE crypto_distribution_stats');
    log.info('Truncated crypto_distribution_stats');

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Risk metrics data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    log.error(`Failed to clean risk metrics data: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
}

cleanRiskMetricsData()
  .then(() => {
    log.info('Clean completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Clean failed: ${error.message}`);
    process.exit(1);
  });
