import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import { authenticateUser } from '../middleware/userAuth.js';
import { requirePro } from '../middleware/requirePro.js';
import { getDateFilter } from '../utils/queryHelpers.js';
import {
  createReportDoc,
  addHeader,
  addSectionTitle,
  addMetricRow,
  addTable,
  addFooter,
} from '../utils/pdfReport.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function verifyPortfolioOwnership(portfolioId, userId) {
  const [rows] = await Database.execute(
    'SELECT id, name FROM user_portfolios WHERE id = ? AND user_id = ?',
    [portfolioId, userId]
  );
  return rows[0] || null;
}

function formatCSV(headers, rows) {
  const escape = (val) => {
    const str = String(val ?? '');
    return str.includes(';') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const lines = [headers.map(escape).join(';')];
  for (const row of rows) {
    lines.push(row.map(escape).join(';'));
  }
  return lines.join('\n');
}

function sendCSV(res, filename, csvContent) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csvContent); // BOM for Excel
}

// ─── Free: Positions CSV ────────────────────────────────────────────────────

api.get('/user/portfolios/:id/export/positions-csv', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await verifyPortfolioOwnership(portfolioId, req.user.id);
    if (!portfolio) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const [holdings] = await Database.execute(
      `SELECT
        c.symbol, c.name, h.quantity, h.avg_buy_price,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value,
        (h.quantity * (md.price_usd - h.avg_buy_price)) AS pnl_usd,
        CASE WHEN h.avg_buy_price > 0
          THEN ((md.price_usd - h.avg_buy_price) / h.avg_buy_price * 100)
          ELSE 0
        END AS pnl_percent
      FROM user_portfolio_holdings h
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE h.portfolio_id = ?
      ORDER BY current_value DESC`,
      [portfolioId]
    );

    const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);

    const headers = ['Symbol', 'Name', 'Quantity', 'Avg Buy Price (USD)', 'Current Price (USD)', 'Value (USD)', 'PnL (USD)', 'PnL (%)', 'Allocation (%)'];
    const rows = holdings.map(h => [
      h.symbol,
      h.name,
      h.quantity,
      Number(h.avg_buy_price).toFixed(2),
      Number(h.current_price).toFixed(2),
      Number(h.current_value).toFixed(2),
      Number(h.pnl_usd).toFixed(2),
      Number(h.pnl_percent).toFixed(2),
      totalValue > 0 ? ((h.current_value / totalValue) * 100).toFixed(2) : '0.00',
    ]);

    sendCSV(res, `${portfolio.name.replace(/\s+/g, '_')}_positions_${new Date().toISOString().slice(0, 10)}.csv`, formatCSV(headers, rows));
  } catch (error) {
    log.error(`Positions CSV export error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Export failed' });
  }
});

// ─── Free: Prices CSV (30d) ─────────────────────────────────────────────────

api.get('/user/portfolios/:id/export/prices-csv', authenticateUser, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await verifyPortfolioOwnership(portfolioId, req.user.id);
    if (!portfolio) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    // Get crypto IDs in portfolio
    const [holdings] = await Database.execute(
      'SELECT h.crypto_id, c.symbol FROM user_portfolio_holdings h JOIN cryptocurrencies c ON c.id = h.crypto_id WHERE h.portfolio_id = ?',
      [portfolioId]
    );

    if (holdings.length === 0) {
      return sendCSV(res, 'prices.csv', 'No holdings');
    }

    const cryptoIds = holdings.map(h => h.crypto_id);
    const symbolMap = {};
    holdings.forEach(h => { symbolMap[h.crypto_id] = h.symbol; });

    const dateFilter = getDateFilter('30d', 'price_date');

    const [prices] = await Database.execute(
      `SELECT crypto_id, price_date, price_usd
       FROM market_data
       WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
         ${dateFilter}
         AND timestamp = (
           SELECT MAX(timestamp) FROM market_data md2
           WHERE md2.crypto_id = market_data.crypto_id AND md2.price_date = market_data.price_date
         )
       ORDER BY price_date ASC, crypto_id ASC`,
      cryptoIds
    );

    // Pivot: dates as rows, cryptos as columns
    const symbols = holdings.map(h => h.symbol);
    const headers = ['Date', ...symbols];
    const dateMap = {};
    for (const row of prices) {
      const dateStr = row.price_date instanceof Date ? row.price_date.toISOString().slice(0, 10) : String(row.price_date);
      if (!dateMap[dateStr]) dateMap[dateStr] = {};
      dateMap[dateStr][symbolMap[row.crypto_id]] = Number(row.price_usd).toFixed(6);
    }

    const rows = Object.keys(dateMap).sort().map(date => [
      date,
      ...symbols.map(s => dateMap[date][s] || ''),
    ]);

    sendCSV(res, `${portfolio.name.replace(/\s+/g, '_')}_prices_30d.csv`, formatCSV(headers, rows));
  } catch (error) {
    log.error(`Prices CSV export error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Export failed' });
  }
});

