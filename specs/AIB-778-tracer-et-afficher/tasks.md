---
description: "Task list for AIB-778: Track and display plugin and agent CLI version per job"
---

# Tasks: Track and display plugin and agent CLI version per job

**Input**: Design documents from `/specs/AIB-778-tracer-et-afficher/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/job-status-api.md ✅, workflows/version-capture.md ✅

**Tests**: Test tasks are included by default (constitution §III). All test tasks EXTEND existing test files per "Search existing tests FIRST" rule — no new test files are created.

**Organization**: Tasks are grouped by user story (US1, US2, US3) so each story can be implemented and verified independently. US1 (UI) and US2 (capture/persistence) are both P1 and tightly coupled but each is independently testable behind seam mocks.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3) — only on user-story-phase tasks
- Include exact file paths in descriptions

## Path Conventions

Single Next.js repo (existing):
- Schema: `prisma/schema.prisma` + `prisma/migrations/`
- API routes: `app/api/**`
- Validators: `app/lib/`
- UI: `components/ticket/`, types: `lib/types/`
- Runner: `.github/scripts/run-agent.sh`
- Workflows: `.github/workflows/*.yml`
- Tests: `tests/unit/`, `tests/unit/components/`, `tests/unit/scripts/`, `tests/integration/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Generate Prisma artifacts so the new columns are available to typed code in subsequent phases.

- [X] T001 Add `pluginVersion String? @db.VarChar(40)` and `agentCliVersion String? @db.VarChar(40)` to the `Job` model in prisma/schema.prisma
- [X] T002 Generate the Prisma migration file at prisma/migrations/<timestamp>_add_job_runtime_versions/migration.sql by running `bunx prisma migrate dev --name add_job_runtime_versions` (verify SQL adds two nullable VARCHAR(40) columns to the `jobs` table, no default, no index)
- [X] T003 Regenerate the Prisma client by running `bunx prisma generate` so `pluginVersion` and `agentCliVersion` appear on the typed `Job` model

**Checkpoint**: Schema + typed client ready; downstream tasks can import the new fields.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend the shared validator and the type contract so both the API persistence path (US2) and the UI display path (US1) can be implemented in parallel without race-merging the same files later.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 [P] Extend `jobStatusUpdateSchema` in app/lib/job-update-validator.ts to add `pluginVersion: z.string().min(1).max(40).optional()` and `agentCliVersion: z.string().min(1).max(40).optional()` (alongside existing `workflowRunId`)
- [X] T005 [P] Extend the `TicketJobWithTelemetry` interface in lib/types/job-types.ts to add `pluginVersion: string | null;` and `agentCliVersion: string | null;` (group with the other nullable string metric fields)

**Checkpoint**: Foundational types ready — US1 and US2 can now proceed in parallel.

---

## Phase 3: User Story 2 - Persist plugin and agent CLI version with every new job (Priority: P1) 🎯 MVP-Backbone

**Goal**: For every job started after the feature ships, capture the plugin manifest version and the agent CLI version inside the runner and persist both on the `Job` record on the existing RUNNING transition. Capture is per-agent (CLAUDE/CODEX/GEMINI/MISTRAL) and never blocks the job on failure.

**Independent Test**: Trigger a job for each of the 4 supported agents; confirm the `Job` row contains a non-null `pluginVersion` and `agentCliVersion` after the RUNNING PATCH lands. Simulate a missing CLI binary or a missing manifest and confirm the corresponding column stays NULL while the job continues to its normal terminal status.

### Tests for User Story 2

**NOTE: Write these tests FIRST, ensure they FAIL before implementation. All extend existing files (constitution §III).**

- [X] T006 [P] [US2] Extend tests/unit/scripts/run-command.test.ts with two cases: (a) `read_plugin_version` returns the trimmed `.version` from a fixture `.claude-plugin/plugin.json`; (b) `read_plugin_version` returns empty string (and exits 0) when the manifest file is missing
- [X] T007 [P] [US2] Extend tests/unit/scripts/run-command.test.ts with two more cases: (a) per-agent capture wrapper returns the trimmed first line of `--version` output; (b) per-agent capture wrapper returns empty string when the binary is missing on PATH (no exit non-zero)
- [X] T008 [P] [US2] Extend tests/integration/jobs/status.test.ts with a "persists pluginVersion and agentCliVersion on RUNNING transition" case: PATCH `{status:'RUNNING', workflowRunId, pluginVersion:'1.0.1', agentCliVersion:'1.0.92 (Claude Code)'}` returns 200 and a follow-up `prisma.job.findUnique` shows both columns populated
- [X] T009 [P] [US2] Extend tests/integration/jobs/status.test.ts with a "rejects oversize version strings" case: PATCH with `agentCliVersion` of length 41 returns 400 with a Zod error
- [X] T010 [P] [US2] Extend tests/integration/jobs/status.test.ts with a "first-write-wins on retried RUNNING PATCH" case: first PATCH with versions `A`/`B` populates columns; second PATCH with `C`/`D` does not overwrite (DB still shows `A`/`B`)
- [X] T011 [P] [US2] Extend tests/integration/jobs/status.test.ts with a "non-RUNNING transitions ignore version fields" case: PATCH with `{status:'COMPLETED', pluginVersion:'X', agentCliVersion:'Y'}` does not write the columns

### Implementation for User Story 2

- [X] T012 [US2] Extend the PATCH handler in app/api/jobs/[id]/status/route.ts: add `pluginVersion: true, agentCliVersion: true` to the existing `findUnique` `select` (~lines 117-123) so the first-write-wins guard can read prior values
- [X] T013 [US2] In app/api/jobs/[id]/status/route.ts extend the `updateData` type literal (~lines 188-197) with `pluginVersion?: string;` and `agentCliVersion?: string;`
- [X] T014 [US2] In app/api/jobs/[id]/status/route.ts add the first-write-wins persistence block immediately after the existing `workflowRunId` block (~line 204): write `updateData.pluginVersion` only when `requestedStatus === 'RUNNING'`, the body field is present, and the existing column is null; same shape for `agentCliVersion`. Both fields are persisted by the same atomic `prisma.job.updateMany({ where: { id, status: currentStatus }, data: updateData })` call (existing line 223) — no extra DB round trip
- [X] T015 [US2] In app/api/jobs/[id]/status/route.ts extend the existing `console.log('[Job Status Update] Success:', …)` (~lines 266-271) to include `pluginVersion` and `agentCliVersion` when present, so operators can confirm capture
- [X] T016 [US2] Extend the GET handler in app/api/projects/[projectId]/tickets/[id]/jobs/route.ts: add `pluginVersion: true, agentCliVersion: true` to the `select` clause (~lines 128-160) so the values are exposed alongside other telemetry
- [X] T017 [US2] In .github/scripts/run-agent.sh add the `read_plugin_version` helper near the other top-level helpers: read `.claude-plugin/plugin.json`, return trimmed `.version` (≤40 chars) on stdout, return empty string on missing file or missing field; log via `log_info` (NOT `log_error`); never exit non-zero
- [X] T018 [US2] In .github/scripts/run-agent.sh add four per-agent helpers `capture_claude_version`, `capture_codex_version`, `capture_mistral_version`, `capture_gemini_version` next to their respective `install_*` functions (~lines 364-689); each calls `<binary> --version 2>/dev/null | head -1 | tr -d '\n' | cut -c1-40` and prints to stdout; empty stdout on failure
- [X] T019 [US2] In .github/scripts/run-agent.sh modify `dispatch_agent` (~lines 759-795): set `PLUGIN_VERSION="$(read_plugin_version)"` once before the case switch; in each agent branch set `AGENT_CLI_VERSION="$(capture_<agent>_version)"` between the `install_*`/`auth_*` step and the `invoke_*` step; preserve the existing GEMINI exit-code propagation pattern
- [X] T020 [US2] In .github/scripts/run-agent.sh export the captured values to the parent workflow: append `PLUGIN_VERSION=…` and `AGENT_CLI_VERSION=…` to `$GITHUB_ENV` after `dispatch_agent` completes (success or failure path), guarded by `[[ -n "${GITHUB_ENV:-}" ]]`
- [X] T021 [P] [US2] Add the new "Update Job Versions" step (Option B' from workflows/version-capture.md) AFTER the run-agent invocation in .github/workflows/speckit.yml, gated `if: always() && inputs.job_id && (env.PLUGIN_VERSION != '' || env.AGENT_CLI_VERSION != '')`; build the JSON body with `jq -nc` so empty vars become absent fields; PATCH the existing `/api/jobs/:id/status` endpoint with `|| true` (best-effort)
- [X] T022 [P] [US2] Add the same "Update Job Versions" step in .github/workflows/verify.yml after the run-agent invocation
- [X] T023 [P] [US2] Add the same "Update Job Versions" step in .github/workflows/quick-impl.yml after the run-agent invocation
- [X] T024 [P] [US2] Add the same "Update Job Versions" step in .github/workflows/iterate.yml after the run-agent invocation
- [X] T025 [P] [US2] Add the same "Update Job Versions" step in .github/workflows/ai-board-assist.yml after the run-agent invocation

**Checkpoint**: Capture-and-persist path is end-to-end. A new job for any of CLAUDE/CODEX/GEMINI/MISTRAL stores both values when capture succeeds; failures leave the column NULL without affecting job status.

---

## Phase 4: User Story 1 - Inspect plugin and agent CLI version on a single job (Priority: P1) 🎯 MVP-UI

**Goal**: Two compact badges appear inside the existing `JobRow` trigger row in the job timeline, alongside model/duration/cost. The badges show the captured `pluginVersion` and `agentCliVersion`, or a hyphen-minus placeholder when either is null. Layout stays stable for jobs with and without the data.

**Independent Test**: Open a ticket whose jobs contain at least one job with both versions populated and one without; confirm both badges render in the same metric zone for both jobs, with `—`/`-` shown for missing values, and no layout change. (Can be verified at the component level via existing `tests/unit/components/jobs-timeline.test.tsx` without a real backend.)

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation. Extend the existing component test file.**

- [X] T026 [P] [US1] Extend tests/unit/components/jobs-timeline.test.tsx with "renders pluginVersion and agentCliVersion badges when both present": render `JobRow` with `pluginVersion:'1.0.1'`, `agentCliVersion:'1.0.92 (Claude Code)'`; assert both values appear in the trigger row with the expected `data-testid` (`job-plugin-version-<id>`, `job-cli-version-<id>`)
- [X] T027 [P] [US1] Extend tests/unit/components/jobs-timeline.test.tsx with "renders placeholder when both versions are null": render `JobRow` with `pluginVersion:null`, `agentCliVersion:null`; assert the same `data-testid` slots are present and contain the placeholder character
- [X] T028 [P] [US1] Extend tests/unit/components/jobs-timeline.test.tsx with "renders mixed populated/null versions": render `JobRow` with `pluginVersion:'1.0.1'`, `agentCliVersion:null`; assert plugin slot shows the value and CLI slot shows the placeholder

### Implementation for User Story 1

- [X] T029 [US1] In components/ticket/jobs-timeline.tsx extend the `JobRow` trigger layout (~lines 115-180): add two compact `<span>` badges next to the existing model badge (~lines 135-139) using the same Tailwind classes (`text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded hidden sm:inline`); render `job.pluginVersion ?? '-'` and `job.agentCliVersion ?? '-'` so the slot is always present (FR-007); use `data-testid={\`job-plugin-version-${job.id}\`}` and `data-testid={\`job-cli-version-${job.id}\`}` to match the existing duration/cost test-ID convention
- [X] T030 [US1] In components/ticket/jobs-timeline.tsx confirm the `JobRow` reads the new fields off the existing `TicketJobWithTelemetry` prop (no additional props or queries needed — GET endpoint already returns them via T016)

**Checkpoint**: Job timeline renders the two badges for every job. Old jobs and capture-failure jobs render the placeholder; populated jobs render the captured values. Layout unchanged.

---

## Phase 5: User Story 3 - Graceful degradation when capture is unavailable (Priority: P2)

**Goal**: When either capture mechanism fails (manifest missing, CLI binary absent, transient I/O error), the job runs to completion as if the capture step did not exist. The UI shows the placeholder, runner logs record enough detail to diagnose, and no user-facing error surfaces.

**Independent Test**: (1) Rename `.claude-plugin/plugin.json` and trigger a job — confirm the job completes with normal status, `pluginVersion` is NULL, runner logs include a `log_info` line about the missing manifest. (2) Point the runner at a `PATH` that omits the agent CLI and trigger a job — confirm the job completes, `agentCliVersion` is NULL, runner logs include a `log_info` line about the missing binary. (3) Open the affected jobs in the UI — confirm the placeholder renders without layout breakage.

### Tests for User Story 3

**NOTE: Most of US3's behavior is already covered by US2's "missing → empty string" tests (T006, T007) and US1's null-rendering tests (T027, T028). The cases below add the cross-cutting "job continues normally + log line emitted" coverage.**

- [X] T031 [P] [US3] Extend tests/unit/scripts/run-command.test.ts with "capture failure does not propagate non-zero": invoke `read_plugin_version` and `capture_claude_version` against a missing target; assert each helper exits 0 and emits a `log_info`-level line on stderr (NOT `log_error`)
- [X] T032 [P] [US3] Extend tests/integration/jobs/ticket-jobs.test.ts (~lines 60-208 existing telemetry test) with "GET /tickets/:id/jobs surfaces null pluginVersion and null agentCliVersion alongside populated fields": create one job with both columns null and one with both populated; assert response shape matches data-model.md (both keys present, never omitted)

### Implementation for User Story 3

- [X] T033 [US3] Audit .github/scripts/run-agent.sh changes (T017–T020): confirm every new helper wraps its read/invocation with `2>/dev/null || true`, returns empty on failure, never exits non-zero, and logs via `log_info` only (matches pattern P3 from research.md and FR-004/FR-010)
- [X] T034 [US3] Audit the workflow steps added in T021–T025: confirm each PATCH is suffixed with `|| true` so a network error in the version PATCH cannot fail the workflow; confirm the `if:` condition skips the step when both env vars are empty (no useless API call)

**Checkpoint**: Capture-failure paths verified end-to-end. No job's terminal status is influenced by version capture; runner logs carry diagnostic context; UI degrades gracefully via the placeholder.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final verification of cross-cutting acceptance criteria (success criteria SC-001 through SC-006).

- [X] T035 Run `bun run type-check` and `bun run lint` and fix any errors before commit (project rule: never bypass with `--no-verify`)
- [X] T036 Run `bun run test:unit` and `bun run test:integration` and fix any failures across the extended test files
- [ ] T037 Manually verify SC-006 (capture adds <1s to job start) by inspecting timestamps in the workflow logs of a test job: time delta between the run-agent invocation and the run-agent return should reflect <1s of overhead from the new helpers
- [ ] T038 Manually verify SC-005 (UI placeholder renders without layout breakage) by opening one pre-feature job and one capture-failure job in the local dev UI (`bun run dev`) and confirming visual stability of the trigger row

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately. T001 → T002 → T003 sequential (schema → migration → client regen).
- **Foundational (Phase 2)**: Depends on Phase 1 (Prisma client must exist before TS types reference new fields). T004 and T005 are parallel.
- **User Story 2 (Phase 3, P1)**: Depends on Phase 2. Internal order: tests T006–T011 → API impl T012–T016 → runner impl T017–T020 → workflow integration T021–T025 (T021–T025 are parallel — different YAML files).
- **User Story 1 (Phase 4, P1)**: Depends on Phase 2 (validator + types only — does NOT need US2 to be complete; component tests can mock job props with the new fields). Tests T026–T028 → impl T029–T030.
- **User Story 3 (Phase 5, P2)**: Depends on US2 implementation (T017–T020 helpers exist, T021–T025 workflow steps exist) and on US1 rendering (T029) for the manual UI verification step.
- **Polish (Phase 6)**: Depends on US1, US2, US3 all complete.

### User Story Dependencies

- **US2 (P1) and US1 (P1)** can run in parallel after Phase 2 — US1 tests stub the `Job` props directly, so the UI does not block on the runner work. Production behavior, however, requires both to be merged together (UI shows placeholders if API never persists; UI shows placeholders if API never persists; API persists invisibly if UI doesn't render).
- **US3 (P2)** depends on US2's runner helpers and workflow steps existing. US3 tests verify the graceful-degradation property of those helpers and the rendered UI from US1.

### Within Each User Story

- Tests (constitution §III) are written first and MUST FAIL before implementation.
- Schema → validator → API handler → workflow runner → UI consumer.
- Within US2: API tests + runner tests (T006–T011) → API impl (T012–T016) → runner impl (T017–T020) → workflow wiring (T021–T025).
- Within US1: component tests (T026–T028) → component impl (T029–T030).
- Within US3: cross-cutting tests (T031–T032) → audit/verification (T033–T034).

### Parallel Opportunities

- **Phase 2**: T004 (validator) and T005 (TS types) — different files, no shared imports until Phase 3.
- **US2 tests**: T006, T007, T008, T009, T010, T011 — all parallel; T006/T007 touch the runner test file, T008–T011 touch the API test file (sequential within each file but parallel across files; flag T008–T011 as [P] since they each add an isolated `it()` block).
- **US2 workflow wiring**: T021, T022, T023, T024, T025 — five different YAML files, fully parallel.
- **US1 tests**: T026, T027, T028 — three independent `it()` blocks in the same file (parallel-safe at the test-runner level).
- **US3 tests**: T031 and T032 — different test files.

---

## Parallel Example: User Story 2 workflow wiring

```bash
# Once T017–T020 (runner helpers + GITHUB_ENV export) are in place,
# run all five workflow PATCH-step additions in parallel:
Task: "Add 'Update Job Versions' step to .github/workflows/speckit.yml"
Task: "Add 'Update Job Versions' step to .github/workflows/verify.yml"
Task: "Add 'Update Job Versions' step to .github/workflows/quick-impl.yml"
Task: "Add 'Update Job Versions' step to .github/workflows/iterate.yml"
Task: "Add 'Update Job Versions' step to .github/workflows/ai-board-assist.yml"
```

## Parallel Example: User Story 1 tests

```bash
# Three component-level test cases, all parallel-safe:
Task: "Extend jobs-timeline.test.tsx with 'renders both versions' case"
Task: "Extend jobs-timeline.test.tsx with 'both null → placeholder' case"
Task: "Extend jobs-timeline.test.tsx with 'mixed populated/null' case"
```

---

## Implementation Strategy

### MVP First (US2 + US1 together)

US2 (capture/persist) and US1 (display) are both P1 and together form the smallest user-visible increment. Neither delivers value alone:

1. Complete Phase 1: Setup (schema migration + client regen).
2. Complete Phase 2: Foundational (Zod schema + TS types).
3. Complete Phase 3 (US2) and Phase 4 (US1) — can be implemented in parallel; merge together so the UI never displays placeholders while waiting for runner support.
4. **STOP and VALIDATE**: Trigger one job per supported agent (CLAUDE/CODEX/GEMINI/MISTRAL); confirm both badges render with captured values in the timeline UI.
5. Deploy.

### Incremental Delivery

1. Setup + Foundational → typed scaffolding ready.
2. US2 + US1 in one merge → MVP is live.
3. US3 (Phase 5) → adds explicit graceful-degradation tests + audits without changing user-visible behavior; can ship in a follow-up commit.
4. Polish (Phase 6) → final type-check, lint, manual SC-005 / SC-006 verification.

### Parallel Execution Strategy

Within a single development cycle:

1. Setup (Phase 1) sequentially.
2. Foundational (Phase 2) — T004 ∥ T005.
3. US2 + US1 in parallel:
   - Track A (US2): T006–T025
   - Track B (US1): T026–T030
4. US3 (Phase 5) once both tracks land.
5. Polish (Phase 6).

---

## Notes

- [P] tasks = different files (or independent `it()` blocks), no dependencies on incomplete tasks.
- [Story] label maps each task to its user story for traceability.
- Each user story is independently testable — US2 via integration tests against a real DB, US1 via React Testing Library with mocked job props, US3 via runner-level unit tests + cross-story audits.
- Verify tests fail before implementing (constitution §III).
- Commit after each logical group; never bypass pre-commit hooks (`--no-verify` is forbidden by CLAUDE.md).
- Stop at any checkpoint to validate independently.
- All test additions EXTEND existing files — no new test files are created (research.md "Existing Test Files" inventory).
