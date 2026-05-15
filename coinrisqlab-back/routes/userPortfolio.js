import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { recomputeHolding } from './userTransactions.js';

const SYNTHETIC_TX_NOTE = 'Initial position (Add Holding)';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyPortfolioOwnership(portfolioId, userId) {
  const [rows] = await Database.execute(
    'SELECT id FROM user_portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return rows.length > 0;
}

// ─── Portfolio CRUD ─────────────────────────────────────────────────────────

// List portfolios
api.get('/user/portfolios', authenticateUser, async (req, res) => {
  try {
    const [portfolios] = await Database.execute(
      `SELECT
        p.id, p.name, p.description, p.created_at, p.updated_at,
        COUNT(h.id) AS holding_count,
        s.total_value_usd AS latest_value,
        s.total_pnl_usd AS latest_pnl
      FROM user_portfolios p
      LEFT JOIN user_portfolio_holdings h ON h.portfolio_id = p.id
      LEFT JOIN user_portfolio_snapshots s ON s.portfolio_id = p.id
        AND s.snapshot_date = (SELECT MAX(snapshot_date) FROM user_portfolio_snapshots WHERE portfolio_id = p.id)
      WHERE p.user_id = ?
      GROUP BY p.id, s.total_value_usd, s.total_pnl_usd
      ORDER BY p.created_at ASC`,
      [req.user.id]
    );

    res.json({ data: portfolios });
  } catch (error) {
    log.error(`List portfolios error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch portfolios' });
  }
});

// Create portfolio
api.post('/user/portfolios', authenticateUser, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ data: null, msg: 'Portfolio name is required' });
    }

    // Free plan: max 1 portfolio
    if (req.user.plan === 'free') {
      const [existing] = await Database.execute(
        'SELECT COUNT(*) AS cnt FROM user_portfolios WHERE user_id = ?',
        [req.user.id]
      );
      if (existing[0].cnt >= 1) {
        return res.status(403).json({ data: null, msg: 'Free plan allows only 1 portfolio. Upgrade to Pro for unlimited.' });
      }
    }

    const [result] = await Database.execute(
      'INSERT INTO user_portfolios (user_id, name, description) VALUES (?, ?, ?)',
      [req.user.id, name.trim(), description || null]
    );

    res.status(201).json({
      data: { id: result.insertId, name: name.trim(), description: description || null },
    });
  } catch (error) {
    log.error(`Create portfolio error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to create portfolio' });
  }
});

// Update portfolio
api.put('/user/portfolios/:id', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { name, description } = req.body;
    await Database.execute(
      'UPDATE user_portfolios SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name || null, description !== undefined ? description : null, portfolioId]
    );

    res.json({ data: { id: portfolioId, name, description } });
  } catch (error) {
    log.error(`Update portfolio error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to update portfolio' });
  }
});

// Duplicate portfolio (copies holdings + transactions under a new name).
// Same plan check as POST /user/portfolios.
api.post('/user/portfolios/:id/duplicate', authenticateUser, async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(sourceId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ data: null, msg: 'Portfolio name is required' });
    }

    // Free plan: max 1 portfolio
    if (req.user.plan === 'free') {
      const [existing] = await Database.execute(
        'SELECT COUNT(*) AS cnt FROM user_portfolios WHERE user_id = ?',
        [req.user.id]
      );
      if (existing[0].cnt >= 1) {
        return res.status(403).json({ data: null, msg: 'Free plan allows only 1 portfolio. Upgrade to Pro for unlimited.' });
      }
    }

    const [src] = await Database.execute(
      'SELECT description FROM user_portfolios WHERE id = ?',
      [sourceId]
    );
    const description = src[0]?.description ?? null;

    const [created] = await Database.execute(
      'INSERT INTO user_portfolios (user_id, name, description) VALUES (?, ?, ?)',
      [req.user.id, name.trim(), description]
    );
    const newId = created.insertId;

    // Clone holdings
    await Database.execute(
      `INSERT INTO user_portfolio_holdings (portfolio_id, crypto_id, quantity, avg_buy_price, first_buy_date)
       SELECT ?, crypto_id, quantity, avg_buy_price, first_buy_date
       FROM user_portfolio_holdings WHERE portfolio_id = ?`,
      [newId, sourceId]
    );

    // Clone transaction history (so the TWR / analytics replay matches the source)
    await Database.execute(
      `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
       SELECT ?, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes
       FROM user_transactions WHERE portfolio_id = ?`,
      [newId, sourceId]
    );

    res.status(201).json({ data: { id: newId, name: name.trim(), description } });
  } catch (error) {
    log.error(`Duplicate portfolio error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to duplicate portfolio' });
  }
});

// Delete portfolio
api.delete('/user/portfolios/:id', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    await Database.execute('DELETE FROM user_portfolios WHERE id = ?', [portfolioId]);
    res.json({ data: null, msg: 'Portfolio deleted' });
  } catch (error) {
    log.error(`Delete portfolio error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to delete portfolio' });
  }
});

// ─── Aggregated holdings (all portfolios for a user) ───────────────────────

// List holdings across ALL of the user's portfolios in a single round-trip.
// Used by the dashboard and portfolios-list pages to compute live totals
// without N+1 fetches.
api.get('/user/holdings/all', authenticateUser, async (req, res) => {
  try {
    const [holdings] = await Database.execute(
      `SELECT
        h.id,
        h.portfolio_id,
        p.name AS portfolio_name,
        h.crypto_id,
        c.symbol,
        c.name AS crypto_name,
        c.image_url,
        h.quantity,
        h.avg_buy_price,
        h.realized_pnl_usd,
        h.first_buy_date,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value,
        (h.quantity * (md.price_usd - h.avg_buy_price)) AS unrealized_pnl,
        CASE WHEN h.avg_buy_price > 0
          THEN ((md.price_usd - h.avg_buy_price) / h.avg_buy_price * 100)
          ELSE 0
        END AS pnl_percent,
        md.percent_change_24h
      FROM user_portfolios p
      JOIN user_portfolio_holdings h ON h.portfolio_id = p.id
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE p.user_id = ?
      ORDER BY (h.quantity > 0) DESC, current_value DESC`,
      [req.user.id]
    );

    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.current_value) || 0), 0);
    const totalPnl = holdings.reduce((sum, h) => sum + (parseFloat(h.unrealized_pnl) || 0), 0);

    const data = holdings.map(h => ({
      ...h,
      allocation_pct: totalValue > 0
        ? ((parseFloat(h.current_value) || 0) / totalValue * 100)
        : 0,
    }));

    const portfoliosCount = new Set(holdings.map(h => h.portfolio_id)).size;

    res.json({ data, totalValue, totalPnl, portfoliosCount });
  } catch (error) {
    log.error(`List all holdings error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch holdings' });
  }
});

