# Implementation Plan: Health Dashboard Scan Detail Drawer

**Feature Branch**: `AIB-376-copy-of-health`
**Date**: 2026-03-29
**Status**: Ready for BUILD

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Framework | Next.js 16 (App Router), React 18, TypeScript 5.6 strict |
| UI Library | shadcn/ui Sheet component (Radix Dialog), TailwindCSS 3.4 |
| Data Fetching | TanStack Query v5, existing `useHealthPolling` (2s poll) |
| Existing API | `GET /api/projects/:id/health/scans` (history with pagination) |
| Markdown Rendering | `react-markdown` + `remark-gfm` (already in dependencies) |
| Database | No schema changes — all data from existing HealthScan, HealthScore, Job, Ticket models |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined in `data-model.md`. No `any` types. |
| II. Component-Driven | PASS | Uses shadcn/ui Sheet. Feature folder: `components/health/`. Server Components default, Client Component only for drawer interactivity. |
| III. Test-Driven | PASS | Testing strategy defined below. Integration tests for new API endpoints, component tests for drawer states. |
| IV. Security-First | PASS | All new endpoints use `verifyProjectAccess`. Zod validation on query params. No raw SQL. |
| V. Database Integrity | PASS | No schema changes. Read-only queries only. |
| VI. AI-First | PASS | No README/GUIDE files generated. |

---

## Architecture Overview

```
health-dashboard.tsx (existing, modified)
  ├── HealthModuleCard (existing, modified — add onClick prop)
  └── ScanDetailDrawer (NEW)
        ├── DrawerHeader (module icon, name, score, date, commits)
        ├── DrawerStateHandler (never_scanned | scanning | completed | failed)
        ├── ScanReportContent (markdown renderer for report)
        ├── GeneratedTicketsSection (ticket links)
        └── ScanHistorySection (chronological list)

New API Routes:
  ├── GET /api/projects/:id/health/scans/latest?type=X
  ├── GET /api/projects/:id/health/scans/:scanId (single scan detail)
  └── GET /api/projects/:id/health/scans/:scanId/tickets

New Hooks:
  ├── useScanReport(projectId, moduleType)
  ├── useScanHistory(projectId, moduleType)
  └── useGeneratedTickets(projectId, scanId)
```

---

## Implementation Tasks

### Task 1: API — Single Scan Detail Endpoint

**File**: `app/api/projects/[projectId]/health/scans/[scanId]/route.ts` (NEW)

Create `GET` handler that:
- Validates `projectId` and `scanId` as positive integers
- Calls `verifyProjectAccess(projectId, request)`
- Fetches scan with `prisma.healthScan.findFirst({ where: { id: scanId, projectId } })`
- Returns full scan record including `report` field
- Returns 404 if scan not found

**Estimated complexity**: Low

---

### Task 2: API — Latest Scan Endpoint

**File**: `app/api/projects/[projectId]/health/scans/latest/route.ts` (NEW)

Create `GET` handler that:
- Validates `projectId` and `type` query param (Zod: `z.enum([...HealthScanType])`)
- Calls `verifyProjectAccess(projectId, request)`
- Fetches latest scan: `prisma.healthScan.findFirst({ where: { projectId, scanType }, orderBy: { createdAt: 'desc' } })`
- Returns full scan record or `{ scan: null }`

**Estimated complexity**: Low

---

### Task 3: API — Generated Tickets Endpoint

**File**: `app/api/projects/[projectId]/health/scans/[scanId]/tickets/route.ts` (NEW)

Create `GET` handler that:
- Validates `projectId` and `scanId`
- Calls `verifyProjectAccess(projectId, request)`
- Fetches the scan to get `completedAt` and `scanType`
- Finds the next scan of same type: `prisma.healthScan.findFirst({ where: { projectId, scanType, createdAt: { gt: scan.completedAt } }, orderBy: { createdAt: 'asc' } })`
- Queries tickets: `prisma.ticket.findMany({ where: { projectId, workflowType: 'CLEAN', createdAt: { gte: scan.completedAt, lt: nextScan?.createdAt ?? new Date() } }, select: { id, ticketKey, title, currentStage } })`
- Returns `{ tickets: [...] }`

**Estimated complexity**: Medium (heuristic query logic)

---

### Task 4: Client Hooks

**File**: `app/lib/hooks/useScanReport.ts` (NEW)
**File**: `app/lib/hooks/useScanHistory.ts` (NEW)
**File**: `app/lib/hooks/useGeneratedTickets.ts` (NEW)

