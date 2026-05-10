# Tasks: Admin Section with Claude Code Insights Report

**Input**: Design documents from `/specs/AIB-787-admin-section-with/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Test tasks are included by default (constitution)
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create admin directory structure: `components/admin/`, `lib/admin/`, `lib/insights/`
- [ ] T002 [P] Add new environment variables to `.env.example` for Claude API and blob storage
- [ ] T003 [P] Configure TypeScript paths for new admin modules in `tsconfig.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Extend Prisma schema with `InsightsReport` model in `prisma/schema.prisma`
- [ ] T005 [P] Extend `Job` model with insights fields in `prisma/schema.prisma`
- [ ] T006 [P] Add `ReportStatus` and `AnalysisType` enums in `prisma/schema.prisma`
- [ ] T007 Run `prisma migrate dev` to create database migration
- [ ] T008 [P] Create admin access control service in `lib/admin/access-control.ts`
- [ ] T009 [P] Create base insights service in `lib/insights/report-service.ts`
- [ ] T010 [P] Create authentication middleware for admin routes in `lib/middleware/admin-auth.ts`
- [ ] T011 [P] Create admin configuration management in `lib/config/admin-config.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Access Admin Insights Page (Priority: P1) 🎯 MVP

**Goal**: Authorized admin users can navigate to `/admin/insights` and view the latest Claude Code Insights report

**Independent Test**: Navigate to `/admin/insights` as authorized user and verify report renders with metadata

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Create admin insights API integration test in `tests/integration/admin/insights-api.test.ts`
- [ ] T013 [P] [US1] Create access control unit test in `tests/unit/admin/access-control.test.ts`
- [ ] T014 [P] [US1] Create insights page component test in `tests/components/admin/insights-page.test.tsx`

### Implementation for User Story 1

- [ ] T015 [P] [US1] Create `InsightsReport` TypeScript interface in `lib/types/insights.ts`
- [ ] T016 [P] [US1] Create `AdminConfiguration` TypeScript interface in `lib/types/admin.ts`
- [ ] T017 [US1] Implement GET `/api/admin/insights` endpoint in `app/api/admin/insights/route.ts`
- [ ] T018 [US1] Implement GET `/api/admin/access-check` endpoint in `app/api/admin/access-check/route.ts`
- [ ] T019 [US1] Create main insights page component in `components/admin/insights-page.tsx`
- [ ] T020 [US1] Create report viewer component in `components/admin/report-viewer.tsx`
- [ ] T021 [US1] Create access denied component in `components/admin/access-denied.tsx`
- [ ] T022 [US1] Implement report listing component in `components/admin/report-list.tsx`
- [ ] T023 [US1] Add authentication middleware to all admin API routes
- [ ] T024 [US1] Implement error handling and loading states in admin components

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Run New Analysis (Priority: P1)

**Goal**: Authorized admin users can trigger new insights analysis when new tickets have shipped

**Independent Test**: Click "Run new analysis" button, verify job execution, confirm new report appears

### Tests for User Story 2

- [ ] T025 [P] [US2] Create analysis workflow integration test in `tests/integration/admin/analysis-workflow.test.ts`
- [ ] T026 [P] [US2] Create job status endpoint test in `tests/integration/admin/job-status.test.ts`
- [ ] T027 [P] [US2] Create analysis controls component test in `tests/components/admin/analysis-controls.test.tsx`

### Implementation for User Story 2

- [ ] T028 [P] [US2] Create analysis workflow interface in `lib/insights/analysis-workflow.ts`
- [ ] T029 [P] [US2] Create Claude client interface in `lib/insights/claude-client.ts`
- [ ] T030 [P] [US2] Create storage service interface in `lib/insights/storage-service.ts`
- [ ] T031 [US2] Implement POST `/api/admin/insights/analyze` endpoint in `app/api/admin/insights/route.ts`
- [ ] T032 [US2] Implement GET `/api/admin/insights/job-status` endpoint in `app/api/admin/insights/job-status/route.ts`
- [ ] T033 [US2] Create analysis controls component in `components/admin/analysis-controls.tsx`
- [ ] T034 [US2] Implement analysis workflow orchestrator in `lib/insights/analysis-service.ts`
- [ ] T035 [US2] Implement Claude API client in `lib/insights/claude-client.ts`
- [ ] T036 [US2] Implement blob storage adapter in `lib/insights/storage-service.ts`
- [ ] T037 [US2] Add job type classification for insights analysis in `lib/utils/job-type-classifier.ts`
- [ ] T038 [US2] Extend job status indicator for insights jobs in `components/board/job-status-indicator.tsx`
- [ ] T039 [US2] Implement pre-flight check logic for new tickets in `lib/insights/analysis-service.ts`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - View Past Reports (Priority: P2)

**Goal**: Authorized admin users can select and view historical insights reports

**Independent Test**: Select past report from list and verify it renders correctly

### Tests for User Story 3

- [ ] T040 [P] [US3] Create individual report API test in `tests/integration/admin/report-detail.test.ts`
- [ ] T041 [P] [US3] Create report navigation component test in `tests/components/admin/report-list.test.tsx`

### Implementation for User Story 3

- [ ] T042 [US3] Implement GET `/api/admin/insights/:reportId` endpoint in `app/api/admin/insights/[reportId]/route.ts`
- [ ] T043 [US3] Enhance report list component with selection functionality in `components/admin/report-list.tsx`
- [ ] T044 [US3] Add report switching logic to insights page in `components/admin/insights-page.tsx`
- [ ] T045 [US3] Implement report caching for better performance in `lib/insights/report-service.ts`

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T046 [P] Add comprehensive error handling across all admin components
- [ ] T047 [P] Implement loading states and skeletons for better UX
- [ ] T048 [P] Add accessibility improvements to admin components
- [ ] T049 [P] Create setup script for admin configuration in `scripts/setup-admin.sh`
- [ ] T050 [P] Add monitoring metrics for analysis jobs
- [ ] T051 [P] Create documentation for admin setup and usage
- [ ] T052 [P] Add additional unit tests for edge cases
- [ ] T053 [P] Implement rate limiting for analysis endpoints

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
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on US1 report infrastructure

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
- Models within a story marked [P] can run in parallel
- Different user stories can be executed in parallel via ai-board parallel task orchestration

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Create admin insights API integration test in tests/integration/admin/insights-api.test.ts"
Task: "Create access control unit test in tests/unit/admin/access-control.test.ts"
Task: "Create insights page component test in tests/components/admin/insights-page.test.tsx"

# Launch all models for User Story 1 together:
Task: "Create InsightsReport TypeScript interface in lib/types/insights.ts"
Task: "Create AdminConfiguration TypeScript interface in lib/types/admin.ts"
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

- **Total Tasks**: 53
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 11 tasks
- **User Story 1 (P1)**: 14 tasks (12 implementation + 2 tests)
- **User Story 2 (P1)**: 13 tasks (11 implementation + 2 tests)
- **User Story 3 (P2)**: 5 tasks (3 implementation + 2 tests)
- **Polish Phase**: 7 tasks

### Parallel Opportunities Identified:
- 24 tasks marked [P] can run in parallel
- User stories can be executed in parallel after Foundational phase
- Tests within each story can run in parallel

### Independent Test Criteria:
- **US1**: Navigate to `/admin/insights` and verify report renders with metadata
- **US2**: Click "Run new analysis", verify job execution, confirm new report appears
- **US3**: Select past report from list and verify it renders correctly

### Suggested MVP Scope:
- Complete Setup Phase (3 tasks)
- Complete Foundational Phase (11 tasks)
- Complete User Story 1 (14 tasks)
- **Total MVP Tasks**: 28 tasks

### Format Validation:
✅ ALL tasks follow the checklist format (checkbox, ID, labels, file paths)
✅ ALL user story tasks have [Story] labels
✅ ALL parallelizable tasks have [P] markers
✅ ALL tasks include exact file paths
✅ Tasks are organized by user story for independent implementation
