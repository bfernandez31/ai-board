# Quickstart: Health Dashboard — Scan Detail Drawer

**Branch**: `AIB-371-health-dashboard-drawer` | **Date**: 2026-03-29

## What This Feature Does

Adds a right-side slide-over drawer to the Health Dashboard. When a user clicks any module card, the drawer opens showing the full scan report (issues grouped by module type), generated tickets with board links, and paginated scan history.

## Key Implementation Steps

### 1. Define Report Types and Zod Schemas

**File**: `lib/health/types.ts` (extend existing)

Add `ScanReport` discriminated union type and per-module report interfaces (`SecurityReport`, `ComplianceReport`, `TestsReport`, `SpecSyncReport`, `QualityGateReport`, `LastCleanReport`).

**File**: `lib/health/report-schemas.ts` (new)

Add Zod validation schemas matching each report variant. Export a `parseScanReport(scanType, rawJson)` function that returns `ScanReport | null`.

### 2. Extend Scan History API

**File**: `app/api/projects/[projectId]/health/scans/route.ts` (modify GET handler)

Add optional `includeReport=true` query parameter. When set, include the `report` field in scan history responses. Default remains `false`.

### 3. Create Drawer Component

**File**: `components/health/scan-detail-drawer.tsx` (new)

- Uses shadcn/ui `Sheet` component (right side, `sm:max-w-lg` override)
- Controlled open state via `moduleType` prop (non-null = open)
- Sections: Header, Issues (module-specific grouping), Generated Tickets, History

### 4. Create Module-Specific Renderers

**File**: `components/health/drawer/` (new directory)

- `drawer-header.tsx` — Module icon, name, score, scan date, commit range
- `drawer-issues.tsx` — Grouped issue list (dispatcher by module type)
- `drawer-tickets.tsx` — Generated ticket links
- `drawer-history.tsx` — Paginated scan history with "Load more"
- `drawer-states.tsx` — Empty/scanning/failed state displays

### 5. Add Data Fetching Hook

**File**: `app/lib/hooks/useScanReport.ts` (new)

TanStack Query hook fetching latest scan report for a module type. Uses `GET /api/projects/{projectId}/health/scans?type={type}&limit=1&includeReport=true`.

### 6. Integrate Drawer into Dashboard

**File**: `components/health/health-dashboard.tsx` (modify)

- Add `selectedModule` state
- Pass `onClick` to `HealthModuleCard`
- Render `ScanDetailDrawer` with selected module state

**File**: `components/health/health-module-card.tsx` (modify)

- Accept `onClick` prop
- Make card root clickable with cursor-pointer
- `stopPropagation` on scan button to prevent drawer opening

## Testing Approach

| What | Test Type | File |
|------|-----------|------|
| Report JSON parsing | Unit | `tests/unit/health/report-schemas.test.ts` |
| Drawer component states | Component | `tests/unit/components/scan-detail-drawer.test.tsx` |
| Scan history with report field | Integration | `tests/integration/health/scan-history.test.ts` (extend) |
| Module-specific grouping | Component | `tests/unit/components/drawer-issues.test.tsx` |

## Dependencies

- Existing: `@radix-ui/react-dialog` (Sheet), TanStack Query v5, Prisma, Zod
- No new npm packages required
