# Quickstart: Stripe Integration - Subscriptions & Billing

**Feature Branch**: `AIB-245-stripe-integration-subscriptions`
**Date**: 2026-03-10

## Prerequisites

1. Stripe account with test mode enabled
2. Stripe CLI installed (for local webhook testing)
3. PostgreSQL database running

## Environment Setup

Add to `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Stripe Configuration

### 1. Create Products and Prices in Stripe Dashboard (Test Mode)

- **Pro Plan**: Product "Pro", Price $15.00/month recurring
- **Team Plan**: Product "Team", Price $30.00/month recurring
- Copy the Price IDs to environment variables

### 2. Configure Customer Portal

In Stripe Dashboard > Settings > Customer Portal:
- Enable subscription cancellation
- Enable plan switching (Pro <-> Team)
- Enable payment method updates
- Set return URL to `{NEXT_PUBLIC_APP_URL}/settings/billing`

### 3. Local Webhook Testing

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`.

## Implementation Order

1. **Database**: Prisma schema changes + migration
2. **Library**: `lib/billing/` - Stripe client, plans config, utilities
3. **Webhook**: `app/api/webhooks/stripe/route.ts`
4. **API Routes**: checkout, portal, subscription, plans endpoints
5. **Feature Gating**: Limit enforcement in existing API routes
6. **UI**: Billing page, pricing cards, upgrade prompts
7. **Account Cleanup**: Subscription cancellation on account deletion
8. **Tests**: Integration tests for webhook + API, unit tests for utilities

## Key Files

```
lib/billing/
├── stripe.ts          # Stripe client singleton
├── plans.ts           # Plan configuration constants
└── subscription.ts    # Subscription utilities (getPlanLimits, etc.)

lib/db/
└── subscriptions.ts   # Database operations for subscriptions

app/api/billing/
├── checkout/route.ts  # POST - Create Checkout session
├── portal/route.ts    # POST - Create Customer Portal session
├── plans/route.ts     # GET - List available plans
└── subscription/route.ts # GET - Current user subscription

app/api/webhooks/
└── stripe/route.ts    # POST - Stripe webhook handler

app/settings/billing/
└── page.tsx           # Billing management page

components/billing/
├── pricing-cards.tsx  # Plan comparison cards
├── subscription-status.tsx # Current plan status display
└── upgrade-prompt.tsx # Upgrade CTA for limit-reached scenarios

hooks/
└── use-subscription.ts # TanStack Query hook for subscription state
```

## Dependency

```bash
bun add stripe
```

Single new dependency. No client-side Stripe SDK needed.
