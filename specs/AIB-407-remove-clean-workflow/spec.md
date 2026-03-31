# Feature Specification: Remove Clean Workflow - Merge Cleanup into Health Scan Compliance

**Feature Branch**: `AIB-407-remove-clean-workflow`
**Created**: 2026-03-31
**Status**: Draft
**Input**: User description: "Remove clean workflow (`cleanup.yml`) — merge dead code and temp file detection into COMPLIANCE health scan, remove Last Clean passive module from health dashboard, remove all clean-specific infrastructure"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: How to implement the 30-day age gate for dead code detection
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on false-positive prevention)
- **Confidence**: High (score: 0.9) - Git file modification timestamps are readily available via `git log`
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using `git log --diff-filter=M --follow --format=%aI -- <file>` provides accurate last-modification dates
  2. Simple threshold avoids complex heuristics; occasional false positives create harmless INBOX tickets
- **Reviewer Notes**: 30-day threshold is deliberately conservative — the cost of a false positive (an ignorable INBOX ticket) is much lower than the cost of missing actual dead code

---

- **Decision**: New compliance issue categories for dead code and temp files
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on existing compliance grouping patterns)
- **Confidence**: High (score: 0.85) - Compliance ticket grouping by `category` field is well-established
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Using `category` field on `ReportIssue` aligns with existing COMPLIANCE ticket creation logic (`groupComplianceIssues` groups by category)
  2. New categories: `"Dead Code"` and `"Temp Files"` — one remediation ticket per category, consistent with principle-based grouping
- **Reviewer Notes**: Existing `groupComplianceIssues` in `lib/health/ticket-creation.ts` already handles arbitrary categories — no grouping logic changes needed

---

- **Decision**: Whether to remove LAST_CLEAN from the `HealthModuleType` union and `ALL_MODULE_TYPES`
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for type safety)
- **Confidence**: High (score: 0.95) - Complete removal is cleanest; no historical data depends on the TypeScript types
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Full removal from types eliminates dead code paths vs. keeping stubs that rot over time
  2. Database fields (`lastCleanDate`, `lastCleanJobId`) require a Prisma migration to drop
