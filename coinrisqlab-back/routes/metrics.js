import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

api.get('/metrics', async (req, res) => {
  try {
    const [indexData] = await Database.execute(`
      SELECT
        ih.index_level,
        ih.timestamp,
        (
          SELECT ih2.index_level
          FROM index_history ih2
          INNER JOIN index_config ic2 ON ih2.index_config_id = ic2.id
          WHERE ic2.index_name = 'CoinRisqLab 80'
            AND ih2.timestamp <= DATE_SUB(ih.timestamp, INTERVAL 1 DAY)
          ORDER BY ih2.timestamp DESC
          LIMIT 1
        ) as previous_level
      FROM index_history ih
      INNER JOIN index_config ic ON ih.index_config_id = ic.id
      WHERE ic.index_name = 'CoinRisqLab 80'
      ORDER BY ih.timestamp DESC
      LIMIT 30
    `);

    const indexDataWithChange = indexData.map(item => ({
      index_level: item.index_level,
      timestamp: item.timestamp,
      percent_change_24h: item.previous_level
        ? ((item.index_level - item.previous_level) / item.previous_level * 100)
        : 0
    }));

    const [globalData] = await Database.execute(`
      SELECT
        total_market_cap_usd,
        total_volume_24h_usd,
        btc_dominance,
        btc_dominance_24h_change,
        eth_dominance,
        eth_dominance_24h_change,
        others_dominance,
        others_dominance_24h_change,
        total_market_cap_24h_change as market_cap_change_24h,
        total_volume_24h_change as volume_change_24h,
        timestamp
      FROM global_metrics
      ORDER BY timestamp DESC
      LIMIT 30
    `);

    const [fearGreedData] = await Database.execute(`
      SELECT value, timestamp
      FROM fear_and_greed
      ORDER BY timestamp DESC
      LIMIT 30
    `);

    const latestIndex = indexDataWithChange[0] || null;
    const latestGlobal = globalData[0] || null;
    const latestFearGreed = fearGreedData[0] || null;

    res.json({
      data: {
        index: {
          current: latestIndex,
          history: indexDataWithChange.reverse()
        },
        global: {
          current: latestGlobal,
          history: globalData.reverse()
        },
        fearGreed: {
          current: latestFearGreed,
          history: fearGreedData.reverse()
        }
      }
    });

    log.debug('Fetched metrics data');
  } catch (error) {
    log.error(`Error fetching metrics: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch metrics',
    });
  }
});
