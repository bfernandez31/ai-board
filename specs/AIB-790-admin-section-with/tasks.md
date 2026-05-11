# Tasks: Admin Section with Claude Code Insights Report

**Input**: Design documents from `specs/AIB-790-admin-section-with/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## User Story Mapping
- **US1**: View Latest Insights Report (P1)
- **US2**: Trigger New Analysis (P1)
- **US3**: Browse Past Reports (P2)
- **US4**: Admin Access Control (P1)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema changes and environment configuration for the InsightsRun model.

- [x] T001 Add `InsightsRunStatus` enum (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`) and `InsightsRun` model to `prisma/schema.prisma` following the schema defined in `data-model.md` — include all fields, indexes (`[status, createdAt]`, `[createdAt(sort: Desc)]`, `[status]`), and `user` relation (`triggeredBy` → `User.id`, onDelete: Cascade)
- [x] T002 Add `insightsRuns InsightsRun[]` relation field to the `User` model in `prisma/schema.prisma`
- [x] T003 Run `bunx prisma migrate dev --name add-insights-run` to generate the migration, then run `bunx prisma generate` to regenerate the client
- [x] T004 [P] Add `ADMIN_EMAILS` entry to `.env.example` with documentation comment explaining comma-separated email format and fail-closed behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented — admin auth helper, blob extensions, artifact key builder, and query keys.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational Phase
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): All test files below are CREATE — no existing test files cover the admin auth domain.**

- [x] T005 [P] Create unit tests for admin auth helper in `tests/unit/lib/admin-auth.test.ts` — test authorized email returns user info, unauthorized email throws "Not found", empty env var throws "Not found" (fail-closed), missing env var throws "Not found" (fail-closed), case-insensitive matching, whitespace trimming in env var parsing. Follow pattern from `lib/db/auth-helpers.ts:30-56`.

### Implementation for Foundational Phase

- [x] T006 Create `verifyAdminAccess(request?)` function in `lib/db/admin-auth.ts` — call `requireAuth(request)` to get userId, look up user email from DB, parse `ADMIN_EMAILS` env var (comma-separated, trimmed, lowercased), throw `"Not found"` if empty/missing or email not in list, return `{ userId, email }`. Follow error-based auth pattern from `lib/db/auth-helpers.ts:30-56`.
- [x] T007 [P] Create `buildInsightsReportKey(runId: number): string` in `app/lib/insights/artifact-key.ts` returning `insights-reports/<runId>.html`
- [x] T008 [P] Extend `app/lib/blob/client.ts` with `uploadInsightsReport(key: string, html: Buffer): Promise<PutBlobResult>` (same pattern as `uploadJobLogArtifact` but with `contentType: 'text/html; charset=utf-8'`) and `streamInsightsReport(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number } | null>` (same pattern as `streamJobLogArtifact`)
- [x] T009 [P] Add `admin.insights` key family to `app/lib/query-keys.ts` — add keys for `latest`, `runs` (with optional filters), and `run` (by ID) following the existing key structure pattern

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 4 — Admin Access Control (Priority: P1) 🎯 MVP

**Goal**: Only users on the configured admin allowlist can access the `/admin` area. Unauthorized users receive a 404 with no indication that the area exists.

**Independent Test**: Access `/admin` with an unauthorized user and verify 404 response; access with an authorized user and verify the admin layout loads.

### Tests for User Story 4
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): CREATE new file — no existing test file covers admin access control.**

- [x] T010 [US4] Create access control integration tests in `tests/integration/admin/insights-access-control.test.ts` — test admin user gets 200/201 on all admin API endpoints, non-admin user gets 404 on all endpoints, unauthenticated user gets 404 on all endpoints. Follow pattern from `tests/integration/auth/dev-login-disabled.test.ts`.

### Implementation for User Story 4

