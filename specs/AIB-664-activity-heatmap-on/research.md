# Research: Activity Heatmap on Projects Page (AIB-664)

## Scope

Add a GitHub-style contribution heatmap to `/projects`, showing per-day job counts across all projects the authenticated user can access (owned OR member-of), with period selection (rolling 12 months or a calendar year), agent filter, tooltips (date / shipped ticket count / job count / cost), URL-synced filters, and server-rendered initial data refreshed every 15s via TanStack Query.

All NEEDS CLARIFICATION items in the spec's Auto-Resolved Decisions are already resolved — the section below records the concrete technical choices.

## Decisions

### Decision: Reuse the `/api/projects/[projectId]/analytics` aggregation pattern, but scoped per-user rather than per-project
- **Rationale**: The analytics module (`lib/analytics/queries.ts`, `lib/analytics/aggregations.ts`) already implements the exact primitives we need — `buildEffectiveAgentWhere` for `ticket.agent ?? project.defaultAgent` resolution, per-granularity date binning, Zod-validated route params, and a 15s-polled client hook. The heatmap is semantically a user-wide analytics query, so we follow the same shape: a `lib/heatmap/queries.ts` module that returns `HeatmapData`, consumed by a new `/api/heatmap` route and a client `ActivityHeatmap` component. This keeps the two query surfaces consistent (future refactors can move both under a shared abstraction).
- **Alternatives considered**: (a) Reusing the project-scoped route by calling it once per project — rejected: N queries per page load. (b) A GraphQL-style single query — rejected: the stack uses Prisma + REST; introducing GraphQL for one endpoint violates CLAUDE.md's forbidden-dependencies posture.

### Decision: Endpoint shape — `GET /api/heatmap?period=last-12-months|YYYY&agent=all|CLAUDE|CODEX|MISTRAL|GEMINI`
- **Rationale**: Matches the URL query-param contract in the spec (FR-011). Missing/invalid params fall back silently (Zod `.catch()` with defaults). Authorization is per-request via `requireAuth()`; the query itself filters to `projectId IN (user's accessible project ids)` rather than asking for a project id in the path.
- **Alternatives considered**: `/api/users/me/heatmap` — rejected: we do not have a `users/me` resource; the current analytics route is `/api/projects/:projectId/analytics`, and a top-level `/api/heatmap` mirrors the "this is the signed-in user's scope" intent more cleanly.

### Decision: Intensity scale = 5 levels (empty + 4 violet shades), bucket thresholds derived from quartiles of the user's non-zero daily job counts for the selected period
- **Rationale**: Matches the spec's visual reference (GitHub-style "Less □□■■■ More"). Quartile bucketing over *non-zero* days adapts to heavy and light users both. Thresholds are computed server-side and returned in the payload so the client does not recompute.
- **Alternatives considered**: Fixed linear thresholds (e.g., 1, 3, 5, 10+) — rejected: light users see all cells at the same shade; heavy users hit the top bucket early.

### Decision: "Shipped ticket" count uses successful `ship` jobs, keyed on `completedAt` date (day-bucketed in server TZ), distinct by `ticketId`
- **Rationale**: FR-020 explicitly: a ticket only counts as shipped if its `ship` job reached `COMPLETED`. `Job.command = 'ship'` AND `Job.status = 'COMPLETED'` AND `Job.completedAt` in range. DISTINCT on `ticketId` to avoid double-counting tickets that were re-shipped.
- **Alternatives considered**: Counting tickets whose `stage = SHIP` with `updatedAt` in range — rejected: this is what `lib/analytics/queries.ts:getCompletionMetrics` does for the per-project dashboard, but the ticket explicitly says stage transitions alone MUST NOT count (edge case line 153).

### Decision: Cost aggregation sums `Job.costUsd` where non-null for the day; if ALL jobs that day have `costUsd = null`, the tooltip omits the cost line entirely (FR-012, SC-006)
- **Rationale**: Guards against `$NaN` / `$0` rendering. The payload returns `totalCost: number | null` per day — `null` means "no cost recorded on any job this day".
- **Alternatives considered**: Returning `0` and hiding in the UI — rejected: brittle, the "$0 vs no cost" distinction would leak through the wire and every client reading the payload would need to reimplement the guard.