// ─── Holdings CRUD ──────────────────────────────────────────────────────────

// List holdings with live prices
api.get('/user/portfolios/:id/holdings', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const [holdings] = await Database.execute(
      `SELECT
        h.id,
        h.crypto_id,
        c.symbol,
        c.name AS crypto_name,
        c.image_url,
        h.quantity,
        h.avg_buy_price,
        h.realized_pnl_usd,
        h.first_buy_date,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value,
        (h.quantity * (md.price_usd - h.avg_buy_price)) AS unrealized_pnl,
        CASE WHEN h.avg_buy_price > 0
          THEN ((md.price_usd - h.avg_buy_price) / h.avg_buy_price * 100)
          ELSE 0
        END AS pnl_percent,
        md.percent_change_24h,
        (
          SELECT COUNT(*) FROM user_transactions ut
          WHERE ut.portfolio_id = h.portfolio_id AND ut.crypto_id = h.crypto_id
            AND NOT (ut.type = 'buy' AND ut.notes = 'Initial position (Add Holding)')
        ) AS real_tx_count
      FROM user_portfolio_holdings h
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE h.portfolio_id = ?
      ORDER BY (h.quantity > 0) DESC, current_value DESC`,
      [portfolioId]
    );

    // Compute total for allocation percentages
    const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const data = holdings.map(h => ({
      ...h,
      allocation_pct: totalValue > 0 ? ((h.current_value / totalValue) * 100) : 0,
    }));

    res.json({ data, totalValue });
  } catch (error) {
    log.error(`List holdings error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch holdings' });
  }
});

// Add holding
api.post('/user/portfolios/:id/holdings', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { crypto_id, quantity, avg_buy_price, first_buy_date } = req.body;

    if (!crypto_id || !quantity || quantity <= 0) {
      return res.status(400).json({ data: null, msg: 'crypto_id and positive quantity are required' });
    }

    // Verify crypto exists
    const [cryptos] = await Database.execute(
      'SELECT id FROM cryptocurrencies WHERE id = ?',
      [crypto_id]
    );
    if (cryptos.length === 0) {
      return res.status(400).json({ data: null, msg: 'Cryptocurrency not found' });
    }

    // Free plan: max 10 OPEN cryptos per portfolio (closed positions with
    // qty=0 don't count — they're history).
    if (req.user.plan === 'free') {
      const [existingHolding] = await Database.execute(
        'SELECT id, quantity FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
        [portfolioId, crypto_id]
      );

      if (existingHolding.length === 0 || parseFloat(existingHolding[0].quantity) <= 0) {
        const [count] = await Database.execute(
          'SELECT COUNT(*) AS cnt FROM user_portfolio_holdings WHERE portfolio_id = ? AND quantity > 0',
          [portfolioId]
        );

        if (count[0].cnt >= 10) {
          return res.status(403).json({ data: null, msg: 'Free plan allows max 10 cryptos per portfolio. Upgrade to Pro.' });
        }
      }
    }

    // Add Holding inserts a synthetic "buy" transaction so the unified
    // ledger (user_transactions) stays the single source of truth. The
    // holding row is then derived by recomputeHolding — no direct write.
    const today = new Date().toISOString().slice(0, 10);
    const fbDate = first_buy_date && first_buy_date <= today ? first_buy_date : today;
    const txTimestamp = `${fbDate} 00:00:00`;

    await Database.execute(
      `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
       VALUES (?, ?, 'buy', ?, ?, 0, ?, ?)`,
      [portfolioId, crypto_id, quantity, avg_buy_price || 0, txTimestamp, SYNTHETIC_TX_NOTE]
    );

    await recomputeHolding(portfolioId, crypto_id);

    const [refreshed] = await Database.execute(
      'SELECT id, quantity, avg_buy_price, realized_pnl_usd FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
      [portfolioId, crypto_id]
    );

    res.status(201).json({ data: refreshed[0] });
  } catch (error) {
    log.error(`Add holding error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to add holding' });
  }
});

