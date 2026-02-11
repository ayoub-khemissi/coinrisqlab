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
  const connection = await Database.getConnection();

  try {
    log.info('='.repeat(60));
    log.info('Cleaning Volatility Data');
    log.info('='.repeat(60));

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Truncate portfolio_volatility_constituents
    log.info('\n[1/4] Truncating portfolio_volatility_constituents...');
    await connection.execute('TRUNCATE TABLE portfolio_volatility_constituents');
    log.info('Truncated portfolio_volatility_constituents');

    // 2. Truncate portfolio_volatility
    log.info('\n[2/4] Truncating portfolio_volatility...');
    await connection.execute('TRUNCATE TABLE portfolio_volatility');
    log.info('Truncated portfolio_volatility');

    // 3. Truncate crypto_volatility
    log.info('\n[3/4] Truncating crypto_volatility...');
    await connection.execute('TRUNCATE TABLE crypto_volatility');
    log.info('Truncated crypto_volatility');

    // 4. Truncate crypto_log_returns
    log.info('\n[4/4] Truncating crypto_log_returns...');
    await connection.execute('TRUNCATE TABLE crypto_log_returns');
    log.info('Truncated crypto_log_returns');

    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    const duration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Volatility data cleaned in ${(duration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    log.error(`Failed to clean volatility data: ${error.message}`);
    throw error;
  } finally {
    connection.release();
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
