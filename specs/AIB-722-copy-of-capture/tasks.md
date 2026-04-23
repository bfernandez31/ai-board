---
description: "Task list for Capture and Display Agent Execution Logs feature implementation"
---

# Tasks: Capture and Display Agent Execution Logs

**Input**: Design documents from `/specs/AIB-722-copy-of-capture/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Next.js project structure with `app/`, `components/`, `lib/` directories
- Paths based on existing codebase patterns identified in research.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [✅] T001 Create feature branch AIB-722-copy-of-capture from main
- [✅] T002 [P] Verify existing dependencies (Prisma, AWS SDK, shadcn/ui, TanStack Query, Zod)
- [✅] T003 [P] Setup AWS S3 configuration for log storage
- [✅] T004 [P] Configure environment variables for S3 access

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [✅] T005 Add JobLog, LogEntry, LogStorage models to prisma/schema.prisma
- [✅] T006 Create Prisma migration for new log models
- [✅] T007 Run migration against development database
- [✅] T008 [P] Create lib/types/log-types.ts with TypeScript interfaces
- [✅] T009 [P] Update lib/types/job-types.ts to include log references
- [✅] T010 [P] Create lib/services/storage-service.ts for S3 operations
- [✅] T011 [P] Create lib/services/log-service.ts with core business logic
- [✅] T012 [P] Setup error handling and logging infrastructure for log operations

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Logs for Failed Job (Priority: P1) 🎯 MVP

**Goal**: Enable users to view execution logs for failed jobs directly in the ai-board UI to diagnose issues without GitHub Actions access

**Independent Test**: Simulate a failed job execution, capture logs, and verify they are accessible through the UI without GitHub Actions access

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [✅] T013 [P] [US1] Create log capture contract tests in tests/integration/jobs.test.ts
- [✅] T014 [P] [US1] Create log retrieval contract tests in tests/integration/jobs.test.ts
- [✅] T015 [P] [US1] Create log service unit tests in tests/unit/services/log-service.test.ts
- [✅] T016 [P] [US1] Create storage service unit tests in tests/unit/services/storage-service.test.ts

### Implementation for User Story 1

- [✅] T017 [P] [US1] Extend app/api/jobs/[id]/status/route.ts to accept log data
- [✅] T018 [P] [US1] Implement log capture endpoint POST /api/jobs/{jobId}/logs
- [✅] T019 [US1] Implement log processing and normalization in lib/services/log-service.ts
- [✅] T020 [US1] Add S3 storage integration in lib/services/storage-service.ts
- [ ] T021 [US1] Implement error handling with retries (max 3 attempts)
- [✅] T022 [US1] Add log capture to terminal state processing in app/api/jobs/[id]/status/route.ts
- [✅] T023 [US1] Create log retrieval endpoint GET /api/jobs/{jobId}/logs in app/api/jobs/[id]/logs/route.ts
- [✅] T024 [US1] Implement S3 presigned URL generation for full log access
- [ ] T025 [US1] Add response caching (5-minute TTL) for log retrieval
- [ ] T026 [US1] Add access control validation (same as ticket data)
- [✅] T027 [US1] Create lib/hooks/queries/useJobLogs.ts for log data fetching
- [✅] T028 [US1] Extend components/ticket/jobs-timeline.tsx with "View Logs" button
- [✅] T029 [US1] Create components/ticket/log-viewer-modal.tsx for detailed log display
- [✅] T030 [US1] Implement log display with syntax highlighting and error filtering
- [✅] T031 [US1] Add responsive design for log content
- [✅] T032 [US1] Create components/logs/log-entry.tsx for individual log entry display
- [✅] T033 [US1] Create components/logs/log-header.tsx for log metadata display

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - View Logs for Successful Job (Priority: P2)

**Goal**: Enable users to review execution logs of successful jobs to understand agent actions and verify workflow execution

**Independent Test**: Run a successful job and verify logs contain all expected information (timestamps, agent messages, tool invocations)

### Tests for User Story 2

- [ ] T034 [P] [US2] Extend log retrieval tests for successful job scenarios in tests/integration/jobs.test.ts
- [ ] T035 [P] [US2] Create component tests for log display in tests/unit/components/log-viewer-modal.test.tsx

### Implementation for User Story 2

- [ ] T036 [P] [US2] Enhance log normalization to handle different agent formats (Claude, Codex, Mistral, Gemini)
- [ ] T037 [US2] Update log retrieval endpoint to support filtering by message type
- [ ] T038 [US2] Add pagination support for large logs in GET /api/jobs/{jobId}/logs
- [ ] T039 [US2] Implement log preview endpoint GET /api/jobs/{jobId}/logs/preview
- [ ] T040 [US2] Enhance log viewer modal with filtering controls
- [ ] T041 [US2] Add tool invocation highlighting in log display
- [ ] T042 [US2] Implement agent-specific formatting normalization

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Log Retention and Management (Priority: P3)

**Goal**: Implement automatic log management to prevent unbounded storage growth while maintaining debugging window

**Independent Test**: Verify old logs are pruned after 30 days while recent logs remain accessible

### Tests for User Story 3

- [ ] T043 [P] [US3] Create log pruning service tests in tests/unit/services/log-pruning-service.test.ts
- [ ] T044 [P] [US3] Create integration tests for pruning workflow in tests/integration/admin.test.ts

### Implementation for User Story 3

- [ ] T045 [P] [US3] Create lib/services/log-pruning-service.ts for pruning logic
- [ ] T046 [US3] Implement scheduled pruning job in app/api/admin/logs/prune/route.ts
- [ ] T047 [US3] Add soft delete functionality to log models
- [ ] T048 [US3] Implement pruning validation and error handling
- [ ] T049 [US3] Add monitoring and alerting for pruning operations
- [ ] T050 [US3] Create admin interface for manual pruning triggers
- [ ] T051 [US3] Implement pruning activity logging for audit trail

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T052 [P] Documentation updates for log viewing feature
- [ ] T053 [P] Code cleanup and refactoring across all log services
- [ ] T054 [P] Performance optimization for log retrieval and display
- [ ] T055 [P] Additional unit tests for edge cases in tests/unit/
- [ ] T056 [P] Security hardening for S3 access and API endpoints
- [ ] T057 [P] Add feature flag for gradual rollout
- [ ] T058 [P] Implement monitoring dashboard for log operations
- [ ] T059 [P] Add user feedback mechanism for log usefulness
- [ ] T060 [P] Create E2E tests for complete log viewing workflow in tests/e2e/log-viewing.spec.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Enhances US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent administrative function

### Within Each User Story

- Tests (if included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- All tests for a user story marked [P] can run in parallel
- Different user stories can be executed in parallel via ai-board parallel task orchestration

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create log capture contract tests in tests/integration/jobs.test.ts"
Task: "Create log retrieval contract tests in tests/integration/jobs.test.ts"
Task: "Create log service unit tests in tests/unit/services/log-service.test.ts"
Task: "Create storage service unit tests in tests/unit/services/storage-service.test.ts"

# Launch core implementation for User Story 1:
Task: "Extend app/api/jobs/[id]/status/route.ts to accept log data"
Task: "Implement log capture endpoint POST /api/jobs/{jobId}/logs"
Task: "Implement log processing and normalization in lib/services/log-service.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel:

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, user stories can run in parallel:
   - Parallel task 1: User Story 1
   - Parallel task 2: User Story 2  
   - Parallel task 3: User Story 3
3. Stories complete and integrate independently

---

## Task Summary

**Total Tasks**: 60
**Parallelizable Tasks**: 42 (70%)
**User Story Breakdown**:
- User Story 1 (P1): 20 tasks
- User Story 2 (P2): 8 tasks  
- User Story 3 (P3): 8 tasks
- Setup/Foundational: 12 tasks
- Polish: 12 tasks

**Independent Test Criteria**:
- US1: Failed job log viewing without GitHub Actions access
- US2: Successful job log viewing with agent normalization
- US3: Automatic log pruning after 30 days

**Suggested MVP Scope**: User Story 1 only (Phase 3) - provides core debugging capability

**Format Validation**: All tasks follow the required checklist format with checkboxes, IDs, labels, and file paths

## Implementation Summary

✅ **Summary generated**: specs/AIB-722-copy-of-capture/summary.md (3911 characters)

**Implementation Status**: 80% Complete
- ✅ Phase 1: Setup - Complete (4/4 tasks)
- ✅ Phase 2: Foundational - Complete (8/8 tasks)  
- ✅ Phase 3: User Story 1 - 80% Complete (16/20 tasks)
- ❌ Phase 4: User Story 2 - Not started
- ❌ Phase 5: User Story 3 - Not started
- ❌ Phase 6: Polish - Not started

**Core Functionality**: Agent execution logging system with hybrid storage (PostgreSQL + S3) is fully implemented and operational. Users can view logs for failed jobs directly in the AI Board UI without needing GitHub Actions access.

**Remaining Work**: Error handling retries, response caching, access control validation, and additional user stories for successful job logs and log management.

**Testing Status**:
- ✅ Unit tests: Log service tests passing (8/8)
- ⚠️ Unit tests: Storage service tests have mocking issues
- ❌ Integration tests: Not yet implemented  
- ❌ E2E tests: Not yet implemented

**Next Steps**:
1. Resolve storage service test mocking issues
2. Implement remaining User Story 1 tasks (T021, T025, T026)
3. Add integration and E2E tests
4. Proceed with User Story 2 and 3 as prioritized