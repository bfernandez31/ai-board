# Tasks: Ticket Comparison

**Input**: Design documents from `/specs/AIB-123-ticket-comparison-compare/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/comparison-api.yaml, quickstart.md

**Tests**: Unit and integration tests are included as specified in plan.md (Constitution Check III).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: TypeScript types and project structure for comparison feature

- [x] T001 Create TypeScript interfaces for comparison types in lib/types/comparison.ts
- [x] T002 [P] Create component types in components/comparison/types.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core library functions that ALL user stories depend on - MUST complete before any story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Parsing & Algorithms

- [x] T003 Implement ticket reference parser with regex in lib/comparison/ticket-reference-parser.ts
- [x] T004 [P] Implement similarity algorithms (levenshtein, jaccard, tfidf) in lib/comparison/similarity-algorithms.ts
- [x] T005 [P] Implement spec section parser using remark in lib/comparison/spec-parser.ts

### Unit Tests for Foundational

- [x] T006 [P] Unit tests for ticket reference parser in tests/unit/comparison/ticket-reference-parser.test.ts
- [x] T007 [P] Unit tests for similarity algorithms in tests/unit/comparison/similarity-algorithms.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Compare Variant Implementations (Priority: P1) 🎯 MVP

**Goal**: Enable users to trigger `/compare` command and receive a comparison report with implementation metrics

**Independent Test**: Post `@ai-board /compare #KEY1 #KEY2` comment and verify comparison report is generated with executive summary and implementation metrics

### Unit Tests for User Story 1

- [x] T008 [P] [US1] Unit tests for feature alignment scoring in tests/unit/comparison/feature-alignment.test.ts

### Implementation for User Story 1

- [x] T009 [US1] Implement feature alignment calculator using weighted dimensions in lib/comparison/feature-alignment.ts
- [x] T010 [US1] Implement implementation metrics extraction (git diff analysis) in lib/comparison/implementation-metrics.ts
- [x] T011 [US1] Implement comparison report generator (markdown output) in lib/comparison/comparison-generator.ts
- [x] T012 [US1] Create /compare Claude command in .claude/commands/compare.md

### API Routes for User Story 1

- [x] T013 [US1] Implement GET comparison list endpoint in app/api/projects/[projectId]/tickets/[ticketId]/comparisons/route.ts
- [x] T014 [P] [US1] Implement GET comparison check endpoint in app/api/projects/[projectId]/tickets/[ticketId]/comparisons/check/route.ts
- [x] T015 [US1] Implement GET specific report endpoint in app/api/projects/[projectId]/tickets/[ticketId]/comparisons/[filename]/route.ts

### Integration Tests for User Story 1

- [x] T016 [US1] Integration tests for comparison API endpoints in tests/integration/comparisons/comparison-api.test.ts

### UI Components for User Story 1

- [x] T017 [US1] Implement TanStack Query hooks for comparisons in hooks/use-comparisons.ts
- [x] T018 [US1] Implement comparison viewer component in components/comparison/comparison-viewer.tsx
- [x] T019 [US1] Add "Compare" button to ticket detail modal in components/ticket/ticket-detail-modal.tsx

**Checkpoint**: User Story 1 complete - users can trigger comparisons and view reports with alignment/metrics

---

## Phase 4: User Story 2 - Cost Analysis (Priority: P1)

**Goal**: Include cost/telemetry data in comparison reports

**Independent Test**: Compare tickets with job telemetry and verify cost table shows tokens, USD, duration

### Implementation for User Story 2

- [x] T020 [US2] Implement telemetry extraction from Job model via Prisma in lib/comparison/telemetry-extractor.ts
- [x] T021 [US2] Extend comparison generator to include cost comparison table in lib/comparison/comparison-generator.ts
- [x] T022 [US2] Handle N/A display for tickets without telemetry data in lib/comparison/comparison-generator.ts

### Unit Tests for User Story 2

- [x] T023 [US2] Unit tests for telemetry extraction in tests/unit/comparison/telemetry-extractor.test.ts

**Checkpoint**: User Story 2 complete - cost analysis available in comparison reports

---

## Phase 5: User Story 3 - Constitution Compliance Check (Priority: P2)

**Goal**: Score each ticket against constitution principles and include in comparison

**Independent Test**: Compare tickets and verify compliance section scores against 6 constitution principles

### Unit Tests for User Story 3

- [ ] T024 [P] [US3] Unit tests for constitution scoring in tests/unit/comparison/constitution-scoring.test.ts

### Implementation for User Story 3

- [ ] T025 [US3] Implement constitution compliance scorer in lib/comparison/constitution-scoring.ts
- [ ] T026 [US3] Extend comparison generator to include compliance section in lib/comparison/comparison-generator.ts

**Checkpoint**: User Story 3 complete - constitution compliance visible in reports

---

## Phase 6: User Story 4 - Handle Missing Tickets (Priority: P2)

**Goal**: Gracefully handle edge cases with missing or merged branches

**Independent Test**: Reference non-existent ticket key and verify error handling; reference merged branch and verify analysis from merge commit

### Implementation for User Story 4

- [ ] T027 [US4] Implement three-tier branch resolution strategy in lib/comparison/branch-resolver.ts
- [ ] T028 [US4] Add branch pattern search fallback (git branch -a | grep) in lib/comparison/branch-resolver.ts
- [ ] T029 [US4] Add merge commit analysis fallback (git log --merges) in lib/comparison/branch-resolver.ts
- [ ] T030 [US4] Update comparison generator to handle unavailable status in lib/comparison/comparison-generator.ts
- [ ] T031 [US4] Update /compare command to use branch resolver in .claude/commands/compare.md

**Checkpoint**: User Story 4 complete - robust handling of edge cases

---

## Phase 7: User Story 5 - View Comparison History (Priority: P3)

**Goal**: Enable viewing historical comparison reports for a ticket

**Independent Test**: Create multiple comparisons for a ticket and verify history list shows all with selection

### Implementation for User Story 5

- [ ] T032 [US5] Implement comparison history component in components/comparison/comparison-history.tsx
- [ ] T033 [US5] Add history selection UI to comparison viewer in components/comparison/comparison-viewer.tsx
- [ ] T034 [US5] Implement project-wide comparisons endpoint in app/api/projects/[projectId]/comparisons/route.ts

**Checkpoint**: User Story 5 complete - full comparison history accessible

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Validation and cleanup across all user stories

- [ ] T035 Add input validation with Zod schemas for ticket limits (1-5) in lib/comparison/validation.ts
- [ ] T036 [P] Add error handling for cross-project ticket references in lib/comparison/ticket-reference-parser.ts
- [ ] T037 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational - implements core comparison
- **User Story 2 (Phase 4)**: Depends on User Story 1 (extends generator)
- **User Story 3 (Phase 5)**: Can run parallel to US2 after US1 complete
- **User Story 4 (Phase 6)**: Can run parallel to US2/US3 after US1 complete
- **User Story 5 (Phase 7)**: Depends on US1 API routes
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **User Story 1 (P1)**: Foundation only - core MVP
- **User Story 2 (P1)**: Extends US1's comparison generator
- **User Story 3 (P2)**: Extends US1's comparison generator (parallel to US2)
- **User Story 4 (P2)**: Extends /compare command (parallel to US2/US3)
- **User Story 5 (P3)**: Uses US1's API routes

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models/utilities before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- T001, T002 (Setup): Both can run in parallel
- T003, T004, T005 (Foundation core): T004 and T005 can run parallel after T003
- T006, T007 (Foundation tests): Both can run in parallel
- T013, T014 (US1 API): T014 can run parallel with T013
- After US1 complete: US2, US3, US4 can all proceed in parallel

---

## Parallel Example: Foundational Phase

```bash
# After T003 (parser) completes, launch in parallel:
Task: "Implement similarity algorithms in lib/comparison/similarity-algorithms.ts"
Task: "Implement spec section parser in lib/comparison/spec-parser.ts"
Task: "Unit tests for ticket reference parser in tests/unit/comparison/ticket-reference-parser.test.ts"
```

## Parallel Example: After User Story 1

```bash
# Once US1 is complete, all of these can start in parallel:
Task: "User Story 2 - Cost Analysis"
Task: "User Story 3 - Constitution Compliance"
Task: "User Story 4 - Handle Missing Tickets"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (parser, algorithms)
3. Complete Phase 3: User Story 1 (core comparison)
4. Complete Phase 4: User Story 2 (cost analysis)
5. **STOP and VALIDATE**: Test via `@ai-board /compare` command
6. Deploy/demo - core value delivered

### Incremental Delivery

1. Setup + Foundational → Types and parsing ready
2. Add User Story 1 → Test independently → Comparison reports work (MVP!)
3. Add User Story 2 → Test independently → Cost data visible
4. Add User Story 3 → Test independently → Compliance scores visible
5. Add User Story 4 → Test independently → Edge cases handled
6. Add User Story 5 → Test independently → History browsable
7. Each story adds value without breaking previous stories

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 37 |
| **Setup Tasks** | 2 |
| **Foundational Tasks** | 5 |
| **User Story 1 (P1)** | 12 tasks |
| **User Story 2 (P1)** | 4 tasks |
| **User Story 3 (P2)** | 3 tasks |
| **User Story 4 (P2)** | 5 tasks |
| **User Story 5 (P3)** | 3 tasks |
| **Polish Tasks** | 3 tasks |
| **Parallel Opportunities** | 9 tasks marked [P] |
| **MVP Scope** | Phases 1-4 (User Stories 1+2) |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- No E2E tests required (no browser-specific features per plan.md)
