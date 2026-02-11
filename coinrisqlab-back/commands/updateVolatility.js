import { spawn } from 'child_process';
import log from '../lib/log.js';

/**
 * Orchestrates the full volatility and risk metrics calculation pipeline
 * 1. Calculate logarithmic returns
 * 2. Calculate individual crypto volatility
 * 3. Calculate portfolio volatility
 * 4. Calculate distribution statistics (skewness & kurtosis)
 * 5. Calculate VaR/CVaR statistics
 * 6. Calculate Beta/Alpha statistics
 * 7. Calculate SML statistics
 */
async function updateVolatility() {
  const startTime = Date.now();

  try {
    log.info('='.repeat(60));
    log.info('Starting Volatility & Risk Metrics Update Pipeline');
    log.info('='.repeat(60));

    // Step 1: Calculate logarithmic returns
    log.info('\n[1/7] Calculating logarithmic returns...');
    await runCommand('calculateLogReturns.js');

    // Step 2: Calculate individual crypto volatility
    log.info('\n[2/7] Calculating individual cryptocurrency volatility...');
    await runCommand('calculateCryptoVolatility.js');

    // Step 3: Calculate portfolio volatility
    log.info('\n[3/7] Calculating portfolio volatility...');
    await runCommand('calculatePortfolioVolatility.js');

    // Step 4: Calculate distribution statistics (skewness & kurtosis)
    log.info('\n[4/7] Calculating distribution statistics (skewness & kurtosis)...');
    await runCommand('calculateDistributionStats.js');

    // Step 5: Calculate VaR/CVaR statistics
    log.info('\n[5/7] Calculating VaR/CVaR statistics...');
    await runCommand('calculateVaRStats.js');

    // Step 6: Calculate Beta/Alpha statistics
    log.info('\n[6/7] Calculating Beta/Alpha statistics...');
    await runCommand('calculateBetaStats.js');

    // Step 7: Calculate SML statistics
    log.info('\n[7/7] Calculating SML statistics...');
    await runCommand('calculateSMLStats.js');

    const totalDuration = Date.now() - startTime;
    log.info('\n' + '='.repeat(60));
    log.info(`Volatility & Risk Metrics Pipeline Completed in ${(totalDuration / 1000).toFixed(2)}s`);
    log.info('='.repeat(60));

  } catch (error) {
    log.error(`Volatility update pipeline failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run a command script and wait for it to complete
 * @param {string} scriptName - Name of the script file in commands/
 * @returns {Promise<void>}
 */
function runCommand(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = `./commands/${scriptName}`;

    log.info(`Executing: ${scriptName}`);

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        log.info(`${scriptName} completed successfully`);
        resolve();
      } else {
        const errorMsg = `${scriptName} failed with exit code ${code}`;
        log.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });

    child.on('error', (error) => {
      log.error(`Failed to start ${scriptName}: ${error.message}`);
      reject(error);
    });
  });
}

// Run the pipeline
updateVolatility()
  .then(() => {
    log.info('Pipeline completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Pipeline failed: ${error.message}`);
    process.exit(1);
  });
