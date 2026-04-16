# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-664-activity-heatmap-on` | **Date**: 2026-04-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/AIB-664-activity-heatmap-on/spec.md`

## Summary

Add a GitHub-style contribution heatmap to the `/projects` page showing per-day job counts for the authenticated user across all accessible projects over a rolling 12-month window (default) or a specific calendar year. Includes agent filter, tooltips (date / shipped tickets / job count / cost), URL-driven filters, server-rendered initial data, and 15s background polling. No new database tables; feature is a read-only derived aggregation over existing `Job`, `Ticket`, `Project`, `User` models.

**Technical approach**: A sibling module to `lib/analytics/` — `lib/heatmap/` — provides the pure aggregations and Prisma query layer. A single `GET /api/heatmap` route handler exposes the user-scoped payload. A new client component `components/projects/activity-heatmap.tsx` replicates the server-initial + `useQuery(refetchInterval: 15000)` pattern from `components/analytics/analytics-dashboard.tsx`. Authorization scope is extracted from `lib/db/projects.ts:getUserProjects` into a shared helper `getAccessibleProjectIdsForUser(userId)` to avoid the owner-OR-member clause diverging between call sites.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode, `strict: true`, no `any`)
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5.95.2, Zod, shadcn/ui + Radix, Tailwind 3.4
**Storage**: PostgreSQL 14+ via Prisma (read-only for this feature; no migration)
**Testing**: Vitest (unit + integration), Playwright for the single cross-browser scenario (only if warranted; see Testing Strategy)
**Target Platform**: Next.js server-rendered + React client; modern browsers; mobile viewport ≥ 375px
**Project Type**: Web application (Next.js monorepo-within-app: `app/`, `components/`, `lib/`, `tests/`)
**Performance Goals**: p95 server render time for `/projects` heatmap payload < 200ms at 10k-job scale per user; client re-render on filter change < 100ms
**Constraints**: No new Prisma migration (FR-018); no hex color literals (CLAUDE.md); no dynamic Tailwind class construction; 15s polling budget matches existing analytics cadence
**Scale/Scope**: Expected per-user job volume: up to ~10k jobs in a single year. Grid dimensions: 7 rows × ~53 columns ≈ 371 cells per year; 366 `inPeriod=true` cells in a leap year.

## Constitution Check

Principle-by-principle review against `.ai-board/memory/constitution.md` v1.8.0:

| # | Principle | Gate | Status |
|---|---|---|---|
| I | TypeScript-First | All new `lib/heatmap/*`, `app/api/heatmap/route.ts`, and `components/projects/activity-heatmap.tsx` files use strict typing; no `any`; payload typed via `HeatmapData` in `lib/heatmap/types.ts`; API returns `Promise<NextResponse>`. | **PASS** |
| II | Component-Driven | Only shadcn/ui + Radix (`Select`, `Tooltip`) used for UI primitives; Server Component at `/projects` passes `initialData` to a single Client Component; cell is extracted into a sub-component only if the parent exceeds ~300 lines OR if its stateful tooltip behaviour justifies the split (criterion b: own state/effects). | **PASS** |
| III | TDD / Test selection | Unit tests for pure aggregations (`heatmap-aggregations.test.ts`); integration tests for API + query layer (`heatmap-route.test.ts`, `heatmap-queries.test.ts`); component test for URL sync and interactions (`activity-heatmap.test.tsx`); Playwright only if spinner-flash assertion cannot be made at component level. Existing test files reviewed and none cover the heatmap domain — new files justified per constitution III "Search existing tests FIRST". | **PASS** |
| IV | Security-First | All query params Zod-validated; agent values restricted to `ALL_AGENTS` enum; no raw SQL; `requireAuth()` enforces identity; project scope never widened (FR-019, SC-003); no secrets introduced. | **PASS** |
| V (a) | Database Integrity | No schema changes, no migrations, no mutations — pure read. | **PASS (trivially)** |
| V (b) | Clarification Guardrails | Spec contains an Auto-Resolved Decisions section covering all 6 clarification points; confidence levels documented; no PRAGMATIC decision trims security or test commitments. | **PASS** |

**Additional Development Standards checks**:
- Code Quality: descriptive names, no single-letter variables, JSDoc on exported aggregations. **PASS**.
- State Management: TanStack Query for the server-state polling; `useState` for the filters pre-commit mirror (initialized from URL); no Redux/Zustand. **PASS**.
- Error Handling: API route wraps in `try/catch`, returns structured `{ error }` body; 401 for auth; 500 as last resort with `console.error`; no silent swallowing. **PASS**.