// Update holding (only allowed when no real transaction history exists —
// just the synthetic "Initial position" tx, or no tx at all).
api.put('/user/portfolios/:id/holdings/:holdingId', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdingId = parseInt(req.params.holdingId);
    const { quantity, avg_buy_price, first_buy_date } = req.body;

    const [holdingRow] = await Database.execute(
      'SELECT crypto_id FROM user_portfolio_holdings WHERE id = ? AND portfolio_id = ?',
      [holdingId, portfolioId]
    );

    if (holdingRow.length === 0) {
      return res.status(404).json({ data: null, msg: 'Holding not found' });
    }

    const cryptoId = holdingRow[0].crypto_id;

    // Inspect transaction history for this crypto. Edit is allowed only when
    // the only existing tx is the synthetic Initial position (or none) — once
    // real Buy/Sell entries exist, the user must adjust via Buy/Sell to keep
    // the realised P&L history consistent.
    const [txs] = await Database.execute(
      'SELECT id, type, notes FROM user_transactions WHERE portfolio_id = ? AND crypto_id = ? ORDER BY timestamp ASC, id ASC',
      [portfolioId, cryptoId]
    );

    const onlySynthetic =
      txs.length === 0 ||
      (txs.length === 1 && txs[0].type === 'buy' && txs[0].notes === SYNTHETIC_TX_NOTE);

    if (!onlySynthetic) {
      return res.status(400).json({
        data: null,
        msg: 'Cannot edit a holding that already has Buy/Sell history. Use Buy/Sell to adjust the position.',
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const fbDate =
      first_buy_date && first_buy_date <= today
        ? first_buy_date
        : today;

    if (txs.length === 0) {
      // No tx yet (legacy holding pre-migration): create the synthetic buy
      await Database.execute(
        `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
         VALUES (?, ?, 'buy', ?, ?, 0, ?, ?)`,
        [
          portfolioId,
          cryptoId,
          quantity,
          avg_buy_price !== undefined ? avg_buy_price : 0,
          `${fbDate} 00:00:00`,
          SYNTHETIC_TX_NOTE,
        ]
      );
    } else {
      // Update the existing synthetic buy in place
      await Database.execute(
        `UPDATE user_transactions
         SET quantity = COALESCE(?, quantity),
             price_usd = COALESCE(?, price_usd),
             timestamp = COALESCE(?, timestamp)
         WHERE id = ?`,
        [
          quantity ?? null,
          avg_buy_price !== undefined ? avg_buy_price : null,
          first_buy_date ? `${fbDate} 00:00:00` : null,
          txs[0].id,
        ]
      );
    }

    await recomputeHolding(portfolioId, cryptoId);

    res.json({ data: { id: holdingId, quantity, avg_buy_price } });
  } catch (error) {
    log.error(`Update holding error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to update holding' });
  }
});

// Delete holding
api.delete('/user/portfolios/:id/holdings/:holdingId', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdingId = parseInt(req.params.holdingId);

    // Find the crypto so we can also wipe its transaction history (the
    // holding row is a derived cache; leaving txs behind would cause it
    // to be re-created on the next recompute).
    const [holdingRow] = await Database.execute(
      'SELECT crypto_id FROM user_portfolio_holdings WHERE id = ? AND portfolio_id = ?',
      [holdingId, portfolioId]
    );

    if (holdingRow.length === 0) {
      return res.status(404).json({ data: null, msg: 'Holding not found' });
    }

    await Database.execute(
      'DELETE FROM user_transactions WHERE portfolio_id = ? AND crypto_id = ?',
      [portfolioId, holdingRow[0].crypto_id]
    );

    await Database.execute('DELETE FROM user_portfolio_holdings WHERE id = ?', [
      holdingId,
    ]);

    res.json({ data: null, msg: 'Holding deleted' });
  } catch (error) {
    log.error(`Delete holding error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to delete holding' });
  }
});