- [x] T011 [P] [US4] Create admin layout (server component) in `app/admin/layout.tsx` — call `verifyAdminAccess()` and `notFound()` if it throws, render admin shell with sidebar and content area, use aurora gradient styling for admin area header
- [x] T012 [P] [US4] Create admin root page in `app/admin/page.tsx` — `redirect('/admin/insights')` (single admin page for now)
- [x] T013 [P] [US4] Create admin sidebar navigation (client component) in `components/admin/admin-sidebar.tsx` — single nav item "Insights" with BarChart3 icon from lucide-react, active state based on pathname. Follow pattern from `components/navigation/icon-rail-sidebar.tsx`.

**Checkpoint**: Admin area is locked down. Unauthorized users see 404. Authorized users see the admin layout with sidebar.

---

## Phase 4: User Story 1 — View Latest Insights Report (Priority: P1) 🎯 MVP

**Goal**: An authorized admin navigates to the Insights page and immediately sees the most recent analysis report rendered inline, along with metadata (generation date, period, session count, ticket count).

**Independent Test**: Seed a completed InsightsRun with a report in blob storage, navigate to `/admin/insights`, verify the report renders with correct metadata. Also verify the empty state when no reports exist.

### Tests for User Story 1
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): All test files below are CREATE — no existing test files cover admin insights components.**

- [x] T014 [P] [US1] Create dashboard component tests in `tests/unit/components/admin/insights-dashboard.test.tsx` — test renders empty state when no reports, renders latest report with metadata header (generation date, period, session/ticket counts), report viewer loads with correct report URL. Follow pattern from `tests/unit/components/analytics-dashboard.test.tsx`.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create GET latest endpoint in `app/api/admin/insights/latest/route.ts` — verify admin access, query latest COMPLETED InsightsRun and any active PENDING/RUNNING run, return `{ run, activeRun }` per contract in `contracts/admin-insights-api.md`
- [x] T016 [P] [US1] Create GET report stream endpoint in `app/api/admin/insights/runs/[runId]/report/route.ts` — verify admin access, load InsightsRun by ID, check `reportKey` is set, stream HTML from blob via `streamInsightsReport()`, return with `Content-Type: text/html; charset=utf-8` and `Cache-Control: private, max-age=3600`
- [x] T017 [P] [US1] Create report viewer component (client component) in `components/admin/report-viewer.tsx` — sandboxed iframe with `<iframe sandbox="" srcdoc={html} />` (no `allow-scripts`, no `allow-same-origin`), auto-height or fixed height with scroll, metadata header above iframe showing generation date, period, session/ticket counts
- [x] T018 [US1] Create insights dashboard component (client component) in `components/admin/insights-dashboard.tsx` — TanStack Query with `admin.insights` keys polling latest run (30s default interval), display latest report via report-viewer when available, display empty state with "Run new analysis" button when no reports, use aurora-* dialog styling
- [x] T019 [US1] Create insights page (server component) in `app/admin/insights/page.tsx` — fetch latest completed run and active run status via server-side Prisma query, pass initial data to `InsightsDashboard` client component

**Checkpoint**: Admin can view the latest insights report with metadata, or see the empty state if no reports exist.

---

## Phase 5: User Story 2 — Trigger New Analysis (Priority: P1)

**Goal**: An authorized admin clicks "Run new analysis" to generate a fresh insights report. The system checks for new shipped tickets, starts background analysis, shows running state, and produces a report on completion.

**Independent Test**: Ensure shipped CLAUDE tickets exist, click "Run new analysis", verify the job starts with a running indicator, and produces a new report on completion. Also verify duplicate prevention and "no new tickets" refusal.

### Tests for User Story 2
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): CREATE new file — no existing test file covers admin insights API lifecycle.**

- [x] T020 [US2] Create API lifecycle integration tests in `tests/integration/admin/insights-runs.test.ts` — test POST trigger creates run and returns 201, POST duplicate prevention returns 409 with `RUN_IN_PROGRESS` code, POST with no new tickets returns 409 with `NO_NEW_TICKETS` code and `lastRunDate`, GET single run returns run details, PATCH valid status transitions (PENDING→RUNNING, RUNNING→COMPLETED with required fields, RUNNING→FAILED with errorMessage), PATCH invalid transitions return 400, POST returns 503 when blob not configured. Follow pattern from `tests/integration/health/trigger-scan.test.ts`.

