# Billing & Subscriptions

Subscription-based billing via Stripe with three plans that gate access to features and usage limits.

## Plans

| Plan | Price | Projects | Tickets/Month | Team Members | Analytics |
|------|-------|----------|---------------|--------------|-----------|
| **Free** | $0 | 1 | 5 | No | No |
| **Pro** | $15/mo | Unlimited | Unlimited | No | No |
| **Team** | $30/mo | Unlimited | Unlimited | Yes | Yes |

All plans require users to bring their own API key (BYOK).

Pro and Team plans include a **14-day free trial**.

## Billing Page

Users manage their subscription at `/settings/billing`.

The page shows:
- **Current plan** with renewal date, trial end date, or cancellation date
- **Plan comparison grid** with features and pricing for all three plans
- **Subscribe button** for unsubscribed users (initiates Stripe Checkout)
- **Change plan / Manage subscription button** for existing subscribers (opens Stripe Customer Portal)

## Subscribing

1. User clicks "Subscribe" on a paid plan
2. System creates a Stripe Checkout session (with trial if applicable)
3. User completes payment on Stripe's hosted checkout page
4. Stripe sends a webhook event; subscription record is created in the database
5. User is redirected back to `/settings/billing?success=true`

## Managing a Subscription

Users with an active subscription use the **Stripe Customer Portal** to:
- Upgrade or downgrade between Pro and Team
- Cancel their subscription (takes effect at period end)
- Update payment method

## Plan Enforcement

Subscription limits are enforced at the API level:

- **Project creation** (`POST /api/projects`): Blocked if user has reached their plan's project limit
- **Ticket creation** (`POST /api/projects/:projectId/tickets`): Blocked if monthly ticket count reaches plan limit

Users without an active (or trialing) subscription default to the Free plan limits, even if a Subscription record exists with a non-active status.

## Subscription Lifecycle

```
No record → FREE (default)
Checkout → TRIALING → ACTIVE → (renews) → ACTIVE
                              → PAST_DUE → CANCELED
                              → (cancel at period end) → CANCELED
```

Status transitions are driven by Stripe webhook events and reflected immediately in the database.
