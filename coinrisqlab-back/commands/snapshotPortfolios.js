import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Daily snapshot of all active user portfolio values.
 * Stores total value and PnL for chart history.
 * Designed to run after market data is fresh (cron: daily at 02:30).
 */
async function snapshotPortfolios() {
  const startTime = Date.now();

  try {
    log.info('Starting portfolio snapshots...');

    // Get all active user portfolios
    const [portfolios] = await Database.execute(`
      SELECT up.id AS portfolio_id, up.user_id
      FROM user_portfolios up
      INNER JOIN users u ON up.user_id = u.id
      WHERE u.is_active = 1
    `);

    if (portfolios.length === 0) {
      log.info('No active portfolios to snapshot.');
      return;
    }

    log.info(`Found ${portfolios.length} portfolios to snapshot.`);

    let snapshotted = 0;
    let skipped = 0;

    for (const portfolio of portfolios) {
      try {
        // Get holdings with latest prices
        const [holdings] = await Database.execute(`
          SELECT
            h.quantity,
            h.avg_buy_price,
            md.price_usd AS current_price
          FROM user_portfolio_holdings h
          LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
            AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
          WHERE h.portfolio_id = ?
        `, [portfolio.portfolio_id]);

        if (holdings.length === 0) {
          skipped++;
          continue;
        }

        let totalValue = 0;
        let totalPnl = 0;

        for (const h of holdings) {
          const value = parseFloat(h.quantity) * parseFloat(h.current_price || 0);
          const cost = parseFloat(h.quantity) * parseFloat(h.avg_buy_price || 0);
          totalValue += value;
          totalPnl += (value - cost);
        }

        // Upsert snapshot (idempotent for same date)
        await Database.execute(`
          INSERT INTO user_portfolio_snapshots (portfolio_id, total_value_usd, total_pnl_usd, snapshot_date)
          VALUES (?, ?, ?, CURDATE())
          ON DUPLICATE KEY UPDATE
            total_value_usd = VALUES(total_value_usd),
            total_pnl_usd = VALUES(total_pnl_usd)
        `, [portfolio.portfolio_id, totalValue, totalPnl]);

        snapshotted++;
      } catch (error) {
        log.error(`Error snapshotting portfolio ${portfolio.portfolio_id}: ${error.message}`);
      }
    }

    const duration = Date.now() - startTime;
    log.info(`Portfolio snapshots complete: ${snapshotted} snapshotted, ${skipped} skipped (empty), ${duration}ms`);
  } catch (error) {
    log.error(`Portfolio snapshot error: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

snapshotPortfolios();
