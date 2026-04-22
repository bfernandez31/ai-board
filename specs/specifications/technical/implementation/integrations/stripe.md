# Stripe Billing Integration


### Overview

**Package**: `stripe` (official Node.js SDK, server-side only)

**Architecture**: Uses Stripe-hosted Checkout and Customer Portal to minimize PCI scope. No payment data ever touches the application server.

**Setup** (`lib/billing/stripe.ts`):

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});
```

### Checkout Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Billing Page
    participant API as POST /api/billing/checkout
    participant Stripe as Stripe Checkout
    participant WH as POST /api/webhooks/stripe
    participant DB as Database

    U->>UI: Click "Subscribe" (Pro or Team)
    UI->>API: POST { plan: "PRO" | "TEAM" }
    API->>DB: Upsert Stripe Customer (stripeCustomerId on User)
    API->>Stripe: Create Checkout Session (14-day trial)
    API-->>UI: { url: "https://checkout.stripe.com/..." }
    UI->>Stripe: Redirect to Stripe Checkout
    U->>Stripe: Enter payment details
    Stripe-->>UI: Redirect to /settings/billing?success=true
    Stripe->>WH: checkout.session.completed event
    WH->>DB: Create/update Subscription record
```

### Webhook Handler

**Endpoint**: `POST /api/webhooks/stripe`

**Auth**: Stripe signature verification via `stripe.webhooks.constructEvent()` using `STRIPE_WEBHOOK_SECRET`. The webhook route is excluded from auth middleware in `proxy.ts` (via the matcher pattern) since Stripe cannot present a session cookie.

**Idempotency**: Each event is checked against the `StripeEvent` table before processing. Duplicate events are silently ignored.

**Handled Events**:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create or update Subscription record |
| `invoice.payment_succeeded` | Extend billing period; set status ACTIVE |
| `invoice.payment_failed` | Set status PAST_DUE; set `gracePeriodEndsAt` = now + 7 days |
| `customer.subscription.updated` | Sync plan, status, and period dates |
| `customer.subscription.deleted` | Set status CANCELED; user reverts to FREE limits |

```mermaid
sequenceDiagram
    participant Stripe as Stripe
    participant WH as Webhook Handler
    participant DB as StripeEvent (idempotency)
    participant Sub as Subscription Table

    Stripe->>WH: POST webhook event
    WH->>WH: stripe.webhooks.constructEvent() (signature check)
    WH->>DB: Check StripeEvent.id exists?
    alt Already processed
        DB-->>WH: Found → 200 OK (no-op)
    else New event
        WH->>Sub: Upsert Subscription record
        WH->>DB: Insert StripeEvent record
        WH-->>Stripe: 200 OK
    end
```

### Customer Portal Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Billing Page
    participant API as POST /api/billing/portal
    participant Portal as Stripe Customer Portal

    U->>UI: Click "Manage Subscription"
    UI->>API: POST (no body)
    API->>Portal: Create Portal Session (return_url: /settings/billing)
    API-->>UI: { url: "https://billing.stripe.com/..." }
    UI->>Portal: Redirect to Customer Portal
    U->>Portal: Update plan / cancel / change payment
    Portal-->>UI: Redirect to /settings/billing
    Portal->>WH: Webhook event (subscription updated/deleted)
```

### Plan Configuration (`lib/billing/plans.ts`)

```typescript
export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  FREE:  { priceMonthly: 0,    stripePriceId: null,                         trial: { enabled: false, days: 0  } },
  PRO:   { priceMonthly: 1500, stripePriceId: process.env.STRIPE_PRO_PRICE_ID,  trial: { enabled: true,  days: 14 } },
  TEAM:  { priceMonthly: 3000, stripePriceId: process.env.STRIPE_TEAM_PRICE_ID, trial: { enabled: true,  days: 14 } },
};
```

Prices are stored in cents (USD). `null` `stripePriceId` means the plan has no Stripe billing.

### Feature Gating (`lib/billing/subscription.ts`)

```typescript
// Determine which plan limits apply given current status
export function getEffectivePlan(
  plan: SubscriptionPlan,
  status: string,
  gracePeriodEndsAt: Date | null
): SubscriptionPlan {
  if (status === 'CANCELED') return 'FREE';
  if (status === 'PAST_DUE' && gracePeriodEndsAt && new Date() > gracePeriodEndsAt) return 'FREE';
  return plan;
}
```

Gating is applied in:
- `POST /api/projects` — checks `maxProjects` limit
- `POST /api/tickets` — checks `maxTicketsPerMonth` limit (calendar month)
- `POST /api/projects/:projectId/members` — checks `membersEnabled`

### Environment Variables

```env
STRIPE_SECRET_KEY=sk_live_...          # Stripe secret key (server-side only)
STRIPE_WEBHOOK_SECRET=whsec_...        # Webhook signing secret
STRIPE_PRO_PRICE_ID=price_...          # Stripe Price ID for Pro plan
STRIPE_TEAM_PRICE_ID=price_...         # Stripe Price ID for Team plan
NEXT_PUBLIC_APP_URL=https://...        # Used for Checkout success/cancel redirect URLs
```

### Account Deletion

When a user is deleted (`lib/db/users.ts`), any active Stripe subscription is cancelled via `stripe.subscriptions.cancel(stripeSubscriptionId)` before the database record is removed.

