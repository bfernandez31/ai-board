# Quickstart: AIB-409 Remove Clean Workflow

**Branch**: `AIB-409-remove-clean-workflow`

## Implementation Order

### Phase 1: Enrich COMPLIANCE Scan Command

1. **Update compliance scan instructions** (`.claude-plugin/commands/ai-board.health-compliance.md`)
   - Add Phase 3.5 — Dead Code Detection after the principle-based scan
   - Instructions: find unused exports, orphaned files; check `git log` last-modified date; skip files modified within 30 days
   - Add Phase 3.6 — Temp File Detection
   - Instructions: detect `docs/troubleshooting/**`, `*SUMMARY*.md`, `*FIX*.md`, `*GUIDE*.md`, `scripts/fix-*.sh`, `scripts/check-*.ts`, `scripts/*-migration*.sh`, `scripts/validate-*.sh`
   - New issues use `category: "Dead Code"` or `category: "Temp Files"`, `severity: "low"`, ID format `comp-dc-NNN` / `comp-tf-NNN`

### Phase 2: Remove Last Clean Passive Module

2. **Update types** (`lib/health/types.ts`)
   - Remove `'LAST_CLEAN'` from `HealthModuleType` union
   - Remove from `ALL_MODULE_TYPES` array (6 → 5 items)
   - Remove from `MODULE_METADATA` record
   - Remove `lastCleanDate`, `stalenessStatus`, `filesCleaned` from `HealthModuleStatus`
   - Remove `lastClean` from `HealthResponse.modules`
   - Remove `LastCleanReport` type and from `ScanReport` union

3. **Update report schemas** (`lib/health/report-schemas.ts`)
   - Remove `lastCleanReportSchema` and from discriminated union

4. **Delete Last Clean drawer** (`components/health/drawer/last-clean-drawer.tsx`)

5. **Update health dashboard** (`components/health/health-dashboard.tsx`)
   - Remove `LAST_CLEAN` from `MODULE_GRID`
   - Remove `LastCleanDrawer` import and rendering

6. **Update module card** (`components/health/health-module-card.tsx`)
   - Remove `LAST_CLEAN` icon, staleness display, `filesCleaned` display

7. **Update drawer components**
   - `components/health/drawer/drawer-header.tsx` — remove `LAST_CLEAN` from `MODULE_ICONS`
   - `components/health/drawer/drawer-issues.tsx` — remove `LAST_CLEAN` case

8. **Update health API** (`app/api/projects/[projectId]/health/route.ts`)
   - Remove `lastClean` module construction
   - Remove `lastCleanDate`/`lastCleanJobId` derivation

9. **Delete last-clean API route** (`app/api/projects/[projectId]/health/last-clean/`)

### Phase 3: Remove Clean Workflow Infrastructure

10. **Delete files**:
    - `.github/workflows/cleanup.yml`
    - `.claude-plugin/commands/ai-board.cleanup.md`
    - `app/api/projects/[projectId]/clean/route.ts`
    - `components/cleanup/CleanupInProgressBanner.tsx`
    - `components/cleanup/CleanupConfirmDialog.tsx`
    - `lib/transition-lock.ts`
    - `lib/db/cleanup-analysis.ts`

11. **Update transition route** (`app/api/projects/[projectId]/tickets/[id]/transition/route.ts`)
    - Remove cleanup lock checking and `clearCleanupLock` import

12. **Update close route** (`app/api/projects/[projectId]/tickets/[id]/close/route.ts`)
    - Remove `isProjectLocked()` check

13. **Update job status route** (`app/api/jobs/[id]/status/route.ts`)
    - Remove `activeCleanupJobId` clearing logic

14. **Update board components**
    - `components/board/board.tsx` — remove `activeCleanupJobId` prop, `CleanupInProgressBanner`
    - `app/projects/[projectId]/board/page.tsx` — remove `activeCleanupJobId` data fetching

15. **Update stage transitions** (`lib/stage-transitions.ts`)
    - Remove CLEAN-specific comments/logic

### Phase 4: Database Migration

16. **Update Prisma schema** (`prisma/schema.prisma`)
    - Remove `activeCleanupJobId Int?` and `@@index([activeCleanupJobId])` from Project
    - Remove `lastCleanDate DateTime?` and `lastCleanJobId Int?` from HealthScore
    - Keep `CLEAN` in `WorkflowType` enum

17. **Create and run migration**
    - `bunx prisma migrate dev --name remove_clean_workflow_fields`
    - `bunx prisma generate`

### Phase 5: Tests

18. **Remove dead tests** — tests for `transition-lock.ts`, `cleanup-analysis.ts`, clean API, last-clean API
19. **Update health tests** — remove `LAST_CLEAN` references from health dashboard/score tests
20. **Add compliance category test** — extend `tests/unit/health/ticket-creation.test.ts` with "Dead Code" and "Temp Files" category grouping

### Phase 6: Verify

21. **Run checks**: `bun run type-check && bun run lint && bun run test:unit`
