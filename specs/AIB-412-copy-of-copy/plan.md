# Implementation Plan: Health Scan Metrics - Trend Lines, Sparklines and History Enrichment

**Feature Branch**: `AIB-412-copy-of-copy`
**Created**: 2026-03-31
**Status**: Ready for Implementation

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Database** | No schema changes. `HealthScan` already has `tokensUsed`, `costUsd`, `durationMs` fields. |
| **API** | 1 new endpoint (trends), 1 updated endpoint (scan history select clause) |
| **Components** | 1 new shared component (ScoreTrendChart), 1 new component (Sparkline), modifications to 3 existing components |
| **Hooks** | 1 new hook (useHealthTrends) |
| **Types** | 2 new types (TrendDataPoint, ModuleTrends), 2 fields added to ScanHistoryItem |
| **Dependencies** | All already present: Recharts 3.8.1, TanStack Query v5, lucide-react, shadcn/ui Tooltip |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new types explicitly defined; no `any` usage |
| II. Component-Driven | PASS | New components follow shadcn/ui patterns; feature folder structure maintained |
| III. Test-Driven | PASS | Testing strategy below covers all layers per decision tree |
| IV. Security-First | PASS | Uses `verifyProjectAccess()` on new endpoint; Prisma parameterized queries only |
| V. Database Integrity | PASS | No schema changes; read-only queries against existing data |
| V. Spec Clarification | PASS | All auto-resolved decisions documented in spec with CONSERVATIVE fallback |

## Implementation Phases

### Phase 1: API Layer (Backend)

#### Task 1.1: Add `tokensUsed` and `costUsd` to scan history endpoint
- **File**: `app/api/projects/[projectId]/health/scans/route.ts`
- **Change**: Add `tokensUsed: true` and `costUsd: true` to the Prisma `select` clause in the GET handler (lines 159-175)
- **Effort**: Minimal (2 lines)
- **FR**: FR-004

#### Task 1.2: Update `ScanHistoryItem` type
- **File**: `lib/health/types.ts`
- **Change**: Add `tokensUsed: number | null` and `costUsd: number | null` to the `ScanHistoryItem` interface
- **Effort**: Minimal (2 lines)
- **FR**: FR-004

#### Task 1.3: Create health trends endpoint
- **File**: `app/api/projects/[projectId]/health/trends/route.ts` (new)
- **Change**: New GET endpoint that queries last N COMPLETED scans with non-null scores per active scan type, returning `{ trends: Record<ScanType, { date, score }[]> }`
- **Implementation**:
  - Validate projectId and verify access via `verifyProjectAccess()`
  - Parse optional `limit` query param (default 20, Zod validation 1-100)
  - Run 4 parallel Prisma queries (one per ACTIVE_SCAN_TYPE) using `Promise.all`
  - Each query: `findMany` with `where: { projectId, scanType, status: 'COMPLETED', score: { not: null } }`, `orderBy: { createdAt: 'desc' }`, `take: limit`, `select: { completedAt, score }`
  - Map results to `{ date: completedAt.toISOString(), score }` per type
  - Return `{ trends }` with standard error handling
- **Effort**: Medium (~50 lines)
- **FR**: FR-008, FR-010
- **Contract**: See `contracts/health-trends-api.md`

#### Task 1.4: Add query key for trends
- **File**: `app/lib/query-keys.ts`
- **Change**: Add `trends: (projectId: number) => ['health', projectId, 'trends'] as const` to the `health` section
- **Effort**: Minimal (1 line)

### Phase 2: Hooks & Types (Client Data Layer)

#### Task 2.1: Create `useHealthTrends` hook
- **File**: `app/lib/hooks/useHealthTrends.ts` (new)
- **Change**: TanStack Query hook fetching `GET /api/projects/{projectId}/health/trends`
- **Implementation**:
  - Query key: `queryKeys.health.trends(projectId)`
  - `staleTime: 60_000` (1 min), `gcTime: 5 * 60_000` (5 min)
  - No polling — fetched once on mount, refetched on query invalidation
  - Return typed `ModuleTrends` response
- **Effort**: Small (~25 lines)
- **FR**: FR-009

#### Task 2.2: Add trend types to health types
- **File**: `lib/health/types.ts`
- **Change**: Add `TrendDataPoint` and `ModuleTrends` interfaces
- **Effort**: Minimal (~10 lines)

### Phase 3: Shared UI Components

#### Task 3.1: Extract `ScoreTrendChart` from Quality Gate drawer
- **File**: `components/health/drawer/score-trend-chart.tsx` (new)
- **Change**: Extract the Recharts AreaChart from `quality-gate-drawer.tsx` (lines 136-165) into a reusable component
- **Props**: `data: { date: string; score: number }[]`
- **Renders**: `ResponsiveContainer` > `AreaChart` with CartesianGrid, XAxis (date), YAxis (0-100), Tooltip, Area (primary color, monotone)
- **Effort**: Small (~40 lines)
- **FR**: FR-007

