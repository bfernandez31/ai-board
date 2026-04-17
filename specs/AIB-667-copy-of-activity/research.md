# Research: Activity Heatmap on Projects Page

**Feature**: AIB-667 — GitHub-style activity heatmap rendered below the project cards on `/projects`.
**Source spec**: `specs/AIB-667-copy-of-activity/spec.md`

## Technical Context Resolution

All Technical Context values are resolved — no `NEEDS CLARIFICATION` markers remain.

| Topic | Decision |
|---|---|
| Language/Version | TypeScript 5.9 (strict), Node.js 22.20.0 |
| Framework | Next.js 16 App Router, React 18 (RSC + `"use client"` for heatmap interactivity) |
| Data access | Existing Prisma 6.x models — **no schema changes** (FR-028, SC-010) |
| Server-side aggregation | New read-only query in `lib/analytics/heatmap-queries.ts`, reusing patterns in `lib/analytics/queries.ts` |
| API shape | New `GET /api/activity/heatmap` — account-scoped (viewer's owned + member projects) |
| Client state | TanStack Query v5 with `refetchInterval: 15_000`, `staleTime: 10_000` (mirrors `hooks/use-usage.ts:39` and `components/analytics/analytics-dashboard.tsx:98`) |
| URL state | `year`, `agent` query params via `useSearchParams` + `router.replace({ scroll: false })` (pattern from `components/analytics/analytics-dashboard.tsx:85-108`) |
| Polling gate | `document.visibilityState === 'visible'` check — TanStack Query's `refetchIntervalInBackground` left default (`false`) so polling pauses automatically |
| Timezone bucketing | Client sends IANA tz via `Intl.DateTimeFormat().resolvedOptions().timeZone`; server buckets jobs using the supplied tz (see "Timezone Strategy" below) |
| Render strategy | Server-rendered initial payload in `app/projects/page.tsx`, hydrated into TanStack Query via `initialData` (matches `components/analytics/analytics-dashboard.tsx:85-100`) |
| Testing | Vitest (unit + integration), RTL via `tests/utils/component-test-utils.tsx`. No Playwright — nothing in this feature requires a real browser |
| Performance target | p95 < 150ms for server aggregation of a typical viewer (≤ 50 projects, ≤ 5000 jobs in 12-month window); < 16ms per cell repaint (no layout thrash on polling) |

## Existing Files

**MUST be extended — never duplicated.**

### Existing files this feature touches

| Path | Role | Action |
|---|---|---|
| `app/projects/page.tsx` | Server component rendering `/projects` | **Extend**: render `<ActivityHeatmap initialData={…} />` below `<ProjectsContainer />`; fetch initial heatmap data alongside projects |
| `components/projects/projects-container.tsx` | Current projects grid wrapper | **Review-only**: scroll wrapper (`overflow-y-auto max-h-[calc(100vh-200px)]`) will hide the heatmap on tall viewports — FR-027 requires lifting this scroll cap. Change to remove `overflow-y-auto max-h-…` so the page can scroll naturally. |
| `app/lib/query-keys.ts` | Shared TanStack Query keys | **Extend**: add `activityHeatmap: { data: (year, agent, tz) => […] }` entry |
| `lib/analytics/aggregations.ts` | Shared analytics helpers | **Reuse**: `getAgentLabel`, `resolveEffectiveAgent` (via `app/lib/utils/agent-resolution.ts`). Do NOT add heatmap-specific helpers here — keep the heatmap's domain isolated. |
| `app/lib/utils/agent-resolution.ts` | `ALL_AGENTS`, `AGENT_LABELS`, `resolveEffectiveAgent` | **Reuse as-is** for agent filter options and effective agent logic |
| `lib/db/auth-helpers.ts` | `verifyProjectAccess` etc. | **Reuse**: no new helper; heatmap query filters by `userId` + `members.some.userId` directly (account-scoped, not project-scoped) |
| `components/ui/tooltip.tsx` | shadcn Tooltip | **Reuse as-is** for day-cell hover tooltip |
| `components/ui/select.tsx` | shadcn Select | **Reuse as-is** for year and agent dropdowns |

### New files this feature creates

| Path | Purpose |
|---|---|
| `app/api/activity/heatmap/route.ts` | GET endpoint returning the account-scoped heatmap payload |
| `lib/activity/heatmap-types.ts` | `HeatmapDay`, `HeatmapResponse`, `HeatmapFilters`, year/agent types |
| `lib/activity/heatmap-queries.ts` | Prisma queries for jobs + shipped tickets, aggregated by local-date bucket |
| `lib/activity/heatmap-bucketing.ts` | Pure helpers: `bucketJobsByLocalDay`, `buildGridSkeleton`, intensity bucketer, year-selector option builder |
| `components/activity/activity-heatmap.tsx` | Client component (`"use client"`) — composes grid, filters, tooltip, counter |
| `components/activity/activity-heatmap-grid.tsx` | Presentational 7-row grid with chipped corners and horizontal scroll |
| `components/activity/activity-heatmap-cell.tsx` | Single day cell + tooltip trigger |
| `components/activity/activity-heatmap-filters.tsx` | Year + agent dropdowns bound to URL |
| `components/activity/activity-heatmap-counter.tsx` | "X jobs · Y tickets shipped in …" headline |
| `components/activity/activity-heatmap-legend.tsx` | "Less □□■■■ More" legend |
| `hooks/use-activity-heatmap.ts` | TanStack Query hook (15s polling, initial data hydration, visibility-aware) |

### Existing test files

| Path | Coverage | Action |
|---|---|---|
| `tests/integration/projects/projects-with-health.test.ts` | `/projects` server render + getUserProjects integration | **Review-only**: no changes — heatmap render is tested in its own RSC integration test |
| `tests/integration/analytics/analytics-route.test.ts` | Pattern reference for new-route tests | **Reference only** (do not edit) |
| `tests/unit/components/analytics-dashboard.test.tsx` | Pattern reference for RTL + TanStack Query | **Reference only** |
| `tests/utils/component-test-utils.tsx` | `renderWithProviders` | **Reuse as-is** |

### New test files

| Path | Type | Rationale |
|---|---|---|
| `tests/unit/activity/heatmap-bucketing.test.ts` | Unit | Pure functions — chipped corners, intensity levels, tz bucketing, year-option builder |
| `tests/unit/components/activity-heatmap.test.tsx` | RTL component | URL param binding, tooltip content, empty state, filter visibility rules |
| `tests/integration/activity/heatmap-route.test.ts` | Integration | `GET /api/activity/heatmap` — auth, scope, ship counting, effective-agent filter, 15s contract freshness |

No existing file covers the domain of "account-scoped job aggregation by local day" — a new file is the correct choice.

## Patterns to Follow

### 1. Server-rendered initial data + TanStack Query hydration
**Reference**: `components/analytics/analytics-dashboard.tsx:85-100`
- Initial data is fetched on the server and passed as a prop.
- Client uses `useQuery({ initialData: shouldUseInitialData ? initialData : undefined, refetchInterval: 15_000, staleTime: 10_000 })`.
- `shouldUseInitialData` compares the current filters against the filters present in the initial payload — this allows filter changes after first paint to fall through to the network.
- **Apply to**: `ActivityHeatmap` receives `initialData: HeatmapResponse` from the server; filter changes trigger a client refetch without blanking cells (`placeholderData: (prev) => prev`).

### 2. URL-backed filters with silent router.push
**Reference**: `components/analytics/analytics-dashboard.tsx:105-109`
- `updateFilters()` calls `setFilters` (local state) AND `router.push(\`?${params.toString()}\`, { scroll: false })`.
- `scroll: false` prevents jumping to the top when the user changes year/agent — critical when the heatmap lives below the fold.
- **Apply to**: `ActivityHeatmapFilters` uses the identical pattern. Reading initial values from `searchParams` matches the pattern in `getInitialFilters` (analytics-dashboard.tsx:60).

### 3. Effective agent resolution (ticket agent ?? project default)
**Reference**: `lib/analytics/queries.ts:51-69` (`buildEffectiveAgentWhere`) and `app/lib/utils/agent-resolution.ts:41-46` (`resolveEffectiveAgent`)
- When filtering by agent, the SQL must match either `ticket.agent = :agent` OR `ticket.agent IS NULL AND project.defaultAgent = :agent`.
- For agent-option discovery, aggregate counts over all historical tickets (not filtered period) — FR-017, FR-018 — so a shared filter link doesn't lose the selected agent when its activity is empty in the current period.
- **Apply to**: `lib/activity/heatmap-queries.ts` replicates `buildEffectiveAgentWhere`. Agent-option aggregation runs a separate lightweight query over the viewer's **entire** history.

### 4. Error handling in read-only API routes
**Reference**: `app/api/projects/[projectId]/analytics/route.ts:36-50`
- Every API route has try/catch.
- Zod validation errors → 400.
- `"Unauthorized"` → 403, `"Project not found"` → 404.
- Any other error → 500 with `console.error`.
- Structured body `{ error: string }`.
- **Apply to**: `/api/activity/heatmap` follows the same structure. Account-scoped endpoints don't need `verifyProjectAccess`; they call `requireAuth` and filter by the returned `userId`.

### 5. Polling cadence aligned with analytics/usage
**Reference**: `hooks/use-usage.ts:36-42`, `components/analytics/analytics-dashboard.tsx:98-99`
- `refetchInterval: 15_000`, `staleTime: 10_000`, `refetchIntervalInBackground` left default (`false`) so polling pauses when the tab is hidden.
- TanStack Query's `placeholderData: (prev) => prev` keeps the old data on screen during refetches — prevents the "blanking cells" failure in FR-024.
- **Apply to**: `hooks/use-activity-heatmap.ts` mirrors this exactly.

### 6. Cost display guardrails
**Reference**: (no direct reference — documented here to prevent `$NaN` / `$0` bugs)
- Sum `costUsd` only over jobs where `costUsd !== null`.
- Track `hasCostData: boolean` per day: true iff at least one job on that day has a non-null `costUsd`.
- Tooltip renders the cost line only when `hasCostData === true`; otherwise the property is absent from the DTO, not set to `0`.
- **Apply to**: `lib/activity/heatmap-bucketing.ts` returns `{ jobCount, ticketsShipped, hasCostData, totalCostUsd? }`.

## Timezone Strategy

**Decision**: Client sends its IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) with every heatmap request; server buckets `job.completedAt` into local-date strings using that tz.

