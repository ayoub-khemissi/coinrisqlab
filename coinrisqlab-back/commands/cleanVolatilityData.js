import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Clean all volatility-related data from the database
 * Tables cleaned (in order due to foreign keys):
 * 1. portfolio_volatility_constituents
 * 2. portfolio_volatility
 * 3. crypto_volatility
 * 4. crypto_log_returns
 */
async function cleanVolatilityData() {
  const startTime = Date.now();

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Volatility Data');
    log.info('='.repeat(60));

    // 1. Delete portfolio_volatility_constituents (has FK to portfolio_volatility)
    log.info('\n[1/4] Deleting portfolio_volatility_constituents...');
    const [pvcResult] = await Database.execute('DELETE FROM portfolio_volatility_constituents');
    log.info(`Deleted ${pvcResult.affectedRows} rows from portfolio_volatility_constituents`);

    // 2. Delete portfolio_volatility
    log.info('\n[2/4] Deleting portfolio_volatility...');
    const [pvResult] = await Database.execute('DELETE FROM portfolio_volatility');
    log.info(`Deleted ${pvResult.affectedRows} rows from portfolio_volatility`);

    // 3. Delete crypto_volatility
    log.info('\n[3/4] Deleting crypto_volatility...');
    const [cvResult] = await Database.execute('DELETE FROM crypto_volatility');
    log.info(`Deleted ${cvResult.affectedRows} rows from crypto_volatility`);

    // 4. Delete crypto_log_returns
    log.info('\n[4/4] Deleting crypto_log_returns...');
    const [clrResult] = await Database.execute('DELETE FROM crypto_log_returns');
    log.info(`Deleted ${clrResult.affectedRows} rows from crypto_log_returns`);

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Volatility data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    log.error(`Failed to clean volatility data: ${error.message}`);
    throw error;
  }
}

cleanVolatilityData()
  .then(() => {
    log.info('Clean completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Clean failed: ${error.message}`);
    process.exit(1);
  });
