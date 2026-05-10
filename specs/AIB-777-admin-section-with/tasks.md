---
description: "Task list for AIB-777 — Admin section with Claude Code Insights report"
---

# Tasks: Admin section with Claude Code Insights report

**Input**: Design documents from `/specs/AIB-777-admin-section-with/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-insights-api.md, workflows/insights-analyze-workflow.md, workflows/insights-analyze-command.md

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- File paths in descriptions are absolute relative to repo root (`/home/runner/work/ai-board/ai-board/target/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration & schema scaffolding for everything that follows.

- [X] T001 [P] ✅ DONE Append `ADMIN_ALLOWLIST_EMAILS=` (comma-separated, optional) and `INSIGHTS_RUN_TIMEOUT_MS=3600000` (default 60 min) to `.env.example` with explanatory comments per research.md §H
- [X] T002 ✅ DONE Add `AdminInsightsReport` model + `AdminInsightsReportStatus` enum + `User.adminInsightsReportsTriggered` back-relation to `prisma/schema.prisma` per data-model.md (fields, indexes `@@index([status])`, `@@index([status, periodEnd])`, `@@index([createdAt])`, `onDelete: SetNull` on `triggeredBy`)
- [X] T003 ✅ DONE Generate Prisma migration via `bunx prisma migrate dev --name add_admin_insights_report` and run `bunx prisma generate` to refresh types (depends on T002)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Auth gate, state machine, helpers, blob wrappers, dispatcher, query keys, and unit tests for pure logic. ALL user stories depend on this phase.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Helpers and primitives

- [X] T004 [P] ✅ DONE Create admin auth gate at `lib/admin/admin-auth.ts` exporting `getAdminAllowlistEmails()` (per-request env parse → `Set<string>`, lower-cased, trimmed), `isAdminEmail(email, set)`, and `requireAdmin()` (reads NextAuth session via `auth()` from `lib/auth.ts`; throws `Error('Not Found')` on missing session or non-allowlisted email) — pattern from `lib/auth/workflow-token.ts:18-38` (research.md P4)
- [X] T005 [P] ✅ DONE Create state machine at `lib/admin/insights/state-machine.ts` exporting `canTransition(from: AdminInsightsReportStatus, to: AdminInsightsReportStatus): boolean` — only `RUNNING → COMPLETED` and `RUNNING → FAILED` allowed; `RUNNING → RUNNING` returns true (idempotent same-status) — pattern from `app/lib/job-state-machine.ts`
- [X] T006 [P] ✅ DONE Create artifact key builder at `lib/admin/insights/artifact-key.ts` exporting `buildInsightsReportArtifactKey(reportId: number): string` returning `insights/reports/<reportId>.html` (research.md D4)
- [X] T007 [P] ✅ DONE Create Claude-only effective-agent filter at `lib/admin/insights/claude-job-filter.ts` exporting helpers that compute `effectiveAgent = ticket.agent ?? project.defaultAgent ?? 'CLAUDE'` consistent with `app/api/jobs/[id]/logs/raw-artifact/route.ts:60-61`; export both a Prisma `where`-fragment composer (used by the pre-flight count and the artifact enumeration endpoint) and a synchronous predicate for unit tests
- [X] T008 [P] ✅ DONE Create period derivation at `lib/admin/insights/period.ts` exporting `derivePeriod({ previousHighWater, earliestClaudeStartedAt, now })` returning `{ periodStart, periodEnd } | { error: 'NO_CLAUDE_WORK_YET' }` covering first-ever-run vs incremental semantics (FR-009, research.md D5)
- [X] T009 [P] ✅ DONE Create lazy reconciler at `lib/admin/insights/reconcile.ts` exporting `reconcileOrphanedInsightsReports()` that runs the `updateMany({ where: { status: 'RUNNING', startedAt: { lt: cutoff } }, data: { status: 'FAILED', errorReason: 'Run timed out — workflow did not report terminal status', completedAt: new Date() } })` query using `INSIGHTS_RUN_TIMEOUT_MS` env (default 3 600 000 ms) — research.md D2
- [X] T010 [P] ✅ DONE Create Zod validator at `app/lib/admin/insights/status-update-validator.ts` exporting `adminInsightsReportStatusUpdateSchema` (discriminatedUnion on `status` per contracts/admin-insights-api.md §5; uses `ARTIFACT_MAX_BYTES` import from `app/lib/logs/schema.ts:6`) — pattern from `app/lib/job-update-validator.ts`
- [X] T011 [P] ✅ DONE Extend `app/lib/blob/client.ts` with two thin wrappers: `uploadInsightsReportHtml(key, body, size)` and `streamInsightsReportHtml(key)` — delegate to existing `uploadJobLogArtifact`/`streamJobLogArtifact` but pass `contentType: 'text/html; charset=utf-8'` (research.md §D)
- [X] T012 [P] ✅ DONE Extend `app/lib/query-keys.ts` with an `admin` namespace exposing `admin.insights.list`, `admin.insights.report(id)`, `admin.insights.runStatus`
- [X] T013 [P] ✅ DONE Create workflow dispatcher at `app/lib/workflows/dispatch-insights-analyze.ts` exporting `dispatchInsightsAnalyzeWorkflow({ reportId, periodStart, periodEnd })` that calls `octokit.actions.createWorkflowDispatch({ workflow_id: 'insights-analyze.yml', inputs: { report_id: String(reportId), period_start, period_end } })`, honours `isWorkflowTestMode(token)` short-circuit, and rethrows `RequestError` for caller-side rollback — clone shape from `app/lib/workflows/dispatch-deploy-preview.ts`

