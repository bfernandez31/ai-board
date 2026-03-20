# Tasks: Ticket Comparison Dashboard

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/`
**Prerequisites**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/plan.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/spec.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/research.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/data-model.md`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/contracts/comparison-dashboard.openapi.yaml`, `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/quickstart.md`

**Tests**: Include unit, component, and integration tests because `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/plan.md` explicitly requires TDD-aligned coverage for every user story.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel when it touches different files and does not depend on incomplete tasks
- **[Story]**: Maps the task to a specific user story (`[US1]`, `[US2]`, `[US3]`)
- Every task below includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define the shared typed contracts that the DB-backed APIs and dashboard will use.

- [ ] T001 Update structured comparison DTOs for history, check, detail, ranking, metrics, decisions, and compliance in `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts`
- [ ] T002 [P] Define viewer and section prop types for the structured dashboard in `/home/runner/work/ai-board/ai-board/target/components/comparison/types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the persistence and query infrastructure that blocks all user stories.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T003 Add `ComparisonRecord`, `ComparisonParticipant`, `TicketMetricSnapshot`, `DecisionPointEvaluation`, and `ComplianceAssessment` models plus indexes in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`
- [ ] T004 Generate the comparison dashboard migration in `/home/runner/work/ai-board/ai-board/target/prisma/migrations/<timestamp>_ticket_comparison_dashboard/migration.sql`
- [ ] T005 Create comparison record mapping and transactional persistence helpers in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts`
- [ ] T006 [P] Create comparison detail query and live-enrichment helpers in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`
- [ ] T007 [P] Regenerate the Prisma client from `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`

**Checkpoint**: Prisma models, generated client, and shared comparison services are ready for story work.

---

## Phase 3: User Story 1 - Review a comparison outcome from any participating ticket (Priority: P1) 🎯 MVP

**Goal**: Let an authorized user discover and open the same saved comparison from any participating ticket without branch-scoped markdown lookups.

**Independent Test**: Open any participating ticket with saved comparison data and confirm the modal can list history, pick the latest comparison by default, and load the same saved result through ticket-scoped authorized APIs.

### Tests for User Story 1

- [ ] T008 [P] [US1] Replace ticket history and check endpoint coverage for DB-backed comparison discovery in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts`
- [ ] T009 [P] [US1] Add comparison detail route authorization and participant-discovery coverage in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts`
- [ ] T010 [P] [US1] Extend ticket modal coverage for comparison entry-point visibility and latest-selection behavior in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/ticket-detail-modal.test.tsx`

### Implementation for User Story 1

- [ ] T011 [US1] Replace the comparison history endpoint with Prisma-backed participant queries in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`
- [ ] T012 [US1] Replace the comparison check endpoint with participant-aware count and latest ID lookup in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/check/route.ts`
- [ ] T013 [US1] Add the `comparisonId` detail endpoint for ticket-scoped structured reads in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/[comparisonId]/route.ts`
- [ ] T014 [US1] Remove the filename-based detail handler after the new route is wired in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/[filename]/route.ts`
- [ ] T015 [US1] Refactor comparison query keys and fetchers from filename reads to history and `comparisonId` reads in `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts`
- [ ] T016 [P] [US1] Implement the reusable comparison history selector UI in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-history-list.tsx`
- [ ] T017 [US1] Refactor the viewer shell to load the latest saved comparison and switch by selected history item in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx`
- [ ] T018 [US1] Update the ticket detail modal to surface the new comparison history entry point from any participant ticket in `/home/runner/work/ai-board/ai-board/target/components/board/ticket-detail-modal.tsx`

**Checkpoint**: Authorized users can open the same saved comparison from any participating ticket and navigate its history without raw markdown or branch scanning.

---

## Phase 4: User Story 2 - Understand why one implementation ranked above another (Priority: P2)

