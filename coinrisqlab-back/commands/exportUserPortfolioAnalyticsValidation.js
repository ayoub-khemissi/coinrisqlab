import Database from '../lib/database.js';
import log from '../lib/log.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  getPortfolioHoldings,
  getAlignedReturns,
  getLatestBetaMap,
  getIndexLogReturnsMap,
  computeAnalyticsBundle,
} from '../utils/userPortfolioAnalytics.js';
import { mean, standardDeviation, variance, covariance } from '../utils/statistics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Export user portfolio analytics validation data to a CSV.
 *
 * Purpose: allow the business team to verify, from first principles, every
 * metric displayed on /dashboard/portfolios/[id]/analytics. The CSV includes
 * the raw inputs (holdings, aligned log returns), all intermediate calculations
 * (variance, covariance, sorted returns, regressions), and the final values.
 *
 * The metrics are computed using the SAME shared module as the route and the
 * batch command (utils/userPortfolioAnalytics.js), so values in the CSV are
 * byte-for-byte identical to what the user sees and to what is historized.
 *
 * Usage:
 *   node commands/exportUserPortfolioAnalyticsValidation.js <portfolio_id>
 *
 * Example:
 *   node commands/exportUserPortfolioAnalyticsValidation.js 2
 *
 * Output: exports/UserPortfolioAnalytics_Validation_<portfolio_id>_<timestamp>.csv
 */

