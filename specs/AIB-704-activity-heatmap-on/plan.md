# Implementation Plan: Activity Heatmap on Projects Page (AIB-704)

**Branch**: `AIB-704-activity-heatmap-on` | **Date**: 2026-04-21 | **Spec**: [`spec.md`](./spec.md)
**Input**: Feature specification from `specs/AIB-704-activity-heatmap-on/spec.md`

## Summary

Add a GitHub-style contribution heatmap to `/projects`, rendered below the project-cards grid. The heatmap shows AI activity (job counts per day) and shipped tickets across every project the viewer owns or is a member of, over a rolling 12-month window or a specific calendar year. Hover/tap a cell to see the date, shipped tickets, and a `"N jobs · $X.XX"` summary (cost omitted when no job on that day has `costUsd`). URL query params (`period`, `agent`) drive a TanStack Query hook that hydrates from a server-rendered payload so the heatmap paints with real data on first render.

**Technical approach**: Reuse the established analytics-dashboard pattern (server-hydrated `useQuery` with 15s refetch, URL-synced filters via `router.push`, effective-agent resolution via `buildEffectiveAgentWhere`). Introduce a new user-scoped endpoint `GET /api/projects/activity-heatmap` that aggregates existing `Job` and `Ticket` rows — no new database models (FR-029). Ship detection uses `Job.command='ship'` + `status='COMPLETED'`, diverging from analytics's stage-based detection per FR-003. Relax the inner-scroll constraint on `ProjectsContainer` so the page scrolls naturally and the heatmap is reachable.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0, React 18, Next.js 16 (App Router)
**Primary Dependencies**: Prisma 6.x (PostgreSQL), TanStack Query v5, shadcn/ui (Radix-based), TailwindCSS 3.4, `@prisma/client`
**Storage**: PostgreSQL 14+; read-only for this feature (FR-029 — no new models, no migrations)
**Testing**: Vitest (unit + integration), React Testing Library, Playwright (only if interaction REQUIRES a real browser)
**Target Platform**: Browser (desktop + mobile ≤ 480px), server rendering in Next.js App Router
**Project Type**: Web application (single Next.js codebase — App Router)
**Performance Goals**:
- SC-001: first paint shows populated heatmap (no spinner) on ≥95% of authenticated loads with prior activity.
- SC-002 / SC-003: filter change updates grid, counter, and URL within 1s on broadband.
- Server aggregation reads should complete in ≤300ms p95 for a user with ≤10k jobs over the selected period (existing indexes on `Job(startedAt)` and `Job(ticketId, status, startedAt)` are sufficient).
**Constraints**:
- No new Prisma models (FR-029); no migrations.
- No raw SQL (Constitution IV).
- No new UI libraries (CLAUDE.md forbids anything beyond shadcn/ui + Radix).
- No hardcoded hex/rgb colors (CLAUDE.md); intensity scale uses aurora-themed Tailwind utility classes returned as complete literal strings.
- Tooltip layer must use Radix portal (shadcn `TooltipContent`) to avoid the project grid's overflow clipping.
**Scale/Scope**:
- Feature touches `/projects` (one page), one new API route, one new `lib/heatmap/` module, and ~5 React components.
- Expected user data size: users typically have ≤5k jobs/year; outlier users at ~10k/year — well within a single query with existing indexes.

## Constitution Check

Evaluated against `.ai-board/memory/constitution.md` v1.8.0.

