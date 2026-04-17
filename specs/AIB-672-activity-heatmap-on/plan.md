# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-672-activity-heatmap-on` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-672-activity-heatmap-on/spec.md`

## Summary

Render a GitHub-style contribution heatmap on `/projects`, below the project
cards grid, summarising AI activity across every project the signed-in user
can access over the last 12 months (rolling) or a selected calendar year.
Aggregation runs server-side from existing `Job`, `Ticket`, `Project` rows
(no schema changes); the page SSRs with initial data so the grid appears
without a spinner flash. A single new user-scoped endpoint
`GET /api/activity-heatmap` serves both the SSR call and client-side filter
changes. Tooltips, agent filter, year selector, URL state, mobile horizontal
scroll, and empty state behave exactly as specified in `spec.md` (FR-001
through FR-034).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router, RSC), React 18, Prisma 6.x,
TanStack Query v5.95.2, shadcn/ui (Radix Tooltip + Select + Card),
Tailwind 3.4, Zod
**Storage**: PostgreSQL 14+ via Prisma (no schema changes — reads existing
`Job`, `Ticket`, `Project`, `User`, `ProjectMember`)
**Testing**: Vitest (unit + integration) + React Testing Library; Playwright
E2E not required (no OAuth, drag-drop, or browser-specific flows)
**Target Platform**: Linux server (Next.js) rendering to modern browsers
(desktop + ≤375 px mobile)
**Project Type**: Web (single Next.js app with `app/`, `components/`, `lib/`,
`prisma/`, `tests/`)
**Performance Goals**: SSR adds ≤ one SQL round-trip to `/projects`; p95 query
budget < 300 ms for a user with one year of jobs across ≤ 20 projects
**Constraints**: No new UI libraries (shadcn only); no new ORMs; no
hardcoded hex colours — use `aurora-*` utilities and semantic tokens; no
dynamic Tailwind class construction; bucket in the viewer's timezone; no
loading spinner on first paint (FR-029)
**Scale/Scope**: v1 target = single user × ≤ 20 accessible projects × ≤ 366
days; one new API route, one new client component, one pure-function module,
three new test files

## Constitution Check

Evaluated against `.ai-board/memory/constitution.md` v1.8.0.

| Principle | Verdict | Notes |
|-----------|---------|-------|
| I. TypeScript-First Development | PASS | All new modules fully typed; no `any`; shared types exported from `lib/analytics/activity-heatmap.ts` |
| II. Component-Driven Architecture | PASS | Uses shadcn/ui `Tooltip`, `Select`, `Card`; Server Component for the page host fetches initial data; Client Component only for the filter/tooltip interactions (`"use client"`). Feature folder: `components/projects/`. Single component <300 lines expected; extraction only if threshold hit. |
| III. Test-Driven Development | PASS | Three new test files (unit lib, integration route, unit component). No existing test covers cross-project activity aggregation, so new files are justified per "create only when no existing file covers the domain". Test selection tree: aggregation helpers → Vitest unit; API route → Vitest integration; component with user interactions → Vitest + RTL component test. |
| IV. Security-First Design | PASS | `requireAuth()` at API boundary; Zod schemas validate `y`, `a`, `tz` with explicit enum/range constraints; Prisma parameterised queries only; no secrets touched; no new PII; response contains no internal project IDs beyond those the viewer already has. |
| V. Database Integrity | PASS | No migrations, no mutations. Read-only aggregation. Graceful degradation on query failure (page still renders without the heatmap). |
| V. Specification Clarification Guardrails | PASS | Spec's `Auto-Resolved Decisions` block is present and reflects the CONSERVATIVE/PRAGMATIC policy defaults. All five auto-resolved decisions are recorded for reviewer notes. |

No violations. `Complexity Tracking` table intentionally omitted.

## Project Structure

### Documentation (this feature)

```
specs/AIB-672-activity-heatmap-on/
├── plan.md                          # This file
├── research.md                      # Phase 0 output (existing files, patterns, decisions)
├── data-model.md                    # Phase 1 output (entities + derived shapes)
├── contracts/
│   └── activity-heatmap-api.md      # GET /api/activity-heatmap
├── spec.md                          # Feature specification (input)
└── tasks.md                         # Created by /ai-board.tasks — NOT by this command
```

### Source Code (repository root)

