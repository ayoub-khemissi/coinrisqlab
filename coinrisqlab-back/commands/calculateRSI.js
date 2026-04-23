import Database from '../lib/database.js';
import log from '../lib/log.js';

const RSI_WINDOW = 14;
const MIN_OBS = RSI_WINDOW + 1; // need 15 closes to compute the first RSI

/**
 * Calculate and store the 14-day RSI (Wilder smoothing) for all cryptos.
 * Uses OHLC daily closes. Idempotent: existing dates are skipped.
 */
async function calculateRSI() {
  const startTime = Date.now();

  try {
    log.info('Starting RSI calculation...');

    const [cryptos] = await Database.execute(`
      SELECT DISTINCT c.id, c.symbol
      FROM cryptocurrencies c
      INNER JOIN ohlc o ON c.id = o.crypto_id
      GROUP BY c.id, c.symbol
      HAVING COUNT(DISTINCT DATE(o.timestamp)) >= ?
      ORDER BY c.symbol
    `, [MIN_OBS]);

    log.info(`Found ${cryptos.length} cryptocurrencies with sufficient OHLC data (>= ${MIN_OBS} days)`);

    let totalCalculated = 0;
    let totalSkipped = 0;
    let errors = 0;

    for (const crypto of cryptos) {
      try {
        const result = await calculateRSIForCrypto(crypto.id, crypto.symbol);
        totalCalculated += result.inserted;
        totalSkipped += result.skipped;
      } catch (error) {
        log.error(`Error calculating RSI for ${crypto.symbol}: ${error.message}`);
        errors++;
      }
    }

    const duration = Date.now() - startTime;
    log.info(`RSI calculation completed in ${duration}ms`);
    log.info(`Total calculated: ${totalCalculated}, Skipped: ${totalSkipped}, Errors: ${errors}`);
  } catch (error) {
    log.error(`Error in calculateRSI: ${error.message}`);
    throw error;
  }
}

/**
 * Compute RSI(14) per Wilder's smoothing for one crypto.
 *
 *   change[i] = close[i] - close[i-1]
 *   gain[i]   = max(change[i], 0)
 *   loss[i]   = max(-change[i], 0)
 *
 *   For the first 14 changes:
 *     avgGain = mean(gain[1..14])
 *     avgLoss = mean(loss[1..14])
 *
 *   For each subsequent change i (Wilder smoothing):
 *     avgGain[i] = (avgGain[i-1] * 13 + gain[i]) / 14
 *     avgLoss[i] = (avgLoss[i-1] * 13 + loss[i]) / 14
 *
 *   RS  = avgGain / avgLoss
 *   RSI = 100 - 100 / (1 + RS)
 */
async function calculateRSIForCrypto(cryptoId, symbol) {
  // Daily closes (latest of each day, today excluded — same as MA script)
  const [dailyCloses] = await Database.execute(`
    SELECT DATE(o.timestamp) as date, o.close
    FROM ohlc o
    INNER JOIN (
      SELECT crypto_id, DATE(timestamp) as d, MAX(timestamp) as max_ts
      FROM ohlc
      WHERE crypto_id = ?
        AND DATE(timestamp) < CURDATE()
        AND close > 0
      GROUP BY crypto_id, DATE(timestamp)
    ) latest ON o.crypto_id = latest.crypto_id AND o.timestamp = latest.max_ts
    WHERE o.crypto_id = ?
    ORDER BY date ASC
  `, [cryptoId, cryptoId]);

  if (dailyCloses.length < MIN_OBS) {
    return { inserted: 0, skipped: 0 };
  }

  // Daily changes from t-1 to t
  const changes = [];

  for (let i = 1; i < dailyCloses.length; i++) {
    changes.push({
      date: dailyCloses[i].date,
      change: parseFloat(dailyCloses[i].close) - parseFloat(dailyCloses[i - 1].close),
    });
  }

  let avgGain = 0;
  let avgLoss = 0;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    const gain = Math.max(c.change, 0);
    const loss = Math.max(-c.change, 0);

    if (i < RSI_WINDOW - 1) continue; // need at least 14 changes seeded

    if (i === RSI_WINDOW - 1) {
      // Seed: simple average over the first 14 changes
      const slice = changes.slice(0, RSI_WINDOW);

      avgGain = slice.reduce((s, x) => s + Math.max(x.change, 0), 0) / RSI_WINDOW;
      avgLoss = slice.reduce((s, x) => s + Math.max(-x.change, 0), 0) / RSI_WINDOW;
    } else {
      // Wilder smoothing
      avgGain = (avgGain * (RSI_WINDOW - 1) + gain) / RSI_WINDOW;
      avgLoss = (avgLoss * (RSI_WINDOW - 1) + loss) / RSI_WINDOW;
    }

    let rsi;

    if (avgLoss === 0) rsi = avgGain === 0 ? 50 : 100;
    else {
      const rs = avgGain / avgLoss;

      rsi = 100 - 100 / (1 + rs);
    }

    // Skip if already stored
    const [existing] = await Database.execute(
      'SELECT id FROM crypto_rsi WHERE crypto_id = ? AND date = ? AND window_days = ?',
      [cryptoId, c.date, RSI_WINDOW],
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await Database.execute(`
      INSERT INTO crypto_rsi
      (crypto_id, date, window_days, rsi, num_observations)
      VALUES (?, ?, ?, ?, ?)
    `, [cryptoId, c.date, RSI_WINDOW, rsi, RSI_WINDOW]);

    inserted++;
  }

  if (inserted > 0) {
    log.debug(`${symbol}: Calculated ${inserted} RSI points, skipped ${skipped}`);
  }

  return { inserted, skipped };
}

calculateRSI()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