| Principle | Status | How this plan satisfies it |
|---|---|---|
| **I. TypeScript-First** | Pass | All new files declare explicit types (see `lib/heatmap/types.ts`). No `any`. All function signatures fully typed. |
| **II. Component-Driven Architecture** | Pass | Server component (`app/projects/page.tsx`) remains server-rendered; new client components marked `'use client'` only where interactivity requires (section, grid, legend components). Uses shadcn/ui `Tooltip`, `Select`. Feature folder: `components/projects/activity-heatmap-*.tsx`. Extract threshold: grid/section/header/empty/legend are separated because each has distinct state or exceeds the 300-line cohesion rule; sub-rendering of cells stays inline. |
| **III. TDD (non-negotiable)** | Pass | Five new test files enumerated in `research.md` § Existing Files. Integration tests for the API route (not E2E — no browser APIs required). Component tests via RTL+userEvent. Pure-function tests (period, buckets) as unit tests. Existing `tests/integration/projects/projects-with-health.test.ts` is EXTENDED (not duplicated) to cover the new endpoint's presence in the projects page flow. |
| **IV. Security-First** | Pass | Zod validates query params at the route layer (`querySchema`). `requireAuth(request)` enforces authentication; every Prisma read includes the `OR: [{ userId }, { members: { some: { userId } } }]` scope clause (FR-001). No raw SQL. No secrets. `Cache-Control: no-store` on the response prevents cross-account leakage. |
| **V. Database Integrity** | Pass | Read-only feature; no migrations, no transactions, no mutations. No soft-delete implications. |
| **V. Specification Clarification Guardrails** | Pass | Spec included an `Auto-Resolved Decisions` block; every AUTO→CONSERVATIVE fallback is carried forward into plan decisions (see `research.md` § Decisions 1, 2, 3, 5, 6, 7). No safeguards were trimmed. |

No violations. `Complexity Tracking` section is empty.

## Project Structure

### Documentation (this feature)

```
specs/AIB-704-activity-heatmap-on/
├── spec.md                          # Existing — feature specification
├── plan.md                          # This file
├── research.md                      # Phase 0 — existing-files inventory, patterns, decisions
├── data-model.md                    # Phase 1 — derived types, invariants, query shapes
├── contracts/
│   └── heatmap-api.md               # Phase 1 — GET /api/projects/activity-heatmap contract
├── checklists/                      # Pre-existing (from /checklist workflows)
└── tasks.md                         # Phase 2 — created by /ai-board.tasks, NOT by this command
```

### Source Code (repository root)

**Modified files** (minimal touch; follow existing patterns):

```
app/projects/page.tsx                         # Parse period/agent search params; hydrate heatmap via initialData prop
components/projects/projects-container.tsx    # Remove inner-scroll viewport constraint (FR-012)
app/lib/query-keys.ts                         # Add queryKeys.projects.activityHeatmap(period, agent)
```

**New files** (all paths verified absent via Phase 0 discovery):

```
lib/heatmap/
├── types.ts                                  # HeatmapPeriodKey, HeatmapFilters, HeatmapDay, HeatmapData, ...
├── period.ts                                 # resolvePeriod, getPeriodBoundaries, enumerateYearsSinceJoin, parsePeriodParam
├── buckets.ts                                # computeIntensityThresholds, bucketFor
└── queries.ts                                # getHeatmapInitialData(userId, filters) — Prisma reads + aggregation

app/api/projects/activity-heatmap/
└── route.ts                                  # GET — Zod validation, requireAuth, returns HeatmapData

components/projects/
├── activity-heatmap-section.tsx              # 'use client' — owns filters, URL sync, useQuery
├── activity-heatmap-header.tsx               # counter text + period/agent selectors
├── activity-heatmap-grid.tsx                 # 7-row CSS grid, month labels, pinned weekday column, cell tooltips
├── activity-heatmap-legend.tsx               # Less→More swatch row
└── activity-heatmap-empty.tsx                # empty-state (period has zero jobs AND zero ships AND agent='all')

hooks/
└── use-activity-heatmap.ts                   # TanStack Query hook wrapping fetchActivityHeatmap

tests/unit/heatmap/
├── period.test.ts                            # rolling/year boundaries, join-year clamp, param parse round-trip
└── buckets.test.ts                           # percentile-derived thresholds, degenerate distributions

tests/unit/components/projects/
├── activity-heatmap-grid.test.tsx            # chipped corners, tooltip content, touch dismiss
└── activity-heatmap-section.test.tsx         # URL sync, filter hydration, agent-filter visibility

tests/integration/heatmap/
└── heatmap-route.test.ts                     # auth, scope, Zod, ship detection, cost nulls, future clamp
```

**Structure Decision**: Single-project (Next.js App Router monorepo). No new top-level directories — new code nests under the existing `lib/`, `app/api/`, `app/projects/`, `components/projects/`, `hooks/`, and `tests/` trees. Naming follows the existing `lib/analytics/*` and `components/analytics/*` sibling convention — the heatmap gets its own `lib/heatmap/*` and `components/projects/activity-heatmap-*` since it lives on the projects page, not in the per-project analytics area.