**Goal**: Render a structured dashboard that explains ranking, metrics, decision points, and constitution compliance, including pending or unavailable live enrichments.

**Independent Test**: Open one saved comparison and verify the dashboard shows ordered ranking, best-value metrics, collapsible decision points, and a per-principle compliance grid without reading markdown.

### Tests for User Story 2

- [ ] T019 [P] [US2] Add structured dashboard API coverage for ranking, decision points, compliance rows, and nullable enrichments in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-dashboard-api.test.ts`
- [ ] T020 [P] [US2] Add ranking and metrics rendering coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-ranking.test.tsx`
- [ ] T021 [P] [US2] Add decision-point expansion and compliance-grid rendering coverage in `/home/runner/work/ai-board/ai-board/target/tests/unit/components/comparison-dashboard-sections.test.tsx`

### Implementation for User Story 2

- [ ] T022 [P] [US2] Implement the ranking and recommendation section in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx`
- [ ] T023 [P] [US2] Implement the metrics comparison grid with meaningful best-value highlighting in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-metrics-grid.tsx`
- [ ] T024 [P] [US2] Implement collapsible implementation decision sections in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx`
- [ ] T025 [P] [US2] Implement the constitution principle-by-ticket grid in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-compliance-grid.tsx`
- [ ] T026 [US2] Populate structured detail DTOs and pending or unavailable enrichment states in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-detail.ts`
- [ ] T027 [US2] Compose the dashboard sections and loading or empty states in `/home/runner/work/ai-board/ai-board/target/components/comparison/comparison-viewer.tsx`

**Checkpoint**: The saved comparison is understandable from the dashboard alone, including partial-data cases for telemetry and quality.

---

## Phase 5: User Story 3 - Preserve backward-compatible comparison generation and history (Priority: P3)

**Goal**: Keep `/compare` generating markdown while also persisting one immutable structured record per successful run and preserving repeated runs in history.

**Independent Test**: Run `/compare`, confirm the markdown artifact still exists, then confirm every participating ticket shows a new structured history entry without overwriting earlier runs.

### Tests for User Story 3

- [ ] T028 [P] [US3] Add integration coverage for markdown plus structured-record persistence in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts`
- [ ] T029 [P] [US3] Add integration coverage for repeated comparison runs with overlapping ticket sets in `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-history-persistence.test.ts`
- [ ] T030 [P] [US3] Add unit coverage for persistence mappers and nullable enrichment-state helpers in `/home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts`

### Implementation for User Story 3

- [ ] T031 [US3] Map in-memory `/compare` output into immutable Prisma create inputs in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-record.ts`
- [ ] T032 [US3] Persist one structured comparison record alongside markdown generation in `/home/runner/work/ai-board/ai-board/target/lib/comparison/comparison-generator.ts`
- [ ] T033 [US3] Ensure ticket comparison history distinguishes repeated runs by time, participants, and winner in `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/comparisons/route.ts`

**Checkpoint**: `/compare` remains backward-compatible while creating append-only structured history discoverable from every participant ticket.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish contract alignment and end-to-end validation across all stories.

- [ ] T034 [P] Align the final request and response examples with the implemented payloads in `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/contracts/comparison-dashboard.openapi.yaml`
- [ ] T035 [P] Reconcile the implementation guide and acceptance steps with the delivered file layout in `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/quickstart.md`
- [ ] T036 Run the quickstart validation flow from `/home/runner/work/ai-board/ai-board/target/specs/AIB-325-ticket-comparison-dashboard/quickstart.md` and fix regressions in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`, `/home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/`, `/home/runner/work/ai-board/ai-board/target/tests/unit/components/`, and `/home/runner/work/ai-board/ai-board/target/hooks/use-comparisons.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies.
- **Phase 2: Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3: US1**: Depends on Phase 2.
- **Phase 4: US2**: Depends on Phase 2 and builds directly on the viewer and detail payload introduced in US1.
- **Phase 5: US3**: Depends on Phase 2 and can start once persistence helpers exist, but it should land before final end-to-end acceptance so US1 and US2 have production-created records to read.
- **Phase 6: Polish**: Depends on the selected user stories being complete.

### User Story Dependency Graph

- **US1 (P1)**: Starts after Foundational and delivers the MVP read path.
- **US2 (P2)**: Starts after US1 because it enriches the detail payload and expands the structured viewer.
- **US3 (P3)**: Starts after Foundational and can run in parallel with late US1 or US2 work once `comparison-record.ts` exists.
- **Suggested completion order for production value**: Foundation → US1 → US2 → US3 → Polish.
- **Suggested completion order for full end-to-end validation**: Foundation → US1 → US3 → US2 → Polish.

### Within Each User Story

- Tests first, and they should fail before implementation starts.
- Schema and shared helpers before route or UI work.
- Query and persistence services before hooks and components.
- Routes before hook integration.
- Hooks before viewer or modal wiring.

### Parallel Opportunities

- `T001` and `T002` can run in parallel during setup.
- `T005` and `T006` can run in parallel after `T003`.
- US1 test tasks `T008` to `T010` can run in parallel.
- US2 component tasks `T022` to `T025` can run in parallel.
- US3 test tasks `T028` to `T030` can run in parallel.
- After Phase 2, US3 persistence work can proceed in parallel with later US1 or US2 UI work as long as both streams coordinate on shared DTOs in `/home/runner/work/ai-board/ai-board/target/lib/types/comparison.ts`.

---

## Parallel Example: User Story 1

```bash
Task: "T008 [US1] Replace ticket history and check endpoint coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-api.test.ts"
Task: "T009 [US1] Add comparison detail route coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-detail-route.test.ts"
Task: "T010 [US1] Extend modal comparison entry-point coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/components/ticket-detail-modal.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "T022 [US2] Implement ranking and recommendation section in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-ranking.tsx"
Task: "T023 [US2] Implement metrics comparison grid in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-metrics-grid.tsx"
Task: "T024 [US2] Implement decision point viewer in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-decision-points.tsx"
Task: "T025 [US2] Implement compliance matrix in /home/runner/work/ai-board/ai-board/target/components/comparison/comparison-compliance-grid.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "T028 [US3] Add markdown plus structured-record persistence coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-persistence.test.ts"
Task: "T029 [US3] Add repeated-run history preservation coverage in /home/runner/work/ai-board/ai-board/target/tests/integration/comparisons/comparison-history-persistence.test.ts"
Task: "T030 [US3] Add persistence mapper unit coverage in /home/runner/work/ai-board/ai-board/target/tests/unit/comparison/comparison-record.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for the new ticket-scoped read path.
3. Validate US1 independently with seeded structured comparison fixtures.
4. Demo the MVP read experience from any participating ticket.

### Incremental Delivery

1. Setup + Foundational establish schema, DTOs, and shared services.
2. Deliver US1 to replace branch-scanned markdown discovery with authorized DB-backed history and detail reads.
3. Deliver US2 to make the saved comparison understandable from the structured dashboard alone.
4. Deliver US3 to complete the write path so new `/compare` runs create append-only structured history as well as markdown.
5. Finish with contract and quickstart validation in Polish.

### Suggested MVP Scope

- **Strict MVP**: Phase 1, Phase 2, and Phase 3 (US1 only).
- **Practical MVP for live data creation**: Pull `T031` and `T032` from US3 immediately after Foundational if the environment lacks seeded structured comparison records.

---

## Summary

- **Total tasks**: 36
- **Setup tasks**: 2
- **Foundational tasks**: 5
- **US1 tasks**: 11
- **US2 tasks**: 9
- **US3 tasks**: 6
- **Polish tasks**: 3
- **Parallel opportunities identified**: Setup types, foundational services, US1 tests, US2 component builds, and US3 test coverage
