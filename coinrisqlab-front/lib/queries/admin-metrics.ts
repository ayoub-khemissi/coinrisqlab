import { RowDataPacket } from "mysql2";

import { db } from "@/lib/db";

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUserMetrics() {
  const [totals] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*)                                            AS total,
       SUM(CASE WHEN plan = 'pro'  THEN 1 ELSE 0 END)      AS pro,
       SUM(CASE WHEN plan = 'free' THEN 1 ELSE 0 END)      AS free,
       SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END)      AS active,
       SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified,
       SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)  THEN 1 ELSE 0 END) AS new_24h,
       SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)  THEN 1 ELSE 0 END) AS new_7d,
       SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS new_30d,
       SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)  THEN 1 ELSE 0 END) AS active_24h,
       SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)  THEN 1 ELSE 0 END) AS active_7d,
       SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS active_30d
     FROM users`,
  );

  // Signup history: last 30 days, grouped by day
  const [signups] = await db.execute<RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS n
     FROM users
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
  );

  // Recent users (last 20)
  const [recent] = await db.execute<RowDataPacket[]>(
    `SELECT id, email, display_name, plan, is_active, email_verified,
            last_login_at, created_at
     FROM users ORDER BY created_at DESC LIMIT 20`,
  );

  // Active sessions count
  const [sessions] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS n FROM user_sessions WHERE expires_at > NOW()`,
  );

  return {
    totals: totals[0],
    activeSessions: sessions[0].n,
    signupsByDay: signups,
    recent,
  };
}

// ─── Portfolios ─────────────────────────────────────────────────────────────

export async function getPortfolioMetrics() {
  const [totals] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_portfolios,
       COUNT(DISTINCT user_id) AS users_with_portfolio
     FROM user_portfolios`,
  );

  // Distribution: # portfolios per user
  const [perUser] = await db.execute<RowDataPacket[]>(
    `SELECT n_portfolios, COUNT(*) AS users
     FROM (
       SELECT user_id, COUNT(*) AS n_portfolios FROM user_portfolios GROUP BY user_id
     ) sub
     GROUP BY n_portfolios ORDER BY n_portfolios ASC`,
  );

  // Distribution: # holdings per portfolio
  const [holdingsDist] = await db.execute<RowDataPacket[]>(
    `SELECT n_holdings, COUNT(*) AS portfolios
     FROM (
       SELECT portfolio_id, COUNT(*) AS n_holdings FROM user_portfolio_holdings GROUP BY portfolio_id
     ) sub
     GROUP BY n_holdings ORDER BY n_holdings ASC`,
  );

  // AUM total — sum of (qty × latest price) across all holdings
  const [aum] = await db.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(uph.quantity * md.price_usd), 0) AS total_aum_usd
     FROM user_portfolio_holdings uph
     INNER JOIN (
       SELECT md1.crypto_id, md1.price_usd
       FROM market_data md1
       INNER JOIN (
         SELECT crypto_id, MAX(timestamp) AS ts FROM market_data GROUP BY crypto_id
       ) latest ON latest.crypto_id = md1.crypto_id AND latest.ts = md1.timestamp
     ) md ON md.crypto_id = uph.crypto_id`,
  );

  const [holdingsTotals] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_holdings,
       COUNT(DISTINCT crypto_id) AS unique_cryptos_held
     FROM user_portfolio_holdings`,
  );

  const [txTotals] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total_transactions,
       SUM(CASE WHEN type = 'buy'  THEN 1 ELSE 0 END) AS buys,
       SUM(CASE WHEN type = 'sell' THEN 1 ELSE 0 END) AS sells,
       SUM(CASE WHEN type = 'transfer' THEN 1 ELSE 0 END) AS transfers
     FROM user_transactions`,
  );

  // Top portfolios by AUM
  const [topPortfolios] = await db.execute<RowDataPacket[]>(
    `SELECT
       up.id, up.name, u.email,
       COUNT(uph.id) AS holdings,
       COALESCE(SUM(uph.quantity * md.price_usd), 0) AS aum_usd
     FROM user_portfolios up
     INNER JOIN users u ON up.user_id = u.id
     LEFT JOIN user_portfolio_holdings uph ON uph.portfolio_id = up.id
     LEFT JOIN (
       SELECT md1.crypto_id, md1.price_usd
       FROM market_data md1
       INNER JOIN (
         SELECT crypto_id, MAX(timestamp) AS ts FROM market_data GROUP BY crypto_id
       ) latest ON latest.crypto_id = md1.crypto_id AND latest.ts = md1.timestamp
     ) md ON md.crypto_id = uph.crypto_id
     GROUP BY up.id, up.name, u.email
     ORDER BY aum_usd DESC LIMIT 10`,
  );

  return {
    totals: { ...totals[0], ...holdingsTotals[0], ...txTotals[0] },
    aum_usd: parseFloat(aum[0].total_aum_usd) || 0,
    portfoliosPerUser: perUser,
    holdingsPerPortfolio: holdingsDist,
    topPortfolios,
  };
}

