import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { getMaxDataPoints } from '../utils/queryHelpers.js';

api.get('/index-details', async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    let timeFilter = '';
    switch (period) {
      case '24h':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY)';
        break;
      case '7d':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        break;
      case '30d':
        timeFilter = 'AND ih.timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
        break;
      default:
        timeFilter = '';
    }

    const maxPoints = getMaxDataPoints(period);

    const [latestIndex] = await Database.execute(`
      SELECT
        ih.index_level,
        ih.timestamp,
        ih.total_market_cap_usd,
        ih.number_of_constituents,
        (
          SELECT ih2.index_level
          FROM index_history ih2
          INNER JOIN index_config ic2 ON ih2.index_config_id = ic2.id
          WHERE ic2.index_name = 'CoinRisqLab 80'
            AND ih2.timestamp <= DATE_SUB(ih.timestamp, INTERVAL 1 HOUR)
          ORDER BY ih2.timestamp DESC
          LIMIT 1
        ) as previous_level_1h
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [yesterdayIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [lastWeekIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 7 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    const [lastMonthIndex] = await Database.execute(`
      SELECT ih.index_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
        AND ih.timestamp <= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY ih.timestamp DESC
      LIMIT 1
    `);

    // Get index history with intelligent downsampling for chart visualization
    const [indexHistory] = await Database.execute(`
      SELECT index_level, timestamp FROM (
        SELECT
          ih.index_level,
          ih.timestamp,
          ROW_NUMBER() OVER (ORDER BY ih.timestamp) as rn,
          COUNT(*) OVER () as total_count
        FROM index_history ih
        INNER JOIN index_config ic ON ih.index_config_id = ic.id
        WHERE ic.index_name = 'CoinRisqLab 80'
          ${timeFilter}
      ) sub
      WHERE
        rn = 1
        OR rn = total_count
        OR MOD(rn - 1, GREATEST(1, FLOOR(total_count / ?))) = 0
      ORDER BY timestamp ASC
    `, [maxPoints]);

    const [constituents] = await Database.execute(`
      SELECT
        ic.rank_position,
        c.coingecko_id,
        c.symbol,
        c.name,
        c.image_url,
        ic.price_usd,
        (ic.price_usd * ic.circulating_supply) as market_cap_usd,
        ic.circulating_supply,
        ic.weight_in_index,
        md.percent_change_24h,
        md.percent_change_7d,
        md.volume_24h_usd
      FROM index_constituents ic
      INNER JOIN index_history ih ON ic.index_history_id = ih.id
      INNER JOIN cryptocurrencies c ON ic.crypto_id = c.id
      INNER JOIN market_data md ON ic.market_data_id = md.id
      WHERE ih.id = (
        SELECT ih2.id
        FROM index_history ih2
        INNER JOIN index_config ic2 ON ih2.index_config_id = ic2.id
        WHERE ic2.index_name = 'CoinRisqLab 80'
        ORDER BY ih2.timestamp DESC
        LIMIT 1
      )
      ORDER BY ic.rank_position ASC
    `);

    const current = latestIndex[0] || null;
    const historicalValues = {
      yesterday: yesterdayIndex[0]?.index_level || null,
      lastWeek: lastWeekIndex[0]?.index_level || null,
      lastMonth: lastMonthIndex[0]?.index_level || null
    };

    const percent_change_1h = current && current.previous_level_1h
      ? ((current.index_level - current.previous_level_1h) / current.previous_level_1h * 100)
      : null;

    // Backend-computed percent changes — front never derives metrics.
    // Returns null per period when the historical anchor isn't available.
    const computeChange = (anchor) => {
      if (!current || !anchor || anchor <= 0) return null;
      return ((current.index_level - anchor) / anchor) * 100;
    };

    const changes = {
      '1h': percent_change_1h,
      '24h': computeChange(historicalValues.yesterday),
      '7d': computeChange(historicalValues.lastWeek),
      '30d': computeChange(historicalValues.lastMonth),
    };

    res.json({
      data: {
        current: {
          ...current,
          percent_change_1h
        },
        historicalValues,
        changes,
        history: indexHistory,
        constituents
      }
    });

    log.debug('Fetched index details');
  } catch (error) {
    log.error(`Error fetching index details: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch index details',
    });
  }
});
