# Research: Activity Heatmap on Projects Page (AIB-690)

**Feature Branch**: `AIB-690-activity-heatmap-on`
**Date**: 2026-04-19
**Spec**: `specs/AIB-690-activity-heatmap-on/spec.md`

## Scope

A GitHub-style contribution heatmap rendered on `/projects`, below the project cards grid, showing AI activity aggregated across all projects a user owns or is a member of, for either a rolling 12-month window or a specific calendar year, filterable by agent. No new database schema.

## Existing Files

The feature touches three domains: (a) the `/projects` server page and its client container, (b) analytics data access + API routing, and (c) shared UI primitives + query keys + date utilities. The inventory below is the authoritative set of real files this plan may modify or reference. Any path not listed here does not exist — do not invent new paths to sibling files without confirming them first.

### Projects page and layout

- `app/projects/page.tsx` — Server Component; uses `getUserProjects()`, force-dynamic. **Modify**: fetch initial heatmap data server-side and pass to a new `<ActivityHeatmap initialData={…} />` placed after `<ProjectsContainer />`.
- `components/projects/projects-container.tsx` — Client wrapper around the grid. **Modify**: line 15 has `overflow-y-auto max-h-[calc(100vh-200px)]`, which prevents the heatmap (rendered outside this wrapper in `page.tsx`) from being reachable under a long card list. FR-023 requires removing the max-height cap so natural page scroll carries the user past the cards to the heatmap.
- `components/projects/project-card.tsx` — No change.
- `app/layout.tsx`, `app/providers/query-provider.tsx` — No change; QueryProvider already wraps the tree.

### Data access (Prisma + queries)

- `lib/db/projects.ts` — `getUserProjects()` owner-OR-member WHERE clause (lines 28–79). **Pattern reference** for the user-accessible project set. Reuse its exact `OR: [{ userId }, { members: { some: { userId } } }]` shape.
- `lib/db/auth-helpers.ts` — `verifyProjectAccess(projectId)` enforces per-project access. **Not directly reusable**: heatmap aggregates across multiple projects for the current user, so the new API route authenticates via `requireAuth(request)` from `lib/db/users.ts` and scopes queries by the user-OR-member filter itself (same as `getUserProjects`).
- `lib/db/users.ts` — `requireAuth(request)` and `getCurrentUser(request)` handle session + PAT + test-user-override auth. **Reuse as-is**.
- `lib/analytics/queries.ts` — Canonical analytics data layer. Key patterns to reuse:
  - `buildEffectiveAgentWhere()` (lines 51–69): effective-agent resolution where `ticket.agent` OR (`ticket.agent IS NULL` AND `ticket.project.defaultAgent = agent`). Reuse verbatim inside heatmap queries.
  - `getAvailableAgents()` (lines 190–245): computes distinct agents across the user's tickets including "All" option and job counts. Adapt to project-set scope (not single projectId).
  - Job WHERE shape (lines 147–163): `{ projectId, status: {in: [COMPLETED, FAILED]}, ticket: {is: membershipWhere}, completedAt: {gte: rangeStart} }`. Adapt by replacing `projectId` with `projectId: {in: accessibleProjectIds}`.
- `lib/analytics/aggregations.ts` — Pure utilities. Already has `getISOWeek()` and `formatDateForGrouping()` but no quantile bucketing. **Extend**: add `computeQuantileBuckets()` and `assignIntensityBucket()` here so they are unit-testable alongside other aggregations.
- `lib/analytics/types.ts` — Analytics types (AgentFilter, AgentOption, etc.). **Extend**: add heatmap-specific types (HeatmapPeriod, DailyCell, HeatmapSummary, HeatmapData) OR place them in a new `lib/analytics/heatmap-types.ts`. **Decision**: new file `lib/analytics/heatmap-types.ts` to avoid crowding `types.ts` with a new domain; import AgentFilter, AgentOption, NamedAgent from `./types` to avoid duplication.
- `prisma/schema.prisma` — **Read-only** reference. `Job.completedAt`, `Job.status`, `Job.command`, `Job.costUsd`, `Job.projectId`; `Ticket.agent`, `Ticket.projectId`; `Project.defaultAgent`, `Project.userId`, `Project.members`. No migration.

### API routing

- `app/api/projects/[projectId]/analytics/route.ts` — **Pattern reference** for Zod-validated GET handler with try/catch, `NextResponse.json()`, structured error codes. The heatmap route is not project-scoped, so live under a different URL.
- **New**: `app/api/activity/heatmap/route.ts` — Aggregates across accessible projects for the signed-in user. Follows the same error-handling shape as the analytics route.
- Alternative `app/api/projects/activity/heatmap/route.ts` rejected because Next.js routes treat `projects/activity` as a literal segment alongside `projects/[projectId]`, and placing a static segment as a sibling of a dynamic one needlessly couples the heatmap URL to the project resource tree. `app/api/activity/heatmap` is simpler.

### Client components (heatmap UI)

- `components/analytics/analytics-dashboard.tsx` — **Pattern reference** for:
  - URL-synced filter state via `useRouter()` + `useSearchParams()` (lines 85–109).
  - `useQuery` with `initialData` gated by `filtersMatch()` + `refetchInterval: 15000` + `staleTime: 10000` (lines 94–100).
  - Select-based filter UI using `@/components/ui/select`.
- `components/ui/tooltip.tsx` — Radix Tooltip (hover semantics; desktop). **Reuse as-is**.
- `components/ui/popover.tsx` — Radix Popover (click / tap with outside-click dismiss). **Reuse as-is** for mobile tap-tooltip behavior (FR-019).
- `components/ui/select.tsx` — For period and agent dropdowns. **Reuse as-is**.
- `components/comparison/comparison-compliance-heatmap.tsx` — Existing table-based heatmap. Similar enough in spirit to confirm sticky-left-column + `overflow-x-auto` + `TooltipProvider` pattern. **Pattern reference only** — different layout (rows are principles, not weekdays) so no direct code reuse.
- **New**: `components/projects/activity-heatmap.tsx` — Top-level heatmap component: period + agent filters, summary header, grid, legend, empty state, error state, SSR hydration.
- **New**: `components/projects/activity-heatmap-grid.tsx` — Pure presentational 7×N grid with sticky left day-label column, month labels along top, chipped corners at period edges.
- **New**: `components/projects/activity-heatmap-cell.tsx` — Single cell with tooltip/popover trigger and intensity-bucket class.

### Hooks, query keys, utilities

- `app/lib/query-keys.ts` — Centralized query keys. **Extend**: add `heatmap: { data: (userId, period, agent) => [...] }`.
- `app/lib/utils/agent-resolution.ts` — `ALL_AGENTS`, `AGENT_LABELS`, `resolveEffectiveAgent()`. **Reuse as-is**.
- `app/lib/utils/date-utils.ts` — Existing date helpers. **Read first**; extend if it already covers `startOfDay` / `formatLocalDate` helpers the heatmap needs. If not present, add heatmap-specific helpers inside `lib/analytics/aggregations.ts` (not a new file, since the single owner is the heatmap).
- `date-fns` (^4.1.0) — Installed; use for `startOfYear`, `endOfYear`, `startOfDay`, `eachDayOfInterval`, `format`, `getDay` with option `weekStartsOn: 1` (Monday). Local-timezone computation happens on the client; the server emits ISO date strings keyed as UTC-midnight boundaries, and the client re-interprets them against the browser's locale.

### Tests

- `tests/integration/analytics/analytics-route.test.ts` — **Pattern reference** for Vitest + Prisma fixtures + `vi.mock('@/lib/db/auth-helpers', …)` + calling route handlers directly with `NextRequest`.
- `tests/unit/components/analytics-dashboard.test.tsx` — **Pattern reference** for `renderWithProviders()` + userEvent for filter dropdowns.
- `tests/unit/components/comparison-compliance-heatmap.test.tsx` — **Pattern reference** for a heatmap-like component; confirms tooltip + cell color assertions via `getByRole` / `getByText`.
- `tests/fixtures/vitest/setup.ts` (`getTestContext()`) and `tests/helpers/db-cleanup.ts` (`getPrismaClient()`) — **Reuse as-is** for integration tests.

**New test files** (create only where no existing file covers the domain):
- `tests/unit/heatmap-aggregations.test.ts` — Unit tests for `computeQuantileBuckets`, `assignIntensityBucket`, ISO-week grouping for the 7×N grid, chipped-corner derivation, empty-bucket handling. (No existing `heatmap-aggregations` file — new domain.)
- `tests/integration/analytics/heatmap-route.test.ts` — Integration test for the new `/api/activity/heatmap` endpoint, sibling to `analytics-route.test.ts`. (Existing analytics tests are single-project scoped; heatmap is user-scoped, different query shape, separate concern.)
- `tests/unit/components/activity-heatmap.test.tsx` — Component test for filter behavior, empty/error states, tooltip contents, SSR initial-data path. (No existing file.)

## Patterns to Follow

### 1. Server-to-client initial data hydration (no spinner flash)

**Reference**: `components/analytics/analytics-dashboard.tsx:85-103`

```ts
const [filters, setFilters] = useState<AnalyticsFilters>(() =>
  getInitialFilters(searchParams, initialData)
);
const shouldUseInitialData = filtersMatch(filters, initialData.filters);

const { data, isLoading } = useQuery({
  queryKey: queryKeys.analytics.data(projectId, filters.range, filters.outcome, filters.agent),
  queryFn: () => fetchAnalytics(projectId, filters),
  initialData: shouldUseInitialData ? initialData : undefined,
  refetchInterval: 15000,
  staleTime: 10000,
});
```

**How to apply to heatmap**:
- `app/projects/page.tsx` (server) awaits `getHeatmapData({ userId, period, agent })` using the same searchParam-derived filters passed from the URL, then renders `<ActivityHeatmap initialData={…} />`.
- `components/projects/activity-heatmap.tsx` (client) follows this exact shape with `queryKeys.heatmap.data(userId, period, agent)`.
- Satisfies FR-020: initial paint never shows a spinner, and `initialData` is provided only when the active filters match the server-rendered filters.

### 2. URL-synced filter state

**Reference**: `components/analytics/analytics-dashboard.tsx:105-109`

```ts
const updateFilters = (nextFilters: AnalyticsFilters) => {
  setFilters(nextFilters);
  const params = buildFilterSearchParams(searchParams, nextFilters);
  router.push(`?${params.toString()}`, { scroll: false });
};
```

**How to apply**: Use `heatmapPeriod` and `heatmapAgent` keys. The build function MUST delete the keys when they equal defaults (`last12months` / `all`) so the URL stays clean on fresh loads (spec Auto-Resolved decision #3; FR-016). The existing analytics builder always sets the keys — do NOT copy that behavior; check `nextFilters.period === 'last12months'` and `nextFilters.agent === 'all'` before deciding to `set()` vs `delete()`.

### 3. Effective-agent resolution

**Reference**: `lib/analytics/queries.ts:51-69`

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

**How to apply**: Reuse verbatim for heatmap job filtering and for the `Ticket` query that derives shipped-ticket counts. Satisfies FR-015. Do NOT create a new resolver — import from `lib/analytics/queries.ts` (promote it to an exported helper as part of this plan) or from a shared `lib/analytics/agent-filter.ts`. **Decision**: promote `buildEffectiveAgentWhere` by exporting it from `lib/analytics/queries.ts` without moving it, because moving risks breaking existing imports and the function's natural home is the analytics layer.

### 4. User-accessible project set

**Reference**: `lib/db/projects.ts:28-79` (`getUserProjects`)

```ts
where: {
  OR: [{ userId }, { members: { some: { userId } } }],
}
```

**How to apply**: The heatmap data function must first resolve `accessibleProjectIds` using exactly this OR clause. Subsequent job and ticket queries filter by `projectId: { in: accessibleProjectIds }`. This mirrors the authorization model used for the rest of `/projects` (FR-025).

### 5. API error handling

**Reference**: `app/api/projects/[projectId]/analytics/route.ts:36-50`

```ts
} catch (error) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Invalid analytics filters' }, { status: 400 });
  }
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
  }
  console.error('Analytics API error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

**How to apply**: The heatmap route uses the same structure. Unauthorized → 403, Zod → 400, else 500. On the server-side initial fetch in `app/projects/page.tsx`, wrap the `getHeatmapData()` call in try/catch so a failure degrades to `<ActivityHeatmap initialData={null} initialError={…} />`, matching the spec's "Couldn't load activity — please refresh" non-blocking error requirement. The `/projects` cards MUST still render (spec line 200).

### 6. Client state on failed polling

**Reference**: `hooks/use-usage.ts` + analytics-dashboard.tsx. The `useQuery` pattern with `initialData` + `staleTime: 10000` + `refetchInterval: 15000` already preserves the last-successful data on refetch failure; TanStack Query does not blank the cache on error. **How to apply**: do nothing special — the pattern already satisfies FR-020's "polled refreshes that fail must not blank the grid". The component renders `data ?? initialData` as the single source of truth for grid cells.

### 7. Tailwind color classes must be literal strings

**Reference**: `CLAUDE.md` Tailwind Classes rule.

```ts
// WRONG — Tailwind purger will not see these
const cls = `aurora-heatmap-bucket-${n}`;

// RIGHT — complete literal strings
const BUCKET_CLASSES = [
  'aurora-heatmap-bucket-0',
  'aurora-heatmap-bucket-1',
  'aurora-heatmap-bucket-2',
  'aurora-heatmap-bucket-3',
  'aurora-heatmap-bucket-4',
] as const;
const cls = BUCKET_CLASSES[bucket];
```

**How to apply**: The cell-color helper returns a value from a fixed 5-element array of literal class names. Same applies to any derived day/weekday class.

### 8. No hardcoded hex colors

**Reference**: `CLAUDE.md` Colors rule + `app/globals.css` + `components/comparison/comparison-compliance-heatmap.tsx` (uses `aurora-cell-*` utility classes, not inline hex).

**How to apply**: Add 5 new `aurora-heatmap-bucket-0..4` utility classes to `app/globals.css` `@layer utilities`, built on `--primary-violet` and `--ctp-*` tokens. Bucket 0 uses a muted surface tone; buckets 1–4 use increasing violet saturation. No `text-[#…]` or `bg-[#…]` anywhere in the component tree. All text tokens come from semantic tokens (`text-foreground`, `text-muted-foreground`, etc.). WCAG AA 4.5:1 contrast for the header, legend labels, tooltip text, and empty-state message (FR-027).

### 9. Atomicity and sequencing (not a mutation feature)

The heatmap is read-only — no Prisma transactions, no workflow dispatch, no webhook handoff. Constitution §V "Database Integrity" still applies trivially: we perform `prisma.project.findMany` → `prisma.job.findMany` → `prisma.ticket.findMany` in that order, all read-only; the functional completeness of one query does not depend on the completion of another. **How to apply**: keep the three queries in a single `Promise.all` where possible to reduce round-trips, but the order of resolution is immaterial since no state mutates.

### 10. Component extraction discipline

**Reference**: Constitution §II — extract a sub-component only when (a) reused ≥2, (b) has own state/effects/data, or (c) parent exceeds ~300 lines. **How to apply**: `ActivityHeatmap` (parent) will contain filters, summary, and error/empty states. The grid is extracted into `ActivityHeatmapGrid` because it has its own useEffect for the sticky-column horizontal-scroll handling (mobile) and is ≈>150 lines of JSX. The cell is extracted because each cell owns its own tooltip/popover state and there are ≈371 of them (7×53) — inlining would make the parent unreadable. Do NOT extract `Legend`, `MonthLabels`, or `DayLabels` — these are inline JSX blocks under 40 lines.

## Research Decisions

### Decision: 5-bucket quantile intensity scale

- **Decision**: Bucket 0 = zero jobs. Buckets 1–4 split the set of non-zero day counts using the 25th, 50th, 75th, and 100th percentiles (i.e., p25/p50/p75 as boundaries). Empty-bucket guard: when any day has ≥1 job but all non-zero days share the same count, assign bucket 1 (never empty when there is activity).
- **Rationale**: Matches the 5-swatch legend in the spec. Quantiles adapt the color scale per-user so a low-volume account still sees variation; a high-volume account is not flattened by a single outlier day. This matches the Auto-Resolved decision #1 in the spec.
- **Alternatives considered**: (a) Fixed thresholds (e.g., 1, 3, 6, 12) — rejected: bad UX for low-volume users; (b) Logarithmic scale — rejected: harder to explain, marginal benefit over quantiles; (c) 4-bucket scale — rejected: spec legend has 5 swatches.

### Decision: URL parameter scheme

- **Decision**: `heatmapPeriod=last12months|YYYY`, `heatmapAgent=all|CLAUDE|CODEX|MISTRAL|GEMINI`. Defaults are NOT written to the URL (builder omits the key when value is default).
- **Rationale**: Namespaced keys prevent collision with any other filter widget on `/projects`. Matches Auto-Resolved decision #3. Invalid values (unknown year, bogus agent) are coerced to defaults on both server and client read paths (edge case in spec line 145).
- **Alternatives considered**: Bare `period=` / `agent=` — rejected: collision risk with future widgets. Hash fragment — rejected: not SSR-accessible in Next.js App Router.

### Decision: No new endpoint per project — single user-scoped endpoint

- **Decision**: `GET /api/activity/heatmap?period=&agent=` returns data aggregated across all accessible projects for the signed-in user.
- **Rationale**: The UI always aggregates across the user's whole project set. A per-project endpoint would require `N` parallel calls, each needing auth, each needing the same quantile pass. A single endpoint is 1 RPC and keeps the quantile computation coherent (percentiles over the full cross-project day counts).
- **Alternatives considered**: `/api/projects/:id/activity/heatmap` and client fan-out — rejected: N calls, N auth checks, and client-side quantile bucketing becomes harder across disparate responses.

### Decision: 14px min cell size on mobile with horizontal scroll

- **Decision**: Cells are CSS grid with `minmax(14px, 1fr)` on columns, `gap: 2px`. On viewports where 53 × 16px = 848px exceeds container width, the grid's parent has `overflow-x-auto` and the left weekday-label column uses `position: sticky; left: 0`.
- **Rationale**: Matches Auto-Resolved decision #4. Satisfies FR-021/FR-022. Sticky column keeps Mon/Wed/Fri legible while scrolling. Preserves tappable targets.
- **Alternatives considered**: Shrinking cells below 14px — rejected: miss-tap risk. Vertical wrap — rejected: breaks the 7-row weekday semantic.

### Decision: Browser-local calendar day grouping

- **Decision**: Server returns per-day aggregates keyed by `YYYY-MM-DD` **in UTC**, plus each cell's raw `completedAt` count already bucketed server-side. Client interprets those dates against the browser's local timezone only for tooltip formatting. The grid itself is built from UTC date keys.
- **Rationale**: The spec says cells represent "local calendar day in the user's browser timezone", but doing per-request timezone-aware grouping on the server without knowing the browser's tz is impossible. UTC bucketing is deterministic, cache-friendly, and within ±1 hour at DST boundaries — a tolerable trade-off for a year-view heatmap whose cells are already rounded to 14px. Tooltip labels are formatted via `date-fns` on the client so the formatted date label ("Tuesday, April 15, 2025") reads correctly in the user's locale. Edge case from spec line 140 (DST transitions) is satisfied: UTC produces exactly one cell per calendar day with no duplicates or gaps.
- **Alternatives considered**: Sending the browser tz in the request — rejected: couples SSR render to a client-only value. Grouping by `completedAt` in the user's tz on the client — rejected: client has to re-aggregate per refetch, defeating the SSR-first render.
- **Reviewer note**: If QA surfaces a case where a user in UTC−12 sees a day shifted, we would revisit this by accepting a `tz=` query parameter and letting the server group in that timezone. Not part of MVP.

### Decision: Ticket "shipped" counting

- **Decision**: A ticket is counted in the header summary ("Y tickets shipped") once, if it has at least one `ship` job with `status='COMPLETED'` in the period. The per-day cell tooltip shows the count of completed `ship` jobs on that day (not distinct tickets).
- **Rationale**: Matches Auto-Resolved decision #5 and FR-010. Retries within a day count as activity in the tooltip but do not inflate the header.
- **Alternatives considered**: Counting distinct tickets everywhere — rejected: tooltip loses the "how busy was this day" signal.

### Decision: Page-level layout — remove inner scroll on projects container

- **Decision**: Remove `overflow-y-auto max-h-[calc(100vh-200px)]` from `components/projects/projects-container.tsx:15`. Let the outer page scroll naturally so the heatmap below is reachable.
- **Rationale**: FR-023 explicitly requires this. The existing inner scroll was there to keep card grids visible alongside a fixed header, but removing it breaks nothing visible (the header is already in `page.tsx`'s `container` div, not fixed).
- **Alternatives considered**: Adding a `<div className="mt-8">{heatmap}</div>` inside the scroll container — rejected: it would be scroll-reachable only by scrolling an inner container, failing the "reachable by natural page scroll" requirement.

### Decision: Recharts not used; custom CSS Grid implementation

- **Decision**: The heatmap grid is a `<div>` with `display: grid` (7 rows × ~53 columns), not Recharts, not SVG.
- **Rationale**: Recharts has no first-class calendar heatmap primitive; building one would mean SVG rectangles positioned manually, plus its own tooltip pipeline. CSS Grid is simpler, accessible (each cell is a real DOM node so screen readers can describe it), and gives us per-cell Radix `Tooltip` / `Popover` trivially. Month labels are a separate `<div>` aligned with CSS grid column tracks; day labels are a sticky-positioned column.
- **Alternatives considered**: `react-calendar-heatmap` library — rejected: adds a dependency, not theme-aware, tooltip integration would still need custom code. Pure SVG — rejected: loses accessibility and complicates sticky positioning.

## Unknowns

None unresolved. All spec items marked **Auto-Resolved** have been mapped to concrete decisions above, and the spec contains no `NEEDS CLARIFICATION` markers.
