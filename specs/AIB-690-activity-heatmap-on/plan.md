# Implementation Plan: Activity Heatmap on Projects Page (AIB-690)

**Branch**: `AIB-690-activity-heatmap-on` | **Date**: 2026-04-19 | **Spec**: `specs/AIB-690-activity-heatmap-on/spec.md`
**Input**: Feature specification from `specs/AIB-690-activity-heatmap-on/spec.md`

## Summary

Add a GitHub-style contribution heatmap below the project cards on `/projects`, aggregating AI activity (jobs and successful `ship` jobs) across every project the signed-in user owns or is a member of, over a rolling 12-month window or a chosen calendar year, optionally filtered by agent. The grid is rendered as a CSS-Grid 7×N matrix with quantile-bucketed violet intensity classes drawn from the aurora theme, hovering/tapping a cell exposes a per-day tooltip (date, tickets shipped, jobs · cost), and all filter state is URL-shareable. A new user-scoped API endpoint `GET /api/activity/heatmap` returns the full dataset in one response; the `/projects` server page fetches the same data directly for first paint and passes it as TanStack Query initial data (no spinner flash), with 15-second silent polling thereafter. No database migration — all data is derived from existing `Job`, `Ticket`, `Project`, and `User` records (FR-026, SC-008).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Node.js 22.20.0
**Primary Dependencies**: Next.js 16 (App Router, Server Components), React 18, Prisma 6.x, TanStack Query v5.95.2, Zod, date-fns 4.1.x, shadcn/ui primitives (Radix Tooltip, Popover, Select), TailwindCSS 3.4
**Storage**: PostgreSQL 14+ via Prisma — **read-only** for this feature. Uses existing `Job`, `Ticket`, `Project`, `ProjectMember`, `User` tables. No schema changes.
**Testing**: Vitest (unit + integration), @testing-library/react for component tests; Playwright only if a true browser-required case emerges (not expected here).
**Target Platform**: Same as project — Vercel-deployed Next.js 16 web app, modern evergreen browsers plus mobile Safari/Chrome (≥375 px viewport).
**Project Type**: Web application (single Next.js monorepo under `/target`).
**Performance Goals**: p95 server-side render of `/projects` heatmap data < 300 ms for 10 projects × 2000 jobs/year; client grid paint < 50 ms for 365 cells; 15 s polling cadence matches analytics/usage.
**Constraints**:
- No new database tables/columns/migrations (FR-026, SC-008).
- WCAG AA 4.5:1 text contrast in dark theme and any supported theme (FR-027).
- Tailwind classes must be literal strings (no dynamic concatenation — CLAUDE.md).
- No hardcoded hex/rgb colors — `aurora-*` / `ctp-*` / semantic tokens only.
- Tooltip must not report `$NaN`, `$0`, or fabricated cost when any contributing job lacks cost (FR-018).
- On mobile, cells ≥ 14 px tappable and weekday labels remain sticky during horizontal scroll (FR-021, FR-022).
**Scale/Scope**: Heaviest observed user today has ≤ ~5000 jobs/year across ≤ ~20 projects. Payload ≤ 400 cells × ~80 bytes ≈ 30 KB.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-checked after Phase 1 design.*

Derived from `.ai-board/memory/constitution.md` v1.8.0.

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. TypeScript-First** — strict, no implicit `any`, explicit parameter/return types, API types mirrored as interfaces. | PASS | All new code uses strict TS. `HeatmapData`, `DailyCell`, `HeatmapFilters`, etc. are declared in `lib/analytics/heatmap-types.ts` and imported by both server and client. Zod schema validates incoming query string and coerces invalid inputs. |
| **II. Component-Driven Architecture** — shadcn/ui primitives only; Server Components by default; `'use client'` only when interactivity required; feature folders; sub-components extracted only for reuse / own state / >300-line parents. | PASS | `app/projects/page.tsx` remains a Server Component and performs the initial fetch. `components/projects/activity-heatmap.tsx` is the only client entry point (`'use client'`) because it consumes `useRouter`, `useSearchParams`, `useQuery`, local state. Grid and cell are extracted per the discipline rule in `research.md` §10. Legend, month labels, day labels stay inline. All dropdowns use `@/components/ui/select`. Tooltip uses `@/components/ui/tooltip`; mobile popover uses `@/components/ui/popover`. No custom UI primitives are introduced. |
| **III. TDD (NON-NEGOTIABLE)** — tests verify behavior; extend existing test files first; mocks targeted at same module instance; no assertions inside conditionals. | PASS | Tests go in three files: `tests/unit/heatmap-aggregations.test.ts` (new, no existing file covers quantile math), `tests/integration/analytics/heatmap-route.test.ts` (new, sibling to existing `analytics-route.test.ts`; user-scoped route is a different concern so it gets its own file rather than mixing with single-project analytics), `tests/unit/components/activity-heatmap.test.tsx` (new, no existing component in this domain). The existing `tests/integration/analytics/analytics-route.test.ts` is the pattern template. |
| **IV. Security-First** — Zod validation on every user input; no raw SQL; no secrets in responses; auth middleware on protected routes. | PASS | The route validates query params with Zod (coerces rather than rejects invalid values to keep URLs shareable; that coercion is a product decision, not a validation bypass — see FR-024 and spec edge case "Invalid query params"). All DB access is via Prisma parameterized queries. Authentication via the existing `requireAuth(request)` helper which supports session + PAT + test-override. No sensitive fields are emitted in the response. |
| **V. Database Integrity** — Prisma transactions for multi-step mutations; re-read after mutation; no orphaned rows on external call failures; soft deletes. | N/A | This is a read-only feature. No transactions, no mutations, no external calls. FR-026 explicitly prohibits schema changes, verified by SC-008. |
| **V. Specification Clarification Guardrails** — AUTO defaults CONSERVATIVE on low confidence; PRAGMATIC retains safety; Auto-Resolved Decisions summary required. | PASS | The spec (lines 8–54) contains the required Auto-Resolved Decisions block with policies and trade-offs. The Phase-0 research.md re-validates each decision against concrete codebase evidence. |
| **Development Standards** — descriptive names; `const` over `let`; functional components; hooks only; no classes. | PASS | Applied throughout. |
| **State Management** — `useState` / `useContext` / `useReducer`; TanStack Query for server state; optimistic updates for mutations. | PASS | Client state uses `useState` for filters; server state via `useQuery` with `initialData` + 15 s polling. No mutations, so optimistic updates are N/A. |
| **Error Handling** — try/catch in every API route; structured error bodies; 401/403 distinction; no silent swallowing; logged with context. | PASS | The new route follows the exact try/catch shape from `app/api/projects/[projectId]/analytics/route.ts:36-50`. `getHeatmapData()` server-side wrap in `page.tsx` catches and degrades to a non-blocking error UI without blanking the cards. |
| **Aurora B+ Theme** — `aurora-*` utility classes for dialogs/cards; no hardcoded hex. | PASS | Five new `aurora-heatmap-bucket-0..4` utility classes added to `app/globals.css @layer utilities`, based on `--primary-violet`, `--ctp-lavender`, `--ctp-mauve`. Cell classes selected from a fixed 5-element literal array (CLAUDE.md "Tailwind Classes" rule). |
| **Tech-stack forbiddens** — no UI libs beyond shadcn/ui + Radix; no ORMs beyond Prisma; no state libs beyond React hooks + TanStack Query; no Recharts misuse. | PASS | Heatmap grid is native CSS Grid, not Recharts. No new dependencies. |

**Gate decision**: PASS on all applicable principles. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```
specs/AIB-690-activity-heatmap-on/
├── plan.md              # This file
├── research.md          # Phase 0 — existing files inventory, patterns, decisions
├── data-model.md        # Phase 1 — derived entities (no DB schema changes)
├── contracts/
│   └── heatmap-api.md   # Phase 1 — GET /api/activity/heatmap contract
├── checklists/          # (exists from /specify)
├── spec.md              # Feature specification
└── tasks.md             # Phase 2 output (generated by /ai-board.tasks — not created here)
```

### Source Code (repository root)

Web application, single Next.js monorepo rooted at repository root (the `target/` directory is the Next.js app; see CLAUDE.md). All paths below are relative to that root.

