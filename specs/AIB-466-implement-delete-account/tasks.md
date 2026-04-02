# Tasks: Delete Account Flow with Stripe Cancellation

**Input**: Design documents from `/specs/AIB-466-implement-delete-account/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Included — plan.md Phase 3 explicitly defines test tasks with locations and types.

**Organization**: Tasks are grouped by user story. US1 contains all implementation tasks (UI + API) since US1 and US2 share the same code paths. US2 and US3 add test coverage for their specific scenarios.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: No new project structure needed — this feature adds to an existing Next.js app. Skip to Phase 2.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix the core deletion function that ALL user stories depend on. Must complete before any story work begins.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T001 Fix Stripe error handling in `deleteUserAccount()` — change catch block in `lib/db/users.ts` to log and continue instead of re-throwing (GDPR compliance)

**Checkpoint**: `deleteUserAccount()` no longer throws on Stripe failure — deletion always succeeds.

---

## Phase 3: User Story 1 — Delete Account with Active Subscription (Priority: P1) MVP

**Goal**: A user with an active paid subscription can delete their account via the profile settings page. The system cancels their Stripe subscription, removes all data, and signs them out.

**Independent Test**: Create a user with an active subscription, trigger deletion, verify subscription cancellation + data removal + session invalidation + redirect to landing page.

### Tests for User Story 1

- [ ] T002 [P] [US1] Unit test for `deleteUserAccount()` covering subscription cancel success, cancel failure (should not throw), no subscription, and non-existent user in `tests/unit/lib/delete-account.test.ts`
- [ ] T003 [P] [US1] Integration test for `DELETE /api/account` covering 200 success with cascade deletion, 401 unauthenticated in `tests/integration/account/delete-account.test.ts`
- [ ] T004 [P] [US1] Integration test for `GET /api/account/summary` covering correct counts, zero counts, 401 unauthenticated, subscription status in `tests/integration/account/account-summary.test.ts`
- [ ] T005 [P] [US1] Component test for `DeleteAccountDialog` covering data count rendering, email mismatch disables button, email match enables button, loading state, double-click prevention in `tests/unit/components/delete-account-dialog.test.tsx`
- [ ] T006 [P] [US1] Component test for `DangerZone` covering rendering and dialog open on button click in `tests/unit/components/danger-zone.test.tsx`

### Implementation for User Story 1

- [ ] T007 [P] [US1] Create `GET /api/account/summary` route returning projectCount, credentialCount, tokenCount, hasActiveSubscription, plan in `app/api/account/summary/route.ts`
- [ ] T008 [P] [US1] Create `DELETE /api/account` route calling `deleteUserAccount()` with auth and error handling in `app/api/account/route.ts`
- [ ] T009 [US1] Create `DeleteAccountDialog` component with email confirmation input, data count display, loading state, non-dismissible dialog, and signOut on success in `components/settings/delete-account-dialog.tsx`
- [ ] T010 [US1] Create `DangerZone` component with red-bordered section, warning text, and delete button that opens the dialog in `components/settings/danger-zone.tsx`
- [ ] T011 [US1] Integrate `DangerZone` into profile page — import and render after existing profile grid with visual separator, pass `profile.email` in `app/settings/profile/page.tsx`

**Checkpoint**: Full delete flow works end-to-end for users with active subscriptions. Dialog shows data counts, requires email confirmation, cancels Stripe subscription, deletes all data, signs out, and redirects to landing page.

---

## Phase 4: User Story 2 — Delete Account without Subscription (Priority: P1)

**Goal**: A free-plan user can delete their account. Same flow as US1 but skips Stripe cancellation and confirmation modal does not mention subscription.

**Independent Test**: Create a free-tier user with projects/data, trigger deletion, verify all data removed without Stripe interaction and modal shows no subscription info.

**Note**: All implementation is shared with US1. This phase adds test coverage for the free-user path.

### Tests for User Story 2

- [ ] T012 [P] [US2] Add test cases to integration test verifying free user deletion without Stripe interaction in `tests/integration/account/delete-account.test.ts`
- [ ] T013 [P] [US2] Add test case to component test verifying modal hides subscription info for free users in `tests/unit/components/delete-account-dialog.test.tsx`

**Checkpoint**: Delete flow verified for both paid and free users. Modal correctly adapts content based on subscription status.

---

## Phase 5: User Story 3 — Cancel Deletion (Priority: P2)

**Goal**: A user can safely exit the deletion confirmation modal without any changes being made.

**Independent Test**: Open the modal, type partial email, cancel — verify no data is deleted, no subscription cancelled, user remains on profile page, and input is cleared on next open.

**Note**: Cancel behavior is built into the `DeleteAccountDialog` from US1. This phase adds test coverage.

### Tests for User Story 3

- [ ] T014 [P] [US3] Add test cases to component test verifying cancel clears input, closes dialog, and no API call is made in `tests/unit/components/delete-account-dialog.test.tsx`
- [ ] T015 [US3] Add test case verifying dialog does not dismiss on outside click or Escape key in `tests/unit/components/delete-account-dialog.test.tsx`

**Checkpoint**: Cancel flow verified — modal closes cleanly with no side effects.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case coverage.

- [ ] T016 Run `bun run type-check` and `bun run lint` to verify no type or lint errors
- [ ] T017 Run full test suite with `bun run test:unit` and `bun run test:integration` to verify all tests pass
- [ ] T018 Validate against quickstart.md — verify all files created/modified match the implementation plan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Skipped — no new project structure needed
- **Foundational (Phase 2)**: No dependencies — start immediately. BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion. Contains all implementation code
- **US2 (Phase 4)**: Depends on Phase 3 completion (uses same implementation)
- **US3 (Phase 5)**: Depends on Phase 3 completion (tests the dialog built in US1)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2) — no dependencies on other stories
- **US2 (P1)**: Depends on US1 implementation — adds test coverage for free-user path
- **US3 (P2)**: Depends on US1 implementation — adds test coverage for cancel behavior

### Within User Story 1

- T002-T006 (tests) can all run in parallel — different files
- T007, T008 (API routes) can run in parallel — different files
- T009 depends on T007, T008 (dialog fetches from both endpoints)
- T010 depends on T009 (DangerZone renders the dialog)
- T011 depends on T010 (profile page imports DangerZone)

### Parallel Opportunities

- T002, T003, T004, T005, T006 — all test files, fully parallel
- T007, T008 — both API routes, fully parallel
- T012, T013 — US2 test additions, fully parallel
- T014, T015 — US3 test additions, can run in parallel (same file but different test cases)

---

## Parallel Example: User Story 1

```bash
# Launch all tests in parallel (different files):
Task T002: "Unit test for deleteUserAccount in tests/unit/lib/delete-account.test.ts"
Task T003: "Integration test for DELETE /api/account in tests/integration/account/delete-account.test.ts"
Task T004: "Integration test for GET /api/account/summary in tests/integration/account/account-summary.test.ts"
Task T005: "Component test for DeleteAccountDialog in tests/unit/components/delete-account-dialog.test.tsx"
Task T006: "Component test for DangerZone in tests/unit/components/danger-zone.test.tsx"

# Launch both API routes in parallel (different files):
Task T007: "GET /api/account/summary in app/api/account/summary/route.ts"
Task T008: "DELETE /api/account in app/api/account/route.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Fix `deleteUserAccount()` error handling
2. Complete Phase 3: US1 — full delete flow with tests
3. **STOP and VALIDATE**: Test the complete delete flow for a subscribed user
4. Deploy/demo if ready — core GDPR compliance achieved

### Incremental Delivery

1. Phase 2: Foundational fix -> deletion unblocked
2. Phase 3: US1 -> full flow works for paid users (MVP!)
3. Phase 4: US2 -> verified for free users
4. Phase 5: US3 -> cancel safety net verified
5. Phase 6: Polish -> clean, validated, production-ready

### Parallel Execution Strategy

After Phase 2 completes:
- US1 tests (T002-T006) can all run in parallel
- US1 API routes (T007-T008) can run in parallel
- Once US1 implementation is done, US2 and US3 test phases can run in parallel

---

## Notes

- No database schema changes required — all cascade deletes already configured in Prisma
- `deleteUserAccount()` already exists in `lib/db/users.ts` — only the error handling needs modification
- Existing patterns for delete dialogs exist in `components/tokens/` and `components/credentials/` — follow them
- Email comparison is case-insensitive on the client side
- Dialog uses `onInteractOutside` and `onEscapeKeyDown` with `preventDefault()` to prevent accidental dismissal
