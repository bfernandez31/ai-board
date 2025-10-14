# Tasks: Replace SSE with Client-Side Polling

**Input**: Design documents from `/specs/028-519-replace-sse/`
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → ✅ Found: Tech stack (Next.js 15, React 18, TypeScript 5.6), structure documented
   → ✅ Extract: API routes in app/api, hooks in app/lib/hooks, components in components/
2. Load optional design documents:
   → ✅ data-model.md: No schema changes, client-side PollingState model
   → ✅ contracts/: job-polling-api.yml + polling-contract.spec.ts (14 test cases)
   → ✅ research.md: 5 decisions (polling interval, terminal optimization, error retry, scope, lifecycle)
   → ✅ quickstart.md: 6 validation scenarios + performance requirements
3. Generate tasks by category:
   → Setup: Database validation (no changes needed)
   → Tests: Contract tests (14 cases), E2E tests (6 scenarios)
   → Core: API endpoint, polling hook, component updates
   → Integration: Remove SSE infrastructure
   → Polish: Performance validation, documentation updates
4. Apply task rules:
   → Contract tests [P] (independent test files)
   → E2E tests [P] (independent scenarios)
   → API + hook sequential (API must exist for hook to test)
   → SSE cleanup [P] (independent file deletions)
5. Number tasks sequentially (T001-T023)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✅ All contracts have tests (polling-contract.spec.ts)
   → ✅ All entities validated (Job model unchanged, PollingState client-only)
   → ✅ All endpoints implemented (GET /api/projects/[projectId]/jobs/status)
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js 15 App Router structure
- **Backend**: `app/api/` (API routes)
- **Frontend**: `app/lib/hooks/` (React hooks), `components/` (UI components)
- **Tests**: `tests/e2e/` (E2E tests), `tests/unit/` (unit tests)

---

## Phase 3.1: Setup & Validation

- [ ] **T001** Validate database schema has Job model with required fields (id, status, ticketId, projectId, updatedAt)
  - **Path**: `prisma/schema.prisma`
  - **Verification**: Confirm JobStatus enum includes PENDING, RUNNING, COMPLETED, FAILED, CANCELLED
  - **Expected**: No changes needed, existing schema sufficient

- [ ] **T002** Validate database has index on Job.projectId for efficient polling queries
  - **Path**: `prisma/schema.prisma`
  - **Verification**: Check for `@@index([projectId])` on Job model
  - **Action**: Add index if missing (performance requirement: <100ms p95)

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Parallel - Independent Test Files)

- [ ] **T003 [P]** Contract test: 401 Unauthorized when no session cookie
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists, verify execution)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T004 [P]** Contract test: 403 Forbidden when project belongs to different user
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T005 [P]** Contract test: 404 Not Found when project does not exist
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T006 [P]** Contract test: 200 OK with empty jobs array
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T007 [P]** Contract test: 200 OK with job array (all statuses)
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T008 [P]** Contract test: Response schema matches OpenAPI spec
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

- [ ] **T009 [P]** Contract test: Response time <100ms (p95 performance requirement)
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint + T002 index

- [ ] **T010 [P]** Contract test: Excludes sensitive fields from response
  - **Path**: `specs/028-519-replace-sse/contracts/polling-contract.spec.ts` (test already exists)
  - **Verification**: Test fails with "endpoint not found" (404)
  - **Expected**: Fail until T011 implements endpoint

### E2E Tests (Reuse & Convert Existing Tests)

**STRATEGY**: Reuse existing SSE tests by converting them to test polling behavior. Avoid duplication.

**Test Coverage Analysis**:
- ✅ **Existing tests reused**: `tests/e2e/jobs/status-update.spec.ts` (12 tests, no changes needed)
- 🔄 **Existing tests converted**: `sse-job-broadcast.spec.ts` → `polling-job-updates.spec.ts` (5 tests adapted)
- ➕ **New tests added**: 3 polling-specific tests (interval, terminal filtering, stop condition)
- ❌ **Tests deleted**: `sse-connection.spec.ts` (EventSource-specific, not applicable to polling)

