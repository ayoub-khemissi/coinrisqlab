import express from 'express';
import api from '../lib/api.js';
import Database from '../lib/database.js';
import log from '../lib/log.js';
import Config from '../utils/config.js';
import Stripe from 'stripe';
import { authenticateUser } from '../middleware/userAuth.js';

const stripe = Config.STRIPE_SECRET_KEY && Config.STRIPE_SECRET_KEY !== 'sk_test_REPLACE_ME'
  ? new Stripe(Config.STRIPE_SECRET_KEY)
  : null;

const FRONT_URL = `http${Config.COINRISQLAB_FRONT_HTTPSECURE ? 's' : ''}://${Config.COINRISQLAB_FRONT_HOSTNAME}${Config.COINRISQLAB_FRONT_HTTPSECURE ? '' : `:${Config.COINRISQLAB_FRONT_PORT}`}`;

// ─── Create Checkout Session ────────────────────────────────────────────────

api.post('/user/stripe/create-checkout-session', authenticateUser, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ data: null, msg: 'Payment service not configured' });
    }

    // Get or create Stripe customer
    let stripeCustomerId;
    const [users] = await Database.execute(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [req.user.id]
    );

    stripeCustomerId = users[0]?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: String(req.user.id) },
      });
      stripeCustomerId = customer.id;
      await Database.execute(
        'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
        [stripeCustomerId, req.user.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: Config.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${FRONT_URL}/dashboard/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONT_URL}/dashboard/pricing/cancel`,
      metadata: { userId: String(req.user.id) },
    });

    res.json({ data: { url: session.url } });
  } catch (error) {
    log.error(`Stripe checkout error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to create checkout session' });
  }
});

// ─── Create Customer Portal Session ─────────────────────────────────────────

api.post('/user/stripe/create-portal-session', authenticateUser, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ data: null, msg: 'Payment service not configured' });
    }

    const [users] = await Database.execute(
      'SELECT stripe_customer_id FROM users WHERE id = ?',
      [req.user.id]
    );

    const stripeCustomerId = users[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return res.status(400).json({ data: null, msg: 'No billing account found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${FRONT_URL}/dashboard/settings`,
    });

    res.json({ data: { url: session.url } });
  } catch (error) {
    log.error(`Stripe portal error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Failed to create portal session' });
  }
});

// ─── Webhook ────────────────────────────────────────────────────────────────
// This endpoint needs raw body for signature verification.
// We use a separate router with express.raw() middleware.

const webhookRouter = express.Router();
webhookRouter.use(express.raw({ type: 'application/json' }));

webhookRouter.post('/', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ data: null, msg: 'Payment service not configured' });
  }

  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, Config.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    log.error(`Stripe webhook signature verification failed: ${error.message}`);
    return res.status(400).json({ data: null, msg: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId && session.subscription) {
          // Fetch subscription to get current_period_end
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const periodEnd = new Date(subscription.current_period_end * 1000);
          await Database.execute(
            'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?',
            ['pro', periodEnd, userId]
          );
          log.info(`User ${userId} upgraded to pro (subscription: ${session.subscription})`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const [users] = await Database.execute(
          'SELECT id FROM users WHERE stripe_customer_id = ?',
          [customerId]
        );
        if (users.length > 0) {
          const periodEnd = new Date(subscription.current_period_end * 1000);
          const status = subscription.status;
          if (status === 'active' || status === 'trialing') {
            await Database.execute(
              'UPDATE users SET plan = ?, plan_expires_at = ? WHERE id = ?',
              ['pro', periodEnd, users[0].id]
            );
          } else {
            await Database.execute(
              'UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?',
              ['free', users[0].id]
            );
          }
          log.info(`Subscription updated for user ${users[0].id}: status=${status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const [users] = await Database.execute(
          'SELECT id FROM users WHERE stripe_customer_id = ?',
          [customerId]
        );
        if (users.length > 0) {
          await Database.execute(
            'UPDATE users SET plan = ?, plan_expires_at = NULL WHERE id = ?',
            ['free', users[0].id]
          );
          log.info(`User ${users[0].id} downgraded to free (subscription deleted)`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        log.warn(`Payment failed for customer ${invoice.customer}`);
        break;
      }

      default:
        log.debug(`Unhandled Stripe event: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    log.error(`Stripe webhook processing error: ${error.message}`);
    res.status(500).json({ data: null, msg: 'Webhook processing failed' });
  }
});

// Mount the webhook router BEFORE the global json parser catches it
api.use('/user/stripe/webhook', webhookRouter);