**useScanReport**:
- Query key: `queryKeys.health.scanReport(projectId, moduleType)`
- Fetches `GET /api/projects/:id/health/scans/latest?type=X`
- Enabled only when drawer is open and module is an active scan type
- Refetch on `useHealthPolling` data change (scan status transition)

**useScanHistory**:
- Query key: `queryKeys.health.scanHistory(projectId, moduleType)`
- Fetches `GET /api/projects/:id/health/scans?type=X&limit=10`
- Enabled only when drawer is open and module is an active scan type

**useGeneratedTickets**:
- Query key: `['health', 'generatedTickets', projectId, scanId]`
- Fetches `GET /api/projects/:id/health/scans/:scanId/tickets`
- Enabled only when scanId is available (completed scan)

**Query keys update**: Add `scanReport` key to `queryKeys.health` in `app/lib/query-keys.ts`

**Estimated complexity**: Low

---

### Task 5: ScanDetailDrawer Component

**File**: `components/health/scan-detail-drawer.tsx` (NEW)

Top-level drawer component using shadcn/ui `Sheet`:
```
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
    <SheetHeader> ... </SheetHeader>
    {state === 'never_scanned' && <NeverScannedContent />}
    {state === 'scanning' && <ScanningContent />}
    {state === 'completed' && <CompletedContent />}
    {state === 'failed' && <FailedContent />}
  </SheetContent>
</Sheet>
```

**DrawerHeader** (always shown):
- Module icon (from `MODULE_ICONS` map — reuse from `health-module-card.tsx`)
- Module name
- Score badge with color (reuse `getScoreColor`)
- Last scan date
- Commit range (`baseCommit..headCommit`, truncated to 7 chars)

**State: never_scanned**:
- Message: "No scans have been run for this module yet"
- No action button (scan is triggered from the card)

**State: scanning**:
- `Loader2` spinner animation
- "Scan in progress..." text

**State: completed**:
- Markdown report rendered via `react-markdown` with `remark-gfm`
- Generated Tickets section
- Scan History section

**State: failed**:
- Error icon + `errorMessage` display
- Styled with `text-ctp-red`

**Estimated complexity**: Medium-High

---

### Task 6: Scan Report Markdown Renderer

**File**: `components/health/scan-report-content.tsx` (NEW)

Renders the `report` string as markdown:
- Uses `react-markdown` with `remarkGfm` plugin
- Custom component overrides for headings, tables, code blocks to match aurora theme
- Styled with semantic tokens (`text-foreground`, `text-muted-foreground`)
- Handles null/empty report gracefully ("Report data unavailable")

Reference existing pattern: `documentation-viewer.tsx` / `constitution-viewer.tsx`

**Estimated complexity**: Low-Medium

---

### Task 7: Generated Tickets Section

**File**: `components/health/generated-tickets-section.tsx` (NEW)

Displays tickets linked to the current scan:
- Uses `useGeneratedTickets` hook
- Each ticket shows: ticket key badge, title, current stage badge
- Ticket key is a clickable link to `/projects/:projectId/board` (ticket detail)
- Empty state: "No tickets were generated from this scan"
- Loading state: skeleton placeholders

**Estimated complexity**: Low

---

### Task 8: Scan History Section

**File**: `components/health/scan-history-section.tsx` (NEW)

Chronological list of past scans:
- Uses `useScanHistory` hook
- Each entry: date, score badge, issues count, commit range
- Newest-first ordering
- Scrollable within the drawer
- Empty state for modules with only 1 scan

**Estimated complexity**: Low

---

### Task 9: Integrate Drawer into HealthDashboard

**File**: `components/health/health-dashboard.tsx` (MODIFY)
**File**: `components/health/health-module-card.tsx` (MODIFY)

**health-dashboard.tsx changes**:
- Add state: `const [selectedModule, setSelectedModule] = useState<HealthModuleType | null>(null)`
- Compute `drawerOpen = selectedModule !== null`
- Pass `onClick={() => setSelectedModule(type)}` to each `HealthModuleCard`
- Render `<ScanDetailDrawer>` at bottom of component

**health-module-card.tsx changes**:
- Add `onClick?: () => void` prop to `HealthModuleCardProps`
- Add `onClick={onClick}` to root `<div>` with `cursor-pointer` class
- Add `e.stopPropagation()` to `ScanButton`'s onClick handler
- Add hover feedback: already has `aurora-glass-hover`

**Estimated complexity**: Low

---

### Task 10: Passive Module Drawer Content

**File**: `components/health/quality-gate-content.tsx` (NEW)
**File**: `components/health/last-clean-content.tsx` (NEW)

**Quality Gate content**:
- Fetch latest verify job with quality score via new query
- Display dimension breakdown (Compliance, Bug Detection, Code Comments, Historical Context, Spec Sync)
- List recent SHIP tickets with quality scores

