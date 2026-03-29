import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';

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
        h.first_buy_date,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value,
        (h.quantity * (md.price_usd - h.avg_buy_price)) AS unrealized_pnl,
        CASE WHEN h.avg_buy_price > 0
          THEN ((md.price_usd - h.avg_buy_price) / h.avg_buy_price * 100)
          ELSE 0
        END AS pnl_percent,
        md.percent_change_24h
      FROM user_portfolio_holdings h
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE h.portfolio_id = ?
      ORDER BY current_value DESC`,
      [portfolioId]
    );

    // Compute total for allocation percentages
    const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const data = holdings.map(h => ({
      ...h,
      allocation_pct: totalValue > 0 ? Number(((h.current_value / totalValue) * 100).toFixed(2)) : 0,
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

    // Free plan: max 10 holdings
    if (req.user.plan === 'free') {
      const [count] = await Database.execute(
        'SELECT COUNT(*) AS cnt FROM user_portfolio_holdings WHERE portfolio_id = ?',
        [portfolioId]
      );
      if (count[0].cnt >= 10) {
        return res.status(403).json({ data: null, msg: 'Free plan allows max 10 cryptos per portfolio. Upgrade to Pro.' });
      }
    }

    // Check if already holding this crypto — update instead
    const [existing] = await Database.execute(
      'SELECT id, quantity, avg_buy_price FROM user_portfolio_holdings WHERE portfolio_id = ? AND crypto_id = ?',
      [portfolioId, crypto_id]
    );

    if (existing.length > 0) {
      // Weighted average price
      const oldQty = parseFloat(existing[0].quantity);
      const oldPrice = parseFloat(existing[0].avg_buy_price);
      const newQty = parseFloat(quantity);
      const newPrice = parseFloat(avg_buy_price || 0);
      const totalQty = oldQty + newQty;
      const weightedPrice = totalQty > 0 ? (oldQty * oldPrice + newQty * newPrice) / totalQty : 0;

      await Database.execute(
        'UPDATE user_portfolio_holdings SET quantity = ?, avg_buy_price = ? WHERE id = ?',
        [totalQty, weightedPrice, existing[0].id]
      );

      res.json({ data: { id: existing[0].id, quantity: totalQty, avg_buy_price: weightedPrice } });
    } else {
      const [result] = await Database.execute(
        'INSERT INTO user_portfolio_holdings (portfolio_id, crypto_id, quantity, avg_buy_price, first_buy_date) VALUES (?, ?, ?, ?, ?)',
        [portfolioId, crypto_id, quantity, avg_buy_price || 0, first_buy_date || null]
      );

      res.status(201).json({ data: { id: result.insertId, crypto_id, quantity, avg_buy_price: avg_buy_price || 0 } });
    }
  } catch (error) {
    log.error(`Add holding error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to add holding' });
  }
});

// Update holding
api.put('/user/portfolios/:id/holdings/:holdingId', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    if (!(await verifyPortfolioOwnership(portfolioId, req.user.id))) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const holdingId = parseInt(req.params.holdingId);
    const { quantity, avg_buy_price, first_buy_date } = req.body;

    const [result] = await Database.execute(
      `UPDATE user_portfolio_holdings
       SET quantity = COALESCE(?, quantity),
           avg_buy_price = COALESCE(?, avg_buy_price),
           first_buy_date = COALESCE(?, first_buy_date)
       WHERE id = ? AND portfolio_id = ?`,
      [quantity || null, avg_buy_price !== undefined ? avg_buy_price : null, first_buy_date || null, holdingId, portfolioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Holding not found' });
    }

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

    const [result] = await Database.execute(
      'DELETE FROM user_portfolio_holdings WHERE id = ? AND portfolio_id = ?',
      [parseInt(req.params.holdingId), portfolioId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Holding not found' });
    }

    res.json({ data: null, msg: 'Holding deleted' });
  } catch (error) {
    log.error(`Delete holding error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to delete holding' });
  }
});