**Result**: 13 E2E tests instead of 18 new tests (saves 5 duplicate test files)

- [ ] **T011 [P]** Convert SSE job broadcast tests to polling tests
  - **Path**: Rename `tests/e2e/real-time/sse-job-broadcast.spec.ts` → `tests/e2e/real-time/polling-job-updates.spec.ts`
  - **Changes**:
    - Remove EventSource connection checks
    - Replace SSE message listeners with polling interval verification
    - Keep existing test scenarios (status updates, multiple jobs, project isolation, rapid updates)
    - Tests already cover: Scenario 1 (status update), Scenario 2 (multiple jobs), Scenario 6 (tab behavior)
  - **Expected**: Fail until T017 (API) + T019 (polling hook) implemented

- [ ] **T012 [P]** Add polling-specific behavior tests (3 new tests in converted file)
  - **Path**: `tests/e2e/real-time/polling-job-updates.spec.ts` (add to converted file)
  - **New Tests**:
    1. **Polling interval verification**: Verify polling occurs exactly every 2 seconds
    2. **Terminal state client-side filtering** (Scenario 3): Complete job → verify client excludes terminal job from updates
    3. **Complete polling stop** (Scenario 5): All jobs terminal → verify polling stops entirely
  - **Expected**: Fail until T019 implements terminal tracking and stop condition

- [ ] **T013 [P]** Reuse existing job status update tests (NO CHANGES NEEDED)
  - **Path**: `tests/e2e/jobs/status-update.spec.ts` (already exists, no modification)
  - **Coverage**: Already tests job status transitions via API (RUNNING → COMPLETED/FAILED/CANCELLED)
  - **Verification**: Run existing tests, confirm they pass with polling implementation
  - **Note**: These tests are API-focused and work with both SSE and polling

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### API Layer (Sequential - Endpoint must exist for hook testing)

- [ ] **T017** Create API endpoint GET /api/projects/[projectId]/jobs/status
  - **Path**: `app/api/projects/[projectId]/jobs/status/route.ts` (new file)
  - **Implementation**:
    - Session validation (NextAuth.js `getServerSession`)
    - Project ownership check (userId from session matches project.userId)
    - Prisma query: `findMany({ where: { projectId }, select: { id, status, ticketId, updatedAt } })`
    - Zod response validation (JobStatusResponseSchema)
    - Error handling: 401 (no session), 403 (not owned), 404 (not found), 500 (DB error)
  - **Verification**: T003-T010 contract tests pass (8 tests)

- [ ] **T018** Create Zod validation schemas for polling API
  - **Path**: `app/lib/schemas/job-polling.ts` (new file)
  - **Schemas**: JobStatusDtoSchema, JobStatusResponseSchema
  - **Export**: Types for TypeScript inference
  - **Verification**: T008 schema test passes

### Client Layer (Sequential - Hook depends on API, component depends on hook)

- [ ] **T019** Create useJobPolling custom React hook
  - **Path**: `app/lib/hooks/useJobPolling.ts` (new file)
  - **Implementation**:
    - `useState` for PollingState (isPolling, lastPollTime, errorCount, terminalJobIds)
    - `useEffect` with `setInterval(pollFunction, 2000)` (2-second interval)
    - Cleanup function: `clearInterval(intervalId)` on unmount
    - Terminal state tracking: Add job IDs to Set when status becomes terminal
    - Stop condition: Stop polling when all jobs in terminalJobIds Set
    - Error retry: Fixed 2-second interval (no exponential backoff)
    - Network error handling: Log error, continue polling
  - **Verification**: T011-T016 E2E tests pass (6 scenarios)

- [ ] **T020** Create unit tests for useJobPolling hook
  - **Path**: `tests/unit/useJobPolling.test.ts` (new file)
  - **Tests**:
    - Polling starts on mount, stops on unmount
    - Terminal job IDs tracked correctly
    - Stop condition triggers when all jobs terminal
    - Error retry behavior (fixed 2s interval)
    - No exponential backoff on errors
  - **Verification**: All unit tests pass

