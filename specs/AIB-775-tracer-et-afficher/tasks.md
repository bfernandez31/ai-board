# Tasks: Track and display plugin/agent CLI versions per job (AIB-775)

**Input**: Design documents from `/specs/AIB-775-tracer-et-afficher/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution).

**Organization**: Tasks are grouped by user story (US1 P1, US2 P2, US3 P3) so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Maps task to a spec.md user story (US1, US2, US3)
- File paths below are absolute or repo-relative and have been verified against the current filesystem (research.md §2 "Existing Files")

---

## Phase 1: Setup (Schema migration)

**Purpose**: Persist the two new optional version columns on `Job` so the rest of the stack can read/write them.

- [ ] T001 Add `pluginVersion String? @db.VarChar(100)` and `agentCliVersion String? @db.VarChar(100)` to the `Job` model in `prisma/schema.prisma` (existing model lines 29-75)
- [ ] T002 Generate the migration via `bunx prisma migrate dev --name add_job_versions` (creates `prisma/migrations/<timestamp>_add_job_versions/migration.sql`)
- [ ] T003 Run `bunx prisma generate` to refresh `@prisma/client` types so `Job.pluginVersion` / `Job.agentCliVersion` are available across the codebase

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared TypeScript surface and Zod validator that every user story depends on.

**⚠️ CRITICAL**: No user story work begins until Phase 2 is complete.

- [ ] T004 [P] Extend the `TicketJobWithTelemetry` interface in `lib/types/job-types.ts` (existing lines 55-76) by appending `pluginVersion: string | null;` and `agentCliVersion: string | null;` so the wider GET payload flows through `TicketStats` → `JobsTimeline` → `JobRow` without further type edits
- [ ] T005 [P] Create the Zod validator at `app/lib/job-versions-validator.ts` exporting `jobVersionsUpdateSchema` — each field `z.string().trim().min(1).max(100).optional()`, plus a `.refine` guaranteeing at least one of `pluginVersion`/`agentCliVersion` is provided (constitution §IV: `max(100)` mirrors `@db.VarChar(100)`)

**Checkpoint**: Foundation ready — user story work can now begin.

---

## Phase 3: User Story 1 - Inspecter les versions actives sur un job récent (Priority: P1) 🎯 MVP

**Goal**: An operator opens the detail panel of a job that just ran and sees the exact AI-Board plugin version and agent CLI version active for that run, in the same execution-metrics zone as model/tokens/duration/cost.

**Independent Test**: Launch a fresh job on a test ticket, open its detail panel, and verify both versions appear next to the existing execution metrics.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
**RULE (constitution): "Search existing tests FIRST — extend, don't duplicate." File paths below come from research.md §2.6.**

- [ ] T006 [P] [US1] Create endpoint integration tests in `tests/integration/api/jobs/versions-post.test.ts` (new file — no existing file owns this domain; mirrors AIB-715's `logs-post.test.ts` naming) covering: 401 on missing/invalid `Authorization` bearer; 400 on Zod violation (empty string, >100 chars, neither field provided); 404 on unknown job ID; 200 success returns `{ id, pluginVersion, agentCliVersion }`; first-write-wins (a second POST with different values returns the originally stored values)
- [ ] T007 [US1] Extend the existing `describe('GET /api/projects/:projectId/tickets/:id/jobs')` in `tests/integration/jobs/ticket-jobs.test.ts` with a new `it('exposes pluginVersion and agentCliVersion through the GET payload', …)` that seeds versions through the new POST endpoint and asserts both fields are returned by the GET round-trip
- [ ] T008 [US1] Extend `tests/unit/components/jobs-timeline.test.tsx` — first grow the local `makeJob()` factory (lines 18-42) with `pluginVersion: null, agentCliVersion: null` defaults so existing tests still pass — then add an `it(…)` case asserting both version values render with no `title` attribute when both fields are set

### Implementation for User Story 1

- [ ] T009 [US1] Create the POST handler at `app/api/jobs/[id]/versions/route.ts` mirroring the recipe from `app/api/jobs/[id]/status/route.ts:46-326`: call `validateWorkflowAuth`, parse the path param with `parseInt`, Zod-parse the body via `jobVersionsUpdateSchema` (T005), `prisma.job.findUnique({ select: { id, pluginVersion, agentCliVersion } })` for 404 check, build first-write-wins `updateData` per `data-model.md` §"Immutability", `prisma.job.update`, return `{ id, pluginVersion, agentCliVersion }`; structured `{ error, details? }` envelopes; `console.error('[Job Versions] …')` log prefix
- [ ] T010 [US1] Extend the GET handler at `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` to include `pluginVersion` and `agentCliVersion` in the Prisma `select` so they appear on every element of the returned `TicketJobWithTelemetry[]`
- [ ] T011 [US1] Extend `components/ticket/jobs-timeline.tsx` `JobRow` (existing lines 81-308) — inside the breakdown grid (`<div className="grid grid-cols-2 gap-4 text-sm">`, lines 201-244) add two new rows: `Plugin Version` and `CLI Version`, each rendering `job.pluginVersion ?? '-'` / `job.agentCliVersion ?? '-'` with `title="Non disponible"` only when the value is null, using `text-ctp-overlay0` for labels and `text-foreground font-medium` for values (matches surrounding rows); ALSO widen the `hasTelemetry` predicate at line 100 to include `job.pluginVersion != null || job.agentCliVersion != null` so jobs with versions but no telemetry still expand
- [ ] T012 [P] [US1] Create the runner script `.github/scripts/capture-versions.sh` per `specs/AIB-775-tracer-et-afficher/workflows/version-capture-script.md` — `set -o pipefail` only (NO `set -e`), REQUIRED_VARS guard (`JOB_ID`, `APP_URL`, `WORKFLOW_API_TOKEN`, `AGENT_TYPE`), plugin-version probe (`jq -r '.version' .claude-plugin/plugin.json` then `git rev-parse --short HEAD` fallback prefixed `sha:`), per-agent CLI install (60 s timeout) + `<cli> --version` probe (5 s timeout) for `CLAUDE|CODEX|GEMINI|MISTRAL`, build conditional payload omitting empty fields, POST to `${APP_URL}/api/jobs/${JOB_ID}/versions` with `Authorization: Bearer ${WORKFLOW_API_TOKEN}` and 3-attempt 1/2/4 s backoff, always `exit 0`; mark executable (`chmod +x`)
- [ ] T013 [US1] Insert a new `- name: Capture Plugin/CLI Versions` step in `.github/workflows/verify.yml` after "Update Job Status - Running" (lines 205-218) and after "Checkout ai-board (sparse - plugin only)" (lines 263-271), gated only on `if: ${{ inputs.job_id }}` (NOT `SKIP_EXECUTION`), env `JOB_ID/APP_URL/WORKFLOW_API_TOKEN/AGENT_TYPE`, `run: bash ai-board/.github/scripts/capture-versions.sh`

**Checkpoint**: User Story 1 is fully functional — a fresh `verify` run captures and displays both versions in the job detail panel.

---

## Phase 4: User Story 2 - Comprendre qu'une version est absente sans avoir l'impression d'un bug (Priority: P2)

**Goal**: When a version is missing (legacy job or capture failure), the panel shows a discrete em-dash placeholder with a "Non disponible" tooltip — never an empty field, never "undefined", never an error.

**Independent Test**: Open a pre-feature job (or simulate a capture failure) and verify the panel shows the placeholder with the tooltip — no error, no empty cell.

### Tests for User Story 2

**NOTE: The implementation in T011 already handles null rendering. These tests pin the contract.**

- [ ] T014 [US2] Extend `tests/unit/components/jobs-timeline.test.tsx` with an `it(…)` case asserting that when `pluginVersion` and `agentCliVersion` are both `null` the rows render `'-'` and the wrapping element carries `title="Non disponible"` (covers US-2 #1 and US-2 #2 — pre-feature job and capture failure render identically)
- [ ] T015 [US2] Extend `tests/unit/components/jobs-timeline.test.tsx` with an `it(…)` case asserting partial-null rendering: when only `pluginVersion` is set, the plugin row shows the captured value with no `title` attribute and the CLI row shows `'-'` with `title="Non disponible"` (covers US-2 #3)

### Implementation for User Story 2

*(No new implementation required — T011's conditional render and `title` logic already cover all three null scenarios. This phase is verification-only.)*

**Checkpoint**: User Story 2 is fully covered by the rendering pinned in T014/T015 against the implementation from T011.

---

## Phase 5: User Story 3 - Tracer la version pour les futures analyses comparatives (Priority: P3)

**Goal**: Every job started after this feature ships — across all four supported agents — has both version fields populated in storage, so future comparison/analytics features can rely on the data being there.

**Independent Test**: Launch jobs on each of the four agents (CLAUDE, CODEX, GEMINI, MISTRAL) and verify (via UI or API) that each job has both version fields populated.

### Tests for User Story 3

- [ ] T016 [US3] Extend `tests/integration/api/jobs/versions-post.test.ts` with an `it(…)` case that creates one job per supported agent (CLAUDE, CODEX, MISTRAL, GEMINI) and asserts the POST endpoint accepts the same payload shape on each, regardless of the underlying `agent` field (covers US-3 #1 — all four agents)
- [ ] T017 [US3] Extend `tests/integration/api/jobs/versions-post.test.ts` with an `it(…)` case asserting versions are visible immediately after the POST while the job is still in a non-terminal state (RUNNING) — i.e. the GET payload exposes them without waiting for the job to complete (covers US-3 #2 — visible at start, not only at end)

### Implementation for User Story 3

- [ ] T018 [P] [US3] Insert the "Capture Plugin/CLI Versions" step in `.github/workflows/speckit.yml` at the same anchors and with the same shape as T013
- [ ] T019 [P] [US3] Insert the "Capture Plugin/CLI Versions" step in `.github/workflows/quick-impl.yml` at the same anchors and with the same shape as T013
- [ ] T020 [P] [US3] Insert the "Capture Plugin/CLI Versions" step in `.github/workflows/iterate.yml` at the same anchors and with the same shape as T013
- [ ] T021 [P] [US3] Insert the "Capture Plugin/CLI Versions" step in `.github/workflows/ai-board-assist.yml` at the same anchors and with the same shape as T013

**Checkpoint**: All four agents covered across the five agent-running workflows. The data-collection invariant for future comparative analyses is satisfied.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Repository-wide quality gates required by the constitution and CLAUDE.md before commit.

- [ ] T022 Run `bun run type-check` and fix any TypeScript errors surfaced by the new `Job.pluginVersion`/`agentCliVersion` columns flowing through `lib/types/job-types.ts` and the route handlers
- [ ] T023 Run `bun run lint` and fix any ESLint errors in the new/extended files (`app/api/jobs/[id]/versions/route.ts`, `app/lib/job-versions-validator.ts`, `app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`, `lib/types/job-types.ts`, `components/ticket/jobs-timeline.tsx`, the three test files)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — must complete before anything else (Prisma client must reflect the new columns)
- **Foundational (Phase 2)**: Depends on Phase 1 (T004 imports the regenerated Prisma `Job` type indirectly via the existing `TicketJobWithTelemetry`; T005 has no Prisma dep)
- **User Story 1 (Phase 3, P1)**: Depends on Phase 2; delivers MVP
- **User Story 2 (Phase 4, P2)**: Depends on T011 (US1 implementation) — null rendering lives there; T014/T015 are pure test extensions
- **User Story 3 (Phase 5, P3)**: Depends on T012 (the script) and T006 (the endpoint test file) — T018-T021 reuse the script created in T012
- **Polish (Phase 6)**: Runs last, after all desired stories are complete

### Within Each User Story

- Tests are written before the implementation that satisfies them (constitution §III)
- T009 (endpoint impl) must come after T005 (Zod validator) and T006 (failing endpoint tests)
- T011 (UI impl) must come after T008 (failing UI test)
- T013 cannot run until T012 has produced the script
- T010 (GET extension) is independent of the UI work and can run alongside T011 if executed by separate workers

### Parallel Opportunities

- **Within Phase 2**: T004 and T005 touch different files → both `[P]`
- **Within US1 tests**: T006 (new endpoint test file) is `[P]`; T007 and T008 touch different existing test files → could be `[P]` with T006, but T007/T008 cannot be marked `[P]` together because each is the only writer to its respective file in this batch (and the format only adds `[P]` when there's actually a parallel partner; here T006 is the partner for either)
- **Within US1 implementation**: T012 (bash script) is independent of T009/T010/T011 → marked `[P]`. T009 → T010 (different files but T009 must compile before integration test in T007 passes); T011 changes a different file
- **Within US3 implementation**: T018, T019, T020, T021 each touch a different workflow YAML → all `[P]`

---

## Parallel Example: User Story 3 implementation

```bash
# Once T012 (script) and T013 (verify.yml integration) are done,
# the four remaining workflow integrations can run in parallel:
Task: "Insert capture step in .github/workflows/speckit.yml" (T018)
Task: "Insert capture step in .github/workflows/quick-impl.yml" (T019)
Task: "Insert capture step in .github/workflows/iterate.yml" (T020)
Task: "Insert capture step in .github/workflows/ai-board-assist.yml" (T021)
```

## Parallel Example: Phase 2 Foundational

```bash
Task: "Extend TicketJobWithTelemetry in lib/types/job-types.ts" (T004)
Task: "Create Zod validator app/lib/job-versions-validator.ts" (T005)
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 (Setup): schema + migration + `prisma generate` (T001-T003)
2. Complete Phase 2 (Foundational): types + validator (T004-T005)
3. Complete Phase 3 (User Story 1): endpoint, GET extension, UI, capture script, `verify.yml` wiring (T006-T013)
4. **STOP and VALIDATE**: launch one verify job and confirm both versions appear in the panel
5. Run `type-check` + `lint` (early polish pass) and ship MVP

