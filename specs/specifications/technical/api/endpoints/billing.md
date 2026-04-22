# Billing Endpoints

## Billing Endpoints

### GET /api/billing/plans

Returns all available subscription plans with pricing and feature details.

**Authentication**: Required (session)

**Response** (200 OK):
```json
[
  {
    "name": "Free",
    "plan": "FREE",
    "priceMonthly": 0,
    "features": ["1 project", "5 tickets per month", "BYOK API key required"],
    "limits": { "maxProjects": 1, "maxTicketsPerMonth": 5, "membersEnabled": false, "maxMembersPerProject": 0, "advancedAnalytics": false },
    "trial": { "enabled": false, "days": 0 }
  },
  {
    "name": "Pro",
    "plan": "PRO",
    "priceMonthly": 1500,
    "features": ["Unlimited projects", "Unlimited tickets", "14-day free trial"],
    "limits": { "maxProjects": null, "maxTicketsPerMonth": null, "membersEnabled": false, "maxMembersPerProject": 0, "advancedAnalytics": false },
    "trial": { "enabled": true, "days": 14 }
  },
  {
    "name": "Team",
    "plan": "TEAM",
    "priceMonthly": 3000,
    "features": ["Everything in Pro", "Project members", "Advanced analytics", "14-day free trial"],
    "limits": { "maxProjects": null, "maxTicketsPerMonth": null, "membersEnabled": true, "maxMembersPerProject": 10, "advancedAnalytics": true },
    "trial": { "enabled": true, "days": 14 }
  }
]
```

**Notes**: `priceMonthly` is in cents (USD). `null` limits mean no limit enforced. `maxMembersPerProject: 0` means members are not allowed (membersEnabled is false).

---

### GET /api/billing/subscription

Returns the authenticated user's current subscription state and enforced limits.

**Authentication**: Required (session)

**Response** (200 OK):
```json
{
  "plan": "PRO",
  "status": "trialing",
  "currentPeriodEnd": "2026-04-10T00:00:00.000Z",
  "trialEnd": "2026-03-24T00:00:00.000Z",
  "cancelAt": null,
  "gracePeriodEndsAt": null,
  "limits": {
    "maxProjects": null,
    "maxTicketsPerMonth": null,
    "membersEnabled": false,
    "maxMembersPerProject": 0,
    "advancedAnalytics": false
  }
}
```

**Status values**: `active`, `trialing`, `past_due`, `canceled`, `none`

**Notes**: `limits` reflects the *effective* plan (Free limits apply during grace period expiry or after cancellation, regardless of `plan` field value). `maxMembersPerProject: 0` means members are not allowed.

---

### GET /api/billing/usage

Returns the authenticated user's current plan usage against their plan limits.

**Authentication**: Required (session)

**Response** (200 OK):
```json
{
  "plan": "FREE",
  "planName": "Free",
  "projects": {
    "current": 1,
    "max": 1
  },
  "ticketsThisMonth": {
    "current": 3,
    "max": 5,
    "resetDate": "2026-04-01T00:00:00.000Z"
  },
  "status": "none",
  "gracePeriodEndsAt": null
}
```

**Fields**:
- `plan`: Current effective plan (`FREE`, `PRO`, `TEAM`)
- `planName`: Human-readable plan name
- `projects.current`: Number of projects owned by the user
- `projects.max`: Maximum allowed projects (`null` = unlimited)
- `ticketsThisMonth.current`: Tickets created since the 1st of the current calendar month (UTC)
- `ticketsThisMonth.max`: Monthly ticket limit (`null` = unlimited)
- `ticketsThisMonth.resetDate`: ISO timestamp of next monthly counter reset (1st of next month, UTC)
- `status`: Subscription status (`active`, `trialing`, `past_due`, `canceled`, `none`)
- `gracePeriodEndsAt`: ISO timestamp of grace period end (nullable)

**Notes**: `max: null` means no limit enforced (Pro and Team plans). Used by `useUsage` hook to power dashboard usage banner and ticket creation form indicators.

**Errors**:
- `401`: Not authenticated
- `500`: Database error

---

### POST /api/billing/checkout

Creates a Stripe Checkout session for subscribing to a paid plan.

**Authentication**: Required (session)

**Request**:
```json
{ "plan": "PRO" }
```
`plan` must be `"PRO"` or `"TEAM"`.

**Response** (200 OK):
```json
{ "url": "https://checkout.stripe.com/pay/cs_..." }
```

**Behavior**:
- Creates a Stripe Customer for the user if one does not exist yet (persisted as `User.stripeCustomerId`).
- Includes 14-day trial via `subscription_data.trial_period_days`.
- Redirects on success to `/settings/billing?success=true`, on cancel to `/settings/billing?canceled=true`.

**Errors**:
- `400`: Invalid plan or already subscribed to same plan with active status
- `401`: Not authenticated
- `500`: Stripe API error

---

### POST /api/billing/portal

Creates a Stripe Customer Portal session for managing an existing subscription.

**Authentication**: Required (session)

**Request**: No body required.

**Response** (200 OK):
```json
{ "url": "https://billing.stripe.com/p/session/..." }
```

**Behavior**: Returns to `/settings/billing` after portal actions.

**Errors**:
- `400`: User has no Stripe Customer ID (never subscribed)
- `401`: Not authenticated
- `500`: Stripe API error

---

### POST /api/webhooks/stripe

Stripe webhook handler. Receives and processes subscription lifecycle events.

**Authentication**: Stripe signature verification (HMAC, `STRIPE_WEBHOOK_SECRET`). No session cookie required.

**Request**: Raw request body with `Stripe-Signature` header.

**Handled Events**:
- `checkout.session.completed` → Create/update Subscription
- `invoice.payment_succeeded` → Update billing period, set ACTIVE
- `invoice.payment_failed` → Set PAST_DUE, set `gracePeriodEndsAt` (+7 days)
- `customer.subscription.updated` → Sync plan, status, period dates
- `customer.subscription.deleted` → Set status CANCELED (record preserved for audit; user reverts to FREE limits)

**Response** (200 OK): `{ "received": true }`

**Idempotency**: Events already in the `StripeEvent` table are silently skipped.

**Errors**:
- `400`: Invalid signature or malformed event
- `500`: Database error during processing

---