```
app/
├── projects/
│   └── page.tsx                      # EDIT: fetch heatmap initial data, render <ActivityHeatmap />
└── api/
    └── activity-heatmap/
        └── route.ts                  # NEW: GET handler, Zod validation, delegates to lib helper

components/
└── projects/
    ├── activity-heatmap.tsx          # NEW: client component — grid, tooltip, filters, URL state
    └── projects-container.tsx        # EDIT: remove internal max-h/overflow to allow page scroll (FR-032)

lib/
└── analytics/
    └── activity-heatmap.ts           # NEW: pure helpers + server-side data access
                                      #   - getHeatmapData({ userId, period, agent, tz })
                                      #   - bucketJobsByLocalDay(jobs, tz)
                                      #   - computeIntensityThresholds(max)
                                      #   - resolveYearSelectorOptions(createdAt, now)
                                      #   - buildPeriodBounds(period, now, tz)

tests/
├── unit/
│   ├── lib/analytics/
│   │   └── activity-heatmap.test.ts               # NEW
│   └── components/projects/
│       └── activity-heatmap.test.tsx              # NEW
└── integration/
    └── activity-heatmap/
        └── route.test.ts                           # NEW

prisma/
└── schema.prisma                     # READ ONLY — no changes
```

**Structure Decision**: Single Next.js application with feature-based
grouping. New heatmap code lives under `components/projects/` (client
component and its tests) and `lib/analytics/` (pure helpers and DB access);
the API surface sits at `app/api/activity-heatmap/route.ts`. This mirrors the
established per-project analytics layout (`components/analytics/`,
`lib/analytics/`, `app/api/projects/[projectId]/analytics/route.ts`) — the
only deviation is the top-level, user-scoped endpoint, justified in
`research.md` (Decision: API surface scope).

## Implementation Phases

### Phase 3 — Data layer (pure functions + server helper)
1. Add types in `lib/analytics/activity-heatmap.ts` that mirror the API
   contract (`HeatmapPeriod`, `HeatmapAgentFilter`, `HeatmapDayCell`,
   `HeatmapResponse`).
2. Implement pure helpers: `buildPeriodBounds`, `bucketJobsByLocalDay`
   (uses `Intl.DateTimeFormat(tz, { … }).formatToParts` for day keys),
   `computeIntensityThresholds`, `resolveYearSelectorOptions`.
3. Implement `getHeatmapData({ userId, period, agent, tz })` server helper
   that (a) resolves accessible project IDs via the `OR: [{userId}, {members:…}]`
   clause, (b) queries jobs with `projectId in [...]` and `startedAt in [start, end]`,
   (c) joins ship jobs to tickets for the shipped counter, (d) applies
   effective-agent filter via `resolveEffectiveAgent`, (e) assembles the
   full `HeatmapResponse`.

### Phase 4 — API route
4. Create `app/api/activity-heatmap/route.ts` using the Zod schema from
   `contracts/activity-heatmap-api.md`. Mirror the error-handling shape of
   `app/api/projects/[projectId]/analytics/route.ts:36-50` (ZodError → 400,
   `Unauthorized` → 401/403, default 500).

### Phase 5 — UI component
5. Create `components/projects/activity-heatmap.tsx` (`"use client"`):
   - Props: `initialData: HeatmapResponse | null`, `errored: boolean`.
   - `useQuery` keyed on `['activity-heatmap', y, a, tz]` seeded with
     `initialData`.
   - Render: Card shell with `aurora-bg-subtle`, header counter, year Select
     + conditional agent Select, 7×N cell grid with sticky day labels
     (FR-034), legend, empty-state message (FR-012).
   - Cells: `<TooltipProvider>` wrapper; each cell a
     `<Tooltip><TooltipTrigger asChild><div … /></TooltipTrigger>…</Tooltip>`
     with per-intensity `aurora-cell-*` class from a static 5-entry lookup
     (CLAUDE.md "no dynamic Tailwind").
   - Tooltip content: date + shipped list (collapse deleted tickets to
     "N more tickets" per edge case) + `jobs · cost` line omitted when all
     costs are null (FR-020).
   - URL state: `useSearchParams()` + `router.replace()` omitting defaults.

### Phase 6 — Page integration
6. Edit `app/projects/page.tsx`:
   - Call a new `getInitialHeatmapData()` helper (in-process, no HTTP hop)
     wrapped in `try/catch` that logs and returns `{ data: null, errored: true }`
     (graceful degradation — the page already does this for projects).
   - Render `<ActivityHeatmap initialData={…} errored={…} />` **below**
     `<ProjectsContainer />` inside the `container mx-auto …` wrapper.