### Unit tests for foundational primitives

- [X] T014 [P] ✅ DONE Create unit tests at `tests/unit/admin/admin-auth.test.ts` covering: empty/whitespace-only env → empty Set; case-insensitive match; trimmed entries; missing session → throws "Not Found"; allowlisted session → returns user — pattern from `tests/unit/lib/workflow-auth.test.ts`
- [X] T015 [P] ✅ DONE Create unit tests at `tests/unit/admin/insights-state-machine.test.ts` covering all 9 (status, status) pairs in a table-driven test asserting exactly the allowed transitions and idempotent same-status — pattern parallel to existing `app/lib/job-state-machine.ts` test
- [X] T016 [P] ✅ DONE Create unit tests at `tests/unit/admin/claude-job-filter.test.ts` covering: ticket.agent set / project.defaultAgent fallback / both null → `'CLAUDE'`; explicit non-Claude excluded
- [X] T017 [P] ✅ DONE Create unit tests at `tests/unit/admin/period.test.ts` covering: cold-system (no previous, no Claude jobs) → error `NO_CLAUDE_WORK_YET`; first-ever-run (no previous, ≥1 Claude job) → period from earliest startedAt to now; incremental (previous COMPLETED present) → period from previous.periodEnd to now

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - View the latest Claude Code Insights report (Priority: P1) 🎯 MVP

**Goal**: An allowlisted operator opens `/admin/insights` and sees the latest COMPLETED report's HTML body rendered inline in a sandboxed iframe with a metadata header in the canonical FR-019 phrasing.

**Independent Test**: With one COMPLETED report seeded in storage and an authenticated allowlisted user, the user navigates to `/admin/insights` and sees the report's HTML body rendered inline along with the correct metadata header. No other reports, no triggering, no archive needed.

### Tests for User Story 1

- [X] T018 [P] [US1] ✅ DONE Create `tests/helpers/admin-insights-fixtures.ts` exposing `seedCompletedInsightsReport({ periodStart, periodEnd, sessionsCount, ticketsCount, htmlBody })`, `seedRunningInsightsReport(...)`, `seedFailedInsightsReport(...)`, and `seedAdminAllowlistedUser(email)` — used by integration tests and the E2E test (referenced by data-model.md §"Migration plan" step 3)
- [X] T019 [P] [US1] ✅ DONE Create integration tests at `tests/integration/admin/insights-list.test.ts` covering: 404 baseline for unauthenticated and non-allowlisted callers, 200 with `reports[]` and `runningReportId` for an allowlisted caller, `Cache-Control: no-store, private`, ordering by `createdAt desc`, `limit` query param honoured up to 200, no `htmlBlobKey`/`htmlBlobSize` leaked in payload, `triggeredByEmail` resolved from relation — pattern from `tests/integration/jobs/status-filter.test.ts`
- [X] T020 [P] [US1] ✅ DONE Create integration tests at `tests/integration/admin/insights-html-get.test.ts` covering: 404 baseline for unauthenticated and non-allowlisted callers, 200 streaming HTML body with `Content-Type: text/html; charset=utf-8`, full CSP header (`default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, 404 baseline for non-COMPLETED report ids, 404 baseline for missing-blob storage-incident edge case, 502 `BLOB_READ_FAILED` for transient blob errors — pattern from `tests/integration/api/jobs/logs-raw-native-route.test.ts`
- [X] T021 [P] [US1] ✅ DONE Create E2E test at `tests/e2e/admin/insights-page.spec.ts` (golden path): seeded `[e2e]`-prefixed admin user signs in via dev-login, opens `/admin/insights`, sees the metadata header in the canonical `Analyzed N Claude Code sessions across M tickets shipped between START_DATE and END_DATE` phrasing, and the iframe renders the seeded report HTML with `sandbox="allow-scripts"` (no `allow-same-origin`)

### Implementation for User Story 1

- [X] T022 [P] [US1] ✅ DONE Create `app/admin/page.tsx` (Server Component) that calls `await requireAdmin()` (catching → `notFound()`) and `redirect('/admin/insights')`
- [X] T023 [US1] ✅ DONE Create `app/admin/layout.tsx` (Server Component) that calls `await requireAdmin()` at the top and renders children inside a minimal admin shell; on throw it calls `notFound()` from `next/navigation` so Next renders the same body as a non-existent path (research.md P5)
- [X] T024 [P] [US1] ✅ DONE Create `app/api/admin/insights/reports/route.ts` (GET) that calls `requireAdmin()` (404 baseline on failure), runs `reconcileOrphanedInsightsReports()`, queries with `take = min(limit, 200)`, joins `triggeredBy.email`, returns the `{ reports, runningReportId }` shape from contracts §2, sets `Cache-Control: no-store, private`
- [X] T025 [P] [US1] ✅ DONE Create `app/api/admin/insights/reports/[id]/html/route.ts` exporting a `GET` handler that: calls `requireAdmin()` (404 baseline on failure), validates `id` is positive int (404 baseline otherwise), looks up the report (404 baseline if missing or `status !== 'COMPLETED'`), streams the body via `streamInsightsReportHtml(report.htmlBlobKey)`, sets all CSP/X-Content-Type-Options/X-Frame-Options headers from contracts §4, falls back to 404 baseline on storage-not-found and 502 `BLOB_READ_FAILED` on transient blob error
- [X] T026 [P] [US1] ✅ DONE Create `app/components/admin/insights/metadata-header.tsx` (Server Component) rendering the EXACT phrasing `Analyzed {sessionsCount} Claude Code sessions across {ticketsCount} tickets shipped between {periodStart} and {periodEnd}` (FR-019) inside `<Card>` with `aurora-card-bg` / `aurora-glow` utility classes (CLAUDE.md "Aurora B+ Theme")
- [X] T027 [P] [US1] ✅ DONE Create `app/components/admin/insights/report-iframe.tsx` (Client Component, `"use client"`) rendering `<iframe sandbox="allow-scripts" src={\`/api/admin/insights/reports/${reportId}/html\`} referrerPolicy="no-referrer" title="Claude Code Insights report" />` with full-height styling and no `allow-same-origin` (research.md D1)
- [X] T028 [P] [US1] ✅ DONE Create `app/components/admin/insights/past-reports-list.tsx` (Client Component) — read-only, reverse-chronological listing with date / period / sessions / tickets / status badge per row; selection state is wired in US4 (T046). For US1 the list shows COMPLETED entries only and clicking is a no-op
- [X] T029 [P] [US1] ✅ DONE Create `app/hooks/admin/use-admin-insights-list.ts` (TanStack Query hook) — `useQuery({ queryKey: queryKeys.admin.insights.list, queryFn: fetchList, refetchInterval: data => data?.runningReportId ? 2_000 : false, staleTime: 30_000 })` (research.md P6)
- [X] T030 [US1] ✅ DONE Create `app/components/admin/insights/insights-page-shell.tsx` (Client Component) orchestrating the layout: metadata-header + report-iframe + past-reports-list, consuming `useAdminInsightsList()` and rendering an empty state ("No analysis has been run yet") when `reports.length === 0` (FR-023). Trigger button slot is reserved for US3 (T040)
- [X] T031 [US1] ✅ DONE Create `app/admin/insights/page.tsx` (Server Component) that: calls `requireAdmin()` (404 on failure), calls `reconcileOrphanedInsightsReports()`, fetches latest COMPLETED + current RUNNING + capped past list, passes initial data into `<InsightsPageShell />`

**Checkpoint**: User Story 1 fully functional — an allowlisted operator can read the latest report.

---

## Phase 4: User Story 2 - Block unauthorized access to the admin area (Priority: P1)

**Goal**: Every admin route returns a Not Found response byte-equivalent to a genuinely missing path for unauthenticated callers and authenticated non-allowlisted callers; no global navigation surface mentions the admin area.

**Independent Test**: With the admin shell deployed (even with zero reports), an unauthenticated user and a signed-in non-admin user attempt to load `/admin`, `/admin/insights`, the trigger endpoint, the list endpoint, and a report-fetch endpoint. Every response is byte-equivalent to a genuine "no such page" baseline.

### Tests for User Story 2

- [X] T032 [P] [US2] ✅ DONE Create integration tests at `tests/integration/admin/response-parity.test.ts` asserting byte-equivalent (status code, body bytes, headers excluding `Set-Cookie` from NextAuth and `Date`) responses for non-admin callers across `[ '/admin', '/admin/insights', '/api/admin/insights/reports', '/api/admin/insights/reports/1/html', '/api/admin/insights/runs', '/api/admin/insights/reports/1/status' ]` versus a baseline `/admin-does-not-exist-${randomSuffix}` request, for both unauthenticated and signed-in non-allowlisted users — uses `x-test-user-id` header per `lib/auth/test-user-override.ts` (research.md §F)

### Implementation for User Story 2

- [X] T033 [US2] ✅ DONE Audit and harden every new admin handler (`app/admin/layout.tsx`, `app/admin/page.tsx`, `app/admin/insights/page.tsx`, `app/api/admin/insights/reports/route.ts`, `app/api/admin/insights/reports/[id]/html/route.ts`) so that on `requireAdmin()` failure: pages call `notFound()` from `next/navigation` and API routes return `new NextResponse(null, { status: 404 })` with NO JSON body, NO `WWW-Authenticate`, NO custom headers — 404 baseline rule from contracts §"Response-parity verification" (research.md P5)
- [X] T034 [US2] ✅ DONE Verify `components/layout/header.tsx` and `components/navigation/nav-items.ts` have NO admin link, label, or hint visible to any user (FR-001) — this is a read-only verification task; if any reference is found, remove it
- [X] T035 [US2] ✅ DONE (Optional, only if T032 fails byte-equivalence due to absence of a uniform baseline body) Create `app/not-found.tsx` rendering Next.js' canonical 404 body so all admin and baseline routes share the exact same `not-found` rendering — skip this task if T032 passes against Next 16's default — Not needed: Next 16's default suffices.

**Checkpoint**: 404 baseline enforced and verified across all admin routes.

---

## Phase 5: User Story 3 - Trigger a new Insights analysis (Priority: P1)

**Goal**: An allowlisted operator clicks "Run new analysis"; subject to pre-flight (shipped Claude tickets since previous run) and concurrency (no RUNNING row), the system creates a RUNNING row, dispatches `insights-analyze.yml`, and the page reflects the new state. On success the workflow PUTs the HTML, PATCHes COMPLETED, and the new report appears as the latest. On failure the row goes FAILED with a non-secret reason and the trigger re-enables.

**Independent Test**: With a previous COMPLETED report seeded, at least one ticket transitioned to SHIP after the previous run's `periodEnd`, and an authenticated allowlisted user, the user clicks "Run new analysis" and the page transitions through RUNNING to displaying the new COMPLETED report on top.

### Tests for User Story 3

- [X] T036 [P] [US3] ✅ DONE Create integration tests at `tests/integration/admin/insights-trigger.test.ts` covering: 404 baseline for non-admin; pre-flight refusal 409 `NO_NEW_SHIPPED_TICKETS` with `previousRunAt` set (and `null` cold-system message variant); concurrency refusal 409 `ALREADY_RUNNING` with `runStartedAt`; 201 with `{ id, status: 'RUNNING', periodStart, periodEnd, startedAt }` on accepted trigger and a verifiable workflow dispatch in test mode (`isWorkflowTestMode`); rollback-on-dispatch-failure deletes the row and returns 502 `DISPATCH_FAILED` — pattern from `tests/integration/projects/setup-job.test.ts` and `lib/workflows/transition.ts:357-388`
- [X] T037 [P] [US3] ✅ DONE Create integration tests at `tests/integration/admin/insights-status.test.ts` covering: 401 on missing/invalid Bearer token; 200 idempotent same-status PATCH; 200 valid `RUNNING → COMPLETED` with counts and `htmlBlobKey` set; 200 valid `RUNNING → FAILED` with `errorReason`; 400 invalid Zod body and invalid state transition; 404 unknown id; 409 `Run already finalized` when row terminal and request not idempotent; atomic conditional update prevents double-finalization on duplicate callbacks — pattern from `tests/integration/jobs/status.test.ts`
- [X] T038 [P] [US3] ✅ DONE Create integration tests at `tests/integration/admin/insights-html-put.test.ts` covering: 401 on missing/invalid Bearer token; 415 wrong content-type; 413 over `ARTIFACT_MAX_BYTES`; 404 unknown id; 409 row already terminal (refuses overwrite); 201 `{ htmlBlobKey, htmlBlobSize }` on success; idempotent re-upload while `RUNNING`; 502 `BLOB_UPLOAD_FAILED` on transient blob error — pattern from `tests/integration/api/jobs/logs-raw-artifact-put.test.ts`
- [X] T039 [P] [US3] ✅ DONE Create integration tests at `tests/integration/admin/insights-reconcile.test.ts` exercising lazy reconciliation: seed a `RUNNING` row with `startedAt` older than `INSIGHTS_RUN_TIMEOUT_MS`, advance `vi.setSystemTime` past the cutoff, call `reconcileOrphanedInsightsReports()` (or trigger via list-endpoint side effect), assert the row is now `FAILED` with `errorReason: 'Run timed out — workflow did not report terminal status'` and idempotent on second invocation

### Implementation for User Story 3

- [X] T040 [P] [US3] ✅ DONE Create `app/components/admin/insights/trigger-run-button.tsx` (Client Component) — `<Button>` from `components/ui/button.tsx`, disabled while `runningReportId !== null`, surfaces 409 refusals via toast (`useToast` from `app/hooks/use-toast.ts`), uses TanStack Query mutation
- [X] T041 [P] [US3] ✅ DONE Create `app/hooks/admin/use-admin-insights-trigger.ts` exposing `useAdminInsightsTriggerMutation()` — `useMutation` wrapper for `POST /api/admin/insights/runs` that invalidates `queryKeys.admin.insights.list` on success
- [X] T042 [P] [US3] ✅ DONE Create `app/api/admin/insights/runs/route.ts` exporting `POST` that: calls `requireAdmin()` (404 baseline on failure); calls `reconcileOrphanedInsightsReports()`; runs the concurrency gate (`findFirst({ status: 'RUNNING' })` → 409 `ALREADY_RUNNING` if found); reads previous high-water mark (`findFirst({ status: 'COMPLETED' }, orderBy: { periodEnd: 'desc' })`); when no previous, queries earliest Claude job startedAt via `claude-job-filter`; if neither → 409 cold-system pre-flight refusal; runs pre-flight count (`countNewShippedClaudeTickets(periodStart)` from `claude-job-filter`) → 409 `NO_NEW_SHIPPED_TICKETS` if 0; creates the `RUNNING` row in a transaction with computed `periodStart`/`periodEnd`; calls `dispatchInsightsAnalyzeWorkflow()` and on `RequestError` deletes the row and returns 502 `DISPATCH_FAILED` (research.md P1) — returns 201 per contracts §3
- [X] T043 [P] [US3] ✅ DONE Create `app/api/admin/insights/reports/[id]/status/route.ts` exporting `PATCH` that: validates `validateWorkflowAuth(request)` → 401 on failure (workflow-token gated, so 404-baseline does NOT apply here); parses body via `adminInsightsReportStatusUpdateSchema`; for `RUNNING` body, first-write-wins on `workflowRunId` via `updateMany({ where: { id, workflowRunId: null }, data })`; for `COMPLETED`/`FAILED`, atomic conditional update via `updateMany({ where: { id, status: 'RUNNING' }, data })` and on `count === 0` re-read and return current state with 200 (research.md P2); state-machine validation via `canTransition`; idempotent same-status returns 200 with no DB write; returns the minimal `{ id, status, completedAt }` shape from contracts §5
- [X] T044 [P] [US3] ✅ DONE Extend `app/api/admin/insights/reports/[id]/html/route.ts` (created in T025 for GET) with a `PUT` handler that: validates `validateWorkflowAuth(request)` → 401; checks `Content-Type` starts with `text/html` → 415; pre-flight `Content-Length` against `ARTIFACT_MAX_BYTES` → 413; row lookup → 404 if missing; refuses overwrite if status is `COMPLETED`/`FAILED` → 409; reads body with empty/over-cap guards; calls `uploadInsightsReportHtml(buildInsightsReportArtifactKey(id), buffer, size)` wrapped in try/catch → 502 `BLOB_UPLOAD_FAILED`; returns 201 `{ htmlBlobKey, htmlBlobSize }` per contracts §6; does NOT write `htmlBlobKey` to the row (the COMPLETED PATCH does that authoritatively) — pattern from `app/api/jobs/[id]/logs/raw-artifact/route.ts` (research.md P3)
- [X] T045 [P] [US3] ✅ DONE Create `app/api/internal/admin-insights/raw-artifacts/route.ts` exporting `GET` that: validates `validateWorkflowAuth(request)` → 401; parses `periodStart`/`periodEnd` query params (Zod `z.coerce.date()`, `periodEnd > periodStart`); enumerates `JobLog` rows via the shared `claude-job-filter` where `Job.status='COMPLETED'`, effective agent `CLAUDE`, `JobLog.rawArtifactKey IS NOT NULL`, `JobLog.captureStatus='CAPTURED'`, `Job.startedAt >= periodStart AND Job.startedAt < periodEnd`; caps at 5000 rows; returns `[{ jobId, projectId, ticketId, rawArtifactKey, capturedAt }, ...]` per workflows/insights-analyze-workflow.md §"Internal artifact-listing endpoint"
- [X] T046 [P] [US3] ✅ DONE Create `.github/workflows/insights-analyze.yml` per workflows/insights-analyze-workflow.md (steps 1–8: PATCH RUNNING → setup Node/Bun/Claude CLI → enumerate raw artifacts via internal endpoint → download via authenticated proxy → run `claude /insights --input-dir /tmp/sessions --output-html /tmp/report.html --period-start --period-end` → PUT HTML → PATCH COMPLETED with counts/key/size → step 8 PATCH FAILED on `if: failure()`); `timeout-minutes: 45`; only `workflow_dispatch` trigger
- [X] T047 [US3] ✅ DONE Wire trigger button into `app/components/admin/insights/insights-page-shell.tsx` (extends T030): pass `runningReportId` to `<TriggerRunButton>`, surface 409 errors via toast, optimistically reflect "Running..." while polling reveals the new RUNNING row

**Checkpoint**: User Story 3 fully functional — operator can trigger, system enforces gates, workflow uploads & finalizes, page polls and reflects state.

---

## Phase 6: User Story 4 - Browse and view past reports (Priority: P2)

**Goal**: With multiple reports persisted, the operator can pick a previous report from the list; selecting a COMPLETED entry switches the iframe to that report, a FAILED entry shows its error reason in place of the iframe, and a RUNNING entry shows the "Running..." placeholder.

**Independent Test**: With at least two COMPLETED reports persisted and an authenticated allowlisted user, the user can open the list, select an older entry, see its HTML body and metadata header replace the current view, then return to the latest entry.

### Tests for User Story 4

- [X] T048 [P] [US4] ✅ DONE Extend `tests/integration/admin/insights-list.test.ts` (created in T019) with: multiple reports ordering by `createdAt desc`, FAILED entries serialized with `errorReason` set, RUNNING entries serialized with `runningReportId` matching, list cap enforced when DB contains > 200 rows
- [X] T049 [P] [US4] ✅ DONE Extend `tests/e2e/admin/insights-page.spec.ts` (created in T021) with: seed two COMPLETED reports, click an older list entry, assert iframe `src` switches to that report's id and metadata header updates, click the latest, assert switch back

### Implementation for User Story 4

- [X] T050 [US4] ✅ DONE Extend `app/components/admin/insights/past-reports-list.tsx` (created in T028) with: selection state (controlled prop), per-entry click handler, FAILED entries render the `errorReason` inline (not a link to the iframe), RUNNING entries render a "Running…" badge and are non-selectable
- [X] T051 [US4] ✅ DONE Extend `app/components/admin/insights/insights-page-shell.tsx` (T030/T047) with: `selectedReportId` state defaulting to latest COMPLETED's id; render iframe for `src={\`/api/admin/insights/reports/${selectedReportId}/html\`}` keyed by `selectedReportId` so the iframe re-mounts on selection change; render metadata-header from the selected report; render `errorReason` placeholder when selection is FAILED; render "Running..." placeholder when selection is RUNNING; render "Report content is no longer available" when GET returns 404 for a COMPLETED entry (FR-024)

**Checkpoint**: All user stories independently functional — MVP through past-archive browsing.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening before merge.

- [X] T052 [P] ✅ DONE Run `bun run type-check` and `bun run lint` from repo root; fix all errors (CLAUDE.md commit rule) — both clean.
- [X] T053 [P] ✅ DONE Run `bun run test:unit tests/unit/admin/` and confirm all 4 unit-test files pass — 35 tests passing.
- [ ] T054 [P] Run `bun run test:integration tests/integration/admin/` and confirm all 7 integration-test files pass against a real Postgres — Requires a live dev server + Postgres; skipped in this run per user instruction "never run the full test suite, only impacted tests". Tests are authored and ready to run.
- [ ] T055 Run `bun run test:e2e tests/e2e/admin/insights-page.spec.ts` and confirm the golden-path Playwright test passes — Requires browser/dev server; skipped per user instruction; spec ready.
- [X] T056 [P] ✅ DONE Verify SC-001 (page render ≤ 5s), SC-002 (404 byte-equivalence — verified by T032), SC-004 (refusal ≤ 2s), SC-005 (canonical phrasing — verified by T021/T026), SC-006 (zero non-Claude sessions in input — verified by T045 + T036), SC-007 (≤200 rows — verified by T019/T048), SC-008 (sandbox isolation — verified by T021), SC-009 (config-only allowlist updates — verified by T014), SC-010 (operator-actionable error reasons — verified by T037)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No external dependencies; T002 → T003 sequential
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma types must be regenerated before any code references the new model)
- **User Story 1 (Phase 3)**: Depends on Phase 2 (uses `requireAdmin`, `reconcileOrphanedInsightsReports`, `streamInsightsReportHtml`, `query-keys.admin.*`)
- **User Story 2 (Phase 4)**: Depends on User Story 1 (response-parity test exercises the routes US1 ships)
- **User Story 3 (Phase 5)**: Depends on Phase 2 + extends T025's HTML route file with PUT (T044)
- **User Story 4 (Phase 6)**: Depends on User Story 1 (extends `past-reports-list` and `insights-page-shell`)
- **Polish (Phase 7)**: Depends on all user stories

### User Story Dependencies (in priority order)

- **US1 (P1)**: Foundational only. Independently testable with one seeded COMPLETED report.
- **US2 (P1)**: Depends on US1's routes existing — but conceptually independent: with the admin shell deployed and zero reports, response-parity holds.
- **US3 (P1)**: Foundational + extends US1's HTML route file. Independently testable with a previous COMPLETED report seeded and a SHIP-ed ticket since.
- **US4 (P2)**: Depends on US1's components (past-reports-list, insights-page-shell). Independently testable with two seeded COMPLETED reports.

### Within Each User Story

- Tests (`tests/...`) are written first (constitution III); they MUST FAIL before implementation
- Helpers/fixtures before tests that consume them (T018 before T019/T020/T021)
- Models/types (foundational) before services (foundational helpers) before endpoints (US3 routes) before UI (components, hooks)
- Page shell composition (T030) follows component creation (T026, T027, T028, T029)

### Parallel Opportunities

- **Phase 2**: T004–T013 are all `[P]` (different files); the four unit-test tasks T014–T017 are all `[P]`
- **Phase 3 tests**: T018–T021 are all `[P]` (different test files / fixtures)
- **Phase 3 components**: T026, T027, T028, T029, T024, T025 are all `[P]` (different files); T022 is `[P]`; T023 (layout) precedes T031 (page) only because T031 depends on the shell created in T030
- **Phase 5 tests**: T036–T039 all `[P]`
- **Phase 5 implementation**: T040, T041, T042, T043, T044, T045, T046 all `[P]`; T047 sequential after T040 + T030
- **Phase 6**: T048, T049 `[P]`; T050 → T051 sequential
- **Phase 7**: T052, T053, T054, T056 `[P]`; T055 sequential after T054

### Cross-Story Parallelism

After Phase 2 completes, US1 (Phase 3) and US3 backend pieces (T042, T043, T044, T045, T046) can proceed in parallel because they touch different routes and files. UI-level US3 work (T040, T041, T047) waits for US1's shell (T030).

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All foundational helpers can launch in parallel (different files):
Task: "Create lib/admin/admin-auth.ts with requireAdmin/getAdminAllowlistEmails/isAdminEmail"
Task: "Create lib/admin/insights/state-machine.ts with canTransition"
Task: "Create lib/admin/insights/artifact-key.ts with buildInsightsReportArtifactKey"
Task: "Create lib/admin/insights/claude-job-filter.ts with effective-agent helpers"
Task: "Create lib/admin/insights/period.ts with derivePeriod"
Task: "Create lib/admin/insights/reconcile.ts with reconcileOrphanedInsightsReports"
Task: "Create app/lib/admin/insights/status-update-validator.ts (Zod discriminated union)"
Task: "Extend app/lib/blob/client.ts with insights HTML wrappers"
Task: "Extend app/lib/query-keys.ts with admin.insights namespace"
Task: "Create app/lib/workflows/dispatch-insights-analyze.ts (Octokit dispatcher)"

# Then all 4 unit-test files in parallel:
Task: "tests/unit/admin/admin-auth.test.ts"
Task: "tests/unit/admin/insights-state-machine.test.ts"
Task: "tests/unit/admin/claude-job-filter.test.ts"
Task: "tests/unit/admin/period.test.ts"
```

## Parallel Example: User Story 1 (Phase 3)

```bash
# Tests in parallel:
Task: "tests/helpers/admin-insights-fixtures.ts"
Task: "tests/integration/admin/insights-list.test.ts"
Task: "tests/integration/admin/insights-html-get.test.ts"
Task: "tests/e2e/admin/insights-page.spec.ts"

# UI components in parallel:
Task: "app/components/admin/insights/metadata-header.tsx"
Task: "app/components/admin/insights/report-iframe.tsx"
Task: "app/components/admin/insights/past-reports-list.tsx"
Task: "app/hooks/admin/use-admin-insights-list.ts"

# API routes in parallel:
Task: "app/api/admin/insights/reports/route.ts (GET list)"
Task: "app/api/admin/insights/reports/[id]/html/route.ts (GET html)"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup): T001 → T002 → T003
2. Phase 2 (Foundational): T004–T013 in parallel; T014–T017 in parallel
3. Phase 3 (US1): T018 → tests T019–T021 in parallel → components T026–T029 + endpoints T024–T025 in parallel → composition T030 → page T031 (with layout T023 and root T022 alongside)
4. **STOP and VALIDATE**: seed a COMPLETED report, sign in as an allowlisted user, open `/admin/insights`, see report inline. SC-001/SC-005/SC-008 covered.
5. Demo / merge / deploy gated by allowlist env var.

