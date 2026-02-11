import Database from '../../lib/database.js';
import log from '../../lib/log.js';

/**
 * Script to insert test volatility data
 * Allows testing the gauge display without having 90 days of real data
 */
async function insertFakeVolatilityData() {
  try {
    log.info('='.repeat(60));
    log.info('INSERTING TEST VOLATILITY DATA');
    log.info('='.repeat(60));

    // 1. Check/get index config
    log.info('\n[1] Retrieving index configuration...');
    let [indexConfig] = await Database.execute(
      'SELECT * FROM index_config WHERE index_name = ? LIMIT 1',
      ['CoinRisqLab 80']
    );

    let indexConfigId;
    if (indexConfig.length === 0) {
      log.info('  Creating test index configuration...');
      const [result] = await Database.execute(
        `INSERT INTO index_config
        (index_name, base_level, divisor, base_date, max_constituents, is_active)
        VALUES (?, ?, ?, NOW(), ?, TRUE)`,
        ['CoinRisqLab 80', 100, 1000000000000, 80]
      );
      indexConfigId = result.insertId;
      log.info(`  ✓ Index config created (ID: ${indexConfigId})`);
    } else {
      indexConfigId = indexConfig[0].id;
      log.info(`  ✓ Index config found (ID: ${indexConfigId})`);
    }

    // 2. Retrieve some cryptos for fake data
    log.info('\n[2] Retrieving cryptocurrencies...');
    const [cryptos] = await Database.execute(
      'SELECT id, symbol FROM cryptocurrencies LIMIT 10'
    );

    if (cryptos.length === 0) {
      log.error('  ✗ No cryptocurrency found in database');
      log.error('  Please run first: npm run fetch-crypto-data');
      process.exit(1);
    }

    log.info(`  ✓ ${cryptos.length} cryptocurrencies found`);

    // 3. Insert test portfolio volatility data
    log.info('\n[3] Inserting portfolio volatility...');

    // Delete old test data if it exists
    await Database.execute('DELETE FROM portfolio_volatility_constituents WHERE portfolio_volatility_id IN (SELECT id FROM portfolio_volatility WHERE index_config_id = ?)', [indexConfigId]);
    await Database.execute('DELETE FROM portfolio_volatility WHERE index_config_id = ?', [indexConfigId]);

    // Create multiple data points for history (last 30 days)
    const dataPoints = [];
    const today = new Date();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Generate varying volatility (between 15% and 25% annualized)
      const baseVol = 0.18; // 18% base
      const variation = (Math.sin(i / 5) * 0.04); // ±4%
      const annualizedVol = baseVol + variation;
      const dailyVol = annualizedVol / Math.sqrt(365);

      dataPoints.push({
        date: dateStr,
        dailyVol: dailyVol,
        annualizedVol: annualizedVol,
        numConstituents: 75 + Math.floor(Math.random() * 5), // 75-80
        totalMarketCap: 2500000000000 + (Math.random() * 500000000000) // ~2.5-3T
      });
    }

    // Insert data
    for (const point of dataPoints) {
      const [result] = await Database.execute(
        `INSERT INTO portfolio_volatility
        (index_config_id, date, window_days, daily_volatility, annualized_volatility,
         num_constituents, total_market_cap_usd, calculation_duration_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          indexConfigId,
          point.date,
          90,
          point.dailyVol,
          point.annualizedVol,
          point.numConstituents,
          point.totalMarketCap,
          Math.floor(Math.random() * 5000 + 1000) // 1-6 seconds
        ]
      );

      const portfolioVolId = result.insertId;

      // Insert some constituents for last point only
      if (point === dataPoints[dataPoints.length - 1]) {
        log.info(`  Adding constituents for ${point.date}...`);
        let totalWeight = 0;
        const weights = [];

        // Generate weights that sum to 1
        for (let j = 0; j < cryptos.length; j++) {
          const weight = Math.random();
          weights.push(weight);
          totalWeight += weight;
        }

        // Normalize weights
        for (let j = 0; j < cryptos.length; j++) {
          const normalizedWeight = weights[j] / totalWeight;
          const cryptoAnnualVol = 0.3 + (Math.random() * 0.5); // 30-80%
          const cryptoDailyVol = cryptoAnnualVol / Math.sqrt(365);
          const marketCap = point.totalMarketCap * normalizedWeight;

          await Database.execute(
            `INSERT INTO portfolio_volatility_constituents
            (portfolio_volatility_id, crypto_id, weight, daily_volatility,
             annualized_volatility, market_cap_usd)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              portfolioVolId,
              cryptos[j].id,
              normalizedWeight,
              cryptoDailyVol,
              cryptoAnnualVol,
              marketCap
            ]
          );
        }
      }
    }

    log.info(`  ✓ ${dataPoints.length} data points inserted`);

    // 4. Display summary
    log.info('\n[4] Summary of inserted data...');
    const latest = dataPoints[dataPoints.length - 1];
    log.info(`  Most recent date: ${latest.date}`);
    log.info(`  Annualized volatility: ${(latest.annualizedVol * 100).toFixed(2)}%`);
    log.info(`  Number of constituents: ${latest.numConstituents}`);

    // 5. Test endpoint
    log.info('\n[5] Verification...');
    const [check] = await Database.execute(`
      SELECT
        pv.date,
        pv.annualized_volatility,
        pv.num_constituents,
        ic.index_name
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (check.length > 0) {
      const data = check[0];
      log.info('  ✓ Volatility data available:');
      log.info(`    - Date: ${data.date}`);
      log.info(`    - Volatility: ${(parseFloat(data.annualized_volatility) * 100).toFixed(2)}%`);
      log.info(`    - Constituents: ${data.num_constituents}`);
    }

    log.info('\n' + '='.repeat(60));
    log.info('✅ SUCCESS!');
    log.info('='.repeat(60));
    log.info('\nThe volatility gauge should now display on the frontend.');
    log.info('Refresh the home page to see it.\n');
    log.info('To test the API directly:');
    log.info('  curl http://localhost:8080/volatility/portfolio\n');

  } catch (error) {
    log.error('Error while inserting test data:');
    log.error(error.message);
    log.error(error.stack);
  } finally {
    process.exit(0);
  }
}

insertFakeVolatilityData();
