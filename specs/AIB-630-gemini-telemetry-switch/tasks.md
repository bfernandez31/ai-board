# Tasks: Gemini Telemetry via Native Provider Events

**Input**: Design documents from `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Test tasks are included by default per constitution. Existing telemetry and jobs test files are extended before any new test file is introduced.

**Organization**: Tasks are grouped by user story so each story can be implemented and verified independently.

## Phase 1: Setup

**Purpose**: Establish the native Gemini telemetry runner contract and shared OTLP schema support required by every story.

- [ ] T001 Extend `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` to configure Gemini native OTLP export settings and remove `--output-format stream-json` / `GEMINI_STREAM_FILE` assumptions from Gemini execution
- [ ] T002 [P] Extend `/home/runner/work/ai-board/ai-board/target/lib/schemas/otlp.ts` with any helper or attribute compatibility needed for Gemini `gemini_cli.*` OTLP log records and mixed string-or-number fields

---

## Phase 2: Foundational

**Purpose**: Lock in provider routing so all later story work builds on a single supported Gemini-native path and a Mistral-only batch path.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T003 Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` to route OTLP records by provider event identity, keep `processBatchPayload()` as the Mistral-only branch, and remove Gemini from the supported batch contract
- [ ] T004 [P] Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/otlp-schema.test.ts` with failing-first Gemini-native OTLP validation cases and Gemini batch-contract rejection coverage

**Checkpoint**: Gemini has a single native telemetry path and batch JSON is explicitly reserved for Mistral before story-specific work begins.

---

## Phase 3: User Story 1 - Trust Gemini Job Telemetry Again (Priority: P1) 🎯 MVP

**Goal**: Successful Gemini jobs persist native model, token, tool, duration, and cost data without reconstructed batch snapshots.

**Independent Test**: Run a successful Gemini job, ingest native `gemini_cli.*` OTLP events, and verify `/api/projects/[projectId]/tickets/[id]/jobs` shows the same normalized telemetry values already stored on the `Job`.

### Tests for User Story 1

- [ ] T005 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Gemini-native OTLP success cases covering model, input/output tokens, cached tokens, tool events, duration, and supported-model cost handling
- [ ] T006 [P] [US1] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts` with Gemini-native telemetry visibility assertions for `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/jobs/route.ts`

### Implementation for User Story 1

- [ ] T007 [US1] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` to parse Gemini `gemini_cli.*` API and tool events, normalize native token buckets, estimate or store cost from native fields, and merge the result onto the existing `Job` telemetry columns
- [ ] T008 [US1] Extend `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` to invoke Gemini in standard mode with native telemetry enabled and stop posting reconstructed Gemini batch payloads after execution

**Checkpoint**: User Story 1 is complete when successful Gemini jobs produce trustworthy native telemetry on existing job surfaces with no reconstructed batch path involved.

---

## Phase 4: User Story 2 - See Failures Reported Correctly (Priority: P1)

**Goal**: Failed Gemini jobs remain failed even when native telemetry is partial, delayed, or absent.

**Independent Test**: Force a Gemini job to fail, send partial or no Gemini telemetry, and verify the job remains failed while any valid native telemetry received before failure stays attached to that job.

### Tests for User Story 2

- [ ] T009 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts` with Gemini failure cases where `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts` remains authoritative for terminal status and duration fallback
- [ ] T010 [P] [US2] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with partial Gemini-native OTLP, missing-job correlation, and absent-telemetry scenarios that must not mutate another job or imply success

### Implementation for User Story 2

- [ ] T011 [US2] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` to merge partial Gemini telemetry safely, preserve nulls for missing optional native fields, and ignore unmatched `job_id` payloads without corrupting persisted job metrics
- [ ] T012 [US2] Extend `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts` to preserve failed and cancelled Gemini terminal states plus wall-clock `durationMs` backfill when native Gemini telemetry is late or missing

**Checkpoint**: User Story 2 is complete when Gemini failures are visible as failures regardless of telemetry completeness and valid pre-failure telemetry is still retained.

---

## Phase 5: User Story 3 - Preserve Mistral Behavior While Removing Gemini Debt (Priority: P2)

**Goal**: Mistral continues using the existing batch path while Gemini is handled only by native OTLP and all internal docs reflect that split.

**Independent Test**: Process one Mistral batch payload and one Gemini-native OTLP payload in the same environment, verify each provider uses its intended path, and confirm the technical docs no longer describe Gemini as batch-based.

### Tests for User Story 3

- [ ] T013 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Mistral batch non-regression coverage and rejected Gemini batch-payload scenarios

### Implementation for User Story 3

- [ ] T014 [US3] Extend `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` to reject Gemini batch submissions while preserving the existing Mistral batch merge behavior and non-Gemini OTLP handling
- [ ] T015 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/api/endpoints.md`, `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/integrations.md`, `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/plugin-architecture.md`, and `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/architecture/overview.md` to document Gemini-native OTLP routing and Mistral-only batch telemetry
- [ ] T016 [P] [US3] Extend `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md` and `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md` to remove historical Gemini batch guidance and point to the supported native-provider path

