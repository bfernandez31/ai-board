# Research: Activity Heatmap on Projects Page (AIB-672)

**Branch**: `AIB-672-activity-heatmap-on`
**Date**: 2026-04-17

## Decisions

### Decision: API surface scope — new top-level endpoint, not per-project
- **Chosen**: `GET /api/activity-heatmap` (user-scoped; aggregates every project the
  signed-in user can access).
- **Rationale**: The spec aggregates across *all* of the viewer's projects
  (FR-001). Existing analytics endpoint is per-project
  (`/api/projects/[projectId]/analytics`) and not reusable without re-fetching N
  times. A single endpoint lets the server run one SQL query with
  `projectId IN (userAccessibleIds)`.
- **Alternatives**: (a) Reuse `/api/projects/[projectId]/analytics` per project
  and aggregate client-side — many requests, wasteful. (b) Nest under
  `/api/projects/activity-heatmap` — misleading (it's not bound to one project).

### Decision: Timezone handling — pass viewer IANA timezone as query param
- **Chosen**: Server accepts `tz` query string (IANA name, e.g.
  `Europe/Paris`). Bucketing is performed in that timezone using `Intl` APIs.
  Defaults to `UTC` if the header is missing or invalid.
- **Rationale**: Spec requires viewer-local bucketing (FR-002). SSR happens
  before JS runs, but the page also refetches client-side on hydration with the
  resolved `Intl.DateTimeFormat().resolvedOptions().timeZone`. If the SSR render
  and the client render differ by day boundary, TanStack Query's background
  refetch updates the grid in place without a spinner flash (FR-030).
- **Alternatives**: (a) Cookie with viewer tz read at SSR — more moving parts,
  stale cookie failure mode. (b) Always UTC — violates FR-002. (c) Always
  client-side aggregation — violates FR-029 (requires spinner on first paint).

### Decision: Intensity thresholds — quartile-style breakpoints from period max
- **Chosen**: Compute 4 non-zero thresholds as
  `[ceil(max*0.25), ceil(max*0.5), ceil(max*0.75), max]` with empty level for
  0 jobs. A day's level is the index of the smallest threshold ≥ its count.
- **Rationale**: Spec FR-008 wants low- and high-volume users both to see a
  readable distribution. Fixed thresholds (1/3/5/10) break for power users.
- **Alternatives**: Log scale — harder to explain; actual quartiles of the
  non-zero distribution — noisy when there are few active days.

### Decision: Agent filter — computed from effective agents on the payload
- **Chosen**: Server returns `availableAgents: Agent[]` (the distinct set of
  effective agents across the user's jobs). Client renders the filter only when
  `availableAgents.length >= 2` (FR-024).
- **Rationale**: Effective-agent resolution already exists in
  `app/lib/utils/agent-resolution.ts::resolveEffectiveAgent`. Reuse it to avoid
  duplicating the fallback logic.

### Decision: SSR initial data — fetch on the server component
- **Chosen**: `app/projects/page.tsx` calls a new `getHeatmapData()` server
  helper (mirrors the `getUserProjects()` pattern) and passes it as
  `initialData` to the client component. Client uses TanStack Query
  `useQuery({ initialData })` so there is no spinner on first paint (FR-029,
  SC-001).
- **Rationale**: Matches how the projects list is already rendered on the
  server.

### Decision: URL state — query params `y` (year) and `a` (agent)
- **Chosen**: `y=YYYY` or `y=12m` (default `12m` → omitted). `a=<AGENT>` (default
  `all` → omitted) per FR-027/FR-028. Use `useSearchParams()` +
  `router.replace()` to avoid history-pollution.
- **Rationale**: Matches analytics dashboard pattern at
  `components/analytics/analytics-dashboard.tsx`.

### Decision: Layout adjustment — remove internal scroll from projects container
- **Chosen**: Drop the `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper in
  `components/projects/projects-container.tsx`. Let the page scroll naturally so
  both the cards and the heatmap are reachable (FR-032).
- **Rationale**: The spec explicitly calls this out. Keeping the internal
  scroll would hide the heatmap below the fold on short viewports.

### Decision: Do NOT add new Prisma models
- **Chosen**: Aggregate from existing `Job`, `Ticket`, `Project` rows at query
  time. No schema migration.
- **Rationale**: FR-005. `Job.startedAt` and `Job.completedAt` already have
  appropriate indexes; the query surface is one year × N projects, which is
  well within the analytics query budget used for the per-project dashboard.

## Existing Files

### Source

| Path | Role | Action |
|------|------|--------|
| `app/projects/page.tsx` | Server component for `/projects`; layout host | **Extend**: fetch heatmap initial data and render `<ActivityHeatmap />` below `<ProjectsContainer />` |
| `components/projects/projects-container.tsx` | Projects grid wrapper with internal scroll | **Extend**: remove `max-h-[calc(100vh-200px)] overflow-y-auto` per FR-032 |
| `lib/db/projects.ts` | Data access for user-accessible projects | **Reuse**: `getUserProjects()` pattern (owner OR member) to resolve project IDs for aggregation |
| `lib/analytics/aggregations.ts` | Pure aggregation helpers | **Reuse** read-only (no edits): `getISOWeek`, `formatCost`, `formatAbbreviatedNumber` |
| `lib/analytics/queries.ts` | Analytics DB queries | **Pattern reference only** for date-range query shape (`buildJobWhere`). Do not extend — heatmap is not per-project. |
| `app/lib/utils/agent-resolution.ts` | Effective agent resolution | **Reuse**: `resolveEffectiveAgent`, `ALL_AGENTS`, `AGENT_LABELS` |
| `app/lib/db/users.ts` (via `lib/db/projects.ts`) | `requireAuth` | **Reuse**: identical auth pattern as other user-scoped endpoints |
| `components/comparison/comparison-compliance-heatmap.tsx` | Existing aurora-styled heatmap with tooltips | **Pattern reference only** — copy idioms (TooltipProvider + aurora-cell-* classes) without extending |
| `components/ui/tooltip.tsx` | shadcn Tooltip primitives | **Reuse** |
| `components/ui/select.tsx` | shadcn Select primitives | **Reuse** for year + agent dropdowns |
| `components/ui/card.tsx` | shadcn Card primitives | **Reuse** for the heatmap surface |
| `app/globals.css` (aurora utilities) | Existing gradient/glow utility classes | **Reuse** `aurora-bg-subtle`, add new `aurora-heatmap-cell-{1..4}` utilities if the existing `pass/mixed/fail` triad is insufficient for a 4-step intensity ramp |
| `prisma/schema.prisma` | Source of truth for `Job`, `Ticket`, `Project`, `User` | **Read only** (no schema changes per FR-005) |
| `app/projects/[projectId]/analytics/page.tsx` | Per-project analytics page host | Pattern reference only for server-component initial data + client hydration |
| `components/analytics/analytics-dashboard.tsx` | Filter + URL state pattern | Pattern reference only for `useSearchParams` + `router.replace` |

### Tests

| Path | Role | Action |
|------|------|--------|
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Existing heatmap test patterns (cell role, tooltip, empty state) | **Pattern reference only** |
| `tests/integration/analytics/analytics-route.test.ts` | Per-project analytics API integration test | **Pattern reference only** (auth, filter parsing, worker isolation) |
| `tests/unit/components/analytics-dashboard.test.tsx` | Filter change + URL update coverage | **Pattern reference only** |

**New test files required** (no existing file covers the domain — the heatmap
is a new feature on a shared page, and its data-access helpers are new):

| Path | Purpose |
|------|---------|
| `tests/unit/lib/analytics/activity-heatmap.test.ts` | Pure-function tests for bucketing, intensity thresholds, year-selector options, effective-agent filtering |
| `tests/integration/activity-heatmap/route.test.ts` | API tests for auth, cross-project aggregation, `y`/`a`/`tz` params, empty-state payload |
| `tests/unit/components/projects/activity-heatmap.test.tsx` | Component tests for grid render, empty state, tooltip content, agent filter visibility, URL state round-trip |

## Patterns to Follow

### Pattern: Aurora card surface with sticky column + horizontal scroll
**Reference**: `components/comparison/comparison-compliance-heatmap.tsx:52-123`
- Outer `Card` with `border-ctp-mauve/15 aurora-bg-subtle`
- `CardContent` with `overflow-x-auto` for mobile horizontal scroll (FR-033)
- `<TooltipProvider>` at the root, individual `<Tooltip>`/`<TooltipTrigger>`
  per cell
- Left header column uses `sticky left-0 z-10 … aurora-bg-subtle` so it pins
  during scroll (FR-034)

### Pattern: Cell status classes from a lookup object
**Reference**: `components/comparison/comparison-compliance-heatmap.tsx:13-25`
```ts
const statusStyles: Record<string, { className: string }> = {
  pass:  { className: 'h-8 w-full cursor-pointer rounded aurora-cell-pass' },
  mixed: { className: 'h-8 w-full cursor-pointer rounded aurora-cell-mixed' },
  fail:  { className: 'h-8 w-full cursor-pointer rounded aurora-cell-fail' },
};
```
- Full static class strings per CLAUDE.md "NEVER construct Tailwind class names
  dynamically" rule. Heatmap cells will use the same approach — a 5-entry map
  keyed by intensity level 0..4.

### Pattern: Filter-change → URL sync via `useSearchParams` + `router.replace`
**Reference**: `components/analytics/analytics-dashboard.tsx:85-120` (analytics
dashboard)
- Keep filter state in a `useState` initialised from `searchParams`
- On change, build new `URLSearchParams`, omit default values, then
  `router.replace(\`?${params.toString()}\`, { scroll: false })`
- This gives clean URLs (FR-028) and avoids history spam.

### Pattern: API route Zod validation + structured errors
**Reference**: `app/api/projects/[projectId]/analytics/route.ts:7-50`
- Define a `querySchema` with `.default(...)` per field
- Parse once, return 400 on `ZodError` with `{ error: 'Invalid …' }`
- Map known errors (`Unauthorized` → 403) before falling through to 500
- Wrap the handler in a single `try/catch` — no swallowing

### Pattern: User-scoped DB access via `requireAuth()` + `OR: [{ userId }, { members: { some: { userId } } }]`
**Reference**: `lib/db/projects.ts:27-78` (`getUserProjects`)
- Resolves owned + member projects in one query
- The heatmap aggregation query will start from the same `where` clause to
  derive the set of project IDs, then filter jobs with
  `projectId: { in: [...] }`.

### Pattern: Effective-agent resolution
**Reference**: `app/lib/utils/agent-resolution.ts:41-46`
```ts
export function resolveEffectiveAgent(
  ticketAgent: Agent | null,
  projectDefaultAgent: Agent
): Agent {
  return ticketAgent ?? projectDefaultAgent;
}
```
- Used to derive the available-agent set and to apply the agent filter
  (FR-022, FR-025).

### Pattern: Graceful degradation for page-level errors
**Reference**: `app/projects/page.tsx:17-27`
- The page already swallows `getUserProjects` failures and returns `[]`
- The heatmap server fetch must do the same: if the aggregation throws, log
  and pass `initialData: null`; the client renders an inline notice (per
  spec's "Error behavior: Errors are logged and surfaced as a non-blocking
  inline notice").

## Open Questions (none remaining)

All `NEEDS CLARIFICATION` markers in the spec are resolved by the
`Auto-Resolved Decisions` block in `spec.md`. No further clarifications are
required before Phase 1.
