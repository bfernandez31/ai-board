# Tasks: Ticket Comparison Dashboard

**Input**: Design documents from `/specs/AIB-324-ticket-comparison-dashboard/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/comparisons-api.md, quickstart.md

**Tests**: Included per plan.md Testing Strategy (integration tests for API, component tests for UI).

**Organization**: Tasks grouped by user story. US2 (Store Data) precedes US1 (View Data) since viewing requires stored data.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database + Validation)

**Purpose**: Prisma schema additions, migration, and Zod validation schemas

- [x] T001 Add Comparison, ComparisonEntry, and ComparisonDecisionPoint models to prisma/schema.prisma per data-model.md (include indexes, unique constraints, cascade deletes)
- [x] T002 Add reverse relations to existing Ticket model (comparisonsAsSource, comparisonEntries) and Project model (comparisons) in prisma/schema.prisma
- [x] T003 Run Prisma migration and generate client (`bunx prisma migrate dev --name add-comparison-models && bunx prisma generate`)
- [x] T004 [P] Create Zod validation schemas (createComparisonSchema, comparisonEntrySchema, comparisonDecisionPointSchema) in lib/schemas/comparison.ts per contracts/comparisons-api.md

**Checkpoint**: `bunx prisma generate` succeeds; Zod schemas export correctly; typed Prisma client includes new models

---

## Phase 2: User Story 2 - Store Comparison Data via API (Priority: P1) 🎯 MVP

**Goal**: Persist structured comparison data in the database via API endpoints, enabling all downstream viewing features

**Independent Test**: Call POST `/api/projects/:projectId/comparisons` with structured data and verify it persists correctly and is retrievable via GET endpoints

### Tests for User Story 2

- [x] T005 [P] [US2] Write integration tests for POST comparison API (save, Zod validation, auth, duplicate entries, business rules) in tests/integration/comparisons/comparison-db-api.test.ts
- [x] T006 [P] [US2] Write integration tests for GET list comparisons API (pagination, filtering, empty state) in tests/integration/comparisons/comparison-db-api.test.ts
- [x] T007 [P] [US2] Write integration tests for auth enforcement (401/403 for unauthorized access) in tests/integration/comparisons/comparison-db-api.test.ts

### Implementation for User Story 2

- [x] T008 [P] [US2] Implement POST handler in app/api/projects/[projectId]/comparisons/route.ts — Bearer token auth, Zod validation, create Comparison with nested entries and decisionPoints via Prisma transaction
- [x] T009 [P] [US2] Implement GET handler in app/api/projects/[projectId]/comparisons/route.ts — session auth, paginated list with entryCount, winnerTicketKey, winnerScore
- [x] T010 [US2] Verify backward compatibility: existing file-based comparison report generation in ai-board.compare command is unchanged

**Checkpoint**: POST saves comparisons with all structured fields; GET lists them with pagination; auth enforced; tests pass

---

## Phase 3: User Story 1 - View Comparison Results from Any Participating Ticket (Priority: P1)

**Goal**: Rich visual comparison dashboard accessible from any participating ticket's detail modal

**Independent Test**: Create a comparison via API, navigate to each participating ticket, verify the Comparisons tab appears and dashboard renders all 4 sections (ranking, metrics, decisions, compliance)

### Tests for User Story 1

- [x] T011 [P] [US1] Write integration tests for GET ticket comparisons DB endpoint (list, bidirectional lookup) in tests/integration/comparisons/comparison-db-api.test.ts
- [x] T012 [P] [US1] Write integration tests for GET ticket comparison check endpoint (hasComparisons boolean/count) in tests/integration/comparisons/comparison-db-api.test.ts
- [x] T013 [P] [US1] Write component tests for ComparisonDashboard, ComparisonRanking (winner highlighted, scores displayed), ComparisonMetrics (charts render, best values highlighted) in tests/unit/components/comparison-dashboard.test.tsx

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement GET handler in app/api/projects/[projectId]/tickets/[id]/comparisons/db/route.ts — list comparisons for a ticket (bidirectional via ComparisonEntry), session auth, paginated
- [x] T015 [P] [US1] Implement GET handler in app/api/projects/[projectId]/tickets/[id]/comparisons/db/check/route.ts — lightweight existence check returning { hasComparisons, count }
- [x] T016 [P] [US1] Add DB-backed TanStack Query hooks to hooks/use-comparisons.ts: useDbComparisonCheck (staleTime: 30s), useDbComparisonList (staleTime: 30s), useComparisonDetail (staleTime: 5m), useSaveComparison (mutation with cache invalidation)
- [x] T017 [P] [US1] Create ComparisonRanking component in components/comparison/comparison-ranking.tsx — cards per ticket with rank, score, agent, workflow type, winner highlight (green border/badge), key differentiators
- [x] T018 [P] [US1] Create ComparisonMetrics component in components/comparison/comparison-metrics.tsx — Recharts horizontal BarChart for lines added/removed, source files, test files, test ratio; best value per metric highlighted using semantic color tokens
- [x] T019 [P] [US1] Create ComparisonDecisions component in components/comparison/comparison-decisions.tsx — collapsible sections per decision point: topic, verdict, per-ticket approach + assessment using shadcn/ui Collapsible
- [x] T020 [P] [US1] Create ComparisonCompliance component in components/comparison/comparison-compliance.tsx — grid/table with rows = principles, columns = tickets; pass/fail badges with notes tooltip
- [x] T021 [P] [US1] Create ComparisonListItem component in components/comparison/comparison-list-item.tsx — clickable item showing date, participant count, winner ticket key, score
- [x] T022 [US1] Create ComparisonDashboard orchestrator in components/comparison/comparison-dashboard.tsx — fetches enriched detail via useComparisonDetail, renders ComparisonRanking, ComparisonMetrics, ComparisonDecisions, ComparisonCompliance sections
- [x] T023 [US1] Extend comparison types in components/comparison/types.ts with DB-backed types (EnrichedComparison, ComparisonListResponse, ComparisonCheckResponse)
- [x] T024 [US1] Integrate Comparisons tab into components/board/ticket-detail-modal.tsx — add useDbComparisonCheck call, extend tab grid to grid-cols-3 md:grid-cols-5 when both hasJobs and hasComparisons, add conditional TabsTrigger with comparison count badge, add TabsContent rendering comparison list → dashboard navigation, add Ctrl/Cmd+5 keyboard shortcut

**Checkpoint**: Comparisons tab appears on tickets with comparisons; clicking a comparison opens the dashboard with ranking, metrics, decisions, and compliance sections; all 4 sections render correctly

---

## Phase 4: User Story 3 - Enriched Comparison View with Aggregated Data (Priority: P2)

**Goal**: Enrich comparison detail API with ticket metadata, telemetry, and quality scores from existing tables; UI handles missing data gracefully

**Independent Test**: Create a comparison where one ticket has quality scores and telemetry and another doesn't, verify the enriched API returns both states and the UI renders "Pending"/"N/A" without layout breakage

### Tests for User Story 3

- [ ] T025 [P] [US3] Write integration tests for GET enriched comparison detail API (ticket metadata joins, telemetry aggregation, quality scores, null handling for missing data) in tests/integration/comparisons/comparison-db-api.test.ts
- [ ] T026 [P] [US3] Write component tests for graceful degradation — "Pending" for missing quality scores, "N/A" for missing telemetry in tests/unit/components/comparison-dashboard.test.tsx

### Implementation for User Story 3

- [ ] T027 [US3] Implement GET handler in app/api/projects/[projectId]/comparisons/[comparisonId]/route.ts — enriched comparison detail: join Ticket table for metadata (title, stage, workflowType, branch), aggregate Job table for telemetry (sum costUsd, durationMs, tokens for COMPLETED jobs), get latest COMPLETED verify Job's qualityScore/qualityScoreDetails; return null for missing telemetry/quality scores
- [ ] T028 [US3] Update ComparisonRanking and ComparisonMetrics components to render "Pending" for null quality scores and "N/A" for null telemetry without layout breakage

**Checkpoint**: Enriched API returns ticket metadata, telemetry, and quality scores; missing data returns null; UI shows appropriate placeholder states

---

## Phase 5: User Story 4 - Multiple Comparisons per Ticket (Priority: P3)

**Goal**: Support tickets participating in multiple comparisons over time, listed by date in the Comparisons tab

**Independent Test**: Save two comparisons that both include the same ticket, verify both appear in that ticket's comparisons list ordered by most recent first

### Tests for User Story 4

- [ ] T029 [P] [US4] Write integration tests for multiple comparisons per ticket (two comparisons with same ticket, ordered by most recent first, correct counts) in tests/integration/comparisons/comparison-db-api.test.ts

### Implementation for User Story 4

- [ ] T030 [US4] Verify GET ticket comparisons endpoint returns all comparisons ordered by createdAt desc and that the check endpoint returns accurate count for tickets in multiple comparisons in app/api/projects/[projectId]/tickets/[id]/comparisons/db/route.ts and check/route.ts
- [ ] T031 [US4] Ensure ComparisonListItem and the Comparisons tab in ticket-detail-modal correctly render a list of multiple comparisons with navigation to each dashboard

**Checkpoint**: Ticket with multiple comparisons shows all of them ordered by most recent first; no Comparisons tab when ticket has zero comparisons

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Command integration and final validation

- [ ] T032 [P] Update ai-board.compare command (.claude-plugin/commands/ai-board.compare.md) to include API call step after markdown generation — structure comparison output data to match createComparisonSchema, POST to /api/projects/:projectId/comparisons with Bearer token
- [ ] T033 [P] Run `bun run type-check` and `bun run lint` — fix all errors across new and modified files
- [ ] T034 Run quickstart.md validation — verify implementation order matches quickstart.md layers and all key files are created/modified as specified

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **US2 (Phase 2)**: Depends on Setup completion — POST/GET APIs are the data foundation
- **US1 (Phase 3)**: Depends on US2 — needs stored data to display; ticket-level endpoints + UI components
- **US3 (Phase 4)**: Depends on US2 — enriched GET detail endpoint builds on basic comparison storage
- **US4 (Phase 5)**: Depends on US1 + US2 — validates multi-comparison scenario across API + UI
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **US2 (P1)**: Can start after Setup — No dependencies on other stories. **This is the MVP data layer.**
- **US1 (P1)**: Depends on US2 for stored data — UI components are independently buildable but integration needs US2 endpoints
- **US3 (P2)**: Depends on US2 for basic comparison records — Adds enrichment on top
- **US4 (P3)**: Depends on US1 + US2 — Validates multi-comparison across existing infrastructure

### Within Each User Story

- Tests written FIRST, ensure they FAIL before implementation
- API endpoints before hooks
- Hooks before UI components
- Individual components before orchestrator (ComparisonDashboard)
- Orchestrator before modal integration

### Parallel Opportunities

- T004 (Zod schemas) can run in parallel with T001-T002 (Prisma schema)
- T005-T007 (US2 tests) can all run in parallel
- T008-T009 (US2 POST + GET) can run in parallel (different handlers in same file)
- T011-T013 (US1 tests) can all run in parallel
- T014-T021 (US1 endpoints, hooks, components) can all run in parallel (different files)
- T025-T026 (US3 tests) can run in parallel
- T032-T033 (Polish tasks) can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together:
Task: "Integration tests for ticket comparisons DB endpoint"
Task: "Integration tests for ticket comparison check endpoint"
Task: "Component tests for ComparisonDashboard and sections"

# Launch all independent components together:
Task: "ComparisonRanking component"
Task: "ComparisonMetrics component"
Task: "ComparisonDecisions component"
Task: "ComparisonCompliance component"
Task: "ComparisonListItem component"
Task: "DB-backed TanStack Query hooks"
Task: "GET ticket comparisons endpoint"
Task: "GET ticket comparison check endpoint"
```

---

## Implementation Strategy

### MVP First (US2 Only)

1. Complete Phase 1: Setup (Prisma + Zod)
2. Complete Phase 2: US2 (POST/GET comparisons API)
3. **STOP and VALIDATE**: API accepts and returns comparison data correctly
4. Data foundation is ready for UI work

### Incremental Delivery

1. Setup → Prisma models + Zod schemas ready
2. US2 → API stores/retrieves comparisons → Test independently (MVP!)
3. US1 → Visual dashboard renders from stored data → Test independently
4. US3 → Enriched view with telemetry/quality → Test independently
5. US4 → Multiple comparisons per ticket → Test independently
6. Polish → Command integration + lint/type-check

### Parallel Execution Strategy

1. Complete Setup phase sequentially (Prisma migration must complete)
2. US2 tasks (tests + implementation) can partially parallelize
3. Once US2 is complete, US1 and US3 can run in parallel:
   - Parallel track A: US1 (UI components + modal integration)
   - Parallel track B: US3 (enriched API endpoint)
4. US4 validates after US1 + US2 are complete
5. Polish phase after all stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