**No constitution violations. Complexity Tracking section is empty.**

## Project Structure

### Documentation (this feature)

```
specs/AIB-664-activity-heatmap-on/
├── plan.md                      # This file
├── research.md                  # Phase 0 output (done)
├── data-model.md                # Phase 1 output (done)
├── contracts/
│   └── heatmap-api.md           # Phase 1 output (done)
└── spec.md                      # Pre-existing feature spec
```

### Source Code (repository root)

This is a Next.js web application; there is no separate `backend/` / `frontend/` split. New and modified paths:

```
app/
├── projects/
│   └── page.tsx                            # EXTEND — await getHeatmapData, pass initialData to heatmap
└── api/
    └── heatmap/
        └── route.ts                        # NEW — GET handler, Zod silent-fallback, requireAuth, returns HeatmapData

components/
└── projects/
    ├── activity-heatmap.tsx                # NEW — Client component (useQuery 15s poll, URL-synced filters)
    ├── activity-heatmap-cell.tsx           # NEW — Extracted only if parent > 300 lines or stateful-tooltip split justifies
    └── projects-container.tsx              # EXTEND (IF NEEDED) — relax any overflow-y trap that blocks page-level scroll to heatmap (FR-017)

lib/
├── heatmap/
│   ├── queries.ts                          # NEW — getHeatmapData(userId, filters): Prisma aggregation
│   ├── aggregations.ts                     # NEW — pure fns: getPeriodBounds, computeIntensityThresholds, getIntensityLevel, buildPeriodOptions
│   └── types.ts                            # NEW — HeatmapPeriod, HeatmapFilters, HeatmapDayCell, HeatmapData, etc.
└── db/
    └── projects.ts                         # EXTEND — add getAccessibleProjectIdsForUser(userId)

app/lib/
└── query-keys.ts                           # EXTEND — add heatmap.data(period, agent)

tests/
├── unit/
│   ├── heatmap-aggregations.test.ts        # NEW — pure-fn coverage (period bounds, quartiles, period options, leap year)
│   └── components/
│       └── activity-heatmap.test.tsx       # NEW — URL sync, filter hiding, empty-state, tooltip contract
└── integration/
    └── heatmap/
        ├── heatmap-route.test.ts           # NEW — API matrix (see contracts/heatmap-api.md §Test matrix)
        └── heatmap-queries.test.ts         # NEW — access scope, effective-agent, cost nulls, ship-counting
```

**Structure Decision**: Next.js App Router single-app layout (the existing repo structure). New source under three areas:
1. `lib/heatmap/` — parallel sibling to `lib/analytics/`, matching that module's split (queries, aggregations, types). Rationale in research.md §"Existing Files".
2. `app/api/heatmap/route.ts` — user-scoped top-level route (no `[projectId]` segment, per contract).
3. `components/projects/activity-heatmap.tsx` — feature-folder colocation with the other projects-page components.

No changes to `app/` / `components/` / `lib/` directory conventions.

## Implementation Phases

### Phase A — Types and pure aggregations (enables tests-first)
1. Create `lib/heatmap/types.ts` with the interfaces defined in `data-model.md`.
2. Create `lib/heatmap/aggregations.ts` with:
   - `getPeriodBounds(period, userCreatedAt, now)` → `{ startDate, endDate, gridStart, gridEnd }` (grid-start is the Sunday on/before `startDate`).
   - `buildPeriodOptions(userCreatedAt, now)` → `HeatmapPeriodOption[]` per FR-007.
   - `computeIntensityThresholds(nonZeroDailyCounts)` → `[Q1, Q2, Q3, max]` per data-model.md rule 9.
   - `getIntensityLevel(count, thresholds)` → `0|1|2|3|4`.
   - `getIntensityClass(level)` → one of five literal Tailwind strings (per research.md Pattern 5).
   - `formatHeaderCopy(period, totals)` → e.g., `"12 jobs · 3 tickets shipped in the last year"` / `"… in 2024"`.
3. Write `tests/unit/heatmap-aggregations.test.ts` covering: 12-month window including leap year, account-created-this-year option pruning, quartile edges (all-zero, single day, uniform, skewed), level boundary inclusiveness.

### Phase B — Authorization helper extraction
1. In `lib/db/projects.ts`, add exported `getAccessibleProjectIdsForUser(userId: string): Promise<number[]>` that returns the array of project ids where the user is owner OR member. Use the exact same `{ OR: [{ userId }, { members: { some: { userId } } }] }` clause from `getUserProjects` (verified in `lib/db/projects.ts:31`).
2. Do NOT change `getUserProjects` behaviour.
3. Add a minimal unit test (or extend `tests/unit/auth-helpers.test.ts` if it covers this module; otherwise add a new integration test file `tests/integration/projects/accessible-ids.test.ts`).

