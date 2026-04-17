# Implementation Plan: Activity Heatmap on Projects Page

**Branch**: `AIB-667-copy-of-activity` | **Date**: 2026-04-17 | **Spec**: `specs/AIB-667-copy-of-activity/spec.md`
**Input**: `specs/AIB-667-copy-of-activity/spec.md`

## Summary

Render a GitHub-style contribution heatmap below the project cards on `/projects`, showing the viewer's AI job activity across every project they own or are a member of over the past 12 months (or a chosen calendar year), with a headline counter ("X jobs · Y tickets shipped"), per-day tooltip, year selector, and agent filter. Data is server-rendered on first paint (no spinner flash) and kept fresh via silent 15-second polling aligned with the existing analytics surfaces. Zero database schema changes — the feature composes existing `Job`, `Ticket`, and `Project` data through a new read-only account-scoped aggregation query at `/api/activity/heatmap`.

Technical approach is to mirror the existing analytics dashboard's architecture: SSR initial payload → TanStack Query hydration → URL-backed filters → 15s polling with `placeholderData` continuity to prevent cell blanking. A new `lib/activity/` module owns heatmap types, queries, and bucketing; a new `components/activity/activity-heatmap.tsx` owns the client UI; a new `/api/activity/heatmap` route exposes the aggregation.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 App Router, React 18, Prisma 6.x, TanStack Query v5.95.2, shadcn/ui (Tooltip, Select, Card), TailwindCSS 3.4
**Storage**: PostgreSQL via Prisma — read-only queries against existing `Job`, `Ticket`, `Project`, `ProjectMember`, `User` tables. No schema changes.
**Testing**: Vitest (unit + integration) with RTL via `tests/utils/component-test-utils.tsx`. No Playwright needed — no browser-specific APIs in scope.
**Target Platform**: Web — desktop and mobile viewports (min supported 375px wide).
**Project Type**: Next.js full-stack web app (single project, App Router).
**Performance Goals**: Server aggregation p95 < 150ms for a typical viewer (≤ 50 projects, ≤ 5000 jobs in 12-month window). Client poll (15s) keeps last-known-good data visible — zero layout thrash on refetch.
**Constraints**: No new DB tables, columns, or indexes (FR-028, SC-010). No spinner flash on first paint (FR-023, SC-001). Cells never blank during refetch (FR-024). Minimum cell size 14px on its short side (SC-005). No hardcoded hex/rgb colors — semantic Tailwind tokens + aurora utilities only.
**Scale/Scope**: ~10 new source files (5 components, 1 hook, 1 API route, 2 lib modules, 1 type file). ~3 new test files. Changes to ~2 existing files (`app/projects/page.tsx`, `components/projects/projects-container.tsx`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. TypeScript-First | PASS | All new code in strict TS. No `any`. All DTOs typed via `lib/activity/heatmap-types.ts`. API responses and props fully typed. |
| II. Component-Driven Architecture | PASS | shadcn Tooltip + Select + Card composed for all UI primitives. Feature folder: `components/activity/activity-heatmap*.tsx`. Server Components by default; `"use client"` only on interactive pieces. Each sub-component justified (>40 lines, own state, or reused). No bare `<div>` styling from scratch. |
| III. Test-Driven Development | PASS | New test files are genuinely new domains — confirmed via Phase 0 discovery. Tests verify behavior (rendered cells, counter values, URL params), not implementation. Mocks target the actual import paths. |
| IV. Security-First | PASS | Zod validation on all query params. `requireAuth()` on the API route; access is self-scoped (viewer sees only their own projects). Prisma parameterized queries only. No raw SQL. No secrets. Zod constraints match column constraints (year is a derived enum, agent reuses existing `AGENT_FILTER_VALUES`). |
| V. Database Integrity | PASS (trivially) | Read-only feature — no mutations, no transactions needed. No schema changes. |
| V. Spec Clarification Guardrails | PASS | Spec includes the required `Auto-Resolved Decisions` block; CONSERVATIVE policy applied throughout. Plan preserves all security and test commitments. |

**Result**: All non-negotiable gates pass. No complexity exceptions needed. Phase 0 is authorized.

## Project Structure

### Documentation (this feature)

```
specs/AIB-667-copy-of-activity/
├── spec.md              # Source spec (already present)
├── plan.md              # This file
├── research.md          # Phase 0 output — existing files, patterns, tz/intensity decisions
├── data-model.md        # Phase 1 output — runtime DTOs, no schema changes
├── contracts/
│   └── heatmap-api.md   # Phase 1 output — GET /api/activity/heatmap contract
├── checklists/
│   └── requirements.md  # (already present, from /ai-board.specify)
└── tasks.md             # Created later by /ai-board.tasks
```

### Source Code (repository root)

```
app/
├── projects/
│   └── page.tsx                           # MODIFIED: fetches initial heatmap data, renders <ActivityHeatmap />
└── api/
    └── activity/
        └── heatmap/
            └── route.ts                   # NEW: GET endpoint, requireAuth, Zod validation, 15s-poll contract

components/
├── activity/                              # EXISTING folder (activity-feed.tsx already lives here)
│   ├── activity-heatmap.tsx               # NEW: client shell — composes grid + filters + counter + legend
│   ├── activity-heatmap-grid.tsx          # NEW: 7-row grid, chipped corners, horizontal scroll on mobile
│   ├── activity-heatmap-cell.tsx          # NEW: single cell + Tooltip trigger
│   ├── activity-heatmap-filters.tsx       # NEW: year + agent Selects, URL-bound
│   ├── activity-heatmap-counter.tsx       # NEW: headline "X jobs · Y tickets shipped"
│   └── activity-heatmap-legend.tsx        # NEW: "Less □□■■■ More"
└── projects/
    └── projects-container.tsx             # MODIFIED: drop `overflow-y-auto max-h-[…]` wrapper (FR-027)

hooks/
└── use-activity-heatmap.ts                # NEW: TanStack Query hook, 15s poll, visibility-aware

lib/
└── activity/                              # NEW module
    ├── heatmap-types.ts                   # NEW: HeatmapResponse, HeatmapDay, HeatmapFilters, option types
    ├── heatmap-queries.ts                 # NEW: Prisma aggregation — jobs + ship counts, effective-agent filter
    └── heatmap-bucketing.ts               # NEW: pure helpers — local-day bucketing, grid skeleton, intensity

app/
├── globals.css                            # MODIFIED: add aurora-cell-0..aurora-cell-4 utility classes
└── lib/
    └── query-keys.ts                      # MODIFIED: add activityHeatmap key factory

tests/
├── unit/
│   ├── activity/
│   │   └── heatmap-bucketing.test.ts      # NEW: chipped corners, intensity, tz bucketing, option builder
│   └── components/
│       └── activity-heatmap.test.tsx      # NEW: RTL — URL binding, tooltip, empty state, filter visibility
└── integration/
    └── activity/
        └── heatmap-route.test.ts          # NEW: GET /api/activity/heatmap — auth, scope, ship counting, freshness
```

**Structure Decision**: Single-project Next.js App Router layout (Option 1 from the template). The feature slots into existing directories — `lib/activity/`, `components/activity/`, `app/api/activity/` — matching the `lib/analytics/` ↔ `components/analytics/` ↔ `app/api/…/analytics/` pairing that already exists per-project. The new module name `activity` distinguishes account-wide aggregation from the existing per-project analytics and reuses the existing `components/activity/` directory that houses `activity-feed.tsx`.

## Phase 0: Research — Completed

See `research.md`. Highlights:
- No `NEEDS CLARIFICATION` markers remain — all Technical Context entries resolved.
- **Existing Files** section inventories every path touched (extend vs. new).
- **Patterns to Follow** section extracts concrete line-referenced patterns from `components/analytics/analytics-dashboard.tsx` (SSR + TanStack hydration + URL state), `lib/analytics/queries.ts` (`buildEffectiveAgentWhere`), `hooks/use-usage.ts` (15s poll), and `app/api/projects/[projectId]/analytics/route.ts` (error handling).
- Timezone strategy: client sends IANA tz; server buckets via `Intl.DateTimeFormat` with UTC fallback.
- Intensity buckets: 0 / 1 / 2-3 / 4-7 / 8+ — logarithmic-ish, tunable.
- Ship counting: `command='ship' AND status=COMPLETED`, bucketed by `completedAt` local day. Manual stage=SHIP without completed ship job is NOT counted.

## Phase 1: Design & Contracts — Completed

See `data-model.md` and `contracts/heatmap-api.md`. Highlights:
- Zero schema changes. All entities consumed are existing Prisma models.
- One new API endpoint: `GET /api/activity/heatmap` returning `HeatmapResponse`.
- `HeatmapDay.totalCostUsd` is **optional, never zero-filled** — this is the structural guarantee behind FR-015 / SC-008.
- `agentOptions` derived from full account history (not filtered period) — FR-017 / FR-018.
- `days[]` is contiguous and sorted; chipped corners are handled at render time via the skeleton builder, not in the DTO.

### Post-Design Constitution Re-check

| Principle | Status | Notes |
|---|---|---|
| I. TypeScript-First | PASS | All DTOs and function signatures typed. Zod inferred types match DTO types. |
| II. Component-Driven Architecture | PASS | Component breakdown justified by the ≥2 reuse / own state / >300 line rule. Top-level shell is <300 lines; sub-components each have their own concern (grid layout, cell + tooltip, filter binding). |
| III. TDD | PASS | Three new test files cover distinct, non-overlapping domains. No existing file covers account-wide aggregation — confirmed via Phase 0 search. |
| IV. Security-First | PASS | Zod schema (`querySchema`) validates all inputs. `requireAuth` + account-scoped filter guarantee no cross-user data exposure. No raw SQL. |
| V. Database Integrity | PASS | Read-only; no mutations. No new constraints needed. |

No new violations introduced during Phase 1 design. Complexity tracking table remains empty.

## Testing Strategy

Per constitution §III and CLAUDE.md "Search existing tests FIRST — extend, don't duplicate". The Phase 0 inventory confirms no existing test file covers this feature's domains; three new files are required.

### Unit — `tests/unit/activity/heatmap-bucketing.test.ts` (NEW)
**Why new**: No existing test exercises local-day bucketing with IANA timezones or GitHub-style chipped-corner grid logic.

Cases:
1. `bucketJobsByLocalDay` — jobs at 23:59 PST vs 00:01 EST land in different days for different tz inputs.
2. `bucketJobsByLocalDay` — day with all `costUsd: null` → output omits `totalCostUsd` (does not set it to `0`) — guards SC-008.
3. `buildGridSkeleton` for year 2024 (starts Monday) → top-left chipped (Sunday cell of week 1 is a skeleton slot, not a data cell) — guards SC-009.
4. `buildGridSkeleton` for a year ending mid-week → bottom-right chipped.
5. `getIntensityLevel` bucket boundaries at 0 / 1 / 3 / 7 / 100 jobs.
6. `buildYearOptions(user.createdAt, now)` — account created this year → only `["Last 12 months"]`; account created in 2023 → `["Last 12 months","2026","2025","2024","2023"]`.

### Component — `tests/unit/components/activity-heatmap.test.tsx` (NEW)
**Why new**: No existing component test covers an account-wide heatmap with URL-backed filters.

Cases (using `renderWithProviders` from `tests/utils/component-test-utils.tsx`):
1. Initial render from `initialData` shows all cells — no loading indicator appears at any point (guards SC-001).
2. Hover a cell with 3 jobs + 1 ticket shipped + cost $1.42 → tooltip text matches spec wording.
3. Hover a cell with jobs but null cost → tooltip does NOT contain `$0` or `$NaN` (guards SC-008).
4. Mount with `?year=2025&agent=CLAUDE` → selects reflect both values; `initialData.filters` populated accordingly (guards SC-004).
5. Change year in the Select → `router.push` called with `scroll: false` and new `?year=…` param.
6. `agentOptions` containing `all + CLAUDE` (only 1 non-all entry) → agent filter NOT in DOM (guards SC-006).
7. `agentOptions` containing `all + CLAUDE + CODEX` → agent filter IS in DOM.
8. Empty state: `counters.totalJobs === 0` → centered message "No activity to show yet — your AI work will appear here"; legend and filters still visible (guards FR-007).
9. Year options when `user.createdAt` is in the current year → only "Last 12 months" is selectable (Select is disabled) (guards SC-007).

### Integration — `tests/integration/activity/heatmap-route.test.ts` (NEW)
**Why new**: No existing integration test hits an account-wide aggregation endpoint.

Cases (seeded against a test DB; follow patterns from `tests/integration/analytics/analytics-route.test.ts`):
1. Unauthenticated → 401.
2. Authenticated viewer sees only their owned + member projects (seed a project owned by another user → MUST NOT contribute cells).
3. Seed three jobs on 2025-06-15 (one COMPLETED, one FAILED, one RUNNING); the RUNNING job is NOT counted (no `completedAt`).
4. Seed a ticket with stage=SHIP and no completed ship job → `counters.ticketsShipped` is 0 for that ticket (guards SC-003 + FR-010).
5. Seed a ticket with a COMPLETED ship job, then roll back → the ship still counts on its completion day (edge case from spec).
6. Seed tickets across two agents (Claude, Codex) and filter `?agent=CLAUDE` → counter drops to Claude-only totals; `agentOptions` still lists both (historical-visibility rule).
7. Seed a ticket with `agent=null` on a project whose `defaultAgent=CLAUDE`; filter `?agent=CLAUDE` → ticket's jobs ARE included (effective-agent rule, FR-019).
8. `days[]` is contiguous (no gaps) across the selected period.
9. `tz=America/Los_Angeles` vs `tz=America/New_York` with a job at a timezone-sensitive moment → the job lands in different `days[].date` entries accordingly (guards FR-029).
10. Performance sentinel: 5000-job dataset completes within budget (p95 < 150ms asserted via `performance.now()` delta).

### Test Commands
- `bun run test:unit tests/unit/activity/heatmap-bucketing.test.ts`
- `bun run test:unit tests/unit/components/activity-heatmap.test.tsx`
- `bun run test:integration tests/integration/activity/heatmap-route.test.ts`

All three must pass before the feature is marked complete (constitution §III: "No feature is complete without passing tests").

## Complexity Tracking

*No constitution violations requiring justification.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| — | — | — |

## Implementation Phase Notes (for the later `/ai-board.tasks` step)

Informational only — actual task breakdown happens in `tasks.md`. Called out here so downstream task generation stays aligned.

1. **Foundation** (no user-visible change yet):
   - `lib/activity/heatmap-types.ts`
   - `lib/activity/heatmap-bucketing.ts` + its unit tests (follow "Patterns to Follow #6" in research.md for cost-line guardrails)
   - `app/globals.css` utility classes (`aurora-cell-0..4`)

2. **Data layer**:
   - `lib/activity/heatmap-queries.ts` — replicate `buildEffectiveAgentWhere` pattern from `lib/analytics/queries.ts:51-69`
   - `app/api/activity/heatmap/route.ts` — replicate error-handling pattern from `app/api/projects/[projectId]/analytics/route.ts:36-50`
   - `tests/integration/activity/heatmap-route.test.ts`

3. **UI shell**:
   - `components/activity/activity-heatmap*.tsx` (six files, smallest to largest: legend → cell → counter → filters → grid → shell)
   - `hooks/use-activity-heatmap.ts` — mirror `hooks/use-usage.ts:36-42` polling config + `placeholderData: (prev) => prev`
   - `tests/unit/components/activity-heatmap.test.tsx`

4. **Integration into `/projects`**:
   - `app/projects/page.tsx` — SSR initial fetch + render `<ActivityHeatmap initialData={…} />`
   - `components/projects/projects-container.tsx` — remove `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper (FR-027)
   - `app/lib/query-keys.ts` — register new query key

5. **Verification pass**:
   - `bun run type-check`
   - `bun run lint`
   - `bun run test:unit` + `bun run test:integration` for the three new files
   - Manual check at 375px viewport — horizontal scroll, sticky day labels, tappable cells

## Artifacts Generated

| Artifact | Path |
|---|---|
| Plan (this file) | `specs/AIB-667-copy-of-activity/plan.md` |
| Research | `specs/AIB-667-copy-of-activity/research.md` |
| Data model | `specs/AIB-667-copy-of-activity/data-model.md` |
| API contract | `specs/AIB-667-copy-of-activity/contracts/heatmap-api.md` |

`tasks.md` is intentionally NOT generated by this command — it is produced by `/ai-board.tasks` in the next step.