**Last Clean content**:
- Fetch cleanup job referenced by `lastCleanJobId`
- Display job status, completion date
- Show summary of cleanup results

**Estimated complexity**: Medium

---

## Testing Strategy

### Integration Tests (Vitest)

| Test | File | Covers |
|------|------|--------|
| GET /health/scans/:scanId | `tests/integration/health/scan-detail.test.ts` | Task 1: returns scan, 404 for missing, auth check |
| GET /health/scans/latest | `tests/integration/health/scan-latest.test.ts` | Task 2: returns latest by type, null when none |
| GET /health/scans/:scanId/tickets | `tests/integration/health/scan-tickets.test.ts` | Task 3: returns linked tickets, empty array, auth check |

### Component Tests (Vitest + RTL)

| Test | File | Covers |
|------|------|--------|
| ScanDetailDrawer states | `tests/unit/components/health/scan-detail-drawer.test.tsx` | Task 5: all 4 states render correctly |
| ScanReportContent | `tests/unit/components/health/scan-report-content.test.tsx` | Task 6: markdown renders, empty state |
| GeneratedTicketsSection | `tests/unit/components/health/generated-tickets-section.test.tsx` | Task 7: tickets display, links, empty state |
| ScanHistorySection | `tests/unit/components/health/scan-history-section.test.tsx` | Task 8: history list, ordering |
| Card click opens drawer | `tests/unit/components/health/health-module-card.test.tsx` | Task 9: click propagation, button isolation |

### E2E Tests (Playwright) — Only if browser-required

| Test | File | Covers |
|------|------|--------|
| Drawer open/close flow | `tests/e2e/health-drawer.spec.ts` | SC-006: all 3 dismissal methods (close button, overlay, Escape) |

**Decision tree rationale**:
- API endpoints → Integration tests (database operations)
- React components with interactions → Component tests (RTL)
- Dismiss behavior (Escape key, overlay click) → E2E (browser keyboard/click events)

---

## Dependency Order

```
Task 1 (scan detail API)     ─┐
Task 2 (latest scan API)      ├── Task 4 (hooks) ── Task 5 (drawer) ── Task 9 (integration)
Task 3 (tickets API)         ─┘                       │
                                                       ├── Task 6 (report renderer)
                                                       ├── Task 7 (tickets section)
                                                       ├── Task 8 (history section)
                                                       └── Task 10 (passive modules)
```

Tasks 1-3 can be built in parallel. Task 4 depends on 1-3. Tasks 5-8 and 10 can be built in parallel after Task 4. Task 9 is the final integration step.

---

## Files Changed Summary

### New Files (11)
- `app/api/projects/[projectId]/health/scans/[scanId]/route.ts`
- `app/api/projects/[projectId]/health/scans/[scanId]/tickets/route.ts`
- `app/api/projects/[projectId]/health/scans/latest/route.ts`
- `app/lib/hooks/useScanReport.ts`
- `app/lib/hooks/useScanHistory.ts`
- `app/lib/hooks/useGeneratedTickets.ts`
- `components/health/scan-detail-drawer.tsx`
- `components/health/scan-report-content.tsx`
- `components/health/generated-tickets-section.tsx`
- `components/health/scan-history-section.tsx`
- `components/health/quality-gate-content.tsx`
- `components/health/last-clean-content.tsx`

### Modified Files (3)
- `components/health/health-dashboard.tsx` — add drawer state + render
- `components/health/health-module-card.tsx` — add onClick prop + stopPropagation
- `app/lib/query-keys.ts` — add scanReport query key

### Test Files (6)
- `tests/integration/health/scan-detail.test.ts`
- `tests/integration/health/scan-latest.test.ts`
- `tests/integration/health/scan-tickets.test.ts`
- `tests/unit/components/health/scan-detail-drawer.test.tsx`
- `tests/unit/components/health/scan-report-content.test.tsx`
- `tests/unit/components/health/generated-tickets-section.test.tsx`
- `tests/unit/components/health/scan-history-section.test.tsx`
- `tests/unit/components/health/health-module-card.test.tsx`
- `tests/e2e/health-drawer.spec.ts`

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Report markdown format varies across scan types | Medium | Render as-is with markdown; each scan workflow controls its own format |
| Ticket-scan heuristic returns incorrect tickets | Low | Bounded by scan completion timestamps; CLEAN workflow type filter reduces false positives |
| Drawer performance with large reports | Low | Sheet component handles overflow scrolling; reports are typically < 500 lines |
| Passive module data unavailable | Low | Graceful empty states for all sections |