### Phase C — Query layer
1. Create `lib/heatmap/queries.ts` exporting `getHeatmapData(userId, filters): Promise<HeatmapData>`:
   - Resolve `user.createdAt` via `prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })`.
   - Resolve accessible project ids via `getAccessibleProjectIdsForUser(userId)`.
   - Derive `{ startDate, endDate, gridStart, gridEnd }` via `getPeriodBounds`.
   - Run `prisma.job.findMany` with `where: { projectId: { in: ids }, status: { in: [COMPLETED, FAILED] }, completedAt: { gte: startDate, lte: endDate } }` selecting `{ completedAt, command, status, costUsd, ticketId, ticket: { select: { agent: true, project: { select: { defaultAgent: true } } } } }`.
   - Bucket jobs by `date(completedAt)` in server TZ into a `Map<string, DailyAgg>`.
   - Compute `availableAgents` from the **unfiltered** map (research.md §Decision: Agent filter options).
   - If `filters.agent !== 'all'`, filter the map after availableAgents is computed (rule 4 in data-model.md).
   - Compute `shippedTicketCount` per day via a DISTINCT set of ticket ids where `command === 'ship' && status === COMPLETED`.
   - Compute `totalCost` per day via null-safe sum (rule 5).
   - Compute `intensityThresholds` via `computeIntensityThresholds`.
   - Build the contiguous `days[]` array from `gridStart` to `gridEnd`, looking up each date in the bucket map.
   - Compute `totals.jobCount` and `totals.shippedTicketCount` (agent-filter-respecting).
   - Return the fully-typed `HeatmapData`.
2. Write `tests/integration/heatmap/heatmap-queries.test.ts` covering rules 1–9 in data-model.md. Follow Pattern 4 from research.md for scope testing (seed a job on a project the user is NOT on and assert its absence).

**Error-handling pattern (from research.md Pattern 2/4)**: the query layer does not catch; it propagates `Error('Unauthorized')` from `requireAuth` up through the route. On external failure (DB down) Prisma throws; the route's generic 500 branch handles it. There is no DB mutation so the "DB-then-external-call" rollback pattern from constitution V doesn't apply.

### Phase D — API route
1. Create `app/api/heatmap/route.ts`:
   - `import { z } from 'zod'` and define the permissive schema (period: `z.string().regex(/^(last-12-months|\d{4})$/).catch('last-12-months')`, agent: `z.enum(['all', ...ALL_AGENTS]).catch('all')`).
   - `requireAuth(request)` → userId.
   - `getHeatmapData(userId, parsedFilters)` → payload.
   - `return NextResponse.json(payload)`.
   - Error branches: `ZodError` (unreachable with `.catch`), `Error.message === 'Unauthorized'` → 401, else `console.error` + 500.
2. Write `tests/integration/heatmap/heatmap-route.test.ts` implementing the full test matrix in `contracts/heatmap-api.md`.

### Phase E — Query-key + client component
1. Extend `app/lib/query-keys.ts` with `heatmap: { data: (period: string, agent: string) => ['heatmap', period, agent] as const }`.
2. Create `components/projects/activity-heatmap.tsx`:
   - Props: `{ initialData: HeatmapData; userCreatedYear: number }`. `initialFilters` inferred from `initialData.filters`.
   - State: `filters` initialized from `useSearchParams` falling back to `initialData.filters` (mirror `getInitialFilters` in `analytics-dashboard.tsx:60`).
   - `shouldUseInitialData = filtersMatch(filters, initialData.filters)`.
   - `useQuery({ queryKey: queryKeys.heatmap.data(filters.period, filters.agent), queryFn: () => fetch('/api/heatmap?…').then(r => r.json()), initialData: shouldUseInitialData ? initialData : undefined, refetchInterval: 15000, staleTime: 10000 })`.
   - `updateFilters(next)` → `setFilters(next)` + `router.push('?…', { scroll: false })`.
   - Render:
     - Header: `{formatHeaderCopy(filters.period, totals)}`.
     - Filter row: period `<Select>` populated from `data.periodOptions`; agent `<Select>` hidden when `data.availableAgents.length === 0` (FR-008).
     - Grid: CSS grid `grid-rows-7 grid-flow-col auto-cols-max` with cells at `style={{ gridRow: dayOfWeek+1, gridColumn: weekIndex+1 }}` — deterministic positioning so out-of-period cells produce chipped corners naturally by omission.
     - Day-of-week labels column: `sticky left-0 z-10 bg-background` (FR-016).
     - Month labels row: computed from `days[]` where `date.getDate() === 1` → label in that column.
     - Legend: "Less" + 5 small squares + "More".
     - Empty-state swap: when `data.totals.jobCount === 0`, replace the grid area with the centered message; keep legend + filters visible (FR-015).
   - Each cell renders via either inline JSX (if total file stays < 300 lines) or an extracted `activity-heatmap-cell.tsx` (Radix `Tooltip` controlled; mobile pointerdown-outside dismiss).
