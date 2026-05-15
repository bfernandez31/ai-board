# Research: Admin Insights Page Cosmetic Refresh & Failed Report Diagnostics

**Branch**: `AIB-807-admin-insights-page`
**Date**: 2026-05-14

---

## Existing Files

### Page & Layout

| Path | Covers | Action |
|------|--------|--------|
| `app/admin/insights/page.tsx` (35 lines) | Server page: reconciliation → list → preflight → render `InsightsReportView` | **Modify** — remove H1 propagation, pass Job data for GH Actions links |
| `app/admin/layout.tsx` (32 lines) | Auth wrapper + `AdminShell` | No change |
| `components/admin/admin-shell.tsx` (70 lines) | Sidebar nav with active state (`bg-accent/30 border-l-2 border-primary`) | No change — already highlights "Insights LLM" correctly |
| `components/admin/admin-sidebar-items.ts` (21 lines) | Sidebar item config | No change |
| `lib/admin/active-path.ts` (8 lines) | `isAdminItemActive()` utility | No change |

### Insights Components (modify)

| Path | Covers | Action |
|------|--------|--------|
| `components/admin/insights/insights-report-view.tsx` (226 lines) | Main view: header, metadata card, report body, past reports list (vertical layout) | **Major rewrite** — side-by-side layout, dense report list in left pane, remove H1, add GH Actions link + retry for FAILED |
| `components/admin/insights/run-analysis-button.tsx` (134 lines) | Trigger button with optimistic updates | **Modify** — accept optional `periodStart`/`periodEnd` for retry, update query key references |
| `components/admin/insights/report-error-placeholder.tsx` (23 lines) | Placeholder for non-COMPLETED states | **Modify** — extend for FAILED diagnostics (error reason, GH Actions link, retry button) |

### Insights Components (unused — candidates for removal)

| Path | Covers | Action |
|------|--------|--------|
| `components/admin/insights-page.tsx` (74 lines) | Legacy page component (not imported by active page.tsx) | Leave as-is (out of scope) |
| `components/admin/report-list.tsx` (63 lines) | Generic report list (not imported) | Leave as-is (out of scope) |
| `components/admin/analysis-controls.tsx` (24 lines) | Simple trigger button (not imported) | Leave as-is (out of scope) |

### Hooks & Queries

| Path | Covers | Action |
|------|--------|--------|
| `app/lib/hooks/queries/use-insights-reports.ts` (34 lines) | `useInsightsReports()` — polls `/api/admin/insights/reports` every 15s while RUNNING | No change |
| `app/lib/hooks/queries/use-insights-preflight.ts` (47 lines) | `useInsightsPreflight()` — polls preflight gate | No change |

### API Routes

| Path | Covers | Action |
|------|--------|--------|
| `app/api/admin/insights/trigger/route.ts` (218 lines) | POST trigger — preflight → create → dispatch | **Modify** — accept optional `periodStart`/`periodEnd` body params for retry |
| `app/api/admin/insights/reports/route.ts` (24 lines) | GET list (calls `toListEntry`) | **Modify** — include Job `workflowRunId` in response for GH Actions links |
| `app/api/admin/insights/reports/[id]/route.ts` (34 lines) | GET single report | **Modify** — include Job `workflowRunId` |
| `app/api/admin/insights/preflight/route.ts` (19 lines) | GET preflight | No change |
| `app/api/admin/insights/reports/[id]/html/route.ts` (76 lines) | GET HTML artifact stream | No change |
| `app/api/admin/insights/reports/[id]/status/route.ts` (234 lines) | PATCH workflow-driven transitions | No change |
| `app/api/admin/insights/reports/[id]/finalize/route.ts` (95 lines) | PUT HTML upload | No change |

### Library / Data Access

| Path | Covers | Action |
|------|--------|--------|
| `app/lib/insights/repository.ts` (169 lines) | `ReportListEntry`, `toListEntry()`, CRUD, `markFailed()` | **Modify** — extend `ReportListEntry` with `workflowRunId` and `githubActionsUrl`, update `toListEntry()` to include Job join |
| `app/lib/insights/preflight.ts` (56 lines) | `computePreflightSnapshot()` | No change |
| `app/lib/insights/predicate.ts` (200 lines) | Shipped Claude ticket predicates | No change |
| `app/lib/insights/reconcile.ts` (53 lines) | Orphaned RUNNING cleanup | No change |
| `app/lib/insights/blob-keys.ts` (12 lines) | Artifact key builder | No change |
| `app/lib/insights/output-validation.ts` (59 lines) | HTML structure validation | No change |

### Test Files (extend, don't duplicate)

| Path | Lines | Covers | Action |
|------|-------|--------|--------|
| `tests/unit/components/admin/insights/insights-report-view.test.tsx` | 117 | View rendering, iframe, metadata, empty/FAILED states | **Extend** — side-by-side layout, dense rows, GH Actions link, retry button |
| `tests/unit/components/admin/insights/insights-report-view-list-selection.test.tsx` | 137 | Report selection, RUNNING/FAILED/COMPLETED states | **Extend** — compact row format, duration display, active highlight |
| `tests/unit/components/admin/insights/run-analysis-button.test.tsx` | 85 | Button states, trigger, refusal handling | **Extend** — retry with explicit period params |
| `tests/integration/api/admin/insights/trigger.test.ts` | 168 | POST trigger auth, refusals, dispatch | **Extend** — retry with explicit periodStart/periodEnd |
| `tests/integration/api/admin/insights/reports-list.test.ts` | 121 | GET list ordering, cap, errorReason | **Extend** — workflowRunId/githubActionsUrl in response |
| `tests/unit/lib/insights/predicate.test.ts` | 297 | Claude ticket identification | No change |
| `tests/unit/lib/insights/reconcile.test.ts` | 97 | Orphan cleanup | No change |

