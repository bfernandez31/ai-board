import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Lazy-initialized Stripe client.
 * Avoids crashing at module load time when STRIPE_SECRET_KEY is not set,
 * so non-billing code that transitively imports this module still works.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('STRIPE_WEBHOOK_SECRET is not set - webhook signature verification will fail');
    }

    if (!process.env.STRIPE_PRO_PRICE_ID) {
      console.warn('STRIPE_PRO_PRICE_ID is not set - Pro plan checkout will not work');
    }

    if (!process.env.STRIPE_TEAM_PRICE_ID) {
      console.warn('STRIPE_TEAM_PRICE_ID is not set - Team plan checkout will not work');
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      console.warn('NEXT_PUBLIC_APP_URL is not set - defaulting to http://localhost:3000');
    }

    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}

/** @deprecated Use getStripe() instead — kept for backwards compatibility */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    return Reflect.get(getStripe(), prop, receiver);
  },
});
