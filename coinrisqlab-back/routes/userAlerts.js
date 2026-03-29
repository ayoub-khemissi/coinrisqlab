import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';

// ─── List Alerts ────────────────────────────────────────────────────────────

api.get('/user/alerts', authenticateUser, async (req, res) => {
  try {
    const [alerts] = await Database.execute(
      `SELECT
        a.id, a.crypto_id, c.symbol, c.name AS crypto_name, c.image_url,
        a.alert_type, a.threshold_value, a.direction, a.is_active,
        a.last_triggered_at, a.created_at,
        md.price_usd AS current_price
      FROM user_alerts a
      JOIN cryptocurrencies c ON c.id = a.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = a.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = a.crypto_id)
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC`,
      [req.user.id]
    );

    res.json({ data: alerts });
  } catch (error) {
    log.error(`List alerts error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to fetch alerts' });
  }
});

// ─── Create Alert ───────────────────────────────────────────────────────────

api.post('/user/alerts', authenticateUser, async (req, res) => {
  try {
    const { crypto_id, alert_type, threshold_value, direction } = req.body;

    if (!crypto_id || !alert_type || threshold_value === undefined || !direction) {
      return res.status(400).json({ data: null, msg: 'crypto_id, alert_type, threshold_value, and direction are required' });
    }

    const validTypes = ['price', 'volatility', 'drawdown', 'var_breach', 'rebalancing'];
    if (!validTypes.includes(alert_type)) {
      return res.status(400).json({ data: null, msg: `alert_type must be one of: ${validTypes.join(', ')}` });
    }

    if (!['above', 'below'].includes(direction)) {
      return res.status(400).json({ data: null, msg: 'direction must be above or below' });
    }

    // Free plan restrictions
    if (req.user.plan === 'free') {
      // Only price alerts
      if (alert_type !== 'price') {
        return res.status(403).json({ data: null, msg: 'Free plan only supports price alerts. Upgrade to Pro for all alert types.' });
      }

      // Max 3 alerts
      const [count] = await Database.execute(
        'SELECT COUNT(*) AS cnt FROM user_alerts WHERE user_id = ?',
        [req.user.id]
      );
      if (count[0].cnt >= 3) {
        return res.status(403).json({ data: null, msg: 'Free plan allows max 3 alerts. Upgrade to Pro for unlimited.' });
      }
    }

    // Verify crypto exists
    const [cryptos] = await Database.execute(
      'SELECT id FROM cryptocurrencies WHERE id = ?',
      [crypto_id]
    );
    if (cryptos.length === 0) {
      return res.status(400).json({ data: null, msg: 'Cryptocurrency not found' });
    }

    const [result] = await Database.execute(
      `INSERT INTO user_alerts (user_id, crypto_id, alert_type, threshold_value, direction)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, crypto_id, alert_type, threshold_value, direction]
    );

    res.status(201).json({ data: { id: result.insertId } });
  } catch (error) {
    log.error(`Create alert error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to create alert' });
  }
});

// ─── Update Alert ───────────────────────────────────────────────────────────

api.put('/user/alerts/:id', authenticateUser, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const { threshold_value, direction, is_active } = req.body;

    const [result] = await Database.execute(
      `UPDATE user_alerts
       SET threshold_value = COALESCE(?, threshold_value),
           direction = COALESCE(?, direction),
           is_active = COALESCE(?, is_active)
       WHERE id = ? AND user_id = ?`,
      [
        threshold_value !== undefined ? threshold_value : null,
        direction || null,
        is_active !== undefined ? is_active : null,
        alertId,
        req.user.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Alert not found' });
    }

    res.json({ data: { id: alertId } });
  } catch (error) {
    log.error(`Update alert error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to update alert' });
  }
});

// ─── Delete Alert ───────────────────────────────────────────────────────────

api.delete('/user/alerts/:id', authenticateUser, async (req, res) => {
  try {
    const [result] = await Database.execute(
      'DELETE FROM user_alerts WHERE id = ? AND user_id = ?',
      [parseInt(req.params.id), req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ data: null, msg: 'Alert not found' });
    }

    res.json({ data: null, msg: 'Alert deleted' });
  } catch (error) {
    log.error(`Delete alert error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to delete alert' });
  }
});