async function exportUserPortfolioAnalyticsValidation(portfolioIdArg) {
  const startTime = Date.now();

  try {
    const portfolioId = parseInt(portfolioIdArg);
    if (!portfolioId || Number.isNaN(portfolioId)) {
      throw new Error(
        'Usage: node commands/exportUserPortfolioAnalyticsValidation.js <portfolio_id>'
      );
    }

    log.info(`Starting validation export for portfolio ${portfolioId}...`);

    // ========================================
    // SECTION 0: METADATA
    // ========================================
    const [portfolioRows] = await Database.execute(
      `SELECT up.id, up.name, up.description, up.user_id, u.email, u.display_name, u.plan
       FROM user_portfolios up
       INNER JOIN users u ON up.user_id = u.id
       WHERE up.id = ?`,
      [portfolioId]
    );

    if (portfolioRows.length === 0) {
      throw new Error(`Portfolio ${portfolioId} not found`);
    }
    const portfolioMeta = portfolioRows[0];

    // ========================================
    // SECTION 1: FETCH INPUTS (same as the route)
    // ========================================
    const holdings = await getPortfolioHoldings(portfolioId);

    if (holdings.length === 0) {
      throw new Error(`Portfolio ${portfolioId} has no holdings — nothing to validate`);
    }

    const cryptoIds = holdings.map((h) => h.crypto_id);
    const [{ returnsByCryptoLog, returnsByCryptoSimple, alignedDates }, betaMap, indexReturnMap] =
      await Promise.all([
        getAlignedReturns(cryptoIds, '365d'),
        getLatestBetaMap(cryptoIds),
        getIndexLogReturnsMap(),
      ]);

    // ========================================
    // SECTION 2: RUN THE SHARED CALCULATION
    // ========================================
    const { bundle, raw } = computeAnalyticsBundle({
      holdings,
      returnsByCryptoLog,
      returnsByCryptoSimple,
      alignedDates,
      betaMap,
      indexReturnMap,
      computeProMetrics: true,
    });

    // ========================================
    // SECTION 3: GENERATE CSV
    // ========================================
    log.info('Generating CSV content...');

    const fmtDate = (d) => {
      if (!d) return '';
      const dt = d instanceof Date ? d : new Date(d);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    };

    const fmtNum = (n, decimals = null) => {
      if (n === null || n === undefined || Number.isNaN(n) || !Number.isFinite(n)) return '';
      const s = decimals !== null ? Number(n).toFixed(decimals) : String(n);
      return s.replace('.', ',');
    };

    let csv = '';

    // --- Header ---
    csv += '=== USER PORTFOLIO ANALYTICS VALIDATION EXPORT ===\n';
    csv += `Generated;${fmtDate(new Date())}\n`;
    csv += `Source;/dashboard/portfolios/${portfolioId}/analytics (via /user/portfolios/${portfolioId}/analytics-bundle)\n`;
    csv += `Shared calc module;utils/userPortfolioAnalytics.js (computeAnalyticsBundle)\n`;
    csv += '\n';

    // --- Portfolio metadata ---
    csv += '=== PORTFOLIO METADATA ===\n';
    csv += 'Field;Value\n';
    csv += `Portfolio ID;${portfolioMeta.id}\n`;
    csv += `Portfolio Name;${portfolioMeta.name || ''}\n`;
    csv += `Description;${portfolioMeta.description || ''}\n`;
    csv += `User ID;${portfolioMeta.user_id}\n`;
    csv += `User Email;${portfolioMeta.email}\n`;
    csv += `User Display Name;${portfolioMeta.display_name || ''}\n`;
    csv += `User Plan;${portfolioMeta.plan}\n`;
    csv += '\n';

    // --- Base parameters ---
    csv += '=== BASE PARAMETERS ===\n';
    csv += 'Parameter;Value\n';
    csv += `Target Window (days);90\n`;
    csv += `Actual Aligned Data Points;${raw.dataPoints}\n`;
    csv += `Has Enough Data (>= 10);${raw.hasEnoughData ? 'TRUE' : 'FALSE'}\n`;
    csv += `Return Type (statistical metrics);Logarithmic (ln(P_t / P_t-1)) — volatility, skewness, kurtosis, correlation, beta regression\n`;
    csv += `Return Type (economic metrics);Simple ((P_t / P_t-1) - 1) — VaR, CVaR, Sharpe, min/max/mean return\n`;
    csv += `Annualization Factor;${fmtNum(Math.sqrt(365), 6)}\n`;
    csv += `Annualization Formula;σ_annual = σ_daily × √365\n`;
    csv += `Trading Days per Year;365\n`;
    csv += `Risk-Free Rate;0 (simplified)\n`;
    csv += `Benchmark Index;CoinRisqLab 80\n`;
    csv += `Number of Holdings;${raw.numHoldings}\n`;
    csv += `Total Portfolio Value (USD);${fmtNum(raw.totalValue, 2)}\n`;
    csv += '\n';

    // --- Composition ---
    csv += '=== PORTFOLIO COMPOSITION (as of calculation time) ===\n';
    csv += 'Formulas:\n';
    csv += '  current_value = quantity × current_price\n';
    csv += '  weight = current_value / total_value\n';
    csv += '\n';
    csv +=
      'Crypto ID;Symbol;Name;Quantity;Avg Buy Price (USD);Current Price (USD);Current Value (USD);Weight;Beta (from crypto_beta);Daily Volatility;Annualized Volatility\n';
    let sumWeight = 0;
    let sumValue = 0;
    for (const c of raw.constituents) {
      sumWeight += c.weight || 0;
      sumValue += c.current_value || 0;
      csv +=
        [
          c.crypto_id,
          c.symbol,
          c.name,
          fmtNum(c.quantity, 18),
          fmtNum(c.avg_buy_price, 8),
          fmtNum(c.current_price, 8),
          fmtNum(c.current_value, 8),
          fmtNum(c.weight, 8),
          fmtNum(c.beta, 6),
          fmtNum(c.daily_volatility, 10),
          fmtNum(c.annualized_volatility, 10),
        ].join(';') + '\n';
    }
    csv += '\n';
    csv += 'Validations:\n';
    csv += `Sum of Weights (must = 1.0);${fmtNum(sumWeight, 8)}\n`;
    csv += `Sum of Current Values (must = Total Portfolio Value);${fmtNum(sumValue, 2)}\n`;
    csv += '\n';

    if (!raw.hasEnoughData) {
      csv += '=== INSUFFICIENT DATA ===\n';
      csv += `Only ${raw.dataPoints} aligned data points (need >= 10).\n`;
      csv += 'No further metrics computed.\n';
      writeFile(portfolioId, csv);
      log.info(`Export completed in ${Date.now() - startTime}ms (insufficient data)`);
      return;
    }

    // --- Aligned log returns ---
    csv += '=== ALIGNED LOG RETURNS (statistical metrics) ===\n';
    csv += 'Used for: volatility, skewness, kurtosis, correlation matrix, beta/alpha regression.\n';
    csv +=
      'Only dates where ALL constituents have a log AND simple return are kept (inner-join).\n';
    csv += 'Source: crypto_log_returns, period=90d, date < CURDATE()\n';
    csv += '\n';
    csv +=
      'Index;Date;' +
      raw.constituents.map((c) => c.symbol).join(';') +
      ';Portfolio Synthetic Log Return (Σ w_i × r_i)\n';
    for (let d = 0; d < alignedDates.length; d++) {
      const row = [d + 1, alignedDates[d]];
      let portReturn = 0;
      for (const c of raw.constituents) {
        const r = returnsByCryptoLog[c.crypto_id][d];
        row.push(fmtNum(r, 10));
        portReturn += c.weight * r;
      }
      row.push(fmtNum(portReturn, 10));
      csv += row.join(';') + '\n';
    }
    csv += '\n';

    // --- Aligned simple returns ---
    csv += '=== ALIGNED SIMPLE RETURNS (economic metrics) ===\n';
    csv += 'Used for: VaR, CVaR, Sharpe, min/max/mean return.\n';
    csv += 'Source: crypto_simple_returns, period=90d, date < CURDATE()\n';
    csv += '\n';
    csv +=
      'Index;Date;' +
      raw.constituents.map((c) => c.symbol).join(';') +
      ';Portfolio Synthetic Simple Return (Σ w_i × r_i)\n';
    for (let d = 0; d < alignedDates.length; d++) {
      const row = [d + 1, alignedDates[d]];
      let portReturn = 0;
      for (const c of raw.constituents) {
        const r = returnsByCryptoSimple[c.crypto_id][d];
        row.push(fmtNum(r, 10));
        portReturn += c.weight * r;
      }
      row.push(fmtNum(portReturn, 10));
      csv += row.join(';') + '\n';
    }
    csv += '\n';

    // --- Volatility calculation ---
    csv += '=== PORTFOLIO VOLATILITY (σ_p = sqrt(w^T × Σ × w)) ===\n';
    csv += 'Formula: σ²_portfolio = Σ_i Σ_j w_i × w_j × Cov(r_i, r_j)\n';
    csv += 'Where w = weight vector, Σ = covariance matrix of constituent log returns\n';
    csv += 'Sample (co)variance uses n-1 denominator.\n';
    csv += '\n';

    csv += '--- Covariance matrix (n-1, on log returns) ---\n';
    csv += ';' + raw.constituents.map((c) => c.symbol).join(';') + '\n';
    for (let i = 0; i < raw.constituents.length; i++) {
      const rowVals = [raw.constituents[i].symbol];
      for (let j = 0; j < raw.constituents.length; j++) {
        const cov =
          i === j
            ? variance(returnsByCryptoLog[raw.constituents[i].crypto_id])
            : covariance(
                returnsByCryptoLog[raw.constituents[i].crypto_id],
                returnsByCryptoLog[raw.constituents[j].crypto_id]
              );
        rowVals.push(fmtNum(cov, 12));
      }
      csv += rowVals.join(';') + '\n';
    }
    csv += '\n';

    csv += '--- Individual volatilities ---\n';
    csv += 'Symbol;Weight;Daily Vol (std of returns);Annualized Vol;Contribution (w × σ)\n';
    let weightedAvgVolCheck = 0;
    for (const c of raw.constituents) {
      weightedAvgVolCheck += c.weight * (c.daily_volatility || 0);
      csv +=
        [
          c.symbol,
          fmtNum(c.weight, 8),
          fmtNum(c.daily_volatility, 12),
          fmtNum(c.annualized_volatility, 12),
          fmtNum(c.weight * (c.daily_volatility || 0), 12),
        ].join(';') + '\n';
    }
    csv += '\n';
    csv += 'Portfolio Volatility Results:\n';
    csv += `Daily Portfolio Volatility (from covariance matrix);${fmtNum(raw.dailyVolatility, 12)}\n`;
    csv += `Annualized Portfolio Volatility;${fmtNum(raw.annualizedVolatility, 12)}\n`;
    csv += `Weighted Average of Individual Vols (recomputed);${fmtNum(weightedAvgVolCheck, 12)}\n`;
    csv += `Weighted Average of Individual Vols (from shared fn);${fmtNum(raw.weightedAvgVolatility, 12)}\n`;
    csv += `Diversification Benefit % ((avg − port) / avg × 100);${fmtNum(raw.diversificationBenefit, 6)}\n`;
    csv += '\n';
    csv += 'Displayed on frontend (rounded):\n';
    csv += `Daily Volatility (6 decimals);${fmtNum(bundle.volatility.dailyVolatility, 6)}\n`;
    csv += `Annualized Volatility (%, 2 decimals);${fmtNum(bundle.volatility.annualizedVolatility, 2)}\n`;
    csv += '\n';

    // --- Return statistics ---
    csv += '=== PORTFOLIO RETURN STATISTICS (simple returns — economic interpretation) ===\n';
    csv += 'Based on the synthetic portfolio simple returns (one per aligned date).\n';
    csv += 'Formulas:\n';
    csv += '  mean μ = (1/n) × Σ r_i\n';
    csv += '  std σ = sqrt((1/(n-1)) × Σ (r_i − μ)²)\n';
    csv += '\n';
    csv += 'Sorted portfolio simple returns (ascending) — used for historical VaR/CVaR:\n';
    const sortedReturns = [...raw.portfolioReturns].sort((a, b) => a - b);
    csv += 'Rank;Return\n';
    for (let i = 0; i < sortedReturns.length; i++) {
      csv += `${i + 1};${fmtNum(sortedReturns[i], 12)}\n`;
    }
    csv += '\n';
    const meanCheck = mean(raw.portfolioReturns);
    const stdCheck = standardDeviation(raw.portfolioReturns);
    csv += 'Metric;From shared fn;Recomputed check\n';
    csv += `n;${raw.portfolioReturns.length};${raw.portfolioReturns.length}\n`;
    csv += `Mean daily return;${fmtNum(raw.meanDailyReturn, 12)};${fmtNum(meanCheck, 12)}\n`;
    csv += `Daily std (sample, n-1);${fmtNum(raw.dailyStd, 12)};${fmtNum(stdCheck, 12)}\n`;
    csv += `Min return;${fmtNum(raw.minReturn, 12)};\n`;
    csv += `Max return;${fmtNum(raw.maxReturn, 12)};\n`;
    csv += `Annualized return (mean × 365);${fmtNum(raw.annualizedReturn, 12)};${fmtNum(meanCheck * 365, 12)}\n`;
    csv += '\n';

    // --- VaR / CVaR ---
    csv += '=== VaR / CVaR (Historical method) ===\n';
    csv += 'Formula (numpy method="lower"):\n';
    csv += '  index = floor((percentile/100) × n) - 1\n';
    csv += '  VaR = -sorted[index]       (positive value = loss)\n';
    csv += '  CVaR = -mean(sorted[0..index])\n';
    csv += '\n';
    const n = raw.portfolioReturns.length;
    const i95 = Math.max(0, Math.floor((5 / 100) * n) - 1);
    const i99 = Math.max(0, Math.floor((1 / 100) * n) - 1);
    csv += `n;${n}\n`;
    csv += `Index for VaR 95% (floor(0.05 × n) - 1);${i95}\n`;
    csv += `Index for VaR 99% (floor(0.01 × n) - 1);${i99}\n`;
    csv += `Sorted return @ VaR 95 index;${fmtNum(sortedReturns[i95], 12)}\n`;
    csv += `Sorted return @ VaR 99 index;${fmtNum(sortedReturns[i99], 12)}\n`;
    csv += '\n';
    csv += 'Metric;Raw;Frontend (% × 100, 4 decimals)\n';
    csv += `VaR 95;${fmtNum(raw.var95, 12)};${fmtNum(bundle.riskMetrics.var95, 4)}\n`;
    csv += `VaR 99;${fmtNum(raw.var99, 12)};${fmtNum(bundle.riskMetrics.var99, 4)}\n`;
    csv += `CVaR 95;${fmtNum(raw.cvar95, 12)};${fmtNum(bundle.riskMetrics.cvar95, 4)}\n`;
    csv += `CVaR 99;${fmtNum(raw.cvar99, 12)};${fmtNum(bundle.riskMetrics.cvar99, 4)}\n`;
    csv += '\n';

    // --- Sharpe ---
    csv += '=== SHARPE RATIO ===\n';
    csv += 'Formula (Rf=0): S = (mean(r) / std(r)) × √365\n';
    csv += `Sharpe Ratio (annualized);${fmtNum(raw.sharpeRatio, 12)}\n`;
    csv += `Displayed on frontend (4 decimals);${fmtNum(bundle.riskMetrics.sharpe, 4)}\n`;
    csv += '\n';

    // --- Skewness / Kurtosis ---
    csv += '=== SKEWNESS / KURTOSIS (Fisher, bias-corrected — on log returns) ===\n';
    csv += 'Skewness = (n / ((n−1)(n−2))) × Σ z_i³,  z_i = (r_i − μ) / σ\n';
    csv += 'Kurtosis = ((n(n+1)) / ((n−1)(n−2)(n−3))) × Σ z_i⁴ − (3(n−1)²) / ((n−2)(n−3))\n';
    csv += '\n';
    csv += `Skewness;${fmtNum(raw.skewness, 6)}\n`;
    csv += `Kurtosis (excess);${fmtNum(raw.kurtosis, 6)}\n`;
    csv += '\n';

    // --- Beta / Alpha regression vs index ---
    csv += '=== BETA / ALPHA REGRESSION (portfolio vs CoinRisqLab 80) ===\n';
    csv += 'Formulas (OLS):\n';
    csv += '  β = Cov(R_p, R_m) / Var(R_m)\n';
    csv += '  α = mean(R_p) − β × mean(R_m)\n';
    csv += '  R² = correlation²\n';
    csv += '\n';
    csv += 'Aligned (portfolio, index) observations used:\n';
    csv += `n;${raw.betaAlphaObservations}\n`;
    csv += `β (from regression);${fmtNum(raw.betaRegression, 6)}\n`;
    csv += `α daily (regression intercept);${fmtNum(raw.alphaRegression, 10)}\n`;
    csv += `α annualized % (×36500);${fmtNum((raw.alphaRegression || 0) * 36500, 6)}\n`;
    csv += `R²;${fmtNum(raw.rSquared, 6)}\n`;
    csv += `Correlation with index;${fmtNum(raw.correlationWithIndex, 6)}\n`;
    csv += '\n';
    csv += 'Alternative: portfolio beta as weighted sum of constituent betas (Σ w_i × β_i):\n';
    csv += `β_weighted;${fmtNum(raw.portfolioBetaWeighted, 6)}\n`;
    csv += `Displayed β on volatility panel (4 decimals);${fmtNum(bundle.volatility.beta, 4)}\n`;
    csv += '\n';

    // --- Correlation matrix ---
    if (raw.correlationMatrix) {
      csv += '=== CORRELATION MATRIX (constituents) ===\n';
      csv += 'ρ(i,j) = Cov(r_i, r_j) / (σ_i × σ_j)\n';
      csv += '\n';
      csv += ';' + raw.correlationSymbols.join(';') + '\n';
      for (let i = 0; i < raw.correlationMatrix.length; i++) {
        csv +=
          raw.correlationSymbols[i] +
          ';' +
          raw.correlationMatrix[i].map((v) => fmtNum(v, 6)).join(';') +
          '\n';
      }
      csv += '\n';
    }

    // --- Persisted DB comparison ---
    csv += '=== DB ROW CROSS-CHECK (user_portfolio_analytics) ===\n';
    const [dbRows] = await Database.execute(
      `SELECT * FROM user_portfolio_analytics
       WHERE portfolio_id = ? AND date = CURDATE() AND window_days = 90`,
      [portfolioId]
    );
    if (dbRows.length === 0) {
      csv +=
        'No persisted row for today. Run commands/calculateUserPortfolioAnalytics.js to create it.\n';
    } else {
      const db = dbRows[0];
      csv += 'Field;DB value;Recomputed value;Match\n';
      const pairs = [
        ['total_value_usd', db.total_value_usd, raw.totalValue],
        ['data_points', db.data_points, raw.dataPoints],
        ['daily_volatility', db.daily_volatility, raw.dailyVolatility],
        ['annualized_volatility', db.annualized_volatility, raw.annualizedVolatility],
        ['weighted_avg_volatility', db.weighted_avg_volatility, raw.weightedAvgVolatility],
        ['diversification_benefit', db.diversification_benefit, raw.diversificationBenefit],
        ['mean_daily_return', db.mean_daily_return, raw.meanDailyReturn],
        ['daily_std', db.daily_std, raw.dailyStd],
        ['var_95', db.var_95, raw.var95],
        ['var_99', db.var_99, raw.var99],
        ['cvar_95', db.cvar_95, raw.cvar95],
        ['cvar_99', db.cvar_99, raw.cvar99],
        ['skewness', db.skewness, raw.skewness],
        ['kurtosis', db.kurtosis, raw.kurtosis],
        ['sharpe_ratio', db.sharpe_ratio, raw.sharpeRatio],
        ['portfolio_beta_weighted', db.portfolio_beta_weighted, raw.portfolioBetaWeighted],
        ['beta_regression', db.beta_regression, raw.betaRegression],
        ['alpha_regression', db.alpha_regression, raw.alphaRegression],
        ['r_squared', db.r_squared, raw.rSquared],
        ['correlation_with_index', db.correlation_with_index, raw.correlationWithIndex],
      ];
      for (const [field, dbVal, rawVal] of pairs) {
        const dbNum = dbVal !== null ? parseFloat(dbVal) : null;
        const tolerance = 1e-9;
        const match =
          dbNum !== null && rawVal !== null
            ? Math.abs(dbNum - rawVal) < tolerance
              ? 'OK'
              : 'DIFF'
            : dbNum === null && rawVal === null
              ? 'OK (both null)'
              : 'DIFF';
        csv += `${field};${fmtNum(dbNum, 12)};${fmtNum(rawVal, 12)};${match}\n`;
      }
    }
    csv += '\n';

    writeFile(portfolioId, csv);
    log.info(`Export completed in ${Date.now() - startTime}ms`);
  } catch (error) {
    log.error(`Error exporting validation data: ${error.message}`);
    throw error;
  }
}

function writeFile(portfolioId, csvContent) {
  const exportDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `UserPortfolioAnalytics_Validation_${portfolioId}_${timestamp}.csv`;
  const filepath = path.join(exportDir, filename);

  const BOM = '\ufeff';
  fs.writeFileSync(filepath, BOM + csvContent, 'utf8');

  log.info(`Validation export saved to: ${filepath}`);
  return filepath;
}

// CLI entry point
const portfolioIdArg = process.argv[2];

exportUserPortfolioAnalyticsValidation(portfolioIdArg)
  .then(() => {
    log.info('Validation export command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Validation export command failed: ${error.message}`);
    process.exit(1);
  });
