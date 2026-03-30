# Implementation Plan: Health Scan Metrics — Trend Lines, Sparklines & History Enrichment

**Branch**: `AIB-405-health-scan-metrics`
**Date**: 2026-03-30
**Status**: Ready for implementation

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| Database | No schema changes — `tokensUsed`, `costUsd`, `durationMs` already exist on `HealthScan` |
| API | New `GET /health/trends` endpoint + extend existing `GET /health/scans` response |
| Charts | Recharts 3.8.1 (already installed) — `LineChart` for sparklines, `AreaChart` for drawers |
| State | TanStack Query v5 — new `useHealthTrends` hook (fetch-once, no polling) |
| UI | shadcn/ui Tooltip, Lucide icons, `aurora-glass` cards |
| Formatting | Existing `formatAbbreviatedNumber`, `formatCost`, `formatDuration` from `lib/analytics/aggregations.ts` |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | ✅ Pass | All new interfaces typed, no `any` |
| II. Component-Driven | ✅ Pass | shadcn/ui Tooltip, Recharts charts, feature-based folders |
| III. Test-Driven | ✅ Pass | Integration tests for API, component tests for UI (see Testing Strategy) |
| IV. Security-First | ✅ Pass | `verifyProjectAccess` on trend endpoint, Zod validation, Prisma queries |
| V. Database Integrity | ✅ Pass | No schema changes, read-only queries |
| V. Spec Clarification | ✅ Pass | Auto-resolved decisions documented with trade-offs |

---

## Implementation Phases

### Phase A: Data Layer (US-4, US-1 backend)

**A1. Extend scan history API response** (US-1, FR-003)
- **File**: `app/api/projects/[projectId]/health/scans/route.ts`
- **Change**: Add `tokensUsed: true` and `costUsd: true` to Prisma `select` clause (lines 159-175)
- **File**: `lib/health/types.ts`
- **Change**: Add `tokensUsed: number | null` and `costUsd: number | null` to `ScanHistoryItem` interface

**A2. Create trend endpoint** (US-4, FR-007)
- **File**: `app/api/projects/[projectId]/health/trends/route.ts` (NEW)
- **Logic**:
  1. `verifyProjectAccess(projectId)`
  2. For each active scan type (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC):
     - Query last 20 COMPLETED scans with non-null score, ordered by `completedAt DESC`
     - Map to `{ score, date: completedAt }` and reverse for chronological order
  3. Return `{ security, compliance, tests, specSync }`
- **Types**: Add `TrendDataPoint` and `HealthTrendsResponse` to `lib/health/types.ts`

**A3. Add query key for trends**
- **File**: `app/lib/query-keys.ts`
- **Change**: Add `trends: (projectId: number) => ['health', projectId, 'trends'] as const` to `health` object

**A4. Create `useHealthTrends` hook** (FR-008)
- **File**: `app/lib/hooks/useHealthTrends.ts` (NEW)
- **Config**: `staleTime: 5min`, no `refetchInterval`, `refetchOnWindowFocus: false`
- **Query key**: `queryKeys.health.trends(projectId)`

---

### Phase B: Scan History UI Enrichment (US-1)

**B1. Add metric icons to `HistoryEntry`** (FR-001, FR-002, FR-011)
- **File**: `components/health/drawer/drawer-history.tsx`
- **Changes to `HistoryEntry` component**:
  1. Import `AlertTriangle`, `Coins`, `Zap`, `Clock` from `lucide-react`
  2. Import `Tooltip`, `TooltipTrigger`, `TooltipContent` from `components/ui/tooltip`
  3. Import `formatAbbreviatedNumber`, `formatCost`, `formatDuration` from `lib/analytics/aggregations`
  4. Replace current issues text + score layout with:
     - Score badge (existing)
     - 4 metric icons in a row: issues (AlertTriangle), cost (Coins), tokens (Zap), duration (Clock)
     - Each icon shows formatted value or "—" for null
     - Each icon wrapped in Tooltip with descriptive text

---

### Phase C: Sparklines on Module Cards (US-2)

**C1. Add sparkline to `HealthModuleCard`** (FR-004, FR-005, FR-010)
- **File**: `components/health/health-module-card.tsx`
- **Changes**:
  1. Accept new optional prop: `trendData?: TrendDataPoint[]`
  2. Render condition: only if `!passive && trendData && trendData.length >= 3`
  3. Sparkline element: Recharts `LineChart` + `Line` inside `ResponsiveContainer`
     - Height: 40px
     - No axes, no grid, no tooltip, no animation
     - Stroke: `hsl(var(--primary))`, strokeWidth 1.5
     - `dot={false}`, `type="monotone"`
  4. Position: Below summary text, above scan button

**C2. Wire trend data into dashboard** (FR-008)
- **File**: `components/health/health-dashboard.tsx`
- **Changes**:
  1. Call `useHealthTrends(projectId)` alongside existing `useHealthPolling`
  2. Pass per-module trend arrays to corresponding `HealthModuleCard` components
  3. Only pass to active modules (SECURITY, COMPLIANCE, TESTS, SPEC_SYNC)

---

### Phase D: Area Charts in Module Drawers (US-3)

**D1. Add area chart to `ScanDetailDrawer`** (FR-006)
- **File**: `components/health/scan-detail-drawer.tsx` (or new `DrawerTrendChart` component)
- **Changes**:
  1. Accept `trendData?: TrendDataPoint[]` prop
  2. Render `AreaChart` matching Quality Gate drawer pattern:
     - `ResponsiveContainer` width 100%, height 192px
     - `CartesianGrid strokeDasharray="3 3"` with `stroke-muted`
     - `XAxis` with date formatter, `YAxis` domain [0, 100]
     - `Tooltip` with date label and score value
     - `Area type="monotone"` with `hsl(var(--primary))` stroke/fill
  3. Render condition: only for active modules, only if trend data has ≥ 1 point
  4. Section heading: "Score Trend"

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `lib/health/types.ts` | Modify — add `tokensUsed`/`costUsd` to `ScanHistoryItem`, add `TrendDataPoint`/`HealthTrendsResponse` | A |
| `app/api/projects/[projectId]/health/scans/route.ts` | Modify — add fields to select | A |
| `app/api/projects/[projectId]/health/trends/route.ts` | **New** — trend endpoint | A |
| `app/lib/query-keys.ts` | Modify — add `trends` key | A |
| `app/lib/hooks/useHealthTrends.ts` | **New** — fetch-once hook | A |
| `components/health/drawer/drawer-history.tsx` | Modify — metric icons with tooltips | B |
| `components/health/health-module-card.tsx` | Modify — sparkline rendering | C |
| `components/health/health-dashboard.tsx` | Modify — wire trend data | C |
| `components/health/scan-detail-drawer.tsx` | Modify — area chart section | D |

---

## Testing Strategy

### Integration Tests (Vitest)

| Test | File | Covers |
|------|------|--------|
| Trend endpoint returns correct shape | `tests/integration/health/trends.test.ts` | A2, FR-007 |
| Trend endpoint filters COMPLETED + non-null scores | `tests/integration/health/trends.test.ts` | A2, Edge Cases |
| Trend endpoint caps at 20 data points | `tests/integration/health/trends.test.ts` | A2, Auto-resolved |
| Trend endpoint returns empty arrays for no data | `tests/integration/health/trends.test.ts` | A2, Edge Cases |
| Scan history includes tokensUsed/costUsd | `tests/integration/health/scan-history.test.ts` | A1, FR-003 |
| Scan history null telemetry returns null | `tests/integration/health/scan-history.test.ts` | A1, FR-011 |

### Component Tests (Vitest + RTL)

| Test | File | Covers |
|------|------|--------|
| HistoryEntry renders 4 metric icons with values | `tests/unit/components/drawer-history.test.tsx` | B1, FR-001 |
| HistoryEntry shows dash for null metrics | `tests/unit/components/drawer-history.test.tsx` | B1, FR-011 |
| Metric icon tooltips display correct text | `tests/unit/components/drawer-history.test.tsx` | B1, FR-002 |
| Sparkline renders when ≥ 3 data points | `tests/unit/components/health-module-card.test.tsx` | C1, FR-004 |
| Sparkline hidden when < 3 data points | `tests/unit/components/health-module-card.test.tsx` | C1, FR-005 |
| Sparkline hidden for passive modules | `tests/unit/components/health-module-card.test.tsx` | C1, FR-005 |
| Area chart renders in drawer with trend data | `tests/unit/components/scan-detail-drawer.test.tsx` | D1, FR-006 |

### Test Type Rationale

- **API endpoints** → Integration tests (decision tree rule 3: API + database operations)
- **React components with interactions** → Component tests with RTL (decision tree rule 2)
- **No E2E tests** — no browser-required features (no OAuth, drag-drop, viewport-dependent behavior)

---

## Accessibility (FR-009)

| Element | WCAG Requirement | Implementation |
|---------|-----------------|----------------|
| Metric icons | Color not sole info carrier | Icons + numeric values + tooltips |
| Tooltips | Keyboard accessible | shadcn/ui Tooltip (Radix) supports focus trigger |
| Sparklines | Decorative | `aria-hidden="true"`, trend info already in TrendIndicator text |
| Area chart | Interactive | Recharts Tooltip provides keyboard-accessible hover data |
| All text | 4.5:1 contrast | Tailwind semantic tokens only (no hardcoded colors) |

---

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Recharts bundle size increase from sparklines | Sparklines reuse already-imported components; tree-shaking handles the rest |
| Trend endpoint performance with many scans | Prisma query uses indexed `projectId` + `scanType` + `status` with `take: 20` limit |
| Null telemetry data for older scans | Graceful "—" display; no layout shift |

---

## Out of Scope

- Time-based trend windows (e.g., "last 90 days") — possible future enhancement per auto-resolved reviewer notes
- Sub-cent cost formatting ("< $0.01") — deferred per auto-resolved decision
- Passive module (Quality Gate, Last Clean) sparklines — explicitly excluded by spec