### Implementation for User Story 2

- [x] T021 [P] [US2] Create POST trigger and GET list handlers in `app/api/admin/insights/runs/route.ts` — POST: verify admin access → check blob configured (503 if not) → check no active run with `timeoutAt > now()` (409 if found) → find last COMPLETED run's `periodEnd` → count shipped CLAUDE tickets since that date using `buildEffectiveAgentWhere('CLAUDE')` pattern from `lib/analytics/queries.ts:51-69` (409 if none) → create InsightsRun with `status: PENDING`, `timeoutAt: now() + 30min` → start background analysis (non-blocking) → return 201. GET: verify admin access → cursor-based pagination with optional status filter → return `{ runs, nextCursor, hasMore }` per contract.
- [x] T022 [P] [US2] Create GET single run endpoint in `app/api/admin/insights/runs/[runId]/route.ts` — verify admin access, load InsightsRun by ID, return 404 if not found
- [x] T023 [P] [US2] Create PATCH status endpoint in `app/api/admin/insights/runs/[runId]/status/route.ts` — validate via `WORKFLOW_API_TOKEN` Bearer header or admin session, validate state transitions per contract (PENDING→RUNNING, PENDING→FAILED, RUNNING→COMPLETED, RUNNING→FAILED), validate required fields per transition (COMPLETED requires `periodStart/End`, `sessionCount`, `ticketCount`, `reportKey`, `reportSize`; FAILED requires `errorMessage`), set `startedAt` on RUNNING, set `completedAt` on COMPLETED/FAILED
- [x] T024 [US2] Create analysis engine `executeInsightsAnalysis(runId: number)` in `app/lib/insights/run-analysis.ts` — update run to RUNNING → query shipped CLAUDE tickets with completed jobs that have `rawArtifactKey` using effective agent WHERE pattern → download raw JSONL artifacts from blob to temp directory → invoke Claude Code `/insights` CLI over session files → upload resulting HTML via `uploadInsightsReport()` → update run to COMPLETED with metadata → on error: update to FAILED with error message → always cleanup temp directory in try/finally
- [x] T025 [US2] Add trigger button with loading/disabled states, running indicator with 5s polling interval, error display with retry, and success auto-refresh to insights dashboard in `components/admin/insights-dashboard.tsx`

**Checkpoint**: Admin can trigger new analysis, see running state, and view the completed report. Double-trigger prevention and error handling work correctly.

---

## Phase 6: User Story 3 — Browse Past Reports (Priority: P2)

**Goal**: An authorized admin can see a chronological list of all past reports and select any one to view its full content and metadata.

**Independent Test**: Generate multiple reports, navigate to the Insights page, select different past reports from the list, verify each renders correctly with its own metadata.

### Tests for User Story 3
**NOTE: Write these tests FIRST, ensure they FAIL before implementation**
**RULE (constitution): Extend existing test file `tests/unit/components/admin/insights-dashboard.test.tsx` — it already covers the insights dashboard domain.**

- [x] T026 [P] [US3] Extend dashboard component tests in `tests/unit/components/admin/insights-dashboard.test.tsx` with report list scenarios — test renders chronological list (newest first) with generation date and period, selecting a past report renders it inline with its metadata, selecting latest returns to the most recent report

### Implementation for User Story 3

- [x] T027 [US3] Add report list browsing UI to insights dashboard in `components/admin/insights-dashboard.tsx` — display chronological list (newest first) of completed reports with generation date and analyzed period, selectable entries that switch the report viewer, active/selected state styling, "Latest" quick-select option

**Checkpoint**: All user stories are independently functional. Admin can view the latest report, trigger new analysis, and browse past reports.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify all code compiles, passes lint, and tests pass across the full feature.

