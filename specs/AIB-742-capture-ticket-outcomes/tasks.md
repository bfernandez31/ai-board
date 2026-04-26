---
description: "Implementation tasks for AIB-742 — Capture Ticket Outcomes at SHIP"
---

# Tasks: Capture Ticket Outcomes at SHIP for Analytics and Prediction Grounding

**Input**: Design documents from `/specs/AIB-742-capture-ticket-outcomes/`
**Prerequisites**: plan.md (loaded), spec.md (loaded), research.md (loaded), data-model.md (loaded), contracts/ (loaded)

**Tests**: Included by default per constitution §III.

**Organization**: Phases 3–6 group tasks by user story so each P1 story can be implemented and verified independently. Per research.md §"Existing Files" each test path is marked CREATE (new domain) or EXTEND (existing file owns the domain).

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Different file from siblings AND no dependency on an incomplete sibling — safe to run in parallel.
- **[Story]**: US1 / US2 / US3 / US4 (Setup, Foundational, Polish phases have no story label).
- File paths are absolute relative to repo root.

## Path Conventions
Single Next.js project. Source under `lib/`, `app/`, `prisma/`. Tests under `tests/unit/`, `tests/integration/`. New utilities live in `lib/outcomes/` (per plan.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, generated client, and shared types — required by every downstream phase.

- [X] T001 ✅ DONE Add `model TicketOutcome` and `model BackfillProgress` (with `enum BackfillStatus`) plus relation back-pointers on Ticket and Project in `prisma/schema.prisma` per data-model.md §Entity 1 / §Entity 2
- [X] T002 ✅ DONE Generate Prisma migration with `bunx prisma migrate dev --name ticket_outcomes` to create the migration directory `prisma/migrations/<timestamp>_ticket_outcomes/migration.sql`
- [X] T003 ✅ DONE Run `bunx prisma generate` to refresh the typed Prisma client (depends on T001, T002)
- [X] T004 ✅ DONE [P] Create `lib/outcomes/types.ts` exporting `RULE_SET_VERSION = 1`, `QUALITY_THRESHOLD_FRICTION_FREE = 75`, `PartialReason` union (`no_jobs | no_commit_reference | repository_unreachable | fetch_failed_after_retry`), and `DerivedOutcome` interface mirroring the Prisma model fields per data-model.md §TypeScript types
- [X] T005 ✅ DONE [P] Confirm a glob library is on the runtime classpath (`bun pm ls picomatch micromatch minimatch`); if none, `bun add picomatch` per research.md §Decision 7

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure logic + persistence guard that every user story depends on.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T006 ✅ DONE [P] Create `lib/outcomes/classification.ts` exporting `classifyJobByCommand(command: string)` (returns `'pipeline' | 'friction'`; friction iff prefix `iterate` or `comment-`), `aggregateJobCounts(jobs)` returning `{ pipelineJobCount, frictionJobCount, totalJobCount, jobCountByPrefix }`, and re-exporting `RULE_SET_VERSION` per workflows/capture-on-ship.md §Phase 3
- [X] T007 ✅ DONE [P] Create unit tests for the classifier in `tests/unit/outcomes/classification.test.ts` (NEW — no existing file covers job-command classification): cover `iterate`, `iterate-something`, `comment-build`, `comment-specify`, `specify`, `plan`, `verify`, `health-scan`, empty/null command, and the per-prefix breakdown invariant `pipeline + friction === total`
- [X] T008 ✅ DONE [P] Create `lib/outcomes/stack-indicator-lookup.ts` exporting the `STACK_INDICATORS` const (services/testing/languages/ci) per data-model.md §Entity 3 plus `deriveSemanticTags(files, projectConfig)` returning `{ touchedDbSchema, touchedTests, touchedCi }` (uses picomatch; missing stack entries fall through to `false` — never throws)
- [X] T009 ✅ DONE [P] Create unit tests for the lookup in `tests/unit/outcomes/stack-indicator-lookup.test.ts` (NEW): assert `matchesAny` semantics for `**`, brace patterns, and root-level files; assert that an unknown service/framework/language yields all-`false` tags rather than throwing (FR-009)
- [X] T010 ✅ DONE [P] Create `lib/outcomes/persist.ts` exporting `persistOutcome(derived: DerivedOutcome)` that runs Zod validation against the data-model.md invariants (e.g., `partial=true ⇒ partialReason!=null`, `pipeline+friction===total`, `frictionFree=true ⇒ frictionJobCount===0 && qualityScore>=75`) then `prisma.ticketOutcome.create({ data })` wrapped in a try/catch that swallows `e.code === 'P2002'` per research.md §"idempotency via unique constraint + P2002 catch"

**Checkpoint**: Pure derivation primitives + idempotent writer compile and unit-test green. User-story implementation can now begin in parallel.

---

## Phase 3: User Story 1 — Live capture of every shipped ticket's outcome (Priority: P1) 🎯 MVP

**Goal**: When any ticket transitions to SHIP, persist exactly one immutable `TicketOutcome` row aggregating job telemetry, classification, quality, change-shape, and `frictionFree` — without blocking the SHIP response.

**Independent Test**: Ship one fixture FULL ticket end-to-end with `TEST_MODE=true`; within minutes, `GET /api/projects/[projectId]/tickets/[ticketId]/outcome` returns the row with `partial=false` and all aggregate fields populated. A second SHIP call (or backfill pickup) for the same ticket leaves the row byte-identical (immutability).

### Tests for User Story 1

**NOTE: Write these tests FIRST and confirm they FAIL before implementation.**

- [X] T011 ✅ DONE [P] [US1] Create unit test for capture orchestration in `tests/unit/outcomes/capture.test.ts` (NEW — no existing capture-orchestrator file): mock `lib/outcomes/github-files.ts` and `lib/outcomes/persist.ts`; assert phases run in order, idempotency early-exit, partial-flag assignment per workflow §Phase 1–10
- [X] T012 ✅ DONE [P] [US1] Create unit test for change-shape derivation in `tests/unit/outcomes/derivation.test.ts` (NEW — distinct from `lib/comparison/implementation-metrics.ts` which is local-git-only): assert top-level domain extraction including root-empty segment, frequency map, `linesAdded/linesRemoved` accumulation across deduped files, `testCodeRatio = linesInTestPaths / max(total, 1)`
- [ ] T013 [P] [US1] Create integration test for live SHIP capture happy path in `tests/integration/outcome-capture-on-ship.test.ts` (NEW — outcome domain has no existing integration file per research.md): seed a FULL ticket with verify qualityScore=90, four pipeline jobs, two unique commit SHAs; trigger SHIP; assert one outcome row with `frictionFree=true`, `partial=false`, correct totals, and `ruleSetVersion=1` (US1 acceptance scenario 1)
- [ ] T014 [P] [US1] Create integration test for friction classification in `tests/integration/outcome-capture-on-ship.test.ts` (extends T013 file): seed a ticket with two `iterate` jobs and one `comment-build` job; assert `frictionJobCount>=3`, `frictionFree=false` regardless of qualityScore (US1 acceptance scenario 2)
- [ ] T015 [P] [US1] Create integration test for QUICK-workflow capture in `tests/integration/outcome-capture-on-ship.test.ts` (extends T013 file): seed a QUICK ticket; assert `workflowType='QUICK'`, `qualityScore=null`, `frictionFree=false` (US1 acceptance scenario 3)
- [ ] T016 [P] [US1] Create integration test for outcome immutability in `tests/integration/outcome-immutability.test.ts` (NEW): write an outcome row, invoke capture again for the same ticket, assert no row mutation (compare full row by deep-equal) and no error surfaced (US1 acceptance scenario 5; SC-008)
- [ ] T017 [P] [US1] Create integration test for partial-state paths in `tests/integration/outcome-partial-paths.test.ts` (NEW): three sub-cases — (a) ticket with zero jobs → `partialReason='no_jobs'`; (b) jobs with no `commitSha` → `partialReason='no_commit_reference'`; (c) Octokit failure after retries → `partialReason='fetch_failed_after_retry'`; assert change-shape fields null and job aggregates still populated (US1 acceptance scenario 4; spec edge cases)
- [ ] T018 [P] [US1] Create integration test for the by-ticket outcome read endpoint in `tests/integration/api-outcomes.test.ts` (NEW — separate from `api-tickets.test.ts` per research.md): cover 200 (row present), 404 with `code=OUTCOME_NOT_FOUND`, 401 unauthenticated, 403 non-member; assert PUT/PATCH/DELETE return 405 (immutability at HTTP layer per contracts/outcome-api.md §1)
- [ ] T019 [US1] Extend `tests/integration/tickets/transitions.test.ts` (existing — owns SHIP transition path) with the scenario "SHIP completes within budget when capture rejects": stub `captureOutcomeOnShip` to throw; assert SHIP response is still 200 and `Ticket.stage === 'SHIP'` (FR-019, SC-007)

### Implementation for User Story 1

- [X] T020 ✅ DONE [P] [US1] Implement `lib/outcomes/derivation.ts` exporting `extractChangeShape(files: { filename, additions, deletions }[], stackPatterns)` returning `{ filesTouched, linesAdded, linesRemoved, testCodeRatio, domains, domainFileCounts }`; preserves root-segment empty-string per spec edge case (workflows/capture-on-ship.md §Phases 6–7)
- [X] T021 ✅ DONE [P] [US1] Implement `lib/outcomes/github-files.ts` as Octokit `repos.getCommit` adapter with: `process.env.TEST_MODE === 'true'` short-circuit returning `{ files: [...] }` mock, `accessToken` arg falling back to `process.env.GITHUB_TOKEN`, retry policy `[1s, 4s, 16s]` for transient errors, distinguishing 404-on-repo (`repository_unreachable`) from 404-on-sha (skip but proceed) per workflows/capture-on-ship.md §Phase 5 — mirror the patterns in `lib/github/spec-fetcher.ts` and `lib/config-sync.ts`
- [X] T022 ✅ DONE [US1] Implement `lib/outcomes/capture.ts` exporting `captureOutcomeOnShip({ ticketId, projectId, workflowType, shippedAt })`: phases 1–10 from workflows/capture-on-ship.md, calling T006 classifier, T020 derivation, T008 lookup, T021 fetcher, T010 persist; computes `frictionFree = frictionJobCount===0 && qualityScore!=null && qualityScore>=75`; persists `partial=true` with the correct `partialReason` on each terminal failure path
- [X] T023 ✅ DONE [US1] Modify `lib/tickets/transition.ts` between the successful SHIP optimistic-update commit (currently around line 352) and the response return: insert `if (targetStage === Stage.SHIP) void captureOutcomeOnShip({ ... }).catch((err) => console.error('[outcome-capture] unhandled', { ticketId, err }))` per workflows/capture-on-ship.md §"Trigger surface"; do NOT `await` the call
- [X] T024 ✅ DONE [US1] Implement `app/api/projects/[projectId]/tickets/[ticketId]/outcome/route.ts` with a single `GET` export: parse path params, run `verifyTicketAccess(ticketId)`, `prisma.ticketOutcome.findUnique({ where: { ticketId } })`, return 200 with the row shape from contracts/outcome-api.md §1 or 404 `OUTCOME_NOT_FOUND`; do NOT export PUT/PATCH/DELETE

**Checkpoint**: A live ticket reaching SHIP results in an outcome row queryable by ticket id; immutability and partial-path branches are integration-tested green.

---

## Phase 4: User Story 2 — Generic stack-agnostic structural domain and semantic tagging (Priority: P1)

**Goal**: Outcomes for tickets on TypeScript/Next, Python, Go, Rust, and Zig projects produce correct `touched_db_schema`, `touched_tests`, `touched_ci` and structural-domain output without any per-project domain config.

**Independent Test**: Run capture on four fixture projects (TS, Python, Rust, Go) each touching a DB schema file, a test file, and a CI file appropriate to the stack; all three semantic tags are `true` on every outcome with no project-side config changes (US2 independent test).

### Tests for User Story 2

- [ ] T025 [P] [US2] Extend `tests/unit/outcomes/stack-indicator-lookup.test.ts` (created in T009) with multi-stack fixtures: Python (`migrations/0042.py` + `tests/test_x.py` + `.github/workflows/ci.yml`), Go (`migrations/*.sql` + `**/*_test.go`), Rust (`tests/foo.rs` + `**/*_test.rs`), Zig (`test_*.zig`); assert each stack returns the expected three booleans (US2 acceptance scenario 1, FR-009)
- [ ] T026 [P] [US2] Extend `tests/integration/outcome-capture-on-ship.test.ts` (created in T013) with multi-stack acceptance scenarios: (a) Python+postgres ticket touching `migrations/0042_add_field.py`, `tests/test_users.py`, `.github/workflows/ci.yml` → all three tags `true` (acceptance 1); (b) Rust ticket touching only `src/lib.rs` → all three tags `false`, `domains` includes `src` (acceptance 2); (c) TS ticket touching `app/api/foo.ts` and `lib/billing/charge.ts` → `domains` includes both `app` and `lib`, frequency map reflects file counts (acceptance 3)
- [ ] T027 [P] [US2] Extend `tests/integration/outcome-capture-on-ship.test.ts` (created in T013) with a "missing project stack declarations" scenario: project with `services`, `testing`, and `language` all absent from `Project.config`; assert capture succeeds with all three semantic tags `false` (no error per FR-009; spec edge case)

### Implementation for User Story 2

- [ ] T028 [US2] Verify and finalise the five-stack coverage in `lib/outcomes/stack-indicator-lookup.ts` (created in T008): ensure entries exist for `services.postgres/mysql/sqlite/mongodb`, `testing.vitest/jest/playwright/pytest/go-test/rust-test/zig-test`, `languages.typescript/javascript/python/go/rust/zig`, and `ci.generic` — exactly the keys in data-model.md §Entity 3
- [ ] T029 [US2] Wire `deriveSemanticTags` into `lib/outcomes/capture.ts` Phase 8 (T022 already calls it; this task confirms the project-config plumbing reads `project.config.project.language`, `project.config.project.framework`, `project.config.services[].type`, `project.config.testing.framework` from `Project.config` JSON without an extra GitHub round-trip per research.md §Decision 4)
- [ ] T030 [US2] In `lib/outcomes/capture.ts` Phase 1 startup, call `ensureFreshConfig(project)` (existing helper at `lib/config-sync.ts:193-204`) only when `Project.config` is null or stale, so semantic-tag derivation always runs against current stack metadata (workflows/capture-on-ship.md §Phase 5.3)

**Checkpoint**: Multi-stack tagging is verified in unit and integration tests; capture pipeline reads stack metadata exclusively from the DB.

---

## Phase 5: User Story 3 — Per-project backfill of historical shipped tickets (Priority: P1)

**Goal**: Operators trigger a per-project backfill that populates outcomes for every previously-shipped ticket, with idempotent re-runs, resumable cursor on interruption, and rate-limit-aware Octokit usage.

**Independent Test**: On a project with N shipped tickets, dispatch backfill twice — first run produces N outcome rows, second run is a no-op (`ticketsProcessed=0` increment); a simulated interruption mid-run is followed by a re-dispatch that resumes from `lastProcessedTicketId` (US3 independent test).

### Tests for User Story 3

- [ ] T031 [P] [US3] Create integration test for backfill idempotency in `tests/integration/backfill-outcomes.test.ts` (NEW): seed 5 shipped tickets without outcomes; invoke the backfill script entry point twice; assert the first run writes 5 rows, the second writes 0, both end with `BackfillProgress.status='COMPLETED'` (US3 acceptance scenarios 1–2; SC-005)
- [ ] T032 [P] [US3] Create integration test for backfill resume in `tests/integration/backfill-resume.test.ts` (NEW): seed 10 tickets, simulate interruption after 4 are processed by setting `BackfillProgress.lastProcessedTicketId` and exiting; re-invoke; assert only the remaining 6 are processed (US3 acceptance scenario 4)
- [ ] T033 [P] [US3] Create integration test for backfill partial rows in `tests/integration/backfill-outcomes.test.ts` (extends T031 file): seed tickets where some commit SHAs return 404; assert those receive `partial=true` rows while the rest are complete (US3 acceptance scenario 3)
- [ ] T034 [P] [US3] Create integration test for concurrent live capture during backfill in `tests/integration/backfill-outcomes.test.ts` (extends T031 file): start backfill, concurrently fire `captureOutcomeOnShip` for one of the in-flight ticket ids; assert exactly one row exists for that ticket and no error surfaces (US3 acceptance scenario 5; SC-009)
- [ ] T035 [P] [US3] Extend `tests/integration/api-outcomes.test.ts` (created in T018) with backfill API scenarios: POST 202 dispatch on first call, POST 409 `BACKFILL_IN_PROGRESS` on second call while running, POST 403 `OWNERSHIP_REQUIRED` for non-owner, GET status returns `NEVER_STARTED` sentinel when no row exists, GET status returns full progress when running (contracts/backfill-api.md §1, §2)

### Implementation for User Story 3

- [ ] T036 [P] [US3] Implement `scripts/backfill-outcomes.ts` (NEW — placed alongside the existing `scripts/pull-prod-project.ts`): CLI args `--project-id`, `--resume-cursor`; bootstrap DB + ensureFreshConfig; enumerate `Ticket` rows where `stage='SHIP' AND id < cursor AND NOT EXISTS (SELECT 1 FROM TicketOutcome ...)` ordered by `id DESC` paginated 100 at a time; per ticket call `captureOutcomeOnShip(...)` from `lib/outcomes/capture.ts` (workflows/backfill-outcomes.md §Phase 2–3)
- [ ] T037 [P] [US3] Add BackfillProgress optimistic-locking advance to `scripts/backfill-outcomes.ts` (created in T036): after each successful capture, `prisma.backfillProgress.updateMany({ where: { projectId, version: prevVersion }, data: { lastProcessedTicketId, ticketsProcessed: { increment: 1 }, ticketsWithPartial: { increment: partialDelta }, version: { increment: 1 } } })` per workflows/backfill-outcomes.md §Phase 3.4 — on `count===0` re-read and exit cleanly (mirrors `lib/config-sync.ts:151-179`)
- [ ] T038 [P] [US3] Add rate-limit detection-and-yield to `lib/outcomes/github-files.ts` (created in T021): inspect `x-ratelimit-remaining` and `x-ratelimit-reset` response headers; when remaining < 100, sleep until reset; on 403 with body matching `/(secondary )?rate limit/i` sleep then retry once (workflows/backfill-outcomes.md §Phase 4)
- [ ] T039 [P] [US3] Create `lib/workflows/dispatch-backfill-outcomes.ts` exporting `dispatchBackfillOutcomes(project, { resumeCursor })` that calls `octokit.actions.createWorkflowDispatch({ workflow_id: 'backfill-outcomes.yml', inputs: { project_id, resume_cursor } })` — mirror `lib/workflows/dispatch-onboard.ts` (existing pattern reference)
- [ ] T040 [P] [US3] Create `.github/workflows/backfill-outcomes.yml`: `workflow_dispatch` with `project_id` and `resume_cursor` inputs, `runs-on: ubuntu-latest`, `timeout-minutes: 360`, env `APP_URL`/`WORKFLOW_API_TOKEN`/`DATABASE_URL`/`GITHUB_TOKEN: ${{ secrets.GH_PAT }}`, steps: checkout, setup-bun 1.3.1, `bun install --frozen-lockfile`, `bunx prisma generate`, `bun run scripts/backfill-outcomes.ts --project-id ... --resume-cursor ...` (workflows/backfill-outcomes.md §"Workflow definition")
- [ ] T041 [US3] Implement `app/api/projects/[projectId]/backfill-outcomes/route.ts` POST handler: `verifyProjectOwnership(projectId)`; validate body `{ resume?: boolean }` with Zod; find or create `BackfillProgress`; reject with 409 `BACKFILL_IN_PROGRESS` when `status==='IN_PROGRESS'`; on `resume===false` reset cursor and counters with optimistic-lock update; call `dispatchBackfillOutcomes(...)` from T039; on dispatch failure mark `status='FAILED'` with `lastError` and return 500 `BACKFILL_DISPATCH_FAILED`; on success return 202 with progress shape per contracts/backfill-api.md §1
- [ ] T042 [US3] Implement `app/api/projects/[projectId]/backfill-outcomes/status/route.ts` GET handler: `verifyProjectAccess(projectId)`; if no `BackfillProgress` row return `{ status: 'NEVER_STARTED', ticketsRemaining }` where `ticketsRemaining = COUNT(Ticket WHERE stage='SHIP' AND NOT EXISTS outcome)`; otherwise return the full progress row plus `ticketsRemaining` per contracts/backfill-api.md §2

**Checkpoint**: Backfill workflow file present; script writes outcomes idempotently; resume-from-cursor verified; concurrent capture races resolve to exactly one row.

---

## Phase 6: User Story 4 — Queryable analytics over delivery patterns (Priority: P2)

**Goal**: Aggregate questions about delivery (frictionFree fraction, domain breakdowns, per-month SHIP cost) answerable in a single index-supported query against the outcome dataset.

**Independent Test**: Filter outcomes by project + `frictionFree=true` and by `domain=app`; results match a hand-computed expected count over a fixture dataset, returned in < 1 second per project (SC-003).

### Tests for User Story 4

- [ ] T043 [P] [US4] Extend `tests/integration/api-outcomes.test.ts` (created in T018) with list-endpoint scenarios: 200 default page (limit=100), filters `frictionFree=true|false`, `partial=true|false`, `domain=app`, `workflowType=FULL`, `since`/`until` ISO date filters, cursor pagination (`nextCursor` returned, last page returns `nextCursor=null`); 400 `VALIDATION_ERROR` for `limit>500` and malformed ISO dates (contracts/outcome-api.md §2; US4 acceptance scenarios 1–2)
- [ ] T044 [P] [US4] Extend `tests/integration/api-outcomes.test.ts` (created in T018) with the immutability-across-time scenario: insert an outcome dated > 30 days ago; assert it returns unchanged from both the by-ticket and the list endpoints (US4 acceptance scenario 3)

### Implementation for User Story 4

- [ ] T045 [US4] Implement `app/api/projects/[projectId]/outcomes/route.ts` GET handler: `verifyProjectAccess(projectId)`; parse query string with Zod (`frictionFree?`, `partial?`, `domain?`, `workflowType?`, `since?` ISO, `until?` ISO, `limit` 1–500 default 100, `cursor?`); `prisma.ticketOutcome.findMany` with the AND-composed filters, `where: domain ? { domains: { has: domain } }`, `orderBy: { id: 'desc' }`, `take: limit`, `cursor: cursor ? { id: cursor } : undefined`, `skip: cursor ? 1 : 0`; include `ticket: { select: { ticketKey: true } }` to denormalise `ticketKey` into the response per contracts/outcome-api.md §2
- [ ] T046 [P] [US4] Add additive helper `getOutcomeAggregates(projectId)` in `lib/analytics/queries.ts` returning `{ totalShipped, frictionFreeCount, partialCount, byDomain }` using the composite indexes declared in data-model.md (covers SC-003 < 1 s budget); leave existing exports untouched

**Checkpoint**: Filterable, paginated, index-supported list endpoint plus optional aggregates helper deliver the standalone analytics value of the dataset.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T047 [P] Add structured per-phase log lines (`[outcome-capture] phase=N ticketId=… durationMs=…`) inside `lib/outcomes/capture.ts` (T022) per workflows/capture-on-ship.md §Observability — preserves SC-007 measurability via `capturedAt - shippedAt`
- [ ] T048 [P] Verify `bun run type-check` and `bun run lint` succeed against the full diff and fix any new errors before commit (per CLAUDE.md commit rules)
- [ ] T049 SC-007 smoke check: ship a fixture ticket against the local dev server with `TEST_MODE=true`, measure SHIP API response latency before/after the `void captureOutcomeOnShip(...)` insertion in `lib/tickets/transition.ts` (T023); assert p95 increase ≤ 50 ms

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → T003 sequential. T004 and T005 parallel with each other; T004 depends on T003 only for typed Prisma imports.
- **Foundational (Phase 2)**: Depends on Phase 1 complete. T006/T008/T010 parallel (different files); T007/T009 parallel test creations also independent.
- **User Stories (Phase 3–6)**: All depend on Phase 2.
  - US1, US2, US3 are all P1 — can run in parallel after foundational, but US2 sequencing benefits from US1's `capture.ts` existing (the wiring tasks T029/T030 modify `capture.ts` after T022). US3 depends on US1's `capture.ts` and `github-files.ts` because the backfill script and rate-limit logic call them.
  - US4 (P2) depends on outcome rows existing in the DB (so US1 must be live), but its endpoint can be implemented in parallel with US3 once US1 is in.
- **Polish (Phase 7)**: After all desired user stories are complete.

### User Story Dependencies

- **US1 (P1, MVP)**: Foundational only. Independent.
- **US2 (P1)**: Depends on `lib/outcomes/capture.ts` and `lib/outcomes/stack-indicator-lookup.ts` from US1 + Foundational. Tests can be written in parallel; final wiring tasks (T029, T030) come after T022.
- **US3 (P1)**: Depends on US1's `lib/outcomes/capture.ts` (T022) and `lib/outcomes/github-files.ts` (T021) since the backfill script reuses them.
- **US4 (P2)**: Depends on `TicketOutcome` rows existing — i.e., on US1's capture pipeline. The endpoint code itself only needs the Prisma model from Foundational.

### Within Each User Story

- Tests written first and observed FAILing before implementation (constitution §III).
- Pure modules before orchestrator: T020 (derivation), T021 (github-files) before T022 (capture).
- Orchestrator before route handler: T022 before T024.
- API route before route-handler test pass.

### Parallel Opportunities

- Setup: T004 parallel with T005 after T003.
- Foundational: T006/T008/T010 (source files) parallel; T007/T009 (test files) parallel; all six can run concurrently after Phase 1.
- US1: T011/T012/T013/T014/T015/T016/T017/T018 (test files) can be written together; T020/T021 (different source files) can be written together; T022 sequential after T020+T021; T023 sequential after T022; T024 parallel with T023.
- US2: T025/T026/T027 (test additions) parallel; T028 trivial; T029/T030 sequential after T022 since they modify the same `lib/outcomes/capture.ts`.
- US3: T031–T035 (test files) parallel; T036/T038/T039/T040 (different source files) parallel; T037 modifies the same script as T036 so sequential; T041/T042 parallel with each other after T039; T040.
- US4: T043/T044 parallel; T045 sequential; T046 parallel with T045.

---

## Parallel Example: User Story 1

```bash
# Phase 3 — write the failing tests in parallel:
Task: "Create unit test for capture orchestration in tests/unit/outcomes/capture.test.ts"
Task: "Create unit test for change-shape derivation in tests/unit/outcomes/derivation.test.ts"
Task: "Create integration test for SHIP capture happy path in tests/integration/outcome-capture-on-ship.test.ts"
Task: "Create integration test for outcome immutability in tests/integration/outcome-immutability.test.ts"
Task: "Create integration test for partial-state paths in tests/integration/outcome-partial-paths.test.ts"
Task: "Create integration test for the by-ticket outcome read endpoint in tests/integration/api-outcomes.test.ts"

# Phase 3 — implement the pure modules in parallel:
Task: "Implement lib/outcomes/derivation.ts"
Task: "Implement lib/outcomes/github-files.ts"
```

## Parallel Example: User Story 3

```bash
# Phase 5 — write failing tests in parallel:
Task: "Create integration test for backfill idempotency in tests/integration/backfill-outcomes.test.ts"
Task: "Create integration test for backfill resume in tests/integration/backfill-resume.test.ts"
Task: "Extend tests/integration/api-outcomes.test.ts with backfill API scenarios"

# Phase 5 — implement non-conflicting source files in parallel:
Task: "Implement scripts/backfill-outcomes.ts"
Task: "Add rate-limit detection-and-yield to lib/outcomes/github-files.ts"
Task: "Create lib/workflows/dispatch-backfill-outcomes.ts"
Task: "Create .github/workflows/backfill-outcomes.yml"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup): T001–T005 — schema, migration, types, glob lib.
2. Phase 2 (Foundational): T006–T010 — classification, lookup, persistence guard.
3. Phase 3 (US1): T011–T024 — live capture pipeline plus the by-ticket read endpoint.
4. **STOP and VALIDATE** with the US1 independent test: ship one fixture ticket; assert outcome row appears within minutes; second ship leaves the row unchanged.
5. The platform now captures every new SHIP — historical data is the next priority.

### Incremental Delivery

1. Setup + Foundational → Capture/derivation primitives ready.
2. Add US1 → MVP: every new SHIP produces an outcome row. Deploy.
3. Add US2 → Multi-stack tagging verified across TS/Python/Go/Rust/Zig fixtures. Deploy.
4. Add US3 → Backfill workflow available; operators run it per-project. Deploy.
5. Add US4 → List endpoint + aggregates helper unlock the analytics value. Deploy.
6. Polish (Phase 7) — observability and SLO smoke check.

### Parallel Execution Strategy

Once Phase 2 completes, three P1 stories can be developed concurrently by separate agents:

- Agent A: US1 (live capture + by-ticket endpoint).
- Agent B (after US1's `lib/outcomes/capture.ts` lands): US2 wiring tests + multi-stack assertions.
- Agent C (after US1's `lib/outcomes/capture.ts` and `github-files.ts` land): US3 backfill script + workflow + API.

US4 is best done after US1 is integration-test green, by either agent.

---

## Notes

- [P] tasks operate on distinct files with no incomplete-sibling dependencies.
- [Story] labels appear on Phase 3–6 tasks only; Setup, Foundational, and Polish phases are unlabelled per template rules.
- Every task references an exact file path. Test paths follow research.md §"Existing Files" (CREATE vs EXTEND); no path is invented.
- Verify each new test FAILs before its corresponding implementation lands.
- Commit after each user-story checkpoint; pre-commit hook runs `bun run type-check` and `bun run lint` (CLAUDE.md commit rules — never `--no-verify`).
- Constitution §III applies: integration tests use real Prisma against the test database; the GitHub HTTP layer is mocked exclusively via `process.env.TEST_MODE === 'true'`.
- No E2E tests required: the feature has no browser-facing flow.