### Decision: Agent filter options are derived server-side from distinct effective agents in the user's jobs for the selected period, via the **unfiltered** dataset
- **Rationale**: FR-010 says the filter must not change grid boundaries — and the spec's acceptance scenario 2 for US3 says the filter is hidden if there are ≤1 distinct agents. Building the list from the unfiltered dataset keeps the dropdown stable when the user picks an agent (their chosen value does not disappear from the list).
- **Alternatives considered**: Deriving from all agents the user has ever used — rejected: would show agents with zero activity in the visible period, which is confusing.

### Decision: Server renders initial data by calling `getHeatmapData()` directly from the `/projects` page's server component; client hydrates and polls every 15s
- **Rationale**: Matches `lib/analytics/queries.ts:getAnalyticsData` called from the analytics page and passed into `<AnalyticsDashboard initialData={…} />`. This eliminates the first-paint spinner (SC-001) and matches the 15s polling precedent from CLAUDE.md.
- **Alternatives considered**: SWR-style client-only fetching — rejected: the first-paint spinner is disallowed by SC-001.

### Decision: Week starts on Sunday (row 0 = Sunday, row 6 = Saturday); grid columns are weeks
- **Rationale**: Spec Auto-Resolved Decision ("Week starts on Sunday") and GitHub convention. Dates before the period's first Sunday are rendered as empty cells (corner-chipping); same for the tail.
- **Alternatives considered**: Respecting user locale — rejected: explicit spec decision.

### Decision: Period selector options are built from `User.createdAt`
- Options: "Last 12 months" (default) + one per calendar year from `createdAt.getFullYear()` to the current year, in descending order. If `createdAt.getFullYear() === currentYear`, only "Last 12 months" is offered (FR-007).
- **Rationale**: Directly satisfies FR-007.
- **Alternatives considered**: Deriving from earliest-job year — rejected: a returning user with no old jobs would suddenly lose their year options when data is pruned.

### Decision: URL param names — `period` and `agent`; hash-preserved via `router.push('?…', { scroll: false })`
- **Rationale**: Matches the analytics dashboard pattern (`components/analytics/analytics-dashboard.tsx:108`). "period" is neutral and won't collide with `/projects` query keys (no existing query params on that page).
- **Alternatives considered**: `year` + `agent` — rejected: `year` does not encode the "last-12-months" default case; a distinct enum value is cleaner.

### Decision: Horizontal scroll on narrow viewports with a sticky left column for day-of-week labels; page flow is natural vertical scroll (no inner vertical scroll trap)
- **Rationale**: FR-016 / FR-017. Tailwind: `overflow-x-auto` on the grid wrapper, `sticky left-0` on the day-of-week column, and the ProjectsContainer above is given `overflow-visible` so the heatmap scrolls with the page.
- **Alternatives considered**: Responsive cell shrink — rejected: violates SC-007's tappable-size constraint.

### Decision: Cell colors use dark-theme-readable violets from the aurora gradient palette in `globals.css`
- Empty cell = `bg-muted/30`; levels 1–4 = four aurora violet shades. Chosen as fixed palette classes per CLAUDE.md Tailwind purger rule — classes are complete literal strings returned from a helper `getIntensityClass(level: 0|1|2|3|4)`.
- **Rationale**: CLAUDE.md forbids dynamic class construction. The helper returns one of five literal strings.
- **Alternatives considered**: Inline `style={{ backgroundColor }}` — rejected: CLAUDE.md forbids hex in JSX and Tailwind-safelisted literal classes are the accepted path.

### Decision: No new database tables, no new Prisma migrations
- FR-018: the feature uses existing `Job`, `Ticket`, `Project`, `User`. The heatmap is a derived aggregation computed at query time.

## Existing Files

The paths below were discovered via codebase exploration. This inventory is the basis for the implementation phases — files marked **Extend** already cover the concern; files marked **New** are needed because no current file covers that exact responsibility.