```
app/
├── projects/
│   └── page.tsx                      # MODIFY — add initial heatmap fetch + render
├── api/
│   └── activity/
│       └── heatmap/
│           └── route.ts              # NEW — GET /api/activity/heatmap
└── globals.css                       # MODIFY — add aurora-heatmap-bucket-0..4 utilities

components/
├── projects/
│   ├── projects-container.tsx        # MODIFY — remove max-height overflow wrapper (FR-023)
│   ├── activity-heatmap.tsx          # NEW — client entry: filters, query, layout
│   ├── activity-heatmap-grid.tsx     # NEW — pure 7×N grid + month/day labels + sticky col
│   └── activity-heatmap-cell.tsx     # NEW — single cell + tooltip/popover
└── analytics/
    └── (unchanged — analytics-dashboard.tsx is referenced as a pattern only)

lib/
├── analytics/
│   ├── queries.ts                    # MODIFY — export existing buildEffectiveAgentWhere for reuse
│   ├── aggregations.ts               # MODIFY — add computeQuantileBuckets, assignIntensityBucket
│   ├── types.ts                      # unchanged
│   ├── heatmap-types.ts              # NEW — HeatmapData, HeatmapPeriod, DailyCell, etc.
│   └── heatmap-queries.ts            # NEW — getHeatmapData(userId, filters)
└── db/
    └── (unchanged — lib/db/projects.ts and lib/db/users.ts are reference-only)

app/lib/
└── query-keys.ts                     # MODIFY — add queryKeys.heatmap.data(userId, period, agent)

tests/
├── unit/
│   ├── heatmap-aggregations.test.ts  # NEW — quantile + bucket assignment + edge cases
│   └── components/
│       └── activity-heatmap.test.tsx # NEW — filter UI, SSR data path, tooltip, empty state
└── integration/
    └── analytics/
        └── heatmap-route.test.ts     # NEW — end-to-end API behavior + effective-agent resolution
```

**Structure Decision**: Single Next.js application (the monorepo rooted at `target/`). No frontend/backend split — server components, API routes, and client components share the same tree. The heatmap's server aggregation code lives in `lib/analytics/heatmap-queries.ts` alongside the existing analytics aggregation layer so the two share the effective-agent helper. Client UI lives in `components/projects/` because the feature is visually and ownership-wise part of the `/projects` page — not a second analytics dashboard.

## Implementation Phases

*Detailed task list is produced by `/ai-board.tasks`; the phases here are the architectural handoff the tasks generator consumes.*

### Phase A — Derived types and pure utilities

1. Create `lib/analytics/heatmap-types.ts` with `HeatmapPeriod`, `HeatmapFilters`, `DailyCell`, `HeatmapSummary`, `BucketThresholds`, `HeatmapData`. Import `AgentFilter`, `AgentOption`, `NamedAgent` from `./types` — do not duplicate.
2. Extend `lib/analytics/aggregations.ts`:
   - `computeQuantileBuckets(nonZeroCounts: number[]): BucketThresholds` — handles empty input → all-zero thresholds; single distinct value → `p25 = p50 = p75 = value`.
   - `assignIntensityBucket(jobCount: number, thresholds: BucketThresholds): 0|1|2|3|4` — zero-guard (0 iff jobCount===0), boundary rules per `data-model.md §BucketThresholds`.
   - `getHeatmapPeriodBounds(period: HeatmapPeriod, now: Date): { startDate: Date; endDate: Date }` — UTC boundaries.
   - `formatUTCDate(d: Date): string` — `YYYY-MM-DD`.
3. Unit tests in `tests/unit/heatmap-aggregations.test.ts`: cover quantile edge cases (empty, single value, outlier-heavy), bucket assignment boundaries, period-bounds for rolling12m at DST crossings, invalid-year coercion.

### Phase B — Server-side data function + API route

4. Export `buildEffectiveAgentWhere` from `lib/analytics/queries.ts` (add `export` keyword; no behavioral change). Verify existing analytics tests still pass.
5. Create `lib/analytics/heatmap-queries.ts` with `getHeatmapData(userId: string, filters: HeatmapFilters, request?: NextRequest): Promise<HeatmapData>`:
   - Resolve `accessibleProjectIds` using the exact WHERE clause from `lib/db/projects.ts:32-36`.
   - Resolve `accountCreationYear` from `prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } })`.
   - Build job WHERE: `{ projectId: { in: ids }, completedAt: { gte: start, lte: end }, ticket: effectiveAgentWhere(agent) ?? {} }`.
   - Query jobs in one `findMany` with `select: { completedAt, command, status, costUsd, ticketId }`.
   - Query distinct-ship-ticket count via `prisma.ticket.count({ where: { projectId: {in}, ...effectiveAgentWhere, jobs: { some: { command: 'ship', status: 'COMPLETED', completedAt: {gte, lte} } } } })`.
   - Build per-date map; derive cells; compute thresholds; assign buckets; derive `availableAgents` (scoped to `accessibleProjectIds`), `availableYears`.
   - Follow the derivation algorithm in `data-model.md §Derivation Algorithm`.
6. Create `app/api/activity/heatmap/route.ts`:
   - Zod schema `{ period: z.union([z.literal('last12months'), z.string().regex(/^\d{4}$/)]).optional(), agent: z.enum(AGENT_FILTER_VALUES).optional() }` with `.safeParse`.
   - On parse failure OR invalid year → coerce to defaults (do not 400; FR-024 edge case).
   - `try { const userId = await requireAuth(request); const data = await getHeatmapData(userId, coerced); return NextResponse.json(data); } catch (...) { ... }` — follow the exact shape from `app/api/projects/[projectId]/analytics/route.ts:36-50`.
7. Integration tests in `tests/integration/analytics/heatmap-route.test.ts` cover each row in the contract's Test Matrix table.

### Phase C — Client UI

8. Extend `app/lib/query-keys.ts` with:
   ```ts
   heatmap: {
     data: (userId: string, period: string, agent: string) =>
       ['heatmap', userId, period, agent] as const,
   }
   ```
9. Create `components/projects/activity-heatmap.tsx` (client):
   - Accepts `{ userId: string; initialData: HeatmapData | null; initialError?: { message: string } }`.
   - Derives filter state from `useSearchParams` — defaults are NOT written to URL on subsequent changes (checked-delete logic per `research.md` Pattern 2).
   - `useQuery` with `initialData` gated by `filtersMatch()`, `refetchInterval: 15_000`, `staleTime: 10_000`.
   - Renders: header ("X jobs · Y tickets shipped in the last year"), year + agent filters (agent hidden when `availableAgents.length <= 2` counting the "all" entry — i.e. fewer than 2 distinct named agents), `<ActivityHeatmapGrid />`, legend, empty-state message, or non-blocking error card when `initialError` present and `data` unavailable.
10. Create `components/projects/activity-heatmap-grid.tsx`:
    - Pure grid: `grid-template-rows: repeat(7, minmax(14px, 1fr))`, `grid-template-columns: repeat(N, minmax(14px, 1fr))`, `gap: 2px`.
    - Sticky day-label column via `position: sticky; left: 0; z-index: 1; background: var(--background)`.
    - Month labels rendered in a separate header row aligned to the first column of each month.
    - Produces `<ActivityHeatmapCell>` per day; cells before `startDate` or after `endDate` are omitted to produce the chipped-corner effect (FR-004).
    - Wrapper has `overflow-x-auto` (FR-021).
11. Create `components/projects/activity-heatmap-cell.tsx`:
    - Desktop: Radix `<Tooltip>` on hover — tooltip content is the formatted date + "N tickets shipped" + "M jobs · $X.XX" (omit cost line when `totalCostUsd === null` — FR-018).
    - Mobile/touch: Radix `<Popover>` on tap; close on outside click (FR-019). Detect via `matchMedia('(hover: none)')` so desktop hover behavior is preserved (spec acceptance criterion explicitly says "hover over" on desktop); fall back to Popover when hover is unavailable.
    - Cell class chosen from fixed literal array `BUCKET_CLASSES[bucket]` — never dynamic concatenation.
12. Add `aurora-heatmap-bucket-0..4` utility classes to `app/globals.css` under `@layer utilities`, built on `--primary-violet` / `--ctp-mauve` / `--ctp-lavender` tokens (no hex literals). Each class includes a semi-transparent gradient + subtle inner shadow for depth; bucket 0 uses a low-alpha surface tone.
13. Modify `app/projects/page.tsx`:
    - Read `searchParams` on the server to derive initial filters.
    - `try { initialData = await getHeatmapData(userId, initialFilters) } catch (e) { initialData = null; initialError = { message: "Couldn't load activity — please refresh" } }`.
    - Render `<ActivityHeatmap userId={userId} initialData={initialData} initialError={initialError} />` below `<ProjectsContainer>`.
14. Modify `components/projects/projects-container.tsx`: remove `overflow-y-auto max-h-[calc(100vh-200px)]` wrapper; keep the inner grid-container div (FR-023).
15. Component tests in `tests/unit/components/activity-heatmap.test.tsx`: filter dropdowns update URL, empty-state message renders when `cells.every(c => jobCount===0)`, error state renders when `initialError` is set and data is missing, tooltip shows/hides cost appropriately, agent filter hidden when `availableAgents.length <= 2`.

### Phase D — Polish & verification

16. Manual QA checklist (to be expanded by `/ai-board.tasks`):
    - Verify at mobile 375 px the day labels are sticky while scrolling horizontally.
    - Verify theme contrast in dark mode for header, legend labels, tooltip text, and empty-state.
    - Verify URL-sharing round-trip with `?heatmapPeriod=2025&heatmapAgent=CLAUDE`.
    - Verify no spinner flash on cold load with seeded data.
    - Verify invalid query params (`?heatmapPeriod=1999&heatmapAgent=BOGUS`) render defaults.
17. Run `bun run type-check`, `bun run lint`, `bun run test:unit`, `bun run test:integration` — all must pass before merge per CLAUDE.md commit rules.

## Testing Strategy

Per constitution §III — Testing Trophy prioritizes integration tests; E2E only when browser is truly required. All new tests use Vitest.

**Unit tests** (`tests/unit/heatmap-aggregations.test.ts` — NEW file, no existing coverage):
- `computeQuantileBuckets` with `[]`, `[1]`, `[1,1,1]`, `[1,2,3,4,5,10,10,10]`, extreme outlier `[1,1,1,1,100]`.
- `assignIntensityBucket` boundary cases: 0, p25, p25+1, p50, p75, above p75.
- `getHeatmapPeriodBounds` for `rolling12m` across DST crossing days and for leap year 2024.
- `formatUTCDate` determinism.

**Integration tests** (`tests/integration/analytics/heatmap-route.test.ts` — NEW sibling to `analytics-route.test.ts`):
- Reuse `getTestContext()` + `getPrismaClient()` from existing helpers.
- Mock `@/lib/db/users.ts:requireAuth` (not `@/lib/db/auth-helpers` — the new route uses `requireAuth` directly) to return a seeded `userId` — matching the constitution rule that mocks target the same module instance the code under test imports.
- Seed: two projects (one owned, one membered via `ProjectMember`), mix of tickets with/without explicit agent, jobs spread over 370 days, multiple ship jobs on same ticket on same day, one job with `costUsd=null`.
- Assert every row in the Test Matrix from `contracts/heatmap-api.md`.

**Component tests** (`tests/unit/components/activity-heatmap.test.tsx` — NEW, no existing file covers this component):
- Use `renderWithProviders()` from `tests/utils/component-test-utils`.
- Query by role (`getByRole('combobox', { name: /period/i })`, `getByRole('tooltip')`) per constitution RTL rules.
- Assert URL is updated via a mocked `router.push`; default values do not appear in the URL.
- Assert empty-state message "No activity to show yet — your AI work will appear here" when cells are all zero.
- Assert tooltip shows "4 jobs" (no cost) when `totalCostUsd` is null.
- Assert agent select is NOT in the document when only one agent or zero agents have activity.

**E2E**: none. The page is SSR-first with initial data; no OAuth, no drag-drop, no viewport-sensitive interaction that Playwright is uniquely required for. Mobile viewport behavior is verified manually during Phase D.

**Test file selection justification** (constitution §III): Searched `components/` and `tests/unit/` for existing heatmap-like component tests — found `tests/unit/components/comparison-compliance-heatmap.test.tsx`, but that covers a per-ticket compliance matrix, not a per-day calendar grid. Creating a new test file avoids mixing unrelated concerns. Same reasoning for `heatmap-aggregations.test.ts` (no existing pure-function file covers quantiles) and `heatmap-route.test.ts` (existing `analytics-route.test.ts` is single-project scoped, not user-scoped).

## Complexity Tracking

*No violations. Table intentionally empty.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Post-Design Constitution Re-check

Phase 1 artifacts (`data-model.md`, `contracts/heatmap-api.md`) and the design above are consistent with the initial check:

- **TypeScript-First** — data model declares concrete interfaces; no `any`; Zod schema on the route.
- **Component-Driven** — three new client components, each justified by the extraction criteria (grid has its own scroll effect; cell has 365 instances × own tooltip state; parent owns query/filter state). No shadcn/ui escape hatches.
- **TDD** — three test files scoped precisely; no duplication with existing tests.
- **Security-First** — auth via `requireAuth`; Zod coercion-not-reject is explicitly a product requirement, not a validation bypass.
- **Database Integrity** — read-only; no transactions needed; no mutations.
- **Auto-Resolved Decisions** — spec's five auto-resolved decisions are each mapped to a concrete implementation decision in `research.md §Research Decisions`.
- **Aurora theme + Tailwind rules** — five new utility classes in `globals.css`, selected from a literal array in code.

Gate remains **PASS**. Ready for Phase 2 task generation via `/ai-board.tasks`.
