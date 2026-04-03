# Tasks: Health Scan — Review Quality Analysis

**Input**: Design documents from `/specs/AIB-497-health-scan-review/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — plan.md Phase 5 explicitly defines test requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Schema + Types)

**Purpose**: Prisma migration and TypeScript type definitions — foundational data layer for all stories

- [x] T001 Add `REVIEW_QUALITY` to `HealthScanType` enum and add `reviewQualityScore Int?` + `lastReviewQualityScan DateTime?` to `HealthScore` model in `prisma/schema.prisma`, then run `bunx prisma migrate dev --name add-review-quality-scan-type && bunx prisma generate`
- [x] T002 Add `MissedFinding`, `ReviewGapCategory`, `RecurringPattern`, and `ReviewQualityReport` interfaces to `lib/health/types.ts`; add `REVIEW_QUALITY` to `ACTIVE_SCAN_TYPES`, `ALL_MODULE_TYPES`, and `MODULE_METADATA`; add `ReviewQualityReport` to `ScanReport` union; add `reviewQuality` to `HealthResponse.modules`
- [x] T003 Add `missedFindingSchema`, `recurringPatternSchema`, and `reviewQualityReportSchema` Zod schemas to `lib/health/report-schemas.ts`; add `reviewQualityReportSchema` to the `scanReportSchema` discriminated union

---

## Phase 2: Foundational (Backend Infrastructure)

**Purpose**: Core backend registrations that MUST be complete before any user story work

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Add `REVIEW_QUALITY: 'health-review-quality'` to `SCAN_COMMAND_MAP` in `lib/health/scan-commands.ts`
- [x] T005 [P] Add `reviewQualityScore` to `ModuleScores` interface and include it in the `scores` array for global score calculation in `lib/health/score-calculator.ts`
- [x] T006 [P] Add `reviewQuality` module to the health API response in `app/api/projects/[projectId]/health/route.ts` — read `reviewQualityScore` and `lastReviewQualityScan` from `HealthScore`, query active scans for `REVIEW_QUALITY` type, and generate summary text
- [x] T007 [P] Update score update logic in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` to handle `REVIEW_QUALITY` scan completion — update `HealthScore.reviewQualityScore` and `HealthScore.lastReviewQualityScan`, recalculate `globalScore`

**Checkpoint**: Backend infrastructure ready — user story implementation can now begin in parallel

---

## Phase 3: User Story 1 — Nightly Review Quality Scan Execution (Priority: P1) MVP

**Goal**: The system automatically runs Review Quality scans, collects PR review comments from 3 sources, cross-references them, and stores a scored report.

**Independent Test**: Trigger a scan with known merged PRs that have review comments from multiple sources, verify the report contains correctly identified missed findings with categories and severities.

### Implementation for User Story 1

- [x] T008 [US1] Create Claude command file `.claude-plugin/commands/ai-board.health-review-quality.md` implementing: PR discovery (FULL workflow tickets in SHIP stage), comment collection from 3 sources (ai-board custom `### Code review`, Codex bot, Copilot bot), cross-referencing with 5-line tolerance, filtering (doc/spec staleness, TS/ESLint-catchable), classification into 9 categories, severity assessment, coverage scoring (`max(0, 100 - high*15 - medium*8 - low*3)`), cumulative 30-day analysis, recurring pattern detection (3+ PRs), ticket dedup check, and JSON output to `/tmp/health-scan-result.json`
- [x] T009 [P] [US1] Add `REVIEW_QUALITY` case in scan type routing in `.github/workflows/health-scan.yml` — map to `ai-board.health-review-quality` command (alongside SECURITY/COMPLIANCE/SPEC_SYNC for LLM agent execution)
- [x] T010 [P] [US1] Add `REVIEW_QUALITY` to the scan type loop in `.github/workflows/nightly-health.yml`

**Checkpoint**: Nightly scan execution fully functional — scan can be triggered, runs review quality analysis, and stores results

---

## Phase 4: User Story 2 — Cumulative Pattern Detection and Ticket Creation (Priority: P2)

**Goal**: After each scan, analyze 30 days of reports for recurring patterns and create `[Review Gap]` tickets for unticketed patterns with 3+ occurrences.

**Independent Test**: Seed 3+ scan reports with repeated category patterns, verify `[Review Gap]` ticket is generated with correct title, description, and suggested rule.

### Implementation for User Story 2

- [x] T011 [US2] Add `REVIEW_QUALITY` case to `groupIssuesIntoTickets()` in `lib/health/ticket-creation.ts`; implement `groupReviewQualityIssues()` — one ticket per recurring pattern (not per finding), title `[Review Gap] Add rule for {category}`, description with PR numbers/evidence/suggested rule/target, skip patterns where `alreadyTicketed === true`

**Checkpoint**: Pattern detection and ticket creation operational — recurring review gaps automatically generate improvement tickets

---

## Phase 5: User Story 3 — Dashboard Module Card and Detail Drawer (Priority: P3)

**Goal**: Display Review Quality module on the health dashboard with score, findings count, trend sparkline, and a detail drawer showing findings by category and cumulative patterns.

