import { RowDataPacket } from "mysql2";

import { db } from "@/lib/db";

// ─── Metric Windows (DISTINCT window_days available in BDD) ───────────────
// Lets the front populate a Select with only windows that actually exist,
// so Ahmed doesn't pick a value that yields zero rows.

const METRIC_WINDOWS_CONFIG: Record<
  string,
  { table: string; canonical: number; extraWhere?: string }
> = {
  volatility: { table: "crypto_volatility", canonical: 90 },
  "portfolio-volatility": { table: "portfolio_volatility", canonical: 90 },
  var: { table: "crypto_var", canonical: 365 },
  sharpe: { table: "crypto_sharpe", canonical: 365 },
  distribution: { table: "crypto_distribution_stats", canonical: 90 },
  "beta-log": {
    table: "crypto_beta",
    canonical: 365,
    extraWhere: "return_type = 'log'",
  },
  "beta-simple": {
    table: "crypto_beta",
    canonical: 90,
    extraWhere: "return_type = 'simple'",
  },
  sml: { table: "crypto_sml", canonical: 90 },
  ma: { table: "crypto_moving_averages", canonical: 90 },
  rsi: { table: "crypto_rsi", canonical: 14 },
  "portfolio-analytics": { table: "user_portfolio_analytics", canonical: 90 },
};

export async function getMetricWindows(metric: string) {
  const cfg = METRIC_WINDOWS_CONFIG[metric];

  if (!cfg) return null;

  // Identifier whitelist — table name is concatenated, so guard against
  // any sneaky chars. All known tables use [a-z_] only.
  if (!/^[a-z_]+$/.test(cfg.table)) return null;

  const where = cfg.extraWhere ? `WHERE ${cfg.extraWhere}` : "";
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT DISTINCT window_days FROM \`${cfg.table}\` ${where} ORDER BY window_days ASC`,
  );
  const windows = rows.map((r) => Number(r.window_days));

  // Resolve the default: canonical if present, else the largest available
  // value <= canonical (so we stay close to methodology), else the max.
  let defaultWindow = cfg.canonical;

  if (!windows.includes(cfg.canonical)) {
    const lower = windows.filter((w) => w <= cfg.canonical);

    defaultWindow =
      lower.length > 0
        ? Math.max(...lower)
        : (windows[windows.length - 1] ?? cfg.canonical);
  }

  return { windows, canonical: cfg.canonical, default: defaultWindow };
}

// ─── Crypto Search ──────────────────────────────────────────────────────────

export async function searchCryptos(search: string) {
  // Match the public crypto table: only include cryptos present in the latest
  // global market_data snapshot (excludes stale tokens like KPK that dropped
  // out of the top 500 weeks ago), and order by computed market cap desc.
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.id, c.symbol, c.name, c.coingecko_id, c.image_url
     FROM cryptocurrencies c
     INNER JOIN market_data md ON md.crypto_id = c.id
     WHERE md.timestamp = (SELECT MAX(timestamp) FROM market_data)
       AND (md.price_usd * md.circulating_supply) > 0
       AND (c.symbol LIKE CONCAT('%', ?, '%') OR c.name LIKE CONCAT('%', ?, '%'))
     ORDER BY (md.price_usd * md.circulating_supply) DESC
     LIMIT 500`,
    [search, search],
  );

  return rows;
}

// ─── Helper: build WHERE clause for crypto filter ───────────────────────────

function buildCryptoFilter(
  cryptos: string[],
  alias: string,
): { clause: string; params: string[] } {
  if (cryptos.length === 0) return { clause: "", params: [] };
  const placeholders = cryptos.map(() => "?").join(",");

  return {
    clause: `AND ${alias}.coingecko_id IN (${placeholders})`,
    params: cryptos,
  };
}

// ─── Prices (OHLC Close) ────────────────────────────────────────────────────

export async function getOhlcPrices(
  cryptos: string[],
  from: string,
  to: string,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const sql = `SELECT c.symbol, c.name, DATE(o.timestamp) as date, o.close as close_price_usd
    FROM ohlc o
    INNER JOIN cryptocurrencies c ON o.crypto_id = c.id
    WHERE DATE(o.timestamp) >= ? AND DATE(o.timestamp) <= ?
      ${clause}
    ORDER BY c.symbol ASC, o.timestamp DESC
    ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`;

  const [rows] = await db.execute<RowDataPacket[]>(sql, [
    ...dateParams,
    ...params,
  ]);

  return rows;
}

export async function getOhlcPricesCount(
  cryptos: string[],
  from: string,
  to: string,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM ohlc o
     INNER JOIN cryptocurrencies c ON o.crypto_id = c.id
     WHERE DATE(o.timestamp) >= ? AND DATE(o.timestamp) <= ? ${clause}`,
    [...dateParams, ...params],
  );

  return rows[0].total as number;
}

// ─── Log Returns ────────────────────────────────────────────────────────────

export async function getLogReturns(
  cryptos: string[],
  from: string,
  to: string,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, clr.date, clr.log_return, clr.price_current, clr.price_previous
     FROM crypto_log_returns clr
     INNER JOIN cryptocurrencies c ON clr.crypto_id = c.id
     WHERE clr.date >= ? AND clr.date <= ? ${clause}
     ORDER BY c.symbol ASC, clr.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, ...params],
  );

  return rows;
}

export async function getLogReturnsCount(
  cryptos: string[],
  from: string,
  to: string,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_log_returns clr
     INNER JOIN cryptocurrencies c ON clr.crypto_id = c.id
     WHERE clr.date >= ? AND clr.date <= ? ${clause}`,
    [...dateParams, ...params],
  );

  return rows[0].total as number;
}

// ─── Simple Returns ─────────────────────────────────────────────────────────

export async function getSimpleReturns(
  cryptos: string[],
  from: string,
  to: string,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, csr.date, csr.simple_return, csr.price_current, csr.price_previous
     FROM crypto_simple_returns csr
     INNER JOIN cryptocurrencies c ON csr.crypto_id = c.id
     WHERE csr.date >= ? AND csr.date <= ? ${clause}
     ORDER BY c.symbol ASC, csr.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, ...params],
  );

  return rows;
}

export async function getSimpleReturnsCount(
  cryptos: string[],
  from: string,
  to: string,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_simple_returns csr
     INNER JOIN cryptocurrencies c ON csr.crypto_id = c.id
     WHERE csr.date >= ? AND csr.date <= ? ${clause}`,
    [...dateParams, ...params],
  );

  return rows[0].total as number;
}

// ─── Volatility ─────────────────────────────────────────────────────────────

export async function getVolatility(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cv.date, cv.window_days, cv.daily_volatility, cv.annualized_volatility, cv.num_observations
     FROM crypto_volatility cv
     INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
     WHERE cv.date >= ? AND cv.date <= ? AND cv.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cv.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getVolatilityCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_volatility cv
     INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
     WHERE cv.date >= ? AND cv.date <= ? AND cv.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Portfolio Volatility ───────────────────────────────────────────────────

export async function getPortfolioVolatility(
  from: string,
  to: string,
  limit: number,
  offset: number,
) {
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT pv.date, pv.window_days, pv.daily_volatility, pv.annualized_volatility, pv.num_constituents, pv.total_market_cap_usd
     FROM portfolio_volatility pv
     INNER JOIN index_config ic ON pv.index_config_id = ic.id
     WHERE ic.index_name = 'CoinRisqLab 80'
       AND pv.date >= ? AND pv.date <= ?
     ORDER BY pv.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    dateParams,
  );

  return rows;
}

export async function getPortfolioVolatilityCount(from: string, to: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM portfolio_volatility pv
     INNER JOIN index_config ic ON pv.index_config_id = ic.id
     WHERE ic.index_name = 'CoinRisqLab 80' AND pv.date >= ? AND pv.date <= ?`,
    [from || "2000-01-01", to || "2099-12-31"],
  );

  return rows[0].total as number;
}

// ─── VaR / CVaR ─────────────────────────────────────────────────────────────

export async function getVarCvar(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cv.date, cv.window_days, cv.var_95, cv.var_99, cv.cvar_95, cv.cvar_99, cv.mean_return, cv.std_dev, cv.min_return, cv.max_return, cv.num_observations
     FROM crypto_var cv
     INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
     WHERE cv.date >= ? AND cv.date <= ? AND cv.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cv.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getVarCvarCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_var cv
     INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
     WHERE cv.date >= ? AND cv.date <= ? AND cv.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Beta / Alpha ───────────────────────────────────────────────────────────

export async function getBetaAlpha(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  returnType: "log" | "simple",
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cb.date, cb.window_days, cb.return_type, cb.beta, cb.alpha, cb.r_squared, cb.correlation, cb.num_observations
     FROM crypto_beta cb
     INNER JOIN cryptocurrencies c ON cb.crypto_id = c.id
     WHERE cb.date >= ? AND cb.date <= ? AND cb.window_days = ? AND cb.return_type = ? ${clause}
     ORDER BY c.symbol ASC, cb.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, returnType, ...params],
  );

  return rows;
}

export async function getBetaAlphaCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  returnType: "log" | "simple",
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_beta cb
     INNER JOIN cryptocurrencies c ON cb.crypto_id = c.id
     WHERE cb.date >= ? AND cb.date <= ? AND cb.window_days = ? AND cb.return_type = ? ${clause}`,
    [...dateParams, windowDays, returnType, ...params],
  );

  return rows[0].total as number;
}

// ─── SML ────────────────────────────────────────────────────────────────────

export async function getSml(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cs.date, cs.window_days, cs.beta, cs.expected_return, cs.actual_return, cs.alpha, cs.is_overvalued, cs.market_return, cs.num_observations
     FROM crypto_sml cs
     INNER JOIN cryptocurrencies c ON cs.crypto_id = c.id
     WHERE cs.date >= ? AND cs.date <= ? AND cs.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cs.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getSmlCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_sml cs
     INNER JOIN cryptocurrencies c ON cs.crypto_id = c.id
     WHERE cs.date >= ? AND cs.date <= ? AND cs.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Distribution Stats ────────────────────────────────────────────────────

export async function getDistributionStats(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cds.date, cds.window_days, cds.skewness, cds.kurtosis, cds.num_observations
     FROM crypto_distribution_stats cds
     INNER JOIN cryptocurrencies c ON cds.crypto_id = c.id
     WHERE cds.date >= ? AND cds.date <= ? AND cds.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cds.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getDistributionStatsCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_distribution_stats cds
     INNER JOIN cryptocurrencies c ON cds.crypto_id = c.id
     WHERE cds.date >= ? AND cds.date <= ? AND cds.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Sharpe ─────────────────────────────────────────────────────────────────

export async function getSharpe(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cs.date, cs.window_days, cs.sharpe_ratio, cs.mean_return, cs.std_return, cs.num_observations
     FROM crypto_sharpe cs
     INNER JOIN cryptocurrencies c ON cs.crypto_id = c.id
     WHERE cs.date >= ? AND cs.date <= ? AND cs.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cs.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getSharpeCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_sharpe cs
     INNER JOIN cryptocurrencies c ON cs.crypto_id = c.id
     WHERE cs.date >= ? AND cs.date <= ? AND cs.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Moving Averages ────────────────────────────────────────────────────────

export async function getMovingAverages(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cma.date, cma.window_days, cma.moving_average, cma.num_observations
     FROM crypto_moving_averages cma
     INNER JOIN cryptocurrencies c ON cma.crypto_id = c.id
     WHERE cma.date >= ? AND cma.date <= ? AND cma.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cma.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getMovingAveragesCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_moving_averages cma
     INNER JOIN cryptocurrencies c ON cma.crypto_id = c.id
     WHERE cma.date >= ? AND cma.date <= ? AND cma.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── RSI ───────────────────────────────────────────────────────────────────

export async function getRsi(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, cr.date, cr.window_days, cr.rsi, cr.num_observations
     FROM crypto_rsi cr
     INNER JOIN cryptocurrencies c ON cr.crypto_id = c.id
     WHERE cr.date >= ? AND cr.date <= ? AND cr.window_days = ? ${clause}
     ORDER BY c.symbol ASC, cr.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [...dateParams, windowDays, ...params],
  );

  return rows;
}

export async function getRsiCount(
  cryptos: string[],
  from: string,
  to: string,
  windowDays: number,
) {
  const { clause, params } = buildCryptoFilter(cryptos, "c");
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM crypto_rsi cr
     INNER JOIN cryptocurrencies c ON cr.crypto_id = c.id
     WHERE cr.date >= ? AND cr.date <= ? AND cr.window_days = ? ${clause}`,
    [...dateParams, windowDays, ...params],
  );

  return rows[0].total as number;
}

// ─── Correlation (on-the-fly) ───────────────────────────────────────────────

export async function getCorrelationReturns(
  crypto1: string,
  crypto2: string,
  from: string,
  to: string,
) {
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  // Resolve crypto_ids
  const [c1] = await db.execute<RowDataPacket[]>(
    "SELECT id, symbol FROM cryptocurrencies WHERE coingecko_id = ?",
    [crypto1],
  );
  const [c2] = await db.execute<RowDataPacket[]>(
    "SELECT id, symbol FROM cryptocurrencies WHERE coingecko_id = ?",
    [crypto2],
  );

  if (c1.length === 0 || c2.length === 0)
    return { rows: [], symbols: ["", ""] };

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT lr1.date, lr1.log_return AS return_1, lr2.log_return AS return_2
     FROM crypto_log_returns lr1
     INNER JOIN crypto_log_returns lr2 ON lr1.date = lr2.date
     WHERE lr1.crypto_id = ? AND lr2.crypto_id = ?
       AND lr1.date >= ? AND lr1.date <= ?
     ORDER BY lr1.date ASC`,
    [c1[0].id, c2[0].id, ...dateParams],
  );

  return { rows, symbols: [c1[0].symbol, c2[0].symbol] };
}

// ─── Index History ──────────────────────────────────────────────────────────

export async function getIndexHistory(
  from: string,
  to: string,
  limit: number,
  offset: number,
) {
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT DATE(ih.snapshot_date) as date,
       SUBSTRING_INDEX(GROUP_CONCAT(ih.index_level ORDER BY ih.timestamp DESC), ',', 1) + 0 as index_level,
       SUBSTRING_INDEX(GROUP_CONCAT(ih.total_market_cap_usd ORDER BY ih.timestamp DESC), ',', 1) + 0 as total_market_cap,
       SUBSTRING_INDEX(GROUP_CONCAT(ih.number_of_constituents ORDER BY ih.timestamp DESC), ',', 1) + 0 as num_constituents
     FROM index_history ih
     INNER JOIN index_config ic ON ih.index_config_id = ic.id
     WHERE ic.index_name = 'CoinRisqLab 80'
       AND DATE(ih.snapshot_date) >= ? AND DATE(ih.snapshot_date) <= ?
     GROUP BY DATE(ih.snapshot_date)
     ORDER BY date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    dateParams,
  );

  return rows;
}

export async function getIndexHistoryCount(from: string, to: string) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(DISTINCT DATE(ih.snapshot_date)) as total
     FROM index_history ih
     INNER JOIN index_config ic ON ih.index_config_id = ic.id
     WHERE ic.index_name = 'CoinRisqLab 80'
       AND DATE(ih.snapshot_date) >= ? AND DATE(ih.snapshot_date) <= ?`,
    [from || "2000-01-01", to || "2099-12-31"],
  );

  return rows[0].total as number;
}

// ─── Index Constituents ─────────────────────────────────────────────────────

export async function getIndexConstituents(
  date: string,
  limit: number,
  offset: number,
) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT c.symbol, c.name, ic.rank_position, ic.price_usd, ic.circulating_supply, ic.weight_in_index
     FROM index_constituents ic
     INNER JOIN index_history ih ON ic.index_history_id = ih.id
     INNER JOIN index_config cfg ON ih.index_config_id = cfg.id
     INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
     WHERE cfg.index_name = 'CoinRisqLab 80'
       AND DATE(ih.snapshot_date) = ?
       AND ih.id = (
         SELECT MAX(ih2.id) FROM index_history ih2
         WHERE ih2.index_config_id = cfg.id AND DATE(ih2.snapshot_date) = ?
       )
     ORDER BY ic.rank_position ASC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [date, date],
  );

  return rows;
}

// ─── User Portfolios List ───────────────────────────────────────────────────

export async function listUserPortfolios() {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT up.id, up.name, u.email, u.display_name, up.created_at
     FROM user_portfolios up
     INNER JOIN users u ON up.user_id = u.id
     ORDER BY up.id ASC`,
  );

  return rows;
}

