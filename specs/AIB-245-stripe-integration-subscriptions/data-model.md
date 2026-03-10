# Data Model: Stripe Integration - Subscriptions & Billing

**Feature Branch**: `AIB-245-stripe-integration-subscriptions`
**Date**: 2026-03-10

## Schema Changes

### Modified: User Model

Add `stripeCustomerId` field for 1:1 Stripe Customer mapping.

```prisma
model User {
  // ... existing fields ...
  stripeCustomerId String? @unique @db.VarChar(255)
  subscription     Subscription?
}
```

**Notes**:
- Nullable because users start without a Stripe customer record
- Unique constraint prevents duplicate Stripe customer mappings
- Created lazily on first subscription action (not on signup)

### New: Subscription Model

Tracks a user's active subscription state, synchronized via Stripe webhooks.

```prisma
model Subscription {
  id                    Int                @id @default(autoincrement())
  userId                String             @unique
  stripeSubscriptionId  String             @unique @db.VarChar(255)
  stripePriceId         String             @db.VarChar(255)
  plan                  SubscriptionPlan   @default(FREE)
  status                SubscriptionStatus @default(ACTIVE)
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  trialStart            DateTime?
  trialEnd              DateTime?
  cancelAt              DateTime?
  canceledAt            DateTime?
  gracePeriodEndsAt     DateTime?
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stripeSubscriptionId])
  @@index([status])
  @@index([gracePeriodEndsAt])
}
```

**Field descriptions**:
- `userId`: 1:1 with User (unique constraint)
- `stripeSubscriptionId`: Stripe's subscription ID for API lookups
- `stripePriceId`: Current Stripe Price ID (maps to plan)
- `plan`: Application-level plan enum (FREE/PRO/TEAM)
- `status`: Subscription lifecycle state
- `currentPeriodStart/End`: Current billing cycle dates
- `trialStart/End`: Trial period dates (null if no trial)
- `cancelAt`: Scheduled cancellation date (end of period)
- `canceledAt`: When user requested cancellation
- `gracePeriodEndsAt`: 7-day grace period expiry for failed payments

### New: StripeEvent Model

Tracks processed webhook events for idempotency.

```prisma
model StripeEvent {
  id            String   @id @db.VarChar(255) // Stripe event ID (evt_xxx)
  type          String   @db.VarChar(100)
  processedAt   DateTime @default(now())

  @@index([type])
  @@index([processedAt])
}
```

**Notes**:
- Primary key is the Stripe event ID (natural key, no autoincrement)
- `type` stored for audit/debugging purposes
- `processedAt` index enables future cleanup of old events

### New: Enums

```prisma
enum SubscriptionPlan {
  FREE
  PRO
  TEAM
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  INCOMPLETE
}
```

## Plan Configuration (TypeScript Constant)

Not stored in database. Defined in `lib/billing/plans.ts`:

```typescript
interface PlanConfig {
  name: string;
  plan: SubscriptionPlan;
  priceMonthly: number; // cents
  stripePriceId: string | null; // null for Free
  limits: {
    maxProjects: number | null; // null = unlimited
    maxTicketsPerMonth: number | null;
    membersEnabled: boolean;
    advancedAnalytics: boolean;
  };
  trial: {
    enabled: boolean;
    days: number;
  };
}

const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  FREE: {
    name: 'Free',
    plan: 'FREE',
    priceMonthly: 0,
    stripePriceId: null,
    limits: { maxProjects: 1, maxTicketsPerMonth: 5, membersEnabled: false, advancedAnalytics: false },
    trial: { enabled: false, days: 0 },
  },
  PRO: {
    name: 'Pro',
    plan: 'PRO',
    priceMonthly: 1500, // $15.00
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID!,
    limits: { maxProjects: null, maxTicketsPerMonth: null, membersEnabled: false, advancedAnalytics: false },
    trial: { enabled: true, days: 14 },
  },
  TEAM: {
    name: 'Team',
    plan: 'TEAM',
    priceMonthly: 3000, // $30.00
    stripePriceId: process.env.STRIPE_TEAM_PRICE_ID!,
    limits: { maxProjects: null, maxTicketsPerMonth: null, membersEnabled: true, advancedAnalytics: true },
    trial: { enabled: true, days: 14 },
  },
};
```

## Entity Relationships

```
User (1) -----> (0..1) Subscription
  |
  +--- stripeCustomerId (nullable, unique)

Subscription
  +--- plan (enum: FREE/PRO/TEAM)
  +--- status (enum: ACTIVE/TRIALING/PAST_DUE/CANCELED/INCOMPLETE)
  +--- stripeSubscriptionId (unique)

StripeEvent (standalone - idempotency log)
```

## Validation Rules

| Field | Rule |
|-------|------|
| `stripeCustomerId` | Stripe format: `cus_*` |
| `stripeSubscriptionId` | Stripe format: `sub_*` |
| `stripePriceId` | Stripe format: `price_*` |
| `currentPeriodEnd` | Must be >= `currentPeriodStart` |
| `trialEnd` | Must be >= `trialStart` when both present |
| `gracePeriodEndsAt` | Only set when status = `PAST_DUE` |

## State Transitions

```
(no subscription) --> TRIALING     [checkout.session.completed with trial]
(no subscription) --> ACTIVE       [checkout.session.completed without trial]
TRIALING          --> ACTIVE       [invoice.payment_succeeded - first invoice]
TRIALING          --> PAST_DUE     [invoice.payment_failed - trial end payment]
ACTIVE            --> PAST_DUE     [invoice.payment_failed]
ACTIVE            --> CANCELED     [customer.subscription.deleted]
PAST_DUE          --> ACTIVE       [invoice.payment_succeeded - retry success]
PAST_DUE          --> CANCELED     [customer.subscription.deleted OR grace period expired]
CANCELED          --> (deleted)    [record removed, user reverts to Free]
```
