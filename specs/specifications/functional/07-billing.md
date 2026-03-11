# Billing & Subscriptions - Functional Specification

## Purpose

AI-Board provides three subscription tiers (Free, Pro, Team) with Stripe-based billing. Subscription state is synchronized via webhooks and enforced across the application through plan-based feature gating.

## Subscription Plans

### Available Plans

| Plan | Price | Projects | Tickets/Month | Members | Analytics |
|------|-------|----------|---------------|---------|-----------|
| Free | $0 | 1 | 5 | No | Standard |
| Pro | $15/mo | Unlimited | Unlimited | No | Standard |
| Team | $30/mo | Unlimited | Unlimited | Yes | Advanced |

**Trial**: Pro and Team plans include a 14-day free trial for new subscribers.

**Billing**: Monthly only (USD). No annual option.

**BYOK**: Free plan users must supply their own API key to use AI features. Paid plans are not affected by this requirement.

### Plan Limits Enforcement

The system enforces limits at the API layer before any create operation:

- **Free plan - project limit**: Attempting to create a second project returns a `PLAN_LIMIT` (403) error with an upgrade prompt.
- **Free plan - ticket limit**: Attempting to create more than 5 tickets in the current calendar month returns a `PLAN_LIMIT` (403) error with an upgrade prompt. The counter resets on the 1st of each calendar month at midnight UTC.
- **Pro/Team plan**: No project or ticket limits enforced.
- **Member invitations**: Only available on Team plan. Free and Pro users cannot invite project members (`PLAN_LIMIT` 403).
- **Team plan - member count**: Maximum 10 members per project. Attempting to add an 11th member returns a `PLAN_LIMIT` (403) error.
- **Advanced analytics**: Only available on Team plan. Non-Team users see an upgrade prompt gate.

### Effective Plan

The limits applied to a user depend on the *effective plan*, not just the subscribed plan:

- **Active / Trialing**: The subscribed plan's limits apply.
- **Past Due (within 7-day grace period)**: The subscribed plan's limits continue to apply.
- **Past Due (grace period expired)**: Free plan limits apply.
- **Canceled**: Free plan limits apply.
- **No subscription**: Free plan limits apply.

## Public Pricing Display

Plan details are also surfaced on the public landing page at the pricing section (`#pricing`), allowing unauthenticated visitors to compare plans before signing up. The landing page pricing section is static and must remain consistent with the plan definitions above. Any pricing change must be reflected in both `lib/billing/plans.ts` (the authoritative source) and the static data in `components/landing/pricing-section.tsx`.

## Usage Visibility

Users see their current plan consumption at contextual touchpoints without navigating to a dedicated usage page.

### Dashboard Usage Banner

A usage banner appears on the projects list page (`/projects`) for all users:

- **Free plan**: Shows quota counters — e.g., `1/1 projects | 3/5 tickets this month | Free Plan`
- **Pro plan**: Shows plan name only — `Pro Plan` (no numeric quotas, limits are unlimited)
- **Team plan**: Shows plan name only — `Team Plan`

### Ticket Creation Form

When a Free-plan user opens the new ticket modal:
- Their current monthly ticket usage is shown — e.g., `3/5 tickets used this month`
- When the limit is reached, the form submit button is disabled and an upgrade prompt replaces the form

### Project Creation Gate

When a Free-plan user is at their project limit:
- The "New Project" button is disabled
- An upgrade prompt explains the limit and links to `/settings/billing`

### Grace Period Warning

When a user's subscription is `past_due` and within the 7-day grace period, the usage banner displays a warning:
> "Payment failed. Your plan limits will be reduced to Free on [date]. Update payment method."

The warning links to `/settings/billing` (Stripe customer portal).

### Data Source

Usage data is fetched from `GET /api/billing/usage` via the `useUsage` hook (TanStack Query, 15-second polling interval). Usage counts are invalidated on project and ticket creation mutations to reflect changes immediately.

## Billing Page

Users access billing at `/settings/billing`.

### Display Elements

- **Current plan card**: Shows active plan name, status (active, trialing, past due, canceled), and relevant dates (trial end, billing period end, grace period end).
- **Pricing cards**: Three plan cards showing features, monthly price, and subscription action button.
- **Trial indicator**: When trialing, displays trial end date and a notice that billing begins after the trial.
- **Grace period indicator**: When past due and within grace period, displays a warning with the date access will be restricted.

### Subscription Actions

**Subscribe (Free → Pro or Team)**:
1. User clicks "Subscribe" on a plan card.
2. System creates a Stripe Checkout session with a 14-day trial.
3. User is redirected to Stripe-hosted Checkout to enter payment details.
4. On success: redirected to `/settings/billing?success=true`, plan immediately active.
5. On cancel/close: redirected to `/settings/billing?canceled=true`, plan unchanged.

**Manage Subscription (already subscribed)**:
1. User clicks "Manage Subscription".
2. System creates a Stripe Customer Portal session.
3. User is redirected to the Stripe Customer Portal.
4. User can update payment method, change plan, or cancel.
5. Changes are synchronized back via webhook.

**Downgrade guard (Team → Pro/Free)**:
If a Team user has active project members and attempts to downgrade, the system blocks the downgrade and displays a message to remove members first.

## Subscription Lifecycle

### States

| Status | Description |
|--------|-------------|
| `trialing` | Within 14-day free trial period |
| `active` | Paid and current |
| `past_due` | Payment failed; 7-day grace period active |
| `canceled` | Subscription ended; Free plan limits apply |
| `none` | No subscription record; Free plan limits apply |

### Payment Failure Handling

1. Stripe sends `invoice.payment_failed` event.
2. Subscription status set to `PAST_DUE`; `gracePeriodEndsAt` set to 7 days from now.
3. During grace period, existing plan limits remain in effect.
4. After grace period expires, Free plan limits apply at enforcement time (no automatic plan change).
5. If payment is retried successfully (Stripe Smart Retries), status returns to `ACTIVE`.

### Cancellation

- User cancels via Customer Portal.
- Subscription remains active until current billing period ends (`cancelAt` date).
- At period end, Stripe sends `customer.subscription.deleted`; subscription status is set to `CANCELED` and user reverts to Free plan limits.
- The Subscription record is preserved (not deleted) for audit and support purposes. `getEffectivePlan` returns `FREE` for any `CANCELED` subscription.

### Account Deletion

When a user deletes their account, any active Stripe subscription is cancelled via the API before the account is removed, preventing orphaned billing records.

## Downgrade Behavior

When a user downgrades (or reverts to Free plan after grace period expiry), existing resources are preserved but new creation is blocked:

- **Excess projects**: Existing projects remain accessible; new project creation is blocked until the user is under the limit.
- **Excess tickets**: Tickets already created that month remain; new ticket creation is blocked until the monthly counter resets.
- **Existing members**: Members retain access; no new members can be added.

## Access Control

- Billing endpoints require authenticated session (same as all other API endpoints).
- Plan-based gating is enforced server-side in API route handlers.
- Client-side UI reflects current limits (e.g., hides "Invite Member" on Free/Pro plans, disables creation buttons when quota is reached) but server-side enforcement is authoritative.
