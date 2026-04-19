# Research: Activity Heatmap on Projects Page (AIB-688)

**Feature branch**: `AIB-688-copy-of-activity`
**Spec**: `specs/AIB-688-copy-of-activity/spec.md`
**Date**: 2026-04-19

## Purpose

Resolve all unknowns in the Technical Context, inventory existing files we will extend
(per the constitution's "search existing tests / code FIRST" rule), and extract concrete
patterns from the reference implementations we intend to parallel.

---

## Decisions

### D1. Rendering strategy: Server Component shell + Client Component grid
- **Decision**: Fetch initial heatmap payload server-side inside `app/projects/page.tsx`
  and hand it to a new `<ActivityHeatmap initialData={...} />` Client Component. The
  client component uses TanStack Query with `initialData` to avoid spinner flash.
- **Rationale**: `app/projects/page.tsx` is already a Server Component (`force-dynamic`);
  `AnalyticsDashboard` already demonstrates this exact pattern at
  `components/analytics/analytics-dashboard.tsx:85-100`. FR-017 mandates no spinner flash
  on first paint, including URL-param deep links.
- **Alternatives considered**: (a) Client-only fetch with loading skeleton — rejected,
  violates FR-017. (b) Full SSR with no polling — rejected, violates FR-018 (silent
  15s refetch).

### D2. Query-param driven filters, validated server-side
- **Decision**: Parse `period` (one of `last-12-months` or a four-digit calendar year)
  and `agent` (one of `all | CLAUDE | CODEX | MISTRAL | GEMINI`) in the Server Component
  from `searchParams`. Invalid values fall back to defaults via the existing
  `getSearchParamValue(value, allowList, default)` helper used on the per-project
  analytics page (`app/projects/[projectId]/analytics/page.tsx`).
- **Rationale**: Mirrors the already-validated analytics page pattern. FR-015 requires
  that first-paint for a shared URL reproduces the view — doing the validation in the
  Server Component is the only way to meet that without client re-render.
- **Alternatives considered**: Validating only on the client — rejected, causes a
  filter-default → filter-applied flicker on first paint.

### D3. Aggregation approach: Prisma `groupBy` on `Job.completedAt::date`
- **Decision**: One Prisma `groupBy` over `Job` filtered to the user-accessible
  project set, the selected date range, and (if applicable) the effective-agent
  ticket scope. Group by a day-bucket key derived from `completedAt` in the user's
  timezone. Sum `costUsd` skipping nulls, count jobs, and emit a per-day row.
- **Rationale**: A single-pass aggregate is the cheapest server path and mirrors
  `lib/analytics/queries.ts:414-432` which already uses `prisma.job.aggregate` with
  `_sum` on cost. Day-bucket keys are produced by `formatDateForGrouping` in
  `lib/analytics/aggregations.ts:136-145`.
- **Alternatives considered**: (a) Fetching raw job rows and bucketing in JS —
  rejected, scales poorly as activity grows. (b) A materialized daily summary table
  — rejected, FR-022 forbids new models.

### D4. "Shipped" = successful `ship` job on that day
- **Decision**: Ship counts are produced from a separate `groupBy` over `Job` with
  `command = 'ship'` and `status = COMPLETED`, grouped by `completedAt::date`. The
  per-day shipped-ticket list is built from the distinct `ticketId` values joined to
  `Ticket` for display (`ticketKey`, `title`).
- **Rationale**: FR-008 explicitly overrides the existing analytics pattern (which
  treats `stage === 'SHIP'` alone as "shipped" — see `lib/analytics/queries.ts:48`).
  Tying the counter to the successful `ship` job is the only source of truth for
  "actually shipped on this day".
- **Alternatives considered**: Reusing the analytics "stage === SHIP" rule —
  rejected by spec (FR-008 is explicit).

### D5. Timezone: request-driven hint with UTC fallback
- **Decision**: Client passes `tz` (IANA string, e.g. `America/New_York`) as a query
  param obtained from `Intl.DateTimeFormat().resolvedOptions().timeZone`. Server
  validates against `Intl.supportedValuesOf('timeZone')` when available; otherwise
  rejects unknown strings and falls back to UTC. Server uses the tz to compute
  day-bucket keys and period range boundaries. First-paint SSR has no client tz yet,
  so the Server Component derives day-bucket keys from an initial UTC view and the
  client re-requests on mount if the resolved tz differs (silently, per FR-018 — no
  spinner swap; TanStack Query replaces data in place).
- **Rationale**: The spec's Auto-Resolved Decisions accept local browser time zone
  with UTC as an acceptable server fallback. TanStack Query's background refetch
  machinery already lets us replace data silently.
- **Alternatives considered**: Server always UTC — rejected, mismatches the spec's
  "local browser time zone" decision. Forcing a tz cookie before first paint —
  rejected, adds latency and a migration step.

### D6. Intensity bucketing: quartile thresholds over non-zero days
- **Decision**: Server computes thresholds using quartiles of the non-zero per-day
  job counts in the rendered payload. Four thresholds (`t1..t4`) map day counts to
  levels 1–4; days with 0 jobs are level 0. Thresholds are returned in the payload
  so the client colours cells from the same source of truth.
- **Rationale**: Matches the Auto-Resolved Decision in the spec. Computing client-
  side would force redundant work and risk drift when background refetches update
  thresholds.
- **Alternatives considered**: Fixed thresholds (1/3/6/10) — rejected, low-activity
  users would see a dead heatmap; quartiles self-scale.

### D7. Polling cadence: 15s, piggy-backing on analytics cadence
- **Decision**: Use `refetchInterval: 15000`, `staleTime: 10000` — identical to
  `components/analytics/analytics-dashboard.tsx:98-99` and `hooks/use-usage.ts:39-40`.
- **Rationale**: CLAUDE.md explicitly lists 15s as the analytics polling channel.

### D8. Mobile grid: horizontal scroll inside a ScrollArea with sticky day labels
- **Decision**: Use `components/ui/scroll-area.tsx` for horizontal scroll, with the
  day-of-week label column rendered outside (to the left of) the scroll region so
  it stays pinned without needing `position: sticky` within a Radix ScrollArea
  viewport (which can be fragile).
- **Rationale**: Reuses existing shadcn primitive; avoids sticky-position edge cases
  documented in Radix ScrollArea issues. Satisfies FR-020 and FR-021.
- **Alternatives considered**: CSS `position: sticky` inside the scroll viewport —
  rejected, unreliable across browsers inside the Radix viewport.

### D9. Colour scale: aurora violet gradient via Tailwind palette classes
- **Decision**: Use fixed Tailwind palette classes for the five levels (level 0 =
  `bg-zinc-800/40`, levels 1–4 = `bg-violet-900 → bg-violet-500`). Return full
  static class names from a helper — never string-interpolate class names (CLAUDE.md
  "Tailwind Classes" rule).
- **Rationale**: CLAUDE.md permits palette classes for fixed-contrast needs. The
  aurora theme tokens (`aurora-*`) are gradient *backgrounds* for cards/dialogs —
  they are not per-cell shade variants, so palette classes are the right fit here.
- **Alternatives considered**: `aurora-cell-*` classes used by
  `components/comparison/comparison-compliance-heatmap.tsx` — rejected, those are
  pass/fail/mixed semantics, not a 5-step intensity ramp.

### D10. Scope: owner OR member, mirroring `getUserProjects`
- **Decision**: Derive the user's accessible project IDs with the same `OR` clause
  used in `lib/db/projects.ts:31-37`, then restrict the Job aggregation by
  `ticket.projectId IN (...)`.
- **Rationale**: Mirrors the existing `/projects` page access model (satisfies
  FR-023 and the Auto-Resolved scope decision).

### D11. Agent filter visibility (≥2 distinct)
- **Decision**: Server computes the distinct effective-agent set over in-scope
  tickets (explicit `ticket.agent` ∪ effective `project.defaultAgent` when
  `ticket.agent` is null). Payload returns the set; client hides the filter when
  `|set| < 2`.
- **Rationale**: Matches FR-012/FR-013 and reuses the effective-agent logic in
  `lib/analytics/queries.ts:51-69` (`buildEffectiveAgentWhere`) and
  `app/lib/utils/agent-resolution.ts:41-46` (`resolveEffectiveAgent`).

### D12. Error behaviour: non-blocking empty state
- **Decision**: A failed aggregation returns an empty payload and a non-blocking
  error indicator inline in the heatmap area. The `/projects` page continues to
  render normally around it.
- **Rationale**: Spec Internal Processes "Error behavior" is explicit. Mirrors the
  `getProjects()` graceful-degradation pattern already in `app/projects/page.tsx:17-27`.

---

## Existing Files

*Required inventory — constitution III: "Search existing tests FIRST — extend, don't
duplicate."*

### Source files to extend

| Path | What it covers | Action |
| --- | --- | --- |
| `app/projects/page.tsx` | Projects page Server Component | **Modify** — add heatmap section below `<ProjectsContainer>`; parse `period`/`agent`/`tz` from `searchParams`; fetch initial heatmap payload server-side. |
| `components/projects/projects-container.tsx` | Grid of project cards | **No change** (heatmap sits outside it). |
| `app/lib/query-keys.ts` | Centralised TanStack Query keys | **Modify** — add `heatmap: (period, agent, tz) => [...]`. |
| `app/lib/utils/agent-resolution.ts` | `ALL_AGENTS`, `resolveEffectiveAgent`, `AGENT_LABELS` | **Reuse as-is** — no change. |
| `lib/db/projects.ts` | `getUserProjects()` owner-OR-member query | **Reuse pattern** — do not add new export; the heatmap queries file builds its own accessible-projects subquery from the same OR clause. |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess`, etc. | **Reuse as-is** — the heatmap endpoint uses `requireAuth()` (session) directly since access is "all projects of user", not a specific project. |
| `lib/analytics/aggregations.ts` | `getDateRangeStart`, `formatDateForGrouping`, `getAgentLabel` | **Reuse** — existing helpers suffice for period bounds and day keys. |
| `lib/analytics/queries.ts` | `buildEffectiveAgentWhere`, `COMPLETED_TICKET_STAGES`, `JOB_STATUSES` | **Pattern reference** (see Patterns to Follow §P1). Export `buildEffectiveAgentWhere` if currently non-exported — otherwise reimplement inline in the heatmap queries file. |
| `hooks/use-usage.ts` | 15s polling hook with initialData pattern | **Pattern reference** (§P2) — do not modify. |
| `components/analytics/analytics-dashboard.tsx` | Filters-in-URL + TanStack Query + initialData pattern | **Pattern reference** (§P3) — do not modify. |
| `components/ui/select.tsx`, `tooltip.tsx`, `popover.tsx`, `scroll-area.tsx` | shadcn primitives | **Reuse as-is**. |
| `prisma/schema.prisma` | `Job`, `Ticket`, `Project`, `Agent`, `JobStatus` | **Reuse as-is** — FR-022 forbids new models. |

### New source files

| Path | Responsibility | Why new |
| --- | --- | --- |
| `lib/analytics/heatmap-queries.ts` | Server aggregation: accessible projects → per-day job/ship/agent buckets | No existing query returns cross-project per-day aggregates scoped to "user's accessible projects". The per-project `getAnalyticsData` returns aggregates for one project only. |
| `lib/analytics/heatmap-types.ts` | Types: `HeatmapPayload`, `HeatmapDay`, `HeatmapFilters`, `HeatmapPeriod` | Keep heatmap types separate from per-project analytics types so they can diverge (shipped = ship-job, not stage=SHIP). |
| `app/api/activity-heatmap/route.ts` | `GET` endpoint for polling | No per-user (non-project) analytics endpoint exists. Placed at top-level `/api/activity-heatmap` because the scope is "all user projects" — not a single project. |
| `components/projects/activity-heatmap/index.tsx` | Top-level client heatmap component | New feature; no equivalent exists. |
| `components/projects/activity-heatmap/heatmap-grid.tsx` | Pure SVG/DOM grid rendering | Split for testability (render rules: chipped corners, future-day rendering, empty state). |
| `components/projects/activity-heatmap/heatmap-legend.tsx` | "Less … More" legend | Tiny, but split because it's referenced from the empty state too. |
| `components/projects/activity-heatmap/heatmap-filters.tsx` | Period + agent selector | Contains URL-sync logic. |
| `components/projects/activity-heatmap/heatmap-tooltip.tsx` | Date / jobs / shipped tickets / cost | Contains the "omit cost when null" rule (FR-010, SC-006). |
| `hooks/use-activity-heatmap.ts` | TanStack Query hook with 15s polling and `initialData` | Mirrors `hooks/use-usage.ts`. |

### Tests to extend

*Search existing test files that cover the domains we touch, per constitution III.*

| Existing test file | Domain it covers | Action |
| --- | --- | --- |
| `tests/integration/analytics/analytics-route.test.ts` | Analytics API + effective-agent filtering + Prisma aggregation with seeded jobs | **Do not extend** — analytics-route is per-project; heatmap is per-user. Mixing concerns in one file would violate constitution III. The *patterns* (seed fixture + assertion shape) are reused in the new heatmap integration test. |
| `tests/unit/components/analytics-dashboard.test.tsx` | URL params + filter interactions on analytics page | **Do not extend** — same reasoning (different page, different component, different state machine). Reuse the *pattern* (mock `useRouter`, `useSearchParams`; assert `router.push` called with expected params). |
| `tests/integration/projects/projects-with-health.test.ts` | `/projects` page health data loading | **Read before implementing** — confirms existing SSR contract. **Do not extend** — mixing heatmap concerns into a "projects-with-health" file would violate III. |
| `tests/unit/components/comparison-compliance-heatmap.test.tsx` | Existing heatmap-style cell rendering | **Pattern reference** for RTL cell-rendering assertions. Do not extend (different data model). |

### New test files

| Path | Type | Scope |
| --- | --- | --- |
| `tests/integration/activity-heatmap/heatmap-route.test.ts` | Vitest integration | API endpoint: auth, period parsing, agent filtering, ship-job shipped counting, null-cost handling, owner+member scope, empty state, tz handling. |
| `tests/unit/components/activity-heatmap.test.tsx` | Vitest + RTL | Filter URL sync, empty-state swap, tooltip $NaN/$0 rule, chipped corners, future-day rendering, agent-filter-hidden-when-≤1. |
| `tests/unit/lib/heatmap-queries.test.ts` | Vitest unit | Pure helpers: bucket-threshold quartile math, day-key bucketing across tz boundaries. |
| `tests/e2e/projects/activity-heatmap.spec.ts` | Playwright | SC-001 first-paint no spinner; SC-005 URL round-trip in new session; SC-007 mobile tappable cell size + horizontal scroll + pinned day labels. Only behaviours that genuinely require a real browser. |

---

## Patterns to Follow

*Required extraction — constitution III, IV and CLAUDE.md. For each file marked
"Pattern reference" above, concrete patterns we must follow with file:line cites.*

### P1 — Effective-agent WHERE builder
- **Source**: `lib/analytics/queries.ts:51-69` (`buildEffectiveAgentWhere`)
- **Pattern**: `OR: [{ agent }, { agent: null, project: { is: { defaultAgent: agent } } }]`
- **How to apply**: `lib/analytics/heatmap-queries.ts` MUST use the same clause shape
  when applying the agent filter to the Job → Ticket join. Copy the shape; do not
  reinvent (differing logic would produce inconsistent counts between the heatmap
  and the per-project analytics page).

### P2 — TanStack Query polling + initialData
- **Source**: `hooks/use-usage.ts:35-42`, and
  `components/analytics/analytics-dashboard.tsx:94-100`
- **Pattern**: `useQuery({ queryKey, queryFn, initialData: shouldUseInitialData ? initialData : undefined, refetchInterval: 15_000, staleTime: 10_000 })` where
  `shouldUseInitialData = filtersMatch(filters, initialData.filters)` (analytics
  dashboard line 92).
- **How to apply**: `hooks/use-activity-heatmap.ts` MUST only pass `initialData`
  when the current filters exactly match the server-rendered filters, otherwise
  the browser will display stale data after a client-side filter change.

### P3 — URL-driven filters without scroll jump
- **Source**: `components/analytics/analytics-dashboard.tsx:105-109`
  (`router.push(\`?${params.toString()}\`, { scroll: false })`)
- **How to apply**: `components/projects/activity-heatmap/heatmap-filters.tsx` MUST
  pass `{ scroll: false }` to every `router.push` — losing scroll position when
  the user changes the agent filter below project cards is the exact bug this
  option prevents.

### P4 — Graceful degradation for the projects page
- **Source**: `app/projects/page.tsx:17-27` (wraps `getUserProjects` in try/catch,
  returns `[]` on error)
- **How to apply**: The server-side heatmap load MUST use the same pattern: a
  failed aggregation returns an empty payload, NOT a thrown error. The `/projects`
  page keeps rendering the project cards regardless.

### P5 — SearchParams validation with allow-lists (SSR-safe)
- **Source**: `app/projects/[projectId]/analytics/page.tsx:49-78` (`getSearchParamValue`)
- **How to apply**: `app/projects/page.tsx` MUST validate `period` against
  `{ 'last-12-months', ...accountCreationYear..currentYear }` and `agent` against
  `{ 'all', ...ALL_AGENTS }`. Invalid values must silently fall back to defaults
  — do not 400 or throw; the `/projects` page is not a form submission target.

### P6 — Ship/Close definition must NOT reuse COMPLETED_TICKET_STAGES
- **Source**: `lib/analytics/queries.ts:48` (defines `COMPLETED_TICKET_STAGES = ['SHIP','CLOSED']` — used by analytics)
- **How to apply**: Heatmap queries MUST NOT import this constant. They MUST
  aggregate from `Job WHERE command='ship' AND status=COMPLETED AND completedAt IS NOT NULL`.
  The divergence is by design (FR-008). Leave a code comment at the heatmap query
  site citing `FR-008` to prevent a well-meaning refactor from merging the two.

### P7 — No hardcoded hex; palette classes only for fixed-contrast shade ramps
- **Source**: CLAUDE.md "Colors" / "Tailwind Classes" sections
- **How to apply**: The 5-level intensity helper MUST return full static strings
  (e.g. `'bg-violet-900'`, not `\`bg-violet-${shade}\``). The helper function is a
  `switch` on level 0..4, each branch returning a complete literal class name.

### P8 — Transaction-free read endpoint
- **How to apply**: The heatmap route is read-only. Do NOT wrap in `prisma.$transaction`.

### P9 — 15s polling key consistency
- **Source**: `app/lib/query-keys.ts` (existing `queryKeys.analytics.data(...)`)
- **How to apply**: Add a new namespace `queryKeys.activityHeatmap.data(period, agent, tz)`
  returning a tuple that serialises deterministically so filter changes produce
  distinct query entries (no cache bleed).

### P10 — Test env prefix for E2E
- **Source**: CLAUDE.md "Test Environment" section
- **How to apply**: Playwright test MUST seed projects/tickets with `[e2e]` name
  prefix against the test user (project IDs 1-2) so auto-cleanup picks them up.

---

## Still Unresolved / Intentionally Deferred

None. All `NEEDS CLARIFICATION` items in the Technical Context are resolved by
decisions D1–D12 above or by the spec's Auto-Resolved Decisions section.