**Rationale**:
- FR-029 requires viewer-local day boundaries.
- Spec's "Auto-Resolved Decisions" explicitly calls out that "server-rendered initial data uses the same bucketing rule as client refetches" — so both SSR and subsequent fetches must share the same tz input.
- Server render reads the `x-ai-board-tz` header (if present) set via a lightweight `middleware.ts` hook OR falls back to `UTC` and reconciles on first client refetch.

**Alternatives considered**:
- **Client-side bucketing**: ship raw ISO timestamps and bucket in the browser. Rejected because the initial payload would be O(jobs) instead of O(days) — inflates first paint.
- **Server uses user's stored tz preference**: no such field exists; adding one would violate "no schema changes" (FR-028).

**Implementation note**: Use `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)` on the server (Node 22 supports `Intl` natively) to produce `YYYY-MM-DD` in the viewer's tz. Falls back to UTC date parts when tz is invalid.

## Intensity Buckets

**Decision**: 5 discrete levels — 0 + 4 populated buckets, matching GitHub.

**Bucket boundaries** (jobs per day):
- Level 0: 0 jobs
- Level 1: 1 job
- Level 2: 2–3 jobs
- Level 3: 4–7 jobs
- Level 4: 8+ jobs

**Rationale**: Logarithmic-ish boundaries feel right for a distribution where most days have 1-3 jobs and a power-user day might have 20+. Tune later if needed (spec reviewer note flags this).

