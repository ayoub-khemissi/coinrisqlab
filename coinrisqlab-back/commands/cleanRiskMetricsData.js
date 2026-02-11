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

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Risk Metrics Data');
    log.info('='.repeat(60));

    // 1. Delete crypto_sml (uses beta values conceptually)
    log.info('\n[1/4] Deleting crypto_sml...');
    const [smlResult] = await Database.execute('DELETE FROM crypto_sml');
    log.info(`Deleted ${smlResult.affectedRows} rows from crypto_sml`);

    // 2. Delete crypto_beta
    log.info('\n[2/4] Deleting crypto_beta...');
    const [betaResult] = await Database.execute('DELETE FROM crypto_beta');
    log.info(`Deleted ${betaResult.affectedRows} rows from crypto_beta`);

    // 3. Delete crypto_var
    log.info('\n[3/4] Deleting crypto_var...');
    const [varResult] = await Database.execute('DELETE FROM crypto_var');
    log.info(`Deleted ${varResult.affectedRows} rows from crypto_var`);

    // 4. Delete crypto_distribution_stats
    log.info('\n[4/4] Deleting crypto_distribution_stats...');
    const [distResult] = await Database.execute('DELETE FROM crypto_distribution_stats');
    log.info(`Deleted ${distResult.affectedRows} rows from crypto_distribution_stats`);

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Risk metrics data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    log.error(`Failed to clean risk metrics data: ${error.message}`);
    throw error;
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
