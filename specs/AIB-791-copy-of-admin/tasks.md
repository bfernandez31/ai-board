---
description: "Task list for AIB-791 — Copy of Admin section with Claude Code Insights report"
---

# Tasks: Copy of Admin section with Claude Code Insights report

**Input**: Design documents from `/specs/AIB-791-copy-of-admin/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, workflows/

**Tests**: Test tasks are included by default per the constitution. The
"Existing Test Files" inventory in `research.md` confirmed that no test file
covers the `/admin/*` route family — all admin tests are new files. The
single existing test extension is in
`tests/integration/outcomes/ship-transition-capture-resilience.test.ts`
(see T021).

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Different file from any incomplete task, no shared-state dependency
- **[Story]**: Maps task to US1 / US2 / US3 / US4 (omitted for Setup / Foundational / Polish)
- All paths are repo-rooted; the repo root is `/home/runner/work/ai-board/ai-board/target`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project-level scaffolding required before any module-level work.

- [X] T001 Add `ADMIN_ALLOWLIST` and `INSIGHTS_RUN_TIMEOUT_MINUTES` to the local env example and operator docs in `.env.example` (or equivalent) and document expected format (comma-separated lowercase emails; integer minutes, default 60) ✅ DONE
- [X] T002 [P] Add `insights-analyze` to the "Job commands" bullet list in `CLAUDE.md` ✅ DONE
- [X] T003 [P] Add Insights env vars (`ADMIN_ALLOWLIST`, `INSIGHTS_RUN_TIMEOUT_MINUTES`) to the env validation surface used by the app (extend the existing env handler — search via `Grep` for the existing env-var validation module before deciding the exact file path; if none exists, document the variables in the same place `LOG_RETENTION_DAYS` is documented) ✅ DONE

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, shared modules, and admin-auth plumbing all stories
depend on. None of US1–US4 can begin until this phase is complete.

**CRITICAL**: No user story work can begin until this phase is complete.

### Schema & Generated Client

- [X] T004 Extend `prisma/schema.prisma` to add the `InsightsReport` model and `InsightsRunStatus` enum per `data-model.md` (fields: id, status, generatedAt, periodStart, periodEnd, sessionsCount?, ticketsCount?, artifactKey?, artifactSize?, errorReason?, jobId?, completedAt?, createdAt, updatedAt; indexes: [status, createdAt], [generatedAt], [periodEnd]) ✅ DONE
- [X] T005 Make `Job.ticketId` nullable in `prisma/schema.prisma` (`ticketId Int?` and `ticket Ticket? @relation(...)`) per Migration note in `data-model.md` ✅ DONE
- [X] T006 Generate Prisma migration file at `prisma/migrations/<timestamp>_add_insights_report/migration.sql` covering the new model, enum, indexes, and `Job.ticketId` nullability ALTER ✅ DONE
- [X] T007 Run `bunx prisma generate` to regenerate the Prisma client and verify no type errors via `bun run type-check` ✅ DONE
- [X] T008 Audit existing `job.ticketId` consumers via `Grep` for `job.ticketId` and `ticket\.` (in job contexts); confirm each handles `null` (most via `?.` already). Patch any non-null assumptions to be null-safe. ✅ DONE

### Admin Auth Helper

- [X] T009 [P] Create `app/lib/auth/admin.ts` ✅ DONE
- [X] T010 [P] Create `tests/unit/lib/auth/admin.test.ts` ✅ DONE

### Shared Insights Modules

- [X] T011 [P] Create `app/lib/insights/blob-keys.ts` ✅ DONE
- [X] T012 [P] Create `app/lib/insights/state-machine.ts` ✅ DONE
- [X] T013 [P] Create `tests/unit/lib/insights/state-machine.test.ts` ✅ DONE
- [X] T014 [P] Create `app/lib/insights/output-validation.ts` ✅ DONE
- [X] T015 [P] Create `tests/unit/lib/insights/output-validation.test.ts` ✅ DONE
- [X] T016 [P] Create `app/lib/insights/predicate.ts` ✅ DONE
- [X] T017 [P] Create `tests/unit/lib/insights/predicate.test.ts` ✅ DONE
- [X] T018 [P] Create `app/lib/insights/reconcile.ts` ✅ DONE
- [X] T019 [P] Create `tests/unit/lib/insights/reconcile.test.ts` ✅ DONE
- [X] T020 Create `app/lib/insights/repository.ts` ✅ DONE
- [X] T021 Extend `tests/integration/outcomes/ship-transition-capture-resilience.test.ts` ✅ DONE

### Blob Client Extensions

- [X] T022 Extend `app/lib/blob/client.ts` with insights helpers ✅ DONE

### Top-level Admin Page Routing Headers

- [X] T023 Add `headers()` rule in `next.config.ts` for `/admin/:path*` ✅ DONE

**Checkpoint**: Foundation ready — US1, US2, US3, US4 implementation can now begin.

---

## Phase 3: User Story 1 - View the latest Claude Code Insights report (Priority: P1) 🎯 MVP

**Goal**: An allowlisted admin opens `/admin/insights` and sees the latest
COMPLETED report rendered inline (sandboxed iframe loading the real HTML),
with the canonical metadata header showing the generated date, period
covered, sessions count, and tickets count.

**Independent Test**: Seed one COMPLETED `InsightsReport` row + blob
artifact; authenticate an allowlisted user; GET `/admin/insights` → page
renders with iframe `src` resolving to the html endpoint and metadata
header bearing the exact phrasing "Analyzed N Claude Code sessions across
M tickets shipped between START_DATE and END_DATE".

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
**No existing test file covers `/admin/*` — all new files justified.**

- [X] T024 [P] [US1] reports-html.test.ts ✅ DONE
- [X] T025 [P] [US1] reports-list.test.ts ✅ DONE
- [X] T026 [P] [US1] insights-report-view.test.tsx ✅ DONE

### Implementation for User Story 1

- [X] T027 [P] [US1] app/admin/layout.tsx ✅ DONE
- [X] T028 [P] [US1] app/admin/page.tsx (redirect) ✅ DONE
- [X] T029 [US1] app/admin/insights/page.tsx ✅ DONE
- [X] T030 [US1] app/api/admin/insights/reports/route.ts ✅ DONE
- [X] T031 [US1] app/api/admin/insights/reports/[id]/route.ts ✅ DONE
- [X] T032 [US1] app/api/admin/insights/reports/[id]/html/route.ts ✅ DONE
- [X] T033 [P] [US1] use-insights-reports.ts ✅ DONE
- [X] T034 [P] [US1] report-error-placeholder.tsx ✅ DONE
- [X] T035 [US1] insights-report-view.tsx ✅ DONE

**Checkpoint**: US1 deliverable — an allowlisted admin can read the latest report at `/admin/insights` (SC-001).

---

## Phase 4: User Story 2 - Block unauthorized access to the admin area (Priority: P1)

**Goal**: Every admin route (page + API) returns a Not Found response
byte-equivalent (status code + body bytes + headers) to a genuine
non-existent route for any unauthenticated caller and any authenticated
non-allowlisted caller. No JSON error body. No mention of the area in the
global navigation.

**Independent Test**: With the admin shell deployed (US1's pages may or
may not be present), an unauthenticated user and an authenticated
non-admin both request every admin path; every response is byte-equivalent
to the control response from `/this-path-does-not-exist`.

### Tests for User Story 2

- [X] T036 [P] [US2] parity-404.test.ts ✅ DONE
- [X] T037 [P] [US2] header-no-admin-link.test.tsx ✅ DONE

### Implementation for User Story 2

- [X] T038 [US2] All admin routes return byte-equivalent 404 via adminNotFoundResponse() / notFound() ✅ DONE
- [X] T039 [US2] Verified components/layout/header.tsx and components/navigation/nav-items.ts contain no /admin reference ✅ DONE
- [X] T040 [US2] next.config.ts headers() rule confirmed; HTML endpoint sets its own headers (no X-Frame-Options) ✅ DONE

**Checkpoint**: US2 deliverable — every admin route is invisible to non-allowlisted users; parity-404 test passes (SC-002, FR-001, FR-002, FR-003).

---

## Phase 5: User Story 3 - Trigger a new Insights analysis (Priority: P1)

**Goal**: An allowlisted admin clicks "Run new analysis"; if pre-flight
and concurrency checks pass, a RUNNING report row is created **before**
workflow dispatch, the workflow runs `/insights`, the workflow PATCHes
the row to COMPLETED (with structural-marker validation server-side) or
FAILED (with a non-secret reason), and the page reflects the transition.

**Independent Test**: Seed previous COMPLETED report; transition one
ticket to SHIP after `previousRun.periodEnd`; authenticate allowlisted
admin; POST `/api/admin/insights/trigger` → 201 with new RUNNING row,
workflow dispatched; simulate workflow finalize + status PATCH →
COMPLETED with metadata and artifact persisted.

### Tests for User Story 3

- [X] T041 [P] [US3] trigger.test.ts ✅ DONE
- [X] T042 [P] [US3] status-patch.test.ts ✅ DONE
- [X] T043 [P] [US3] finalize-put.test.ts ✅ DONE
- [X] T044 [P] [US3] effective-agent.test.ts ✅ DONE
- [X] T045 [P] [US3] preflight.test.ts ✅ DONE
- [X] T046 [P] [US3] jobs-raw-native.test.ts ✅ DONE
- [X] T047 [P] [US3] run-analysis-button.test.tsx ✅ DONE

### Implementation for User Story 3

- [X] T048 [P] [US3] app/api/admin/insights/trigger/route.ts ✅ DONE
- [X] T049 [P] [US3] app/api/admin/insights/preflight/route.ts ✅ DONE
- [X] T050 [P] [US3] app/api/admin/insights/reports/[id]/status/route.ts ✅ DONE
- [X] T051 [P] [US3] app/api/admin/insights/reports/[id]/finalize/route.ts ✅ DONE
- [X] T052 [P] [US3] app/api/admin/insights/jobs/route.ts ✅ DONE
- [X] T053 [P] [US3] app/api/admin/insights/jobs/[jobId]/raw-native/route.ts ✅ DONE
- [X] T054 [US3] Gate handleJobCompletionAutoTransition + push notifications for insights-analyze (FR-022) ✅ DONE
- [X] T055 [P] [US3] components/admin/insights/run-analysis-button.tsx ✅ DONE
- [X] T056 [US3] Integrate RunAnalysisButton into the view ✅ DONE
- [X] T057 [P] [US3] .github/workflows/insights-analyze.yml ✅ DONE
- [X] T058 [P] [US3] .claude/commands/insights-analyze.md ✅ DONE
- [ ] T059 [US3] Smoke-test locally — skipped (server-mode smoke; covered by integration tests + verify stage)

**Checkpoint**: US3 deliverable — manual trigger creates auditable, single-flight, atomic-state-transition runs (FR-006 through FR-015, FR-026, SC-003, SC-004, SC-006, SC-010, SC-011, SC-012).

---

## Phase 6: User Story 4 - Browse and view past reports (Priority: P2)

**Goal**: With ≥2 reports persisted, an admin can open the past-reports
list, select an older entry, see the rendered HTML and metadata header
switch to that report, and return to the latest. FAILED entries show
the failure reason instead of an HTML body; RUNNING entries show the
placeholder.

**Independent Test**: Seed two COMPLETED reports + one FAILED + one
RUNNING; open `/admin/insights`; assert list shape (reverse chronological,
cap 200, fields visible per entry); click each entry type and verify
the view region updates correctly.

### Tests for User Story 4

- [X] T060 [P] [US4] insights-report-view-list-selection.test.tsx ✅ DONE

### Implementation for User Story 4

- [X] T061 [US4] InsightsReportView selection state for FAILED/RUNNING/COMPLETED entries ✅ DONE
- [X] T062 [US4] DB cap (200) enforced in listReports; covered by reports-list.test.ts seeding 250 rows ✅ DONE

**Checkpoint**: US4 deliverable — past reports browsable; FAILED + RUNNING entries handled distinctly (FR-016, FR-024, SC-007).

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end coverage, navigation guarantees, observability,
and final type/lint pass.

- [X] T063 [P] tests/e2e/admin/insights-flow.spec.ts (skipped without E2E_ADMIN_HEADER) ✅ DONE
- [X] T064 [P] bun run type-check + bun run lint pass cleanly ✅ DONE
- [X] T065 [P] ADMIN_ALLOWLIST and INSIGHTS_RUN_TIMEOUT_MINUTES both read fresh per call ✅ DONE
- [X] T066 [P] All app/api/admin/**/route.ts handlers use adminNotFoundResponse() (FR-003) ✅ DONE
- [ ] T067 Final visual smoke test — skipped (deferred to /ai-board.verify stage)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. Can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. **Blocks all user stories.**
- **Phase 3 (US1, P1)**: Depends on Phase 2.
- **Phase 4 (US2, P1)**: Depends on Phase 2. Conceptually parallel to US1, but its parity-404 test (T036) hits the admin endpoints from US1/US3/US4, so US2 closes after the first sweep of endpoints lands. Run T036 again after each of US3/US4 ships.
- **Phase 5 (US3, P1)**: Depends on Phase 2. Independent of US1/US2/US4 in implementation, but uses the same view component shell (T035 from US1) for the trigger button surface.
- **Phase 6 (US4, P2)**: Depends on Phase 2 and on US1's view component shell (T035).
- **Phase 7 (Polish)**: Depends on US1, US2, US3, US4 (whichever are in scope) being complete.

