# Research: Activity Heatmap on Projects Page (AIB-704)

**Branch**: `AIB-704-activity-heatmap-on`
**Date**: 2026-04-21

This document captures all unknowns resolved, existing-file inventory, and patterns extracted from the codebase before Phase 1 design.

---

## Existing Files

### Page & container (must be modified)

| Path | Covers | Action |
|---|---|---|
| `app/projects/page.tsx` | Server-rendered `/projects` entry. Fetches projects via `getUserProjects()` and renders `<ProjectsContainer>`. | **Modify** — parse heatmap `period`/`agent` query params, fetch initial heatmap data, and render a new `<ActivityHeatmapSection>` below the container. |
| `components/projects/projects-container.tsx` | Renders the project-card grid wrapped in `<div className="overflow-y-auto max-h-[calc(100vh-200px)]">` (line 15). | **Modify** — relax the inner-scroll viewport constraint so the page scrolls naturally and the heatmap is reachable below the grid (FR-012). |

### Analytics pattern (reuse as-is; pattern reference)

| Path | Covers | Action |
|---|---|---|
| `components/analytics/analytics-dashboard.tsx` | Client component; drives URL-synced filters via `useSearchParams` + `router.push('?...', { scroll: false })`, uses `useQuery({ initialData, refetchInterval: 15_000, staleTime: 10_000 })` with `filtersMatch(...)` gating for server-hydration (line 56, 92, 97). | **Pattern reference** for FR-024 (URL sync), FR-025 (initial hydration), and refetch cadence (Auto-Resolved Decision). |
| `app/projects/[projectId]/analytics/page.tsx` | Server component that parses `searchParams`, validates via `Set<T>`-based `getSearchParamValue` helper (line 33), and passes `initialData` to the client dashboard (line 98). | **Pattern reference** for server-hydration plus query-param validation. |
| `app/api/projects/[projectId]/analytics/route.ts` | GET route with Zod `querySchema`, `verifyProjectAccess`, and structured error responses for 400/403/404/500 (line 7, 25, 36). | **Pattern reference** for the new heatmap route. |
| `lib/analytics/types.ts` | Defines `AgentFilter`, `AGENT_FILTER_VALUES`, `NamedAgent`, `AgentOption`, `AnalyticsFilters`. | **Reuse as-is** — import `AgentFilter`, `AGENT_FILTER_VALUES`, `NamedAgent` for the heatmap; do not redefine. |
| `lib/analytics/queries.ts` | Contains `buildEffectiveAgentWhere` (line 51) for `ticket.agent OR (ticket.agent IS NULL AND project.defaultAgent = x)` resolution; contains `buildJobWhere` and Map-based date bucketing (line 335-367). | **Pattern reference** — heatmap server query will import and reuse `buildEffectiveAgentWhere` verbatim. |
| `lib/analytics/aggregations.ts` | Contains `formatDateForGrouping(date, 'daily' | 'weekly')` at line 136 and `formatCost` at line 209. | **Reuse as-is** — import `formatDateForGrouping('daily')` to avoid string drift on day keys. |
| `app/lib/utils/agent-resolution.ts` | `ALL_AGENTS`, `AGENT_LABELS`, `getAgentLabel`, `resolveEffectiveAgent`. | **Reuse as-is**. |
| `app/lib/query-keys.ts` | Central TanStack Query key registry (`queryKeys.analytics`, `queryKeys.projects`, etc.). | **Modify** — add `queryKeys.projects.activityHeatmap(period, agent)` entry (projects-scoped, not per-project). |

### Auth scoping

