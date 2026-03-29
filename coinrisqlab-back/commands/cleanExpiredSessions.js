import Database from '../lib/database.js';
import log from '../lib/log.js';

/**
 * Clean expired user sessions from the database.
 * Designed to run weekly (cron: Sunday 04:00).
 */
async function cleanExpiredSessions() {
  try {
    log.info('Cleaning expired user sessions...');

    const [result] = await Database.execute(
      'DELETE FROM user_sessions WHERE expires_at < NOW()'
    );

    log.info(`Cleaned ${result.affectedRows} expired session(s).`);
  } catch (error) {
    log.error(`Session cleanup error: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

cleanExpiredSessions();