- [x] T028 [P] Run `bun run type-check` and fix all TypeScript errors across all new and modified files
- [x] T029 [P] Run `bun run lint` and fix all ESLint issues across all new and modified files
- [x] T030 Run `bun run test:unit` and verify all unit tests pass (admin-auth, insights-dashboard)
- [x] T031 Run `bun run test:integration` and verify all integration tests pass (insights-runs, insights-access-control)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US4 - Access Control (Phase 3)**: Depends on Foundational — BLOCKS all other user stories (admin layout required)
- **US1 - View Report (Phase 4)**: Depends on US4 (needs admin layout + auth)
- **US2 - Trigger Analysis (Phase 5)**: Depends on US4 (needs admin auth on API routes)
- **US3 - Browse Reports (Phase 6)**: Depends on US1 (extends dashboard component) + US2 (needs report list from GET runs)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US4 (P1)**: Foundational — must complete first. Provides admin auth and layout for all other stories.
- **US1 (P1)**: Depends on US4. Creates the dashboard component and report viewer. Can start after US4.
- **US2 (P1)**: Depends on US4. Creates API routes and analysis engine. Can run **in parallel** with US1 (different files).
- **US3 (P2)**: Depends on US1 (extends dashboard) + US2 (needs GET list endpoint). Must run after both.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- API routes before UI components (components consume API)
- Server components after client components (server components pass data to client)
- Core rendering before interactive features
- Story complete before moving to next priority

### Parallel Opportunities

**Phase 2 (Foundational)**:
```
Parallel: T005 (admin-auth tests) | T007 (artifact-key) | T008 (blob client) | T009 (query-keys)
Sequential: T006 (admin-auth impl) after T005 confirms test expectations
```

**Phase 3 (US4)**:
```
Parallel: T011 (layout) | T012 (redirect page) | T013 (sidebar)
Sequential: T010 (access control tests) first
```

**Phase 4 + 5 (US1 + US2) — can run in parallel**:
```
US1 parallel: T015 (latest endpoint) | T016 (report endpoint) | T017 (report-viewer)
US1 sequential: T018 (dashboard) → T019 (page)

US2 parallel: T021 (runs route) | T022 (single run route) | T023 (status route)
US2 sequential: T024 (analysis engine) → T025 (dashboard trigger)
```

---

## Implementation Strategy

### MVP First (US4 + US1 Only)

1. Complete Phase 1: Setup (schema + migration)
2. Complete Phase 2: Foundational (admin-auth + blob + keys)
3. Complete Phase 3: US4 — Admin Access Control
4. Complete Phase 4: US1 — View Latest Report
5. **STOP and VALIDATE**: Admin can access the page, see a report (if seeded), or see the empty state
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US4 (Access Control) → Admin area is secure → Test independently
3. Add US1 (View Report) → Reports are viewable → Deploy/Demo (MVP!)
4. Add US2 (Trigger Analysis) → Reports can be generated → Deploy/Demo
5. Add US3 (Browse Past Reports) → Full feature → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Execution Strategy

ai-board can execute user stories in parallel after US4:

1. Complete Setup + Foundational + US4 sequentially (required)
2. Once US4 is done, US1 and US2 can run in parallel:
   - Parallel task 1: US1 (view report — pages + components)
   - Parallel task 2: US2 (trigger analysis — API routes + engine)
3. After both complete, US3 extends the dashboard with browsing
4. Polish phase validates everything end-to-end

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Plan.md creates `app/lib/insights/artifact-key.ts` as a new file (separate from `app/lib/logs/artifact-key.ts`) — insights domain is distinct from job log domain
- All new directories (`app/admin/`, `components/admin/`, `app/api/admin/`, `app/lib/insights/`, `tests/integration/admin/`, `tests/unit/components/admin/`) must be created during implementation
- No existing test files need extension except `tests/unit/components/admin/insights-dashboard.test.tsx` in Phase 6 (created in Phase 4)
