import fs from 'fs';
import path from 'path';
import { mean, standardDeviation, logReturn, annualizeVolatility } from '../utils/statistics.js';

/**
 * Calculate volatility from a CSV file
 * CSV format: Symbol;Name;Price1;Price2;Price3;...
 * Or: Symbol;Price1;Price2;Price3;...
 * Or: Price1;Price2;Price3;... (single crypto)
 *
 * Prices should use comma as decimal separator (e.g., 1234,56)
 */
async function calculateVolatilityFromCSV() {
  // Get CSV file path from command line argument
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: node calculateVolatilityFromCSV.js <csv_file_path>');
    console.error('Example: node calculateVolatilityFromCSV.js ../exports/prices.csv');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }

  console.log(`Reading CSV file: ${absolutePath}`);
  console.log('');

  const content = fs.readFileSync(absolutePath, 'utf8');
  const lines = content.trim().split('\n');

  const results = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    if (!line) continue;

    const parts = line.split(';');

    // Try to detect format
    let symbol = `Crypto_${lineIndex + 1}`;
    let name = '';
    let priceStrings = [];

    // Check if first column looks like a symbol (not a number)
    const firstPart = parts[0].replace(',', '.');
    if (isNaN(parseFloat(firstPart))) {
      symbol = parts[0];
      // Check if second column is also text (name)
      const secondPart = parts[1]?.replace(',', '.');
      if (parts.length > 2 && isNaN(parseFloat(secondPart))) {
        name = parts[1];
        priceStrings = parts.slice(2);
      } else {
        priceStrings = parts.slice(1);
      }
    } else {
      // All columns are prices
      priceStrings = parts;
    }

    // Parse prices (handle comma as decimal separator)
    const prices = priceStrings
      .map(p => parseFloat(p.replace(',', '.')))
      .filter(p => !isNaN(p) && p > 0);

    if (prices.length < 2) {
      console.log(`${symbol}: Insufficient price data (${prices.length} prices, need at least 2)`);
      continue;
    }

    // Calculate log returns
    const logReturns = [];
    for (let i = 1; i < prices.length; i++) {
      logReturns.push(logReturn(prices[i], prices[i - 1]));
    }

    // Calculate statistics
    const meanReturn = mean(logReturns);
    const dailyVol = standardDeviation(logReturns, meanReturn);
    const annualizedVol = annualizeVolatility(dailyVol);

    results.push({
      symbol,
      name,
      prices,
      logReturns,
      numPrices: prices.length,
      numReturns: logReturns.length,
      meanReturn,
      dailyVolatility: dailyVol,
      annualizedVolatility: annualizedVol
    });

    // Display results in console
    console.log(`=== ${symbol}${name ? ` (${name})` : ''} ===`);
    console.log(`  Prices:              ${prices.length}`);
    console.log(`  Log returns:         ${logReturns.length}`);
    console.log(`  Mean return:         ${(meanReturn * 100).toFixed(6)}%`);
    console.log(`  Daily volatility:    ${(dailyVol * 100).toFixed(4)}%`);
    console.log(`  Annual volatility:   ${(annualizedVol * 100).toFixed(2)}%`);
    console.log('');
  }

  // Generate detailed report
  if (results.length > 0) {
    const reportPath = absolutePath.replace(/\.[^/.]+$/, "") + "_report.md";
    let reportContent = `# Volatility Calculation Report\n\n`;
    reportContent += `**Date:** ${new Date().toLocaleString()}\n`;
    reportContent += `**Source File:** ${absolutePath}\n\n`;

    reportContent += `## Summary\n\n`;
    reportContent += `| Symbol | Prices | Log Returns | Daily Vol | Annual Vol |\n`;
    reportContent += `| :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of results) {
      reportContent += `| ${r.symbol} | ${r.numPrices} | ${r.numReturns} | ${(r.dailyVolatility * 100).toFixed(4)}% | ${(r.annualizedVolatility * 100).toFixed(2)}% |\n`;
    }
    reportContent += `\n---\n\n`;

    for (const r of results) {
      reportContent += `## Details: ${r.symbol} ${r.name ? `(${r.name})` : ''}\n\n`;
      reportContent += `### Statistics\n`;
      reportContent += `- **Mean Return:** ${(r.meanReturn * 100).toFixed(8)}%\n`;
      reportContent += `- **Daily Volatility:** ${(r.dailyVolatility * 100).toFixed(6)}%\n`;
      reportContent += `- **Annualized Volatility (252d):** ${(r.dailyVolatility * Math.sqrt(252) * 100).toFixed(4)}%\n`;
      reportContent += `- **Annualized Volatility (365d):** ${(r.annualizedVolatility * 100).toFixed(4)}%\n\n`;

      reportContent += `### Calculation Table\n\n`;
      reportContent += `| Day | Price (t-1) | Price (t) | Log Return | Log Return (%) |\n`;
      reportContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

      for (let i = 0; i < r.logReturns.length; i++) {
        const pPrev = r.prices[i];
        const pCurr = r.prices[i + 1];
        const lRet = r.logReturns[i];
        reportContent += `| ${i + 1} | ${pPrev.toFixed(8)} | ${pCurr.toFixed(8)} | ${lRet.toFixed(10)} | ${(lRet * 100).toFixed(6)}% |\n`;
      }
      reportContent += `\n\n`;
    }

    fs.writeFileSync(reportPath, reportContent);
    console.log(`Detailed report generated: ${reportPath}`);
  }

  // Summary table in console
  console.log('=== SUMMARY ===');
  console.log(`Processed ${results.length} crypto(s)`);

  if (results.length > 0) {
    console.log('');
    console.log('Symbol'.padEnd(15) + 'Prices'.padEnd(10) + 'Daily Vol'.padEnd(15) + 'Annual Vol');
    console.log('-'.repeat(55));
    for (const r of results) {
      console.log(
        r.symbol.padEnd(15) +
        r.numPrices.toString().padEnd(10) +
        `${(r.dailyVolatility * 100).toFixed(4)}%`.padEnd(15) +
        `${(r.annualizedVolatility * 100).toFixed(2)}%`
      );
    }
  }

  return results;
}

// Run the command
calculateVolatilityFromCSV()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  });