**Checkpoint**: User Story 3 is complete when provider routing is explicit in code and docs, Mistral still works on batch telemetry, and Gemini no longer has any supported batch fallback.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Run focused regression cleanup and repo validation across the touched telemetry surfaces.

- [ ] T017 [P] Run focused regression cleanup against `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/otlp-schema.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts`, `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`, and `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts`
- [ ] T018 Run final validation cleanup for `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`, `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`, `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts`, and `/home/runner/work/ai-board/ai-board/target/lib/schemas/otlp.ts` with `bun run test:unit`, `bun run test:integration`, `bun run type-check`, and `bun run lint`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately and establishes the Gemini-native runner plus shared OTLP schema support.
- **Foundational (Phase 2)**: Depends on Setup and blocks every story by defining the provider-routing boundary.
- **User Story 1 (Phase 3)**: Depends on Foundational and should land first because it establishes the supported Gemini-native success path.
- **User Story 2 (Phase 4)**: Depends on User Story 1 because failure handling builds on the native Gemini parser and runner contract.
- **User Story 3 (Phase 5)**: Depends on User Story 1 because Gemini batch removal is only safe once native OTLP handling is complete.
- **Polish (Phase 6)**: Depends on all desired stories being complete.

### User Story Dependencies

- **US1**: No story dependency beyond Foundational.
- **US2**: Requires US1 for the native Gemini ingestion path it hardens.
- **US3**: Requires US1 for the native Gemini path and can proceed in parallel with US2 after US1 stabilizes.

### Within Each User Story

- Tests must be written and fail before implementation changes in that story.
- Route-level parser and merge changes come before runner or documentation cleanup that depends on them.
- Status-route hardening follows the failure-path tests that expose regressions.
- A story is complete only when its independent test passes without relying on unfinished later stories.

### Parallel Opportunities

- `T001` and `T002` can proceed in parallel because they touch different files.
- `T003` and `T004` can proceed in parallel once the setup contract is clear.
- Within US1, `T005` and `T006` can proceed in parallel before `T007` and `T008`.
- Within US2, `T009` and `T010` can proceed in parallel before `T011` and `T012`.
- Within US3, `T015` and `T016` can proceed in parallel after `T014` defines the final provider boundary.

---

## Parallel Example: User Story 1

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts with Gemini-native OTLP success cases covering model, input/output tokens, cached tokens, tool events, duration, and supported-model cost handling"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts with Gemini-native telemetry visibility assertions for /home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/jobs/route.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts with Gemini failure cases where /home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts remains authoritative for terminal status and duration fallback"
Task: "Extend /home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts with partial Gemini-native OTLP, missing-job correlation, and absent-telemetry scenarios that must not mutate another job or imply success"
```

## Parallel Example: User Story 3

```bash
Task: "Extend /home/runner/work/ai-board/ai-board/target/specs/specifications/technical/api/endpoints.md, /home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/integrations.md, /home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/plugin-architecture.md, and /home/runner/work/ai-board/ai-board/target/specs/specifications/technical/architecture/overview.md to document Gemini-native OTLP routing and Mistral-only batch telemetry"
Task: "Extend /home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md and /home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md to remove historical Gemini batch guidance and point to the supported native-provider path"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate Gemini-native success-path telemetry independently before expanding scope.

### Incremental Delivery

1. Land the native Gemini runner and provider-routing boundary first.
2. Deliver US1 so successful Gemini jobs regain trustworthy telemetry.
3. Deliver US2 so failure visibility is preserved when telemetry is partial or absent.
4. Deliver US3 to lock in the Mistral/Gemini split and remove contradictory documentation.
5. Finish with focused regression, type-check, and lint cleanup.
