# Tasks: Plan Quotas & Enforcement (AIB-246)

**Input**: Design documents from `/specs/AIB-246-plan-quotas-enforcement/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md

**Tests**: Included per plan.md Phase 4 requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update plan configuration to support all downstream enforcement and visibility features.

- [x] T001 Add `maxMembersPerProject` field to `PlanLimits` interface and update FREE/PRO/TEAM plan configs in `lib/billing/plans.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend API and frontend hook that MUST be complete before any user story UI work can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Create usage API endpoint returning plan, project count, monthly ticket count, status, and grace period in `app/api/billing/usage/route.ts`
- [x] T003 Create `useUsage` TanStack Query hook with 15s polling for `/api/billing/usage` in `hooks/use-usage.ts`

**Checkpoint**: Foundation ready — usage data infrastructure available for all UI stories.

---

## Phase 3: User Story 1 — Project Creation Quota Enforcement (Priority: P1) 🎯 MVP

**Goal**: Free-plan users at project limit see upgrade prompt instead of "New Project" button.

**Independent Test**: Create 1 project as Free user, attempt to create a second — system blocks and shows upgrade prompt.

### Implementation for User Story 1

- [x] T004 [US1] Add project creation quota gate using `useUsage()` to disable "New Project" button and show `UpgradePrompt` when `projects.current >= projects.max` in the project creation area of `app/projects/page.tsx`

**Checkpoint**: Free users are blocked from creating projects beyond their limit with a clear upgrade CTA.

---

## Phase 4: User Story 2 — Monthly Ticket Quota Enforcement (Priority: P1)

**Goal**: Free-plan users see ticket usage count in the new ticket modal and are blocked when at limit.

**Independent Test**: Create 5 tickets as Free user in one month, attempt a 6th — modal shows "5/5 tickets this month" and disables submit with upgrade prompt.

### Implementation for User Story 2

- [x] T005 [US2] Add ticket usage indicator ("X/Y tickets used this month") and upgrade gate (disable submit + show `UpgradePrompt` when at limit) using `useUsage()` in `components/board/new-ticket-modal.tsx`
- [x] T006 [US2] Verify PLAN_LIMIT error handling in ticket and project creation flows displays API error message prominently with upgrade link in `components/board/new-ticket-modal.tsx`

**Checkpoint**: Free users see ticket consumption and are blocked at limit with upgrade prompt.

---

## Phase 5: User Story 3 — Member Addition Enforcement (Priority: P2)

**Goal**: Enforce per-project member count limit (max 10 for Team) server-side.

**Independent Test**: As Team user, add 10 members to a project, attempt 11th — returns 403 PLAN_LIMIT. As Pro user, attempt to add a member — blocked by existing `membersEnabled` gate.

### Implementation for User Story 3

- [x] T007 [US3] Add per-project member count enforcement after existing `membersEnabled` check — count `ProjectMember` records, compare against `maxMembersPerProject`, return 403 with `code: 'PLAN_LIMIT'` in `app/api/projects/[projectId]/members/route.ts`

**Checkpoint**: Team users limited to 10 members per project; Free/Pro users still fully blocked.

---

## Phase 6: User Story 4 — Usage Visibility (Priority: P2)

**Goal**: Users see plan usage metrics on the dashboard — Free users see quota numbers, paid users see plan name.

**Independent Test**: Log in as Free user — dashboard shows "1/1 projects | 3/5 tickets this month | Free Plan". Log in as Pro user — shows "Pro Plan" without numeric quotas.

### Implementation for User Story 4

- [x] T008 [US4] Create `UsageBanner` component showing plan name and quota indicators (numeric for Free, name-only for paid) in `components/billing/usage-banner.tsx`
- [x] T009 [US4] Integrate `UsageBanner` component into projects list page in `app/projects/page.tsx`

**Checkpoint**: All users see their plan status on the dashboard; Free users see consumption metrics.

---

## Phase 7: User Story 5 — Analytics Access Gating (Priority: P3)

**Goal**: Gate advanced analytics section to Team-plan users only with upgrade prompt for others.

**Independent Test**: Navigate to analytics as Pro user — advanced section shows upgrade prompt. As Team user — advanced section is accessible.

### Implementation for User Story 5

- [x] T010 [US5] Add advanced analytics gate section that shows `UpgradePrompt` for non-Team users using `useSubscription()` to check `advancedAnalytics` flag in `components/analytics/analytics-dashboard.tsx`

**Checkpoint**: Advanced analytics gated to Team plan with upgrade CTA for others.

---

## Phase 8: User Story 6 — Grace Period Quota Behavior (Priority: P3)

**Goal**: Show warning banner during grace period with payment failure details and link to update payment method.

**Independent Test**: Simulate `status === 'past_due'` with `gracePeriodEndsAt` set — banner shows "Payment failed. Your plan limits will be reduced to Free on [date]. Update payment method." with link to `/settings/billing`.

### Implementation for User Story 6

- [x] T011 [US6] Add grace period warning banner to `UsageBanner` — when `status === 'past_due'` and `gracePeriodEndsAt` is set, show warning with expiry date and link to `/settings/billing` in `components/billing/usage-banner.tsx`

**Checkpoint**: Users with payment failures see clear warning about impending downgrade.

---

## Phase 9: Testing

**Purpose**: Verify all quota enforcement and UI indicators work correctly.

### Integration Tests

- [x] T012 [P] Integration test for GET `/api/billing/usage` — verify correct counts for Free/Pro/Team users and monthly ticket count reset logic in `tests/integration/billing/usage.test.ts`
- [x] T013 [P] Integration test for member count limit — verify Team user can add up to 10 members, 11th returns 403 PLAN_LIMIT, Free/Pro still blocked in `tests/integration/members/` (extend existing)

### Component Tests

- [x] T014 [P] Component test for `UsageBanner` — Free user sees quota numbers, Pro/Team sees plan name only, grace period warning appears when `status === 'past_due'` in `tests/unit/components/usage-banner.test.tsx`
- [x] T015 [P] Component test for ticket modal quota — Free user sees ticket count, limit reached shows upgrade prompt in `tests/unit/components/new-ticket-modal.test.tsx` (extend existing if present)

**Checkpoint**: All enforcement logic and UI indicators verified by tests.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all user stories.

- [x] T016 Run `bun run type-check` and `bun run lint` to ensure no regressions
- [x] T017 Verify `maxMembersPerProject` is included in subscription API response from `app/api/billing/subscription/route.ts`
- [x] T018 Invalidate `useUsage` query cache on project/ticket creation mutations to ensure immediate UI updates

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3–8)**: All depend on Foundational phase completion
  - US1 and US2 (P1) should complete before US3–US6
  - US3–US6 can proceed in parallel after foundational
- **Testing (Phase 9)**: Depends on all user story implementations
- **Polish (Phase 10)**: Depends on all phases

### User Story Dependencies

- **US1 (P1)**: Depends on T001, T002, T003 — no dependency on other stories
- **US2 (P1)**: Depends on T001, T002, T003 — no dependency on other stories
- **US3 (P2)**: Depends on T001 only (backend-only) — no dependency on other stories
- **US4 (P2)**: Depends on T002, T003 — no dependency on other stories
- **US5 (P3)**: No dependency on foundational tasks (uses existing `useSubscription`) — independent
- **US6 (P3)**: Depends on T008 (extends UsageBanner) — depends on US4

### Within Each User Story

- Models/config before services
- Backend before frontend
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T002 and T003 can run in parallel (different files, no dependencies)
- T004 and T005 can run in parallel (US1 and US2, different files)
- T008 and T007 can run in parallel (US4 and US3, different files)
- T010 is independent — can run in parallel with any story
- All test tasks (T012–T015) can run in parallel

---

## Parallel Example: User Stories 1 & 2

```bash
# After foundational phase, launch US1 and US2 in parallel:
Task: "T004 [US1] Add project creation quota gate in app/projects/page.tsx"
Task: "T005 [US2] Add ticket usage indicator in components/board/new-ticket-modal.tsx"
```

## Parallel Example: User Stories 3 & 4

```bash
# US3 and US4 can also run in parallel:
Task: "T007 [US3] Add member count enforcement in app/api/projects/[projectId]/members/route.ts"
Task: "T008 [US4] Create UsageBanner component in components/billing/usage-banner.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002, T003)
3. Complete Phase 3: US1 — Project Creation Quota (T004)
4. Complete Phase 4: US2 — Ticket Quota (T005, T006)
5. **STOP and VALIDATE**: Test US1 and US2 independently
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 → Test independently → Deploy/Demo (MVP!)
3. Add US3 + US4 → Test independently → Deploy/Demo
4. Add US5 + US6 → Test independently → Deploy/Demo
5. Testing phase → Verify all enforcement
6. Polish → Final validation

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel batch 1: US1 (T004) + US2 (T005, T006)
   - Parallel batch 2: US3 (T007) + US4 (T008, T009)
   - Parallel batch 3: US5 (T010) + US6 (T011)
3. All test tasks (T012–T015) run in parallel after implementation
4. Polish phase last
