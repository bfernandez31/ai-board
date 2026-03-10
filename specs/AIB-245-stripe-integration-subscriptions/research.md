# Research: Stripe Integration - Subscriptions & Billing

**Feature Branch**: `AIB-245-stripe-integration-subscriptions`
**Date**: 2026-03-10

## R-001: Stripe SDK Integration with Next.js App Router

**Decision**: Use `stripe` Node.js SDK (server-side only) for all Stripe operations. No client-side Stripe.js needed since Checkout and Customer Portal are hosted by Stripe.

**Rationale**: Stripe Checkout Sessions and Customer Portal Sessions are created server-side and redirect users to Stripe-hosted pages. This eliminates the need for `@stripe/stripe-js` or `@stripe/react-stripe-js` on the client, reducing bundle size and PCI compliance scope.

**Alternatives considered**:
- Stripe Elements (embedded payment forms): Rejected - increases PCI scope, requires client-side SDK, more code to maintain. Stripe Checkout provides a complete, maintained payment UI.
- Custom payment form: Rejected - PCI compliance burden, security risk, unnecessary complexity.

## R-002: Webhook Signature Verification

**Decision**: Use `stripe.webhooks.constructEvent()` with raw request body for webhook signature verification. The webhook endpoint must read the raw body (not parsed JSON) to verify signatures.

**Rationale**: Stripe signs the raw request body. If the body is parsed and re-serialized, signature verification fails. Next.js App Router route handlers can access the raw body via `request.text()`.

**Alternatives considered**:
- Skip verification in development: Rejected - constitution requires security-first design. Use Stripe CLI for local webhook testing with proper signatures.

## R-003: Subscription Data Model Strategy

**Decision**: Store subscription state in a `Subscription` model linked to User. Use Stripe as source of truth; local DB is a synchronized cache updated via webhooks. Store `stripeCustomerId` directly on User model (not a separate table) since it's a 1:1 relationship.

**Rationale**: Keeping `stripeCustomerId` on User simplifies queries and avoids an unnecessary join table. The spec mentions a separate StripeCustomer entity, but since it's strictly 1:1 with User, a field on User is the Prisma-idiomatic approach. The Subscription model tracks all subscription state needed for feature gating without querying Stripe's API on every request.

**Alternatives considered**:
- Separate StripeCustomer model: Rejected - adds complexity for a strict 1:1 relationship. A field on User achieves the same with simpler queries.
- Query Stripe API for current plan on each request: Rejected - adds latency, rate limit risk, and requires network availability. Local cache with webhook sync is standard.

## R-004: Plan Configuration Approach

**Decision**: Define plans as a TypeScript constant map (not a database table). Plans are static configuration: Free, Pro ($15/mo), Team ($30/mo). Map Stripe Price IDs from environment variables.

**Rationale**: Plans change infrequently and are tightly coupled to code (feature gating logic). A database table adds migration overhead for rare changes. Environment-variable Price IDs allow different Stripe accounts per environment (test vs production).

**Alternatives considered**:
- Database Plan table: Rejected - over-engineering for 3 static plans. Would require seed data, migrations for changes, and queries where a constant lookup suffices.
- Hardcoded Price IDs: Rejected - would differ between test/production Stripe accounts. Environment variables provide the right flexibility.

## R-005: Feature Gating Architecture

**Decision**: Implement a `getPlanLimits()` utility that returns limits based on the user's current plan. Enforce limits at the API layer (server-side) with client-side UI hints. Use a `useSubscription()` TanStack Query hook for client-side plan awareness.

**Rationale**: Server-side enforcement is mandatory (client-side can be bypassed). API routes for project creation and ticket creation check limits before proceeding. Client-side hook enables UI to show upgrade prompts proactively. TanStack Query with polling keeps client state fresh.

**Alternatives considered**:
- Middleware-based gating: Rejected - too coarse-grained. Different routes have different limit types. Per-route enforcement is clearer.
- React context for plan state: Rejected - constitution mandates TanStack Query for server state. Subscription status is server state.

## R-006: Idempotent Webhook Processing

**Decision**: Use Stripe event ID as idempotency key. Store processed event IDs in a `StripeEvent` model with a unique constraint. Check before processing; skip duplicates.

**Rationale**: Stripe retries webhooks and may deliver events out of order. An event log table provides both idempotency and an audit trail. The unique constraint on event ID prevents race conditions from concurrent webhook deliveries.

**Alternatives considered**:
- Rely on subscription state comparison (skip if unchanged): Rejected - doesn't handle all event types and risks subtle bugs with out-of-order delivery.
- Redis-based deduplication: Rejected - adds infrastructure dependency. PostgreSQL unique constraint is sufficient for expected webhook volume.

## R-007: Grace Period Implementation

**Decision**: Track grace period using `gracePeriodEndsAt` field on Subscription. When `invoice.payment_failed` fires, set `gracePeriodEndsAt = now + 7 days` and status to `past_due`. Feature gating checks both status and grace period: `past_due` with active grace period allows continued access; expired grace period enforces Free limits.

**Rationale**: A timestamp field is simpler than a separate state machine. The feature gating utility can compute access in a single check. Grace period expiry doesn't require a cron job - it's evaluated at access time.

**Alternatives considered**:
- Cron job to revoke access: Rejected - adds complexity, timing issues, and infrastructure dependency. Lazy evaluation at access time is simpler and more reliable.
- Separate grace period status: Rejected - `past_due` + timestamp captures the same information without an additional enum value.

## R-008: Account Deletion with Active Subscription

**Decision**: When a user deletes their account, cancel their Stripe subscription first via `stripe.subscriptions.cancel()`, then proceed with account deletion. The Prisma cascade delete handles local Subscription record cleanup.

**Rationale**: Prevents orphaned Stripe subscriptions that would continue billing. Cancel-then-delete order ensures no billing after account removal. If Stripe cancellation fails, block account deletion and surface the error.

**Alternatives considered**:
- Soft-delete user and cancel async: Rejected - risks billing during the async window. Synchronous cancellation is safer for a financial operation.

## R-009: Trial Period Configuration

**Decision**: 14-day trial configured via `trial_period_days: 14` on Stripe Checkout Session creation. Trial status tracked via `trialStart` and `trialEnd` fields on local Subscription model, synced from webhook data.

**Rationale**: Stripe manages trial logic (no charge during trial, auto-convert at end). Local fields enable UI to display trial status and end date without querying Stripe.

**Alternatives considered**:
- Trial managed application-side: Rejected - Stripe's trial management handles edge cases (payment method validation, conversion timing) correctly out of the box.

## R-010: Team Downgrade Protection

**Decision**: When a Team user attempts to downgrade (via Customer Portal webhook or direct API), check for active project members. If members exist, reject the downgrade by keeping the current plan and notifying the user. During grace period (payment failure), suspend member access but don't delete memberships.

**Rationale**: Prevents accidental data loss. Suspended members can be restored if the user re-upgrades. This aligns with the spec's conservative approach to downgrades.

**Alternatives considered**:
- Auto-remove members on downgrade: Rejected - spec explicitly requires user to remove members first.
- Block webhook processing: Rejected - can't reject a Stripe webhook. Instead, handle the event but enforce member removal through the application flow.