**Independent Test**: Load health dashboard with a project that has Review Quality scan results, verify card renders score/findings/trend and drawer shows grouped findings and patterns.

### Implementation for User Story 3

- [x] T012 [P] [US3] Add `{ type: 'REVIEW_QUALITY', key: 'reviewQuality' }` to `MODULE_GRID` in `components/health/health-dashboard.tsx`
- [x] T013 [P] [US3] Add `ClipboardCheck` icon import from lucide-react and `REVIEW_QUALITY` case in icon selection in `components/health/health-module-card.tsx`
- [x] T014 [US3] Add `REVIEW_QUALITY` case to drawer issue rendering in `components/health/drawer/drawer-issues.tsx` — render missed findings grouped by category with severity badges, add "Cumulative Patterns" section showing recurring patterns with occurrence count, suggested rule in blockquote, target (constitution vs review prompt), and links to generated tickets; handle "Never scanned" state per `drawer-states.tsx` pattern

**Checkpoint**: Dashboard fully integrated — Review Quality card and detail drawer visible and functional

---

## Phase 6: Testing

**Purpose**: Integration, unit, and component tests validating all user stories

### Integration Tests (US1 + US2)

- [x] T015 [P] Create integration tests in `tests/integration/health/` for Review Quality API endpoints: POST scan creation with `REVIEW_QUALITY`, PATCH status with report updates score and HealthScore, GET health returns `reviewQuality` module, GET scans filters by `REVIEW_QUALITY`, GET trends includes `REVIEW_QUALITY` data points, concurrent scan prevention (409)

### Unit Tests (US2 scoring + tickets)

- [x] T016 [P] Create unit tests in `tests/unit/` for: `calculateGlobalScore` includes `reviewQualityScore` (6-module average), `groupIssuesIntoTickets` for `REVIEW_QUALITY` creates correct ticket format, coverage score formula (100 base, penalties, floor at 0), Zod schema validates/rejects `REVIEW_QUALITY` reports

### Component Tests (US3 dashboard)

- [x] T017 [P] Create component tests in `tests/unit/components/` for: Review Quality card renders score/findings/trend, card shows "Never scanned" with no data, detail drawer shows findings grouped by category, drawer shows cumulative patterns section, scan trigger button works for `REVIEW_QUALITY`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T018 Run `bun run type-check` and `bun run lint` to verify no type or lint errors
- [x] T019 Run quickstart.md validation steps — verify scan trigger, dashboard rendering, and end-to-end flow

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — sequential (T001 → T002 → T003, schema before types before Zod)
- **Phase 2 (Foundational)**: Depends on Phase 1 — T004-T007 can run in parallel
- **Phase 3 (US1)**: Depends on Phase 2 — T008 sequential, T009+T010 parallel
- **Phase 4 (US2)**: Depends on Phase 2 — independent of US1 and US3
- **Phase 5 (US3)**: Depends on Phase 2 — independent of US1 and US2; T012+T013 parallel, T014 after them
- **Phase 6 (Testing)**: Depends on Phases 3-5 — T015, T016, T017 can all run in parallel
- **Phase 7 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1 — Scan Execution)**: Depends on Phase 2 only. No dependencies on other stories.
- **US2 (P2 — Pattern Detection)**: Depends on Phase 2 only. Ticket creation logic is standalone.
- **US3 (P3 — Dashboard UI)**: Depends on Phase 2 only. Card/drawer rendering is independent.

### Parallel Opportunities

- Phase 2: All four tasks (T004-T007) touch different files — full parallel
- Phase 3: T009 + T010 are different workflow files — parallel after T008
- Phase 5: T012 + T013 are different component files — parallel; T014 after both
- Phase 6: All three test tasks (T015-T017) are in different directories — full parallel
- User stories US1, US2, US3 can execute in parallel after Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All four tasks touch different files — launch together:
Task T004: "Add REVIEW_QUALITY to SCAN_COMMAND_MAP in lib/health/scan-commands.ts"
Task T005: "Add reviewQualityScore to score calculator in lib/health/score-calculator.ts"
Task T006: "Add reviewQuality module to health API in app/api/.../health/route.ts"
Task T007: "Update scan status handler in app/api/.../scans/[scanId]/status/route.ts"
```

## Parallel Example: User Stories (after Phase 2)

```bash
# All three user stories can run in parallel:
Parallel task 1: US1 (Phase 3) — Scan execution + workflows
Parallel task 2: US2 (Phase 4) — Ticket creation logic
Parallel task 3: US3 (Phase 5) — Dashboard card + drawer
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Schema + Types
2. Complete Phase 2: Backend Infrastructure
3. Complete Phase 3: US1 — Nightly Scan Execution
4. **STOP and VALIDATE**: Trigger a scan manually, verify report is stored correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add US1 (Phase 3) → Test scan execution → MVP!
3. Add US2 (Phase 4) → Test pattern detection + ticket creation
4. Add US3 (Phase 5) → Test dashboard card + drawer
5. Phase 6 → Run all tests
6. Phase 7 → Final validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- T001 must run first (Prisma migration generates types other tasks depend on)
- T002 before T003 (types.ts interfaces used by report-schemas.ts)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
