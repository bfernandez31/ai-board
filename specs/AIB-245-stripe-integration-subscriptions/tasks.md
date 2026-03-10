# Tasks: Stripe Integration - Subscriptions & Billing

**Input**: Design documents from `/specs/AIB-245-stripe-integration-subscriptions/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/billing-api.md, quickstart.md

**Tests**: Included per constitution check (integration tests for webhook + billing API, unit tests for plan config + feature gating utilities, no E2E).

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependency, add schema changes, run migration

- [x] T001 Install stripe dependency via `bun add stripe`
- [x] T002 Add SubscriptionPlan and SubscriptionStatus enums, Subscription model, StripeEvent model, and stripeCustomerId field on User to prisma/schema.prisma
- [x] T003 Generate Prisma client and create migration via `bunx prisma migrate dev --name add-stripe-subscriptions`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core billing library modules that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create Stripe client singleton in lib/billing/stripe.ts (server-only, uses STRIPE_SECRET_KEY env var)
- [x] T005 [P] Create plan configuration constants and types (PlanConfig, PLANS map, helper functions) in lib/billing/plans.ts
- [x] T006 [P] Create subscription DB operations (findByUserId, upsert, delete, createStripeEvent, isEventProcessed) in lib/db/subscriptions.ts
- [x] T007 Create subscription utility functions (getUserSubscription, getPlanLimits, getEffectivePlan with grace period logic) in lib/billing/subscription.ts (depends on T005, T006)
- [x] T008 [P] Create useSubscription TanStack Query hook with polling in hooks/use-subscription.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Plans and Subscribe (Priority: P1) MVP

**Goal**: Users can view plans, subscribe via Stripe Checkout, and see their active subscription upon return

**Independent Test**: Navigate to pricing page, select a plan, complete Stripe Checkout (test mode), verify plan is updated upon return

### Tests for User Story 1

- [x] T009 [P] [US1] Unit tests for plan configuration (PLANS constant, price IDs, limits) in tests/unit/billing/plans.test.ts
- [x] T010 [P] [US1] Integration test for GET /api/billing/plans endpoint in tests/integration/billing/plans.test.ts
- [x] T011 [P] [US1] Integration test for POST /api/billing/checkout endpoint (valid plan, already subscribed, unauthenticated) in tests/integration/billing/checkout.test.ts
- [x] T012 [P] [US1] Integration test for GET /api/billing/subscription endpoint (free user, subscribed user, unauthenticated) in tests/integration/billing/subscription.test.ts

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement GET /api/billing/plans route returning all plans with features and limits in app/api/billing/plans/route.ts
- [x] T014 [P] [US1] Implement GET /api/billing/subscription route returning current user plan, status, limits in app/api/billing/subscription/route.ts
- [x] T015 [US1] Implement POST /api/billing/checkout route (Zod validation, create/retrieve Stripe Customer, create Checkout Session with trial, return URL) in app/api/billing/checkout/route.ts
- [x] T016 [P] [US1] Create pricing-cards component (Free/Pro/Team comparison cards with shadcn/ui Card, subscribe buttons) in components/billing/pricing-cards.tsx
- [x] T017 [P] [US1] Create subscription-status component (current plan badge, period dates, basic status display) in components/billing/subscription-status.tsx
- [x] T018 [US1] Create billing settings page composing pricing-cards and subscription-status with checkout redirect handling in app/settings/billing/page.tsx

**Checkpoint**: Users can view plans, subscribe via Checkout, and see their active subscription

---

## Phase 4: User Story 2 - Webhook Synchronization (Priority: P1)

**Goal**: Stripe webhook events automatically update user subscription state without user action

**Independent Test**: Trigger Stripe webhook events (via Stripe CLI or test payloads) and verify subscription record updates accordingly

### Tests for User Story 2

- [ ] T019 [P] [US2] Integration tests for webhook handler (all 5 event types, signature verification, idempotency, invalid signature) in tests/integration/billing/webhook.test.ts

### Implementation for User Story 2

- [ ] T020 [US2] Implement POST /api/webhooks/stripe route with raw body signature verification, idempotency check via StripeEvent, and handlers for checkout.session.completed, invoice.payment_succeeded, invoice.payment_failed, customer.subscription.updated, customer.subscription.deleted in app/api/webhooks/stripe/route.ts

**Checkpoint**: Subscription state stays in sync with Stripe automatically

---

## Phase 5: User Story 3 - Manage Subscription via Customer Portal (Priority: P2)

**Goal**: Subscribed users can manage their subscription (upgrade, downgrade, cancel, update payment) via Stripe Customer Portal

**Independent Test**: Click "Manage Subscription", verify redirect to Stripe Portal, confirm changes reflected via webhook

### Tests for User Story 3

- [ ] T021 [P] [US3] Integration test for POST /api/billing/portal endpoint (valid customer, no customer, unauthenticated) in tests/integration/billing/portal.test.ts

### Implementation for User Story 3

- [ ] T022 [US3] Implement POST /api/billing/portal route (verify stripeCustomerId exists, create Portal Session with return URL) in app/api/billing/portal/route.ts
- [ ] T023 [US3] Add "Manage Subscription" button to billing page that calls portal endpoint and redirects in app/settings/billing/page.tsx

**Checkpoint**: Users can self-manage their subscription without support

---

## Phase 6: User Story 4 - Plan-Based Feature Gating (Priority: P2)

**Goal**: System enforces plan limits (max projects, max tickets/month, members, analytics) across existing API routes

**Independent Test**: Set user to each plan level, verify limits are enforced (e.g., Free user cannot create 2nd project)

### Tests for User Story 4

- [ ] T024 [P] [US4] Unit tests for getPlanLimits and getEffectivePlan (all plans, grace period logic, expired grace period) in tests/unit/billing/subscription.test.ts
- [ ] T025 [P] [US4] Integration tests for feature gating on project creation (Free limit = 1), ticket creation (Free limit = 5/month), member invitation (Team only) in tests/integration/billing/feature-gating.test.ts

### Implementation for User Story 4

- [ ] T026 [US4] Add maxProjects limit check to POST handler in app/api/projects/route.ts (query user plan limits, count existing projects, return 403 with upgrade prompt if exceeded)
- [ ] T027 [US4] Add maxTicketsPerMonth limit check to ticket creation endpoint in app/api/tickets/route.ts (count current month tickets, return 403 if exceeded)
- [ ] T028 [US4] Add membersEnabled check to POST handler in app/api/projects/[projectId]/members/route.ts (return 403 if not Team plan)
- [ ] T029 [P] [US4] Create upgrade-prompt component (limit-reached message with CTA linking to billing page) in components/billing/upgrade-prompt.tsx

**Checkpoint**: All plan limits are server-side enforced with clear upgrade prompts

---

## Phase 7: User Story 5 - Trial Period Experience (Priority: P3)

**Goal**: New subscribers get a 14-day free trial with clear trial status display and seamless auto-conversion

**Independent Test**: Subscribe with trial, verify trial dates displayed, confirm auto-conversion via webhook simulation

### Implementation for User Story 5

- [ ] T030 [US5] Enhance subscription-status component to display trial end date, trial badge, and "billing begins after trial" messaging in components/billing/subscription-status.tsx
- [ ] T031 [US5] Ensure checkout session creation includes trial_period_days: 14 and webhook handler correctly sets trialStart/trialEnd fields (verify in app/api/billing/checkout/route.ts and app/api/webhooks/stripe/route.ts)

**Checkpoint**: Trial experience is clearly communicated and auto-converts seamlessly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Account cleanup, edge cases, and final hardening

- [ ] T032 Add Stripe subscription cancellation to user deletion flow in lib/db/users.ts (cancel via stripe.subscriptions.cancel before account deletion, block deletion on failure)
- [ ] T033 Add Team-to-Pro/Free downgrade protection in webhook handler: check for active project members on plan downgrade in customer.subscription.updated handler in app/api/webhooks/stripe/route.ts
- [ ] T034 Validate all environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID, STRIPE_TEAM_PRICE_ID, NEXT_PUBLIC_APP_URL) are checked at startup in lib/billing/stripe.ts
- [ ] T035 Run type-check and lint to verify no regressions via `bun run type-check && bun run lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma schema must exist)
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 2 completion (can run in parallel with US1)
- **US3 (Phase 5)**: Depends on Phase 2; integrates with US2 webhook flow
- **US4 (Phase 6)**: Depends on Phase 2 (subscription utilities); independent of US1-US3
- **US5 (Phase 7)**: Depends on US1 (checkout) and US2 (webhook) being implemented
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 - no story dependencies
- **US2 (P1)**: After Phase 2 - no story dependencies (can parallel with US1)
- **US3 (P2)**: After Phase 2 - functionally benefits from US2 webhook handler
- **US4 (P2)**: After Phase 2 - no story dependencies (can parallel with US1-US3)
- **US5 (P3)**: After US1 + US2 - needs checkout and webhook to be implemented

