# Feature Specification: Stripe Integration - Subscriptions & Billing

**Feature Branch**: `AIB-245-stripe-integration-subscriptions`
**Created**: 2026-03-10
**Status**: Draft
**Input**: User description: "Stripe integration - subscriptions & billing with Free/Pro/Team plans"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Payment failure handling strategy - Users with failed payments receive a 7-day grace period before access is restricted to Free plan limits
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 11) - Payment/billing domain triggers sensitive/compliance signals
- **Fallback Triggered?**: No - AUTO confidently recommended CONSERVATIVE due to strong financial/compliance signals
- **Trade-offs**:
  1. Grace period protects user experience but means potential revenue loss during grace window
  2. Restricting to Free plan limits (vs full lockout) keeps users engaged while protecting paid features
- **Reviewer Notes**: Validate that 7-day grace period aligns with business expectations. Consider whether failed payment notifications should include in-app alerts vs email-only.

---

- **Decision**: Currency support - USD only at launch
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 11) - Single currency reduces payment complexity and compliance surface
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Limits international adoption but simplifies initial implementation
  2. Stripe handles currency conversion on their end for international cards
- **Reviewer Notes**: Multi-currency can be added later via Stripe's multi-currency support without data migration.

---

- **Decision**: Mid-cycle plan changes use Stripe's default proration (immediate proration with charge/credit)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 11) - Stripe's default proration is industry-standard and handles edge cases correctly
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Users see immediate billing adjustments which may cause confusion
  2. Stripe handles all proration math, reducing error risk
- **Reviewer Notes**: Ensure the pricing page and upgrade/downgrade flows clearly communicate proration behavior to users.

---

- **Decision**: Team-to-Pro downgrade requires removing extra members first
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 11) - Preventing data/access loss is critical in a billing context
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Adds friction to downgrade flow but prevents accidental member access loss
  2. Clear error messaging guides users through the required steps
- **Reviewer Notes**: The system should clearly indicate which members need to be removed and provide a direct link to member management.

---

- **Decision**: Billing cycle is monthly only (no annual option at launch)
- **Policy Applied**: AUTO (resolved as CONSERVATIVE)
- **Confidence**: High (score: 11) - Description explicitly specifies monthly pricing only
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Misses potential revenue from annual discount commitments
  2. Simpler billing logic and fewer plan permutations to manage
- **Reviewer Notes**: Annual billing can be added as a future enhancement by creating additional Stripe Price objects.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Plans and Subscribe (Priority: P1)

A user on the Free plan wants to upgrade to Pro or Team. They navigate to the billing/pricing page, compare the available plans, and click "Subscribe" on their chosen plan. They are redirected to Stripe Checkout to enter payment details. After successful payment, they return to the application with their new plan active and expanded limits immediately available.

**Why this priority**: This is the core monetization flow. Without checkout, no revenue is generated. Everything else depends on users being able to subscribe.

**Independent Test**: Can be fully tested by navigating to the pricing page, selecting a plan, completing Stripe Checkout (test mode), and verifying the user's plan is updated upon return.

**Acceptance Scenarios**:

1. **Given** a user on the Free plan, **When** they visit the billing page, **Then** they see all three plans (Free, Pro, Team) with pricing, features, and a clear call-to-action for Pro and Team.
2. **Given** a user clicks "Subscribe" on the Pro plan, **When** they are redirected to Stripe Checkout, **Then** the checkout session shows the correct plan name, price ($15/mo), and 14-day free trial.
3. **Given** a user completes Stripe Checkout successfully, **When** they are redirected back to the application, **Then** their account reflects the Pro plan and they can access Pro features immediately.
4. **Given** a user abandons Stripe Checkout (closes the tab or clicks back), **When** they return to the application, **Then** they remain on their current plan with no changes.

---

### User Story 2 - Webhook Synchronization (Priority: P1)

When a subscription event occurs in Stripe (new subscription, payment success, payment failure, cancellation), the system automatically updates the user's subscription status in the application without requiring any user action.

**Why this priority**: Webhook sync is the backbone of subscription accuracy. Without it, the application cannot reliably know a user's current plan status, making all plan-based feature gating unreliable.

**Independent Test**: Can be tested by triggering Stripe webhook events (via Stripe CLI or test events) and verifying the user's subscription record updates accordingly.

