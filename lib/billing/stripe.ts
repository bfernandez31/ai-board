import Stripe from 'stripe';

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

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  typescript: true,
});
