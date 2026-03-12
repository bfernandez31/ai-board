# Tasks: Fix Critical Auth Bypass via Unguarded `x-test-user-id` Header

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/contracts/auth-override-guard.yaml`

**Tests**: Include integration and targeted E2E regression coverage because the specification, plan, and quickstart explicitly require auth verification for non-test rejection, sanctioned test-mode override, and protected-page redirect behavior.

**Organization**: Tasks are grouped by user story so each story can be implemented, verified, and shipped as an independently testable increment.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label for story-specific tasks only
- Every task includes exact file path references

## Phase 1: Setup (Shared Test Harness)

**Purpose**: Prepare the existing test harnesses so the auth fix can be implemented and verified without ad hoc test setup.

- [X] T001 Extend `/home/runner/work/ai-board/ai-board/target/tests/fixtures/vitest/api-client.ts` so integration tests can omit `x-test-user-id`, inject conflicting headers, and opt into explicit test-mode overrides per request
- [X] T002 [P] Create the shared auth regression suite in `/home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts` for non-test rejection, explicit test-mode override, and blocked-attempt observability scenarios
- [X] T003 [P] Create the protected-page redirect regression spec in `/home/runner/work/ai-board/ai-board/target/tests/e2e/auth/test-user-header-redirect.spec.ts` for forbidden `x-test-user-id` requests outside test mode

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Centralize the guardrails that every protected request path will rely on before user-story behavior is implemented.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T004 Add explicit test-context detection, override rejection metadata, and shared auth-guard helper types in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts`
- [X] T005 [P] Refactor `/home/runner/work/ai-board/ai-board/target/lib/db/auth-helpers.ts` to accept the guarded identity-resolution path via `requireAuth(request)` for shared project and ticket authorization flows
- [X] T006 [P] Replace the unconditional `x-test-user-id` pass-through in `/home/runner/work/ai-board/ai-board/target/proxy.ts` with request classification that can block or redirect forbidden non-test requests

**Checkpoint**: Shared guard infrastructure is in place and user story implementation can proceed in priority order.

---

## Phase 3: User Story 1 - Protected Data Stays Private (Priority: P1) 🎯 MVP

**Goal**: Prevent any non-test caller from using `x-test-user-id` to impersonate another user on protected API routes or authenticated pages.

**Independent Test**: In a non-test environment, send protected requests with only `x-test-user-id` or with conflicting real credentials and verify the requests are rejected or continue under the real authenticated identity.

### Tests for User Story 1

- [X] T007 [P] [US1] Add non-test header-only rejection and conflicting-session identity-preservation coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts`
- [X] T008 [P] [US1] Extend PAT precedence coverage for conflicting `x-test-user-id` requests in `/home/runner/work/ai-board/ai-board/target/tests/integration/tokens/api.test.ts`
- [X] T009 [P] [US1] Extend protected project polling coverage for conflicting `x-test-user-id` requests in `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`

### Implementation for User Story 1

- [X] T010 [US1] Refactor `getCurrentUser()`, `getCurrentUserOrNull()`, and `requireAuth()` in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` so non-test requests fail closed and never switch identity because of `x-test-user-id`
- [X] T011 [US1] Update `/home/runner/work/ai-board/ai-board/target/app/api/tokens/route.ts` to return contract-compliant `401 Unauthorized` responses for forbidden header-only callers while preserving valid session identity
- [X] T012 [US1] Update `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/status/route.ts` to use the guarded auth path and preserve the authenticated caller when a conflicting header is present
- [X] T013 [US1] Update `/home/runner/work/ai-board/ai-board/target/app/api/notifications/route.ts` so session-only protected routes ignore forbidden header impersonation outside explicit test mode

**Checkpoint**: User Story 1 is complete when protected routes reject header-only impersonation and valid session or PAT callers keep their original identity.

---

## Phase 4: User Story 2 - Automated Tests Keep a Safe Override Path (Priority: P1)

**Goal**: Preserve the seeded test-user override for sanctioned automated runs while keeping the override unavailable everywhere else.

**Independent Test**: Run representative protected requests in explicit test mode with valid and invalid `x-test-user-id` values and verify only seeded test users resolve successfully.

### Tests for User Story 2

- [X] T014 [P] [US2] Add explicit test-mode success and unknown-test-user failure coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts`
- [X] T015 [P] [US2] Add representative test-mode override coverage for `/api/tokens` and `/api/projects/[projectId]/jobs/status` in `/home/runner/work/ai-board/ai-board/target/tests/integration/tokens/api.test.ts` and `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`

### Implementation for User Story 2

- [X] T016 [US2] Implement seeded-user-only `x-test-user-id` resolution in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` so the override is allowed only when `TEST_MODE=true` or `NODE_ENV=test`
- [X] T017 [US2] Adjust `/home/runner/work/ai-board/ai-board/target/app/api/tokens/route.ts` to keep sanctioned test-mode override behavior compatible with the guarded auth contract
- [X] T018 [US2] Adjust `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/status/route.ts` to keep sanctioned test-mode override behavior compatible with the guarded auth contract

**Checkpoint**: User Story 2 is complete when automated test-mode requests still resolve seeded test users and unknown override IDs fail safely.

---

## Phase 5: User Story 3 - Security Owners Can Verify the Fix (Priority: P2)