| Path | Covers | Action |
|---|---|---|
| `lib/db/projects.ts` | `getUserProjects()` uses the owner-OR-member scope `OR: [{ userId }, { members: { some: { userId } } }]` (line 31). | **Pattern reference** — heatmap server query MUST use the identical scope on `project` so that data matches FR-001. |
| `lib/db/users.ts` | `requireAuth(request?)` extracts the current user id from session or PAT. | **Reuse as-is**. |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess(projectId)` (project-scoped). | Not directly applicable (heatmap is user-scoped across projects); will build an analogous `requireAuth` flow in the new route. |

### UI primitives

| Path | Covers | Action |
|---|---|---|
| `components/ui/tooltip.tsx` | shadcn/Radix `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`. | **Reuse as-is** for FR-021. |
| `components/ui/select.tsx` | shadcn Select used for period / agent dropdowns. | **Reuse as-is** for FR-014, FR-017. |
| `components/analytics/empty-state.tsx` | Shared empty-state block used by analytics. | **Pattern reference** — heatmap empty state will be a local component with matching look-and-feel. |
| `components/comparison/comparison-compliance-heatmap.tsx` | Table-style heatmap grid with Radix tooltips and aurora class names. | **Pattern reference** for cell+tooltip composition (FR-021, FR-023). |
| `components/comparison/comparison-unified-metrics.tsx` | Horizontal-scroll table with `sticky left-0 z-10` left column over `overflow-x-auto` parent (line 80). | **Pattern reference** for FR-028 mobile pinned day-of-week labels. |

### Prisma schema (read-only)

| Path | Covers | Action |
|---|---|---|
| `prisma/schema.prisma` | `User`, `Project`, `ProjectMember`, `Ticket`, `Job` models; `Agent` and `JobStatus` enums. | **Read only** — FR-029 forbids new models. |

### Tests (extend; do NOT duplicate)

| Path | Covers | Action |
|---|---|---|
| `tests/unit/components/analytics-dashboard.test.tsx` | Tests filter interactions against the analytics dashboard. | **Pattern reference** for URL + useQuery-driven client filter tests. |
| `tests/integration/analytics/analytics-route.test.ts` | Tests the analytics API route (auth, filter shape, Zod errors). | **Pattern reference** for the new heatmap API integration test. |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Tests the structural heatmap (grid + tooltip). | **Pattern reference** for asserting cell intensity / tooltip contents. |
| `tests/integration/projects/projects-with-health.test.ts` | Tests `/projects`-scoped data integration. | **Extend** with a new test asserting heatmap payload shape when present; keep existing assertions intact. |

### New files to create (after confirming no existing file covers the domain)

| Path | Rationale |
|---|---|
| `lib/heatmap/types.ts` | Heatmap-specific types (`HeatmapPeriod`, `HeatmapFilters`, `HeatmapDataPoint`, `HeatmapData`). Lives next to its queries rather than bloating `lib/analytics/types.ts` (which is feature-owned by analytics). |
| `lib/heatmap/queries.ts` | Server-side Prisma aggregation for user-scoped heatmap data (reuses `buildEffectiveAgentWhere`, `formatDateForGrouping` from analytics). |
| `lib/heatmap/period.ts` | Pure period helpers: `resolvePeriod(input, joinYear, now)`, `getPeriodBoundaries(period)`, `enumerateYearsSinceJoin(joinYear, now)`. Pure functions ⇒ Vitest unit tests. |
| `lib/heatmap/buckets.ts` | Pure bucketing helpers: `computeIntensityBuckets(nonZeroCounts)` returning the four non-zero thresholds; `bucketFor(count, thresholds)` → `0 | 1 | 2 | 3 | 4`. Pure functions ⇒ Vitest unit tests. |
| `app/api/projects/activity-heatmap/route.ts` | New GET endpoint that the client uses to refetch on filter change / polling. Mirrors `app/api/projects/[projectId]/analytics/route.ts` exactly. |
| `components/projects/activity-heatmap-section.tsx` | Client component owning filters, URL sync, `useQuery` with `initialData`, and composing sub-components. |
| `components/projects/activity-heatmap-grid.tsx` | Pure grid renderer: day-of-week labels, month labels, weekly columns, chipped corners, per-cell tooltip. |
| `components/projects/activity-heatmap-header.tsx` | Header: "N jobs · M tickets shipped in {period label}" counter, period + agent selectors. |
| `components/projects/activity-heatmap-empty.tsx` | Empty-state block shown in place of the grid when the period has zero activity AND zero ships (FR-010). |
| `components/projects/activity-heatmap-legend.tsx` | Less → More legend (FR-009) with the 5 violet intensity swatches. |
| `hooks/use-activity-heatmap.ts` | TanStack Query hook wrapping `fetchActivityHeatmap()` with the `filtersMatch`/`initialData` gating pattern from `analytics-dashboard.tsx:92-97`. |

### New tests to create

| Path | Rationale |
|---|---|
| `tests/unit/heatmap/period.test.ts` | Period resolution: rolling 12mo boundaries, specific year boundaries, join-year clamping. |
| `tests/unit/heatmap/buckets.test.ts` | Non-zero-percentile bucketing; edge cases (all zero, single value, all equal, extreme skew). |
| `tests/unit/components/projects/activity-heatmap-grid.test.tsx` | RTL: chipped corners, weekday/month labels, empty-state rendering, tooltip content, touch-tap dismiss. |
| `tests/unit/components/projects/activity-heatmap-section.test.tsx` | RTL + userEvent: period change updates URL and query key; agent filter appears only when ≥2 distinct agents present; agent "All" preserved on initial load. |
| `tests/integration/heatmap/heatmap-route.test.ts` | Hits `GET /api/projects/activity-heatmap`: auth scoping (owner-OR-member), Zod validation, ship-detection by `command='ship'` + `status=COMPLETED`, null `costUsd` treated as "no data". |

---

## Patterns to Follow

### Pattern 1 — URL-synced filter + useQuery hydration

**Source**: `components/analytics/analytics-dashboard.tsx:56-108`

```ts
// line 56-58 — equality check gates initialData use
function filtersMatch(left, right) {
  return left.range === right.range && left.outcome === right.outcome && left.agent === right.agent;
}

// line 88-100 — useQuery with server-hydrated initialData
const [filters, setFilters] = useState(() => getInitialFilters(searchParams, initialData));
const shouldUseInitialData = filtersMatch(filters, initialData.filters);
const { data } = useQuery({
  queryKey: queryKeys.analytics.data(projectId, filters.range, filters.outcome, filters.agent),
  queryFn: () => fetchAnalytics(projectId, filters),
  initialData: shouldUseInitialData ? initialData : undefined,
  refetchInterval: 15000,
  staleTime: 10000,
});

// line 105-108 — URL update on filter change
const updateFilters = (next) => {
  setFilters(next);
  router.push(`?${buildFilterSearchParams(searchParams, next).toString()}`, { scroll: false });
};
```

**How the heatmap applies this**:
- `use-activity-heatmap.ts` wraps `useQuery` identically — 15s `refetchInterval`, 10s `staleTime`, `initialData` gated by `filtersMatch`.
- `activity-heatmap-section.tsx` calls `router.push('?...', { scroll: false })` whenever period or agent changes. The heatmap lives below the project grid, and `{ scroll: false }` prevents jumping the viewport back to the top on each change.
- Query key: `['projects', 'activity-heatmap', period, agent]` (user-implicit — no projectId — because the endpoint is user-scoped).

### Pattern 2 — Server page hydrates client dashboard with first-paint data

**Source**: `app/projects/[projectId]/analytics/page.tsx:49-99`

```ts
// line 70-80 — parse + validate searchParams, then fetch
const filters = {
  range:   getSearchParamValue(search.range,   VALID_RANGES,   DEFAULT_ANALYTICS_FILTERS.range),
  outcome: getSearchParamValue(search.outcome, VALID_OUTCOMES, DEFAULT_ANALYTICS_FILTERS.outcome),
  agent:   getSearchParamValue(search.agent,   VALID_AGENTS,   DEFAULT_ANALYTICS_FILTERS.agent),
};
const initialData = await getAnalyticsData(projectId, filters);

// line 98 — pass to client
<AnalyticsDashboard projectId={projectId} initialData={initialData} />
```

**How the heatmap applies this**:
- `app/projects/page.tsx` becomes `async`, awaits `searchParams` (already awaited elsewhere — Next 16 pattern), calls a new `getHeatmapInitialData(userId, filters)` from `lib/heatmap/queries.ts`, and passes it to `<ActivityHeatmapSection initialData={...} />`.
- Must also keep existing `getProjects()` call — both run in parallel via `Promise.all`.
- `initialData` carries the exact filters it was computed with, so `filtersMatch` in the client can gate hydration without a re-fetch.

### Pattern 3 — Auth scoping by owner OR member (non-negotiable)

**Source**: `lib/db/projects.ts:28-37`

```ts
export async function getUserProjects(request?: NextRequest) {
  const userId = await requireAuth(request);
  return prisma.project.findMany({
    where: {
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    // ...
  });
}
```

**How the heatmap applies this**:
- `lib/heatmap/queries.ts` MUST filter jobs by `ticket: { project: { OR: [{ userId }, { members: { some: { userId } } }] } }` for every read — jobs, ship-tickets, agent-option discovery.
- Do NOT add a convenience "all projects the user owns" shortcut — it would miss member projects per FR-001.
- The API route MUST call `requireAuth(request)` and use the returned userId exclusively. Never trust a userId from the query string.

### Pattern 4 — Effective agent resolution (`ticket.agent ?? project.defaultAgent`)

**Source**: `lib/analytics/queries.ts:51-69`

```ts
function buildEffectiveAgentWhere(agent: NamedAgent | 'all'): Prisma.TicketWhereInput | undefined {
  if (agent === 'all') return undefined;
  return {
    OR: [
      { agent },
      { agent: null, project: { is: { defaultAgent: agent } } },
    ],
  };
}
```

**How the heatmap applies this**:
- Import and call `buildEffectiveAgentWhere` from analytics — do not duplicate the clause.
- For the *agent filter options* (FR-016), the query must group counts by effective agent. Two approaches evaluated:
  - **Chosen**: fetch `(ticket.agent, project.defaultAgent)` pairs for all jobs in the period, resolve effective agent in JS via `resolveEffectiveAgent`, then count distinct. Mirrors `lib/analytics/queries.ts:218-220`.
  - Rejected: a `groupBy` with raw SQL `COALESCE(ticket.agent, project.default_agent)` — fewer lines but breaks Prisma parameterization and fights the constitution's "no raw SQL except migrations" rule (Principle IV).

### Pattern 5 — Ship detection by `ship` job, NOT by stage

**Spec requirement (FR-003)**: count tickets whose `ship` job `completedAt` falls on that day with `status = COMPLETED`. Legacy tickets with stage=SHIP but no completed ship job MUST NOT be counted.

**Important**: This DIVERGES from the existing analytics pattern in `lib/analytics/queries.ts:74-76` (which uses `stage = 'SHIP'`). The heatmap must NOT reuse that logic.

**Query shape**:
```ts
const shippedJobs = await prisma.job.findMany({
  where: {
    command: 'ship',
    status: 'COMPLETED',
    completedAt: { gte: periodStart, lte: periodEnd },
    ticket: { project: { OR: [{ userId }, { members: { some: { userId } } }] } },
    ...(agentFilter !== 'all' && { ticket: buildEffectiveAgentWhere(agentFilter) }),
  },
  select: {
    completedAt: true,
    ticket: { select: { ticketKey: true, title: true } },
  },
});
```

Bucket by `formatDateForGrouping(completedAt, 'daily')`.

### Pattern 6 — Cost aggregation: null is "no data", never zero (FR-004, FR-022, SC-006)

**Source**: `lib/analytics/queries.ts:312-315`

```ts
const totalCost = completedJobs.reduce((sum, job) => sum + (job.costUsd ?? 0), 0);
const costsIncomplete = completedJobs.some((job) => job.costUsd == null);
```

**How the heatmap applies this**:
- Per day, track TWO numbers: `jobCount` (total jobs) and `sumCostUsd` (sum of non-null `costUsd`). Track a `hasAnyCost: boolean` per day.
- Tooltip rendering (FR-022):
  - `hasAnyCost === true`  → render `"N jobs · $X.XX"` where `X.XX = sumCostUsd.toFixed(2)`.
  - `hasAnyCost === false` → render `"N jobs"`. Never emit the dot separator, dollar sign, or `$0`.
- SC-006 is enforced by the client: the tooltip template MUST conditionally insert the cost fragment. Unit test asserts the string `"$NaN"` and `"$0"` are absent from tooltip DOM when `hasAnyCost` is false.

### Pattern 7 — Error handling on API route

**Source**: `app/api/projects/[projectId]/analytics/route.ts:36-49`

```ts
} catch (error) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid ...' }, { status: 400 });
  if (error instanceof Error) {
    if (error.message === 'Unauthorized')    return NextResponse.json({ error: '...' }, { status: 401 });
    if (error.message === 'Project not found') return NextResponse.json({ error: '...' }, { status: 404 });
  }
  console.error('Analytics API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**How the heatmap applies this**:
- New route `app/api/projects/activity-heatmap/route.ts` mirrors this exactly. `Unauthorized` → 401 (constitution: auth errors never fall through to 500).
- Do NOT silently swallow errors (constitution "External call failures MUST be propagated").

### Pattern 8 — Mobile horizontal scroll with pinned left column

**Source**: `components/comparison/comparison-unified-metrics.tsx:80, 117`

```tsx
<CardContent className="overflow-x-auto">
  <table className="min-w-full text-sm">
    <thead>
      <tr>
        <th className="sticky left-0 z-10 bg-ctp-base px-3 py-2 text-left font-medium text-muted-foreground">
          Metric
        </th>
      ...
```

**How the heatmap applies this**:
- Heatmap is structurally a 7-row, N-column grid. Implement as a CSS-grid container in `overflow-x-auto` parent; day-of-week label column uses `sticky left-0 z-10 bg-background` (FR-028). Month labels are rendered as a separate sticky-top row if needed, but the first priority is the pinned weekday column.

---

## Decisions

### Decision 1 — Data scope: owned OR member projects

- **Decision**: Include jobs and tickets from projects where the current user is owner OR member (same scope as `/projects` listing).
- **Rationale**: Matches the scope of the page the user is on; surfaces meaningful heatmaps for member-heavy collaborators (spec's CONSERVATIVE fallback).
- **Alternatives considered**: Owned-only (`project.userId = currentUser`) — simpler query, but produces empty heatmaps for users who primarily contribute to projects they don't own.

### Decision 2 — Day bucket: server-side native date (UTC via Prisma)

- **Decision**: Bucket jobs by `formatDateForGrouping(job.completedAt ?? job.startedAt, 'daily')`, which derives the YYYY-MM-DD key from the Date's UTC ISO string (`toISOString().split('T')[0]`).
- **Rationale**: Cache-friendly, consistent across clients; matches the analytics dashboard's existing bucketing. Yearly-overview granularity tolerates ±1 day near midnight.
- **Alternatives considered**: Per-user timezone bucket via `Intl.DateTimeFormat` on the server — more accurate but requires a timezone hint in the request (the user's IANA zone is not currently captured). Out of scope per spec's CONSERVATIVE fallback.

### Decision 3 — Job commands contributing to cell intensity

- **Decision**: Count every job the system records (specify, plan, implement, verify, ship, quick-impl, iterate, health-scan, comment-*, deploy-preview, rollback-reset, onboard, retro-spec, ai-board-assist).
- **Rationale**: Matches "AI activity" framing; any filtering creates unexpected gaps in streaks.
- **Alternatives considered**: Exclude `rollback-reset` and `comment-*` as "meta" commands — rejected to keep the count legible and easy to explain.
- **Implementation note**: Because we count ALL job commands, the job `where` clause intentionally does NOT filter on `command`. Status filter: count jobs in any status except `PENDING` (i.e., any job that has actually run or completed) — rationale: a never-started job has no `startedAt` value of real activity. Use `startedAt IS NOT NULL` as the activity signal.

### Decision 4 — "Tickets shipped" counting

- **Decision**: A ticket counts as shipped on day D iff there exists a `Job` with `command='ship'`, `status='COMPLETED'`, and `DATE(completedAt) === D`.
- **Rationale**: Honors FR-003 and SC-007 exactly; legacy tickets with stage=SHIP but no completed ship job must not appear.
- **Alternatives considered**: Using `Ticket.stage = 'SHIP'` with `updatedAt` (what analytics does) — rejected because the spec explicitly forbids this pathway.

### Decision 5 — Intensity bucketing: non-zero percentile-based

- **Decision**: Five levels `{0, 1, 2, 3, 4}`. Level 0 is count=0. For non-zero counts in the period, compute p50, p75, p90 of the non-zero distribution; thresholds are `[t1, t2, t3, t4] = [1, p50, p75, p90]` (rounded up to integers, monotonic).
  - Level 1: `1 ≤ count < p50`
  - Level 2: `p50 ≤ count < p75`
  - Level 3: `p75 ≤ count < p90`
  - Level 4: `count ≥ p90`
- **Rationale**: Adaptive to each user's distribution (mirrors GitHub). A light user gets meaningful contrast; a heavy user's heatmap doesn't saturate.
- **Alternatives considered**: Fixed thresholds (1/3/5/10) — simpler, comparable across users, but heavy users' heatmaps saturate.
- **Edge case — degenerate distribution**: if non-zero counts have fewer than 4 unique values, merge adjacent buckets so thresholds stay monotonic. If zero non-zero days exist, all cells render at level 0 (empty-state handles the grid-wide empty period).

### Decision 6 — Layout: relax inner scroll, use page scroll

- **Decision**: Remove `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper on `projects-container.tsx:15`. Page gains natural scroll; heatmap is reachable by scrolling.
- **Rationale**: FR-011, FR-012; nested scroll regions are hostile to mouse-wheel and mobile users.
- **Alternatives considered**: Keep both regions scrollable — rejected; the page layout becomes confusing.

### Decision 7 — Refetch cadence: 15s interval + refetch-on-focus

- **Decision**: `useQuery({ refetchInterval: 15_000, staleTime: 10_000 })`. Default QueryClient config sets `refetchOnWindowFocus: false` — we do NOT override. The 15s interval is sufficient.
- **Rationale**: Matches usage/subscription/analytics polling cadence (`hooks/use-usage.ts:39`, `hooks/use-subscription.ts:34`). Consistency > theoretical savings.
- **Alternatives considered**: On-focus-only (cheaper) — rejected for consistency. 60s (cheaper) — rejected; 15s is the established norm.

### Decision 8 — Period selector: rolling 12mo + per-year since join

- **Decision**: Options = `"Last 12 months"` (default) followed by each calendar year from `user.createdAt.getFullYear()` through `now.getFullYear()`, reverse chronological.
- **Rationale**: FR-014, FR-015. Never expose years before the user signed up.
- **Implementation**: `resolvePeriod(input, joinYear, now)` returns `{ kind: 'rolling' | 'year', start: Date, end: Date, label: string }`. `enumerateYearsSinceJoin(joinYear, now)` builds the dropdown options.
- **Edge case — user joined this calendar year**: per FR-015, render the selector disabled with only "Last 12 months" OR hide it. **Chosen**: hide the selector entirely, since disabled single-option dropdowns are dead UI.

### Decision 9 — Agent filter visibility

- **Decision**: Server computes `availableAgents: { value: Agent, jobCount: number }[]` by resolving effective agent across the user's tickets. Client hides the filter when `availableAgents.length <= 1`.
- **Rationale**: FR-018. Dead UI is worse than no UI.

### Decision 10 — URL query-param keys

- **Decision**: `?period=<key>&agent=<key>`.
  - `period` values: `12m` (default, omitted from URL when equal to default) | `YYYY` for a specific year.
  - `agent` values: `all` (default, omitted from URL when equal to default) | Agent enum value (`CLAUDE`, `CODEX`, `MISTRAL`, `GEMINI`).
- **Rationale**: Short, human-readable. Omitting defaults keeps the URL clean when the user hasn't customized anything (SC-004).
- **Conflict check**: `/projects` doesn't currently consume any query params, so `period` and `agent` are free to claim.

### Decision 11 — Empty state trigger

- **Decision**: Empty state (FR-010) renders in place of the grid iff `totalJobs === 0 && totalShipped === 0` for the selected period AND the agent filter is `'all'`. When the agent filter is narrowed and reduces visible data to zero, show the grid with all level-0 cells (per Edge Case in spec).
- **Rationale**: Matches spec's Edge Case: "Agent filter reduces the visible data to zero: grid renders empty cells; the empty-state message does NOT appear".

### Decision 12 — Future-dated job clamp

- **Decision**: In the server query, filter `completedAt` (or `startedAt`) to `<= now` before bucketing. Cells beyond `now` in the current-year period are simply not rendered (the grid only iterates dates ≤ min(periodEnd, now)).
- **Rationale**: Edge Case "Future-dated job timestamps (clock drift)".

---

## Unknowns resolved

All `NEEDS CLARIFICATION` flags from Technical Context are resolved above. No outstanding clarifications remain.

---

## Open trade-offs (explicitly deferred)

- Historical backfill of missing `ship` jobs for legacy SHIP-stage tickets (flagged by spec as "separate data-backfill task, out of scope").
- Per-user timezone bucketing (deferred per Decision 2).