## Implementation Phases (informational — tasks generated by `/ai-board.tasks`)

The ordered flow below is deliberate so each phase is independently testable (Constitution III):

1. **Pure helpers** — `lib/heatmap/period.ts`, `lib/heatmap/buckets.ts` with Vitest unit tests. No dependencies on Prisma or React.
2. **Types** — `lib/heatmap/types.ts` (imports `AgentFilter`, `NamedAgent` from `@/lib/analytics/types`; no new enum duplication).
3. **Server query** — `lib/heatmap/queries.ts`. Reuses `buildEffectiveAgentWhere` from `lib/analytics/queries.ts` and `formatDateForGrouping('daily')` from `lib/analytics/aggregations.ts`. Scoped by `project.userId OR project.members.some.userId` (FR-001 — Pattern 3 in research.md).
4. **API route** — `app/api/projects/activity-heatmap/route.ts`. Follows the error-handling template from `app/api/projects/[projectId]/analytics/route.ts:36-49` (Pattern 7). Integration test asserts 401/400/200 surface.
5. **Query keys + hook** — `app/lib/query-keys.ts` addition; `hooks/use-activity-heatmap.ts` wraps `useQuery` with the `filtersMatch`/`initialData` gating from `components/analytics/analytics-dashboard.tsx:56-100` (Pattern 1).
6. **UI components** — build grid, legend, header, empty state, and section in that order. Each testable in isolation.
7. **Page integration** — modify `app/projects/page.tsx` to fetch `initialData` and pass to `<ActivityHeatmapSection>`; relax the scroll constraint in `projects-container.tsx` (FR-012).
8. **Manual verification** — start the dev server and verify the golden path: sign in, land on `/projects`, see populated heatmap on first paint, hover a cell, change the year, change the agent, refresh the page — URL round-trips. Verify mobile (≤ 480px) horizontal scroll with pinned weekday column.

## Testing Strategy

Follows Constitution III decision tree applied to this feature:

| Artefact | Test type | Location | Rationale |
|---|---|---|---|
| `lib/heatmap/period.ts` | Vitest unit | `tests/unit/heatmap/period.test.ts` | Pure functions, no side effects. |
| `lib/heatmap/buckets.ts` | Vitest unit | `tests/unit/heatmap/buckets.test.ts` | Pure functions; deterministic percentile math. |
| `lib/heatmap/queries.ts` + `app/api/projects/activity-heatmap/route.ts` | Vitest integration | `tests/integration/heatmap/heatmap-route.test.ts` | Involves Prisma + auth + HTTP handler — not a browser dependency. |
| `components/projects/activity-heatmap-grid.tsx` | Vitest + RTL | `tests/unit/components/projects/activity-heatmap-grid.test.tsx` | Component with user interactions (tooltip hover/tap). `getByRole('button', ...)` + `userEvent`. |
| `components/projects/activity-heatmap-section.tsx` | Vitest + RTL | `tests/unit/components/projects/activity-heatmap-section.test.tsx` | Filter + URL sync logic; MSW mock for `/api/projects/activity-heatmap`. |
| Existing `tests/integration/projects/projects-with-health.test.ts` | Extend | same file | Add an assertion that `GET /api/projects/activity-heatmap` behaves correctly alongside existing project-list queries — do NOT duplicate into a new file. |

**Explicitly NOT Playwright**: The heatmap has no OAuth, drag-drop, or viewport-specific browser APIs. Hover behavior is adequately simulated by RTL's `userEvent.hover`, and horizontal-scroll layout is verified by a viewport-width CSS assertion (check computed `overflow-x` + `min-width`) rather than a real browser render.

**Seeding rule (Constitution III)**: Integration tests use the `[e2e]` project prefix only when they seed data visible to global cleanup. This feature's integration test uses the existing test helpers in `tests/integration/analytics/analytics-route.test.ts` as the copy-paste template; follow its fixture lifecycle exactly.

**Mock path alignment (Constitution III)**: `hooks/use-activity-heatmap.ts` imports `fetch` globally; MSW intercepts at the URL layer (no module-level mocking needed). If any test mocks `lib/heatmap/queries.ts`, the mock path MUST match the component's actual import — `@/lib/heatmap/queries` (the project uses the `@/` alias consistently).

## Complexity Tracking

*No constitution violations to justify.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |
