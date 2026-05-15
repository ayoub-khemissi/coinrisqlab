import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { requirePro } from '../middleware/requirePro.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyPortfolioOwnership(portfolioId, userId) {
  const [rows] = await Database.execute(
    'SELECT id FROM user_portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return rows.length > 0;
}

/**
 * Walk the full transaction history chronologically and produce the current
 * lot state. Returns null if any transaction would push qty negative
 * (impossible state — the caller should reject the operation).
 *
 * Convention:
 *   - Buys add to the open lot. avg_buy_price = weighted average of the
 *     OPEN-LOT buys only. When a previous lot was fully sold (qty hit 0)
 *     and a new buy arrives, the cost basis RESETS — the new lot starts
 *     fresh. This matches how a portfolio tracker like CoinGecko reports
 *     "current avg buy price" after a full liquidation cycle.
 *   - Sells reduce qty. Realised P&L is accumulated as
 *     sellQty × (sellPrice − avg_buy_at_that_moment). This number is
 *     CRYSTALLISED — it is never erased even if the line is later
 *     re-opened with a new buy.
 *   - Transfers don't move qty or cost basis (kept consistent with the
 *     previous implementation).
 *
 * Floating-point safety: tiny residuals (|qty| < EPSILON) are clamped
 * to exactly 0.
 */
const QTY_EPSILON = 1e-12;

function walkTransactions(txs) {
  let totalQty = 0;
  let openLotQty = 0;     // qty acquired since the last "qty=0" reset
  let openLotCost = 0;    // cumulative USD cost of openLotQty
  let realizedPnl = 0;
  let firstBuyDate = null;
  let invalid = false;

  for (const t of txs) {
    const q = parseFloat(t.quantity);
    const p = parseFloat(t.price_usd);

    if (t.type === 'buy') {
      // If the previous lot was closed (qty=0), the new buy starts a fresh
      // cost basis. Realised P&L stays — it's history.
      if (totalQty <= QTY_EPSILON) {
        openLotQty = q;
        openLotCost = q * p;
      } else {
        openLotQty += q;
        openLotCost += q * p;
      }
      totalQty += q;
      if (firstBuyDate === null) firstBuyDate = t.timestamp;
    } else if (t.type === 'sell') {
      // Validate: cannot sell more than currently held. Caller decides
      // how to react (reject the new operation, or allow with clamp).
      if (q > totalQty + QTY_EPSILON) {
        invalid = true;
        break;
      }
      const avgAtSell = openLotQty > 0 ? openLotCost / openLotQty : 0;

      realizedPnl += q * (p - avgAtSell);
      totalQty -= q;
      // Reduce the open lot's qty proportionally — the cost basis per unit
      // stays the same so the avg doesn't drift on partial sells.
      const reduction = openLotQty > 0 ? Math.min(q / openLotQty, 1) : 0;

      openLotCost = openLotCost * (1 - reduction);
      openLotQty = openLotQty * (1 - reduction);
      // Clamp residuals
      if (Math.abs(totalQty) < QTY_EPSILON) totalQty = 0;
      if (Math.abs(openLotQty) < QTY_EPSILON) openLotQty = 0;
      if (openLotQty === 0) openLotCost = 0;
    } else if (t.type === 'transfer') {
      // No-op on qty / cost basis (consistent with previous behaviour).
    }
  }

  return {
    invalid,
    totalQty: Math.abs(totalQty) < QTY_EPSILON ? 0 : totalQty,
    avgBuyPrice: openLotQty > 0 ? openLotCost / openLotQty : 0,
    realizedPnl,
    firstBuyDate,
  };
}

/**
 * Recompute a holding from the full transaction history. Holdings are a
 * derived cache; user_transactions is the single source of truth.
 *
 * Throws an error with code='INVALID_TX_HISTORY' if the existing tx
 * sequence is impossible (e.g. a sell larger than what was held at that
 * moment) — the caller should surface that as a 400 to the user instead
 * of silently producing a corrupt state.
 *
 * Lines with qty=0 are KEPT (not deleted) so realised P&L stays visible.
 * The user can manually delete the row when they want it gone.
 */