### Within Each User Story

- Tests written and expected to FAIL before implementation
- DB operations before API routes
- API routes before UI components
- Core implementation before integration

### Parallel Opportunities

- T004, T005, T006, T008 can all run in parallel (Phase 2 - different files)
- T009, T010, T011, T012 can all run in parallel (US1 tests - different files)
- T013, T014 can run in parallel (US1 API - different route files)
- T016, T017 can run in parallel (US1 UI - different component files)
- US1 and US2 can run in parallel after Phase 2
- US3 and US4 can run in parallel after Phase 2
- T026, T027, T028, T029 touch different files (US4 - different routes)

---

## Parallel Example: User Story 1

```
# Launch all US1 tests together:
Task T009: "Unit tests for plan config in tests/unit/billing/plans.test.ts"
Task T010: "Integration test for GET /api/billing/plans in tests/integration/billing/plans.test.ts"
Task T011: "Integration test for POST /api/billing/checkout in tests/integration/billing/checkout.test.ts"
Task T012: "Integration test for GET /api/billing/subscription in tests/integration/billing/subscription.test.ts"

# Launch parallel API routes:
Task T013: "GET /api/billing/plans in app/api/billing/plans/route.ts"
Task T014: "GET /api/billing/subscription in app/api/billing/subscription/route.ts"

# Launch parallel UI components:
Task T016: "Pricing cards in components/billing/pricing-cards.tsx"
Task T017: "Subscription status in components/billing/subscription-status.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (billing library)
3. Complete Phase 3: User Story 1 (subscribe flow)
4. Complete Phase 4: User Story 2 (webhook sync)
5. **STOP and VALIDATE**: Users can subscribe and state stays in sync
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. US1 + US2 -> Core billing works (MVP!)
3. US3 -> Self-service management
4. US4 -> Feature limits enforced
5. US5 -> Trial polish
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done:
   - Parallel track A: US1 (subscribe) + US2 (webhooks)
   - Parallel track B: US4 (feature gating)
3. After US1 + US2: US3 (portal) and US5 (trial polish)
4. Polish phase last

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
