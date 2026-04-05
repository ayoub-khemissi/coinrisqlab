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

    // Insert transaction
    const txTimestamp = timestamp || new Date().toISOString().slice(0, 19).replace('T', ' ');
    const [result] = await Database.execute(
      `INSERT INTO user_transactions (portfolio_id, crypto_id, type, quantity, price_usd, fee_usd, timestamp, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [portfolioId, crypto_id, type, quantity, price_usd, fee_usd || 0, txTimestamp, notes || null]
    );

    // Update holding based on transaction type
    const [existingHolding] = await Database.execute(
      'SELECT id, quantity, avg_buy_price FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
      [portfolioId, crypto_id]
    );

    const qty = parseFloat(quantity);
    const price = parseFloat(price_usd);

    if (type === 'buy') {
      if (existingHolding.length > 0) {
        const oldQty = parseFloat(existingHolding[0].quantity);
        const oldPrice = parseFloat(existingHolding[0].avg_buy_price);
        const totalQty = oldQty + qty;
        const weightedPrice = totalQty > 0 ? (oldQty * oldPrice + qty * price) / totalQty : 0;

        await Database.execute(
          'UPDATE user_portfolio_holdings SET quantity = ?, avg_buy_price = ? WHERE id = ?',
          [totalQty, weightedPrice, existingHolding[0].id]
        );
      } else {
        // Check free plan limit
        if (req.user.plan === 'free') {
          const [count] = await Database.execute(
            'SELECT COUNT(*) AS cnt FROM user_portfolio_holdings WHERE portfolio_id = ?',
            [portfolioId]
          );
          if (count[0].cnt >= 10) {
            return res.status(403).json({ data: null, msg: 'Free plan allows max 10 cryptos per portfolio' });
          }
        }

        await Database.execute(
          `INSERT INTO user_portfolio_holdings (portfolio_id, crypto_id, quantity, avg_buy_price, first_buy_date)
           VALUES (?, ?, ?, ?, ?)`,
          [portfolioId, crypto_id, qty, price, txTimestamp.slice(0, 10)]
        );
      }
    } else if (type === 'sell') {
      if (existingHolding.length > 0) {
        const newQty = parseFloat(existingHolding[0].quantity) - qty;
        if (newQty <= 0) {
          await Database.execute(
            'DELETE FROM user_portfolio_holdings WHERE id = ?',
            [existingHolding[0].id]
          );
        } else {
          await Database.execute(
            'UPDATE user_portfolio_holdings SET quantity = ? WHERE id = ?',
            [newQty, existingHolding[0].id]
          );
        }
      }
    }
    // transfer: no holding update

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

    const [result] = await Database.execute(
      'DELETE FROM user_transactions WHERE id = ? AND portfolio_id = ?',
      [parseInt(req.params.txId), portfolioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Transaction not found' });
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
      } catch (err) {
        errors.push({ row: i + 1, msg: err.message });
      }
    }

    res.json({ data: { imported, errors } });
  } catch (error) {
    log.error(`CSV import error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Import failed' });
  }
});
