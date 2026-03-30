# Implementation Plan: Health Dashboard — Passive Modules (Quality Gate & Last Clean)

**Feature Branch**: `AIB-379-copy-of-health`
**Spec**: `specs/AIB-379-copy-of-health/spec.md`
**Status**: Ready for BUILD

---

## Technical Context

| Aspect | Detail |
|--------|--------|
| **Database** | No schema changes — reads from existing `Job`, `Ticket`, `HealthScore` models |
| **API** | 2 new endpoints + 1 modified endpoint |
| **UI** | 2 new drawer components + card enhancements for 2 passive modules |
| **Charts** | Recharts 2.x (already in project) for trend chart |
| **Dependencies** | None new |

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code will be strictly typed, new interfaces for API responses |
| II. Component-Driven | PASS | New drawer components follow shadcn/ui + feature folder pattern |
| III. Test-Driven | PASS | Integration tests for APIs, component tests for UI, test plan below |
| IV. Security-First | PASS | All endpoints use `verifyProjectAccess()`, Prisma parameterized queries only |
| V. Database Integrity | PASS | No schema changes, read-only queries |
| VI. AI-First Model | PASS | No README/GUIDE files created |

**Gate**: All constitution principles satisfied. No violations.

---

## Implementation Phases

### Phase 1: API Layer — Quality Gate Aggregation

**Goal**: New endpoint for Quality Gate details + update existing health endpoint

#### 1.1 Quality Gate Helper (`lib/health/quality-gate.ts`)

Create a shared module for Quality Gate computation:

- `getQualityGateData(projectId: number)` — returns `QualityGateDetails`
- Queries COMPLETED verify jobs from FULL-workflow SHIP tickets in last 30 days
- Computes: average score, ticket count, trend vs previous 30 days, threshold distribution
- Parses `qualityScoreDetails` JSON for per-dimension averages using `DIMENSION_CONFIG`
- Returns typed response matching contract in `contracts/quality-gate-details.md`

**Key query**:
```
Job.findMany({
  where: {
    command: 'verify',
    status: 'COMPLETED',
    qualityScore: { not: null },
    completedAt: { gte: thirtyDaysAgo },
    ticket: { projectId, workflowType: 'FULL', stage: 'SHIP' }
  },
  include: { ticket: { select: { ticketKey, title } } },
  orderBy: { completedAt: 'desc' }
})
```

#### 1.2 New API Endpoint (`app/api/projects/[projectId]/health/quality-gate/route.ts`)

- `GET` handler using `getQualityGateData()`
- Auth via `verifyProjectAccess(projectId)`
- Standard error handling (400/401/404/500)

#### 1.3 Update Health Endpoint (`app/api/projects/[projectId]/health/route.ts`)

Modify existing Quality Gate section (lines 97-115):
- Replace single-job lookup with 30-day average from `getQualityGateData()`
- Add `ticketCount`, `trend`, `trendDelta`, `distribution` to qualityGate module response
- Update `summary` to show ticket count (e.g., "5 tickets — Good")
- Update HealthScore cache with new 30-day average

---

### Phase 2: API Layer — Last Clean Details

**Goal**: New endpoint for Last Clean details + update existing health endpoint

#### 2.1 Last Clean Helper (`lib/health/last-clean.ts`)

Create a shared module for Last Clean computation:

- `getLastCleanData(projectId: number)` — returns `LastCleanDetails`
- Queries COMPLETED cleanup jobs ordered by `completedAt DESC`, limit 20
- Computes staleness status from elapsed days
- Parses job `output` for structured cleanup data (filesCleaned, remainingIssues, summary)
- Returns typed response matching contract in `contracts/last-clean-details.md`

#### 2.2 New API Endpoint (`app/api/projects/[projectId]/health/last-clean/route.ts`)

- `GET` handler using `getLastCleanData()`
- Auth via `verifyProjectAccess(projectId)`
- Standard error handling

#### 2.3 Update Health Endpoint

Modify existing Last Clean section (lines 117-184):
- Add `stalenessStatus` and `filesCleaned` to lastClean module response
- Use staleness helper for visual state computation

---

### Phase 3: Type Updates

#### 3.1 Extend `HealthModuleStatus` (`lib/health/types.ts`)

Add optional fields per `contracts/health-response-changes.md`:
- `ticketCount?: number`
- `trend?: 'up' | 'down' | 'stable' | null`
- `trendDelta?: number | null`
- `distribution?: { excellent: number; good: number; fair: number; poor: number }`
- `stalenessStatus?: 'ok' | 'warning' | 'alert' | null`
- `filesCleaned?: number | null`