**Goal**: Make forbidden override attempts visibly blocked and keep a boundary-layer defense in depth even if application code regresses later.

**Independent Test**: In a non-test environment, confirm forbidden `x-test-user-id` use produces observable security signals and protected-page requests are still blocked by the proxy layer.

### Tests for User Story 3

- [X] T019 [P] [US3] Add blocked-header observability assertions in `/home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts`
- [X] T020 [P] [US3] Add protected-page redirect and proxy defense-in-depth coverage in `/home/runner/work/ai-board/ai-board/target/tests/e2e/auth/test-user-header-redirect.spec.ts`

### Implementation for User Story 3

- [X] T021 [US3] Emit consistent operator-visible blocked-header log entries with route and rejection reason from `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts`
- [X] T022 [US3] Finalize non-test boundary rejection and redirect behavior for forbidden `x-test-user-id` requests in `/home/runner/work/ai-board/ai-board/target/proxy.ts`

**Checkpoint**: User Story 3 is complete when blocked override attempts are visible in normal validation evidence and the proxy still blocks forbidden header use on protected pages.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the full change set and keep the implementation artifacts aligned with the approved verification flow.

- [X] T023 [P] Reconcile `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/quickstart.md` with the final auth-guard validation steps and expected blocked-attempt evidence
- [ ] T024 Run the validation commands documented in `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/quickstart.md` against `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` and `/home/runner/work/ai-board/ai-board/target/proxy.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** has no dependencies and should start immediately
- **Phase 2: Foundational** depends on Phase 1 and blocks all story work
- **Phase 3: User Story 1** depends on Phase 2 and delivers the MVP security fix
- **Phase 4: User Story 2** depends on User Story 1 because it extends the same guarded auth path in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts`
- **Phase 5: User Story 3** depends on Phase 2 and can proceed after User Story 1; it should land after or alongside User Story 2 if shared log wording in `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` must stay stable
- **Phase 6: Polish** depends on the desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and has no story dependency
- **US2 (P1)**: Starts after US1 because the safe test override is implemented on top of the fail-closed guard
- **US3 (P2)**: Starts after US1 and shares final proxy and logging behavior with US2

### Within Each User Story

- Write the listed tests first and confirm they fail before implementation
- Update shared auth helpers before route handlers that depend on them
- Keep route-specific behavior aligned with `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/contracts/auth-override-guard.yaml`
- Complete story-specific validation before moving to the next priority

### Parallel Opportunities

- `T002` and `T003` can run in parallel after `T001`
- `T005` and `T006` can run in parallel after `T004`
- `T007`, `T008`, and `T009` can run in parallel within US1
- `T014` and `T015` can run in parallel within US2
- `T019` and `T020` can run in parallel within US3
- `T023` can run in parallel with final validation once implementation is stable

---

## Parallel Example: User Story 1

```bash
# Launch the US1 regression tests together:
Task: "T007 [US1] Add non-test header-only rejection and conflicting-session identity-preservation coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts"
Task: "T008 [US1] Extend PAT precedence coverage for conflicting x-test-user-id requests in /home/runner/work/ai-board/ai-board/target/tests/integration/tokens/api.test.ts"
Task: "T009 [US1] Extend protected project polling coverage for conflicting x-test-user-id requests in /home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts"
```

## Parallel Example: User Story 2

```bash
# Launch the US2 verification tasks together:
Task: "T014 [US2] Add explicit test-mode success and unknown-test-user failure coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts"
Task: "T015 [US2] Add representative test-mode override coverage for /api/tokens and /api/projects/[projectId]/jobs/status in /home/runner/work/ai-board/ai-board/target/tests/integration/tokens/api.test.ts and /home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts"
```

## Parallel Example: User Story 3

```bash
# Launch the US3 observability checks together:
Task: "T019 [US3] Add blocked-header observability assertions in /home/runner/work/ai-board/ai-board/target/tests/integration/auth/test-user-header-guard.test.ts"
Task: "T020 [US3] Add protected-page redirect and proxy defense-in-depth coverage in /home/runner/work/ai-board/ai-board/target/tests/e2e/auth/test-user-header-redirect.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational guardrails
3. Complete Phase 3: User Story 1
4. Validate the non-test auth bypass is closed on representative protected routes
5. Stop for review if only the core security fix is needed immediately

### Incremental Delivery

1. Land Setup + Foundational to stabilize the auth and proxy seams
2. Deliver US1 to close the active bypass on representative protected routes
3. Deliver US2 to preserve sanctioned automated test-mode impersonation
4. Deliver US3 to harden observability and proxy-level defense in depth
5. Finish with quickstart and full validation updates

### Parallel Execution Strategy

1. Complete Phase 1 and Phase 2 sequentially
2. Run the story-level test tasks in parallel within each user story
3. Implement route-level tasks in parallel only when they touch different files
4. Reserve `/home/runner/work/ai-board/ai-board/target/lib/db/users.ts` and `/home/runner/work/ai-board/ai-board/target/proxy.ts` for sequential edits because they are shared security-critical files

---

## Notes

- All checklist items follow the required `- [ ] T### [P?] [US?] Description with file path` format
- `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/contracts/auth-override-guard.yaml` is the contract source for representative protected endpoint behavior
- `/home/runner/work/ai-board/ai-board/target/specs/AIB-281-fix-critical-auth/quickstart.md` is the release-validation source for final verification
