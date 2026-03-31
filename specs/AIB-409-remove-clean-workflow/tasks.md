# Tasks: Remove Clean Workflow - Merge Cleanup into Health Scan Compliance

**Input**: Design documents from `/specs/AIB-409-remove-clean-workflow/`
**Prerequisites**: spec.md, research.md, data-model.md

**Tests**: Included — Phase 5 covers test cleanup and new compliance category tests.

**Organization**: Tasks grouped by phase for sequential execution (phases are dependent).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Enrich COMPLIANCE Scan (US1, US2)

**Purpose**: Add dead code and temp file detection to the COMPLIANCE scan command

- [ ] T001 [US1] Add dead code detection instructions (unused exports, orphaned files, 30-day age gate via `git log`) to `.claude-plugin/commands/ai-board.health-compliance.md`
- [ ] T002 [US2] Add temp file detection instructions (pattern matching for docs/troubleshooting/**, *SUMMARY*.md, *FIX*.md, *GUIDE*.md, scripts/fix-*.sh, etc.) to `.claude-plugin/commands/ai-board.health-compliance.md`

**Checkpoint**: COMPLIANCE scan command includes dead code + temp file detection instructions

---

## Phase 2: Remove Last Clean Passive Module (US3)

**Purpose**: Remove LAST_CLEAN from types, components, API — dashboard shows 5 modules

- [ ] T003 [P] [US3] Remove `'LAST_CLEAN'` from `HealthModuleType` union, `ALL_MODULE_TYPES`, `MODULE_METADATA`, `LastCleanReport`, `ScanReport` union, `lastClean` from `HealthResponse.modules`, and clean-specific fields from `HealthModuleStatus` in `lib/health/types.ts`
- [ ] T004 [P] [US3] Remove `lastCleanReportSchema` and from `scanReportSchema` discriminated union in `lib/health/report-schemas.ts`
- [ ] T005 [P] [US3] Delete `components/health/drawer/last-clean-drawer.tsx`
- [ ] T006 [US3] Remove `LAST_CLEAN` from `MODULE_GRID`, remove `LastCleanDrawer` import/rendering in `components/health/health-dashboard.tsx`
- [ ] T007 [P] [US3] Remove `LAST_CLEAN` icon mapping, staleness display, `filesCleaned` display in `components/health/health-module-card.tsx`
- [ ] T008 [P] [US3] Remove `LAST_CLEAN` from `MODULE_ICONS` in `components/health/drawer/drawer-header.tsx`
- [ ] T009 [P] [US3] Remove `LAST_CLEAN` case from switch in `components/health/drawer/drawer-issues.tsx`
- [ ] T010 [US3] Remove `lastClean` module construction and `lastCleanDate`/`lastCleanJobId` derivation in `app/api/projects/[projectId]/health/route.ts`
- [ ] T011 [P] [US3] Delete `app/api/projects/[projectId]/health/last-clean/` route directory

**Checkpoint**: Health dashboard compiles and displays 5 modules

---

## Phase 3: Remove Clean Workflow Infrastructure (US4)

**Purpose**: Delete all clean-specific files, remove cleanup references from shared code

- [ ] T012 [P] [US4] Delete `.github/workflows/cleanup.yml`
- [ ] T013 [P] [US4] Delete `.claude-plugin/commands/ai-board.cleanup.md`
- [ ] T014 [P] [US4] Delete `app/api/projects/[projectId]/clean/route.ts` (and parent directory if empty)
- [ ] T015 [P] [US4] Delete `components/cleanup/CleanupInProgressBanner.tsx` and `components/cleanup/CleanupConfirmDialog.tsx` (and parent directory)
- [ ] T016 [P] [US4] Delete `lib/transition-lock.ts`
- [ ] T017 [P] [US4] Delete `lib/db/cleanup-analysis.ts`
- [ ] T018 [US4] Remove cleanup lock checking and `clearCleanupLock` import in `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- [ ] T019 [US4] Remove `isProjectLocked()` check in `app/api/projects/[projectId]/tickets/[id]/close/route.ts`
- [ ] T020 [US4] Remove `activeCleanupJobId` clearing logic in `app/api/jobs/[id]/status/route.ts`
- [ ] T021 [US4] Remove `activeCleanupJobId` prop and `CleanupInProgressBanner` from `components/board/board.tsx`
- [ ] T022 [US4] Remove `activeCleanupJobId` data fetching from `app/projects/[projectId]/board/page.tsx`
- [ ] T023 [US4] Remove CLEAN-specific comments/logic in `lib/stage-transitions.ts`

**Checkpoint**: All cleanup-specific code removed; only CLEAN enum value and historical badge rendering remain

---

## Phase 4: Database Migration (US4)

**Purpose**: Remove dead columns from schema, create Prisma migration

- [ ] T024 [US4] Remove `activeCleanupJobId Int?` and `@@index([activeCleanupJobId])` from Project model in `prisma/schema.prisma`
- [ ] T025 [US4] Remove `lastCleanDate DateTime?` and `lastCleanJobId Int?` from HealthScore model in `prisma/schema.prisma`
- [ ] T026 [US4] Run `bunx prisma migrate dev --name remove_clean_workflow_fields` and `bunx prisma generate`

**Checkpoint**: Schema compiles, migration created

---

## Phase 5: Tests (US1-US5)

**Purpose**: Remove dead tests, add new compliance category tests

- [ ] T027 [P] Remove/update unit tests referencing `transition-lock.ts` or `cleanup-analysis.ts`
- [ ] T028 [P] Remove/update integration tests for `POST /api/projects/:projectId/clean` and `GET /api/projects/:projectId/health/last-clean`
- [ ] T029 [P] Update health dashboard/score calculator tests to remove `LAST_CLEAN` references
- [ ] T030 [US1, US2] Add unit test in `tests/unit/health/ticket-creation.test.ts`: verify `groupComplianceIssues` creates correct tickets for "Dead Code" and "Temp Files" categories
- [ ] T031 [US3] Add/update integration test: health endpoint returns 5 modules without `lastClean`
- [ ] T032 [US5] Verify historical CLEAN ticket rendering is preserved (no code changes needed — just confirm badge/card code still exists)

**Checkpoint**: All tests pass

---

## Phase 6: Final Verification

- [ ] T033 Run `bun run type-check && bun run lint && bun run test:unit` — all must pass