**Acceptance Scenarios**:

1. **Given** Stripe sends a `checkout.session.completed` event, **When** the webhook is processed, **Then** the user's subscription is created/updated with the correct plan, status, and trial period dates.
2. **Given** Stripe sends an `invoice.payment_succeeded` event for a renewal, **When** the webhook is processed, **Then** the subscription period is extended and the status remains active.
3. **Given** Stripe sends an `invoice.payment_failed` event, **When** the webhook is processed, **Then** the subscription status is marked as past-due and a 7-day grace period begins.
4. **Given** Stripe sends a `customer.subscription.deleted` event, **When** the webhook is processed, **Then** the user reverts to the Free plan.
5. **Given** a duplicate or out-of-order webhook event, **When** the webhook is processed, **Then** the system handles it idempotently without corrupting subscription state.

---

### User Story 3 - Manage Subscription via Customer Portal (Priority: P2)

A subscribed user wants to change their plan (upgrade/downgrade), update payment methods, or cancel their subscription. They click "Manage Subscription" which redirects them to the Stripe Customer Portal where they can perform these actions. Changes are synced back via webhooks.

**Why this priority**: Self-service subscription management reduces support burden and is expected by users. It depends on Stories 1 and 2 being functional.

**Independent Test**: Can be tested by clicking "Manage Subscription", verifying redirection to Stripe Customer Portal, making a change (e.g., canceling), and confirming the change is reflected in the application via webhook.

**Acceptance Scenarios**:

1. **Given** a user with an active Pro subscription, **When** they click "Manage Subscription", **Then** they are redirected to the Stripe Customer Portal with their current subscription details visible.
2. **Given** a user upgrades from Pro to Team in the Customer Portal, **When** the change is confirmed, **Then** the webhook updates their plan to Team with prorated billing and Team features become available.
3. **Given** a Team user attempts to downgrade to Pro while having project members, **When** the downgrade would remove member access, **Then** the system requires members to be removed first before allowing the downgrade.
4. **Given** a user cancels their subscription in the Customer Portal, **When** the cancellation is processed, **Then** the subscription remains active until the end of the current billing period, then reverts to Free.

---

### User Story 4 - Plan-Based Feature Gating (Priority: P2)

The system enforces plan limits across the application. Free users are limited to 1 project and 5 tickets per month. Pro users have unlimited projects and tickets. Team users get Pro features plus the ability to add project members and access advanced analytics.

**Why this priority**: Feature gating is how plan differences are experienced by users. It depends on the subscription data being accurate (Stories 1-2).

**Independent Test**: Can be tested by setting a user to each plan level and verifying that feature limits are correctly enforced (e.g., Free user cannot create a 2nd project).

**Acceptance Scenarios**:

1. **Given** a Free plan user with 1 existing project, **When** they attempt to create a second project, **Then** they are shown a message indicating they need to upgrade and are directed to the billing page.
2. **Given** a Free plan user who has created 5 tickets this month, **When** they attempt to create a 6th ticket, **Then** they are shown a limit reached message with an upgrade prompt.
3. **Given** a Pro plan user, **When** they create projects and tickets, **Then** there are no limits enforced on quantity.
4. **Given** a Free or Pro plan user, **When** they attempt to add a project member, **Then** the member invitation feature is not available (Team only).
5. **Given** a Team plan user, **When** they access the analytics dashboard, **Then** advanced analytics features are available.

---

### User Story 5 - Trial Period Experience (Priority: P3)

New subscribers to Pro or Team receive a 14-day free trial. During the trial, they have full access to their chosen plan's features. The system clearly indicates trial status and end date. At trial end, if no payment method issues exist, the subscription converts to paid automatically.

**Why this priority**: Trials reduce friction for new paid users but are secondary to core subscribe/manage flows.

**Independent Test**: Can be tested by subscribing with a trial, verifying trial dates are displayed, and confirming auto-conversion behavior at trial end (via Stripe test clock or webhook simulation).

**Acceptance Scenarios**:

