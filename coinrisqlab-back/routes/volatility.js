import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { getDateFilter } from '../utils/queryHelpers.js';

/**
 * Get portfolio volatility data
 * Query params:
 *  - period: '24h', '7d', '30d', 'all' (default: 'all')
 */
api.get('/volatility/portfolio', async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const dateFilter = getDateFilter(period, 'pv.date');

    // Get current portfolio volatility
    const [current] = await Database.execute(`
      SELECT
        pv.*,
        ic.index_name
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    // Get historical portfolio volatility
    const [history] = await Database.execute(`
      SELECT
        pv.date,
        pv.daily_volatility,
        pv.annualized_volatility,
        pv.num_constituents,
        pv.total_market_cap_usd
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        ${dateFilter}
      ORDER BY pv.date ASC
    `);

    res.json({
      data: {
        current: current[0] || null,
        history: history
      }
    });

    log.debug('Fetched portfolio volatility data');
  } catch (error) {
    log.error(`Error fetching portfolio volatility: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch portfolio volatility'
    });
  }
});

/**
 * Get portfolio volatility constituents for the latest date
 */
api.get('/volatility/portfolio/constituents', async (req, res) => {
  try {
    // 1. Get the latest portfolio volatility record
    const [pvRecords] = await Database.execute(`
      SELECT pv.id, pv.date
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (pvRecords.length === 0) {
      return res.json({ data: [] });
    }

    const { id: pvId } = pvRecords[0];

    // 2. Get calculated constituents directly
    const [constituents] = await Database.execute(`
      SELECT
        pvc.crypto_id,
        c.coingecko_id,
        c.symbol,
        c.name,
        c.image_url,
        pvc.weight,
        pvc.daily_volatility,
        pvc.annualized_volatility,
        pvc.market_cap_usd
      FROM portfolio_volatility_constituents pvc
      INNER JOIN cryptocurrencies c ON pvc.crypto_id = c.id
      WHERE pvc.portfolio_volatility_id = ?
      ORDER BY pvc.weight DESC
    `, [pvId]);

    res.json({
      data: constituents
    });

    log.debug(`Fetched portfolio volatility constituents (${constituents.length})`);
  } catch (error) {
    log.error(`Error fetching portfolio constituents volatility: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch portfolio constituents volatility'
    });
  }
});

/**
 * Get individual cryptocurrency volatility
 * Query params:
 *  - symbol: crypto symbol (required)
 *  - period: '7d', '30d', '90d', 'all' (default: '90d')
 */
api.get('/volatility/crypto/:id', async (req, res) => {
  try {
    const { id: coingeckoId } = req.params;
    const { period = '90d' } = req.query;

    // Get crypto ID
    const [crypto] = await Database.execute(
      'SELECT id, symbol, name FROM cryptocurrencies WHERE coingecko_id = ?',
      [coingeckoId]
    );

    if (crypto.length === 0) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${coingeckoId} not found`
      });
    }

    const cryptoId = crypto[0].id;
    const dateFilter = getDateFilter(period);

    // Get latest volatility
    const [latest] = await Database.execute(`
      SELECT *
      FROM crypto_volatility
      WHERE crypto_id = ?
      ORDER BY date DESC
      LIMIT 1
    `, [cryptoId]);

    // Get historical volatility
    const [history] = await Database.execute(`
      SELECT
        date,
        daily_volatility,
        annualized_volatility,
        mean_return
      FROM crypto_volatility
      WHERE crypto_id = ?
        ${dateFilter}
      ORDER BY date ASC
    `, [cryptoId]);

    res.json({
      data: {
        crypto: crypto[0],
        latest: latest[0] || null,
        history: history
      }
    });

    log.debug(`Fetched volatility data for ${coingeckoId}`);
  } catch (error) {
    log.error(`Error fetching crypto volatility: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch crypto volatility'
    });
  }
});

/**
 * Get top N most volatile cryptocurrencies
 * Query params:
 *  - limit: number of results (default: 20)
 */
api.get('/volatility/crypto/top/volatile', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const [topVolatile] = await Database.execute(`
      SELECT
        c.id,
        c.symbol,
        c.name,
        c.image_url,
        cv.annualized_volatility,
        cv.date
      FROM crypto_volatility cv
      INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
      INNER JOIN market_data md ON c.id = md.crypto_id
      WHERE cv.date = (
        SELECT MAX(date) FROM crypto_volatility WHERE crypto_id = cv.crypto_id
      )
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data)
      ORDER BY cv.annualized_volatility DESC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      data: topVolatile
    });

    log.debug('Fetched top volatile cryptocurrencies');
  } catch (error) {
    log.error(`Error fetching top volatile cryptos: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch top volatile cryptocurrencies'
    });
  }
});

/**
 * Get least volatile cryptocurrencies
 * Query params:
 *  - limit: number of results (default: 20)
 */
api.get('/volatility/crypto/top/stable', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const [leastVolatile] = await Database.execute(`
      SELECT
        c.id,
        c.symbol,
        c.name,
        c.image_url,
        cv.annualized_volatility,
        cv.date
      FROM crypto_volatility cv
      INNER JOIN cryptocurrencies c ON cv.crypto_id = c.id
      INNER JOIN market_data md ON c.id = md.crypto_id
      WHERE cv.date = (
        SELECT MAX(date) FROM crypto_volatility WHERE crypto_id = cv.crypto_id
      )
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data)
      ORDER BY cv.annualized_volatility ASC
      LIMIT ?
    `, [parseInt(limit)]);

    res.json({
      data: leastVolatile
    });

    log.debug('Fetched least volatile cryptocurrencies');
  } catch (error) {
    log.error(`Error fetching least volatile cryptos: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch least volatile cryptocurrencies'
    });
  }
});
