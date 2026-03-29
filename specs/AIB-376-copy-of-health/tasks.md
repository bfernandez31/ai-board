# Tasks: Health Dashboard Scan Detail Drawer

**Input**: Design documents from `/specs/AIB-376-copy-of-health/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Included per plan.md testing strategy and constitution Test-Driven requirement.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Query key registration and shared type definitions

- [x] T001 Add scanReport, scanDetail, and generatedTickets keys to health namespace in app/lib/query-keys.ts

---

## Phase 2: Foundational (API Endpoints & Hooks)

**Purpose**: Backend endpoints and data-fetching hooks that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Create GET handler for single scan detail in app/api/projects/[projectId]/health/scans/[scanId]/route.ts
- [x] T003 [P] Create GET handler for latest scan by module type in app/api/projects/[projectId]/health/scans/latest/route.ts
- [x] T004 [P] Create GET handler for generated tickets in app/api/projects/[projectId]/health/scans/[scanId]/tickets/route.ts
- [x] T005 [P] Write integration test for scan detail endpoint in tests/integration/health/scan-detail.test.ts
- [x] T006 [P] Write integration test for latest scan endpoint in tests/integration/health/scan-latest.test.ts
- [x] T007 [P] Write integration test for scan tickets endpoint in tests/integration/health/scan-tickets.test.ts
- [x] T008 Create useScanReport hook in app/lib/hooks/useScanReport.ts
- [x] T009 [P] Create useScanHistory hook in app/lib/hooks/useScanHistory.ts
- [x] T010 [P] Create useGeneratedTickets hook in app/lib/hooks/useGeneratedTickets.ts

**Checkpoint**: All API endpoints and hooks are ready — user story implementation can begin

---

## Phase 3: User Story 1 - View Scan Report for a Completed Module (Priority: P1) MVP

**Goal**: Clicking a completed module card opens a drawer showing full scan report with module header, score badge, commit range, and markdown-rendered report content.

**Independent Test**: Click a completed module card → drawer opens with header (icon, name, score, date, commits) and rendered markdown report.

### Tests for User Story 1

- [x] T011 [P] [US1] Write component test for ScanDetailDrawer completed state in tests/unit/components/health/scan-detail-drawer.test.tsx
- [x] T012 [P] [US1] Write component test for ScanReportContent in tests/unit/components/health/scan-report-content.test.tsx

### Implementation for User Story 1

- [x] T013 [P] [US1] Create ScanReportContent markdown renderer in components/health/scan-report-content.tsx
- [x] T014 [US1] Create ScanDetailDrawer component with completed state in components/health/scan-detail-drawer.tsx
- [x] T015 [US1] Add onClick prop to HealthModuleCard with stopPropagation on scan button in components/health/health-module-card.tsx
- [x] T016 [US1] Add selectedModule state and render ScanDetailDrawer in components/health/health-dashboard.tsx
- [x] T017 [US1] Write component test for card click opens drawer in tests/unit/components/health/health-module-card.test.tsx

**Checkpoint**: User Story 1 is fully functional — clicking a completed module card opens a drawer with the scan report

---

## Phase 4: User Story 2 - View Generated Tickets from Scan (Priority: P1)

**Goal**: The drawer displays tickets created from the current scan with ticket key, title, stage badge, and clickable links to the board.

**Independent Test**: Open drawer for a scan that generated tickets → "Generated Tickets" section shows ticket entries with working links.

### Tests for User Story 2

- [x] T018 [P] [US2] Write component test for GeneratedTicketsSection in tests/unit/components/health/generated-tickets-section.test.tsx

### Implementation for User Story 2

- [x] T019 [US2] Create GeneratedTicketsSection component in components/health/generated-tickets-section.tsx
- [x] T020 [US2] Integrate GeneratedTicketsSection into ScanDetailDrawer completed state in components/health/scan-detail-drawer.tsx

**Checkpoint**: User Stories 1 AND 2 both work — drawer shows report and generated tickets

---

## Phase 5: User Story 3 - View Scan History and Score Evolution (Priority: P2)

**Goal**: The drawer shows a chronological list of past scans for the selected module with date, score, issues count, and commit range.

**Independent Test**: Open drawer for a module with multiple past scans → History section shows entries newest-first with correct data.

### Tests for User Story 3

- [x] T021 [P] [US3] Write component test for ScanHistorySection in tests/unit/components/health/scan-history-section.test.tsx

### Implementation for User Story 3

- [x] T022 [US3] Create ScanHistorySection component in components/health/scan-history-section.tsx
- [x] T023 [US3] Integrate ScanHistorySection into ScanDetailDrawer completed state in components/health/scan-detail-drawer.tsx

**Checkpoint**: User Stories 1-3 work — drawer shows report, tickets, and history

---

## Phase 6: User Story 4 - Handle Drawer States for Unscanned and In-Progress Modules (Priority: P2)

**Goal**: The drawer adapts content for never_scanned (invitation message), scanning (progress indicator), and failed (error with details) states.

**Independent Test**: Click module cards in each state (never scanned, scanning, failed) → drawer shows appropriate content per state.

### Tests for User Story 4

- [x] T024 [P] [US4] Write component tests for never_scanned, scanning, and failed states in tests/unit/components/health/scan-detail-drawer.test.tsx

### Implementation for User Story 4

- [x] T025 [US4] Implement never_scanned, scanning, and failed state views in components/health/scan-detail-drawer.tsx
- [x] T026 [US4] Wire real-time scan status updates from useHealthPolling to drawer state transitions in components/health/health-dashboard.tsx

**Checkpoint**: All 4 drawer states render correctly and update in real-time

---

## Phase 7: User Story 5 - Close Drawer (Priority: P3)

**Goal**: Drawer closes via close button, overlay click, or Escape key.

**Independent Test**: Open drawer → close via each of the 3 methods and verify dashboard grid is fully visible.

- [x] T027 [US5] Write E2E test for drawer open/close flow (close button, overlay, Escape) in tests/e2e/health-drawer.spec.ts

**Checkpoint**: All dismissal methods work reliably (SC-006)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Passive module content and final integration

- [x] T028 [P] Create QualityGateContent component for passive Quality Gate module in components/health/quality-gate-content.tsx
- [x] T029 [P] Create LastCleanContent component for passive Last Clean module in components/health/last-clean-content.tsx
- [x] T030 Integrate passive module content into ScanDetailDrawer in components/health/scan-detail-drawer.tsx
- [x] T031 Verify WCAG AA contrast compliance and aurora theme usage across all drawer components
- [x] T032 Run type-check and lint across all new and modified files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (query keys) — BLOCKS all user stories
- **User Stories (Phases 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3): Can start after Foundational — no other story dependencies
  - US2 (Phase 4): Depends on US1 (drawer must exist to add tickets section)
  - US3 (Phase 5): Depends on US1 (drawer must exist to add history section)
  - US4 (Phase 6): Depends on US1 (drawer must exist to add state handling)
  - US5 (Phase 7): Depends on US1 (drawer must exist to test close behavior)
- **Polish (Phase 8)**: Can start after US1; passive modules are independent of US2-5

### Within Each User Story

- Tests written FIRST, verified to FAIL before implementation
- Components before integration
- Integration into drawer after component is complete

### Parallel Opportunities

- T002, T003, T004: All 3 API endpoints in parallel (different files)
- T005, T006, T007: All 3 integration tests in parallel
- T008, T009, T010: Hooks T009 and T010 in parallel after T008 (T008 uses latest endpoint first)
- T011, T012, T013: Tests and ScanReportContent in parallel (different files)
- T028, T029: Both passive module components in parallel
- US3, US4, US5: Can proceed in parallel after US1 is complete (different files/sections)

---

## Parallel Example: User Story 1

```bash
# Launch tests and component in parallel:
Task: "Write component test for ScanDetailDrawer completed state in tests/unit/components/health/scan-detail-drawer.test.tsx"
Task: "Write component test for ScanReportContent in tests/unit/components/health/scan-report-content.test.tsx"
Task: "Create ScanReportContent markdown renderer in components/health/scan-report-content.tsx"

# Then sequentially:
Task: "Create ScanDetailDrawer component" (depends on ScanReportContent)
Task: "Add onClick prop to HealthModuleCard" (independent but needed for integration)
Task: "Integrate drawer into health-dashboard.tsx" (depends on drawer + card click)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (query keys)
2. Complete Phase 2: Foundational (APIs + hooks)
3. Complete Phase 3: User Story 1 (drawer + report)
4. **STOP and VALIDATE**: Click a completed module card, verify drawer shows report
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → APIs and hooks ready
2. Add US1 → Test independently → Deploy (MVP: drawer with scan report)
3. Add US2 → Test independently → Deploy (adds generated tickets)
4. Add US3 → Test independently → Deploy (adds scan history)
5. Add US4 → Test independently → Deploy (adds all state handling)
6. Add US5 → E2E validation → Deploy (confirms close behavior)
7. Polish → Passive modules + accessibility → Final release

### Parallel Execution Strategy

ai-board can execute user stories in parallel after US1:

1. Complete Setup + Foundational + US1 sequentially (US1 creates the drawer container)
2. Once US1 is done, remaining stories can run in parallel:
   - Parallel task 1: User Story 2 (tickets section)
   - Parallel task 2: User Story 3 (history section)
   - Parallel task 3: User Story 4 (state handling)
   - Parallel task 4: User Story 5 (E2E close test)
   - Parallel task 5: Polish (passive modules)
3. Stories integrate into the drawer independently

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No Prisma migrations needed — all data from existing models
- Report rendered as markdown (research decision: no structured JSON parsing)
- Ticket-scan linking uses temporal heuristic (research decision: no new FK)
- Sheet component provides Escape, overlay click, focus trap out of the box
- Passive modules (Quality Gate, Last Clean) source data from Job model, not HealthScan
