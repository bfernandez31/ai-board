# Quickstart: Health Dashboard Implementation

**Feature**: AIB-375 — Health Dashboard
**Date**: 2026-03-28

## Implementation Order

The recommended implementation order follows dependency chains — each step builds on the previous.

### Step 1: Data Model (Prisma Schema + Migration)

**Add to `prisma/schema.prisma`**:
- `HealthScanType` enum (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC)
- `HealthScanStatus` enum (PENDING, RUNNING, COMPLETED, FAILED)
- `HealthScan` model with indexes (see `data-model.md` for full schema)
- `HealthScore` model with unique projectId constraint
- Add `healthScans` and `healthScore` relations to `Project` model

**Run**: `bunx prisma migrate dev --name add-health-models`

**Verify**: `bunx prisma generate` succeeds and new models appear in Prisma client

### Step 2: Core Library (Types + Score Calculator + Constants)

**Create `lib/health/types.ts`**:
- TypeScript interfaces matching Prisma models
- `ModuleConfig` interface: type, name, icon, isPassive
- API response types matching contracts

**Create `lib/health/constants.ts`**:
- `HEALTH_MODULES` array with 6 module configs (icon mappings, passive flags)
- `CONTRIBUTING_MODULES` subset (excludes QUALITY_GATE, LAST_CLEAN)

**Create `lib/health/score-calculator.ts`**:
- `calculateGlobalScore()` — weighted average with redistribution for missing modules
- Reuse `getScoreThreshold()` and `getScoreColor()` from `lib/quality-score.ts`

### Step 3: Database Queries

**Create `lib/health/queries.ts`**:
- `getHealthScore(projectId)` — fetch or compute cached HealthScore
- `getLatestScans(projectId)` — latest scan per type for module card state
- `getActiveScan(projectId, scanType)` — check for PENDING/RUNNING scan
- `getScanHistory(projectId, opts)` — paginated scan list with optional type filter
- `upsertHealthScore(projectId, scanType, score)` — update cache after scan completion
- `computePassiveModuleScores(projectId)` — derive Quality Gate and Last Clean data from Job model

### Step 4: API Routes

**Create routes matching contracts** (see `contracts/` for full schemas):

1. `app/api/projects/[projectId]/health/route.ts` — GET health score
   - Auth: `verifyProjectAccess(projectId)`
   - Returns global score + all 6 module statuses

2. `app/api/projects/[projectId]/health/scans/route.ts` — GET history + POST trigger
   - GET: Paginated scan list with type filter (Zod validation)
   - POST: Create scan + dispatch workflow (409 if concurrent)

3. `app/api/projects/[projectId]/health/scans/[scanId]/status/route.ts` — PATCH status
   - Auth: Workflow token (Bearer)
   - Validates state transitions
   - On COMPLETED: upsert HealthScore cache

### Step 5: Workflow Dispatch

**Create `lib/workflows/dispatch-health-scan.ts`**:
- Follow `dispatch-ai-board.ts` pattern
- Dispatch `health-scan.yml` with inputs: project_id, scan_type, scan_id, base_commit, head_commit, githubRepository

### Step 6: Sidebar Navigation

**Edit `components/navigation/nav-items.ts`**:
- Add `{ id: 'health', label: 'Health', icon: HeartPulse, href: '/health', group: 'views' }` after Comparisons entry

### Step 7: UI Components

**Create `components/health/health-dashboard.tsx`** (Client Component):
- Main layout: global score card + 6 module cards in 2x3 grid
- Uses `useHealthPolling` hook for data

**Create `components/health/global-score-card.tsx`**:
- Large score display with label and color
- Sub-score badges for 5 contributing modules
- "Last full scan: X days ago" text

**Create `components/health/module-card.tsx`**:
- 4 visual states: never_scanned, scanning, completed, failed
- Active modules: scan button + commit range
- Passive modules: "passive" label, no button

**Create `components/health/scan-action-button.tsx`**:
- Trigger scan on click, disabled + spinner while scanning
- Retry button on failure

### Step 8: Polling Hook

**Create `lib/hooks/useHealthPolling.ts`**:
- TanStack Query `useQuery` wrapping GET `/health` endpoint
- `refetchInterval: 15_000` when any scan is PENDING/RUNNING
- Stops polling when all modules are idle/completed/failed

### Step 9: Page Route

**Create `app/projects/[projectId]/health/page.tsx`** (Server Component):
- Fetch initial health data server-side
- Pass to `HealthDashboard` client component
- Auth check via `verifyProjectAccess`

### Step 10: Tests

Follow testing strategy from plan.md. Implementation order:
1. Unit tests for `score-calculator.ts`
2. Integration tests for all 3 API endpoints
3. Component tests for `module-card.tsx` and `global-score-card.tsx`
4. E2E test for sidebar navigation

## Key Patterns to Follow

| Pattern | Reference File |
|---------|---------------|
| API route structure | `app/api/projects/[projectId]/comparisons/route.ts` |
| Zod validation | `lib/schemas/job-polling.ts` |
| TanStack Query hook | `lib/hooks/useJobPolling.ts` |
| Workflow dispatch | `lib/workflows/dispatch-ai-board.ts` |
| Nav items | `components/navigation/nav-items.ts` |
| Score colors | `lib/quality-score.ts` |
| Aurora theme classes | `app/globals.css` (@layer utilities) |
| Page component | `app/projects/[projectId]/comparisons/page.tsx` |
