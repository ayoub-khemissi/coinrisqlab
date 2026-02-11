import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export validation data for volatility calculations to CSV
 * Exports data for all 3 stages: Log Returns, Crypto Volatility, Portfolio Volatility
 */
async function exportVolatilityValidationData() {
  const startTime = Date.now();

  try {
    log.info('Starting volatility validation data export...');

    // ========================================
    // SECTION 1: BASE PARAMETERS
    // ========================================
    const windowDays = 90;
    const annualizationFactor = Math.sqrt(365);
    const indexName = 'CoinRisqLab 80';

    // Get index config
    const [configRows] = await Database.execute(`
      SELECT id, index_name
      FROM index_config
      WHERE is_active = TRUE
      LIMIT 1
    `);

    if (configRows.length === 0) {
      throw new Error('No active index configuration found');
    }

    const indexConfigId = configRows[0].id;
    log.info(`Using index config: ${configRows[0].index_name}`);

    // ========================================
    // SECTION 2: LOG RETURNS SAMPLE
    // ========================================
    log.info('Fetching log returns sample...');

    // Select top 5 cryptos by market cap that have log returns
    const [topCryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.name, c.symbol
      FROM cryptocurrencies c
      INNER JOIN crypto_log_returns clr ON c.id = clr.crypto_id
      INNER JOIN market_data md ON c.id = md.crypto_id
      WHERE md.price_usd > 0
      GROUP BY c.id, c.name, c.symbol
      ORDER BY MAX(md.price_usd * md.circulating_supply) DESC
      LIMIT 5
    `);

    if (topCryptos.length === 0) {
      throw new Error('No cryptocurrencies with log returns found');
    }

    log.info(`Selected ${topCryptos.length} cryptocurrencies for log returns sample`);

    // For each crypto, get 15 consecutive days of log returns (enough to show the calculation)
    const logReturnsData = [];

    for (const crypto of topCryptos) {
      const [returns] = await Database.execute(`
        SELECT
          date,
          log_return,
          price_current,
          price_previous
        FROM crypto_log_returns
        WHERE crypto_id = ?
        ORDER BY date DESC
        LIMIT 15
      `, [crypto.id]);

      if (returns.length > 0) {
        logReturnsData.push({
          crypto,
          returns: returns.reverse() // Show chronologically
        });
      }
    }

    // ========================================
    // SECTION 3: CRYPTO VOLATILITY SAMPLE
    // ========================================
    log.info('Fetching crypto volatility snapshots...');

    const cryptoVolatilityData = [];

    for (const crypto of topCryptos) {
      // Get first, middle, and recent volatility snapshots
      const [firstVol] = await Database.execute(`
        SELECT
          date,
          daily_volatility,
          annualized_volatility,
          mean_return,
          num_observations,
          window_days
        FROM crypto_volatility
        WHERE crypto_id = ?
        ORDER BY date ASC
        LIMIT 1
      `, [crypto.id]);

      if (firstVol.length === 0) continue;

      const [totalCount] = await Database.execute(`
        SELECT COUNT(*) as count
        FROM crypto_volatility
        WHERE crypto_id = ?
      `, [crypto.id]);

      const count = totalCount[0].count;
      const middleOffset = Math.floor(count / 2);

      const middleQuery = `
        SELECT
          date,
          daily_volatility,
          annualized_volatility,
          mean_return,
          num_observations,
          window_days
        FROM crypto_volatility
        WHERE crypto_id = ?
        ORDER BY date ASC
        LIMIT 1 OFFSET ${middleOffset}
      `;
      const [middleVol] = await Database.execute(middleQuery, [crypto.id]);

      const [recentVol] = await Database.execute(`
        SELECT
          date,
          daily_volatility,
          annualized_volatility,
          mean_return,
          num_observations,
          window_days
        FROM crypto_volatility
        WHERE crypto_id = ?
        ORDER BY date DESC
        LIMIT 1
      `, [crypto.id]);

      const snapshots = [
        firstVol[0],
        middleVol[0] || recentVol[0],
        recentVol[0]
      ];

      // For each snapshot, get the 90 log returns used in the calculation
      const snapshotsWithReturns = [];

      for (const snapshot of snapshots) {
        const returnsQuery = `
          SELECT log_return
          FROM crypto_log_returns
          WHERE crypto_id = ?
            AND date <= ?
          ORDER BY date DESC
          LIMIT ${windowDays}
        `;
        const [returns] = await Database.execute(returnsQuery, [crypto.id, snapshot.date]);

        snapshotsWithReturns.push({
          ...snapshot,
          returns: returns.reverse() // Show chronologically
        });
      }

      cryptoVolatilityData.push({
        crypto,
        snapshots: snapshotsWithReturns
      });

      log.info(`Retrieved volatility data for ${crypto.name}`);
    }

    // ========================================
    // SECTION 4: PORTFOLIO VOLATILITY SAMPLE
    // ========================================
    log.info('Fetching portfolio volatility snapshots...');

    // Get first, middle, and recent portfolio volatility snapshots
    const [firstPortVol] = await Database.execute(`
      SELECT
        id,
        date,
        daily_volatility,
        annualized_volatility,
        num_constituents,
        total_market_cap_usd,
        window_days
      FROM portfolio_volatility
      WHERE index_config_id = ?
      ORDER BY date ASC
      LIMIT 1
    `, [indexConfigId]);

    if (firstPortVol.length === 0) {
      throw new Error('No portfolio volatility data found');
    }

    const [totalPortCount] = await Database.execute(`
      SELECT COUNT(*) as count
      FROM portfolio_volatility
      WHERE index_config_id = ?
    `, [indexConfigId]);

    const portCount = totalPortCount[0].count;
    const portMiddleOffset = Math.floor(portCount / 2);

    const middlePortQuery = `
      SELECT
        id,
        date,
        daily_volatility,
        annualized_volatility,
        num_constituents,
        total_market_cap_usd,
        window_days
      FROM portfolio_volatility
      WHERE index_config_id = ?
      ORDER BY date ASC
      LIMIT 1 OFFSET ${portMiddleOffset}
    `;
    const [middlePortVol] = await Database.execute(middlePortQuery, [indexConfigId]);

    const [recentPortVol] = await Database.execute(`
      SELECT
        id,
        date,
        daily_volatility,
        annualized_volatility,
        num_constituents,
        total_market_cap_usd,
        window_days
      FROM portfolio_volatility
      WHERE index_config_id = ?
      ORDER BY date DESC
      LIMIT 1
    `, [indexConfigId]);

    const portfolioSnapshots = [
      firstPortVol[0],
      middlePortVol[0] || recentPortVol[0],
      recentPortVol[0]
    ];

    // For each portfolio snapshot, get constituent details (limit to top 10 by weight for readability)
    const portfolioVolatilityData = [];

    for (const snapshot of portfolioSnapshots) {
      const [constituents] = await Database.execute(`
        SELECT
          c.name as crypto_name,
          c.symbol as crypto_symbol,
          pvc.weight,
          pvc.daily_volatility,
          pvc.annualized_volatility,
          pvc.market_cap_usd
        FROM portfolio_volatility_constituents pvc
        INNER JOIN cryptocurrencies c ON pvc.crypto_id = c.id
        WHERE pvc.portfolio_volatility_id = ?
        ORDER BY pvc.weight DESC
        LIMIT 10
      `, [snapshot.id]);

      portfolioVolatilityData.push({
        snapshot,
        constituents
      });

      log.info(`Retrieved ${constituents.length} constituents for portfolio snapshot ${snapshot.date}`);
    }

    // ========================================
    // SECTION 5: GENERATE CSV
    // ========================================
    log.info('Generating CSV content...');

    let csvContent = '';

    // Helper functions
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const formatNumber = (num, decimals = null) => {
      if (num === null || num === undefined) return '';
      let formatted = decimals !== null ? num.toFixed(decimals) : num.toString();
      return formatted.replace('.', ',');
    };

    // SECTION 1: Base Parameters
    csvContent += '=== BASE PARAMETERS ===\n';
    csvContent += 'Parameter;Value\n';
    csvContent += `Index Name;${indexName}\n`;
    csvContent += `Calculation Window (days);${windowDays}\n`;
    csvContent += `Return Type;Logarithmic\n`;
    csvContent += `Annualization Factor;${formatNumber(annualizationFactor, 4)}\n`;
    csvContent += `Annualization Formula;σ_annual = σ_daily × √365\n`;
    csvContent += `Trading Days per Year;365\n`;
    csvContent += '\n';

    // SECTION 2: Log Returns Sample
    csvContent += '=== LOG RETURNS SAMPLE ===\n';
    csvContent += 'This section shows the calculation of logarithmic returns\n';
    csvContent += 'Formula: Log_Return[t] = ln(Price[t] / Price[t-1])\n';
    csvContent += '\n';

    logReturnsData.forEach((data, index) => {
      csvContent += `--- ${data.crypto.name} (${data.crypto.symbol}) ---\n`;
      csvContent += 'Date;Previous Price (USD);Current Price (USD);Log Return;Verification: ln(Current/Previous)\n';

      data.returns.forEach(r => {
        const verification = r.price_previous > 0 ? Math.log(r.price_current / r.price_previous) : null;
        csvContent += `${formatDate(r.date)};${formatNumber(r.price_previous, 8)};${formatNumber(r.price_current, 8)};${formatNumber(r.log_return, 8)};${verification !== null ? formatNumber(verification, 8) : ''}\n`;
      });

      csvContent += '\n';
    });

    // SECTION 3: Crypto Volatility Sample
    csvContent += '=== INDIVIDUAL CRYPTO VOLATILITY (3 snapshots per crypto) ===\n';
    csvContent += 'This section shows the calculation of individual volatility\n';
    csvContent += 'Formula: σ_daily = √[(1/n) × Σ(r[i] - μ)²]\n';
    csvContent += 'Formula: σ_annual = σ_daily × √365\n';
    csvContent += '\n';

    cryptoVolatilityData.forEach((data) => {
      csvContent += `--- ${data.crypto.name} (${data.crypto.symbol}) ---\n`;
      csvContent += '\n';

      data.snapshots.forEach((snapshot, snapIndex) => {
        csvContent += `Snapshot ${snapIndex + 1}: ${formatDate(snapshot.date)}\n`;
        csvContent += 'Metric;Value\n';
        csvContent += `Date;${formatDate(snapshot.date)}\n`;
        csvContent += `Window (days);${snapshot.window_days}\n`;
        csvContent += `Number of Observations;${snapshot.num_observations}\n`;
        csvContent += `Mean Return (μ);${formatNumber(snapshot.mean_return, 8)}\n`;
        csvContent += `Daily Volatility (σ);${formatNumber(snapshot.daily_volatility, 8)}\n`;
        csvContent += `Annualized Volatility;${formatNumber(snapshot.annualized_volatility, 8)}\n`;
        csvContent += `Annualization Verification;${formatNumber(snapshot.daily_volatility * annualizationFactor, 8)}\n`;
        csvContent += '\n';

        // Show the 90 returns used for this calculation
        csvContent += `The ${snapshot.returns.length} log returns used:\n`;
        csvContent += 'Index;Log Return;(Return - Mean);(Return - Mean)²\n';

        let sumSquaredDeviations = 0;
        snapshot.returns.forEach((ret, idx) => {
          const deviation = ret.log_return - snapshot.mean_return;
          const squaredDeviation = deviation * deviation;
          sumSquaredDeviations += squaredDeviation;
          csvContent += `${idx + 1};${formatNumber(ret.log_return, 8)};${formatNumber(deviation, 8)};${formatNumber(squaredDeviation, 10)}\n`;
        });

        csvContent += '\n';
        csvContent += 'Intermediate Calculations:\n';
        csvContent += `Sum of (Return - Mean)²;${formatNumber(sumSquaredDeviations, 10)}\n`;
        csvContent += `Variance = Sum / n;${formatNumber(sumSquaredDeviations / snapshot.returns.length, 10)}\n`;
        csvContent += `Daily Volatility = √Variance;${formatNumber(Math.sqrt(sumSquaredDeviations / snapshot.returns.length), 8)}\n`;
        csvContent += '\n';
      });

      csvContent += '\n';
    });

    // SECTION 4: Portfolio Volatility
    csvContent += '=== PORTFOLIO VOLATILITY (3 snapshots) ===\n';
    csvContent += 'This section shows the calculation of portfolio volatility\n';
    csvContent += `Formula: σ²_portfolio = w' × Σ × w\n`;
    csvContent += 'Where w = weight vector, Σ = covariance matrix\n';
    csvContent += '\n';

    portfolioVolatilityData.forEach((data, snapIndex) => {
      csvContent += `--- Snapshot ${snapIndex + 1}: ${formatDate(data.snapshot.date)} ---\n`;
      csvContent += '\n';

      csvContent += 'Portfolio Metrics:\n';
      csvContent += 'Metric;Value\n';
      csvContent += `Date;${formatDate(data.snapshot.date)}\n`;
      csvContent += `Window (days);${data.snapshot.window_days}\n`;
      csvContent += `Number of Constituents;${data.snapshot.num_constituents}\n`;
      csvContent += `Total Market Cap (USD);${formatNumber(data.snapshot.total_market_cap_usd, 2)}\n`;
      csvContent += `Portfolio Daily Volatility;${formatNumber(data.snapshot.daily_volatility, 8)}\n`;
      csvContent += `Portfolio Annualized Volatility;${formatNumber(data.snapshot.annualized_volatility, 8)}\n`;
      csvContent += `Annualization Verification;${formatNumber(data.snapshot.daily_volatility * annualizationFactor, 8)}\n`;
      csvContent += '\n';

      csvContent += `Top 10 constituents by weight:\n`;
      csvContent += 'Crypto;Symbol;Weight (w);Market Cap (USD);Daily Vol (σ);Annualized Vol;Contribution (w × σ)\n';

      let totalWeight = 0;
      let weightedVolSum = 0;

      data.constituents.forEach(c => {
        totalWeight += c.weight;
        weightedVolSum += c.weight * c.daily_volatility;
        csvContent += `${c.crypto_name};${c.crypto_symbol};${formatNumber(c.weight, 6)};${formatNumber(c.market_cap_usd, 2)};${formatNumber(c.daily_volatility, 8)};${formatNumber(c.annualized_volatility, 8)};${formatNumber(c.weight * c.daily_volatility, 8)}\n`;
      });

      csvContent += '\n';
      csvContent += 'Validations:\n';
      csvContent += `Sum of Weights (must = 1.0);${formatNumber(totalWeight, 6)}\n`;
      csvContent += `Weighted Average of Individual Volatilities;${formatNumber(weightedVolSum, 8)}\n`;
      csvContent += `Portfolio Volatility (with correlations);${formatNumber(data.snapshot.daily_volatility, 8)}\n`;
      csvContent += `Diversification Benefit;${formatNumber(weightedVolSum - data.snapshot.daily_volatility, 8)}\n`;
      csvContent += '\n';
      csvContent += 'Note: Portfolio volatility is typically lower than the weighted average\n';
      csvContent += 'of individual volatilities due to imperfect correlations (diversification benefit)\n';
      csvContent += '\n';
    });

    // ========================================
    // SECTION 6: SAVE FILE
    // ========================================
    const exportDir = path.join(__dirname, '..', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Volatility_Validation_Export_${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    const BOM = '\ufeff';
    fs.writeFileSync(filepath, BOM + csvContent, 'utf8');

    const duration = Date.now() - startTime;
    log.info(`Volatility validation data exported successfully to: ${filepath}`);
    log.info(`Export completed in ${duration}ms`);
    log.info(`Total cryptos in log returns sample: ${logReturnsData.length}`);
    log.info(`Total cryptos in volatility sample: ${cryptoVolatilityData.length}`);
    log.info(`Total portfolio snapshots: ${portfolioVolatilityData.length}`);

    return filepath;

  } catch (error) {
    log.error(`Error exporting volatility validation data: ${error.message}`);
    throw error;
  }
}

// Run the command
exportVolatilityValidationData()
  .then((filepath) => {
    log.info('Volatility validation export command completed successfully');
    log.info(`File saved at: ${filepath}`);
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Volatility validation export command failed: ${error.message}`);
    process.exit(1);
  });