### Projects page (UI entry point)
- `app/projects/page.tsx` — **Extend**. Server component for `/projects`. Add server-side call to `getHeatmapData(user, period, agent)` and render `<ActivityHeatmap initialData={…} period={…} agent={…} />` below `<ProjectsContainer />`. Must read `searchParams` for initial URL-driven filter state.
- `components/projects/projects-container.tsx` — **Extend** (possibly). Review its CSS: if it sets an inner vertical `overflow-y-scroll` that blocks the page from scrolling to the heatmap, relax it (FR-017).

### Heatmap data/query layer (NEW, parallels `lib/analytics`)
- `lib/heatmap/queries.ts` — **New**. `getHeatmapData(userId, filters): Promise<HeatmapData>`. Internally:
  - resolves accessible project ids via the same `{ OR: [{ userId }, { members: { some: { userId } } }] }` clause used in `lib/db/projects.ts:getUserProjects` (do not duplicate the literal; extract a helper `getAccessibleProjectIdsForUser(userId)`).
  - runs a single `prisma.job.findMany` over those project ids with `completedAt` in the selected period; selects `{ completedAt, costUsd, command, status, ticketId, ticket: { agent, project: { defaultAgent } } }`.
  - aggregates per-day into `{ date, jobCount, totalCost|null, shippedTicketIds: Set<number> }` and computes `shippedTicketCount = shippedTicketIds.size`.
  - computes intensity thresholds (quartiles of non-zero day counts).
  - builds `availableAgents` (distinct effective agents with jobCount > 0 in the unfiltered payload).
  - applies the agent filter (if not `'all'`) as the last step, reusing `resolveEffectiveAgent` from `app/lib/utils/agent-resolution.ts:41`.
  - returns `HeatmapData` (see data-model.md).
- `lib/heatmap/aggregations.ts` — **New**. Pure functions: `getPeriodBounds(period, userCreatedAt, now)`, `computeIntensityThresholds(dailyCounts)`, `getIntensityLevel(count, thresholds)`, `buildPeriodOptions(userCreatedAt, now)`. Kept separate from queries so they are trivially unit-testable.
- `lib/heatmap/types.ts` — **New**. Canonical TypeScript types: `HeatmapPeriod`, `HeatmapFilters`, `HeatmapDayCell`, `HeatmapData`, `HeatmapAgentOption`, `HeatmapPeriodOption`.

Rationale for not extending `lib/analytics/*`: the analytics module's types (`AnalyticsFilters`, `TimeRange='7d'|'30d'|...`) and its per-project scope differ enough that mixing the two surfaces would be the wrong kind of coupling. A sibling module is the right granularity.

### API route (NEW)
- `app/api/heatmap/route.ts` — **New**. `GET` handler. Zod schema validates `period` and `agent` query params; invalid ones fall back to defaults via `.catch()`. Calls `requireAuth()` from `lib/db/users.ts`, then `getHeatmapData(userId, filters)`. Error shape mirrors `app/api/projects/[projectId]/analytics/route.ts`: 400 on Zod throw (only for truly malformed requests, not invalid param values which are coerced), 401 on auth failure, 500 fallback. **No 403/404 branch**: the scope is "whatever the user can see"; an empty result is a valid response, not a forbidden one.

### Client component (NEW)
- `components/projects/activity-heatmap.tsx` — **New**. `'use client'`. Props: `{ initialData: HeatmapData; initialFilters: HeatmapFilters; userCreatedYear: number }`. Uses `useQuery` with `refetchInterval: 15000`, `staleTime: 10000`, initial data when `filtersMatch(initialFilters, filters)` (copy the `filtersMatch` helper pattern from `analytics-dashboard.tsx:56`). Uses `useRouter`/`useSearchParams` to sync filters to URL via `router.push('?…', { scroll: false })`. Renders:
  - Header counts ("X jobs · Y tickets shipped in the last year" — wording changes with period).
  - Period `<Select>` and agent `<Select>` (shadcn/ui, same pattern as `analytics-dashboard.tsx:138`).
  - A CSS grid: `grid-rows-7 grid-flow-col auto-cols-min`, cells positioned by day-of-week and week-index.
  - Day-of-week labels column (sticky left).
  - Month labels row above the grid.
  - Legend bottom-right: "Less □□□□■ More".
  - Empty-state substitution when `data.totalJobs === 0` (FR-015).
