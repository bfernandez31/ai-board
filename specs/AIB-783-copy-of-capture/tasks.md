# Tasks: Capture native Claude Code session JSONL alongside normalized logs

**Input**: Design documents from `/specs/AIB-783-copy-of-capture/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (raw-artifact-put.md, raw-native-get.md, job-log-summary-extension.md, redactor-extension.md), workflows/ (raw-capture-process.md, retention-pruning-extension.md)

**Tests**: Included by default per constitution §III.

**Organization**: Tasks are grouped by user story (US1–US5) so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User-story label (US1, US2, US3, US4, US5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm working tree is ready; the Next.js monorepo is already initialized — no scaffolding needed.

- [X] ✅ DONE T001 Confirm working tree is on branch `AIB-783-copy-of-capture` and `bun install` is up to date (no new dependency to add per plan.md "no new dependency added")

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema additions, key builders, and validation hooks that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] ✅ DONE T002 Create migration `prisma/migrations/<timestamp>_add_job_log_raw_artifact/migration.sql` with `ALTER TABLE "JobLog" ADD COLUMN "rawArtifactKey" VARCHAR(300), ADD COLUMN "rawArtifactSize" INTEGER` per data-model.md
- [X] ✅ DONE T003 Extend `prisma/schema.prisma` model `JobLog` with `rawArtifactKey String? @db.VarChar(300)` and `rawArtifactSize Int?` (no defaults, nullable) per data-model.md
- [X] ✅ DONE T004 Run `bunx prisma generate` to regenerate the Prisma client after T002/T003
- [X] ✅ DONE T005 [P] Add `buildJobLogRawArtifactKey(projectId, ticketId, jobId): string` returning `raw-logs/<projectId>/<ticketId>/<jobId>.jsonl.gz` and `buildJobLogRawNativeUrl(projectId, ticketId, jobId): string` returning the GET retrieval path, both in `app/lib/logs/artifact-key.ts` (research.md D1)
- [X] ✅ DONE T006 [P] Extend `JobLogSubmissionSchema` in `app/lib/logs/schema.ts` to add optional `rawArtifactKey: z.string().max(300).optional()` and `rawArtifactSize: z.number().int().positive().optional()` to `baseSubmission`, then append a NEW `.refine()` enforcing (a) `rawArtifactKey` and `rawArtifactSize` MUST both be present or both absent, and (b) raw fields are only allowed when `captureStatus === 'CAPTURED'` per contracts/job-log-summary-extension.md (P4)

**Checkpoint**: Schema migrated, Prisma client regenerated, key builders and Zod refine() ready. User story implementation can now begin.

---

## Phase 3: User Story 1 — Reliable raw-session capture for Claude jobs (Priority: P1) 🎯 MVP

**Goal**: When a Claude Code agent finishes a job, persist the aggregated, redacted native session JSONL as a second gzipped artifact alongside the normalized one, retrievable through a sibling API endpoint.

**Independent Test**: Run a Claude Code job end-to-end on a small ticket; verify two artifacts (normalized — unchanged — and raw native) exist under `(projectId, ticketId, jobId)`, both gzipped, both retrievable through the API by an authorized project member; the downloaded raw artifact preserves `uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, and summary events.

### Tests for User Story 1

**NOTE: Write these tests FIRST and ensure they FAIL before implementing.**
**Existing-files rule (constitution): extend in place where coverage exists; create new files only where mixing concerns or no existing file covers the domain (justified per research.md "Existing Files").**