- **Reviewer Notes**: The Prisma `HealthScanType` enum does NOT include `LAST_CLEAN` (it's only in the TypeScript union), so no enum migration is needed for the scan type

---

- **Decision**: Whether to keep the CLEAN value in the Prisma `WorkflowType` enum
- **Policy Applied**: AUTO (resolved to CONSERVATIVE for data integrity)
- **Confidence**: High (score: 0.95) - Removing it would break historical ticket queries
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeping `CLEAN` in enum preserves historical data integrity; removing would require data migration
  2. No new CLEAN tickets will be created — only the creation path is removed, not the enum value
- **Reviewer Notes**: Ticket card already shows a purple "Clean" badge for `workflowType === 'CLEAN'` — this display code must remain for historical tickets

---

- **Decision**: How to handle the `activeCleanupJobId` column removal
- **Policy Applied**: AUTO (resolved to PRAGMATIC based on cleanup scope)
- **Confidence**: High (score: 0.9) - The field, its index, and all referencing code should be removed together
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Clean removal via migration avoids leaving dead columns in the database
  2. All referencing code (transition locking, close-ticket blocking, board banner) is removed atomically
- **Reviewer Notes**: The `isProjectLocked()` / `clearCleanupLock()` / `getCleanupLockDetails()` functions in `lib/transition-lock.ts` are exclusively used for cleanup locking — the entire file can be deleted

## User Scenarios & Testing *(mandatory)*

### User Story 1 - COMPLIANCE Scan Detects Dead Code (Priority: P1)

As a project owner, I want the COMPLIANCE health scan to detect unused exports and orphaned files older than 30 days so that dead code is automatically flagged for cleanup without running a separate workflow.

**Why this priority**: Core feature — replaces the primary value proposition of the clean workflow.

**Independent Test**: Trigger a COMPLIANCE scan on a project with known dead code older than 30 days; verify issues appear in the report with `category: "Dead Code"`.

**Acceptance Scenarios**:

1. **Given** a file with an exported function not imported anywhere and last modified 45 days ago, **When** a COMPLIANCE scan runs, **Then** the report includes an issue with `category: "Dead Code"`, `severity: "low"`, and the file path
2. **Given** a file with an exported function not imported anywhere but last modified 10 days ago, **When** a COMPLIANCE scan runs, **Then** the file is NOT reported (30-day age gate)
3. **Given** 3 dead code issues found, **When** the scan completes, **Then** one remediation ticket is created with title `[Compliance] Fix 3 violations - Dead Code`

---

### User Story 2 - COMPLIANCE Scan Detects Temp/Debug Files (Priority: P1)

As a project owner, I want the COMPLIANCE scan to detect leftover debug documentation and one-shot scripts so they don't accumulate in the repository.

**Why this priority**: Core feature — replaces Phase 2.5 of the cleanup command.

**Independent Test**: Create temp files matching known patterns; trigger COMPLIANCE scan; verify detection.

**Acceptance Scenarios**:

1. **Given** a file at `docs/troubleshooting/fix-auth.md`, **When** a COMPLIANCE scan runs, **Then** the report includes an issue with `category: "Temp Files"` and `severity: "low"`
2. **Given** a file matching `scripts/fix-*.sh` pattern, **When** a COMPLIANCE scan runs, **Then** it appears in the "Temp Files" category
3. **Given** 2 temp files found, **When** the scan completes, **Then** one remediation ticket is created with title `[Compliance] Fix 2 violations - Temp Files`

**Temp file patterns to detect**:
- `docs/troubleshooting/**`
- `*SUMMARY*.md`, `*FIX*.md`, `*GUIDE*.md` (case-insensitive, excluding `CLAUDE.md` and spec files)
- `scripts/fix-*.sh`, `scripts/check-*.ts`, `scripts/*-migration*.sh`, `scripts/validate-*.sh`

---

### User Story 3 - Health Dashboard Shows 5 Modules After Last Clean Removal (Priority: P1)

As a user viewing the health dashboard, I want to see 5 health modules (4 active scans + Quality Gate) without the Last Clean module, and the global score should calculate correctly.

**Why this priority**: Direct user-visible change from removing the passive module.

**Independent Test**: Navigate to the health dashboard; verify 5 modules are displayed; verify global score matches the 5-module calculation.

**Acceptance Scenarios**:

1. **Given** the health dashboard, **When** I view the modules, **Then** I see exactly 5 modules: Security, Compliance, Tests, Spec Sync, Quality Gate
2. **Given** modules with scores Security=80, Compliance=90, Tests=70, Spec Sync=85, Quality Gate=75, **When** the global score is calculated, **Then** it equals 80 (average of 5 scores)
3. **Given** the LAST_CLEAN module type, **When** I search the UI code, **Then** no references exist in the dashboard, drawer, or module card components

---

### User Story 4 - Clean Workflow Infrastructure Fully Removed (Priority: P1)

As a developer, I want all clean-specific code removed so the codebase has no dead infrastructure.

**Why this priority**: Core cleanup — leaving dead code defeats the purpose of this ticket.

**Independent Test**: Search codebase for cleanup-specific identifiers; verify all are removed (except `CLEAN` enum value and historical display code).

**Acceptance Scenarios**:

1. **Given** the API routes, **When** I check `app/api/projects/[projectId]/clean/`, **Then** the route directory is deleted
2. **Given** the API routes, **When** I check `app/api/projects/[projectId]/health/last-clean/`, **Then** the route directory is deleted
3. **Given** the workflow files, **When** I check `.github/workflows/cleanup.yml`, **Then** the file is deleted
4. **Given** the Claude commands, **When** I check `.claude-plugin/commands/ai-board.cleanup.md`, **Then** the file is deleted
5. **Given** the components, **When** I check `components/cleanup/`, **Then** the directory is deleted
6. **Given** the health drawer components, **When** I check `components/health/drawer/last-clean-drawer.tsx`, **Then** the file is deleted
7. **Given** the lib files, **When** I check `lib/transition-lock.ts`, **Then** the file is deleted
8. **Given** the lib files, **When** I check `lib/db/cleanup-analysis.ts`, **Then** the file is deleted

---

### User Story 5 - Historical CLEAN Tickets Display Correctly (Priority: P2)

As a user with historical CLEAN workflow tickets on the board, I want those tickets to still display correctly with their purple "Clean" badge.

**Why this priority**: Data integrity for existing tickets — must not regress.

**Independent Test**: View a board with existing CLEAN tickets; verify badge and card render correctly.

**Acceptance Scenarios**:

1. **Given** an existing ticket with `workflowType: 'CLEAN'`, **When** I view the board, **Then** the ticket card shows a purple "Clean" badge with Sparkles icon
2. **Given** a CLEAN ticket in SHIP stage, **When** I open the ticket detail, **Then** all fields display correctly

---

### Edge Cases

- **What happens if the COMPLIANCE scan command hasn't been updated yet?** The scan agent (Claude) must be instructed to include dead code and temp file checks in its analysis. The `health-compliance` command prompt/instructions must be updated.
- **What happens to in-progress CLEAN jobs during deployment?** Any RUNNING cleanup job will complete normally since the workflow file already exists on the runner. The `activeCleanupJobId` field removal must happen AFTER confirming no active cleanup jobs exist — or the migration must gracefully handle non-null values by clearing them.
- **What happens if `activeCleanupJobId` has a value when migration runs?** The migration should set all `activeCleanupJobId` to `null` before dropping the column.

## Technical Specification

### Phase 1: Enrich COMPLIANCE Scan

**Files to modify**:
- `.claude-plugin/commands/health-compliance.md` (or equivalent scan command): Add instructions for dead code detection (unused exports, orphaned files with 30-day age gate) and temp file detection (pattern matching)

**New issue categories in scan reports**:
```typescript
// Dead code issues use category: "Dead Code"
{ id: "dead-code-1", severity: "low", description: "Unused export: functionName", file: "lib/old.ts", line: 42, category: "Dead Code", recommendation: "Remove unused export or delete file if entirely orphaned" }

// Temp file issues use category: "Temp Files"  
{ id: "temp-file-1", severity: "low", description: "Debug documentation file", file: "docs/troubleshooting/fix-auth.md", category: "Temp Files", recommendation: "Delete temporary file" }
```

No changes needed to `ticket-creation.ts` — the existing `groupComplianceIssues` function already groups by `category` and will create separate tickets for "Dead Code" and "Temp Files" automatically.

### Phase 2: Remove Last Clean Passive Module

**Files to modify**:

| File | Change |
|------|--------|
| `lib/health/types.ts` | Remove `'LAST_CLEAN'` from `HealthModuleType` union, `ALL_MODULE_TYPES`, `MODULE_METADATA`. Remove `LastCleanReport` type. Remove from `ScanReport` union. Remove `lastClean` from `HealthResponse.modules`. Remove `lastCleanDate`, `stalenessStatus`, `filesCleaned` from `HealthModuleStatus` |
| `lib/health/report-schemas.ts` | Remove `lastCleanReportSchema` and from `scanReportSchema` discriminated union |
| `lib/health/score-calculator.ts` | No change needed — `LAST_CLEAN` was never included in score calculation (only 5 module scores) |
| `components/health/health-dashboard.tsx` | Remove `LAST_CLEAN` from `MODULE_GRID`. Remove `LastCleanDrawer` import and rendering. Grid goes from 6 to 5 items |
| `components/health/health-module-card.tsx` | Remove `LAST_CLEAN` icon mapping, staleness display logic, `filesCleaned` display |
| `components/health/drawer/last-clean-drawer.tsx` | Delete file |
| `components/health/drawer/drawer-header.tsx` | Remove `LAST_CLEAN` from `MODULE_ICONS` |
| `components/health/drawer/drawer-issues.tsx` | Remove `LAST_CLEAN` case from switch |
| `app/api/projects/[projectId]/health/route.ts` | Remove `lastClean` module construction (lines ~123-204 related to last clean). Remove `lastCleanDate`/`lastCleanJobId` derivation from job query |
| `app/api/projects/[projectId]/health/last-clean/` | Delete route directory |
| `app/lib/hooks/useLastCleanDetails.ts` (if exists) | Delete hook file |

### Phase 3: Remove Clean Workflow Infrastructure

**Files to delete**:

| File/Directory | Purpose |
|----------------|---------|
| `.github/workflows/cleanup.yml` | Workflow definition |
| `.claude-plugin/commands/ai-board.cleanup.md` | Claude cleanup command |
| `app/api/projects/[projectId]/clean/route.ts` | Clean trigger API |
| `components/cleanup/CleanupInProgressBanner.tsx` | Progress banner |
| `components/cleanup/CleanupConfirmDialog.tsx` | Confirmation dialog |
| `lib/transition-lock.ts` | `isProjectLocked()`, `clearCleanupLock()`, `getCleanupLockDetails()` |
| `lib/db/cleanup-analysis.ts` | `getLastCleanupInfo()`, `shouldRunCleanup()`, etc. |

**Files to modify**:

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Remove `activeCleanupJobId Int?` and its index from `Project` model. Remove `lastCleanDate DateTime?` and `lastCleanJobId Int?` from `HealthScore` model. Keep `CLEAN` in `WorkflowType` enum |
| `app/api/projects/[projectId]/tickets/[id]/transition/route.ts` | Remove cleanup lock checking (lines ~92-123). Remove `clearCleanupLock` import and orphaned lock handling |
| `app/api/projects/[projectId]/tickets/[id]/close/route.ts` | Remove `isProjectLocked()` check (lines ~34-44) |
| `app/api/jobs/[id]/status/route.ts` | Remove `activeCleanupJobId` clearing logic (lines ~236-243) |
| `components/board/board.tsx` | Remove `activeCleanupJobId` prop usage, `CleanupInProgressBanner` rendering |
| `app/projects/[projectId]/board/page.tsx` | Remove `activeCleanupJobId` data fetching and passing to Board |
| `lib/stage-transitions.ts` | Remove CLEAN-specific comments/logic (line ~69-71) |
| `components/analytics/workflow-distribution-chart.tsx` | Keep CLEAN in chart (historical data still exists) |
| `components/board/ticket-card.tsx` | Keep CLEAN badge display (historical tickets) |

### Phase 4: Database Migration

```sql
-- Migration: remove_clean_workflow_fields
-- Step 1: Clear any existing cleanup locks
UPDATE "Project" SET "activeCleanupJobId" = NULL WHERE "activeCleanupJobId" IS NOT NULL;

-- Step 2: Drop the column and index
DROP INDEX IF EXISTS "Project_activeCleanupJobId_idx";
ALTER TABLE "Project" DROP COLUMN "activeCleanupJobId";

-- Step 3: Remove Last Clean fields from HealthScore
ALTER TABLE "HealthScore" DROP COLUMN "lastCleanDate";
ALTER TABLE "HealthScore" DROP COLUMN "lastCleanJobId";
```

### Phase 5: Update Tests

**Tests to modify/remove**:
- Any unit tests for `transition-lock.ts` functions
- Any unit tests for `cleanup-analysis.ts` functions
- Any integration tests for `POST /api/projects/:projectId/clean`
- Any integration tests for `GET /api/projects/:projectId/health/last-clean`
- Health dashboard component tests that reference `LAST_CLEAN` module
- Score calculator tests (verify still pass with 5 modules — should already work since `LAST_CLEAN` was never in score calculation)

**Tests to add**:
- Unit test: `groupComplianceIssues` handles `"Dead Code"` and `"Temp Files"` categories (extend existing `ticket-creation.test.ts`)
- Integration test: Health endpoint returns 5 modules (no `lastClean`)
- Verify: Historical CLEAN tickets still render on board

### Implementation Order

1. **Enrich COMPLIANCE scan command** — add dead code + temp file detection instructions
2. **Remove Last Clean passive module** — types, components, API, schemas
3. **Remove clean workflow files** — workflow, command, API route, UI components
4. **Remove transition locking** — `activeCleanupJobId`, `transition-lock.ts`, lock checks in routes
5. **Prisma migration** — drop columns after code changes
6. **Update/remove tests** — clean up test files, add new compliance category tests
7. **Final verification** — `bun run type-check && bun run lint && bun run test:unit`
