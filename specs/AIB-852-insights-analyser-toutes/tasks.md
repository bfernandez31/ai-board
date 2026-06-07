---
description: "Task list for AIB-852 — Insights: analyze every agent session of a ticket"
---

# Tasks: Insights — Analyze Every Agent Session of a Ticket, Not Just One

**Input**: Design documents from `specs/AIB-852-insights-analyser-toutes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-insights-api.md, workflows/insights-analyze-workflow.md

**Tests**: Included by default (constitution §III). Existing test files are EXTENDED, not duplicated; one new file (`coverage.test.ts`) is created because no existing file covers cross-run exactly-once coverage.

**Organization**: Tasks are grouped by user story. Priority order is P1 (US1, US2, US5-guardrail) → P2 (US3, US4).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story label (US1..US5); omitted for Setup, Foundational, and Polish
- All paths are repository-root absolute and verified against the filesystem / research.md inventory

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish a clean baseline before TDD on an existing codebase (no project init needed).

- [ ] T001 Install dependencies and confirm a green baseline by running `bun install`, then `bun run type-check` and `bun run lint` from the repository root; record any pre-existing failures so new failures are attributable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + data-access layer that every selection/coverage/report story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 Add the AIB-852 schema delta to `prisma/schema.prisma`: new model `InsightsSessionCoverage` (`jobId Int @unique` → `Job` cascade, `reportId Int` → `InsightsReport` cascade, `coveredAt DateTime @default(now())`, `@@index([reportId])`); enum `InsightsCoverageGapReason { TRANSCRIPT_NOT_AVAILABLE }`; on `InsightsReport` add `expectedSessionsCount Int?`, `coverageGapReason InsightsCoverageGapReason?`, and back-relation `coveredSessions InsightsSessionCoverage[]`; on `Job` add back-relation `insightsCoverage InsightsSessionCoverage?` (per data-model.md).
- [ ] T003 Generate the migration `prisma/migrations/<timestamp>_insights_session_coverage/migration.sql` (CREATE TYPE enum, ALTER TABLE `InsightsReport` ADD COLUMNs, CREATE TABLE `InsightsSessionCoverage` with `UNIQUE("jobId")`, both cascading FKs, `INDEX("reportId")`; no backfill) and run `bunx prisma generate` to regenerate the client. Depends on T002.
- [ ] T004 [P] Add data-access helpers and serialization fields to `app/lib/insights/repository.ts`: `advanceCoverage(tx, reportId, jobIds)` using `createMany({ skipDuplicates: true })`; `derivePeriodStart()` returning max covered `completedAt` ?? oldest available session completion ?? now (D7/FR-014); extend `ReportListEntry` and `toListEntry` with `expectedSessionsCount` and `coverageGapReason` (clarify `sessionsCount` = analyzed). Follow the `$transaction` + `WHERE status='RUNNING'` pattern at `repository.ts:79-138` (P3). Depends on T003 (generated client).

**Checkpoint**: Schema migrated, client generated, coverage/period helpers available — user stories can begin.

---

## Phase 3: User Story 1 - Full multi-session ticket is analyzed end to end (Priority: P1) 🎯 MVP

**Goal**: Select and enumerate EVERY captured Claude session of each in-scope ticket (all stages, all projects), not just the earliest, and express the pre-flight estimate in sessions.

**Independent Test**: Seed one ticket with multiple captured Claude sessions across SPECIFY/PLAN/BUILD/VERIFY, run an analysis window covering them, and verify all N sessions are enumerated by `/jobs` (count == enumeration), not just one.

### Tests for User Story 1

**NOTE: Write these tests FIRST and ensure they FAIL before implementation.**

- [ ] T005 [P] [US1] Rewrite/extend `tests/unit/lib/insights/predicate.test.ts` to cover the new selection engine: all sessions per ticket included (US1 AC1/AC2), completion-timestamp boundary placement using `completedAt ?? updatedAt ?? startedAt` (D3), coverage-exclusion filter, `count == enumeration` parity (FR-016/SC-006), non-shipped ticket inclusion (US3 selection, no `TicketOutcome`), and no `projectId` filter applied (US5 selection). Mock `@/lib/db/client` (P8).
- [ ] T006 [P] [US1] Extend `tests/integration/api/admin/insights/preflight.test.ts` for the session-based snapshot: `analyzableSessions`/`expectedSessions` fields, and refusal codes `NO_CLAUDE_SESSIONS` (empty corpus) and `NO_NEW_SESSIONS` (no uncovered analyzable sessions).
- [ ] T007 [P] [US1] Extend `tests/integration/api/admin/insights/trigger.test.ts` for session-based pre-flight gating, derived `periodStart` (max covered completion ?? oldest available ?? now), and the first-run bound (FR-014).
- [ ] T008 [P] [US1] Extend `tests/unit/components/admin/insights/run-analysis-button.test.tsx` to assert the new refusal-code copy (`NO_CLAUDE_SESSIONS`/`NO_NEW_SESSIONS`).

### Implementation for User Story 1

- [ ] T009 [US1] Rewrite `app/lib/insights/predicate.ts` around ONE private inner query joining `Job → Ticket → Project` (no `TicketOutcome`, no project filter), applying effective-agent (`ticket.agent ?? project.defaultAgent ?? 'CLAUDE'`, P2/FR-009), terminal status, `JobLog` presence, completion timestamp (D3), and coverage exclusion. Export `countAnalyzableClaudeSessions()`, `listAnalyzableClaudeSessions(window, { ignoreCoverage })`, `countExpectedClaudeSessions(window)`, and `getEarliestClaudeSessionCompletion()`; keep the single-inner-query discipline so count == enumeration (P1, FR-001/002/003/016). Depends on T003.
- [ ] T010 [US1] Update `app/api/admin/insights/jobs/route.ts` to return ALL analyzable Claude sessions in the window (multiple per ticket, no SHIP filter) plus `expectedCount`, using the same predicate as pre-flight (contract admin-insights-api.md GET /jobs). Depends on T009.
- [ ] T011 [US1] Update `app/lib/insights/preflight.ts` to compute the snapshot from `countAnalyzableClaudeSessions()`/`countExpectedClaudeSessions()`, emit `analyzableSessions`/`expectedSessions`, and use refusal codes `NO_CLAUDE_SESSIONS`/`NO_NEW_SESSIONS` (gate keyed on `analyzableSessions > 0`). Depends on T009.
- [ ] T012 [US1] Update `app/api/admin/insights/preflight/route.ts` to pass through the new `PreflightSnapshot` shape (contract). Depends on T011.
- [ ] T013 [US1] Update `app/api/admin/insights/trigger/route.ts` to run the session-based pre-flight, map the new refusal codes to 409, and set `periodEnd = now` with `periodStart = derivePeriodStart()`; preserve the DB-insert-then-dispatch ordering with `markFailed` + Job delete on dispatch failure (P5) and the `ALREADY_RUNNING` mapping (P4). Depends on T011, T004.
- [ ] T014 [P] [US1] Update `app/lib/hooks/queries/use-insights-preflight.ts` (`InsightsPreflight` type fields: `analyzableSessions`, `expectedSessions`) and `components/admin/insights/run-analysis-button.tsx` refusal-code copy to match the new codes.

**Checkpoint**: An analysis run enumerates every captured Claude session of each ticket across all projects; pre-flight counts sessions. MVP is functional and independently testable.

---

## Phase 4: User Story 2 - No session lost or double-counted at the period boundary (Priority: P1)

**Goal**: A completed run advances per-session coverage for exactly the analyzed jobs (in-transaction); a failed run advances nothing; a boundary session is covered in exactly one run.

**Independent Test**: Run analysis A over a window, then run B over the following window with a session timestamped on the shared boundary; verify the session is covered in exactly one run, a covered session is never re-selected, and a FAILED run leaves its sessions eligible.

### Tests for User Story 2

- [ ] T015 [P] [US2] Extend `tests/integration/api/admin/insights/status-patch.test.ts`: COMPLETED writes one `InsightsSessionCoverage` row per `analyzedJobIds` entry; FAILED writes none (FR-007); a re-delivered COMPLETED PATCH is idempotent (no duplicate rows); `coverageGapReason = TRANSCRIPT_NOT_AVAILABLE` set iff `expectedSessionsCount > sessionsCount` (FR-012).
- [ ] T016 [P] [US2] Create `tests/integration/api/admin/insights/coverage.test.ts` (NEW): run A then B over consecutive windows — a boundary session appears in exactly one (US2 AC1/SC-002); a covered session is not re-selected (US2 AC2); after a FAILED run the intended sessions are picked up by the next run (US2 AC3/SC-003).
- [ ] T017 [P] [US2] Extend `tests/unit/lib/insights/reconcile.test.ts` to assert the timeout auto-FAIL of an orphaned RUNNING report writes no `InsightsSessionCoverage` rows (FR-007).

### Implementation for User Story 2

- [ ] T018 [US2] Update `app/api/admin/insights/reports/[id]/status/route.ts`: extend the COMPLETED Zod schema with `analyzedJobIds` (non-empty positive `number[]`, `length === sessionsCount`) and `expectedSessionsCount` (`>= sessionsCount`); inside the existing COMPLETED `$transaction` (atomic `updateMany WHERE id=? AND status='RUNNING'`, P3) set `expectedSessionsCount`, compute `coverageGapReason`, call `advanceCoverage(tx, id, analyzedJobIds)`, and cascade the linked Job via direct `updateMany` (P6); FAILED branch and the `count===0` idempotent no-op unchanged. Depends on T004.
- [ ] T019 [US2] Update `.github/workflows/insights-analyze.yml`: capture `expected_count` from `/jobs`, compute `analyzed_job_ids = jq -c '[.jobs[].jobId]' jobs.json`, and extend the COMPLETED PATCH payload with `expectedSessionsCount` and `analyzedJobIds` (workflows/insights-analyze-workflow.md); FAILED PATCH unchanged (no `analyzedJobIds`). Depends on T010, T018.

**Checkpoint**: Coverage is per-session, advances only on success, and survives failures — exactly-once across consecutive runs.

---

## Phase 5: User Story 5 - Analysis stays global across all projects (Priority: P1 — guardrail)

**Goal**: Guarantee selection never applies a single-project filter and spans every project (non-regression guardrail; enforced by the T009 predicate).

**Independent Test**: Seed in-scope Claude sessions across multiple projects in the window, run an analysis, and verify sessions from all projects are enumerated with no `projectId` filter.

### Tests for User Story 5

- [ ] T020 [P] [US5] Extend `tests/integration/api/admin/insights/effective-agent.test.ts` to assert: sessions from multiple projects are all enumerated by `/jobs` (no project scoping), and the pre-flight session count equals the enumerated session count for the same window (FR-016/SC-006). (No implementation task — guardrail is satisfied by the T009 single-inner-query predicate with no `projectId` filter.)

**Checkpoint**: Platform-wide global scope verified; no per-project regression.

---

## Phase 6: User Story 3 - Unshipped / in-progress / rolled-back sessions are covered (Priority: P2)

**Goal**: Sessions of non-shipped tickets become eligible for analysis and their raw transcripts are downloadable by the workflow (SHIP gate relaxed; Claude + path-traversal checks retained).

**Independent Test**: Seed a Claude ticket that never shipped (e.g. rolled back in VERIFY) with a captured transcript in the window; verify its session is enumerated and `/raw-native` returns 200 (previously 404).

### Tests for User Story 3

- [ ] T021 [P] [US3] Extend `tests/integration/api/admin/insights/jobs-raw-native.test.ts`: a Claude, unshipped ticket with a captured artifact now returns 200 (was 404); a non-Claude effective agent still returns 404; missing `rawArtifactKey` still 404 (US3 AC1).

### Implementation for User Story 3

- [ ] T022 [US3] Update `app/api/admin/insights/jobs/[jobId]/raw-native/route.ts` to remove the `if (!job.ticket.outcome) → 404` gate (current `route.ts:74-76`, FR-008) while keeping the Claude effective-agent check (P2) and `canonicalizeRawArtifactKey` path-traversal defense (P7). Selection-side non-shipped inclusion is already delivered by the T009 predicate.

**Checkpoint**: Unshipped/abandoned/rolled-back Claude sessions are selectable and retrievable.

---

## Phase 7: User Story 4 - Report shows analyzed-vs-expected and flags gaps (Priority: P2)

**Goal**: Surface analyzed vs expected session counts and a gap flag in the report-view metadata header and in the reports list serialization.

**Independent Test**: Run an analysis where some in-scope sessions lack a captured transcript; verify the report states analyzed and expected counts and flags the difference with a reason category; equal counts show full coverage.

### Tests for User Story 4

- [ ] T023 [P] [US4] Extend `tests/unit/components/admin/insights/insights-report-view.test.tsx`: header renders "Analyzed N of M Claude Code sessions" (US4 AC1); gap badge shown iff `coverageGapReason` is set (US4 AC2); full-coverage wording when `sessionsCount === expectedSessionsCount` (US4 AC3). Use `getByRole`/`getByText` + `renderWithProviders`.
- [ ] T024 [P] [US4] Extend `tests/integration/api/admin/insights/reports-list.test.ts` to assert `expectedSessionsCount` and `coverageGapReason` are serialized in the list/detail responses.

### Implementation for User Story 4

- [ ] T025 [US4] Update `components/admin/insights/insights-report-view.tsx`: rework `formatMetadataPhrasing` (`:45-57`) to "Analyzed N of M Claude Code sessions…", render a gap badge (existing shadcn `Badge`) when `coverageGapReason` is set, and change the "since previous run" header line to sessions wording (`:233-242`, FR-011/012/013).
- [ ] T026 [US4] Verify/extend `app/api/admin/insights/reports/route.ts` and `app/api/admin/insights/reports/[id]/route.ts` so `expectedSessionsCount` and `coverageGapReason` flow through to clients (the `toListEntry` field additions from T004 should propagate; add explicit mapping if the route shapes the payload directly). Depends on T004.

**Checkpoint**: Coverage gaps are visible and explainable in the UI; list/detail responses carry the new fields.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final verification and consistency across stories.

- [ ] T027 [P] Update `tests/e2e/admin/insights-flow.spec.ts` ONLY if header copy assertions changed (analyzed-vs-expected wording); no new E2E added (expensive — no new behavior needs a browser).
- [ ] T028 Run `bun run type-check` and `bun run lint` from the repository root and fix ALL errors before any commit (CLAUDE.md commit rules; never `--no-verify`).
- [ ] T029 Run `bun run test:unit tests/unit/lib/insights tests/unit/components/admin/insights` and `bun run test:integration tests/integration/api/admin/insights` to confirm the full insights suite (including the new `coverage.test.ts`) passes.
- [ ] T030 [P] If selection/coverage behavior changed any consolidated documentation, run `/ai-board.sync-specifications` to update `specs/specifications/`; otherwise note no sync needed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. T003 depends on T002; T004 depends on T003. BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Internal: T009 → T010/T011; T011 → T012/T013; T013 also depends on T004.
- **US2 (Phase 4)**: Depends on Foundational (T004) and on the US1 predicate (T009 supplies the coverage-exclusion filter). T019 depends on T010 + T018.
- **US5 (Phase 5)**: Depends on US1 (T009 predicate); test-only guardrail.
- **US3 (Phase 6)**: Depends on Foundational; selection already from US1. Route change (T022) is self-contained.
- **US4 (Phase 7)**: Depends on Foundational (T004) and on US2 (T018 stores `expectedSessionsCount`/`coverageGapReason`).
- **Polish (Phase 8)**: Depends on all desired stories.

### Within Each User Story

- Tests are written FIRST and must FAIL before implementation.
- Engine/predicate before routes; routes before workflow; data/server before UI.

### Parallel Opportunities

- Foundational: T004 is `[P]` relative to the migration once the client is generated.
- US1 tests T005–T008 run in parallel (distinct files); T014 is `[P]` (hook + button, distinct from server files).
- US2 tests T015–T017 run in parallel.
- US4 tests T023–T024 run in parallel.
- Once Foundational completes, US1/US3 share little surface and can largely proceed independently; US2 and US4 layer on top.

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together (distinct files, no shared state):
Task: "Rewrite tests/unit/lib/insights/predicate.test.ts"
Task: "Extend tests/integration/api/admin/insights/preflight.test.ts"
Task: "Extend tests/integration/api/admin/insights/trigger.test.ts"
Task: "Extend tests/unit/components/admin/insights/run-analysis-button.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (schema, migration, helpers — blocks everything).
3. Complete Phase 3: User Story 1 — every session of a ticket is selected/enumerated; pre-flight counts sessions.
4. **STOP and VALIDATE**: seed a multi-session ticket, run analysis, confirm all N sessions enumerated.

### Incremental Delivery

1. Foundational → US1 (MVP: all-sessions selection).
2. US2 (P1) → exactly-once coverage + boundary safety + failed-run re-eligibility.
3. US5 (P1 guardrail) → confirm global scope preserved.
4. US3 (P2) → unshipped sessions in scope.
5. US4 (P2) → analyzed-vs-expected reporting surface.
6. Each increment is independently testable and adds value without breaking prior stories.

---

## Notes

- `[P]` tasks = different files, no dependency on an incomplete task.
- `[Story]` label maps each task to its user story for traceability; Setup/Foundational/Polish carry no story label.
- Shared files are touched in exactly one story phase to avoid same-file conflicts: `predicate.ts`/`predicate.test.ts` (US1, also covers US3/US5 selection scenarios), `status/route.ts` (US2, also stores US4 counts), `repository.ts` (Foundational).
- Verify tests fail before implementing (constitution §III).
- Never use `--no-verify`; run `bunx prisma generate` after the schema change (T003).
</content>
</invoke>
