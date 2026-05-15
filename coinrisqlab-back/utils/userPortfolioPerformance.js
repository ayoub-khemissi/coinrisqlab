/**
 * Portfolio Performance — Time-Weighted Return (TWR)
 *
 * Builds the cumulative-return series shown on the analytics page chart
 * "Performance vs CoinRisqLab 80".
 *
 * Why TWR and not value-based normalization:
 * Using `total_value_usd / total_value_usd_t0` mixes price moves with capital
 * flows (a buy of 1000$ jumps the line +1000$, which has nothing to do with
 * portfolio "performance"). TWR isolates the price effect by:
 *
 *   weights_t = (qty_i × close_i,t-1) / Σ(qty_j × close_j,t-1)   ← end-of-yesterday
 *   r_t       = Σ (weights_i × ((close_i,t / close_i,t-1) - 1))
 *   value_t   = value_t-1 × (1 + r_t)                            ← rebased to 100 at start
 *
 * Holdings are reconstructed by replaying user_transactions (buy=+, sell=-,
 * transfer=+). A buy executed during day t affects weights only from day t+1
 * onwards, so capital flows never leak into a daily return — same convention
 * Ahmed used in the Excel example sheet `perf_Ptf_vs_Index`.
 */

import Database from '../lib/database.js';

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);

  d.setUTCDate(d.getUTCDate() + n);

  return d;
}

function periodToDays(period) {
  switch (period) {
    case '24h':
      return 1;
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    case '365d':
      return 365;
    default:
      return null; // 'all'
  }
}

/**
 * Replay transactions to compute end-of-day holdings for each date.
 * Returns { date: { crypto_id: quantity } } for every date in the range.
 * Holdings are CARRY-FORWARD: if no tx happens on day t, holdings stay equal
 * to end-of-day t-1.
 */
function buildHoldingsTimeline(transactions, dates) {
  const timeline = {};
  const current = {};
  let txIdx = 0;
  const sortedTxs = [...transactions].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );

  for (const date of dates) {
    while (txIdx < sortedTxs.length) {
      const tx = sortedTxs[txIdx];
      const txDate = isoDate(new Date(tx.timestamp));

      if (txDate > date) break;
      const qty = parseFloat(tx.quantity);
      const sign = tx.type === 'sell' ? -1 : 1;

      current[tx.crypto_id] = (current[tx.crypto_id] || 0) + sign * qty;
      txIdx++;
    }
    timeline[date] = { ...current };
  }

  return timeline;
}

/**
 * Fetch one close price per crypto per day inside the [from, to] range.
 * Picks the latest snapshot of the day (some cryptos have several intraday
 * rows in `ohlc`).
 */
async function fetchDailyCloses(cryptoIds, from, to) {
  if (cryptoIds.length === 0) return {};
  const placeholders = cryptoIds.map(() => '?').join(',');
  const [rows] = await Database.execute(
    `SELECT crypto_id, DATE(timestamp) AS d, close
     FROM ohlc o1
     WHERE crypto_id IN (${placeholders})
       AND DATE(timestamp) >= ? AND DATE(timestamp) <= ?
       AND timestamp = (
         SELECT MAX(timestamp) FROM ohlc o2
         WHERE o2.crypto_id = o1.crypto_id
           AND DATE(o2.timestamp) = DATE(o1.timestamp)
       )
     ORDER BY DATE(timestamp) ASC`,
    [...cryptoIds, from, to],
  );

  const map = {};

  for (const row of rows) {
    const dateStr =
      row.d instanceof Date ? isoDate(row.d) : String(row.d);

    if (!map[row.crypto_id]) map[row.crypto_id] = {};
    map[row.crypto_id][dateStr] = parseFloat(row.close);
  }

  return map;
}

/**
 * Compute the time-weighted cumulative return series for a portfolio.
 *
 * @param {number} portfolioId
 * @param {string} period - '24h' | '7d' | '30d' | '90d' | '365d' | 'all'
 * @returns {{
 *   series: Array<{ date: string, value: number }>,  // base 100 at first date
 *   totalReturn: number,                             // % since first date
 *   dailyReturns: Array<{ date: string, pct: number | null }>, // 24h Rolling pct per day
 * }}
 */
