# Tasks: Add SKIPPED Status for Health Scans

**Input**: Design documents from `/specs/AIB-535-copy-of-add/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution). Only skip if the user explicitly instructs not to generate tests.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Database Migration)

**Purpose**: Add SKIPPED enum value to the database — prerequisite for all other work

- [ ] T001 Add `SKIPPED` to `HealthScanStatus` enum in `prisma/schema.prisma`
- [ ] T002 Create Prisma migration for SKIPPED enum value (`bunx prisma migrate dev --name add-health-scan-skipped-status`)
- [ ] T003 Regenerate Prisma client (`bunx prisma generate`)

---

## Phase 2: Foundational (Types & Status API)

**Purpose**: Core type changes and status update API — MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Add `skipReason?: string | null` field to `HealthModuleStatus` interface in `lib/health/types.ts`
- [ ] T005 Add `'SKIPPED'` to Zod `statusUpdateSchema` enum in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T006 Add RUNNING→SKIPPED to `VALID_TRANSITIONS` map and add SKIPPED as terminal state (empty transitions) in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T007 Add validation: SKIPPED status must NOT have a score (reject if score provided) in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T008 Skip HealthScore aggregate update when status is SKIPPED and set `completedAt` for SKIPPED in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`
- [ ] T009 Add `skipReason` to the request body Zod schema for SKIPPED status in `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts`

**Checkpoint**: Foundation ready — SKIPPED status accepted by API, types updated. User story implementation can now begin.

---

## Phase 3: User Story 1 — SKIPPED Scan Displays Accurately on Dashboard (Priority: P1) 🎯 MVP

**Goal**: When a scan has nothing to evaluate, the dashboard shows a distinct "Skipped" indicator with reason text and "N/A" score instead of a misleading score of 100.

**Independent Test**: Trigger a health scan for a project with no qualifying PRs and verify the dashboard renders the SKIPPED state correctly with no numeric score.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): Extend existing test files — do not create new ones.**

- [ ] T010 [P] [US1] Extend `tests/integration/health/scan-status.test.ts` with SKIPPED transition tests: RUNNING→SKIPPED valid, PENDING→SKIPPED invalid, SKIPPED requires null score (reject if score provided), SKIPPED sets `completedAt`
- [ ] T011 [P] [US1] Extend `tests/integration/health/scan-status.test.ts` with test: SKIPPED does NOT update HealthScore aggregate (module score preserved from last COMPLETED)
- [ ] T012 [P] [US1] Extend `tests/integration/health/health-score.test.ts` with test: module with latest SKIPPED scan shows `scanStatus: 'SKIPPED'`, `skipReason`, and preserves previous COMPLETED score
- [ ] T013 [P] [US1] Extend `tests/unit/components/health-module-card.test.tsx` with tests: renders "N/A" badge for SKIPPED state, shows skip reason text, shows "Re-run" button

### Implementation for User Story 1

- [ ] T014 [US1] Update `buildModuleStatus` in `app/api/projects/[projectId]/health/route.ts` to detect SKIPPED latest scan and surface `scanStatus: 'SKIPPED'`, `skipReason`, and `summary: "Skipped: {reason}"`
- [ ] T015 [US1] Ensure score remains from HealthScore aggregate (last COMPLETED value) when latest scan is SKIPPED in `app/api/projects/[projectId]/health/route.ts`
- [ ] T016 [US1] Add `'skipped'` to `CardState` type and update `getCardState` to detect SKIPPED status in `components/health/health-module-card.tsx`
- [ ] T017 [US1] Add `ScoreBadge` case for SKIPPED: show "N/A" in muted style in `components/health/health-module-card.tsx`
- [ ] T018 [US1] Display skip reason text below summary and show "Re-run" button for SKIPPED modules in `components/health/health-module-card.tsx`
- [ ] T019 [US1] Update `components/health/health-sub-score-badge.tsx` to handle SKIPPED display (muted "N/A" or dash)
- [ ] T020 [US1] Extend `tests/unit/components/health-hero.test.tsx` with test: sub-score badge handles SKIPPED module display

