# Tasks: Health Dashboard - Workflow health-scan.yml

**Input**: Design documents from `/specs/AIB-372-health-dashboard-workflow/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Integration tests included per testing strategy in plan.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new project structure needed. This feature adds a single workflow file and a minor auth change to an existing endpoint. Verify existing infrastructure.

- [x] T001 Verify existing health scan API endpoints and report schemas in app/api/projects/[projectId]/health/ and lib/health/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add workflow token authentication to the ticket creation endpoint so the workflow can create tickets without a user session. This MUST be complete before US3 (ticket generation) can work.

**Why**: Research Task 1 found that `POST /api/projects/:projectId/tickets` requires user session auth. The workflow authenticates via `WORKFLOW_API_TOKEN` Bearer token. An alternative auth path must be added.

- [x] T002 Add workflow token authentication path to ticket creation endpoint in app/api/projects/[projectId]/tickets/route.ts — import `validateWorkflowAuth` from `@/app/lib/workflow-auth`, try workflow auth first in POST handler, skip subscription limit checks when workflow-authenticated, validate projectId exists
- [x] T003 Add integration test for workflow-authenticated ticket creation in tests/integration/health/ticket-generation.test.ts — test that Bearer token auth creates tickets, verify subscription limits are skipped, verify projectId validation still applies

**Checkpoint**: Workflow can now create tickets via API with Bearer token auth

---

## Phase 3: User Story 1 - Execute a Full Health Scan (Priority: P1) + User Story 2 - Real-Time Status Updates (Priority: P1) MVP

**Goal**: Create the core health-scan.yml workflow that clones a target repo, executes scan commands, updates scan status in real time (PENDING -> RUNNING -> COMPLETED/FAILED), and reports results back to the API.

**Why combined**: US1 and US2 are inseparable — the workflow file implements both scan execution and status transitions as part of the same execution flow. Every step in the workflow updates status.

**Independent Test**: Trigger a scan via API, verify the workflow executes, and confirm the HealthScan record transitions through PENDING -> RUNNING -> COMPLETED with a valid score and report.

### Implementation for User Story 1 + 2

- [x] T004 [US1] Create workflow file skeleton with inputs, secrets, environment variables, and job definition in .github/workflows/health-scan.yml — define workflow_dispatch inputs (scan_id, project_id, scan_type, base_commit, head_commit, githubRepository, agent), secrets (WORKFLOW_API_TOKEN, GH_PAT, CLAUDE_CODE_OAUTH_TOKEN, CODEX_AUTH_JSON), and env vars (APP_URL, ANTHROPIC_MODEL, OTEL) per contracts/health-scan-workflow.md
- [x] T005 [US1] Add RUNNING status update step in .github/workflows/health-scan.yml — first step after job starts: curl PATCH to `{APP_URL}/api/projects/{project_id}/health/scans/{scan_id}/status` with `{"status": "RUNNING"}` and Bearer token auth
- [x] T006 [US1] Add repository checkout steps in .github/workflows/health-scan.yml — sparse checkout ai-board repo (`.claude-plugin` + `.github/scripts` only), full checkout target repo to `target/` with `fetch-depth: 0` using GH_PAT, symlink commands directory (`target/.claude/commands` -> ai-board `.claude-plugin/commands`)
- [x] T007 [US1] Add Node.js and Bun setup steps in .github/workflows/health-scan.yml — setup Node.js and Bun matching speckit.yml versions, configure git user as `ai-board[bot]`
- [x] T008 [US1] Add HEAD capture and scan command execution steps in .github/workflows/health-scan.yml — capture HEAD SHA via `git -C target rev-parse HEAD`, map scan_type to command name (SECURITY->health-security, COMPLIANCE->health-compliance, TESTS->health-tests, SPEC_SYNC->health-spec-sync), execute via `run-agent.sh {agent} {command} "scan_id={scan_id} project_id={project_id} base_commit={base_commit} head_commit={head_commit}"`, capture stdout to report file
- [x] T009 [US1] Add report parsing and COMPLETED status update step in .github/workflows/health-scan.yml — validate JSON output with jq, extract score/issuesFound/issuesFixed from report, PATCH status to COMPLETED with score, report JSON, issuesFound, issuesFixed, headCommit, and telemetry data
- [x] T010 [US1] Add error handling with FAILED status update in .github/workflows/health-scan.yml — on scan command failure: PATCH status to FAILED with error message and durationMs; on malformed JSON: FAILED with "Invalid scan report format"; use `if: failure()` or bash trap to ensure FAILED status is always sent; truncate errorMessage to 2000 chars

**Checkpoint**: Core workflow executes scans, reports status transitions in real time, and stores results. US1 and US2 are functional.

---

## Phase 4: User Story 3 - Automatic Ticket Generation (Priority: P2)

**Goal**: After a scan completes, the workflow automatically creates grouped tickets in INBOX with QUICK workflow type for discovered issues.

**Independent Test**: Run a scan that produces known issues and verify the correct number of grouped tickets are created in INBOX with expected titles and descriptions.

### Implementation for User Story 3

- [x] T011 [US3] Add ticket grouping logic for SECURITY scans in .github/workflows/health-scan.yml — use jq to group `report.issues[]` by severity (high/medium/low), create one ticket per non-empty severity group via POST to `{APP_URL}/api/projects/{project_id}/tickets` with title `[Health:Security] {Severity} severity issues` and markdown description listing issues with file paths and line numbers
- [x] T012 [US3] Add ticket grouping logic for COMPLIANCE scans in .github/workflows/health-scan.yml — group `report.issues[]` by category (constitution principle), create one ticket per violated principle with title `[Health:Compliance] {Principle} violations`
- [x] T013 [US3] Add ticket grouping logic for TESTS scans in .github/workflows/health-scan.yml — iterate `report.nonFixable[]` (skip autoFixed), create one ticket per non-fixable test failure with title `[Health:Tests] {test description}`
- [x] T014 [US3] Add ticket grouping logic for SPEC_SYNC scans in .github/workflows/health-scan.yml — filter `report.specs[]` by `status: "drifted"`, create one ticket per drifted spec with title `[Health:SpecSync] {specPath} drift`
- [x] T015 [US3] Add generatedTickets tracking and report update in .github/workflows/health-scan.yml — collect ticket keys from POST responses, update report JSON with `generatedTickets` array before sending final COMPLETED status; handle partial ticket creation failures (log error, continue remaining, scan still COMPLETED)
- [x] T016 [US3] Add integration test for ticket grouping via workflow-authenticated API in tests/integration/health/ticket-generation.test.ts — test security ticket grouping by severity, compliance by principle, tests by non-fixable items, spec_sync by drifted specs, verify zero-issue scans create no tickets

**Checkpoint**: Workflow creates grouped tickets after scan completion. US3 is functional.

---

## Phase 5: User Story 4 - Incremental Scanning (Priority: P2)

**Goal**: Support incremental scans by validating base_commit and only analyzing changes between base_commit and head_commit.

**Independent Test**: Run two successive scans and verify the second receives the first scan's headCommit as baseCommit.

### Implementation for User Story 4

- [x] T017 [US4] Add base_commit validation step in .github/workflows/health-scan.yml — after repo checkout, validate base_commit exists via `git -C target cat-file -t {base_commit}`, if invalid or missing fallback to empty string (full scan) with warning log, set validated base_commit as step output for downstream steps

**Checkpoint**: Incremental scanning works. Full scan fallback handles invalid base_commits. US4 is functional.

---

## Phase 6: User Story 5 - Telemetry Recording (Priority: P3)

**Goal**: Record standard telemetry (durationMs, tokensUsed, costUsd) on the HealthScan record for cost tracking and performance monitoring.

**Independent Test**: Run a scan and verify the HealthScan record contains non-null durationMs, tokensUsed, and costUsd fields.

### Implementation for User Story 5

- [x] T018 [US5] Add telemetry capture logic in .github/workflows/health-scan.yml — record `$SECONDS` before command start for wall-clock durationMs, configure OTEL telemetry export with scan_id as resource attribute, parse Claude Code JSON output for tokensUsed and costUsd (use `--output-format json` flag), fallback to duration-only if token parsing fails (Codex compatibility)
- [x] T019 [US5] Extend integration test for telemetry fields in tests/integration/health/scan-status.test.ts — verify COMPLETED status updates accept and store durationMs, tokensUsed, costUsd fields; verify FAILED status stores at least durationMs

**Checkpoint**: All scans record telemetry. US5 is functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and edge case handling

- [x] T020 Validate complete workflow by reviewing .github/workflows/health-scan.yml against contracts/health-scan-workflow.md execution flow — verify all 12 steps in the execution flow diagram are implemented, all error scenarios are handled per the contract
- [x] T021 Run quickstart.md validation — execute the implementation steps in quickstart.md and verify all acceptance scenarios from spec.md are covered

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - verification only
- **Foundational (Phase 2)**: No dependencies on Phase 1 - can start immediately
- **US1+US2 (Phase 3)**: Can start after Phase 1 verification. Core workflow creation.
- **US3 (Phase 4)**: Depends on Phase 2 (workflow auth for ticket creation) AND Phase 3 (workflow must exist)
- **US4 (Phase 5)**: Depends on Phase 3 (workflow must exist). Independent of Phase 4.
- **US5 (Phase 6)**: Depends on Phase 3 (workflow must exist). Independent of Phases 4-5.
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

- **US1+US2 (P1)**: Core workflow — no dependencies on other stories
- **US3 (P2)**: Depends on US1+US2 (workflow structure) + Phase 2 (ticket auth)
- **US4 (P2)**: Depends on US1+US2 (workflow structure) only. Can run in parallel with US3.
- **US5 (P3)**: Depends on US1+US2 (workflow structure) only. Can run in parallel with US3 and US4.

### Within Each User Story

- Models/schemas verified before implementation
- Core logic before edge cases
- Implementation before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- Phase 2 (T002-T003) can run in parallel with Phase 3 (T004-T010) since they touch different files
- T011, T012, T013, T014 are independent ticket grouping blocks within a single file but are sequential (same file)
- US4 (T017) and US5 (T018-T019) can run in parallel after US1+US2 completes
- T016 (ticket generation test) and T019 (telemetry test) can run in parallel (different test files)

---

## Parallel Example: After Phase 3 Completion

```bash
# These can run in parallel (different files/concerns):
Track A: US3 ticket grouping (T011-T016) — workflow file + ticket-generation.test.ts
Track B: US4 incremental scan (T017) — workflow file (different section)
Track C: US5 telemetry (T018-T019) — workflow file (different section) + scan-status.test.ts

