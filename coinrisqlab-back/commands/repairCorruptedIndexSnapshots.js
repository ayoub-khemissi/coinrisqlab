import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Repair corrupted index_history snapshots where one or more top constituents
 * were missing from the market_data fetch (typically due to a transient API
 * issue). The fix is to reconstitute the snapshot from the previous valid one,
 * substituting missing constituents with their last-known-good market_data.
 *
 * Usage: node commands/repairCorruptedIndexSnapshots.js <snapshot_id_1> [...]
 *
 * Example:
 *   node commands/repairCorruptedIndexSnapshots.js 14333 14334 14335
 *
 * Each repair is logged via log.warn so the operation is auditable in the `log`
 * table.
 */

const MAX_FALLBACK_AGE_MS = 60 * 60 * 1000; // 1 hour

async function repairSnapshot(snapshotId) {
  // 1. Load the corrupted snapshot
  const [snapshotRows] = await Database.execute(
    'SELECT id, index_config_id, timestamp, divisor FROM index_history WHERE id = ?',
    [snapshotId]
  );

  if (snapshotRows.length === 0) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  const snapshot = snapshotRows[0];

  // 2. Find the most recent valid snapshot BEFORE this one (same index)
  const [prevRows] = await Database.execute(
    `SELECT id, timestamp FROM index_history
     WHERE index_config_id = ? AND timestamp < ?
     ORDER BY timestamp DESC LIMIT 1`,
    [snapshot.index_config_id, snapshot.timestamp]
  );

  if (prevRows.length === 0) {
    throw new Error(`No previous snapshot found for ${snapshotId}`);
  }

  const prevSnapshotId = prevRows[0].id;

  // 3. Get the previous snapshot's constituents (the "reference set")
  const [referenceConstituents] = await Database.execute(
    `SELECT crypto_id, rank_position FROM index_constituents
     WHERE index_history_id = ? ORDER BY rank_position ASC`,
    [prevSnapshotId]
  );

  // 4. Get the corrupted snapshot's existing constituents
  const [currentConstituents] = await Database.execute(
    'SELECT crypto_id FROM index_constituents WHERE index_history_id = ?',
    [snapshotId]
  );
  const currentCryptoIds = new Set(currentConstituents.map(c => c.crypto_id));

  // 5. Identify missing top constituents (in reference but not in corrupted)
  const missingFromReference = referenceConstituents
    .filter(rc => !currentCryptoIds.has(rc.crypto_id));

  if (missingFromReference.length === 0) {
    log.info(`Snapshot ${snapshotId}: no missing constituents — nothing to repair`);
    return { skipped: true };
  }

  log.warn(`Snapshot ${snapshotId} (${snapshot.timestamp.toISOString()}): ${missingFromReference.length} missing constituents from reference snapshot ${prevSnapshotId}`);

  // 6. For each missing crypto, fetch its last-known-good market_data
  const repairedConstituents = []; // { crypto_id, market_data_id, price_usd, circulating_supply, source }

  for (const missing of missingFromReference) {
    const [marketRows] = await Database.execute(
      `SELECT id, price_usd, circulating_supply, volume_24h_usd, timestamp
       FROM market_data
       WHERE crypto_id = ? AND timestamp <= ?
       ORDER BY timestamp DESC LIMIT 1`,
      [missing.crypto_id, snapshot.timestamp]
    );

    if (marketRows.length === 0) {
      log.error(`  - crypto_id ${missing.crypto_id}: no market_data available — cannot repair`);
      continue;
    }

    const md = marketRows[0];
    const ageMs = snapshot.timestamp.getTime() - md.timestamp.getTime();

    if (ageMs > MAX_FALLBACK_AGE_MS) {
      log.warn(`  - crypto_id ${missing.crypto_id}: market_data is ${Math.round(ageMs / 60000)}min old (> 60min limit) — using anyway`);
    }

    const [cryptoRows] = await Database.execute('SELECT symbol FROM cryptocurrencies WHERE id = ?', [missing.crypto_id]);
    const symbol = cryptoRows[0]?.symbol || `crypto_${missing.crypto_id}`;

    log.warn(`  - ${symbol} (crypto_id ${missing.crypto_id}): fallback to market_data id ${md.id} from ${md.timestamp.toISOString()} (age ${Math.round(ageMs / 60000)}min)`);

    repairedConstituents.push({
      crypto_id: missing.crypto_id,
      market_data_id: md.id,
      price_usd: parseFloat(md.price_usd),
      circulating_supply: parseFloat(md.circulating_supply),
      market_cap: parseFloat(md.price_usd) * parseFloat(md.circulating_supply),
    });
  }

  // 7. Get all existing constituents (full data) for the corrupted snapshot
  const [existingFullRows] = await Database.execute(
    `SELECT ic.crypto_id, ic.market_data_id, ic.price_usd, ic.circulating_supply, ic.rank_position
     FROM index_constituents ic
     WHERE ic.index_history_id = ?`,
    [snapshotId]
  );

  // 8. Build the corrected constituent list:
  //    - Keep all reference cryptos (in their original rank order)
  //    - For each, use existing data if present, otherwise the fallback
  //    - Drop any extra constituents not in the reference
  const referenceCryptoIds = new Set(referenceConstituents.map(rc => rc.crypto_id));
  const existingByCryptoId = new Map(
    existingFullRows.map(r => [r.crypto_id, r])
  );
  const repairedByCryptoId = new Map(
    repairedConstituents.map(r => [r.crypto_id, r])
  );

  // Compute market caps for all reference cryptos
  const finalConstituents = [];
  for (const ref of referenceConstituents) {
    const existing = existingByCryptoId.get(ref.crypto_id);

    if (existing) {
      const mcap = parseFloat(existing.price_usd) * parseFloat(existing.circulating_supply);
      finalConstituents.push({
        crypto_id: ref.crypto_id,
        market_data_id: existing.market_data_id,
        price_usd: parseFloat(existing.price_usd),
        circulating_supply: parseFloat(existing.circulating_supply),
        market_cap: mcap,
      });
    } else {
      const repaired = repairedByCryptoId.get(ref.crypto_id);

      if (repaired) {
        finalConstituents.push(repaired);
      }
    }
  }

  // Sort by market cap DESC and assign new ranks
  finalConstituents.sort((a, b) => b.market_cap - a.market_cap);
  const totalMarketCap = finalConstituents.reduce((s, c) => s + c.market_cap, 0);
  const indexLevel = totalMarketCap / parseFloat(snapshot.divisor);

  // 9. Identify constituents to drop (extras not in reference)
  const intruders = existingFullRows.filter(r => !referenceCryptoIds.has(r.crypto_id));
  for (const intruder of intruders) {
    const [c] = await Database.execute('SELECT symbol FROM cryptocurrencies WHERE id = ?', [intruder.crypto_id]);
    log.warn(`  - dropping intruder: ${c[0]?.symbol || intruder.crypto_id} (was rank ${intruder.rank_position})`);
  }

  // 10. Apply the fix in a transaction
  const conn = await Database.getConnection();
  try {
    await conn.beginTransaction();

    // Delete all existing constituents for this snapshot
    await conn.execute('DELETE FROM index_constituents WHERE index_history_id = ?', [snapshotId]);

    // Insert the corrected constituents
    for (let i = 0; i < finalConstituents.length; i++) {
      const c = finalConstituents[i];
      const weight = (c.market_cap / totalMarketCap) * 100;

      await conn.execute(
        `INSERT INTO index_constituents
         (index_history_id, crypto_id, market_data_id, rank_position, price_usd, circulating_supply, weight_in_index)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [snapshotId, c.crypto_id, c.market_data_id, i + 1, c.price_usd, c.circulating_supply, weight]
      );
    }

    // Update index_history
    await conn.execute(
      `UPDATE index_history
       SET total_market_cap_usd = ?, index_level = ?, number_of_constituents = ?
       WHERE id = ?`,
      [totalMarketCap, indexLevel, finalConstituents.length, snapshotId]
    );

    await conn.commit();

    log.warn(`Snapshot ${snapshotId} repaired: index_level ${indexLevel.toFixed(4)}, market_cap $${(totalMarketCap / 1e9).toFixed(2)}B, ${finalConstituents.length} constituents`);

    return { snapshotId, indexLevel, totalMarketCap, repairedCount: missingFromReference.length, intruderCount: intruders.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function main() {
  const ids = process.argv.slice(2).map(s => parseInt(s, 10)).filter(n => Number.isFinite(n));

  if (ids.length === 0) {
    log.error('Usage: node commands/repairCorruptedIndexSnapshots.js <snapshot_id_1> [<snapshot_id_2> ...]');
    process.exit(1);
  }

  log.info(`Repairing ${ids.length} snapshot(s): ${ids.join(', ')}`);

  for (const id of ids) {
    try {
      await repairSnapshot(id);
    } catch (err) {
      log.error(`Failed to repair snapshot ${id}: ${err.message}`);
    }
  }

  log.info('Repair script completed');
  process.exit(0);
}

main();