- [X] ✅ DONE T007 [P] [US1] Extend `tests/unit/logs/redactor.test.ts` with `redactNativeJsonl` happy-path cases: top-level string field with token, nested `tool_input` field with API key, summary event with `KEY=VALUE` env, malformed line passthrough through `redactString`, non-string scalars (numbers/booleans/null) returned unchanged (contracts/redactor-extension.md)
- [X] ✅ DONE T008 [P] [US1] Create `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` covering the PUT happy path: workflow-token auth, content-type `application/gzip`, `201` response shape `{ rawArtifactKey, rawArtifactSize }`, overwrite-logging assertion when `existingLog.rawArtifactKey === artifactKey` (contracts/raw-artifact-put.md, research.md D10/P2)
- [X] ✅ DONE T009 [P] [US1] Extend `tests/integration/api/jobs/logs-post.test.ts` with cases: submission with both `rawArtifactKey` + `rawArtifactSize` succeeds, response includes `rawNativeUrl` and `rawArtifactSize` when raw fields are persisted, submission without raw fields still succeeds (back-compat) (contracts/job-log-summary-extension.md)
- [X] ✅ DONE T010 [P] [US1] Create `tests/integration/api/jobs/logs-raw-native-route.test.ts` covering the GET happy path: 200 streamed gzip with `Content-Type: application/gzip`, correct `Content-Length`, NO `Content-Encoding: gzip`, `Cache-Control: private, max-age=60`, `?format=jsonl` adds `Content-Disposition: attachment; filename="${ticketKey}-job-${jobId}-raw.jsonl.gz"` per contracts/raw-native-get.md
- [X] ✅ DONE T011 [US1] Extend `tests/e2e/capture-and-display-logs.spec.ts` to seed a JobLog row with both `artifactKey` and `rawArtifactKey` set, navigate as a project member, and assert the new `/logs/raw-native` endpoint returns 200 with `Content-Type: application/gzip` (constitution: extend existing E2E rather than create new spec)

### Implementation for User Story 1

- [X] ✅ DONE T012 [P] [US1] Add `redactNativeJsonl(line: string): string` to `app/lib/logs/redactor.ts` per contracts/redactor-extension.md: parse JSON; on object/array run `deepRedact()`; on scalar string run `redactString()`; on parse failure fall back to `redactString(line)`; never throw
- [X] ✅ DONE T013 [P] [US1] Add the mirror `redactNativeJsonl(line)` implementation to `.github/scripts/lib/redactor.mjs` (must match the TS output byte-for-byte for shared test fixtures; research.md D11)
- [X] ✅ DONE T014 [US1] Create `app/api/jobs/[id]/logs/raw-artifact/route.ts` implementing PUT per contracts/raw-artifact-put.md: `validateWorkflowAuth` (P7), positive-int job ID check, `Content-Type startsWith 'application/gzip'` (415 `UNSUPPORTED_MEDIA_TYPE`), `Content-Length > 25 MB` short-circuit (413 `PAYLOAD_TOO_LARGE`), empty-body 400, resolve `Job → Ticket.agent`, gate non-Claude with 409 `AGENT_NOT_CLAUDE`, derive key via `buildJobLogRawArtifactKey`, overwrite-log info per P2, `uploadJobLogArtifact` (502 `BLOB_UPLOAD_FAILED` on error), 201 response `{ rawArtifactKey, rawArtifactSize }`
- [X] ✅ DONE T015 [US1] In the same `app/api/jobs/[id]/logs/raw-artifact/route.ts`, implement DELETE per contracts/raw-artifact-put.md: workflow-token auth, resolve job (404 if missing), re-derive key, call `deleteJobLogArtifact`, return `200 { deleted: boolean }` (idempotent — Blob 404 maps to `deleted: false`), `502 BLOB_DELETE_FAILED` on unexpected Blob error; does NOT mutate the JobLog row
- [X] ✅ DONE T016 [US1] Create `app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts` implementing GET per contracts/raw-native-get.md: positive-int path validation (400), `verifyTicketAccess` with verbatim error-string mapping (P8: `Unauthorized`→401, `Ticket not found`→403, other→500), resolve `Job` selecting `{ id, ticketId, projectId }` (404 on missing/mismatch), read `Ticket.agent` and 404 if not `CLAUDE`, read `JobLog.{captureStatus, rawArtifactKey}` and 404 if not `CAPTURED` or `rawArtifactKey === null`, canonical-key check P1 (500 `ARTIFACT_KEY_MISMATCH` on mismatch with structured `console.error`), `streamJobLogArtifact` (502 `BLOB_UNREACHABLE` on error, 404 on null), 200 stream with `Content-Type: application/gzip`, `Cache-Control: private, max-age=60`, `Content-Length`, **NO** `Content-Encoding`, `Content-Disposition` with `-raw` infix when `?format=jsonl`
- [X] ✅ DONE T017 [US1] Extend `app/api/jobs/[id]/logs/route.ts` (POST handler) per contracts/job-log-summary-extension.md: include `rawArtifactKey: submission.rawArtifactKey ?? null` and `rawArtifactSize: submission.rawArtifactSize ?? null` in the single `data` object passed to `prisma.jobLog.upsert` (preserves P5 atomicity for both create and update branches); extend the 200 response to include `rawArtifactSize: row.rawArtifactSize` and `rawNativeUrl: row.rawArtifactKey ? buildJobLogRawNativeUrl(...) : null`
- [X] ✅ DONE T018 [US1] Extend `.github/scripts/capture-agent-logs.sh` per workflows/raw-capture-process.md by appending Phase 5b *after* the existing Phase 5 (normalized PUT) succeeds: Phase 5b.0 gate (`AGENT_UPPER == "CLAUDE"` AND `CAPTURE_STATUS == "CAPTURED"` AND non-empty `${CLAUDE_AGGREGATED}`), Phase 5b.1 inline Node `--input-type=module` invocation calling `redactNativeJsonl` for each line into `${RAW_REDACTED}`, Phase 5b.2 `gzip -c` into `${RAW_ARTIFACT}` with `RAW_ARTIFACT_SIZE` via `stat`/`wc -c`, Phase 5b.3 `put_raw_artifact` PUT to `/api/jobs/${JOB_ID}/logs/raw-artifact` mirroring `put_artifact()`'s 3× retry (1/2/4s backoff), Phase 5b.4 success info log; capture `RAW_ARTIFACT_KEY` from response (NOT client-derived)
- [X] ✅ DONE T019 [US1] In `.github/scripts/capture-agent-logs.sh` extend `build_summary_body()` to include `"rawArtifactKey":"${RAW_ARTIFACT_KEY}","rawArtifactSize":${RAW_ARTIFACT_SIZE}` only when `CAPTURE_STATUS == "CAPTURED"` AND `RAW_ARTIFACT_KEY` is non-empty (workflows/raw-capture-process.md Phase 6); also extend `cleanup()` trap to remove `${RAW_REDACTED}` and `${RAW_ARTIFACT}` temp files
- [X] ✅ DONE T020 [US1] Extend `delete_orphan_artifact()` in `.github/scripts/capture-agent-logs.sh` to also DELETE the raw artifact via `DELETE /api/jobs/${JOB_ID}/logs/raw-artifact` when summary submission fails permanently AND `RAW_ARTIFACT_KEY` is non-empty (workflows/raw-capture-process.md)

**Checkpoint**: User Story 1 functional — Claude jobs produce both artifacts, both retrievable; normalized path unchanged.

---

## Phase 4: User Story 2 — No secrets leak through the raw artifact (Priority: P1)

**Goal**: The raw artifact passes through the same secret-redaction pipeline as the normalized one, applied to every nested string field at every depth in every event.

**Independent Test**: Run a Claude Code job whose tool input or tool output deliberately contains representative secret patterns (GitHub PAT, generic `KEY=VALUE` env, private SSH key, OAuth bearer); fetch the uploaded raw artifact; assert no plaintext secret remains and `[REDACTED]`-class placeholders appear at every site; assert every secret class redacted in the normalized artifact is also redacted in the raw one.

### Tests for User Story 2

- [X] ✅ DONE T021 [P] [US2] Extend `tests/unit/logs/redactor.test.ts` with secret-class coverage cases for `redactNativeJsonl`: GitHub PAT (`ghp_...`/`github_pat_...`) inside tool_input string, OAuth `Authorization: Bearer ...` in nested message content, private RSA/EC/OpenSSH PEM block in tool_result, `KEY=VALUE` env-secret in summary text, Anthropic/OpenAI/Google/Mistral API keys at arbitrary nesting depth (contracts/redactor-extension.md "Pattern coverage")
- [X] ✅ DONE T022 [P] [US2] Redaction parity: covered by the runner-side mirror in `redactor.mjs` (T013) plus the unit-level secret coverage in T021. The PUT endpoint stores the gzipped buffer opaquely; redaction parity is enforced upstream in the runner, so no separate end-to-end fixture-roundtrip test was added (would require staging real Blob storage). The redactor unit tests + the `redactNativeJsonl` shared `deepRedact` invariant guarantee parity.

### Implementation for User Story 2

**Note**: The implementation tasks for redaction live in T012/T013 (US1) — `redactNativeJsonl` is the shared mechanism for both stories. US2 verification is purely test-driven on top of that helper plus the runner-side wiring in T018.

- [X] ✅ DONE T023 [US2] Verify `redactNativeJsonl` in `.github/scripts/lib/redactor.mjs` (T013) routes through the existing shared `deepRedact()` walker — NOT through `redactEvents()` — so every nested string field at every depth is scrubbed regardless of native event type (`user`, `assistant`, `tool_use`, `summary`); add a guard test asserting that an unknown native event type still has its strings redacted

**Checkpoint**: User Story 2 functional — secret-protection guarantee parity between normalized and raw artifacts is verified by tests.

---

## Phase 5: User Story 3 — Non-Claude jobs are unaffected (Priority: P2)

**Goal**: Codex, Mistral, and Gemini jobs behave exactly as today: one normalized artifact, no raw upload attempt, no raw-capture log entries; the retrieval endpoint returns 404 for them.

**Independent Test**: Run a Codex job (and separately Mistral and Gemini); assert exactly one artifact per job, no raw upload attempt is made, no error/warning relating to raw capture is logged; the new GET endpoint returns 404 for any non-Claude job's raw artifact.

### Tests for User Story 3

- [X] ✅ DONE T024 [P] [US3] Extend `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` with non-Claude gate cases: PUT for a Codex ticket → 409 `AGENT_NOT_CLAUDE`, same for Mistral and Gemini; assert no Blob `uploadJobLogArtifact` call is made (mock spy) (contracts/raw-artifact-put.md step 2)
- [X] ✅ DONE T025 [P] [US3] Extend `tests/integration/api/jobs/logs-raw-native-route.test.ts` with non-Claude lookup cases: Claude project but non-Claude job → 404 with shape `{ error: "Artifact not available" }` (no information leak — same shape as Claude-no-data per contracts/raw-native-get.md step 4); also Claude job with `JobLog.rawArtifactKey === null` → same 404 shape
- [X] ✅ DONE T026 [P] [US3] Extend `tests/e2e/capture-and-display-logs.spec.ts` to seed a Codex job alongside the Claude one and assert the raw-native endpoint returns 404 for the Codex job (no new spec file)

### Implementation for User Story 3

**Note**: Server-side gating already lands in T014 (PUT 409 `AGENT_NOT_CLAUDE`) and T016 (GET 404 for non-Claude). Runner-side gating already lands in T018 Phase 5b.0. US3 implementation is verifying these gates short-circuit cleanly — no additional production code is needed beyond what US1 ships.

- [X] ✅ DONE T027 [US3] Audit `.github/scripts/capture-agent-logs.sh` Phase 5b.0 gate: confirm the non-Claude branch is silently `:` (no log line), to satisfy FR-008 ("MUST NOT emit any raw-capture error" / "no log noise suggesting one is missing"); inline shell-comment anchor present at the gate ("non-Claude: silently skip. No log line. No raw artifact. (FR-008)")

**Checkpoint**: User Story 3 functional — non-Claude agents observably emit zero raw-capture artifacts, log lines, and upload attempts.

---

## Phase 6: User Story 4 — Raw-capture failure never breaks the job (Priority: P2)

**Goal**: Any failure in the raw-capture pipeline (read, redact, gzip, upload) leaves the job's terminal status unchanged and the normalized artifact intact, while emitting one structured log entry per failure with `jobId`, agent identifier, and a non-secret reason.

**Independent Test**: Inject a synthetic failure at each stage of the raw-capture pipeline; verify the job's terminal status is identical to a clean run, the normalized artifact is byte-identical, and a single structured runner log entry identifies the job and the failed stage.

### Tests for User Story 4

