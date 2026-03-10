# API Contracts: Billing & Subscriptions

**Feature Branch**: `AIB-245-stripe-integration-subscriptions`
**Date**: 2026-03-10

## Endpoints Overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/subscription` | Session | Get current user's subscription |
| POST | `/api/billing/checkout` | Session | Create Stripe Checkout session |
| POST | `/api/billing/portal` | Session | Create Stripe Customer Portal session |
| GET | `/api/billing/plans` | Public | Get available plans |
| POST | `/api/webhooks/stripe` | Stripe Sig | Process Stripe webhook events |

---

## GET /api/billing/subscription

Returns the authenticated user's current subscription status.

**Request**: No body required.

**Response 200**:
```json
{
  "plan": "FREE | PRO | TEAM",
  "status": "active | trialing | past_due | canceled | none",
  "currentPeriodEnd": "2026-04-10T00:00:00.000Z",
  "trialEnd": "2026-03-24T00:00:00.000Z",
  "cancelAt": null,
  "gracePeriodEndsAt": null,
  "limits": {
    "maxProjects": 1,
    "maxTicketsPerMonth": 5,
    "membersEnabled": false,
    "advancedAnalytics": false
  }
}
```

**Response 401**: `{ "error": "Unauthorized" }`

**Notes**: Returns `plan: "FREE"` and `status: "none"` if user has no subscription record.

---

## POST /api/billing/checkout

Creates a Stripe Checkout Session and returns the redirect URL.

**Request**:
```json
{
  "plan": "PRO | TEAM"
}
```

**Validation** (Zod):
```typescript
z.object({
  plan: z.enum(['PRO', 'TEAM']),
})
```

**Response 200**:
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

**Response 400**: `{ "error": "Invalid plan" }`
**Response 400**: `{ "error": "Already subscribed to this plan" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 500**: `{ "error": "Failed to create checkout session" }`

**Behavior**:
1. Verify user is authenticated
2. Check user doesn't already have an active subscription for this plan
3. Create or retrieve Stripe Customer (using `stripeCustomerId` on User)
4. Create Checkout Session with `trial_period_days: 14`, success/cancel URLs
5. Return the Checkout Session URL

---

## POST /api/billing/portal

Creates a Stripe Customer Portal Session and returns the redirect URL.

**Request**: No body required.

**Response 200**:
```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

**Response 400**: `{ "error": "No billing account found" }`
**Response 401**: `{ "error": "Unauthorized" }`
**Response 500**: `{ "error": "Failed to create portal session" }`

**Behavior**:
1. Verify user is authenticated
2. Verify user has a `stripeCustomerId`
3. Create Customer Portal Session with return URL
4. Return the Portal Session URL

---

## GET /api/billing/plans

Returns available plan configurations. Public endpoint (no auth required).

**Request**: No body required.

**Response 200**:
```json
{
  "plans": [
    {
      "plan": "FREE",
      "name": "Free",
      "priceMonthly": 0,
      "features": [
        "1 project",
        "5 tickets per month",
        "BYOK API key required"
      ],
      "limits": {
        "maxProjects": 1,
        "maxTicketsPerMonth": 5,
        "membersEnabled": false,
        "advancedAnalytics": false
      }
    },
    {
      "plan": "PRO",
      "name": "Pro",
      "priceMonthly": 1500,
      "features": [
        "Unlimited projects",
        "Unlimited tickets",
        "14-day free trial"
      ],
      "limits": {
        "maxProjects": null,
        "maxTicketsPerMonth": null,
        "membersEnabled": false,
        "advancedAnalytics": false
      }
    },
    {
      "plan": "TEAM",
      "name": "Team",
      "priceMonthly": 3000,
      "features": [
        "Everything in Pro",
        "Project members",
        "Advanced analytics",
        "14-day free trial"
      ],
      "limits": {
        "maxProjects": null,
        "maxTicketsPerMonth": null,
        "membersEnabled": true,
        "advancedAnalytics": true
      }
    }
  ]
}
```

---

## POST /api/webhooks/stripe

Processes Stripe webhook events. Authenticated via Stripe webhook signature.

**Request**: Raw body (not JSON-parsed) with Stripe signature header.

**Headers**:
- `stripe-signature`: Stripe webhook signature

**Response 200**: `{ "received": true }`
**Response 400**: `{ "error": "Invalid signature" }`
**Response 400**: `{ "error": "Unhandled event type" }`
**Response 409**: `{ "received": true, "skipped": "duplicate" }`

**Handled Events**:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update Subscription, set plan and trial dates |
| `invoice.payment_succeeded` | Update period dates, set status to ACTIVE |
| `invoice.payment_failed` | Set status to PAST_DUE, set gracePeriodEndsAt |
| `customer.subscription.updated` | Sync plan, status, period dates |
| `customer.subscription.deleted` | Remove Subscription record (user reverts to Free) |

**Idempotency**: Each event is checked against the `StripeEvent` table. Duplicate event IDs return 200 with `skipped: "duplicate"`.

---

## Feature Gating (Internal API)

Not an HTTP endpoint - utility functions used within existing API routes.

### Enforced At:

| Route | Check |
|-------|-------|
| `POST /api/projects` | `maxProjects` limit |
| `POST /api/projects/[id]/tickets` (or equivalent) | `maxTicketsPerMonth` limit |
| `POST /api/projects/[id]/members` | `membersEnabled` flag |
| Analytics endpoints | `advancedAnalytics` flag |

### Utility: `getUserPlanLimits(userId: string)`

```typescript
interface PlanLimits {
  plan: SubscriptionPlan;
  maxProjects: number | null;
  maxTicketsPerMonth: number | null;
  membersEnabled: boolean;
  advancedAnalytics: boolean;
  isInGracePeriod: boolean;
}
```

Returns effective limits considering subscription status and grace period.

## Environment Variables (New)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Stripe Price ID for Pro plan |
| `STRIPE_TEAM_PRICE_ID` | Stripe Price ID for Team plan |
| `NEXT_PUBLIC_APP_URL` | Application base URL (for Checkout redirect) |
