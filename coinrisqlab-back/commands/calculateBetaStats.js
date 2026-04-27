import Database from '../lib/database.js';
import log from '../lib/log.js';
import { calculateBetaAlpha } from '../utils/riskMetrics.js';
import { simpleReturn } from '../utils/statistics.js';

const MINIMUM_WINDOW_DAYS = 7;

// Two betas are persisted side-by-side, distinguished by `return_type`:
//   - 'log'    : log returns, max 365 days → descriptive statistical metric
//   - 'simple' : simple returns, max 90 days → economic metric, used by SML
const PASSES = [
  { returnType: 'log', maxWindow: 365, table: 'crypto_log_returns', col: 'log_return' },
  { returnType: 'simple', maxWindow: 90, table: 'crypto_simple_returns', col: 'simple_return' },
];

async function calculateBetaStats() {
  const startTime = Date.now();

  try {
    log.info('Starting Beta statistics calculation (dual-pass: log/365 + simple/90)...');

    await ensureTableExists();

    // Index returns: log version (for the log pass)
    const [indexLogReturns] = await Database.execute(`
      SELECT
        date,
        LN(index_level / LAG(index_level) OVER (ORDER BY date)) as log_return
      FROM (
        SELECT
          DATE(snapshot_date) as date,
          SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as index_level
        FROM index_history ih
        INNER JOIN index_config ic ON ih.index_config_id = ic.id
        WHERE ic.index_name = 'CoinRisqLab 80'
          AND DATE(snapshot_date) < CURDATE()
        GROUP BY DATE(snapshot_date)
      ) daily
      ORDER BY date ASC
    `);

    const indexLogByDate = new Map();

    for (const r of indexLogReturns) {
      if (r.log_return !== null) {
        indexLogByDate.set(r.date.toISOString().split('T')[0], parseFloat(r.log_return));
      }
    }

    // Index returns: simple version (for the simple pass) — computed from
    // consecutive index levels so we apply the same filter as the SML script.
    const [indexLevels] = await Database.execute(`
      SELECT
        DATE(snapshot_date) as date,
        SUBSTRING_INDEX(GROUP_CONCAT(index_level ORDER BY snapshot_date DESC), ',', 1) + 0 as index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        AND DATE(snapshot_date) < CURDATE()
      GROUP BY DATE(snapshot_date)
      ORDER BY date ASC
    `);

    const indexSimpleByDate = new Map();

    for (let i = 1; i < indexLevels.length; i++) {
      const curr = parseFloat(indexLevels[i].index_level);
      const prev = parseFloat(indexLevels[i - 1].index_level);

      if (curr > 0 && prev > 0) {
        indexSimpleByDate.set(
          indexLevels[i].date.toISOString().split('T')[0],
          simpleReturn(curr, prev),
        );
      }
    }

    log.info(`Loaded ${indexLogByDate.size} log + ${indexSimpleByDate.size} simple index return days`);

    if (indexLogByDate.size < MINIMUM_WINDOW_DAYS) {
      log.warn('Insufficient index data for beta calculation');
      return;
    }

    for (const pass of PASSES) {
      log.info(`\n--- Pass: ${pass.returnType} returns, window up to ${pass.maxWindow} days ---`);

      const indexByDate = pass.returnType === 'log' ? indexLogByDate : indexSimpleByDate;

      const [cryptos] = await Database.execute(
        `SELECT DISTINCT c.id, c.symbol, c.name
         FROM cryptocurrencies c
         INNER JOIN ${pass.table} r ON c.id = r.crypto_id
         GROUP BY c.id, c.symbol, c.name
         HAVING COUNT(*) >= ?
         ORDER BY c.symbol`,
        [MINIMUM_WINDOW_DAYS],
      );

      log.info(`${pass.returnType}: ${cryptos.length} cryptocurrencies with sufficient data`);

      let totalCalculated = 0;
      let totalSkipped = 0;
      let errors = 0;

      for (const crypto of cryptos) {
        try {
          const result = await calculateBetaForCrypto(
            crypto.id,
            crypto.symbol,
            indexByDate,
            pass,
          );

          totalCalculated += result.inserted;
          totalSkipped += result.skipped;
        } catch (error) {
          log.error(`${pass.returnType} ${crypto.symbol}: ${error.message}`);
          errors++;
        }
      }

      log.info(`${pass.returnType}: calculated=${totalCalculated}, skipped=${totalSkipped}, errors=${errors}`);
    }

    const duration = Date.now() - startTime;

    log.info(`\nBeta calculation completed in ${duration}ms`);
  } catch (error) {
    log.error(`Error in calculateBetaStats: ${error.message}`);
    throw error;
  }
}

async function ensureTableExists() {
  try {
    await Database.execute(`
      CREATE TABLE IF NOT EXISTS crypto_beta (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        crypto_id INT UNSIGNED NOT NULL,
        date DATE NOT NULL,
        window_days INT UNSIGNED NOT NULL DEFAULT 90,
        return_type ENUM('log','simple') NOT NULL DEFAULT 'log',
        beta DECIMAL(20, 12) NOT NULL,
        alpha DECIMAL(20, 12) NOT NULL,
        r_squared DECIMAL(20, 12) NOT NULL,
        correlation DECIMAL(20, 12) NOT NULL,
        num_observations INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_crypto_date_window_type (crypto_id, date, window_days, return_type),
        KEY idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      log.debug(`Table check: ${error.message}`);
    }
  }
}

async function calculateBetaForCrypto(cryptoId, symbol, indexByDate, pass) {
  const [returns] = await Database.execute(
    `SELECT date, ${pass.col} AS r
     FROM ${pass.table}
     WHERE crypto_id = ?
       AND date < CURDATE()
     ORDER BY date ASC`,
    [cryptoId],
  );

  if (returns.length < MINIMUM_WINDOW_DAYS) {
    return { inserted: 0, skipped: 0 };
  }

  const cryptoByDate = new Map();

  for (const r of returns) {
    cryptoByDate.set(r.date.toISOString().split('T')[0], {
      date: r.date,
      return: parseFloat(r.r),
    });
  }

  const allDates = [...cryptoByDate.keys()]
    .filter((d) => indexByDate.has(d))
    .sort();

  if (allDates.length < MINIMUM_WINDOW_DAYS) {
    return { inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;

  for (let i = MINIMUM_WINDOW_DAYS - 1; i < allDates.length; i++) {
    const currentDateStr = allDates[i];
    const currentDate = cryptoByDate.get(currentDateStr).date;

    const windowStart = Math.max(0, i - pass.maxWindow + 1);
    const windowDates = allDates.slice(windowStart, i + 1);
    const windowDays = windowDates.length;

    const [existing] = await Database.execute(
      'SELECT id FROM crypto_beta WHERE crypto_id = ? AND date = ? AND window_days = ? AND return_type = ?',
      [cryptoId, currentDate, windowDays, pass.returnType],
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const cryptoReturns = windowDates.map((d) => cryptoByDate.get(d).return);
    const marketReturns = windowDates.map((d) => indexByDate.get(d));

    const { beta, alpha, rSquared, correlation } = calculateBetaAlpha(cryptoReturns, marketReturns);

    await Database.execute(
      `INSERT INTO crypto_beta
       (crypto_id, date, window_days, return_type, beta, alpha, r_squared, correlation, num_observations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cryptoId, currentDate, windowDays, pass.returnType, beta, alpha, rSquared, correlation, windowDays],
    );

    inserted++;
  }

  return { inserted, skipped };
}

calculateBetaStats()
  .then(() => {
    log.info('Command completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log.error(`Command failed: ${error.message}`);
    process.exit(1);
  });