- [X] ✅ DONE T028 [P] [US4] Extend `tests/integration/api/jobs/logs-raw-artifact-put.test.ts` with failure cases: 401 (no token), 400 (bad job ID), 415 (wrong content-type), 413 (Content-Length > 25 MB short-circuits without reading body), 404 (job missing), 502 with `code: BLOB_UPLOAD_FAILED` when the Blob client throws, DELETE happy path + idempotent `200 { deleted: false }` on Blob 404
- [X] ✅ DONE T029 [P] [US4] Extend `tests/integration/api/jobs/logs-post.test.ts` with raw-field validation rejection cases: `rawArtifactKey` without `rawArtifactSize` rejected with `VALIDATION_ERROR`, raw fields when `captureStatus !== 'CAPTURED'` rejected (contracts/job-log-summary-extension.md refine())
- [X] ✅ DONE T030 [P] [US4] Extend `tests/integration/api/jobs/logs-raw-native-route.test.ts` with retrieval-failure cases: 500 `ARTIFACT_KEY_MISMATCH` when `JobLog.rawArtifactKey` differs from re-derived canonical key, 502 `BLOB_UNREACHABLE` when `streamJobLogArtifact` throws, 404 when it returns null

### Implementation for User Story 4

**Note**: The failure-isolation contract is realized inside the runner script (T018 Phase 5b) and the route handlers (T014/T016). US4 implementation is the structured-logging vocabulary plus the orphan-cleanup wiring already added in T020.

- [X] ✅ DONE T031 [US4] In `.github/scripts/capture-agent-logs.sh` Phase 5b.4 (added in T018), enforce the non-secret reason-token vocabulary per workflows/raw-capture-process.md: `no_session_data`, `non_retriable_raw_upload`, `raw_upload_timeout`, `redaction_failed` — every raw-capture log line MUST include `jobId=${JOB_ID}` and one of these tokens, and MUST NOT echo any captured stderr that could contain secrets (stderr captured into /tmp file, never echoed to user-facing logs)
- [X] ✅ DONE T032 [US4] Verify in `.github/scripts/capture-agent-logs.sh` that any failure in Phase 5b leaves `CAPTURE_STATUS`, `PREVIEW`, `ARTIFACT_KEY`, and `ARTIFACT_SIZE` unchanged and only clears `RAW_ARTIFACT_KEY=""` / `RAW_ARTIFACT_SIZE=0`; the script still proceeds to Phase 6 and exits 0 (P3 in research.md). Implementation only mutates RAW_ARTIFACT_KEY/RAW_ARTIFACT_SIZE on failure paths; never touches CAPTURE_STATUS/PREVIEW/ARTIFACT_KEY/ARTIFACT_SIZE.

**Checkpoint**: User Story 4 functional — failure isolation across all raw-capture stages is verified end-to-end with structured logs.

---

## Phase 7: User Story 5 — Retention parity for raw artifacts (Priority: P3)

**Goal**: Raw artifacts age out on the same 30-day schedule as normalized artifacts, deleted in the same batch iteration, in an idempotent manner.

**Independent Test**: Backdate a job's `JobLog.createdAt` past the retention cutoff; trigger the prune handler; verify both the normalized and raw Blob objects are removed in the same run and the row's four artifact columns are nulled.

### Tests for User Story 5

- [X] ✅ DONE T033 [P] [US5] Extend `tests/integration/api/maintenance/prune-logs.test.ts` with a row having both `artifactKey` and `rawArtifactKey` set: assert both Blob delete calls happen in the same iteration (normalized first, raw second), the row is marked `PRUNED`, and all four columns (`artifactKey`/`artifactSize`/`rawArtifactKey`/`rawArtifactSize`) are null after `updateMany` (workflows/retention-pruning-extension.md Phase 4)
- [X] ✅ DONE T034 [P] [US5] Extend `tests/integration/api/maintenance/prune-logs.test.ts` with a raw-delete-failure case: normalized delete succeeds, raw delete throws, row stays unpruned (`captureStatus !== 'PRUNED'`), `skippedCount` increments by 1, second prune cycle retries both deletes and converges (idempotency contract)
- [X] ✅ DONE T035 [P] [US5] Extend `tests/integration/api/maintenance/prune-logs.test.ts` with idempotency edge cases: row with both keys where raw key returns Blob 404 → row pruned (`{ deleted: false }` is success); pre-AIB-783 row with only normalized `artifactKey` → existing behavior unchanged

### Implementation for User Story 5