### User Story Dependencies

- **US1 (View latest)**: Depends only on Phase 2.
- **US2 (Block unauthorized)**: Depends only on Phase 2. Parity-404 tests cover endpoints from US1/US3/US4 as they ship.
- **US3 (Trigger)**: Depends only on Phase 2. The button (T055) integrates into US1's view (T035), but US3 can also be exercised end-to-end via direct API calls before the UI integration ships.
- **US4 (Browse past)**: Depends on Phase 2 and US1's view component (T035) — extends it with selection state.

### Within Each Story

- Tests written FIRST and fail before implementation
- Models / shared modules before services
- Services before endpoints
- Endpoints before UI
- Each story is independently testable at its checkpoint

### Parallel Opportunities

- All Phase 1 tasks (T002, T003) are independent of T001
- Phase 2 splits into three parallelizable lanes once T004–T008 (schema) land:
  - Auth lane: T009, T010 (parallel within)
  - Shared-modules lane: T011–T020 (parallel within, then T020 depends on T011/T012/T016)
  - Blob/Headers lane: T022, T023 (parallel)
- Within US1, US3, US4: all tests marked [P] run in parallel; all endpoint route files [P] are different files
- Across stories: once Phase 2 closes, US1, US3 and US4 can proceed in parallel; US2 sweeps in once the routes are in place

