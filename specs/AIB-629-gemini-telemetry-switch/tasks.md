# Tasks: Gemini Telemetry — Switch to Native OTLP

**Input**: Design documents from `/specs/AIB-629-gemini-telemetry-switch/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks are included by default (constitution). All test modifications extend the existing file `tests/integration/telemetry/agent-agnostic.test.ts`.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 — Gemini Job Produces Complete Native Telemetry (Priority: P1) 🎯 MVP

**Goal**: Replace Gemini's fragile batch telemetry (stream-JSON scraping → jq → curl) with native OTLP emission. After this phase, Gemini jobs emit telemetry via standard OTEL env vars, the telemetry endpoint parses `gemini_cli.*` events, and the agent script no longer performs post-execution batch collection.

**Independent Test**: Dispatch a Gemini OTLP payload to `/api/telemetry/v1/logs` and verify the job record contains correct token breakdown, model, duration, cost estimate, and tools used — with no stream-JSON file produced.

### Tests for User Story 1

- [x] T001 [P] [US1] ✅ DONE — Extend Gemini OTLP test suite in `tests/integration/telemetry/agent-agnostic.test.ts`: replace `describe('Gemini native batch telemetry')` with `describe('Gemini native OTLP telemetry')` containing test cases for: (a) `gemini_cli.api_response` event updates Job with input/output/thinking/cache-read/cache-creation tokens, model, duration, and estimated cost; (b) `gemini_cli.tool_call` and `gemini_cli.tool_result` events add tools to `toolsUsed`; (c) multiple OTLP batches accumulate correctly in DELTA mode; (d) unsupported model preserves telemetry with cost = null
- [x] T002 [P] [US1] ✅ DONE — Extend cost estimation tests in `tests/integration/telemetry/agent-agnostic.test.ts`: add test cases validating `estimateGeminiCost()` works correctly for all supported models (gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash) when invoked via the OTLP path

### Implementation for User Story 1

- [x] T003 [US1] ✅ DONE — Add Gemini OTLP event handler in `app/api/telemetry/v1/logs/route.ts`: add `isGeminiApiResponse` check (`eventName === 'gemini_cli.api_response'`), parse token attributes (`input_tokens`, `output_tokens`, `thinking_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `duration_ms`, `model`) using `parseIntAttribute(findAttribute(...))` pattern, set `geminiCostModel` on metrics for server-side cost estimation (follow Codex pattern at lines 164-188)
- [x] T004 [US1] ✅ DONE — Add Gemini tool events to tool detection list in `app/api/telemetry/v1/logs/route.ts`: add `gemini_cli.tool_call` and `gemini_cli.tool_result` to the tool event name list so Gemini tool usage is captured in `toolsUsed`
- [x] T005 [US1] ✅ DONE — Remove `--output-format stream-json` flag and `tee "$output_file"` pipe from `invoke_gemini()` in `.github/scripts/run-agent.sh`; remove `output_file` variable and `GEMINI_STREAM_FILE` export
- [x] T006 [US1] ✅ DONE — Delete `collect_gemini_telemetry()` function entirely from `.github/scripts/run-agent.sh` (lines 729-791)
- [x] T007 [US1] ✅ DONE — Simplify Gemini dispatch block in `.github/scripts/run-agent.sh` (lines 816-823): remove `gemini_exit=0`, `invoke_gemini || gemini_exit=$?`, `collect_gemini_telemetry`, `exit $gemini_exit` — replace with simple `invoke_gemini` call (matching Claude dispatch pattern at lines 796-800)

**Checkpoint**: Gemini OTLP events are parsed and stored correctly. Agent script no longer performs batch telemetry collection. All US1 tests pass.

---

## Phase 2: User Story 2 — Gemini Job Failure Surfaces Clearly (Priority: P1)

**Goal**: Ensure Gemini job failures are captured through the native OTLP path, preventing silent-success states that occurred when batch scraping found no data.

**Independent Test**: Trigger a scenario where a Gemini job produces no OTLP events and verify the job record retains null/missing-telemetry state rather than fabricated success metrics.

### Tests for User Story 2

- [x] T008 [US2] ✅ DONE — Extend failure-path tests in `tests/integration/telemetry/agent-agnostic.test.ts`: add test case verifying that when no Gemini OTLP events arrive for a job, the job retains null metrics (missing-telemetry state) — no fabricated success; verify existing OTLP error-handling behavior (no `job_id` in resource attributes returns 200 with warning) applies to Gemini events

### Implementation for User Story 2

No additional implementation required — US2 is covered by the existing OTLP error-handling path (`route.ts:199-206`) which already handles missing `job_id` and empty telemetry. The removal of batch collection in US1 (T005-T007) eliminates the silent-success failure mode. T008 validates this behavior.

**Checkpoint**: Gemini job failures surface correctly through native telemetry. Missing-telemetry state is preserved when OTLP emission fails. US2 test passes.

---

## Phase 3: User Story 3 — Mistral Batch Telemetry Remains Unaffected (Priority: P1)

**Goal**: Remove all Gemini-specific batch code from the telemetry endpoint while preserving Mistral batch ingestion with identical behavior and accuracy.

**Independent Test**: Submit a Mistral batch payload to the telemetry endpoint and verify it is processed with the same metrics and cost accuracy as before the migration.

### Tests for User Story 3

- [x] T009 [US3] ✅ DONE — Verify existing Mistral batch tests pass unchanged in `tests/integration/telemetry/agent-agnostic.test.ts`: run the existing Mistral batch test suite and confirm zero regressions after batch handler simplification (no new test code needed — this is a regression gate)