export async function recomputeHolding(portfolioId, cryptoId) {
  const [txs] = await Database.execute(
    `SELECT type, quantity, price_usd, timestamp
     FROM user_transactions
     WHERE portfolio_id = ? AND crypto_id = ?
     ORDER BY timestamp ASC, id ASC`,
    [portfolioId, cryptoId]
  );

  const state = walkTransactions(txs);

  if (state.invalid) {
    const err = new Error('Transaction sequence would push quantity below zero');

    err.code = 'INVALID_TX_HISTORY';
    throw err;
  }

  const [existing] = await Database.execute(
    'SELECT id FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
    [portfolioId, cryptoId]
  );

  if (txs.length === 0) {
    // Last transaction was deleted → no history → drop the holding row.
    if (existing.length > 0) {
      await Database.execute(
        'DELETE FROM user_portfolio_holdings WHERE id = ?',
        [existing[0].id]
      );
    }
    return;
  }

  if (existing.length > 0) {
    await Database.execute(
      `UPDATE user_portfolio_holdings
       SET quantity = ?, avg_buy_price = ?, realized_pnl_usd = ?
       WHERE id = ?`,
      [state.totalQty, state.avgBuyPrice, state.realizedPnl, existing[0].id]
    );
  } else {
    const fbDate = state.firstBuyDate
      ? new Date(state.firstBuyDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    await Database.execute(
      `INSERT INTO user_portfolio_holdings
         (portfolio_id, crypto_id, quantity, avg_buy_price, realized_pnl_usd, first_buy_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [portfolioId, cryptoId, state.totalQty, state.avgBuyPrice, state.realizedPnl, fbDate]
    );
  }
}

/**
 * Predict whether the next transaction would produce an invalid state
 * (sell > current qty). Used by POST /transactions to reject sells before
 * they're written. Returns true if the prospective tx is OK.
 */
async function wouldTxBeValid(portfolioId, cryptoId, type, quantity, timestamp) {
  if (type !== 'sell') return true;
  const [txs] = await Database.execute(
    `SELECT type, quantity, price_usd, timestamp
     FROM user_transactions
     WHERE portfolio_id = ? AND crypto_id = ?
     ORDER BY timestamp ASC, id ASC`,
    [portfolioId, cryptoId]
  );

  // Insert the prospective sell at the right chronological spot
  const projected = [
    ...txs,
    { type, quantity, price_usd: 0, timestamp: timestamp || new Date().toISOString() },
  ].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const result = walkTransactions(projected);

  return !result.invalid;
}

// ─── List Transactions ──────────────────────────────────────────────────────

api.get('/user/portfolios/:id/transactions', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Free plan: only last 30 transactions
    const effectiveLimit = req.user.plan === 'free' ? Math.min(limit, 30) : limit;
    const effectiveOffset = req.user.plan === 'free' ? 0 : offset;

    const [transactions] = await Database.execute(
      `SELECT
        t.id, t.crypto_id, c.symbol, c.name AS crypto_name, c.image_url,
        t.type, t.quantity, t.price_usd, t.fee_usd, t.timestamp, t.notes, t.created_at
      FROM user_transactions t
      JOIN cryptocurrencies c ON c.id = t.crypto_id
      WHERE t.portfolio_id = ?
      ORDER BY t.timestamp DESC
      LIMIT ${Number(effectiveLimit)} OFFSET ${Number(effectiveOffset)}`,
      [portfolioId]
    );

    const [countResult] = await Database.execute(
      'SELECT COUNT(*) AS total FROM user_transactions WHERE portfolio_id = ?',
      [portfolioId]
    );

    res.json({
      data: transactions,
      pagination: {
        page,
        limit: effectiveLimit,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / effectiveLimit),
      },
    });
  } catch (error) {
    log.error(`List transactions error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch transactions' });
  }
});

// ─── Record Transaction ─────────────────────────────────────────────────────

api.post('/user/portfolios/:id/transactions', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes } = req.body;

    if (!crypto_id || !type || !quantity || quantity <= 0 || !price_usd) {
      return res.status(400).json({ data: null, msg: 'crypto_id, type, quantity, and price_usd are required' });
    }

    if (!['buy', 'sell', 'transfer'].includes(type)) {
      return res.status(400).json({ data: null, msg: 'type must be buy, sell, or transfer' });
    }

    // Verify crypto exists
    const [cryptos] = await Database.execute(
      'SELECT id FROM cryptocurrencies WHERE id = ?',
      [crypto_id]
    );
    if (cryptos.length === 0) {
      return res.status(400).json({ data: null, msg: 'Cryptocurrency not found' });
    }

    // Free-plan limit: max 10 distinct cryptos per portfolio. Only relevant
    // when the buy creates a new holding row (i.e. crypto not yet held).
    if (type === 'buy' && req.user.plan === 'free') {
      const [existingHolding] = await Database.execute(
        'SELECT id FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
        [portfolioId, crypto_id]
      );

      if (existingHolding.length === 0) {
        const [count] = await Database.execute(
          'SELECT COUNT(*) AS cnt FROM user_portfolio_holdings WHERE portfolio_id = ?',
          [portfolioId]
        );

        if (count[0].cnt >= 10) {
          return res.status(403).json({ data: null, msg: 'Free plan allows max 10 cryptos per portfolio' });
        }
      }
    }

    const txTimestamp = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Reject sells that would push qty negative — you can't sell what you
    // don't own. Buys are always allowed (limited only by the free-plan
    // 10-crypto cap, checked above).
    const ok = await wouldTxBeValid(portfolioId, crypto_id, type, quantity, txTimestamp);

    if (!ok) {
      return res.status(400).json({
        data: null,
        msg: 'Cannot sell more than the holding currently owns',
      });
    }

    // Insert transaction
    const [result] = await Database.execute(
      `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [portfolioId, crypto_id, type, quantity, price_usd, fee_usd || 0, txTimestamp, notes || null]
    );

    // Recompute the holding from the full transaction history. Single source
    // of truth = user_transactions; the holding row is just a derived cache.
    await recomputeHolding(portfolioId, crypto_id);

    res.status(201).json({ data: { id: result.insertId } });
  } catch (error) {
    log.error(`Record transaction error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to record transaction' });
  }
});

// ─── Update Transaction ─────────────────────────────────────────────────────

api.put('/user/portfolios/:id/transactions/:txId', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const txId = parseInt(req.params.txId);
    const { quantity, price_usd, fee_usd, notes } = req.body;

    // Snapshot the current tx so we can roll back if the update would
    // produce an impossible state (e.g. a sell suddenly larger than what
    // was held at that moment after the user edits a buy further upstream).
    const [txBefore] = await Database.execute(
      'SELECT crypto_id, quantity, price_usd, fee_usd, notes FROM user_transactions WHERE id = ? AND portfolio_id = ?',
      [txId, portfolioId]
    );

    if (txBefore.length === 0) {
      return res.status(404).json({ data: null, msg: 'Transaction not found' });
    }
    const snapshot = txBefore[0];

    const [result] = await Database.execute(
      `UPDATE user_transactions
       SET quantity = COALESCE(?, quantity),
           price_usd = COALESCE(?, price_usd),
           fee_usd = COALESCE(?, fee_usd),
           notes = COALESCE(?, notes)
       WHERE id = ? AND portfolio_id = ?`,
      [
        quantity !== undefined ? quantity : null,
        price_usd !== undefined ? price_usd : null,
        fee_usd !== undefined ? fee_usd : null,
        notes !== undefined ? notes : null,
        txId,
        portfolioId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Transaction not found' });
    }

    try {
      await recomputeHolding(portfolioId, snapshot.crypto_id);
    } catch (err) {
      if (err.code === 'INVALID_TX_HISTORY') {
        // Roll back the update so the holding stays consistent
        await Database.execute(
          `UPDATE user_transactions
           SET quantity = ?, price_usd = ?, fee_usd = ?, notes = ?
           WHERE id = ?`,
          [snapshot.quantity, snapshot.price_usd, snapshot.fee_usd, snapshot.notes, txId]
        );
        await recomputeHolding(portfolioId, snapshot.crypto_id);

        return res.status(400).json({
          data: null,
          msg: 'Edit rejected: it would push a holding below zero quantity at some point in time',
        });
      }
      throw err;
    }

    res.json({ data: { id: txId } });
  } catch (error) {
    log.error(`Update transaction error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to update transaction' });
  }
});

// ─── Delete Transaction ─────────────────────────────────────────────────────

api.delete('/user/portfolios/:id/transactions/:txId', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const txId = parseInt(req.params.txId);

    // Snapshot the full row so we can re-insert it if removing it would
    // create an impossible state (e.g. deleting a buy that an existing
    // sell relied on).
    const [txBefore] = await Database.execute(
      `SELECT crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes
       FROM user_transactions WHERE id = ? AND portfolio_id = ?`,
      [txId, portfolioId]
    );

    if (txBefore.length === 0) {
      return res.status(404).json({ data: null, msg: 'Transaction not found' });
    }
    const snapshot = txBefore[0];

    const [result] = await Database.execute(
      'DELETE FROM user_transactions WHERE id = ? AND portfolio_id = ?',
      [txId, portfolioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Transaction not found' });
    }

    try {
      await recomputeHolding(portfolioId, snapshot.crypto_id);
    } catch (err) {
      if (err.code === 'INVALID_TX_HISTORY') {
        // Re-insert the row to keep history consistent
        await Database.execute(
          `INSERT INTO user_transactions
             (id, portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            txId,
            portfolioId,
            snapshot.crypto_id,
            snapshot.type,
            snapshot.quantity,
            snapshot.price_usd,
            snapshot.fee_usd,
            snapshot.timestamp,
            snapshot.notes,
          ]
        );
        await recomputeHolding(portfolioId, snapshot.crypto_id);

        return res.status(400).json({
          data: null,
          msg: 'Delete rejected: this transaction is required by a later sell',
        });
      }
      throw err;
    }

    res.json({ data: null, msg: 'Transaction deleted' });
  } catch (error) {
    log.error(`Delete transaction error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to delete transaction' });
  }
});

// ─── CSV Import (Pro only) ──────────────────────────────────────────────────

api.post('/user/portfolios/:id/transactions/import', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ data: null, msg: 'transactions array is required' });
    }

    let imported = 0;
    let errors = [];
    const touchedCryptoIds = new Set();

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];

      try {
        if (!tx.crypto_id || !tx.type || !tx.quantity || !tx.price_usd) {
          errors.push({ row: i + 1, msg: 'Missing required fields' });
          continue;
        }

        await Database.execute(
          `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [portfolioId, tx.crypto_id, tx.type, tx.quantity, tx.price_usd, tx.fee_usd || 0, tx.timestamp || new Date(), tx.notes || null]
        );
        imported++;
        touchedCryptoIds.add(tx.crypto_id);
      } catch (err) {
        errors.push({ row: i + 1, msg: err.message });
      }
    }

    // Recompute holdings once per touched crypto (instead of per-row) — faster
    // for large CSVs and avoids redundant intermediate states.
    for (const cryptoId of touchedCryptoIds) {
      try {
        await recomputeHolding(portfolioId, cryptoId);
      } catch (err) {
        log.warn(`recomputeHolding failed for crypto ${cryptoId}: ${err.message}`);
      }
    }

    res.json({ data: { imported, errors } });
  } catch (error) {
    log.error(`CSV import error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Import failed' });
  }
});