#### 3.2 New Type Files

- `QualityGateDetails` type in `lib/health/quality-gate.ts`
- `LastCleanDetails` type in `lib/health/last-clean.ts`

---

### Phase 4: UI — Quality Gate Card Enhancement

#### 4.1 Update `HealthModuleCard` (`components/health/health-module-card.tsx`)

For Quality Gate module:
- Display ticket count below score (e.g., "5 tickets")
- Show trend indicator arrow (up/down/stable) with color
- Show threshold distribution as small bar or counts

#### 4.2 Make Passive Cards Clickable (`components/health/health-dashboard.tsx`)

- Remove `ACTIVE_SCAN_SET` gate on `onClick` for Quality Gate and Last Clean
- Pass `onClick={() => setSelectedModule(type)}` for all modules

---

### Phase 5: UI — Last Clean Card Enhancement

#### 5.1 Update `HealthModuleCard` for Last Clean

- Show staleness visual state (green/yellow/red background tint or border)
- Display file count when available
- Show days since cleanup prominently

---

### Phase 6: UI — Quality Gate Drawer

#### 6.1 New Component: `QualityGateDrawer` (`components/health/drawer/quality-gate-drawer.tsx`)

Content sections:
1. **Header**: Average score badge, ticket count, trend indicator
2. **Dimension Breakdown**: List of 5 dimensions with average scores and weights (horizontal bars or mini badges)
3. **Threshold Distribution**: Visual breakdown (small stacked bar or count badges: Excellent/Good/Fair/Poor)
4. **Trend Chart**: Recharts `AreaChart` with score per ticket over time (X-axis: date, Y-axis: 0-100)
5. **Recent Tickets**: Scrollable list with ticket key, title, and individual score badge

#### 6.2 New Hook: `useQualityGateDetails` (`app/lib/hooks/useQualityGateDetails.ts`)

- TanStack Query hook fetching `GET /api/projects/:projectId/health/quality-gate`
- Enabled only when Quality Gate drawer is open
- No polling (data refreshes on drawer open)

#### 6.3 Update `ScanDetailDrawer` or `HealthDashboard`

Route Quality Gate clicks to `QualityGateDrawer` instead of `ScanDetailDrawer`.

---

### Phase 7: UI — Last Clean Drawer

#### 7.1 New Component: `LastCleanDrawer` (`components/health/drawer/last-clean-drawer.tsx`)

Content sections:
1. **Header**: Last cleanup date, staleness status badge, days since cleanup
2. **Summary**: Files cleaned count, remaining issues count (when available), summary text
3. **History**: Chronological list of past cleanups (date, summary, file count if available)

#### 7.2 New Hook: `useLastCleanDetails` (`app/lib/hooks/useLastCleanDetails.ts`)

- TanStack Query hook fetching `GET /api/projects/:projectId/health/last-clean`
- Enabled only when Last Clean drawer is open

#### 7.3 Update `HealthDashboard`

Route Last Clean clicks to `LastCleanDrawer`.

---

### Phase 8: Global Health Score Update

#### 8.1 Update Health Endpoint Score Calculation

- Pass 30-day average `qualityGate` score to `calculateGlobalScore()` (already uses it as one of 5 inputs)
- Update the `HealthScore.qualityGate` cache field with the computed 30-day average
- Also update `HealthScore.lastCleanDate` and `lastCleanJobId` from the latest cleanup job

---

## Testing Strategy

### Integration Tests (`tests/integration/health/`)

| Test File | What It Tests | Priority |
|-----------|---------------|----------|
| `quality-gate-details.test.ts` | NEW — Quality Gate aggregation endpoint | P1 |
| `last-clean-details.test.ts` | NEW — Last Clean details endpoint | P2 |
| `health-score.test.ts` | EXTEND — Add cases for 30-day average, trend, distribution, staleness | P1 |

**Quality Gate Details Tests** (P1):
1. Returns correct 30-day average from multiple SHIP tickets with FULL workflow
2. Excludes QUICK-workflow tickets from calculation
3. Excludes tickets not at SHIP stage
4. Computes correct trend (up/down/stable) comparing 30-day windows
5. Returns correct threshold distribution counts
6. Computes per-dimension averages from `qualityScoreDetails` JSON
7. Returns empty state when no qualifying tickets exist
8. Returns recent tickets list ordered by `completedAt` desc