// ─── Pro: Transactions CSV ──────────────────────────────────────────────────

api.get('/user/portfolios/:id/export/transactions-csv', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await verifyPortfolioOwnership(portfolioId, req.user.id);
    if (!portfolio) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const [transactions] = await Database.execute(
      `SELECT t.timestamp, c.symbol, c.name, t.type, t.quantity, t.price_usd, t.fee_usd, t.notes
       FROM user_transactions t
       JOIN cryptocurrencies c ON c.id = t.crypto_id
       WHERE t.portfolio_id = ?
       ORDER BY t.timestamp DESC`,
      [portfolioId]
    );

    const headers = ['Date', 'Symbol', 'Name', 'Type', 'Quantity', 'Price (USD)', 'Fee (USD)', 'Total (USD)', 'Notes'];
    const rows = transactions.map(t => [
      t.timestamp instanceof Date ? t.timestamp.toISOString().slice(0, 19) : String(t.timestamp),
      t.symbol,
      t.name,
      t.type,
      t.quantity,
      Number(t.price_usd).toFixed(2),
      Number(t.fee_usd).toFixed(2),
      (t.quantity * t.price_usd + t.fee_usd).toFixed(2),
      t.notes || '',
    ]);

    sendCSV(res, `${portfolio.name.replace(/\s+/g, '_')}_transactions.csv`, formatCSV(headers, rows));
  } catch (error) {
    log.error(`Transactions CSV export error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Export failed' });
  }
});

// ─── Pro: Portfolio Report PDF ──────────────────────────────────────────────

api.get('/user/portfolios/:id/export/report-pdf', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await verifyPortfolioOwnership(portfolioId, req.user.id);
    if (!portfolio) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    // Fetch data
    const [holdings] = await Database.execute(
      `SELECT c.symbol, c.name, h.quantity, h.avg_buy_price,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value,
        (h.quantity * (md.price_usd - h.avg_buy_price)) AS pnl_usd
      FROM user_portfolio_holdings h
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE h.portfolio_id = ?
      ORDER BY current_value DESC`,
      [portfolioId]
    );

    const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.quantity * h.avg_buy_price), 0);
    const totalPnl = totalValue - totalCost;

    // Build PDF
    const doc = createReportDoc();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${portfolio.name.replace(/\s+/g, '_')}_report.pdf"`);
    doc.pipe(res);

    addHeader(doc, `Portfolio Report: ${portfolio.name}`, new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }));

    // Summary
    addSectionTitle(doc, 'Portfolio Summary');
    addMetricRow(doc, 'Total Value', `$${totalValue.toFixed(2)}`);
    addMetricRow(doc, 'Total Cost', `$${totalCost.toFixed(2)}`);
    addMetricRow(doc, 'Total PnL', `$${totalPnl.toFixed(2)}`, totalPnl >= 0 ? '#16C784' : '#EA3943');
    addMetricRow(doc, 'PnL %', `${totalCost > 0 ? ((totalPnl / totalCost) * 100).toFixed(2) : 0}%`, totalPnl >= 0 ? '#16C784' : '#EA3943');
    addMetricRow(doc, 'Holdings', `${holdings.length} assets`);
    doc.moveDown(0.5);

    // Holdings table
    addSectionTitle(doc, 'Holdings');
    const colWidths = [60, 80, 70, 70, 70, 70, 75];
    addTable(
      doc,
      ['Symbol', 'Name', 'Quantity', 'Avg Price', 'Price', 'Value', 'PnL'],
      holdings.map(h => [
        h.symbol,
        h.name.length > 12 ? h.name.slice(0, 12) + '...' : h.name,
        Number(h.quantity).toFixed(4),
        `$${Number(h.avg_buy_price).toFixed(2)}`,
        `$${Number(h.current_price).toFixed(2)}`,
        `$${Number(h.current_value).toFixed(2)}`,
        `${h.pnl_usd >= 0 ? '+' : ''}$${Number(h.pnl_usd).toFixed(2)}`,
      ]),
      colWidths
    );

    addFooter(doc);
    doc.end();
  } catch (error) {
    log.error(`Report PDF export error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Export failed' });
  }
});

// ─── Pro: Stress Test PDF ───────────────────────────────────────────────────

api.get('/user/portfolios/:id/export/stress-test-pdf', authenticateUser, requirePro, async (req, res) => {
  try {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await verifyPortfolioOwnership(portfolioId, req.user.id);
    if (!portfolio) {
      return res.status(404).json({ data: null, msg: 'Portfolio not found' });
    }

    const { calculateStressTest } = await import('../utils/riskMetrics.js');

    const [holdings] = await Database.execute(
      `SELECT h.crypto_id, c.symbol, c.name, h.quantity,
        md.price_usd AS current_price,
        (h.quantity * md.price_usd) AS current_value
      FROM user_portfolio_holdings h
      JOIN cryptocurrencies c ON c.id = h.crypto_id
      LEFT JOIN market_data md ON md.crypto_id = h.crypto_id
        AND md.timestamp = (SELECT MAX(timestamp) FROM market_data WHERE crypto_id = h.crypto_id)
      WHERE h.portfolio_id = ?`,
      [portfolioId]
    );

    const totalValue = holdings.reduce((sum, h) => sum + (h.current_value || 0), 0);
    const cryptoIds = holdings.map(h => h.crypto_id);

    // Get betas
    const [betaRows] = await Database.execute(
      `SELECT cb.crypto_id, cb.beta FROM crypto_beta cb
       INNER JOIN (
         SELECT crypto_id, MAX(date) AS max_date FROM crypto_beta
         WHERE crypto_id IN (${cryptoIds.map(() => '?').join(',')})
           AND return_type = 'log'
         GROUP BY crypto_id
       ) latest ON cb.crypto_id = latest.crypto_id AND cb.date = latest.max_date
       WHERE cb.return_type = 'log'`,
      cryptoIds
    );

    const betaMap = {};
    betaRows.forEach(r => { betaMap[r.crypto_id] = parseFloat(r.beta); });

    const weights = holdings.map(h => h.current_value / totalValue);
    let portfolioBeta = 0;
    holdings.forEach((h, i) => { portfolioBeta += weights[i] * (betaMap[h.crypto_id] || 1); });

    const portfolioStress = calculateStressTest(portfolioBeta, totalValue);

    // Build PDF
    const doc = createReportDoc();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${portfolio.name.replace(/\s+/g, '_')}_stress_test.pdf"`);
    doc.pipe(res);

    addHeader(doc, `Stress Test Report: ${portfolio.name}`, `Portfolio Beta: ${portfolioBeta.toFixed(4)} | Value: $${totalValue.toFixed(2)}`);

    // Portfolio-level stress
    addSectionTitle(doc, 'Portfolio Stress Scenarios');
    addTable(
      doc,
      ['Scenario', 'Market Shock', 'Expected Impact', 'New Value', 'Loss'],
      portfolioStress.map(s => [
        s.name,
        `${s.marketShock.toFixed(1)}%`,
        `${s.expectedImpact.toFixed(1)}%`,
        `$${s.newPrice.toFixed(2)}`,
        `$${(totalValue - s.newPrice).toFixed(2)}`,
      ]),
      [130, 80, 90, 100, 95]
    );

    // Per-holding breakdown
    addSectionTitle(doc, 'Per-Holding Impact');
    for (const h of holdings) {
      const beta = betaMap[h.crypto_id] || 1;
      const scenarios = calculateStressTest(beta, h.current_value);
      doc.fontSize(10).fillColor('#333').text(`${h.symbol} (Beta: ${beta.toFixed(2)}, Value: $${h.current_value.toFixed(2)})`);
      doc.moveDown(0.2);
      addTable(
        doc,
        ['Scenario', 'Impact', 'New Value'],
        scenarios.map(s => [
          s.name,
          `${s.expectedImpact.toFixed(1)}%`,
          `$${s.newPrice.toFixed(2)}`,
        ]),
        [180, 100, 100]
      );
    }

    addFooter(doc);
    doc.end();
  } catch (error) {
    log.error(`Stress test PDF export error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Export failed' });
  }
});
