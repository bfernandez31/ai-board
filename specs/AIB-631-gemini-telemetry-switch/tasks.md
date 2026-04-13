# Tasks: Gemini Telemetry OTLP Migration

Migrate Gemini CLI telemetry from custom stdout scraping to native OTLP ingestion.

## Phase 1: Setup & Baseline
- [x] T001 Verify project structure and document baseline state per specs/AIB-631-gemini-telemetry-switch/plan.md
- [x] T002 [P] Execute existing telemetry tests to ensure a clean baseline: `npm test tests/integration/telemetry/agent-agnostic.test.ts`

## Phase 2: Server-side Gemini OTLP Ingestion (US1)
- [x] T003 [P] [US1] Create baseline integration test for Gemini OTLP in `tests/integration/telemetry/agent-agnostic.test.ts` (expect failure)
- [x] T004 [US1] Extend `app/api/telemetry/v1/logs/route.ts` to identify `gemini_cli.api_response` and `gemini_cli.tool_call` events
- [x] T005 [US1] Implement attribute extraction for `gemini_cli.usage.*` in `app/api/telemetry/v1/logs/route.ts`
- [x] T006 [US1] Implement attribute extraction for `gemini_cli.model` and `gemini_cli.duration_ms` in `app/api/telemetry/v1/logs/route.ts`
- [x] T007 [US1] Implement attribute extraction for `gemini_cli.tool_name` in `app/api/telemetry/v1/logs/route.ts`
- [x] T008 [US1] Update `updateJobMetrics` in `app/api/telemetry/v1/logs/route.ts` to trigger `estimateGeminiCost` for Gemini OTLP events
- [x] T009 [P] [US1] Verify Gemini OTLP ingestion with integration tests: `npm test tests/integration/telemetry/agent-agnostic.test.ts`

## Phase 3: Error Handling & Resilience (US2)
- [x] T010 [P] [US2] Add test case for failed Gemini job (malformed or missing attributes) in `tests/integration/telemetry/agent-agnostic.test.ts`
- [x] T011 [US2] Implement "MALFORMED_TELEMETRY" warning and graceful skip in `app/api/telemetry/v1/logs/route.ts` for invalid Gemini payloads
- [x] T012 [P] [US2] Verify error handling with integration tests: `npm test tests/integration/telemetry/agent-agnostic.test.ts`

## Phase 4: Refactor Batch Path (US3)
- [x] T013 [P] [US3] Add test case for Mistral batch telemetry to `tests/integration/telemetry/agent-agnostic.test.ts` to ensure no regression
- [x] T014 [US3] Remove Gemini-specific logic from `processBatchPayload` and `batchPayloadSchema` in `app/api/telemetry/v1/logs/route.ts`
- [x] T015 [US3] Add logic to reject Gemini payloads in `processBatchPayload` per spec.md decision
- [x] T016 [P] [US3] Verify Mistral preservation and Gemini batch rejection with integration tests

## Phase 5: Agent Runner Update
- [x] T017 Update `install_gemini` in `.github/scripts/run-agent.sh` to ensure latest version with OTLP support (if version pinning is required)
- [x] T018 Refactor `invoke_gemini` in `.github/scripts/run-agent.sh` to remove `--output-format stream-json` and `2>&1 | tee "$output_file"`
- [x] T019 Update `invoke_gemini` in `.github/scripts/run-agent.sh` to export `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_RESOURCE_ATTRIBUTES` (including `job_id`)
- [x] T020 Remove `collect_gemini_telemetry` function and its invocation from `.github/scripts/run-agent.sh`
- [x] T021 Remove `GEMINI_STREAM_FILE` exports and related temp file cleanups in `.github/scripts/run-agent.sh`

## Phase 6: Polish & Validation
- [x] T022 [P] Run all telemetry-related tests: `npm test tests/integration/telemetry/`
- [x] T023 Perform a full dry-run of `.github/scripts/run-agent.sh` with `AGENT_TYPE=GEMINI` in a local/simulated CI environment
- [x] T024 Final code review for `any` types or strict mode violations in modified files

## Dependencies
1. **US1 Completion** (T003-T009) is required before **US2** (T010-T012).
2. **Server-side updates** (Phase 2 & 3) must be verified before **Agent Runner updates** (Phase 5) to avoid telemetry loss.
3. **Phase 4** (Batch Refactor) can be done in parallel with Phase 2/3 but should wait for US1 verification to be safe.

## Parallel Execution
- **Setup** (T002) and **Server Implementation** (T003) can start simultaneously.
- **US1 Tests** (T003) and **US1 Implementation** (T004-T007) can be developed in parallel if test payload is mocked.
- **Mistral Regression Tests** (T013) can be run anytime during server refactoring.

## Implementation Strategy
- **MVP**: Complete Phase 2 (T003-T009). This delivers the core value of accurate Gemini telemetry.
- **Incremental**: Follow with Phase 3 (Resilience) then Phase 5 (Runner update). Phase 4 (Cleanup) is the final technical debt reduction.