export async function computePortfolioTWR(portfolioId, period = '30d') {
  // Prefer the transaction history when present; fall back to the current
  // holdings snapshot for portfolios that were declared via direct holdings
  // input (no buy/sell records). The fallback assumes constant composition
  // over the requested window — same simplification Ahmed used in his
  // Excel example sheet `perf_Ptf_vs_Index`.
  const [txRows] = await Database.execute(
    `SELECT crypto_id, type, quantity, timestamp
     FROM user_transactions
     WHERE portfolio_id = ?
     ORDER BY timestamp ASC`,
    [portfolioId],
  );

  let useTransactions = txRows.length > 0;
  let firstActivityDate = null;
  let staticHoldings = null;

  if (useTransactions) {
    firstActivityDate = new Date(txRows[0].timestamp);
    firstActivityDate.setUTCHours(0, 0, 0, 0);
  } else {
    // closed positions (quantity=0) don't contribute to live value
    const [holdingRows] = await Database.execute(
      `SELECT crypto_id, quantity, first_buy_date, created_at
       FROM user_portfolio_holdings
       WHERE portfolio_id = ?
         AND quantity > 0`,
      [portfolioId],
    );

    if (holdingRows.length === 0) {
      return { series: [], totalReturn: 0, dailyReturns: [] };
    }
    staticHoldings = {};
    let earliest = null;

    for (const h of holdingRows) {
      const qty = parseFloat(h.quantity);

      if (qty > 0) staticHoldings[h.crypto_id] = qty;
      const candidate = h.first_buy_date || h.created_at;

      if (candidate) {
        const d = new Date(candidate);

        if (!earliest || d < earliest) earliest = d;
      }
    }
    if (Object.keys(staticHoldings).length === 0) {
      return { series: [], totalReturn: 0, dailyReturns: [] };
    }
    firstActivityDate = earliest || new Date();
    firstActivityDate.setUTCHours(0, 0, 0, 0);
  }

  const today = new Date();

  today.setUTCHours(0, 0, 0, 0);
  // Cron writes the day's snapshot the next morning — use yesterday as the
  // last fully-closed day so the series matches the rest of the analytics.
  const lastDay = addDays(today, -1);

  const days = periodToDays(period);
  let windowStart;

  if (days == null) {
    windowStart = firstActivityDate; // 'all'
  } else {
    const candidate = addDays(today, -days);

    windowStart = candidate < firstActivityDate ? firstActivityDate : candidate;
  }

  if (windowStart > lastDay) {
    return { series: [], totalReturn: 0, dailyReturns: [] };
  }

  // Build full daily date list, [windowStart - 1d ... lastDay]
  // We need windowStart - 1 to compute the first daily return.
  const dates = [];

  for (
    let d = addDays(windowStart, -1);
    d <= lastDay;
    d = addDays(d, 1)
  ) {
    dates.push(isoDate(d));
  }

  const cryptoIds = useTransactions
    ? [...new Set(txRows.map((t) => t.crypto_id))]
    : Object.keys(staticHoldings).map(Number);
  const closeByCrypto = await fetchDailyCloses(
    cryptoIds,
    dates[0],
    dates[dates.length - 1],
  );
  const holdings = useTransactions
    ? buildHoldingsTimeline(txRows, dates)
    : Object.fromEntries(dates.map((d) => [d, { ...staticHoldings }]));

  // Forward + backward fill missing closes so every date in the window has a
  // defined value for every constituent. This is what makes the daily return
  // contribution of a "missing" crypto equal to 0% while keeping its weight
  // intact in the value sums — same convention as Ahmed's Excel sheet
  // (col M = IFERROR((L_t/L_{t-1})-1, 0) → 0 when the price column is blank).
  //
  // Without backward-fill, the value-ratio formula
  //   return = Σ(qty × close_t) / Σ(qty × close_{t-1}) − 1
  // would silently exclude the missing crypto from BOTH sums, effectively
  // re-normalising the surviving cryptos to 100% weight and over-counting
  // their returns by a factor 1/(1 − w_missing). On a 258-day stretch with
  // RAVE (~8% weight) absent, that drift accumulates massively.
  for (const cid of cryptoIds) {
    const series = closeByCrypto[cid] || (closeByCrypto[cid] = {});

    // Forward pass: fill gaps with the most recent past close
    let last = null;

    for (const d of dates) {
      if (series[d] != null) last = series[d];
      else if (last != null) series[d] = last;
    }

    // Backward pass: fill any leading gaps with the FIRST known close
    // (i.e. the value the crypto had when it first started being tracked)
    let next = null;

    for (let i = dates.length - 1; i >= 0; i--) {
      const d = dates[i];

      if (series[d] != null) next = series[d];
      else if (next != null) series[d] = next;
    }
  }

  // Compute daily TWR
  // Anchor convention: dates[0] (= windowStart - 1) is emitted as the 100
  // baseline so that the chart's data point on `windowStart` itself shows
  // the cumulative effect of the first daily return — e.g. if windowStart =
  // 2026-04-10 then dates[0] = 2026-04-09 → series starts at 4/09 = 100,
  // and the 4/10 point displays the +X% computed from the 4/09→4/10
  // close-to-close move. Matches the convention Ahmed uses in his Excel
  // (anchor row at the start of the audit window, not "100% on the first
  // displayed return day").
  let cumValue = 100;
  const series = [];
  const dailyReturns = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    if (i === 0) {
      // Anchor day = 100, no daily return
      series.push({ date, value: cumValue });
      dailyReturns.push({ date, pct: null });
      continue;
    }

    const prevDate = dates[i - 1];
    const prevHoldings = holdings[prevDate];
    let valuePrev = 0;
    let valueToday = 0;

    for (const cid of cryptoIds) {
      const qty = prevHoldings[cid] || 0;

      if (qty <= 0) continue;
      const closePrev = closeByCrypto[cid]?.[prevDate];
      const closeToday = closeByCrypto[cid]?.[date];

      if (closePrev != null && closeToday != null) {
        valuePrev += qty * closePrev;
        valueToday += qty * closeToday;
      }
    }

    const dailyReturn =
      valuePrev > 0 ? valueToday / valuePrev - 1 : 0;

    cumValue = cumValue * (1 + dailyReturn);

    series.push({ date, value: cumValue });
    dailyReturns.push({ date, pct: dailyReturn * 100 });
  }

  const totalReturn = cumValue - 100;

  return { series, totalReturn, dailyReturns };
}
