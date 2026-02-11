import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * GET /cryptocurrency/:symbol
 * Fetches comprehensive details for a specific cryptocurrency
 */
api.get('/cryptocurrency/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();

    // 1. Fetch basic crypto info with latest market data
    const [cryptoRows] = await Database.execute(`
      SELECT
        c.id,
        c.symbol,
        c.name,
        c.image_url,
        md.price_usd,
        (md.price_usd * md.circulating_supply) as market_cap_usd,
        md.volume_24h_usd,
        md.circulating_supply,
        md.percent_change_1h,
        md.percent_change_24h,
        md.percent_change_7d,
        md.percent_change_30d,
        md.percent_change_14d,
        md.percent_change_200d,
        md.percent_change_1y,
        md.market_cap_rank,
        md.max_supply,
        md.total_supply,
        md.fully_diluted_valuation,
        md.timestamp,
        ranked.rank_number as \`rank\`
      FROM cryptocurrencies c
      INNER JOIN (
        SELECT crypto_id, MAX(timestamp) as max_timestamp
        FROM market_data
        GROUP BY crypto_id
      ) latest ON c.id = latest.crypto_id
      INNER JOIN market_data md ON c.id = md.crypto_id AND md.timestamp = latest.max_timestamp
      INNER JOIN (
        SELECT
          md2.crypto_id,
          ROW_NUMBER() OVER (ORDER BY (md2.price_usd * md2.circulating_supply) DESC) as rank_number
        FROM market_data md2
        WHERE md2.timestamp = (SELECT MAX(timestamp) FROM market_data)
          AND (md2.price_usd * md2.circulating_supply) > 0
      ) ranked ON c.id = ranked.crypto_id
      WHERE c.symbol = ?
      LIMIT 1
    `, [symbol]);

    if (cryptoRows.length === 0) {
      return res.status(404).json({
        data: null,
        msg: `Cryptocurrency ${symbol} not found`,
      });
    }

    const crypto = cryptoRows[0];

    // 2. Fetch metadata
    const [metadataRows] = await Database.execute(`
      SELECT
        description,
        logo_url,
        website_url,
        whitepaper_url,
        twitter_url,
        reddit_url,
        telegram_url,
        github_url,
        platform,
        date_launched,
        categories,
        updated_at
      FROM cryptocurrency_metadata
      WHERE crypto_id = ?
      LIMIT 1
    `, [crypto.id]);

    const metadata = metadataRows.length > 0 ? metadataRows[0] : {};

    // Parse categories if it exists
    let categories = [];
    if (metadata.categories) {
      try {
        categories = JSON.parse(metadata.categories);
      } catch (e) {
        categories = [];
      }
    }

    // 3. Fetch index rank (if crypto is part of the latest index calculation)
    const [indexRankRows] = await Database.execute(`
      SELECT ic.rank_position
      FROM index_constituents ic
      INNER JOIN index_history ih ON ic.index_history_id = ih.id
      WHERE ic.crypto_id = ?
        AND ih.id = (SELECT MAX(id) FROM index_history)
      LIMIT 1
    `, [crypto.id]);

    const indexRank = indexRankRows.length > 0 ? indexRankRows[0].rank_position : null;

    // 4. Build response
    const response = {
      data: {
        basic: {
          id: crypto.id,
          symbol: crypto.symbol,
          name: crypto.name,
          image_url: crypto.image_url || null,
          logo_url: metadata.logo_url || null,
          description: metadata.description || null,
          categories: categories,
          metadata_updated_at: metadata.updated_at || null,
        },
        links: {
          website: metadata.website_url || null,
          whitepaper: metadata.whitepaper_url || null,
          twitter: metadata.twitter_url || null,
          reddit: metadata.reddit_url || null,
          telegram: metadata.telegram_url || null,
          github: metadata.github_url || null,
        },
        launch: {
          date: metadata.date_launched || null,
          platform: metadata.platform || null,
        },
        market: {
          price_usd: parseFloat(crypto.price_usd) || 0,
          market_cap_usd: parseFloat(crypto.market_cap_usd) || 0,
          volume_24h_usd: parseFloat(crypto.volume_24h_usd) || 0,
          circulating_supply: parseFloat(crypto.circulating_supply) || 0,
          total_supply: crypto.total_supply ? parseFloat(crypto.total_supply) : null,
          max_supply: crypto.max_supply ? parseFloat(crypto.max_supply) : null,
          fully_diluted_valuation: crypto.fully_diluted_valuation ? parseFloat(crypto.fully_diluted_valuation) : null,
          rank: crypto.rank || null,
          index_rank: indexRank,
          market_cap_rank: crypto.market_cap_rank || null,
          percent_change_1h: crypto.percent_change_1h ? parseFloat(crypto.percent_change_1h) : null,
          percent_change_24h: crypto.percent_change_24h ? parseFloat(crypto.percent_change_24h) : null,
          percent_change_7d: crypto.percent_change_7d ? parseFloat(crypto.percent_change_7d) : null,
          percent_change_14d: crypto.percent_change_14d ? parseFloat(crypto.percent_change_14d) : null,
          percent_change_30d: crypto.percent_change_30d ? parseFloat(crypto.percent_change_30d) : null,
          percent_change_200d: crypto.percent_change_200d ? parseFloat(crypto.percent_change_200d) : null,
          percent_change_1y: crypto.percent_change_1y ? parseFloat(crypto.percent_change_1y) : null,
          last_updated: crypto.timestamp,
        }
      },
    };

    res.json(response);
    log.debug(`Fetched details for cryptocurrency: ${symbol}`);

  } catch (error) {
    log.error(`Error fetching cryptocurrency detail: ${error.message}`);
    res.status(500).json({
      data: null,
      msg: 'Failed to fetch cryptocurrency detail',
    });
  }
});