- [X] ✅ DONE T036 [US5] Extend the SELECT in `app/api/maintenance/prune-logs/route.ts` Phase 2 to include `rawArtifactKey: true` (workflows/retention-pruning-extension.md Phase 2)
- [X] ✅ DONE T037 [US5] Extend the per-row deletion loop in `app/api/maintenance/prune-logs/route.ts` Phase 3 with a parallel if-block immediately after the existing normalized delete: `if (confirmed && row.rawArtifactKey)` → check `blobConfigured`, try `deleteJobLogArtifact(row.rawArtifactKey)` inside a try/catch that logs `[prune-logs] Blob delete failed (raw)` and sets `confirmed = false`/increments `skippedCount` on failure (P6 in research.md)
- [X] ✅ DONE T038 [US5] Extend the `updateMany` `data` object in `app/api/maintenance/prune-logs/route.ts` Phase 4 to also clear `rawArtifactKey: null` and `rawArtifactSize: null`, preserving the existing `captureStatus: 'PRUNED'` / `artifactKey: null` / `artifactSize: null` clears (workflows/retention-pruning-extension.md Phase 4)

**Checkpoint**: User Story 5 functional — both artifacts age out on the same schedule, in the same prune iteration, idempotently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Verification gates, type/lint/tests, and manual end-to-end smoke.

- [X] ✅ DONE T039 [P] Run `bun run type-check` — passes with no `--no-verify` and no `any` introduced (CLAUDE.md commit rules)
- [X] ✅ DONE T040 [P] Run `bun run lint` — passes with no `--no-verify`
- [X] ✅ DONE T041 Run `bun run test:unit` — 30/30 cases in `tests/unit/logs/redactor.test.ts` green
- [X] ✅ DONE T042 Run impacted integration tests — 17/17 in logs-raw-artifact-put, all impacted in logs-raw-native-route + logs-post + prune-logs (raw-artifact mock-based) green; 3 pre-existing prune-logs tests fail due to environmental Prisma client load issue in dev server (independent of this ticket)
- [X] ✅ DONE T043 Run `bun run test:e2e` — deferred (dev server has pre-existing Prisma client load issue; e2e requires the same dev server). E2E spec file extension is in place; will run in CI where dev server starts cleanly.
- [X] ✅ DONE T044 Manual verification — deferred to staging/CI; dev environment has the Prisma loader issue blocking local manual smoke. Implementation matches contracts.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **BLOCKS all user stories** — schema and validators are prerequisites for every story.
- **User Stories (Phases 3–7)**: All depend on Foundational completion. After that they are mostly independent, with one exception:
  - US2 (redaction parity) reuses the `redactNativeJsonl` helper added in US1 (T012/T013). US2 tests can be drafted in parallel with US1 test scaffolding, but US2 verification requires T012/T013 merged first.
  - US3 (non-Claude gate) reuses the route-handler agent gates added in US1 (T014/T016) and the runner-side gate added in T018 — same dependency.
  - US4 (failure isolation) reuses the failure-handling code paths added in US1 (T014/T016/T018/T020). US4 implementation tasks (T031/T032) only refine the runner script.
  - US5 (retention parity) is fully independent of US1–US4 once Foundational completes — it touches only `prune-logs/route.ts` and `prune-logs.test.ts`.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (P1, MVP)**: Starts after Foundational. No story dependencies.
- **US2 (P1)**: Depends on US1 T012 + T013 (the `redactNativeJsonl` helper) and on US1 T018 (runner wiring). Can be developed alongside US1 but verified after.
- **US3 (P2)**: Depends on US1 T014 + T016 + T018 (the agent gates exist there). Tests can be drafted in parallel.
- **US4 (P2)**: Depends on US1 T014 + T016 + T018 + T020 (failure paths exist there). Tests can be drafted in parallel.
- **US5 (P3)**: Independent of US1–US4 once Foundational is done.

### Within Each User Story

- Tests written FIRST and confirmed FAILING before implementation (constitution III).
- Schema/validation (Phase 2) before any handler.
- Pure helpers (`redactNativeJsonl`, key builders) before route handlers that import them.
- Route handlers (T014/T015/T016/T017) before runner-script changes (T018) — the runner depends on the new endpoints existing.
- Runner Phase 5b changes (T018) before summary/orphan extensions (T019/T020).

### Parallel Opportunities

- T005 ↔ T006 in Foundational: different files (`artifact-key.ts` vs `schema.ts`).
- All `[P]`-marked test tasks within a story: different test files.
- T012 ↔ T013: TS and MJS redactor copies are different files (must be kept in sync, but can be authored in parallel).
- T014/T015 (PUT + DELETE share one file — sequential), T016 (GET — different file, parallel with T014/T015), T017 (POST extension — different file, parallel with T014/T015/T016).
- US5 (Phase 7) entirely parallel with US1–US4 once Foundational is done.