### Implementation for User Story 3

- [x] T010 [US3] ✅ DONE — Remove `agent` field from `batchPayloadSchema` in `app/api/telemetry/v1/logs/route.ts` (line 14)
- [x] T011 [US3] ✅ DONE — Remove `usageSnapshotMode` field from `batchPayloadSchema` in `app/api/telemetry/v1/logs/route.ts` (line 25)
- [x] T012 [US3] ✅ DONE — Remove Gemini input token normalization in `processBatchPayload()` in `app/api/telemetry/v1/logs/route.ts` (lines 559-562: `if (data.agent === 'GEMINI')` block)
- [x] T013 [US3] ✅ DONE — Remove Gemini cost estimation branch in `app/api/telemetry/v1/logs/route.ts` (lines 566-568) and simplify cost estimation to Mistral-only by removing `data.agent !== 'GEMINI'` guard (lines 569-578)
- [x] T014 [US3] ✅ DONE — Remove `usageSnapshotMode` variable in `app/api/telemetry/v1/logs/route.ts` — always use DELTA mode; update `updateJobMetrics` call to omit merge mode parameter (line 581)

**Checkpoint**: Batch handler is Mistral-only. All Gemini-specific batch code removed. Existing Mistral batch tests and Claude/Codex OTLP tests pass unchanged.

---

## Phase 4: User Story 4 — Updated AIB-626 Documentation (Priority: P2)

**Goal**: Update AIB-626 specifications and telemetry contracts to reflect native OTLP as the sole Gemini telemetry mechanism.

**Independent Test**: Review all Gemini telemetry documentation and confirm no references to batch, stream-JSON, or post-run reconstruction remain.

### Implementation for User Story 4

- [x] T015 [P] [US4] ✅ DONE — Update `specs/AIB-626-fix-gemini-telemetry/spec.md`: add note that the batch approach was replaced by native OTLP in AIB-629
- [x] T016 [P] [US4] ✅ DONE — Update `specs/AIB-626-fix-gemini-telemetry/contracts/telemetry-api.md`: mark Gemini batch payload as superseded; reference AIB-629 contract at `specs/AIB-629-gemini-telemetry-switch/contracts/telemetry-api.md`
- [x] T017 [P] [US4] ✅ DONE — Update `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-native-telemetry-emission.md`: remove stream-json references; add note referencing AIB-629 emission workflow
- [x] T018 [P] [US4] ✅ DONE — Update `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-telemetry-intake.md`: remove batch normalization references; add note referencing AIB-629 intake workflow

**Checkpoint**: All AIB-626 documentation updated. No stale references to Gemini batch telemetry remain.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all user stories

- [x] T019 ✅ DONE — Run full integration test suite (`bun run test:integration`) to verify zero regressions across all telemetry paths (Claude OTLP, Codex OTLP, Gemini OTLP, Mistral batch)
- [x] T020 ✅ DONE — Run `bun run type-check` and `bun run lint` to verify no type errors or lint violations introduced

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: No dependencies — can start immediately (MVP)
- **Phase 2 (US2)**: Depends on Phase 1 (US1 T003-T007 must be complete for failure-path validation)
- **Phase 3 (US3)**: Depends on Phase 1 (Gemini OTLP handler must exist before removing Gemini batch code)
- **Phase 4 (US4)**: No code dependencies — can run in parallel with Phases 2-3
- **Phase 5 (Polish)**: Depends on all previous phases

### User Story Dependencies

- **US1 (P1)**: No dependencies — start here
- **US2 (P1)**: Depends on US1 implementation (T003-T007)
- **US3 (P1)**: Depends on US1 implementation (T003-T007) — Gemini must use OTLP before removing batch
- **US4 (P2)**: Independent of code changes — can run in parallel with US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation (T001-T002 before T003-T007)
- Within US1: T003-T004 (endpoint) can be done before or in parallel with T005-T007 (script), as they modify different files
- Within US3: T010-T014 are sequential (same file, interdependent removals)
- Within US4: T015-T018 are all parallel (different files)

### Parallel Opportunities

```
Phase 1 (US1):
  Parallel: T001 + T002 (tests in same file but independent test suites)
  Parallel: T003+T004 (route.ts) || T005+T006+T007 (run-agent.sh) — different files

Phase 2 (US2) || Phase 4 (US4):
  Parallel: T008 (US2 test) || T015+T016+T017+T018 (US4 docs — all parallel)

Phase 3 (US3):
  Sequential: T010 → T011 → T012 → T013 → T014 (same file, interdependent)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: US1 — Gemini native OTLP (tests + endpoint handler + script cleanup)
2. **STOP and VALIDATE**: Run `bun run test:integration` — US1 tests pass, no regressions
3. This is the core migration and delivers the primary value

### Incremental Delivery

1. US1 → Gemini OTLP works end-to-end (MVP!)
2. US2 → Failure path validated (confidence gate)
3. US3 → Batch handler simplified, Mistral regression-free
4. US4 → Documentation updated
5. Polish → Full regression suite green

---

## Notes

- All modifications target existing files — no new source files created
- Single test file extended: `tests/integration/telemetry/agent-agnostic.test.ts`
- No database schema changes (data-model.md confirms existing Job fields sufficient)
- Existing `estimateGeminiCost()` function reused as-is
- OTEL env vars in workflow YAML files already configured correctly — no workflow file changes needed
