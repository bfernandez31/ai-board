# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-688-copy-of-activity` | **Date**: 2026-04-19 | **Spec**: `specs/AIB-688-copy-of-activity/spec.md`
**Input**: Feature specification from `specs/AIB-688-copy-of-activity/spec.md`

## Summary

Render a GitHub-style contribution heatmap beneath the project cards on
`/projects`, covering AI job activity across all projects the signed-in user
can access (owner OR member). Period defaults to "Last 12 months"; a calendar-
year selector and an agent filter (visible only when the user has ≥2 distinct
effective agents) refine the view. Header counter shows "{jobs} jobs ·
{tickets} tickets shipped in {label}". A ticket counts as shipped only when
its `ship` Job completed successfully (FR-008). Initial paint uses server-
rendered data with no spinner flash; TanStack Query polls every 15s and
replaces data silently in the background.

No new DB models (FR-022). The server aggregates via Prisma `groupBy` on `Job`
constrained to the user's accessible project IDs, the selected date range, and
(optionally) the effective-agent clause used by the existing analytics page.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router), React 18, Prisma 6, TanStack Query v5.95.2, shadcn/ui + Radix, TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma (read-only for this feature)
**Testing**: Vitest (unit + integration), Playwright (E2E — only where browser-required)
**Target Platform**: Web (desktop + mobile viewport ≤ 480 px)
**Project Type**: Web (Next.js App Router monolith — single source tree)
**Performance Goals**: First-paint heatmap ≤ current `/projects` page TTFB budget (no new blocking round-trip). Payload target < 60 KB for a 12-month view. Single aggregate query (no N+1).
**Constraints**: FR-017 no spinner flash on first paint (SSR initialData required). FR-018 silent background refetch. FR-022 no new models. Mobile cells ≥ 14×14 CSS px (SC-007).
**Scale/Scope**: Up to 365 day-rows × all accessible projects per user. Expected O(100–10 000) jobs per user-year. One new API route, one new Server Component section, one new client feature directory (~7 files), one new TanStack Query hook.

All items resolved; no `NEEDS CLARIFICATION` outstanding.

## Constitution Check

*Gate: must pass before Phase 0 research and re-checked post-design.*

### I. TypeScript-First
- All new files MUST be TypeScript strict. No `any`. Public functions explicitly typed. ✅ Planned in Project Structure.

### II. Component-Driven Architecture
- Server Component: `app/projects/page.tsx` (existing, extended).
- Client Component: `components/projects/activity-heatmap/index.tsx` (`"use client"`).
- Only shadcn/ui primitives used (Select, Tooltip, Popover, ScrollArea). No custom styling from scratch.
- Feature folder `components/projects/activity-heatmap/` holds related components; API route in `/app/api/activity-heatmap/route.ts`.
- Sub-components extracted only where constitution rules allow (`heatmap-grid`, `heatmap-filters`, `heatmap-legend`, `heatmap-tooltip` each have distinct state/effects or are referenced in ≥2 places). No cosmetic splits.

### III. Test-Driven Development
- Decision tree applied per `research.md` Testing Strategy below.
- Search-first satisfied: `research.md §Existing Files` enumerates existing test files and justifies NOT extending them (different scopes).
- E2E limited to SC-001 (first-paint no-spinner), SC-005 (URL round-trip), SC-007 (mobile cell size + pinned labels) — each genuinely browser-bound.
- No assertions inside conditional blocks. Mocks target the import chain (`@/app/lib/query-keys`, `next/navigation`).

### IV. Security-First
- Zod validates `agent` and `tz` (see `contracts/activity-heatmap-api.md`).
- `period` validated imperatively against per-user allow-list (depends on `user.createdAt`).
- All queries use Prisma parameterised forms. No raw SQL.
- Response does not expose internal IDs beyond `ticketKey` (already visible to the user on `/projects`).
- Auth via `requireAuth()`; unauth → 401 (not 500, per constitution Error Handling).
- `Cache-Control: private, no-store` on the response.

### V. Database Integrity
- Read-only endpoint; no mutations.
- No schema changes (FR-022).
- No multi-step write, so no transactions needed.
- In-memory aggregates built from Prisma query results; no pre-mutation object reuse.

### V'. Specification Clarification Guardrails
- Spec includes `Auto-Resolved Decisions` section with 6 entries covering scope,
  timezone, intensity, future-day rendering, SSR initial data, and refetch cadence.
- Plan preserves all safeguards (tests, security, integrity); trade-offs only
  reduce polish (e.g. does not precompute per-user CDN cache).

### Gate Result
**PASS.** No violations requiring justification. `Complexity Tracking` left empty below.

---

## Project Structure

