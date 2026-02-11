import { spawn } from 'child_process';
import log from '../lib/log.js';

/**
 * Execute a command and return a promise
 * @param {string} command - Command to execute
 * @param {string} description - Description for logging
 * @returns {Promise<void>}
 */
function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    log.info(`=== ${description} ===`);

    const child = spawn('node', [command], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${description} failed with code ${code}`));
      } else {
        log.info(`✓ ${description} completed successfully\n`);
        resolve();
      }
    });

    child.on('error', (error) => {
      reject(new Error(`${description} failed: ${error.message}`));
    });
  });
}

/**
 * Main function to update all data and calculate the index
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipMetadata - Skip metadata fetch (default: false)
 */
async function updateAll(options = {}) {
  const startTime = Date.now();
  const {
    skipMetadata = false
  } = options;

  try {
    log.info('╔════════════════════════════════════════════════════════════╗');
    log.info('║         CoinRisqLab 80 - Complete Data Update & Index          ║');
    log.info('╚════════════════════════════════════════════════════════════╝\n');

    let step = 1;
    const totalSteps = 6 - (skipMetadata ? 1 : 0);

    // Step 1: Fetch cryptocurrency market data
    await executeCommand(
      'commands/fetchCryptoMarketData.js',
      `Step ${step++}/${totalSteps}: Fetching Cryptocurrency Market Data`
    );

    // Step 2: Fetch cryptocurrency metadata (optional, can be skipped to save API credits)
    if (!skipMetadata) {
      await executeCommand(
        'commands/fetchCryptoMetadata.js',
        `Step ${step++}/${totalSteps}: Fetching Cryptocurrency Metadata`
      );
    } else {
      log.info(`⊘ Skipping Cryptocurrency Metadata (--skip-metadata flag)\n`);
    }

    // Step 3: Fetch global market metrics
    await executeCommand(
      'commands/fetchGlobalMetrics.js',
      `Step ${step++}/${totalSteps}: Fetching Global Market Metrics`
    );

    // Step 4: Fetch Fear and Greed Index
    await executeCommand(
      'commands/fetchFearAndGreed.js',
      `Step ${step++}/${totalSteps}: Fetching Fear and Greed Index`
    );

    // Step 5: Calculate CoinRisqLab 80 Index
    await executeCommand(
      'commands/calculateCoinRisqLab80.js',
      `Step ${step++}/${totalSteps}: Calculating CoinRisqLab 80 Index`
    );

    // Step 6: Calculate Portfolio Volatility
    await executeCommand(
      'commands/updateVolatility.js',
      `Step ${step++}/${totalSteps}: Calculating Portfolio Volatility`
    );

    const duration = Date.now() - startTime;
    const durationSeconds = (duration / 1000).toFixed(2);

    log.info('╔════════════════════════════════════════════════════════════╗');
    log.info('║                    UPDATE COMPLETED                        ║');
    log.info('╚════════════════════════════════════════════════════════════╝');
    log.info(`Total execution time: ${durationSeconds}s (${duration}ms)`);
    log.info('All data successfully updated and index calculated!\n');

    if (skipMetadata) {
      log.info('ℹ Note: Metadata was skipped. Use the following to run it manually:');
      log.info('  - npm run fetch-crypto-metadata\n');
    }

  } catch (error) {
    log.error('╔════════════════════════════════════════════════════════════╗');
    log.error('║                     UPDATE FAILED                          ║');
    log.error('╚════════════════════════════════════════════════════════════╝');
    log.error(`Error: ${error.message}`);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipMetadata: args.includes('--skip-metadata')
};

// Show help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node commands/updateAll.js [options]

Options:
  --skip-metadata       Skip cryptocurrency metadata fetch (saves API credits)
  --help, -h            Show this help message

Examples:
  # Full update (default, includes all commands)
  npm run update-all

  # Quick update (skip metadata)
  node commands/updateAll.js --skip-metadata

Notes:
  - Metadata only needs to be updated occasionally (once per day is sufficient)
  - Market data, global metrics, and index should be updated frequently
`);
  process.exit(0);
}

// Run the update
updateAll(options)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Update failed: ${error.message}`);
    process.exit(1);
  });
