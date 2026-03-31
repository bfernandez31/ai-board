# AIB-407: Remove Clean Workflow - Tasks

## Phase 1: Enrich COMPLIANCE Scan
- [x] ✅ DONE Update `.claude-plugin/commands/ai-board.health-compliance.md` to include dead code and temp file detection

## Phase 2: Remove Last Clean Passive Module
- [x] ✅ DONE Remove LAST_CLEAN from `lib/health/types.ts`
- [x] ✅ DONE Remove lastCleanReportSchema from `lib/health/report-schemas.ts`
- [x] ✅ DONE Remove lastClean module from `app/api/projects/[projectId]/health/route.ts`
- [x] ✅ DONE Delete `app/api/projects/[projectId]/health/last-clean/` route
- [x] ✅ DONE Delete `lib/health/last-clean.ts`
- [x] ✅ DONE Remove LAST_CLEAN from `components/health/health-dashboard.tsx`
- [x] ✅ DONE Remove LAST_CLEAN from `components/health/health-module-card.tsx`
- [x] ✅ DONE Delete `components/health/drawer/last-clean-drawer.tsx`
- [x] ✅ DONE Remove LAST_CLEAN from `components/health/drawer/drawer-header.tsx`
- [x] ✅ DONE Remove LAST_CLEAN from `components/health/drawer/drawer-issues.tsx`

## Phase 3: Remove Clean Workflow Infrastructure
- [x] ✅ DONE Delete `.github/workflows/cleanup.yml`
- [x] ✅ DONE Delete `.claude-plugin/commands/ai-board.cleanup.md`
- [x] ✅ DONE Delete `app/api/projects/[projectId]/clean/route.ts`
- [x] ✅ DONE Delete `components/cleanup/CleanupInProgressBanner.tsx`
- [x] ✅ DONE Delete `components/cleanup/CleanupConfirmDialog.tsx`
- [x] ✅ DONE Delete `lib/transition-lock.ts`
- [x] ✅ DONE Delete `lib/db/cleanup-analysis.ts`

## Phase 4: Remove Transition Locking from Routes
- [x] ✅ DONE Remove cleanup lock from `app/api/projects/[projectId]/tickets/[id]/transition/route.ts`
- [x] ✅ DONE Remove cleanup lock from `app/api/projects/[projectId]/tickets/[id]/close/route.ts`
- [x] ✅ DONE Remove activeCleanupJobId clearing from `app/api/jobs/[id]/status/route.ts`
- [x] ✅ DONE Remove activeCleanupJobId from `components/board/board.tsx`
- [x] ✅ DONE Remove activeCleanupJobId from `app/projects/[projectId]/board/page.tsx`
- [x] ✅ DONE Remove CLEAN-specific logic from `lib/stage-transitions.ts`

## Phase 5: Database Migration
- [x] ✅ DONE Remove activeCleanupJobId from Project model in `prisma/schema.prisma`
- [x] ✅ DONE Remove lastCleanDate and lastCleanJobId from HealthScore model
- [x] ✅ DONE Create Prisma migration
- [x] ✅ DONE Run `bunx prisma generate`

## Phase 6: Update Tests
- [x] ✅ DONE Delete `tests/integration/cleanup/analysis.test.ts`
- [x] ✅ DONE Delete `tests/e2e/cleanup/cleanup-in-progress-banner.spec.ts`
- [x] ✅ DONE Delete `tests/unit/health/last-clean.test.ts`
- [x] ✅ DONE Delete `tests/unit/components/last-clean-drawer.test.tsx`
- [x] ✅ DONE Delete `tests/integration/health/last-clean-details.test.ts`
- [x] ✅ DONE Update `tests/integration/tickets/close.test.ts` - remove cleanup lock tests
- [x] ✅ DONE Update `tests/integration/health/health-score.test.ts` - remove lastClean module
- [x] ✅ DONE Update `tests/unit/health/ticket-creation.test.ts` - add Dead Code and Temp Files categories
- [x] ✅ DONE Update `tests/unit/components/drawer-issues.test.tsx` - remove LAST_CLEAN
- [x] ✅ DONE Update `tests/unit/health/report-schemas.test.ts` - remove LAST_CLEAN schema
- [x] ✅ DONE Update `tests/unit/components/health-hero.test.tsx` - remove lastClean
- [x] ✅ DONE Update `tests/e2e/quick-impl-visual-feedback.spec.ts` - remove activeCleanupJobId

## Phase 7: Verification
- [x] ✅ DONE Run type-check
- [x] ✅ DONE Run lint
- [x] ✅ DONE Run impacted unit tests
- [x] ✅ DONE Fix pre-existing health-module-card test failures