# Note: T011-T015 and T017-T018 all modify the same workflow file,
# so true parallelism requires careful merge. Best approach:
# Sequential within workflow file, parallel for test files.
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Verify existing infrastructure
2. Complete Phase 3: Core workflow (US1+US2) — scans execute and report status
3. **STOP and VALIDATE**: Trigger a scan, verify status transitions work end-to-end
4. This gives a working health scan workflow without ticket generation

### Incremental Delivery

1. Phase 1+2+3 → Core workflow with ticket auth ready (MVP)
2. Add US3 (Phase 4) → Tickets auto-generated from scan results
3. Add US4 (Phase 5) → Incremental scanning for efficiency
4. Add US5 (Phase 6) → Telemetry for cost tracking
5. Each story adds value without breaking previous stories

### Parallel Execution Strategy

1. Phase 2 (ticket auth) + Phase 3 (workflow skeleton) in parallel — different files
2. After Phase 3 complete: US4 + US5 can proceed in parallel (though same file limits true parallelism)
3. US3 requires Phase 2 completion before ticket creation works end-to-end

---

## Notes

- Primary deliverable is a single workflow file (`.github/workflows/health-scan.yml`) + one endpoint auth change
- Health scan commands (health-security, health-compliance, etc.) are OUT OF SCOPE — this ticket is orchestration only
- No Prisma schema changes needed — all models already exist
- No new npm dependencies — workflow uses curl, jq, run-agent.sh
- Follow speckit.yml patterns for checkout, agent execution, and error handling
- All JSON manipulation in workflow uses `jq` — no complex bash string parsing
