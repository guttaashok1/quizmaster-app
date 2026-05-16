/**
 * Stripe payment routes
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY      — from Stripe Dashboard > Developers > API keys
 *   STRIPE_WEBHOOK_SECRET  — from Stripe Dashboard > Webhooks > signing secret
 *   STRIPE_MONTHLY_PRICE_ID — Stripe Price ID for $12/mo recurring
 *   STRIPE_LIFETIME_PRICE_ID — Stripe Price ID for $79 one-time
 *
 * NOTE: The webhook route needs the raw body — see index.ts where it is
 *       mounted BEFORE express.json() with express.raw() middleware.
 */
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ic-dev-secret-change-in-prod';

// InstanceType<typeof Stripe> is the correct way to type a Stripe client instance
// in Stripe v22+ (the default import is the callable constructor, not the class type)
type StripeClient = InstanceType<typeof Stripe>;

function getStripe(): StripeClient | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

let _pool: Pool | null = null;
function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return _pool;
}

function getUserFromToken(req: Request): { username: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try { return jwt.verify(auth.slice(7), JWT_SECRET) as { username: string }; }
  catch { return null; }
}

// ── POST /api/stripe/create-checkout ─────────────────────────────────────────
router.post('/create-checkout', async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe)
    return void res.status(503).json({
      error: 'Payments not configured — add STRIPE_SECRET_KEY to enable upgrades.',
    });

  const user = getUserFromToken(req);
  if (!user) return void res.status(401).json({ error: 'Please sign in to upgrade.' });

  const { plan } = req.body as { plan?: 'monthly' | 'lifetime' };
  if (plan !== 'monthly' && plan !== 'lifetime')
    return void res.status(400).json({ error: 'plan must be "monthly" or "lifetime"' });

  const MONTHLY_PRICE  = process.env.STRIPE_MONTHLY_PRICE_ID;
  const LIFETIME_PRICE = process.env.STRIPE_LIFETIME_PRICE_ID;

  if (plan === 'monthly' && !MONTHLY_PRICE)
    return void res.status(503).json({ error: 'Monthly price not configured. Add STRIPE_MONTHLY_PRICE_ID.' });
  if (plan === 'lifetime' && !LIFETIME_PRICE)
    return void res.status(503).json({ error: 'Lifetime price not configured. Add STRIPE_LIFETIME_PRICE_ID.' });

  const baseUrl = process.env.PRODUCTION_URL || 'http://localhost:3001';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'monthly' ? 'subscription' : 'payment',
      line_items: [{
        price: (plan === 'monthly' ? MONTHLY_PRICE : LIFETIME_PRICE)!,
        quantity: 1,
      }],
      metadata: { username: user.username },
      success_url: `${baseUrl}/interview/?upgraded=1`,
      cancel_url:  `${baseUrl}/pricing.html?cancelled=1`,
      allow_promotion_codes: true,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] Checkout session error:', err);
    res.status(500).json({ error: 'Failed to create checkout — please try again.' });
  }
});

// ── POST /api/stripe/webhook ──────────────────────────────────────────────────
// Mounted with express.raw({ type: 'application/json' }) in index.ts
router.post('/webhook', async (req: Request, res: Response) => {
  const stripe          = getStripe();
  const webhookSecret   = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret)
    return void res.status(503).json({ error: 'Webhook not configured' });

  const sig = req.headers['stripe-signature'] as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe] Webhook signature verification failed:', err);
    return void res.status(400).send('Webhook Error: Invalid signature');
  }

  // Upgrade user to Pro on successful payment
  if (event.type === 'checkout.session.completed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session  = event.data.object as any;
    const username = session.metadata?.username;
    if (!username) return void res.json({ received: true });

    const pool = getPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE interview_users
           SET plan = 'pro',
               stripe_customer_id     = $2,
               stripe_subscription_id = $3
           WHERE username = $1`,
          [username, session.customer as string | null, session.subscription as string | null]
        );
        console.log(`[stripe] Upgraded ${username} to Pro`);
      } catch (err) {
        console.error('[stripe] Failed to upgrade user in DB:', err);
      }
    }
  }

  // Downgrade to free when subscription is cancelled
  if (event.type === 'customer.subscription.deleted') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub      = event.data.object as any;
    const pool     = getPool();
    if (pool && sub.customer) {
      try {
        await pool.query(
          `UPDATE interview_users SET plan = 'free', stripe_subscription_id = NULL
           WHERE stripe_customer_id = $1`,
          [sub.customer as string]
        );
        console.log(`[stripe] Downgraded customer ${sub.customer} to Free`);
      } catch (err) {
        console.error('[stripe] Failed to downgrade user:', err);
      }
    }
  }

  res.json({ received: true });
});

export default router;