7. Edit `components/projects/projects-container.tsx`:
   - Remove `overflow-y-auto max-h-[calc(100vh-200px)]` (FR-032). Keep the
     responsive grid classes untouched.

### Phase 7 — Tests
8. Tests created per Testing Strategy below. Run `bun run test:unit` and
   `bun run test:integration` locally; `bun run type-check` and
   `bun run lint` must both pass before commit (CLAUDE.md).

## Testing Strategy

Project constitution §III: start at the Testing Trophy middle (integration +
component) and only climb to E2E when a browser is strictly required. This
feature has no browser-specific behaviour (no drag-drop, no OAuth, no
camera/geolocation), so E2E is **not** required.

### Files to create

| Path | Rationale | Why new (vs extend) |
|------|-----------|---------------------|
| `tests/unit/lib/analytics/activity-heatmap.test.ts` | Vitest unit — covers `bucketJobsByLocalDay`, `computeIntensityThresholds`, `resolveYearSelectorOptions`, `buildPeriodBounds` | No existing test file in `tests/unit/lib/analytics/` covers cross-project heatmap helpers; extending the per-project analytics tests would mix unrelated concerns (constitution §III). |
| `tests/integration/activity-heatmap/route.test.ts` | Vitest integration — exercises the API route with a real Prisma worker: auth 401, filter validation 400, cross-project aggregation, `tz` fallback, agent filter effect, shipped counter correctness (seed a ticket at stage SHIP with NO successful ship job → NOT counted, per SC-007). | Analytics route test is per-project; extending it would require new fixtures for multi-project data and unrelated branches — new file is cleaner. |
| `tests/unit/components/projects/activity-heatmap.test.tsx` | Vitest + RTL — grid renders from seed data, empty state text, tooltip content (including no-cost day, deleted ticket collapse), agent filter visibility toggle (FR-024), URL state round-trip with `useSearchParams` mock. | The existing compliance-heatmap test is a pattern reference, not the same component. No existing `components/projects/` test covers the heatmap. |

### Critical assertions mapped to Success Criteria

| SC | Where covered |
|----|---------------|
| SC-001 (no spinner on first paint) | Component test asserts grid renders synchronously when `initialData` is provided (no loading text) |
| SC-002 (zero `$NaN`/`$0` placeholder) | Component test for a day whose jobs all have null `costUsd`: assert cost line is absent |
| SC-003 (< 200 ms filter update) | Component test: on agent change, assert grid updates without re-render of boundaries (same week count before/after) |
| SC-004 (URL round-trip) | Component test: set filters, assert `router.replace` called with expected params; then remount with those searchParams and assert state restored |
| SC-005 (mobile sticky + tappable) | Component test: assert left-column header has `sticky` class; cell `data-testid="heatmap-cell"` exists in the DOM |
| SC-006 (empty state) | Component test with zero-activity payload |
| SC-007 (shipped counter integrity) | Integration test: seed ticket at stage SHIP with no completed ship job; assert `counters.shippedTicketCount === 0` |
| SC-008 (year selector options) | Unit test for `resolveYearSelectorOptions` covering account-created-this-year (empty list) and multi-year case |

### Existing tests to not disturb

- `tests/integration/analytics/analytics-route.test.ts` — unchanged (this feature adds a new route, does not modify the existing one).
- `tests/unit/components/comparison-compliance-heatmap.test.tsx` — read-only pattern reference.

### Commands

```bash
bun run test:unit tests/unit/lib/analytics/activity-heatmap.test.ts
bun run test:unit tests/unit/components/projects/activity-heatmap.test.tsx
bun run test:integration tests/integration/activity-heatmap/route.test.ts
bun run type-check && bun run lint
```

## Out of Scope (explicit)

- Non-Sunday-first locales (spec edge case — v1 always Sunday-first).
- Per-project filtering inside the heatmap (future enhancement per spec auto-resolved decision #1).
- Polling: the heatmap does not poll; it refetches only on filter change.
- E2E browser tests (no browser-specific behaviour).
- Exporting the heatmap as an image or sharing via OG tags (URL share only per FR-027).
- New Prisma models or migrations (FR-005 explicitly forbids this).

## Complexity Tracking

No constitution violations — section intentionally empty.