**Last Clean Details Tests** (P2):
1. Returns correct staleness status at each threshold boundary (<30, 30-60, >60 days)
2. Parses structured cleanup data from job output when available
3. Returns null fields gracefully when job output has no structured data
4. Returns chronological cleanup history
5. Returns empty state when no completed cleanup jobs exist
6. Handles RUNNING cleanup jobs (ignores them, shows last COMPLETED)

### Component Tests (`tests/unit/components/`)

| Test File | What It Tests | Priority |
|-----------|---------------|----------|
| `quality-gate-drawer.test.tsx` | NEW — Drawer renders dimensions, tickets, chart | P2 |
| `last-clean-drawer.test.tsx` | NEW — Drawer renders staleness, history | P2 |
| `health-module-card.test.tsx` | EXTEND — Add cases for trend, distribution, staleness visuals | P2 |

**Quality Gate Drawer Tests** (P2):
1. Renders dimension breakdown with all 5 dimensions
2. Renders recent tickets list with keys and scores
3. Renders trend chart (checks Recharts container renders)
4. Shows empty state when no data
5. Shows loading state while fetching

**Last Clean Drawer Tests** (P2):
1. Renders staleness badge with correct visual state
2. Renders cleanup history list
3. Shows file count and remaining issues when available
4. Hides file count when not available (graceful degradation)
5. Shows empty state with "No cleanups" message

### Unit Tests (`tests/unit/health/`)

| Test File | What It Tests | Priority |
|-----------|---------------|----------|
| `quality-gate.test.ts` | NEW — Pure aggregation logic (average, trend, distribution) | P1 |
| `last-clean.test.ts` | NEW — Staleness calculation, output parsing | P1 |
| `score-calculator.test.ts` | EXTEND — Verify 30-day average flows through correctly | P2 |

---

## File Inventory

### New Files (10)

| File | Purpose |
|------|---------|
| `lib/health/quality-gate.ts` | Quality Gate computation logic |
| `lib/health/last-clean.ts` | Last Clean computation logic |
| `app/api/projects/[projectId]/health/quality-gate/route.ts` | Quality Gate details API |
| `app/api/projects/[projectId]/health/last-clean/route.ts` | Last Clean details API |
| `components/health/drawer/quality-gate-drawer.tsx` | Quality Gate drawer UI |
| `components/health/drawer/last-clean-drawer.tsx` | Last Clean drawer UI |
| `app/lib/hooks/useQualityGateDetails.ts` | TanStack Query hook for QG data |
| `app/lib/hooks/useLastCleanDetails.ts` | TanStack Query hook for LC data |
| `tests/integration/health/quality-gate-details.test.ts` | QG API tests |
| `tests/integration/health/last-clean-details.test.ts` | LC API tests |

### Modified Files (6)

| File | Change |
|------|--------|
| `lib/health/types.ts` | Add optional fields to `HealthModuleStatus` |
| `app/api/projects/[projectId]/health/route.ts` | Use 30-day average, add new fields |
| `components/health/health-dashboard.tsx` | Enable passive module clicks, route to drawers |
| `components/health/health-module-card.tsx` | Render trend, distribution, staleness visuals |
| `tests/integration/health/health-score.test.ts` | Extend with new field assertions |
| `tests/unit/components/health-module-card.test.tsx` | Extend with new visual state tests |

---

## Dependency Order

```
Phase 1 (Quality Gate API) ──┐
Phase 2 (Last Clean API) ────┤── can run in parallel
Phase 3 (Type updates) ──────┘── prerequisite for UI phases

Phase 4 (QG card) ───┐
Phase 5 (LC card) ───┤── can run in parallel after Phase 3
Phase 6 (QG drawer) ─┤
Phase 7 (LC drawer) ─┘

Phase 8 (Global score) ── after Phase 1
```

**Critical path**: Phase 3 → Phase 1 → Phase 8 → Phase 6 (Quality Gate end-to-end)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `qualityScoreDetails` JSON format varies across job vintages | Dimension averages may be incomplete | Use `parseQualityScoreDetails()` with error handling; skip unparseable records |
| Cleanup job `output` lacks structured data | Last Clean card appears sparse | Graceful degradation per spec Decision 2; show only date and status |
| Large number of SHIP tickets in 30-day window | Slow query | Prisma query with proper indexes; Job table already indexed on `command` + `status`; limit to reasonable count |
| Recharts bundle size increase | Minimal — already in the project dependency tree |