#### Task 3.2: Refactor Quality Gate drawer to use `ScoreTrendChart`
- **File**: `components/health/drawer/quality-gate-drawer.tsx`
- **Change**: Replace inline AreaChart JSX (lines 136-165) with `<ScoreTrendChart data={data.trendData} />`
- **Effort**: Minimal (net reduction in lines)

#### Task 3.3: Create `Sparkline` component
- **File**: `components/health/sparkline.tsx` (new)
- **Change**: Minimal line chart using Recharts for module cards
- **Props**: `data: { date: string; score: number }[]`, `color: string` (CSS class)
- **Implementation**:
  - `ResponsiveContainer` width="100%" height={40}
  - `LineChart` with no margins
  - `Line` with `type="monotone"`, `dataKey="score"`, `dot={false}`, `strokeWidth={1.5}`, color from prop
  - No XAxis, YAxis, CartesianGrid, Tooltip, or Legend
  - Returns `null` if `data.length < 3`
- **Effort**: Small (~30 lines)
- **FR**: FR-005, FR-006

### Phase 4: History Enrichment (Drawer)

#### Task 4.1: Create metric formatting utilities
- **File**: `lib/health/format.ts` (new)
- **Change**: Utility functions for metric display formatting
- **Functions**:
  - `formatCost(costUsd: number): string` → `"$0.42"` (2 decimal places)
  - `formatTokens(tokens: number): string` → `"12.5k"` or `"1.2M"` (abbreviated)
  - `formatDuration(ms: number): string` → `"2.3s"` or `"1m 15s"` (human-readable)
- **Effort**: Small (~30 lines)

#### Task 4.2: Update `HistoryEntry` in drawer-history.tsx
- **File**: `components/health/drawer/drawer-history.tsx`
- **Change**: Replace the `"{issuesFound} issues"` text (lines 95-98) with up to 4 metric icons
- **Implementation**:
  - Import `AlertTriangle`, `Coins`, `Zap`, `Clock` from lucide-react
  - Import `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` from shadcn/ui
  - For each non-null metric, render: icon (12px) + formatted value + tooltip
  - Conditional rendering: only show icon if value is non-null
  - Layout: horizontal flex with gap-2, between date and score badge
- **Note**: `ScanHistoryItem` must already include `tokensUsed` and `costUsd` (from Task 1.2). `durationMs` is already in the select clause. Need to verify `issuesFound` icon shows count, not "X issues" text.
- **Effort**: Medium (~40 lines changed)
- **FR**: FR-001, FR-002, FR-003, FR-012

### Phase 5: Dashboard Integration

#### Task 5.1: Wire trends into `HealthDashboard`
- **File**: `components/health/health-dashboard.tsx`
- **Change**: Call `useHealthTrends(projectId)` and pass trend data to module cards and drawers
- **Implementation**:
  - Add `useHealthTrends(projectId)` call
  - Compute per-module trend arrays from `trends.data`
  - Pass `trendData` prop to each `HealthModuleCard`
  - Pass `trendData` prop to `ScanDetailDrawer`
- **Effort**: Small (~15 lines)
- **FR**: FR-009

#### Task 5.2: Add sparkline to `HealthModuleCard`
- **File**: `components/health/health-module-card.tsx`
- **Change**: Accept optional `trendData` prop; render `Sparkline` component when data has ≥3 points
- **Implementation**:
  - Add `trendData?: { date: string; score: number }[]` to `HealthModuleCardProps`
  - After the summary text and before the trend indicator, conditionally render `<Sparkline data={trendData} color={scoreColors?.text ?? 'text-muted-foreground'} />`
  - Only render when `trendData && trendData.length >= 3`
- **Effort**: Small (~10 lines)
- **FR**: FR-005, FR-006

#### Task 5.3: Add area chart to `ScanDetailDrawer`
- **File**: `components/health/scan-detail-drawer.tsx`
- **Change**: Accept `trendData` prop; render `ScoreTrendChart` in the drawer content
- **Implementation**:
  - Add `trendData?: { date: string; score: number }[]` to drawer props
  - Render `ScoreTrendChart` section between the header/report and the history section
  - Section header: "Score Trend"
  - Container height: `h-48` (same as Quality Gate chart)
  - Only render when `trendData && trendData.length > 0`
- **Effort**: Small (~15 lines)
- **FR**: FR-007

## Testing Strategy

### Integration Tests (Vitest)

#### Test 1: Trends endpoint returns correct data
- **File**: `tests/integration/health/trends.test.ts` (new)
- **Covers**: FR-008, FR-010
- **Scenarios**:
  - Returns trend data for all 4 module types
  - Only includes COMPLETED scans with non-null scores
  - Excludes FAILED/PENDING/RUNNING scans
  - Respects `limit` parameter
  - Returns empty arrays for modules with no qualifying scans
  - Returns 401 for unauthenticated requests
  - Returns 403 for unauthorized projects

#### Test 2: Scan history returns telemetry fields
- **File**: `tests/integration/health/scan-history-telemetry.test.ts` (new)
- **Covers**: FR-004
- **Scenarios**:
  - Response includes `tokensUsed` and `costUsd` fields
  - Fields are null for scans without telemetry data
  - Fields contain correct values for scans with telemetry

### Unit Tests (Vitest)

#### Test 3: Formatting utilities
- **File**: `tests/unit/health/format.test.ts` (new)
- **Covers**: FR-001 (display formatting)
- **Scenarios**:
  - `formatCost`: `0.42 → "$0.42"`, `1.5 → "$1.50"`, `0 → "$0.00"`
  - `formatTokens`: `500 → "500"`, `1200 → "1.2k"`, `1500000 → "1.5M"`
  - `formatDuration`: `500 → "0.5s"`, `2300 → "2.3s"`, `75000 → "1m 15s"`

### Component Tests (Vitest + RTL)

#### Test 4: Sparkline rendering
- **File**: `tests/unit/components/health/sparkline.test.tsx` (new)
- **Covers**: FR-005, FR-006
- **Scenarios**:
  - Renders nothing when data has fewer than 3 points
  - Renders a chart container when data has 3+ points
  - Does not render axes, labels, or grid

#### Test 5: HistoryEntry metric icons
- **File**: `tests/unit/components/health/drawer-history.test.tsx` (new)
- **Covers**: FR-001, FR-002, FR-003, FR-012
- **Scenarios**:
  - Renders all 4 metric icons when all telemetry data present
  - Hides icons for null metric values
  - Displays correct tooltip text on hover
  - Does NOT render old "X issues" text format

## Dependency Graph

```
Phase 1 (API) ──────────────────────────────────────┐
  Task 1.1: Scan history select fix                  │
  Task 1.2: ScanHistoryItem type update              │
  Task 1.3: Trends endpoint                          │
  Task 1.4: Query key                                │
                                                     │
Phase 2 (Hooks) ─── depends on Phase 1 ─────────────┤
  Task 2.1: useHealthTrends hook                     │
  Task 2.2: Trend types                              │
                                                     │
Phase 3 (Shared UI) ─── independent ─────────────────┤
  Task 3.1: ScoreTrendChart extraction               │
  Task 3.2: QG drawer refactor                       │
  Task 3.3: Sparkline component                      │
                                                     │
Phase 4 (History) ─── depends on Phase 1 ────────────┤
  Task 4.1: Format utilities                         │
  Task 4.2: HistoryEntry enrichment                  │
                                                     │
Phase 5 (Integration) ─── depends on Phases 2-4 ─────┘
  Task 5.1: Dashboard wiring
  Task 5.2: Module card sparkline
  Task 5.3: Drawer area chart
```

## Files Changed Summary

| File | Action | Phase |
|------|--------|-------|
| `app/api/projects/[projectId]/health/scans/route.ts` | Modified | 1 |
| `app/api/projects/[projectId]/health/trends/route.ts` | **New** | 1 |
| `app/lib/query-keys.ts` | Modified | 1 |
| `lib/health/types.ts` | Modified | 1, 2 |
| `app/lib/hooks/useHealthTrends.ts` | **New** | 2 |
| `lib/health/format.ts` | **New** | 4 |
| `components/health/drawer/score-trend-chart.tsx` | **New** | 3 |
| `components/health/drawer/quality-gate-drawer.tsx` | Modified | 3 |
| `components/health/sparkline.tsx` | **New** | 3 |
| `components/health/drawer/drawer-history.tsx` | Modified | 4 |
| `components/health/health-dashboard.tsx` | Modified | 5 |
| `components/health/health-module-card.tsx` | Modified | 5 |
| `components/health/scan-detail-drawer.tsx` | Modified | 5 |

**New files**: 5 | **Modified files**: 8 | **Total**: 13

## WCAG AA Compliance Notes (FR-011)

- All text in metric icons uses `text-muted-foreground` on `aurora-glass` backgrounds (verified 4.5:1 in existing components)
- Sparkline colors derived from `getScoreColor()` which uses `ctp-green`, `ctp-blue`, `ctp-yellow`, `ctp-red` — all meeting contrast ratios against dark/light card backgrounds
- Tooltips use shadcn/ui `Tooltip` component which inherits accessible styling
- Area chart uses `hsl(var(--primary))` stroke and `hsl(var(--muted-foreground))` text — same as production Quality Gate chart
