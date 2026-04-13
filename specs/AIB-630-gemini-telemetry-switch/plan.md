# Implementation Plan: Gemini Telemetry via Native Provider Events

**Branch**: `AIB-630-gemini-telemetry-switch` | **Date**: 2026-04-13 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/spec.md`

## Summary

Replace Gemini's current `stream-json` plus reconstructed batch telemetry flow with first-class OTLP log ingestion from native `gemini_cli.*` provider events. The design keeps Mistral on the existing batch path, preserves failure visibility when Gemini telemetry is partial or absent, and updates the internal technical specs that still describe Gemini as batch-based.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Feature | Switch Gemini from reconstructed batch telemetry to native provider OTLP log events |
| Runtime | TypeScript 5.9 strict, Node.js 22.20.0, Next.js 16 App Router, Prisma 6.x, Bash in GitHub Actions |
| Telemetry entrypoint | `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` already accepts OTLP log payloads and Mistral batch payloads |
| Gemini runtime today | `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` invokes `gemini --output-format stream-json`, captures stdout, and posts a reconstructed batch payload |
| Storage | Existing `Job` telemetry columns in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` already store model, token buckets, duration, cost, and tools |
| Auth | Workflow bearer token via `validateWorkflowAuth()` for telemetry and job-status callbacks |
| Existing UI surfaces | Ticket jobs API, timeline/detail views, and analytics already read from persisted `Job` telemetry fields |
| Documentation debt | Internal specs under `specs/specifications/technical/` and earlier Gemini design artifacts still describe Gemini as batch-based |
| Unknowns at start | Native Gemini event mapping, provider routing split, and documentation update scope were initial NEEDS CLARIFICATION items; all are resolved in `research.md` |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | Planned app changes stay inside typed route, schema, and analytics code. |
| II. Component-Driven | PASS | UI behavior remains on existing ticket and analytics surfaces; no new frontend architecture is introduced. |
| III. Test-Driven | PASS | Existing telemetry and analytics tests were discovered and will be extended rather than duplicated. |
| IV. Security-First | PASS | Workflow auth remains centralized, Gemini auth stays in env-backed runner setup, and no pricing or credentials move client-side. |
| V. Database Integrity | PASS | No schema migration is required for this switch because the `Job` model already contains the needed telemetry fields. |
| V. Spec Clarification | PASS | The feature spec includes auto-resolved decisions and this plan stays within that conservative correctness-focused scope. |

**Gate Result**: PASS. Proceed with research and design.

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| Validation before mutation | PASS | Gemini OTLP logs stay inside the existing auth, JSON-parse, schema-validate, then persist route flow. |
| Failure propagation preserved | PASS | Job status remains authoritative through `/api/jobs/[id]/status`; telemetry never becomes a success fallback. |
| Existing tests extended first | PASS | `tests/integration/telemetry/agent-agnostic.test.ts`, `tests/unit/telemetry/otlp-schema.test.ts`, and related analytics tests are the primary coverage homes. |
| No weaker secret handling | PASS | Gemini auth continues to use `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`; bearer headers are still passed via workflow env vars only. |
| Provider boundary explicit | PASS | Mistral remains on batch JSON while Gemini moves to native `gemini_cli.*` OTLP parsing with no Gemini batch fallback. |

**Gate Result**: PASS. No blocking violations after design.

## Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/research.md` | Resolved unknowns, existing-file inventory, implementation patterns |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/data-model.md` | Job, Gemini event, and routing semantics for the native OTLP path |
| Telemetry Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/contracts/telemetry-api.md` | OTLP request contract and provider routing rules for `/api/telemetry/v1/logs` |
| Gemini Execution Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/workflows/gemini-workflow-execution.md` | Runner-side native telemetry emission design |
| Gemini Intake Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/workflows/gemini-telemetry-ingestion.md` | Route-side parsing, correlation, and persistence flow |
| Provider Routing Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/workflows/provider-telemetry-routing.md` | Mistral batch vs Gemini OTLP routing contract |

## Implementation Phases

### Phase 0: Research and Discovery

**Goal**: Resolve native-event mapping, identify real source/test/doc files, and capture implementation patterns.

**Outputs**:
1. `/home/runner/work/ai-board/ai-board/target/specs/AIB-630-gemini-telemetry-switch/research.md`

**Completed research outcomes**:
1. Mapped Gemini's current runner path in `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`.
2. Confirmed the telemetry route already supports OTLP logs and only needs a Gemini-native parser path in `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`.
3. Identified the internal docs that must stop describing Gemini as batch-based.

### Phase 1: Native Gemini Runner and OTLP Intake Design

**Goal**: Design the runner and route changes that remove Gemini's batch reconstruction path while preserving existing storage and job-state semantics.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`
2. `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`
3. `/home/runner/work/ai-board/ai-board/target/lib/schemas/otlp.ts`
4. `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts`
5. `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/otlp-schema.test.ts`

**Pattern requirements**:
- Follow the auth and schema-validation path from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:63-118`.
- Follow the re-read then merge pattern from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:275-352`.
- Preserve non-blocking telemetry side effects like the runner's Mistral sender and the job-status notification pattern in `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts:250-257`.
- Preserve Gemini auth handling from `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:691-699`.

**Design notes**:
- Replace Gemini `--output-format stream-json` execution with standard Gemini invocation plus native telemetry environment setup.
- Route Gemini by OTLP event identity (`gemini_cli.*`) instead of top-level batch JSON shape.
- Keep `Job.status` updates driven by `/api/jobs/[id]/status`, not by telemetry event arrival.

### Phase 2: Provider Routing, Functional Parity, and Documentation Alignment

**Goal**: Define the provider split, parity guarantees, and specification updates needed for the new supported path.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/api/endpoints.md`
2. `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/integrations.md`
3. `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/plugin-architecture.md`
4. `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/architecture/overview.md`
5. `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md`
6. `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md`
7. `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts`
8. `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts`

**Pattern requirements**:
- Follow the current provider boundary where only Mistral uses `processBatchPayload()` in `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:526-583`.
- Preserve duration backfill and terminal-status behavior from `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts:207-239`.
- Keep documentation aligned with real behavior and environment variables already used by the workflows.

**Design notes**:
- Mistral remains the only supported batch sender after this ticket.
- Gemini native OTLP parsing must preserve model, input, output, cached tokens, duration, cost, and final outcome visibility where available.
- Internal docs must stop telling operators to expect `collect_gemini_telemetry()` or batch fallback for Gemini.

## Testing Strategy

- Default to integration coverage for telemetry and job-status behavior per constitution section III.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` with Gemini-native OTLP success, partial-failure, missing-job, and Mistral non-regression cases.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/otlp-schema.test.ts` so Gemini-native payloads validate through the shared OTLP schema.
- Extend `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts` or `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts` for failed-job visibility when telemetry is absent or partial.
- Update any legacy Gemini batch assertions in existing specs or tests instead of creating a new Gemini-only suite.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Native Gemini OTLP event attributes differ from the current parser assumptions | Medium | High | Isolate Gemini event mapping in the telemetry route and cover it with integration tests and schema tests. |
| Gemini failures still appear successful because status and telemetry paths drift | Medium | High | Keep `/api/jobs/[id]/status` authoritative and add failure-path tests that omit or partially send telemetry. |
| Gemini-specific batch code remains reachable after the switch | High | Medium | Remove runner-side Gemini batch posting and enforce provider routing by OTLP event identity. |
| Internal specs remain contradictory after implementation | High | Medium | Update the technical docs and prior Gemini design artifacts called out in research before considering the ticket complete. |