**Color tokens**: `aurora-cell-0` through `aurora-cell-4` — new utility classes added to `app/globals.css` under `@layer utilities`, using the aurora violet gradient. Never interpolate class names — return full literal strings from a `getIntensityClass(level)` helper (CLAUDE.md Tailwind Classes rule).

## Year Selector Options

**Decision**: `["Last 12 months" (rolling, default)]` + `[currentYear..accountCreationYear]` (descending).

**Source of truth for account creation year**: `user.createdAt` from `requireAuth()`.

**Edge case (FR-013)**: If `user.createdAt` is in the current calendar year, only "Last 12 months" is shown — the Select is rendered disabled (not hidden) so the control's placement remains stable across users.

## Ship Counting Rules

**Decision** (aligns with FR-010, SC-003, spec edge cases):
- A ticket is counted as shipped on the day `job.command === 'ship' AND job.status === 'COMPLETED'` (completedAt date bucket).
- `ticket.stage === 'SHIP'` without a matching completed ship job is NOT counted.
- A later rollback does NOT un-count a historically completed ship job.
- Multiple successful ship jobs for the same ticket: count each day independently (each ship is a real event). Expected to be rare.

## Empty-State Rules

- Selected period has zero activity (cells all 0): render the centered message "No activity to show yet — your AI work will appear here" in place of the grid. Legend and filters remain visible (FR-007).
- Account with zero jobs: same as above, additionally the year selector is reduced to just "Last 12 months" (FR-013).

## Success Metrics Mapping

| Success criterion | Verification approach |
|---|---|
| SC-001 (no spinner flash) | Integration test: SSR markup contains heatmap cells, not a loader |
| SC-002 (tooltip coverage) | Component test: every rendered cell has `aria-describedby` + tooltip content |
| SC-003 (ship count exact) | Integration test: seed jobs (ship COMPLETED, ship FAILED, stage=SHIP w/o job), assert counter |
| SC-004 (URL shareability) | Component test: `?year=2025&agent=CLAUDE` → correct initial state |
| SC-005 (mobile scroll + min cell size) | Component test: snapshot of className assertions for `min-w`, `overflow-x-auto`, sticky labels |
| SC-006 (agent filter visibility) | Component test: assert DOM presence/absence given 0/1/2+ distinct effective agents in initial payload |
| SC-007 (new account year dropdown) | Component test: user created same year → only "Last 12 months" option, select disabled |
| SC-008 (no `$NaN`/`$0`) | Unit test on `bucketJobsByLocalDay`: asserts `totalCostUsd` absent when all jobs have null cost |
| SC-009 (chipped corners) | Unit test on `buildGridSkeleton`: 2024 (starts Monday) → top-left chipped; year ending mid-week → bottom-right chipped |
| SC-010 (no schema changes) | Manual: `prisma/schema.prisma` diff is clean |