**Checkpoint**: User Story 1 complete — SKIPPED scans display accurately on dashboard with "N/A" badge, reason text, and preserved last COMPLETED score.

---

## Phase 4: User Story 2 — Global Score and Trends Exclude SKIPPED Scans (Priority: P2)

**Goal**: SKIPPED scans do not inflate global averages or appear as trend data points. The global score only counts modules with COMPLETED scans.

**Independent Test**: Run scans where some types are SKIPPED and verify the global score calculation and trend data exclude them.

### Tests for User Story 2
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US2] Extend `tests/integration/health/health-score.test.ts` with test: global score excludes modules whose most recent scan is SKIPPED (only COMPLETED module scores contribute to average)
- [ ] T022 [P] [US2] Extend `tests/integration/health/health-score.test.ts` with test: when all scans for a project are SKIPPED except COMPLIANCE, only COMPLIANCE score contributes to global score
- [ ] T023 [P] [US2] Extend `tests/integration/health/trends.test.ts` with test: SKIPPED scans are excluded from trend data points (verify existing `status: 'COMPLETED'` filter handles SKIPPED)

### Implementation for User Story 2

- [ ] T024 [US2] Verify `app/api/projects/[projectId]/health/trends/route.ts` already filters by `status: 'COMPLETED'` and confirm SKIPPED scans are naturally excluded (no code change expected — add comment if needed)
- [ ] T025 [US2] Verify global score calculation in `lib/health/score-calculator.ts` already excludes null scores from average (no code change expected per research.md)
- [ ] T026 [US2] If any test from T021-T023 fails: fix the filtering logic in the corresponding route or calculator file

**Checkpoint**: User Stories 1 AND 2 complete — SKIPPED scans correctly excluded from all aggregate metrics and trends.

---

## Phase 5: User Story 3 — Scan Agents Detect Nothing to Evaluate and Exit Early (Priority: P2)

**Goal**: Health scan agents detect "nothing to evaluate" conditions early, write a SKIPPED result, and the workflow propagates the SKIPPED status to the API.

**Independent Test**: Run each affected scan type in an environment with nothing to evaluate and verify the result file contains the SKIPPED indicator and the workflow sends SKIPPED status.

### Tests for User Story 3
**NOTE: Agent commands are markdown instruction files — no unit tests apply. Workflow is YAML — tested via integration tests on the API side (already covered in Phase 2/3 tests). Focus on verifying contract compliance.**

- [ ] T027 [US3] Verify contract compliance: confirm the scan result file schema in `specs/AIB-535-copy-of-add/contracts/scan-result-file.md` matches the `skipped`/`skipReason` fields added to agent commands and workflow parsing

### Implementation for User Story 3

- [ ] T028 [P] [US3] Update `.github/workflows/health-scan.yml`: after reading result file, check `skipped` field with `jq -r '.skipped // false'`
- [ ] T029 [P] [US3] Update `.github/workflows/health-scan.yml`: add defensive guard — if scan type is COMPLIANCE or TESTS, ignore `skipped: true` and treat as COMPLETED
- [ ] T030 [US3] Update `.github/workflows/health-scan.yml`: when `skipped == true` and type is allowed, send SKIPPED status with null score and skipReason to API, skip remediation ticket creation
- [ ] T031 [P] [US3] Update `.claude-plugin/commands/ai-board.health-review-quality.md`: add instruction to check PR count first; if 0 qualifying PRs, write result with `skipped: true, skipReason: "No qualifying PRs since last scan"` and exit early
- [ ] T032 [P] [US3] Update `.claude-plugin/commands/ai-board.health-security.md`: add instruction to check changed files count; if 0 changed files (incremental mode), write result with `skipped: true, skipReason: "No changed files to scan"` and exit early
- [ ] T033 [P] [US3] Update `.claude-plugin/commands/ai-board.health-spec-sync.md`: add instruction to check spec file count; if 0 spec files in `specs/specifications/`, write result with `skipped: true, skipReason: "No spec files found"` and exit early

**Checkpoint**: User Stories 1, 2, AND 3 complete — full end-to-end SKIPPED flow works from agent detection through workflow to API to dashboard.

---

## Phase 6: User Story 4 — Existing Scan History Preserved (Priority: P3)

**Goal**: Past health scan data remains unchanged. The SKIPPED status only applies to new scans going forward.

**Independent Test**: Verify that the database migration adds the new enum value without modifying existing records.

### Tests for User Story 4

- [ ] T034 [US4] Extend `tests/integration/health/scan-status.test.ts` with test: existing COMPLETED scans with score 100 retain their status and score after SKIPPED enum is added (query historical data, confirm no SKIPPED status on old records)

### Implementation for User Story 4

- [ ] T035 [US4] Verify the Prisma migration from T002 uses `ALTER TYPE ADD VALUE` (non-destructive) and does not modify existing rows — confirm in generated migration SQL file

**Checkpoint**: All user stories complete — existing scan history verified as unmodified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories

- [ ] T036 Run `bun run type-check` and fix any TypeScript errors
- [ ] T037 Run `bun run lint` and fix any lint errors
- [ ] T038 Run `bun run test:unit` and verify all unit tests pass (including new SKIPPED tests)
- [ ] T039 Run `bun run test:integration` and verify all integration tests pass (including new SKIPPED tests)
- [ ] T040 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2)
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2); integration tests may depend on US1 API changes
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2); workflow needs API to accept SKIPPED
- **User Story 4 (Phase 6)**: Depends on Setup (Phase 1) migration
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Phase 2 only — no dependency on other stories
- **User Story 2 (P2)**: Depends on Phase 2 — mostly verification that existing filters work; may share health-score.test.ts with US1
- **User Story 3 (P2)**: Depends on Phase 2 — independent of US1/US2 (workflow + agents don't depend on dashboard)
- **User Story 4 (P3)**: Depends on Phase 1 migration — lightweight verification story

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API changes before UI changes
- Core logic before display logic
- Story complete before moving to next priority

### Parallel Opportunities

- T010, T011, T012, T013 (US1 tests) can all run in parallel
- T021, T022, T023 (US2 tests) can all run in parallel
- T028, T029, T031, T032, T033 (US3 workflow + agents) can run in parallel (different files)
- US2 and US3 can start in parallel after Phase 2 completes
- US4 can run in parallel with any other story

---

## Parallel Example: User Story 1

```bash
# Launch all tests for US1 together (different test files):
Task T010: "Extend scan-status.test.ts with SKIPPED transition tests"
Task T012: "Extend health-score.test.ts with SKIPPED module display test"
Task T013: "Extend health-module-card.test.tsx with SKIPPED card state tests"
```

## Parallel Example: User Story 3

```bash
# Launch all agent command updates together (different files):
Task T031: "Update ai-board.health-review-quality.md — early exit for 0 PRs"
Task T032: "Update ai-board.health-security.md — early exit for 0 changed files"
Task T033: "Update ai-board.health-spec-sync.md — early exit for 0 spec files"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (migration)
2. Complete Phase 2: Foundational (types + status API)
3. Complete Phase 3: User Story 1 (health GET API + dashboard UI)
4. **STOP and VALIDATE**: Test US1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently (mostly verification)
4. Add User Story 3 → Test independently → Deploy/Demo (full end-to-end)
5. Add User Story 4 → Verify migration safety
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Complete Setup + Foundational phases sequentially
2. Once Foundational is done, stories can run in parallel:
   - Parallel track A: User Story 1 (dashboard display)
   - Parallel track B: User Story 3 (workflow + agents)
   - Parallel track C: User Story 2 (score verification) + User Story 4 (migration verification)
3. Stories complete and integrate independently
