# Tasks: Fix Critical Auth Bypass via Unguarded x-test-user-id Header

**Input**: Design documents from `/specs/AIB-226-fix-critical-auth/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-guards.ts, quickstart.md

**Tests**: Included — security tests are explicitly required by the feature specification (constitution check: "Security tests required: integration tests for auth bypass rejection + test mode acceptance").

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Create test infrastructure for auth security tests

- [ ] T001 Create test directory structure at tests/integration/auth/

---

## Phase 2: Foundational (Core Guards)

**Purpose**: Apply the defense-in-depth environment guards — the two code changes that close the vulnerability. MUST be complete before any user story testing can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Add build-time NODE_ENV guard to preAuthCheck() in proxy.ts — wrap the x-test-user-id bypass with `process.env.NODE_ENV === 'test'` check (see quickstart.md Checkpoint 1 and contracts/auth-guards.ts PreAuthCheckContract)
- [ ] T003 [P] Add runtime NODE_ENV guard to getCurrentUser() in lib/db/users.ts — conditionally read x-test-user-id header only when `process.env.NODE_ENV === 'test'` (see quickstart.md Checkpoint 2 and contracts/auth-guards.ts GetCurrentUserContract)

**Checkpoint**: Both authentication checkpoints now independently reject the test header in non-test environments. Fail-secure behavior is in place.

---

## Phase 3: User Story 1 — Production Users Protected from Auth Bypass (Priority: P1) 🎯 MVP

**Goal**: Verify that the x-test-user-id header is ignored in all non-test environments, preventing authentication bypass in production.

**Independent Test**: Send API requests with the x-test-user-id header in a production-like environment (NODE_ENV !== 'test') and verify that authentication is enforced normally.

### Tests for User Story 1

- [ ] T004 [P] [US1] Write integration test: unauthenticated request with x-test-user-id header is rejected (returns 401) when NODE_ENV is not 'test' — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T005 [P] [US1] Write integration test: x-test-user-id header with valid user ID is ignored in production mode, requiring standard authentication — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T006 [P] [US1] Write integration test: x-test-user-id header alongside valid session uses session identity, not header value — in tests/integration/auth/test-header-bypass.test.ts

### Edge Case Tests for User Story 1

- [ ] T007 [P] [US1] Write integration test: empty x-test-user-id header is ignored in production — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T008 [P] [US1] Write integration test: x-test-user-id header alongside valid PAT token uses token identity, not header value — in tests/integration/auth/test-header-bypass.test.ts

**Checkpoint**: US1 security tests verify the production bypass is fully closed.

---

## Phase 4: User Story 2 — Test Environment Retains Test User Impersonation (Priority: P2)

**Goal**: Verify that the x-test-user-id header continues to work in test mode (NODE_ENV === 'test'), preserving existing test infrastructure.

**Independent Test**: Run requests with x-test-user-id header while NODE_ENV=test and verify authentication succeeds as that user.

### Tests for User Story 2

- [ ] T009 [P] [US2] Write integration test: request with x-test-user-id header authenticates as that user in test mode — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T010 [P] [US2] Write integration test: middleware allows request through when x-test-user-id header is present in test mode — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T011 [P] [US2] Write integration test: request with x-test-user-id for non-existent user falls back to standard auth in test mode — in tests/integration/auth/test-header-bypass.test.ts

**Checkpoint**: US2 tests verify test mode functionality is fully preserved.

---

## Phase 5: User Story 3 — Existing Authentication Flows Unaffected (Priority: P3)

**Goal**: Verify that session-based and PAT-based authentication continue to function identically after the fix.

**Independent Test**: Exercise session login, PAT-based API access, and unauthenticated access patterns and verify identical behavior.

### Tests for User Story 3

- [ ] T012 [P] [US3] Write integration test: authenticated session access to protected resources succeeds as before — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T013 [P] [US3] Write integration test: valid Bearer PAT token access succeeds as before — in tests/integration/auth/test-header-bypass.test.ts
- [ ] T014 [P] [US3] Write integration test: unauthenticated request without any headers returns 401 as before — in tests/integration/auth/test-header-bypass.test.ts

**Checkpoint**: US3 tests verify zero regressions in existing auth flows.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and fail-secure verification

- [ ] T015 Run existing test suite (bun run test:unit && bun run test:integration) to confirm no regressions
- [ ] T016 Run type-check and lint (bun run type-check && bun run lint) to confirm code quality
- [ ] T017 Run quickstart.md validation scenarios to confirm manual verification steps match expected behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phases 3-5)**: All depend on Phase 2 completion
  - User stories can proceed in parallel (different test scenarios, same test file but independent describe blocks)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — Independent of US1
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — Independent of US1/US2

### Within Each User Story

- All test tasks within a story are marked [P] and can run in parallel (they are in the same file but test independent scenarios)
- Tests verify the guards applied in Phase 2

### Parallel Opportunities

- T002 and T003 can run in parallel (different source files)
- T004–T008 (US1 tests) can all run in parallel
- T009–T011 (US2 tests) can all run in parallel
- T012–T014 (US3 tests) can all run in parallel
- All three user story test phases (Phase 3, 4, 5) can run in parallel

---

## Parallel Example: Foundational Phase

```bash
# Launch both guards in parallel (different files):
Task: "Add build-time NODE_ENV guard to preAuthCheck() in proxy.ts"
Task: "Add runtime NODE_ENV guard to getCurrentUser() in lib/db/users.ts"
```

## Parallel Example: User Story 1

```bash
# Launch all US1 tests in parallel (independent test scenarios):
Task: "Integration test: unauthenticated request with header is rejected"
Task: "Integration test: header with valid user ID is ignored in production"
Task: "Integration test: header alongside valid session uses session identity"
Task: "Integration test: empty header is ignored in production"
Task: "Integration test: header alongside PAT uses token identity"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (create test directory)
2. Complete Phase 2: Foundational (apply both guards — the actual fix)
3. Complete Phase 3: User Story 1 tests (verify production is protected)
4. **STOP and VALIDATE**: Run tests, confirm bypass is closed
5. This delivers the critical security fix with verification

### Incremental Delivery

1. Complete Setup + Foundational → Vulnerability is closed
2. Add User Story 1 tests → Verify production protection (MVP!)
3. Add User Story 2 tests → Verify test mode preserved
4. Add User Story 3 tests → Verify no regressions
5. Each story's tests add confidence without breaking previous verification

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, all user story test phases can run in parallel:
   - Parallel task 1: User Story 1 tests (production bypass rejection)
   - Parallel task 2: User Story 2 tests (test mode preservation)
   - Parallel task 3: User Story 3 tests (regression verification)
3. Each story's tests are independently verifiable

---

## Notes

- [P] tasks = different files or independent test scenarios, no dependencies
- [Story] label maps task to specific user story for traceability
- The actual fix is only 2 code changes (T002, T003) — the majority of work is security test coverage
- All test tasks write to the same file (tests/integration/auth/test-header-bypass.test.ts) but in separate describe blocks
- Research confirms no next.config.ts changes needed — process.env.NODE_ENV is already inlined by Next.js
- Fail-secure: use `=== 'test'` not `!== 'production'` per research.md RQ-4
