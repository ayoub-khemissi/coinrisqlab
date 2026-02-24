import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

api.get('/cryptocurrencies', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const sortBy = req.query.sortBy || 'market_cap_usd';
    const sortOrder = (req.query.sortOrder || 'desc').toUpperCase();
    const search = req.query.search || '';

    const allowedSortColumns = [
      'market_cap_usd',
      'price_usd',
      'percent_change_24h',
      'percent_change_7d',
      'volume_24h_usd',
      'circulating_supply',
      'symbol',
      'name',
      'ma_90d',
      'beta'
    ];

    if (!allowedSortColumns.includes(sortBy)) {
      return res.status(400).json({
        data: null,
        msg: 'Invalid sortBy parameter',
      });
    }

    if (!['ASC', 'DESC'].includes(sortOrder)) {
      return res.status(400).json({
        data: null,
        msg: 'Invalid sortOrder parameter',
      });
    }

    const offset = (page - 1) * limit;

    const sortByMap = {
      'market_cap_usd': '(md.price_usd * md.circulating_supply)',
      'ma_90d': 'cma.moving_average',
      'beta': 'cb.beta',
    };
    const orderByClause = `ORDER BY ${sortByMap[sortBy] || sortBy} ${sortOrder}`;

    // Build search condition
    const searchCondition = search
      ? `AND (c.symbol LIKE ? OR c.name LIKE ?)`
      : '';
    const searchParams = search
      ? [`%${search}%`, `%${search}%`]
      : [];

    const [rows] = await Database.execute(`
      SELECT
        c.id,
        c.coingecko_id,
        c.symbol,
        c.name,
        c.image_url,
        md.price_usd,
        (md.price_usd * md.circulating_supply) as market_cap_usd,
        md.volume_24h_usd,
        md.circulating_supply,
        md.percent_change_24h,
        md.percent_change_7d,
        md.timestamp,
        ranked.rank_number as \`rank\`,
        cma.moving_average as ma_90d,
        cb.beta
      FROM cryptocurrencies c
      INNER JOIN market_data md ON c.id = md.crypto_id
      INNER JOIN (
        SELECT
          md2.crypto_id,
          ROW_NUMBER() OVER (ORDER BY (md2.price_usd * md2.circulating_supply) DESC) as rank_number
        FROM market_data md2
        WHERE md2.timestamp = (SELECT MAX(timestamp) FROM market_data)
          AND (md2.price_usd * md2.circulating_supply) > 0
      ) ranked ON c.id = ranked.crypto_id
      LEFT JOIN (
        SELECT cma2.crypto_id, cma2.moving_average
        FROM crypto_moving_averages cma2
        INNER JOIN (
          SELECT crypto_id, MAX(date) as max_date
          FROM crypto_moving_averages
          WHERE window_days = 90
          GROUP BY crypto_id
        ) cma_latest ON cma2.crypto_id = cma_latest.crypto_id
          AND cma2.date = cma_latest.max_date
          AND cma2.window_days = 90
      ) cma ON c.id = cma.crypto_id
      LEFT JOIN (
        SELECT cb2.crypto_id, cb2.beta
        FROM crypto_beta cb2
        INNER JOIN (
          SELECT crypto_id, MAX(date) as max_date
          FROM crypto_beta
          WHERE window_days = 90
          GROUP BY crypto_id
        ) cb_latest ON cb2.crypto_id = cb_latest.crypto_id
          AND cb2.date = cb_latest.max_date
          AND cb2.window_days = 90
      ) cb ON c.id = cb.crypto_id
      WHERE md.timestamp = (SELECT MAX(timestamp) FROM market_data)
        AND (md.price_usd * md.circulating_supply) > 0
        ${searchCondition}
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `, searchParams);

    const [countResult] = await Database.execute(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM cryptocurrencies c
      INNER JOIN market_data md ON c.id = md.crypto_id
      WHERE md.timestamp = (SELECT MAX(timestamp) FROM market_data)
        AND (md.price_usd * md.circulating_supply) > 0
        ${searchCondition}
    `, searchParams);

    const total = countResult[0].total;

    res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

    log.debug(`Fetched ${rows.length} cryptocurrencies (page ${page})`);
  } catch (error) {
    log.error(`Error fetching cryptocurrencies: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch cryptocurrencies',
    });
  }
});