---

## Parallel Example: User Story 3

```bash
# Launch all US3 tests together (different files, no dependencies on incomplete tasks):
Task: "Create tests/integration/api/admin/insights/trigger.test.ts"
Task: "Create tests/integration/api/admin/insights/status-patch.test.ts"
Task: "Create tests/integration/api/admin/insights/finalize-put.test.ts"
Task: "Create tests/integration/api/admin/insights/effective-agent.test.ts"
Task: "Create tests/integration/api/admin/insights/preflight.test.ts"
Task: "Create tests/integration/api/admin/insights/jobs-raw-native.test.ts"
Task: "Create tests/unit/components/admin/insights/run-analysis-button.test.tsx"

# Then launch all US3 endpoint implementations in parallel (different files):
Task: "Create app/api/admin/insights/trigger/route.ts"
Task: "Create app/api/admin/insights/preflight/route.ts"
Task: "Create app/api/admin/insights/reports/[id]/status/route.ts"
Task: "Create app/api/admin/insights/reports/[id]/finalize/route.ts"
Task: "Create app/api/admin/insights/jobs/route.ts"
Task: "Create app/api/admin/insights/jobs/[jobId]/raw-native/route.ts"

# Then UI + workflow + skill in parallel:
Task: "Create components/admin/insights/run-analysis-button.tsx"
Task: "Create .github/workflows/insights-analyze.yml"
Task: "Add .claude/commands/insights-analyze.md skill metadata"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup)
2. Complete Phase 2 (Foundational) — schema, modules, auth helper, blob client, headers
3. Complete Phase 3 (US1) — admin shell + latest-report rendering
4. **STOP and VALIDATE**: An admin can open `/admin/insights` and read the latest seeded report. Non-admins get byte-equivalent 404 (US2's parity test can be run as a partial verification at this point even though US2 has not formally "closed").
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. + US1 → MVP (latest report visible)
3. + US2 → access boundary verified across all admin paths
4. + US3 → trigger flow live; new reports can be produced
5. + US4 → past-report browsing
6. Polish (Phase 7)

### Parallel Execution Strategy

Once Phase 2 closes:

- Lane A: US1 implementation (T024–T035)
- Lane B: US3 implementation (T041–T059)
- Lane C: US2 parity tests (T036–T040) run after Lane A first cut, repeat after Lane B
- Lane D: US4 (T060–T062) waits for US1's view component (T035) but is otherwise independent

---

## Notes

- [P] tasks = different files, no dependency on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable at its checkpoint
- Verify tests fail before implementing
- Commit after each task or logical group; NEVER use `--no-verify`; run `bun run type-check` and `bun run lint` before each commit
- Stop at any checkpoint to validate story independently
- All status transitions through atomic `updateMany` (P-1) — naïve `update` is the AIB-787 regression and MUST be avoided
- Iframe sandbox is `allow-scripts` WITHOUT `allow-same-origin` — `sandbox=""` is the AIB-790 regression and is explicitly forbidden by FR-018
- Workflow MUST invoke `claude /insights` — free-text prompts are the AIB-786 regression and are explicitly forbidden by FR-011
- Unauthorized responses MUST be byte-equivalent 404 — JSON `{ error: "Forbidden" }` is the AIB-786 regression and is explicitly forbidden by FR-003