### Documentation (this feature)

```
specs/AIB-688-copy-of-activity/
├── spec.md                # Feature specification (input)
├── plan.md                # This file
├── research.md            # Phase 0 output
├── data-model.md          # Phase 1 output
├── contracts/
│   └── activity-heatmap-api.md
├── checklists/            # Pre-existing
└── tasks.md               # Phase 2 output — created by /ai-board.tasks (NOT by this command)
```

### Source Code (repository root)

The project is a single Next.js App Router monolith. Locations below use
existing conventions (see `app/`, `components/`, `lib/`, `hooks/`, `tests/`).

```
app/
├── projects/
│   └── page.tsx                                  # MODIFY: parse period/agent/tz from searchParams; fetch initial heatmap payload server-side; render <ActivityHeatmap initialData={...} /> below <ProjectsContainer>
├── api/
│   └── activity-heatmap/
│       └── route.ts                              # NEW: GET — see contracts/activity-heatmap-api.md
└── lib/
    ├── query-keys.ts                             # MODIFY: add queryKeys.activityHeatmap.data(period, agent, tz)
    └── utils/
        └── agent-resolution.ts                   # REUSE AS-IS: ALL_AGENTS, resolveEffectiveAgent, AGENT_LABELS

components/
└── projects/
    └── activity-heatmap/
        ├── index.tsx                             # NEW: 'use client' — top-level component, URL-sync, TanStack Query with initialData
        ├── heatmap-grid.tsx                      # NEW: pure render of cells + chipped corners + empty/future-day handling
        ├── heatmap-filters.tsx                   # NEW: period + agent selectors, router.push with {scroll:false}
        ├── heatmap-legend.tsx                    # NEW: Less → More swatches
        └── heatmap-tooltip.tsx                   # NEW: date / shipped list / job count / cost-if-non-null (FR-010)

hooks/
└── use-activity-heatmap.ts                       # NEW: TanStack Query wrapper; 15s polling; initialData only when filtersMatch

lib/
├── analytics/
│   ├── heatmap-queries.ts                        # NEW: server aggregation (accessible projects, per-day buckets, quartile thresholds); read-only
│   ├── heatmap-types.ts                          # NEW: HeatmapPayload / HeatmapDay / HeatmapFilters / HeatmapPeriod
│   ├── queries.ts                                # REUSE: buildEffectiveAgentWhere pattern (research §P1)
│   └── aggregations.ts                           # REUSE AS-IS: formatDateForGrouping, getAgentLabel
├── db/
│   ├── projects.ts                               # REUSE AS-IS: owner-OR-member OR clause reused in heatmap-queries.ts
│   ├── auth-helpers.ts                           # REUSE AS-IS
│   └── users.ts                                  # REUSE AS-IS: requireAuth()
└── ...

tests/
├── integration/
│   └── activity-heatmap/
│       └── heatmap-route.test.ts                 # NEW: 13 contract assertions (see contracts/...#Contract tests)
├── unit/
│   ├── components/
│   │   └── activity-heatmap.test.tsx             # NEW: RTL — filter URL sync, empty-state swap, tooltip null-cost rule, chipped corners, future-day rendering, agent-filter-hidden-when-≤1
│   └── lib/
│       └── heatmap-queries.test.ts               # NEW: quartile thresholds, day-key bucketing across tz boundaries
└── e2e/
    └── projects/
        └── activity-heatmap.spec.ts              # NEW: SC-001, SC-005, SC-007 only

prisma/
└── schema.prisma                                 # NO CHANGE (FR-022)
```

**Structure Decision**: Single Next.js App Router monolith (existing). The
heatmap is a *section* of the `/projects` Server Component page, backed by a
dedicated top-level API route (`/api/activity-heatmap`) because its scope is
per-user, not per-project. Co-located client components live under
`components/projects/activity-heatmap/` to match the existing
`components/projects/…` feature grouping, while server aggregation logic lives
under `lib/analytics/` alongside the related (but deliberately separate)
per-project analytics queries.

---

## Implementation Phases (high-level)

Tasks are generated by `/ai-board.tasks`; the phases below are *planning*
milestones, not a task list.

### Phase A — Server aggregation foundation
- Add `lib/analytics/heatmap-types.ts` (payload shapes from `data-model.md`).
- Add `lib/analytics/heatmap-queries.ts`:
  - Resolve accessible project IDs (owner-OR-member; mirror `lib/db/projects.ts:31-37`).
  - Resolve date range from `HeatmapPeriod` + timezone.
  - Build effective-agent clause using the pattern from
    `lib/analytics/queries.ts:51-69` (research §P1).
  - Two Prisma `groupBy`s: one over `Job` (intensity), one filtered to
    `command='ship', status=COMPLETED` (shipped list).
  - Compute distinct effective-agent set separately (without agent filter
    applied; research §R8).
  - Backfill zero-count days and compute quartile thresholds + per-day levels
    (§R7).
- Unit tests for helpers in `tests/unit/lib/heatmap-queries.test.ts`.

### Phase B — API route
- Add `app/api/activity-heatmap/route.ts` implementing the contract.
- Zod validates `agent`, `tz`; imperative validation for `period`.
- try/catch wraps the aggregation call; failure → 500 with structured body
  (never fall through — constitution IV).
- Integration tests in `tests/integration/activity-heatmap/heatmap-route.test.ts`.

### Phase C — Client heatmap feature
- Add `hooks/use-activity-heatmap.ts` (mirror `hooks/use-usage.ts`; research §P2).
- Add `components/projects/activity-heatmap/` files.
- Only pass `initialData` when `filtersMatch(currentFilters, initialData.filters)`
  (research §P2).
- `router.push(..., { scroll: false })` on every filter change (research §P3).
- Cell-shade helper: a `switch` on level 0..4 returning complete literal
  Tailwind class strings (research §P7).
- ScrollArea wraps the grid; day-of-week label column renders OUTSIDE it to
  stay pinned on mobile (research §D8, FR-021).
- RTL tests in `tests/unit/components/activity-heatmap.test.tsx`.

### Phase D — Wire into `/projects` page
- Modify `app/projects/page.tsx` to:
  - Accept `searchParams` (Next.js 16 `Promise<searchParams>` style, matching
    `app/projects/[projectId]/analytics/page.tsx:49-78`).
  - Validate `period`/`agent`/`tz` via allow-list helper; fall back silently.
  - Call the heatmap query function server-side with graceful try/catch
    returning an empty payload on error (research §P4).
  - Render `<ActivityHeatmap initialData={payload} />` beneath
    `<ProjectsContainer>`. Relax the `max-h-[calc(100vh-200px)] overflow-y-auto`
    constraint on the project grid if it prevents reaching the heatmap (FR-001).
- Add `queryKeys.activityHeatmap.data(...)` to `app/lib/query-keys.ts`.

### Phase E — E2E validation
- Playwright `tests/e2e/projects/activity-heatmap.spec.ts`:
  - SC-001: first paint has real cells, no `[role="progressbar"]` / skeleton visible.
  - SC-005: URL `?period=2025&agent=CLAUDE` opened in a fresh session renders
    the same filtered view on first paint.
  - SC-007: mobile viewport — cells ≥ 14 px, `overflowX: 'auto'` on the grid
    container, day-of-week labels remain visible after scrolling.
- Seeded projects/tickets use `[e2e]` prefix (research §P10).

---

## Testing Strategy

Following `constitution.md §III` and the Testing Trophy.

| Test type | File(s) | Coverage |
| --- | --- | --- |
| **Vitest unit** | `tests/unit/lib/heatmap-queries.test.ts` | Quartile threshold math (incl. all-zeros, all-same-value, uneven distribution). Day-key bucketing across tz (UTC vs America/New_York for a `2025-06-15T02:00:00Z` job). Effective-agent resolution contract. |
| **Vitest + RTL component** | `tests/unit/components/activity-heatmap.test.tsx` | Filter `router.push` with `{scroll:false}`. Empty-state swap when `totals.jobs===0`. Agent-filter hidden when `distinctAgents.length<2`. Tooltip omits cost line when `totalCost===null` (SC-006). Chipped-corner absence of out-of-period cells. Future-day rendering (level 0, no shaded cell) for current-year selector. |
| **Vitest integration** | `tests/integration/activity-heatmap/heatmap-route.test.ts` | All 13 contract assertions in `contracts/activity-heatmap-api.md`. Real Prisma against test DB; seed Project(owner)+Project(member)+Project(no-access); seed Tickets with explicit/null agents; seed Jobs with `ship`/non-ship + completed/failed + null/non-null cost. |
| **Playwright E2E** | `tests/e2e/projects/activity-heatmap.spec.ts` | Only SC-001, SC-005, SC-007 — behaviours that require a real browser (first-paint timing, real URL round-trip across sessions, real viewport + scroll gesture). All other success criteria are covered by the faster tests above. |

No existing test file is extended — see `research.md §Existing Files → Tests to
extend` for why. Extending `analytics-route.test.ts` or `analytics-dashboard.test.tsx`
with heatmap assertions would mix unrelated concerns (per-project vs per-user,
different endpoint, different component tree).

---

## Complexity Tracking

*No entries — Constitution Check passed without justified violations.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |
