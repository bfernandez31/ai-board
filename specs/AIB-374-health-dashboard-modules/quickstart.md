# Quickstart: Health Dashboard - Passive Modules (Quality Gate & Last Clean)

**Date**: 2026-03-29

## Implementation Order

### Phase A: Backend — Quality Gate Aggregation (P1)

1. **Create `lib/health/quality-gate.ts`** — Server-side aggregation module
   - `getQualityGateAggregate(projectId: number)` → `QualityGateAggregate`
   - Queries SHIP tickets with COMPLETED verify jobs + non-null qualityScore in 30-day window
   - Handles duplicate verify jobs per ticket (most recent wins via `DISTINCT ON ticketId`)
   - Computes: average score, ticket count, threshold distribution, trend vs previous 30 days
   - Parses `qualityScoreDetails` JSON for per-dimension averages
   - Groups scores by ISO week for trend chart data

2. **Extend `lib/health/types.ts`** — Add TypeScript interfaces
   - `QualityGateAggregate`, `QualityGateTrend`, `ThresholdDistribution`
   - `DimensionAverage`, `QualityGateTicketItem`, `TrendDataPoint`
   - `QualityGateModuleStatus extends HealthModuleStatus`
   - `LastCleanModuleStatus extends HealthModuleStatus`
   - `LastCleanAggregate`, `LastCleanHistoryItem`

3. **Extend `app/api/projects/[projectId]/health/route.ts`** — Enrich response
   - Call `getQualityGateAggregate(projectId)` and inline results into `modules.qualityGate`
   - Update `qualityGate` module object with `ticketCount`, `trend`, `distribution`, `detail`

### Phase B: Backend — Last Clean Derivation (P2)

4. **Create `lib/health/last-clean.ts`** — Server-side derivation module
   - `getLastCleanAggregate(projectId: number)` → `LastCleanAggregate`
   - Queries completed clean jobs, extracts files/issues from job data
   - Computes staleness (daysAgo, isOverdue based on 30-day threshold)
   - Returns history of up to 10 recent cleanup jobs

5. **Extend health route** — Enrich `modules.lastClean` with new fields
   - Call `getLastCleanAggregate(projectId)` and inline results

### Phase C: Frontend — Quality Gate Card Enhancements (P1)

6. **Update `components/health/health-module-card.tsx`** — Enhanced QG card display
   - Show ticket count, trend indicator (arrow + delta), threshold distribution mini-bar
   - Conditional rendering based on `qualityGate.ticketCount > 0`

7. **Update `components/health/health-hero.tsx`** — QG sub-score badge
   - Already displays Quality Gate in sub-score row — verify it shows the 30-day average

### Phase D: Frontend — Quality Gate Drawer (P2)

8. **Create `components/health/drawer/quality-gate-drawer-content.tsx`**
   - Dimensions table (reuse aurora-glass pattern from existing `QualityGateIssues`)
   - Recent SHIP tickets list with score badges
   - Trend line chart (Recharts `LineChart` following analytics pattern)
   - Empty state when `detail` is null

9. **Update `components/health/scan-detail-drawer.tsx`** — Route passive modules to dedicated content
   - When `moduleType === 'QUALITY_GATE'`, render `QualityGateDrawerContent` with data from health response
   - Skip `useScanReport` for passive modules (already disabled)

### Phase E: Frontend — Last Clean Card & Drawer (P2-P3)

10. **Update card** — Show staleness indicator (overdue visual alert when > 30 days)
    - Use `isOverdue` flag to toggle alert styling

11. **Create `components/health/drawer/last-clean-drawer-content.tsx`**
    - Summary of most recent cleanup (files cleaned, remaining issues, text summary)
    - History list of up to 10 past cleanups (reverse chronological)
    - Empty state when no cleanup has been run

12. **Update drawer** — Route `LAST_CLEAN` to dedicated content component

### Phase F: Global Score Integration (P1)

13. **Verify `lib/health/score-calculator.ts`** — Already includes `qualityGate` in `calculateGlobalScore`
    - Confirm weight redistribution works correctly when QG has/doesn't have data
    - No code changes expected — just verification via tests

### Phase G: Tests

14. **Integration: `tests/integration/health/quality-gate.test.ts`**
    - QG with qualifying SHIP tickets (verify average, distribution, dimensions)
    - QG with no qualifying tickets (empty state)
    - QG trend: both periods have data, only current has data
    - Multiple verify jobs per ticket (most recent wins)
    - Global score includes QG at correct weight

15. **Integration: `tests/integration/health/last-clean.test.ts`**
    - Last Clean with recent cleanup job (OK state)
    - Last Clean with old cleanup job (overdue state)
    - Last Clean with no cleanup jobs (never state)
    - Last Clean history (up to 10 entries)
    - Last Clean does NOT affect global score

16. **Component: `tests/unit/components/quality-gate-drawer.test.tsx`**
    - Renders dimensions table with correct averages
    - Renders recent tickets list
    - Renders trend chart (verify Recharts renders)
    - Renders empty state when detail is null

17. **Component: `tests/unit/components/last-clean-drawer.test.tsx`**
    - Renders summary card with files/issues
    - Renders history list
    - Renders overdue alert when status is 'overdue'
    - Renders empty state when no cleanup

## Key Patterns to Follow

- **Aggregation functions**: Pure functions in `lib/health/` that take `projectId` and return typed aggregates
- **Drawer content**: Standalone `"use client"` components that receive data as props (no internal fetching)
- **Chart pattern**: `ResponsiveContainer` > `LineChart` > `XAxis`/`YAxis`/`Tooltip`/`Line` with theme-aware colors
- **Score colors**: Use `getScoreColor(score)` from `lib/quality-score.ts` for consistent theming
- **Empty states**: Follow `DrawerStates` pattern for passive_no_data messaging
- **Card enhancements**: Extend existing `HealthModuleCard` with conditional rendering, not a new component
