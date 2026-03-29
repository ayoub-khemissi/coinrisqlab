import jwt from 'jsonwebtoken';
import Database from '../lib/database.js';
import Config from '../utils/config.js';
import Constants from '../utils/constants.js';
import { createHash } from 'crypto';

const { COINRISQLAB_USER_JWT_SECRET } = Config;
const { JWT_ALGORITHM } = Constants;

/**
 * Hash a JWT token with SHA-256 for session lookup.
 */
export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sign a user JWT token.
 */
export function signUserJwt(payload) {
  try {
    return jwt.sign(payload, COINRISQLAB_USER_JWT_SECRET, {
      algorithm: JWT_ALGORITHM,
      expiresIn: '30d',
    });
  } catch {
    return null;
  }
}

/**
 * Verify a user JWT token.
 */
export function verifyUserJwt(token) {
  try {
    return jwt.verify(token, COINRISQLAB_USER_JWT_SECRET);
  } catch {
    return false;
  }
}

/**
 * Cookie configuration for user sessions.
 */
export function getUserCookieOptions() {
  return {
    httpOnly: true,
    secure: Config.COINRISQLAB_FRONT_HTTPSECURE,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    path: '/',
  };
}

/**
 * Express middleware: authenticate user from cookie.
 * Populates req.user = { id, email, plan, planExpiresAt }
 */
export async function authenticateUser(req, res, next) {
  const token = req.cookies?.coinrisqlab_user_session;

  if (!token) {
    return res.status(401).json({ data: null, msg: 'Unauthorized' });
  }

  const decoded = verifyUserJwt(token);
  if (!decoded) {
    return res.status(401).json({ data: null, msg: 'Invalid or expired token' });
  }

  try {
    // Verify session exists in DB
    const tokenHash = hashToken(token);
    const [sessions] = await Database.execute(
      'SELECT id FROM user_sessions WHERE token_hash = ? AND expires_at > NOW()',
      [tokenHash]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ data: null, msg: 'Session expired or revoked' });
    }

    // Fetch user
    const [users] = await Database.execute(
      'SELECT id, email, display_name, plan, plan_expires_at, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ data: null, msg: 'Account not found or inactive' });
    }

    const user = users[0];
    req.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      plan: user.plan,
      planExpiresAt: user.plan_expires_at,
    };

    next();
  } catch (error) {
    return res.status(500).json({ data: null, msg: 'Authentication error' });
  }
}
