import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import Config from '../utils/config.js';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import {
  authenticateUser,
  signUserJwt,
  hashToken,
  getUserCookieOptions,
} from '../middleware/userAuth.js';

const stripe = Config.STRIPE_SECRET_KEY && Config.STRIPE_SECRET_KEY !== 'sk_test_REPLACE_ME'
  ? new Stripe(Config.STRIPE_SECRET_KEY)
  : null;

const COOKIE_NAME = 'coinrisqlab_user_session';

// ─── Register ───────────────────────────────────────────────────────────────

api.post('/user/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ data: null, msg: 'Email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ data: null, msg: 'Password must be at least 8 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ data: null, msg: 'Invalid email format' });
    }

    // Check if email already exists
    const [existing] = await Database.execute(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({ data: null, msg: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create Stripe customer if Stripe is configured
    let stripeCustomerId = null;
    if (stripe) {
      try {
        const customer = await stripe.customers.create({
          email: email.toLowerCase().trim(),
          name: displayName || '',
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        log.warn(`Stripe customer creation failed: ${stripeError.message}`);
      }
    }

    // Insert user
    const [result] = await Database.execute(
      `INSERT INTO users (email, password_hash, display_name, plan, stripe_customer_id)
       VALUES (?, ?, ?, 'free', ?)`,
      [email.toLowerCase().trim(), passwordHash, displayName || '', stripeCustomerId]
    );

    const userId = result.insertId;

    // Create default portfolio
    await Database.execute(
      `INSERT INTO user_portfolios (user_id, name) VALUES (?, 'My Portfolio')`,
      [userId]
    );

    // Sign JWT and create session
    const token = signUserJwt({ userId, email: email.toLowerCase().trim(), plan: 'free' });
    if (!token) {
      return res.status(500).json({ data: null, msg: 'Failed to create session' });
    }

    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await Database.execute(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt]
    );

    res.cookie(COOKIE_NAME, token, getUserCookieOptions());

    res.status(201).json({
      data: {
        id: userId,
        email: email.toLowerCase().trim(),
        displayName: displayName || '',
        plan: 'free',
        planExpiresAt: null,
      },
    });

    log.info(`User registered: ${email.toLowerCase().trim()} (id: ${userId})`);
  } catch (error) {
    log.error(`Register error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Registration failed' });
  }
});

// ─── Login ──────────────────────────────────────────────────────────────────

api.post('/user/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ data: null, msg: 'Email and password are required' });
    }

    const [users] = await Database.execute(
      'SELECT id, email, password_hash, display_name, plan, plan_expires_at, is_active FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({ data: null, msg: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(401).json({ data: null, msg: 'Account is inactive' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ data: null, msg: 'Invalid email or password' });
    }

    // Update last login
    await Database.execute(
      'UPDATE users SET last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Sign JWT and create session
    const token = signUserJwt({ userId: user.id, email: user.email, plan: user.plan });
    if (!token) {
      return res.status(500).json({ data: null, msg: 'Failed to create session' });
    }

    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await Database.execute(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, tokenHash, expiresAt]
    );

    res.cookie(COOKIE_NAME, token, getUserCookieOptions());

    res.json({
      data: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        plan: user.plan,
        planExpiresAt: user.plan_expires_at,
      },
    });

    log.info(`User logged in: ${user.email} (id: ${user.id})`);
  } catch (error) {
    log.error(`Login error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Login failed' });
  }
});

// ─── Logout ─────────────────────────────────────────────────────────────────

api.post('/user/auth/logout', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];

    if (token) {
      const tokenHash = hashToken(token);
      await Database.execute(
        'DELETE FROM user_sessions WHERE token_hash = ?',
        [tokenHash]
      );
    }

    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: Config.COINRISQLAB_FRONT_HTTPSECURE,
      sameSite: 'lax',
      path: '/',
    });
    res.json({ data: null, msg: 'Logged out' });
  } catch (error) {
    log.error(`Logout error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Logout failed' });
  }
});

// ─── Me ─────────────────────────────────────────────────────────────────────

api.get('/user/auth/me', authenticateUser, async (req, res) => {
  log.info(`/me called for user ${req.user.id} — plan: ${req.user.plan}`);
  res.json({
    data: {
      id: req.user.id,
      email: req.user.email,
      displayName: req.user.displayName,
      plan: req.user.plan,
      planExpiresAt: req.user.planExpiresAt,
    },
  });
});

// ─── Update Profile ─────────────────────────────────────────────────────────

api.put('/user/auth/profile', authenticateUser, async (req, res) => {
  try {
    const { displayName } = req.body;

    if (displayName === undefined) {
      return res.status(400).json({ data: null, msg: 'Nothing to update' });
    }

    await Database.execute(
      'UPDATE users SET display_name = ? WHERE id = ?',
      [displayName, req.user.id]
    );

    res.json({
      data: {
        id: req.user.id,
        email: req.user.email,
        displayName,
        plan: req.user.plan,
        planExpiresAt: req.user.planExpiresAt,
      },
    });
  } catch (error) {
    log.error(`Profile update error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Profile update failed' });
  }
});

// ─── Change Password ────────────────────────────────────────────────────────

api.put('/user/auth/password', authenticateUser, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ data: null, msg: 'Current and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ data: null, msg: 'New password must be at least 8 characters' });
    }

    const [users] = await Database.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const valid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ data: null, msg: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await Database.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newHash, req.user.id]
    );

    res.json({ data: null, msg: 'Password updated' });
  } catch (error) {
    log.error(`Password change error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Password change failed' });
  }
});