### Incremental Delivery

1. **MVP** (Phase 1 + 2 + US1) → versions visible on every fresh `verify` run
2. **+ US2** (Phase 4 — pure test additions) → null/partial rendering pinned by tests
3. **+ US3** (Phase 5 — propagate the capture step to the four remaining workflows) → all four agents and all five workflows covered
4. **Polish** (Phase 6) → green type-check + lint before commit

### Parallel Execution Strategy

ai-board can shard work across stories once Foundational is green:

1. After T005 lands, one worker takes US1 (T006-T013) while a second worker prepares US3 workflow edits (T018-T021) using the script signature from T012's contract
2. US2 (T014-T015) can run in parallel with US3 since they touch disjoint files (component test vs. workflow YAML)
3. Polish gates run last on the merged result

---

## Notes

- `[P]` tasks = different files, no dependencies on incomplete tasks in the same batch
- `[Story]` label maps each task to its spec.md user story for traceability
- Each user story is independently completable and independently testable
- TDD: each user-story phase opens with tests that FAIL before implementation lands
- File paths above are real (verified against current repo state); the only "NEW" files are `app/api/jobs/[id]/versions/route.ts`, `app/lib/job-versions-validator.ts`, `tests/integration/api/jobs/versions-post.test.ts`, and `.github/scripts/capture-versions.sh` — each justified in research.md §2 because no existing file owns its domain
- Commit after each task or logical group; never use `--no-verify` (CLAUDE.md)
- The bash capture script has no Vitest counterpart by design — its API contract is fully exercised by T006/T007/T016/T017 against the real endpoint, and the script's invariants are documented in `workflows/version-capture-script.md` for human review (research.md §3.2)