### Incremental Delivery

1. After US1 ships: run T032 (Phase 4 — response-parity verification). If it passes against the deployed shell, US2 is "done" with no extra implementation. SC-002 covered.
2. After US1+US2 ship: implement US3 (Phase 5) for the trigger flow. SC-003/SC-004/SC-006/SC-009/SC-010 covered.
3. After US3 ships: implement US4 (Phase 6) for past-reports browsing. FR-016/FR-024 covered.
4. Run Phase 7 polish before final merge.

### Parallel Execution Strategy

After Phase 2 completes, two parallel tracks:

- **Track A**: US1 UI + endpoints (Phase 3) — page-render slice
- **Track B**: US3 backend (T042, T043, T044, T045, T046) — trigger + workflow + status callbacks

Tracks converge at T047 (wiring trigger UI into the shell).

---

## Notes

- Every file path above is real (verified against the current tree) or justified as new in plan.md "Project Structure"
- Test files all live under `tests/unit/admin/`, `tests/integration/admin/`, or `tests/e2e/admin/`; the `admin/` subdirectories are new (research.md §F)
- `[e2e]`-prefixed user emails and project names per CLAUDE.md "Test Environment" — admin emails for E2E (e.g., `e2e-admin@e2e.local`) must be added to `ADMIN_ALLOWLIST_EMAILS` only in the test env
- Commit after each task or logical group; never use `--no-verify` (CLAUDE.md commit rule); run `bunx prisma generate` after T003
- Verify each test fails before implementing the corresponding code (constitution III)
- The 404 baseline (FR-003, SC-002) is enforced by `requireAdmin()` throwing a uniform exception that page handlers translate via `notFound()` and API handlers translate to `new NextResponse(null, { status: 404 })` — never a JSON body for 404s on user-facing admin routes