---

## Patterns to Follow

### 1. Atomic Status Transitions (Pattern P-1)

**Source**: `app/lib/insights/repository.ts:120-134`

All status transitions use `updateMany` with `WHERE status='RUNNING'` guard. The retry feature creates a **new** report+job pair — it does NOT mutate the failed report. This follows the existing `createRunningReportAndJob()` transaction pattern.

### 2. Trigger Error Handling (dispatch-then-rollback)

**Source**: `app/api/admin/insights/trigger/route.ts:192-209`

On Octokit `RequestError`: (1) atomically mark report FAILED via `markFailed()`, (2) delete orphaned Job via `prisma.job.delete().catch(() => undefined)`, (3) return 502. The retry path MUST follow this identical pattern since it reuses the same dispatch logic.

### 3. Optimistic Updates for Mutations

**Source**: `components/admin/insights/run-analysis-button.tsx:82-110`

Constitution requires optimistic updates for all mutations. The existing pattern: `onMutate` cancels queries → snapshots previous data → prepends optimistic RUNNING entry (id=-1) → `onSuccess` invalidates → `onError` rolls back. Retry must follow the same pattern.

### 4. `toListEntry()` Serialization

**Source**: `app/lib/insights/repository.ts:155-169`

Converts Prisma model to client-safe DTO. `artifactKey` is intentionally excluded (FR-024). New fields (`workflowRunId`, `githubActionsUrl`) must be added here. `workflowRunId` is `BigInt?` — must serialize as `string | null` for JSON safety.

### 5. Preflight Refusal Display

**Source**: `components/admin/insights/insights-report-view.tsx:120-136`

Refusal messages use ISO timestamps from the API and format them client-side via `formatDate()`. The retry button should share the same preflight gate — if retry is blocked, display the refusal using the same pattern.

### 6. Admin Shell Active State

**Source**: `components/admin/admin-shell.tsx:41-43`

Active item: `bg-accent/30 border-l-2 border-primary`. The selected report in the left pane should use a similar but distinct pattern (e.g., `bg-accent/50`) to avoid confusion with the sidebar's page-level active state.

### 7. GitHub Actions URL Construction

**Source**: Prisma schema `Job.workflowRunId BigInt?`, populated via `PATCH /api/jobs/:id/status` on RUNNING transition (first-write-wins).

URL pattern: `https://github.com/{owner}/{repo}/actions/runs/{workflowRunId}`

The `owner` and `repo` come from the host project (`GITHUB_OWNER`/`GITHUB_REPO` env vars or the project record). These MUST be resolved server-side (spec decision: CONSERVATIVE) — the API response should include the full URL, not raw components.

---

## Decisions

### D-1: Retry Implementation Strategy

**Decision**: Retry reuses the trigger endpoint with explicit `periodStart`/`periodEnd` body parameters.
**Rationale**: Minimizes new code — the trigger endpoint already handles preflight checks, atomic creation, and dispatch. Adding optional period params is a small change. The failed report is not mutated; a new report+job pair is created.
**Alternatives**: (1) New `/retry` endpoint — more code, duplicates preflight logic. (2) Client-side redirect to trigger with query params — breaks optimistic update pattern.

### D-2: GitHub Actions URL Resolution

**Decision**: Server-side URL construction in `toListEntry()`. The `ReportListEntry` gains a `githubActionsUrl: string | null` field.
**Rationale**: CONSERVATIVE auto-resolved decision in spec. Avoids exposing raw env vars to client. URL is `null` when `workflowRunId` is absent or host project config is missing.
**Alternatives**: (1) Client constructs URL from components — exposes owner/repo to client, violates spec decision. (2) Separate API call per report — unnecessary round trips.

### D-3: Layout Approach

**Decision**: CSS Grid/Flexbox side-by-side in `insights-report-view.tsx`. Left pane `w-[280px] shrink-0`, right pane `flex-1`. Responsive via `md:` breakpoint (stacks vertically on mobile).
**Rationale**: Follows the existing `admin-shell.tsx` responsive pattern (`flex-col md:flex-row`). No new dependencies needed.
**Alternatives**: (1) ResizablePanel from shadcn/ui — over-engineered for a fixed-width sidebar. (2) CSS Grid with `grid-template-columns` — equivalent but flex is more consistent with existing patterns.

### D-4: Duration Computation

**Decision**: Client-side computation from `createdAt` and `completedAt` timestamps already present in `ReportListEntry`.
**Rationale**: No API change needed. Duration = `completedAt - createdAt`. Only displayed for COMPLETED reports where both timestamps are guaranteed non-null.
**Alternatives**: (1) Server-side duration field — adds a field that's trivially derivable, violates DRY.

### D-5: `workflowRunId` Data Flow

**Decision**: Extend `listReports()` and `getReportById()` to JOIN the linked Job and include `workflowRunId`. The `toListEntry()` function resolves the full GitHub Actions URL server-side.
**Rationale**: The `workflowRunId` is on the `Job` model, not `InsightsReport`. A Prisma `include: { job: { select: { workflowRunId: true } } }` is the minimal join. Server-side URL construction matches the CONSERVATIVE spec decision.
**Alternatives**: (1) Denormalize `workflowRunId` onto `InsightsReport` — requires migration, violates DRY. (2) Separate endpoint for workflow URL — unnecessary complexity.