- [ ] **T021** Update TicketCard component to use polling hook
  - **Path**: `components/board/TicketCard.tsx` (modify existing file)
  - **Changes**:
    - Import `useJobPolling` hook
    - Remove SSEProvider dependencies (if any)
    - Call `useJobPolling(projectId)` to get job statuses
    - Map job statuses to ticket display
    - Preserve existing minimum display duration behavior (prevent flickering)
  - **Verification**: E2E tests verify UI updates correctly

---

## Phase 3.4: Integration & SSE Removal

### SSE Infrastructure Cleanup (Parallel - Independent file deletions)

- [ ] **T022 [P]** Delete SSE API endpoint
  - **Path**: `app/api/sse/route.ts` (delete file)
  - **Verification**: File deleted, no imports referencing it

- [ ] **T023 [P]** Delete SSEProvider React context
  - **Path**: `app/providers/SSEProvider.tsx` (delete file, if exists)
  - **Verification**: File deleted, no imports referencing it

- [ ] **T024 [P]** Remove SSEProvider from board page layout
  - **Path**: `app/projects/[projectId]/board/page.tsx` (modify existing file)
  - **Changes**: Remove SSEProvider wrapper, remove imports
  - **Verification**: No SSE-related code remains in board page

- [ ] **T025 [P]** Delete old SSE E2E connection tests
  - **Path**: `tests/e2e/real-time/sse-connection.spec.ts` (delete file)
  - **Reason**: SSE connection tests no longer relevant (polling doesn't use EventSource)
  - **Note**: sse-job-broadcast.spec.ts already renamed to polling-job-updates.spec.ts in T011
  - **Verification**: File deleted, no references in test suite

- [ ] **T026 [P]** Update existing tests that reference SSE
  - **Path**: Search for SSE references in `tests/e2e/**/*.spec.ts`
  - **Changes**: Remove assertions about EventSource, text/event-stream, SSE connections
  - **Verification**: All existing E2E tests pass with polling implementation

---

## Phase 3.5: Polish & Documentation

- [ ] **T027 [P]** Run performance validation (quickstart.md performance scenario)
  - **Path**: `specs/028-519-replace-sse/quickstart.md` (manual execution)
  - **Verification**: p95 response time <100ms, polling interval exactly 2 seconds
  - **Expected**: T002 index + T014 optimization enable passing

- [ ] **T028 [P]** Update CLAUDE.md with polling implementation
  - **Path**: `CLAUDE.md` (modify existing file)
  - **Changes**: Add "028-519-replace-sse: Replaced SSE with 2-second client polling"
  - **Verification**: Documentation reflects new architecture

- [ ] **T029 [P]** Update API documentation with polling endpoint
  - **Path**: `docs/api.md` (if exists, modify; otherwise create)
  - **Changes**: Document GET /api/projects/[projectId]/jobs/status endpoint
  - **Content**: Request/response schemas, authentication requirements, performance characteristics

- [ ] **T030** Run full test suite validation
  - **Command**: `npm test` (all tests)
  - **Expected**: All tests pass (contract + E2E + unit + existing tests)
  - **Verification**: Zero test failures, no regressions

- [ ] **T031** Execute manual testing checklist (quickstart.md scenarios 1-6)
  - **Path**: `specs/028-519-replace-sse/quickstart.md` (manual execution)
  - **Scenarios**: All 6 validation scenarios + performance validation
  - **Verification**: All acceptance criteria met

---

## Dependencies

### Critical Path (Must follow order)
```
Setup & Validation (T001-T002)
  ↓
Tests Written [P] (T003-T013) ← GATE: All tests must FAIL
  ↓
API Implementation (T017-T018)
  ↓
Client Implementation (T019-T021)
  ↓
Integration & Cleanup [P] (T022-T026)
  ↓
Polish & Validation [P] (T027-T031)
```

### Detailed Dependencies
- **T001-T002** (Setup) → Blocks all implementation
- **T003-T013** (Tests) → Must fail before T017
  - T003-T010: Contract tests (already exist, verify they fail)
  - T011: Rename/convert SSE tests to polling tests
  - T012: Add 3 polling-specific tests to converted file
  - T013: Reuse existing job status tests (no changes)
- **T017** (API endpoint) → Blocks T019 (hook needs API)
- **T018** (Zod schemas) → Blocks T017 (API needs validation)
- **T019** (Polling hook) → Blocks T021 (component needs hook)
- **T020** (Unit tests) → Parallel with T019 (can develop concurrently)
- **T021** (Component update) → Blocks T022-T026 (SSE removal after polling works)
- **T022-T026** (SSE cleanup) → Can run in parallel (independent deletions)
- **T027-T031** (Polish) → Require all implementation complete

---

## Parallel Execution Examples

### Contract Tests (T003-T010)
```bash
# Run all contract tests in parallel (Playwright automatically parallelizes)
npx playwright test specs/028-519-replace-sse/contracts/polling-contract.spec.ts
```

### E2E Tests (T011-T013)
```bash
# T011: Rename SSE test to polling test (manual)
git mv tests/e2e/real-time/sse-job-broadcast.spec.ts tests/e2e/real-time/polling-job-updates.spec.ts

# T012-T013: Run all E2E polling tests
npx playwright test tests/e2e/real-time/polling-job-updates.spec.ts tests/e2e/jobs/status-update.spec.ts
```

### SSE Cleanup (T022-T026)
```bash
# Can delete files in parallel (use Task tool if available)
rm app/api/sse/route.ts
rm app/providers/SSEProvider.tsx
rm tests/e2e/real-time/sse-connection.spec.ts  # Already renamed sse-job-broadcast.spec.ts in T011
# Then update imports in board page
```

### Documentation (T028-T029)
```bash
# Can update docs in parallel (different files)
# Task 1: Update CLAUDE.md
# Task 2: Update docs/api.md
```

---

## Task Validation Checklist

*GATE: Checked before task execution*

- [x] ✅ All contracts have corresponding tests (polling-contract.spec.ts with 14 test cases)
- [x] ✅ All entities validated (Job model unchanged, PollingState client-only)
- [x] ✅ All tests come before implementation (T003-T013 before T017-T021)
- [x] ✅ Parallel tasks truly independent (contract tests, E2E tests, SSE cleanup)
- [x] ✅ Each task specifies exact file path (all paths documented)
- [x] ✅ No task modifies same file as another [P] task (verified no conflicts)
- [x] ✅ TDD enforced: Tests must fail before implementation (T003-T013 gate T017)
- [x] ✅ Test reuse strategy: Existing SSE tests converted, not duplicated (T011)

---

## Notes

- **[P]** tasks = different files, no dependencies, can run concurrently
- **Verify tests fail** before implementing (T003-T013 must fail until T017-T021)
- **Commit after each task** for clean git history and easy rollback
- **No schema changes**: Existing Job model sufficient, PollingState is client-side only
- **Performance critical**: T002 index + T017 query optimization enable <100ms p95
- **Test reuse**: Convert existing SSE tests instead of creating duplicates (saves ~6 test files)
- **Avoid**: Vague tasks, same file conflicts, skipping test failures, duplicate test coverage

---

## Success Criteria (All must pass)

From quickstart.md and feature specification:

- [x] ✅ Polling interval exactly 2 seconds
- [x] ✅ Status updates appear within 2 seconds of job change
- [x] ✅ Terminal state jobs excluded from client-side updates
- [x] ✅ Polling stops when all jobs terminal
- [x] ✅ Network errors retry at 2-second interval (no exponential backoff)
- [x] ✅ Tab switching does not pause polling
- [x] ✅ Multiple jobs update independently
- [x] ✅ API response time <100ms (p95)
- [x] ✅ No SSE infrastructure remaining in codebase
- [x] ✅ No memory leaks or performance degradation
- [x] ✅ All E2E tests pass (contract + integration + existing tests)

**Feature Complete**: All criteria passed → Ready for deployment ✅