3. Write `tests/unit/components/activity-heatmap.test.tsx` covering: render with initial data (no spinner), change period updates URL and triggers fetch mock, empty-state replacement, agent filter hidden when `availableAgents.length === 0`, tooltip renders expected lines and omits cost line when `totalCost === null`.

### Phase F — Projects page integration
1. Edit `app/projects/page.tsx`:
   - `const { searchParams }` from the page's `({ searchParams }: { searchParams: …})` signature (Next.js 16 App Router).
   - Resolve the authenticated user id (mirror the existing auth pattern already used for `getUserProjects()` in that file).
   - Parse `period`/`agent` from `searchParams` with the same permissive coercion as the route.
   - `const heatmap = await getHeatmapData(userId, filters)`.
   - `const userCreatedYear = new Date(user.createdAt).getFullYear()`.
   - Render `<ActivityHeatmap initialData={heatmap} userCreatedYear={userCreatedYear} />` below the `<ProjectsContainer />` inside a `<section className="mt-8">…</section>`.
2. If `components/projects/projects-container.tsx` sets `overflow-y-*` or a `max-h-screen` that traps the page scroll, remove/soften it so the page scrolls naturally to reveal the heatmap (FR-017). Otherwise leave untouched. Document the observation in the PR either way.
3. Add a Playwright e2e only if `tests/unit/components/activity-heatmap.test.tsx` cannot assert the no-spinner-flash guarantee in a realistic enough environment; prefer integration-level assertions first.

### Phase G — Post-design re-check (Constitution gate)

After Phase 1 design (this plan and contracts), re-evaluate the constitution gates:
- No new `any`. No dynamic Tailwind class strings. No raw SQL. No hex color literals. No optimistic updates required (read-only). No DB mutations (V/a trivially passes). Tests cover each FR. **Gates still PASS.**

## Testing Strategy

Per constitution III decision tree:

| Concern | Test Type | File | Decision tree path |
|---|---|---|---|
| `getPeriodBounds`, `buildPeriodOptions`, `computeIntensityThresholds`, `getIntensityLevel`, `getIntensityClass`, `formatHeaderCopy` | Vitest unit | `tests/unit/heatmap-aggregations.test.ts` (NEW) | (1) pure function |
| `getAccessibleProjectIdsForUser` | Vitest integration | `tests/integration/projects/accessible-ids.test.ts` (NEW) — or extend existing auth-helper tests if one covers `lib/db/projects.ts` specifically | (3) DB-dependent |
| `getHeatmapData` rules (access, agent, cost nulls, ship counting) | Vitest integration | `tests/integration/heatmap/heatmap-queries.test.ts` (NEW) | (3) DB |
| `/api/heatmap` route behaviour | Vitest integration | `tests/integration/heatmap/heatmap-route.test.ts` (NEW) | (3) API |
| `<ActivityHeatmap>` render + URL sync + tooltip + empty state | Vitest + RTL | `tests/unit/components/activity-heatmap.test.tsx` (NEW) | (2) component with interactions |
| `<ActivityHeatmapCell>` tooltip open/close, mobile outside-tap dismiss | Vitest + RTL | included in the component test (avoid fragmenting across two files) | (2) component |
| End-to-end "no spinner flash on `/projects` and URL reload preserves period" | Playwright e2e (only if needed) | `tests/e2e/projects-heatmap.e2e.ts` (NEW, conditional) | (4) only if browser strictly required |

**Search-existing rule**: `tests/integration/analytics/analytics-route.test.ts` covers the project-scoped analytics route (different URL, different scope) and is not a candidate to extend. `tests/unit/components/analytics-dashboard.test.tsx` covers the analytics dashboard component (different props, different URL). Creating parallel heatmap-scoped files is the correct call; extending either existing file would mix unrelated concerns and violate constitution III.

**[e2e] prefix rule**: if an e2e test is added, project/ticket names in that test MUST be prefixed `[e2e]` per CLAUDE.md.

## Complexity Tracking

*No constitution violations. This section is intentionally empty.*