- `components/projects/activity-heatmap-cell.tsx` — **New** (if the parent exceeds ~300 lines per constitution II). Single cell with tooltip (uses `components/ui/tooltip.tsx`). On mobile, tooltip is an `onClick` that opens and closes on outside tap (standard Radix behaviour with `open`/`onOpenChange`).

Justification for splitting: the cell component has its own state (tooltip open/closed), and mobile tap-dismiss behaviour is self-contained. Meets constitution II criterion (b): "has its own state/effects".

### Query key and hook plumbing
- `app/lib/query-keys.ts` — **Extend**. Add `heatmap: { data: (period: string, agent: string) => ['heatmap', period, agent] as const }`. Placed alongside `analytics` for symmetry.

### Authorization helpers
- `lib/db/projects.ts` — **Extend**. Add `getAccessibleProjectIdsForUser(userId: string): Promise<number[]>`. This is the one piece of duplicated-shape code between `getUserProjects` and the new `getHeatmapData`; extracting it once avoids divergence. Callers: the heatmap query layer. Keep `getUserProjects` as-is for now to avoid churn.
- `lib/db/users.ts` — **Reuse as-is**. `requireAuth(request?)` is the single auth entry point.

### Agent resolution
- `app/lib/utils/agent-resolution.ts` — **Reuse as-is**. `resolveEffectiveAgent`, `ALL_AGENTS`, `AGENT_LABELS`, `getAgentLabel` all directly usable.

### Existing Test Files (to extend vs create new)
Searched `tests/unit/`, `tests/unit/components/`, `tests/integration/`, `tests/e2e/`:
- `tests/integration/analytics/analytics-route.test.ts` — **Reference, do not extend**. Tests the project-scoped route; the heatmap route tests live under `tests/integration/heatmap/`.
- `tests/unit/components/analytics-dashboard.test.tsx` — **Reference**. Pattern for URL-filter + initial-data component tests; do not modify.
- No existing file covers `/projects` page integration end-to-end — **create new**:
  - `tests/integration/heatmap/heatmap-route.test.ts` — API route (auth, param parsing, fallback for invalid params, aggregation correctness, agent filter, shipped-ticket counting rules).
  - `tests/integration/heatmap/heatmap-queries.test.ts` — query-layer unit coverage (access scoping, effective-agent resolution, cost sum with nulls, intensity thresholds, period bounds, corner-chipping data).
  - `tests/unit/components/activity-heatmap.test.tsx` — component render + interaction: URL sync, period change updates header copy, agent filter hiding when ≤1 agent, empty-state message, tooltip content shape and `$NaN`/`$0` guard, hover vs tap behaviour.
  - `tests/unit/heatmap-aggregations.test.ts` — pure functions: `getPeriodBounds` (incl. leap-year 2024), `computeIntensityThresholds` (quartiles on various distributions incl. all-zero), `buildPeriodOptions` (account-year = current year ⇒ single option).
- No existing e2e test exercises `/projects` for an authenticated user — **create new (only if warranted)**:
  - `tests/e2e/projects-heatmap.e2e.ts` — ONE scenario: sign in as seeded user → `/projects` renders heatmap cells without spinner flash (SC-001) and URL-driven period persists across reload (SC-005). All other behaviour is covered by integration and component tests. Per the constitution testing tree (point 4), the browser is only required for the no-spinner-flash assertion in a realistic rendering environment; if that can be asserted at the component level, drop this file entirely.

## Patterns to Follow

### Pattern 1: Server-initial-data + client polling (source: `components/analytics/analytics-dashboard.tsx:85-109`, `app/projects/[projectId]/analytics/page.tsx`)
- Server component awaits the query function and passes `initialData` to the client component.
- Client component uses `useQuery({ initialData: shouldUseInitialData ? initialData : undefined, refetchInterval: 15000, staleTime: 10000 })`.
- `shouldUseInitialData` is true only when current filters match the ones that produced `initialData` (line 92 `filtersMatch`).
- When the user changes a filter, `setFilters(next)` + `router.push('?…', { scroll: false })` fires; the subsequent render calls `useQuery` with the new filters, sees no `initialData`, and fetches.
- **New code MUST follow this pattern verbatim.**

### Pattern 2: Zod-validated query params with silent fallback (source: `app/api/projects/[projectId]/analytics/route.ts:7-32`)
- Define a Zod schema with `.default(...)` per field.
- `querySchema.parse({ period: searchParams.get('period') || undefined, agent: searchParams.get('agent') || undefined })`.
- For the `period` field, a strict enum won't work because it accepts both `'last-12-months'` and any 4-digit year. Use `z.string().transform(…)` to normalize, with a fallback via `.catch('last-12-months')` so malformed values fall back silently (FR-011).
- **Error handling branches to mirror** (route.ts:37-50): `ZodError ⇒ 400`, `Error 'Unauthorized' ⇒ 401` (not 403 — the heatmap has no project-level gate), generic catch ⇒ 500 + `console.error`.

### Pattern 3: Effective agent resolution (source: `lib/analytics/queries.ts:51-69 buildEffectiveAgentWhere` and `app/lib/utils/agent-resolution.ts:41 resolveEffectiveAgent`)
- At the DB level: `where: { OR: [{ agent: targetAgent }, { agent: null, project: { is: { defaultAgent: targetAgent } } }] }` — copy this exact shape for the agent filter.
- At the application level (when bucketing into `availableAgents`): `ticket.agent ?? ticket.project.defaultAgent` via `resolveEffectiveAgent`.
- **Security pattern**: no injection risk — agent values are Zod-enum-validated from a fixed set (`ALL_AGENTS`).

### Pattern 4: Effective authorization scope (source: `lib/db/projects.ts:27-78 getUserProjects`)
- `{ OR: [{ userId }, { members: { some: { userId } } }] }` is the single source of truth.
- **New code MUST use the extracted helper** `getAccessibleProjectIdsForUser(userId)` and not reimplement the clause. If the helper does not yet exist, create it in `lib/db/projects.ts`; don't inline the clause elsewhere.
- **State management pattern**: `requireAuth()` throws `'Unauthorized'` on failure — never fall through; the route handler catches it and returns 401.

### Pattern 5: No dynamic Tailwind class construction (source: CLAUDE.md "Tailwind Classes")
- The intensity-level helper returns one of five complete literal strings:
  ```ts
  function getIntensityClass(level: 0 | 1 | 2 | 3 | 4): string {
    switch (level) {
      case 0: return 'bg-muted/30';
      case 1: return 'bg-violet-500/20';
      case 2: return 'bg-violet-500/40';
      case 3: return 'bg-violet-500/70';
      case 4: return 'bg-violet-500';
    }
  }
  ```
- Never ``bg-violet-${n}00`` or `className.replace(...)`.

### Pattern 6: Cost null-safety (source: spec FR-012, SC-006; contradicts none — new pattern)
- Payload: `totalCost: number | null`. `null` iff no job on that day had a non-null `costUsd`.
- UI: `{cell.totalCost !== null && <div>${cell.totalCost.toFixed(2)}</div>}`. Never compute and then test for zero.

### Pattern 7: Mobile tooltip dismiss (source: Radix `Tooltip` primitives via `components/ui/tooltip.tsx`)
- Use controlled `open` state with `onOpenChange`. On cell click, toggle open. Attach an effect listening to `document` pointerdown events; when a pointerdown occurs outside the cell ref, close. This mirrors the pattern used by shadcn `Popover` primitives.

## Summary
- **Decisions**: all resolved, no NEEDS CLARIFICATION remains.
- **Existing Files**: 7 files to reuse, 2 to extend, 8+ new files (6 impl + 4 tests min).
- **Key patterns**: server-initial + client poll (15s), Zod silent fallback, effective-agent OR clause, extracted accessible-project-ids helper, literal Tailwind classes, null-safe cost.
