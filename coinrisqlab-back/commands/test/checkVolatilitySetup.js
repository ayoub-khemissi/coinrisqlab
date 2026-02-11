import Database from '../../lib/database.js';
import log from '../../lib/log.js';

/**
 * Diagnostic script to check volatility configuration
 */
async function checkVolatilitySetup() {
  try {
    log.info('='.repeat(60));
    log.info('VOLATILITY DIAGNOSTIC');
    log.info('='.repeat(60));

    // 1. Check that tables exist
    log.info('\n[1] Checking tables...');
    const tables = [
      'crypto_log_returns',
      'crypto_volatility',
      'portfolio_volatility',
      'portfolio_volatility_constituents'
    ];

    for (const table of tables) {
      try {
        const [rows] = await Database.execute(`SELECT COUNT(*) as count FROM ${table}`);
        const count = rows[0].count;
        log.info(`  ✓ ${table}: ${count} records`);
      } catch (error) {
        log.error(`  ✗ ${table}: Table does not exist or error - ${error.message}`);
      }
    }

    // 2. Check available market data
    log.info('\n[2] Checking market data...');
    const [marketDataStats] = await Database.execute(`
      SELECT
        COUNT(DISTINCT crypto_id) as num_cryptos,
        COUNT(DISTINCT price_date) as num_days,
        MIN(price_date) as first_date,
        MAX(price_date) as last_date
      FROM market_data
    `);

    if (marketDataStats.length > 0) {
      const stats = marketDataStats[0];
      log.info(`  Cryptos with data: ${stats.num_cryptos}`);
      log.info(`  Days of data: ${stats.num_days}`);
      log.info(`  First date: ${stats.first_date}`);
      log.info(`  Last date: ${stats.last_date}`);

      if (stats.num_days < 90) {
        log.warn(`  ⚠ WARNING: Only ${stats.num_days} days of data available.`);
        log.warn(`  ⚠ At least 90 days are required to calculate volatility.`);
      } else {
        log.info(`  ✓ Sufficient data to calculate volatility (>= 90 days)`);
      }
    }

    // 3. Check CoinRisqLab 80 index
    log.info('\n[3] Checking CoinRisqLab 80 index...');
    const [indexHistory] = await Database.execute(`
      SELECT
        COUNT(*) as count,
        MIN(snapshot_date) as first_date,
        MAX(snapshot_date) as last_date
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
    `);

    if (indexHistory.length > 0 && indexHistory[0].count > 0) {
      log.info(`  ✓ Index calculated: ${indexHistory[0].count} data points`);
      log.info(`  First date: ${indexHistory[0].first_date}`);
      log.info(`  Last date: ${indexHistory[0].last_date}`);
    } else {
      log.warn(`  ⚠ CoinRisqLab 80 index not calculated`);
    }

    // 4. Check portfolio volatility
    log.info('\n[4] Checking portfolio volatility...');
    const [portfolioVol] = await Database.execute(`
      SELECT
        pv.*,
        ic.index_name
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (portfolioVol.length > 0) {
      const vol = portfolioVol[0];
      log.info(`  ✓ Volatility calculated!`);
      log.info(`  Date: ${vol.date}`);
      log.info(`  Annualized volatility: ${(parseFloat(vol.annualized_volatility) * 100).toFixed(2)}%`);
      log.info(`  Number of constituents: ${vol.num_constituents}`);
      log.info(`  Window: ${vol.window_days} days`);
    } else {
      log.warn(`  ✗ No volatility calculated`);
      log.info(`  → Run: npm run update-volatility`);
    }

    // 5. Test API endpoint
    log.info('\n[5] Simulated API response structure...');
    if (portfolioVol.length > 0) {
      log.info(`  GET /volatility/portfolio would return:`);
      log.info(`  {`);
      log.info(`    data: {`);
      log.info(`      latest: { ...data },`);
      log.info(`      history: [ ...array ]`);
      log.info(`    }`);
      log.info(`  }`);
      log.info(`  ✓ The gauge should display on the frontend`);
    } else {
      log.warn(`  ✗ No data to return`);
      log.warn(`  ✗ The gauge will NOT display`);
    }

    // Summary
    log.info('\n' + '='.repeat(60));
    log.info('SUMMARY');
    log.info('='.repeat(60));

    const marketDays = marketDataStats[0]?.num_days || 0;
    const hasVolatility = portfolioVol.length > 0;

    if (!hasVolatility) {
      log.warn('\n⚠ THE VOLATILITY GAUGE WILL NOT DISPLAY');
      log.info('\nSteps to follow:');

      if (marketDays < 90) {
        log.info('1. Wait until you have at least 90 days of market data');
        log.info('   (currently: ' + marketDays + ' days)');
        log.info('2. OR import historical data');
      } else {
        log.info('1. Run: npm run update-volatility');
        log.info('2. Check logs for errors');
        log.info('3. Refresh the frontend');
      }
    } else {
      log.info('\n✓ EVERYTHING IS CONFIGURED CORRECTLY');
      log.info('  The gauge should be visible on the frontend');
      log.info('  If it does not appear, check:');
      log.info('  - That the backend is running');
      log.info('  - That the frontend is calling the API');
      log.info('  - The browser console for errors');
    }

  } catch (error) {
    log.error(`Error during diagnostic: ${error.message}`);
    log.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkVolatilitySetup();