// ─── Assets coverage ────────────────────────────────────────────────────────

export async function getAssetMetrics() {
  const [counts] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM cryptocurrencies)                     AS total_cryptos,
       (SELECT COUNT(DISTINCT crypto_id) FROM market_data)         AS in_market_data,
       (SELECT COUNT(DISTINCT crypto_id) FROM ohlc)                AS in_ohlc,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_log_returns)  AS in_log_returns,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_simple_returns) AS in_simple_returns,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_volatility WHERE window_days = 90) AS with_vol_90,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_var WHERE window_days = 365)        AS with_var_365,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_sharpe WHERE window_days = 365)     AS with_sharpe_365,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_distribution_stats WHERE window_days = 90) AS with_distribution,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_moving_averages WHERE window_days = 90) AS with_ma_90,
       (SELECT COUNT(DISTINCT crypto_id) FROM crypto_rsi WHERE window_days = 14)         AS with_rsi_14,
       (SELECT COUNT(DISTINCT crypto_id) FROM index_constituents
          WHERE index_history_id = (SELECT MAX(id) FROM index_history))                  AS in_latest_index`,
  );

  // OHLC depth distribution: # cryptos with X+ days of history
  const [depth] = await db.execute<RowDataPacket[]>(
    `SELECT
       SUM(CASE WHEN n >= 365 THEN 1 ELSE 0 END) AS over_365d,
       SUM(CASE WHEN n >= 180 AND n < 365 THEN 1 ELSE 0 END) AS d_180_365,
       SUM(CASE WHEN n >= 90  AND n < 180 THEN 1 ELSE 0 END) AS d_90_180,
       SUM(CASE WHEN n >= 30  AND n < 90  THEN 1 ELSE 0 END) AS d_30_90,
       SUM(CASE WHEN n <  30                  THEN 1 ELSE 0 END) AS under_30d
     FROM (
       SELECT crypto_id, COUNT(DISTINCT DATE(timestamp)) AS n FROM ohlc GROUP BY crypto_id
     ) sub`,
  );

  // Most-held cryptos in user portfolios
  const [topHeld] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, COUNT(uph.id) AS portfolios_holding,
            COALESCE(SUM(uph.quantity * md.price_usd), 0) AS aum_usd
     FROM user_portfolio_holdings uph
     INNER JOIN cryptocurrencies c ON uph.crypto_id = c.id
     LEFT JOIN (
       SELECT md1.crypto_id, md1.price_usd
       FROM market_data md1
       INNER JOIN (
         SELECT crypto_id, MAX(timestamp) AS ts FROM market_data GROUP BY crypto_id
       ) latest ON latest.crypto_id = md1.crypto_id AND latest.ts = md1.timestamp
     ) md ON md.crypto_id = uph.crypto_id
     GROUP BY c.id, c.symbol, c.name
     ORDER BY portfolios_holding DESC, aum_usd DESC LIMIT 15`,
  );

  // Index history: most recent index level + market cap
  const [indexNow] = await db.execute<RowDataPacket[]>(
    `SELECT index_level, total_market_cap_usd, number_of_constituents, timestamp
     FROM index_history WHERE index_config_id = 1
     ORDER BY timestamp DESC LIMIT 1`,
  );

  return {
    counts: counts[0],
    depthDistribution: depth[0],
    topHeld,
    indexNow: indexNow[0] || null,
  };
}

// ─── Overview (single-call summary) ─────────────────────────────────────────

export async function getOverviewMetrics() {
  const [users] = await db.execute<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN plan = 'pro' THEN 1 ELSE 0 END) AS pro,
       SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_7d,
       SUM(CASE WHEN last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS active_7d
     FROM users`,
  );
  const [portfolios] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS users_with_portfolio
     FROM user_portfolios`,
  );
  const [holdings] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total_holdings,
            COUNT(DISTINCT crypto_id) AS unique_cryptos
     FROM user_portfolio_holdings`,
  );
  const [aum] = await db.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(uph.quantity * md.price_usd), 0) AS total_aum_usd
     FROM user_portfolio_holdings uph
     INNER JOIN (
       SELECT md1.crypto_id, md1.price_usd FROM market_data md1
       INNER JOIN (
         SELECT crypto_id, MAX(timestamp) AS ts FROM market_data GROUP BY crypto_id
       ) latest ON latest.crypto_id = md1.crypto_id AND latest.ts = md1.timestamp
     ) md ON md.crypto_id = uph.crypto_id`,
  );
  const [assets] = await db.execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM cryptocurrencies) AS total,
       (SELECT COUNT(DISTINCT crypto_id) FROM market_data) AS tracked,
       (SELECT COUNT(DISTINCT crypto_id) FROM index_constituents
          WHERE index_history_id = (SELECT MAX(id) FROM index_history)) AS in_index`,
  );
  const [tx] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM user_transactions`,
  );

  return {
    users: users[0],
    portfolios: portfolios[0],
    holdings: holdings[0],
    aum_usd: parseFloat(aum[0].total_aum_usd) || 0,
    assets: assets[0],
    transactions: tx[0],
  };
}