1. **Given** a new user subscribes to Pro, **When** the checkout session is created, **Then** a 14-day trial period is included in the subscription.
2. **Given** a user is in their trial period, **When** they view their billing page, **Then** they see their trial end date and a clear indication that billing will begin after the trial.
3. **Given** a user's trial period ends with a valid payment method, **When** Stripe charges the first invoice, **Then** the subscription seamlessly converts to a paid subscription with no interruption.
4. **Given** a user's trial period ends with a failed payment, **When** the first charge fails, **Then** the grace period logic applies (same as post-trial payment failure).

### Edge Cases

- What happens when a user's payment method expires mid-subscription? Stripe retries failed payments per its Smart Retries settings; after exhausting retries, the subscription enters past-due and the 7-day grace period begins.
- What happens if a user deletes their account while on an active subscription? The subscription should be cancelled in Stripe before account deletion to prevent orphaned billing.
- What happens if the webhook endpoint is temporarily unavailable? Stripe retries webhooks with exponential backoff for up to 3 days. The system must process events idempotently to handle delayed delivery.
- What happens when a Free user's BYOK API key is invalid? BYOK key validation is independent of subscription status; invalid keys are handled by the existing key validation flow.
- What happens if a Team user is downgraded (e.g., payment failure) while having active members? Members retain read access during the grace period. After grace period expiry, member access is suspended (not deleted) pending plan re-upgrade.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a billing/pricing page showing all available plans (Free, Pro, Team) with their features, pricing, and subscription action buttons.
- **FR-002**: System MUST create Stripe Checkout sessions for Pro ($15/mo) and Team ($30/mo) plans with a 14-day trial period.
- **FR-003**: System MUST handle Stripe Checkout success and cancellation redirects, updating user subscription status on success.
- **FR-004**: System MUST provide a "Manage Subscription" action that redirects authenticated users to the Stripe Customer Portal.
- **FR-005**: System MUST process Stripe webhook events (`checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`) to keep subscription status synchronized.
- **FR-006**: System MUST verify webhook signatures using the Stripe webhook signing secret to prevent spoofed events.
- **FR-007**: System MUST handle webhook events idempotently to safely process retries and out-of-order delivery.
- **FR-008**: System MUST enforce plan-based limits: Free plan limited to 1 project and 5 tickets per calendar month; Pro and Team plans have no project or ticket limits.
- **FR-009**: System MUST restrict project member invitations to Team plan subscribers only.
- **FR-010**: System MUST restrict advanced analytics features to Team plan subscribers only.
- **FR-011**: System MUST default all users without an active subscription to the Free plan.
- **FR-012**: System MUST implement a 7-day grace period for failed payments before restricting access to Free plan limits.
- **FR-013**: System MUST block Team-to-Pro/Free downgrades when the user has active project members, displaying a clear message to remove members first.
- **FR-014**: System MUST create a Stripe Customer record for each user upon their first subscription action and persist the mapping.
- **FR-015**: System MUST track subscription status, current plan, trial dates, and billing period dates for each user.
- **FR-016**: System MUST cancel the Stripe subscription when a user deletes their account.
- **FR-017**: Free plan users MUST provide their own API key (BYOK) to use AI features; this requirement is not changed by this feature.

### Key Entities

- **Subscription**: Represents a user's active subscription. Linked to a single user account. Tracks the current plan (FREE/PRO/TEAM), Stripe subscription ID, status (active, trialing, past_due, cancelled), current period start/end, trial start/end, and cancellation date if applicable.
- **Plan**: Defines the available subscription tiers (Free, Pro, Team) with their associated feature limits (max projects, max tickets per month, member access, analytics access) and Stripe Price ID mapping.
- **StripeCustomer**: Maps an application user to their Stripe Customer ID for billing operations. One-to-one relationship with User.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a subscription purchase (from pricing page to active subscription) in under 3 minutes.
- **SC-002**: Subscription status updates from Stripe webhooks are reflected in the application within 30 seconds of event delivery.
- **SC-003**: 100% of plan-based feature limits are correctly enforced (no Free user can access Pro/Team features without a valid subscription).
- **SC-004**: Users can access the Stripe Customer Portal and return to the application with updated subscription status in under 2 minutes.
- **SC-005**: Zero orphaned Stripe subscriptions exist after user account deletion.
- **SC-006**: Webhook processing handles 100% of retry/duplicate events without data corruption (idempotency).
- **SC-007**: Trial-to-paid conversion occurs seamlessly with no user intervention when payment method is valid.
