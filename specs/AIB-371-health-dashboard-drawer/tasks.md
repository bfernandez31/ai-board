# Tasks: Health Dashboard — Scan Detail Drawer

**Input**: Design documents from `/specs/AIB-371-health-dashboard-drawer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md defines a full testing strategy with unit, component, and integration tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project scaffolding needed. This feature extends existing health dashboard code. Setup creates the foundational types and schemas all stories depend on.

- [x] T001 Add ScanReport discriminated union types (ReportIssue, GeneratedTicket, SecurityReport, ComplianceReport, TestsReport, SpecSyncReport, QualityGateReport, LastCleanReport, ScanReport) to `lib/health/types.ts`
- [x] T002 Create Zod validation schemas and `parseScanReport(scanType, rawJson)` function in `lib/health/report-schemas.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API extension and data fetching hook that ALL drawer stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Extend GET handler in `app/api/projects/[projectId]/health/scans/route.ts` to support optional `includeReport=true` query parameter that includes `report` field in response
- [x] T004 Create `useScanReport` TanStack Query hook in `app/lib/hooks/useScanReport.ts` — fetches latest completed scan with report for a given module type using `GET /api/projects/{projectId}/health/scans?type={type}&limit=1&includeReport=true`

**Checkpoint**: Foundation ready — types, schemas, API, and data fetching in place

---

## Phase 3: User Story 1 — View Scan Report for a Completed Module (Priority: P1) MVP

**Goal**: Click a module card on the Health Dashboard to open a right-side drawer showing module header (icon, name, score, date, commit range), issues list, and generated ticket links.

**Independent Test**: Click a completed module card and verify the drawer opens with correct header, issues, and ticket links.

### Implementation for User Story 1

- [x] T005 [US1] Create main `ScanDetailDrawer` component with shadcn/ui Sheet (right side, `sm:max-w-lg` override), controlled open state via `moduleType` prop, and section layout in `components/health/scan-detail-drawer.tsx`
- [x] T006 [P] [US1] Create `DrawerHeader` component displaying module icon, name, color-coded score badge, last scan date, and commit range in `components/health/drawer/drawer-header.tsx`
- [x] T007 [P] [US1] Create `DrawerTickets` component displaying generated tickets with ticket key, current stage badge, and clickable links to the board in `components/health/drawer/drawer-tickets.tsx`
- [x] T008 [US1] Wire drawer into dashboard: add `selectedModule` state to `components/health/health-dashboard.tsx`, render `ScanDetailDrawer` with selected module state and `onClose` handler
- [x] T009 [US1] Make module cards clickable: add `onClick` prop to `components/health/health-module-card.tsx`, add `cursor-pointer` class on card root, add `stopPropagation` on scan trigger button

**Checkpoint**: User Story 1 complete — clicking a completed module card opens the drawer with header, issues (flat list), and ticket links

---

## Phase 4: User Story 2 — View Module-Specific Grouped Content (Priority: P1)

**Goal**: Each module type displays issues using a tailored grouping strategy: severity for Security, principle for Compliance, fix status for Tests, sync status for Spec Sync, dimension breakdown for Quality Gate, summary for Last Clean.

**Independent Test**: Open the drawer for each module type and verify correct grouping and content structure.

### Implementation for User Story 2

- [x] T010 [US2] Create `DrawerIssues` component with module-type dispatcher and 6 module-specific renderers in `components/health/drawer/drawer-issues.tsx`:
  - Security: group by severity (High -> Medium -> Low) with count per group
  - Compliance: group by `category` (constitution principle)
  - Tests: split into "Auto-fixed" and "Non-fixable" sections
  - Spec Sync: list specs with synced/drifted status and drift detail
  - Quality Gate: dimension name + score breakdown table, recent SHIP tickets
  - Last Clean: summary card with filesCleaned, remainingIssues, summary text

**Checkpoint**: User Story 2 complete — each module type shows correctly grouped content in the drawer

---

## Phase 5: User Story 3 — View Scan History for a Module (Priority: P2)

**Goal**: Display paginated scan history in the drawer showing date, score, issue count, and commit range for past scans, ordered most-recent-first with "Load more" button.

**Independent Test**: Open the drawer for a module with multiple past scans and verify the history list renders with pagination.

### Implementation for User Story 3

- [x] T011 [US3] Create `DrawerHistory` component with cursor-based pagination, "Load more" button, and per-entry display (date, score, issue count, commit range) in `components/health/drawer/drawer-history.tsx`
- [x] T012 [US3] Integrate history section into `ScanDetailDrawer` in `components/health/scan-detail-drawer.tsx` — render `DrawerHistory` below tickets section, pass projectId and moduleType

**Checkpoint**: User Story 3 complete — scan history displays with pagination in the drawer

---

## Phase 6: User Story 4 — Handle Non-Standard Drawer States (Priority: P2)

**Goal**: Display appropriate content for modules that have never been scanned, are currently scanning, or have a failed scan.

**Independent Test**: Open the drawer for modules in each of the four states (never scanned, scanning, completed, failed) and verify correct state-specific content.

### Implementation for User Story 4

- [x] T013 [US4] Create `DrawerStates` component handling four states in `components/health/drawer/drawer-states.tsx`:
  - Never scanned: invitation message + scan trigger button (for active modules)
  - Scanning in progress: animated scanning/progress indicator
  - Failed: error message from `errorMessage` field with relevant context
  - Passive module with no data: explanatory message about passive data collection
- [x] T014 [US4] Integrate state handling into `ScanDetailDrawer` in `components/health/scan-detail-drawer.tsx` — render `DrawerStates` when module is not in COMPLETED status, render full report when COMPLETED

**Checkpoint**: User Story 4 complete — all four module states display appropriate content

---

## Phase 7: Tests

**Purpose**: Unit, component, and integration tests covering all user stories

- [x] T015 [P] Create unit tests for Zod report parsing in `tests/unit/health/report-schemas.test.ts` — test each module variant, malformed JSON fallback, null/empty reports, legacy format handling
- [x] T016 [P] Create component tests for drawer states and interactions in `tests/unit/components/scan-detail-drawer.test.tsx` — test open/close, header rendering, completed state, never_scanned/scanning/failed states, card click vs scan button stopPropagation
- [x] T017 [P] Create component tests for module-specific grouping in `tests/unit/components/drawer-issues.test.tsx` — test all 6 module renderers with mock report data
- [x] T018 Extend existing integration tests for scan history with `includeReport` parameter in `tests/integration/health/scan-history.test.ts`

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, responsiveness, and final validation

- [x] T019 Handle malformed/missing report data gracefully in `components/health/scan-detail-drawer.tsx` — display "Report data unavailable" fallback (FR-012)
- [x] T020 Ensure drawer responsiveness from 375px to 2560px viewport widths (SC-006) and WCAG AA contrast compliance in all drawer components
- [x] T021 Run quickstart.md validation — verify all implementation steps match expected behavior

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (types needed for API and hook)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (needs API + hook)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs drawer shell)
- **User Story 3 (Phase 5)**: Depends on Phase 3 (needs drawer shell)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (needs drawer shell)
- **Tests (Phase 7)**: Can start after Phase 2 for unit tests; after Phase 6 for full component tests
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational — creates the drawer shell all others extend
- **User Story 2 (P1)**: Depends on US1 (needs drawer shell and issues section slot)
- **User Story 3 (P2)**: Depends on US1 (needs drawer shell and history section slot)
- **User Story 4 (P2)**: Depends on US1 (needs drawer shell for state routing)

### Within Each User Story

- Models/types before components
- Components before integration
- Integration wiring last

### Parallel Opportunities

- T001 and T002 are sequential (T002 depends on types from T001)
- T003 and T004 can run in parallel (different files)
- T006 and T007 can run in parallel (different drawer sub-components)
- US3 and US4 can run in parallel after US1 (independent features)
- T015, T016, T017 can all run in parallel (independent test files)

---

## Parallel Example: User Story 1

```bash
# After T005 (drawer shell), launch sub-components in parallel:
Task T006: "Create DrawerHeader in components/health/drawer/drawer-header.tsx"
Task T007: "Create DrawerTickets in components/health/drawer/drawer-tickets.tsx"

# Then wire into dashboard (depends on above):
Task T008: "Wire drawer into health-dashboard.tsx"
Task T009: "Make module cards clickable in health-module-card.tsx"
```

## Parallel Example: Tests

```bash
# All test files can run in parallel:
Task T015: "Unit tests for report-schemas in tests/unit/health/"
Task T016: "Component tests for drawer in tests/unit/components/"
Task T017: "Component tests for drawer-issues in tests/unit/components/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types + schemas)
2. Complete Phase 2: Foundational (API + hook)
3. Complete Phase 3: User Story 1 (drawer shell + header + tickets + dashboard integration)
4. **STOP and VALIDATE**: Click a module card, verify drawer opens with report data
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational -> Foundation ready
2. User Story 1 -> Drawer opens with report -> Deploy/Demo (MVP!)
3. User Story 2 -> Module-specific grouping -> Deploy/Demo
4. User Story 3 + 4 (parallel) -> History + state handling -> Deploy/Demo
5. Tests + Polish -> Full coverage and edge case handling

### Parallel Execution Strategy

1. Complete Setup + Foundational sequentially
2. Complete User Story 1 (drawer shell — required by all others)
3. Once US1 is done, US3 and US4 can run in parallel:
   - Parallel task 1: User Story 3 (history)
   - Parallel task 2: User Story 4 (state handling)
4. User Story 2 can also run in parallel if drawer-issues section is independent

---

## Notes

- No database migrations required — all data from existing `HealthScan` model
- No new npm packages needed — uses existing shadcn/ui Sheet, TanStack Query, Zod
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Semantic color tokens only (no hardcoded hex/rgb)
- Aurora theme classes for drawer styling