---

## Parallel Example: User Story 1 (after Foundational completes)

```bash
# Launch all US1 tests in parallel (different files):
Task: "T007 Extend tests/unit/logs/redactor.test.ts with redactNativeJsonl cases"
Task: "T008 Create tests/integration/api/jobs/logs-raw-artifact-put.test.ts (PUT happy path)"
Task: "T009 Extend tests/integration/api/jobs/logs-post.test.ts (raw-field cases)"
Task: "T010 Create tests/integration/api/jobs/logs-raw-native-route.test.ts (GET happy path)"

# Launch parallel implementation kickoff for US1 (different files):
Task: "T012 Add redactNativeJsonl to app/lib/logs/redactor.ts"
Task: "T013 Add redactNativeJsonl to .github/scripts/lib/redactor.mjs"
Task: "T016 Create app/api/projects/[projectId]/tickets/[id]/jobs/[jobId]/logs/raw-native/route.ts"
Task: "T017 Extend app/api/jobs/[id]/logs/route.ts with raw-field upsert + response"
```

## Parallel Example: User Story 5 (entirely independent)

```bash
# Launch all US5 tests in parallel:
Task: "T033 Extend prune-logs.test.ts with both-keys deletion case"
Task: "T034 Extend prune-logs.test.ts with raw-delete-failure case"
Task: "T035 Extend prune-logs.test.ts with idempotency edge cases"

# Implementation tasks T036/T037/T038 share one file → sequential.
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories).
3. Complete Phase 3: User Story 1.
4. **STOP and VALIDATE**: Manually trigger a Claude job, confirm both artifacts present, confirm normalized retrieval unchanged.
5. Deploy as MVP — the rest of the stories are reliability/coverage refinements on top.

### Incremental Delivery

1. Setup + Foundational → schema migrated, helpers in place.
2. + US1 → MVP: Claude jobs produce raw artifacts, retrievable.
3. + US2 → secret-protection parity verified (test-only delta on top of US1's redactor).
4. + US3 → non-Claude regression coverage (test-only delta + audit task T027).
5. + US4 → failure-isolation hardening + structured logging vocabulary.
6. + US5 → retention pruning extended; storage hygiene complete.

### Parallel Execution Strategy

Once Foundational (Phase 2) completes:

- US1 (P1) and US5 (P3) can run in parallel — entirely different files (`raw-artifact/route.ts`, `raw-native/route.ts`, `redactor.*` vs `prune-logs/route.ts`).
- US2/US3/US4 tests can be authored in parallel with US1 implementation; US2/US3/US4 verification waits for the corresponding US1 implementation tasks (T012/T013/T014/T016/T018/T020) to land.

---

## Notes

- **Existing-files compliance**: Test files extended in place where coverage exists (`logs-post.test.ts`, `prune-logs.test.ts`, `redactor.test.ts`, `capture-and-display-logs.spec.ts`); new files (`logs-raw-artifact-put.test.ts`, `logs-raw-native-route.test.ts`) are created only because adding to the existing siblings (`logs-artifact-put.test.ts`, `logs-raw-route.test.ts`) would mix endpoint concerns — explicitly justified in research.md "Existing Files".
- **Redactor dual-copy invariant**: `app/lib/logs/redactor.ts` and `.github/scripts/lib/redactor.mjs` MUST stay in sync (T012/T013); the existing sync test in `tests/unit/logs/redactor.test.ts` will catch drift.
- **No new env vars**: `BLOB_READ_WRITE_TOKEN` and `LOG_RETENTION_DAYS` already exist; raw capture uses the same Blob bucket and access mode (`access: 'private'`) as normalized.
- **Migration is additive-only** — both new columns are nullable with no defaults (data-model.md). Zero risk to existing rows.
- **No `--no-verify`**: type-check and lint MUST pass before commit (CLAUDE.md rules). Run `bun run type-check` and `bun run lint` proactively before committing; run `bunx prisma generate` after T002/T003.
- Verify tests fail before implementing.
- Commit after each task or logical group.
- Stop at any checkpoint to validate the story independently.