// ─── Portfolio Analytics ────────────────────────────────────────────────────

export async function getPortfolioAnalytics(
  portfolioId: number,
  from: string,
  to: string,
  windowDays: number,
  limit: number,
  offset: number,
) {
  const dateParams = [from || "2000-01-01", to || "2099-12-31"];

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT upa.date, upa.window_days, upa.total_value_usd, upa.num_holdings, upa.data_points,
       upa.daily_volatility, upa.annualized_volatility, upa.diversification_benefit,
       upa.var_95, upa.var_99, upa.cvar_95, upa.cvar_99,
       upa.skewness, upa.kurtosis, upa.sharpe_ratio,
       upa.portfolio_beta_weighted, upa.beta_regression, upa.alpha_regression,
       upa.r_squared, upa.correlation_with_index
     FROM user_portfolio_analytics upa
     WHERE upa.portfolio_id = ? AND upa.date >= ? AND upa.date <= ? AND upa.window_days = ?
     ORDER BY upa.date DESC
     ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ""}`,
    [portfolioId, ...dateParams, windowDays],
  );

  return rows;
}

export async function getPortfolioAnalyticsCount(
  portfolioId: number,
  from: string,
  to: string,
  windowDays: number,
) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM user_portfolio_analytics
     WHERE portfolio_id = ? AND date >= ? AND date <= ? AND window_days = ?`,
    [portfolioId, from || "2000-01-01", to || "2099-12-31", windowDays],
  );

  return rows[0].total as number;
}
