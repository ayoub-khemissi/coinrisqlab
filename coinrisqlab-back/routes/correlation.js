import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Calculate Pearson correlation coefficient
 * @param {Array} x Array of numbers
 * @param {Array} y Array of numbers
 * @returns {number} Correlation coefficient
 */
function calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;

    return numerator / denominator;
}

/**
 * Get correlation between two cryptocurrencies
 * Query params:
 *  - symbol1: first crypto symbol (required)
 *  - symbol2: second crypto symbol (required)
 *  - period: '7d', '30d', '90d', 'all' (default: '90d')
 */
api.get('/volatility/correlation', async (req, res) => {
    try {
        const { symbol1, symbol2, period = '90d' } = req.query;

        if (!symbol1 || !symbol2) {
            return res.status(400).json({
                data: null,
                msg: 'Both symbol1 and symbol2 are required'
            });
        }

        // Get crypto IDs (case-insensitive matching)
        const [cryptos] = await Database.execute(
            'SELECT id, symbol, name FROM cryptocurrencies WHERE UPPER(symbol) IN (?, ?)',
            [symbol1.toUpperCase(), symbol2.toUpperCase()]
        );

        if (cryptos.length !== 2) {
            // Check which one is missing
            const foundSymbols = cryptos.map(c => c.symbol.toUpperCase());
            const missing = [];
            if (!foundSymbols.includes(symbol1.toUpperCase())) missing.push(symbol1);
            if (!foundSymbols.includes(symbol2.toUpperCase())) missing.push(symbol2);

            return res.status(404).json({
                data: null,
                msg: `Cryptocurrency not found: ${missing.join(', ')}`
            });
        }

        const crypto1 = cryptos.find(c => c.symbol.toUpperCase() === symbol1.toUpperCase());
        const crypto2 = cryptos.find(c => c.symbol.toUpperCase() === symbol2.toUpperCase());

        let dateFilter = '';
        switch (period) {
            case '7d':
                dateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
                break;
            case '30d':
                dateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
                break;
            case '90d':
                dateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
                break;
            case 'all':
                // Limit to 1 year for 'all' to avoid performance issues and irrelevance
                dateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)';
                break;
            default:
                dateFilter = 'AND date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
        }

        // Fetch log returns for both cryptos
        // We need to align them by date
        const [returns] = await Database.execute(`
      SELECT 
        r1.date,
        r1.log_return as return1,
        r2.log_return as return2
      FROM crypto_log_returns r1
      INNER JOIN crypto_log_returns r2 ON r1.date = r2.date
      WHERE r1.crypto_id = ? 
        AND r2.crypto_id = ?
        ${dateFilter.replace(/date/g, 'r1.date')}
      ORDER BY r1.date ASC
    `, [crypto1.id, crypto2.id]);

        if (returns.length < 2) {
            return res.json({
                data: {
                    correlation: 0,
                    symbol1: crypto1.symbol,
                    symbol2: crypto2.symbol,
                    period,
                    dataPoints: returns.length,
                    msg: 'Insufficient overlapping data points'
                }
            });
        }

        const series1 = returns.map(r => parseFloat(r.return1));
        const series2 = returns.map(r => parseFloat(r.return2));

        const correlation = calculateCorrelation(series1, series2);

        res.json({
            data: {
                correlation,
                symbol1: crypto1.symbol,
                symbol2: crypto2.symbol,
                period,
                dataPoints: returns.length
            }
        });

        log.debug(`Calculated correlation between ${symbol1} and ${symbol2}: ${correlation.toFixed(4)}`);
    } catch (error) {
        log.error(`Error calculating correlation: ${error.message}`);
        res.status(500).json({
            data: null,
            msg: 'Failed to calculate correlation'
        });
    }
});
