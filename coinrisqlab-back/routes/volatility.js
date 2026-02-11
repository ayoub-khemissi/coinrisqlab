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
      SELECT pv.id, pv.date, pv.index_config_id
      FROM portfolio_volatility pv
      INNER JOIN index_config ic ON pv.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY pv.date DESC
      LIMIT 1
    `);

    if (pvRecords.length === 0) {
      return res.json({ data: [] });
    }

    const { id: pvId, date: pvDate, index_config_id: indexConfigId } = pvRecords[0];

    // 2. Get calculated constituents
    const [calculatedConstituents] = await Database.execute(`
      SELECT
        pvc.crypto_id,
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

    // 3. Get all index constituents for the specific index history snapshot used
    // We target the latest snapshot for that date to avoid duplicates from multiple runs
    const [allIndexConstituents] = await Database.execute(`
      SELECT
        ic.crypto_id,
        c.symbol,
        c.name,
        c.image_url
      FROM index_constituents ic
      INNER JOIN index_history ih ON ic.index_history_id = ih.id
      INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
      WHERE ih.id = (
        SELECT id
        FROM index_history
        WHERE index_config_id = ?
          AND snapshot_date = ?
        ORDER BY timestamp DESC
        LIMIT 1
      )
    `, [indexConfigId, pvDate]);

    // 4. Merge lists
    // Create a Set of calculated crypto IDs for fast lookup
    const calculatedIds = new Set(calculatedConstituents.map(c => c.crypto_id));
    const mergedConstituents = [...calculatedConstituents];

    // Find excluded constituents
    const excludedConstituents = allIndexConstituents.filter(c => !calculatedIds.has(c.crypto_id));

    // Get available days count for excluded constituents
    if (excludedConstituents.length > 0) {
      const excludedIds = excludedConstituents.map(c => c.crypto_id);
      const [availableDaysData] = await Database.execute(`
        SELECT crypto_id, COUNT(*) as available_days
        FROM crypto_log_returns
        WHERE crypto_id IN (${excludedIds.join(',')})
          AND date <= ?
        GROUP BY crypto_id
      `, [pvDate]);

      const availableDaysMap = new Map(availableDaysData.map(d => [d.crypto_id, d.available_days]));

      for (const constituent of excludedConstituents) {
        mergedConstituents.push({
          crypto_id: constituent.crypto_id,
          symbol: constituent.symbol,
          name: constituent.name,
          image_url: constituent.image_url,
          weight: 0,
          daily_volatility: 0,
          annualized_volatility: 0,
          market_cap_usd: 0,
          available_days: availableDaysMap.get(constituent.crypto_id) || 0
        });
      }
    }

    // Sort again by weight desc, then by symbol for the 0-weight ones to be stable
    mergedConstituents.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.symbol.localeCompare(b.symbol);
    });

    res.json({
      data: mergedConstituents
    });

    log.debug(`Fetched portfolio volatility constituents (found ${allIndexConstituents.length} expected, returning ${mergedConstituents.length})`);
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
api.get('/volatility/crypto/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '90d' } = req.query;

    // Get crypto ID
    const [crypto] = await Database.execute(
      'SELECT id, symbol, name FROM cryptocurrencies WHERE symbol = ?',
      [symbol.toUpperCase()]
    );

    if (crypto.length === 0) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`
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

    log.debug(`Fetched volatility data for ${symbol}`);
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
