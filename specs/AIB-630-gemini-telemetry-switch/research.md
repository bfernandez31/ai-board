# Research: Gemini Telemetry via Native Provider Events

**Branch**: `AIB-630-gemini-telemetry-switch`
**Created**: 2026-04-13

## Resolved Unknowns

### 1. Gemini native ingestion boundary

- Decision: Treat Gemini as an OTLP log producer at `/api/telemetry/v1/logs` and parse `gemini_cli.*` events inside the route's OTLP branch instead of translating Gemini into top-level batch JSON.
- Rationale: The route already authenticates, validates, correlates `job_id`, and merges OTLP telemetry for Claude and Codex. Extending that first-class path keeps Gemini aligned with the native provider format the spec requires.
- Alternatives considered:
  - Keep Gemini on a reconstructed batch path and improve the parser. Rejected because FR-003 and FR-004 explicitly remove that design.
  - Create a Gemini-only telemetry endpoint. Rejected because it would duplicate workflow auth and merge logic already centralized in the existing route.

### 2. Gemini runner emission strategy

- Decision: Configure native Gemini telemetry emission in `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` and invoke Gemini in standard mode rather than `--output-format stream-json`.
- Rationale: The current runner is the only place where Gemini execution mode is chosen. The request explicitly removes stdout reconstruction and requires official native telemetry emission for Gemini runs.
- Alternatives considered:
  - Continue capturing standard stdout and parse it opportunistically. Rejected because that is still reconstruction and does not satisfy FR-001 or FR-002.
  - Keep `stream-json` just for fallback. Rejected because the feature scope says Gemini must not rely on a batch fallback path after the switch.

### 3. Failure-state ownership

- Decision: Keep job outcome ownership in `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts`; Gemini telemetry enriches the job but must never decide success on its own.
- Rationale: The status route already validates transitions, sets terminal timestamps, and backfills duration when telemetry is absent. That is the existing defensive pattern that prevents silent-success behavior.
- Alternatives considered:
  - Mark Gemini jobs successful from a final telemetry event. Rejected because telemetry can be partial, delayed, or absent.
  - Infer failure only from missing telemetry. Rejected because it would couple provider delivery issues to workflow state incorrectly.

### 4. Storage and parity semantics

- Decision: Reuse the existing `Job` telemetry columns in `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` for Gemini-native metrics without a schema change.
- Rationale: `Job` already has `inputTokens`, `outputTokens`, `thinkingTokens`, `cacheReadTokens`, `cacheCreationTokens`, `durationMs`, `costUsd`, `model`, and `toolsUsed`. The switch is about source and routing, not persistence shape.
- Alternatives considered:
  - Add Gemini-specific columns. Rejected because the current schema already covers the fields named in FR-007.
  - Store raw Gemini payloads only. Rejected because all existing product surfaces read the normalized `Job` columns.

### 5. Documentation update scope

- Decision: Update the technical docs and earlier Gemini design artifacts that still describe Gemini as `stream-json` plus batch JSON.
- Rationale: FR-011 requires internal documentation and specs to reflect the supported path. The current docs under `specs/specifications/technical/` and `specs/AIB-612-add-gemini-cli/` still document the old integration.
- Alternatives considered:
  - Update only the new ticket artifacts. Rejected because it leaves contradictory operational guidance in the shared technical specs.
  - Leave AIB-612 unchanged because it is historical. Rejected because operators will still use that design artifact as reference.

## Existing Files

### Telemetry runner and route

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh` | Gemini CLI installation, auth, invocation mode, and current reconstructed batch sender | Extend |
| `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts` | Shared workflow-authenticated telemetry intake, OTLP parsing, batch parsing, merge/update logic, and provider pricing helpers | Extend |
| `/home/runner/work/ai-board/ai-board/target/lib/schemas/otlp.ts` | Shared OTLP JSON schema and attribute helpers used by the route | Extend if Gemini attributes need schema/helper support |
| `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts` | Workflow-controlled job state transitions, terminal timestamps, and duration fallback | Reuse as pattern reference |
| `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` | Existing normalized `Job` telemetry storage fields and `Agent` enum | Reuse as-is |

### Existing product surfaces fed by persisted job telemetry

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/tickets/[id]/jobs/route.ts` | Ticket job detail API that exposes job telemetry | Reuse as-is |
| `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/jobs/route.ts` | Project jobs API used by polling and UI surfaces | Reuse as-is |
| `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts` | Aggregated analytics over normalized `Job` fields | Reuse as-is |
| `/home/runner/work/ai-board/ai-board/target/components/ticket/jobs-timeline.tsx` | Ticket timeline consumption of job telemetry/status | Reuse as-is |
| `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx` | Dashboard view for telemetry-derived analytics | Reuse as-is |

### Test files to extend first

| File | Coverage today | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts` | OTLP route behavior for Claude/Codex and batch behavior for Mistral/Gemini | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/unit/telemetry/otlp-schema.test.ts` | Shared OTLP schema validation, including snake_case compatibility | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/status.test.ts` | Workflow job status update lifecycle and terminal-state behavior | Extend |
| `/home/runner/work/ai-board/ai-board/target/tests/integration/jobs/ticket-jobs.test.ts` | Ticket job API visibility for status and telemetry fields | Extend |

### Internal documentation and prior design artifacts to update

| File | What it covers | Extend or create |
|------|----------------|------------------|
| `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/api/endpoints.md` | Shared public/internal API contract for `/api/telemetry/v1/logs` | Extend |
| `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/integrations.md` | `run-agent.sh` operational integration design across agents | Extend |
| `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/plugin-architecture.md` | Cross-agent runtime differences and telemetry overview | Extend |
| `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/architecture/overview.md` | High-level architecture statement for telemetry collection | Extend |
| `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md` | Prior Gemini design artifact that still documents batch JSON | Extend |
| `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md` | Prior Gemini workflow artifact describing stream-json ingestion | Extend |

## Patterns to Follow

### 1. Workflow-authenticated route validation before mutation

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:63-118`
- Error handling pattern:
  - Validate workflow auth first.
  - Return structured `400` responses for invalid JSON or invalid OTLP shape.
  - Log contextual diagnostics server-side and keep external errors generic.
- Security pattern:
  - Auth stays inside `validateWorkflowAuth()`.
  - No auth headers or secret values are logged.
- State-management pattern:
  - No database writes happen until body parsing and schema validation finish.

### 2. Re-read then merge normalized telemetry into `Job`

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:275-352`
- Error handling pattern:
  - Re-fetch the job and return `404` if it no longer exists.
- Security pattern:
  - Only explicitly selected telemetry fields are read and updated.
- State-management pattern:
  - Use normalized `Job` columns as the single persisted truth.
  - Deduplicate `toolsUsed` with set semantics and stable sort order.
  - Only overwrite `model` when the current telemetry batch provides one.

### 3. Batch routing remains provider-specific, not generic fallback

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:92-96`, `:526-583`
- Error handling pattern:
  - Batch payloads are separately schema-validated before persistence.
- Security pattern:
  - Batch writes still rely on the same workflow bearer-token auth as OTLP writes.
- State-management pattern:
  - `processBatchPayload()` is the dedicated Mistral-compatible path.
- Implementation implication:
  - Gemini must be removed from the supported batch contract after the switch rather than left as an implicit fallback.

### 4. Runner secret handling and exit-code preservation

- Reference: `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:691-726`, `:816-823`
- Error handling pattern:
  - Install/auth/invocation failures fail the workflow step.
  - Telemetry collection is kept out of the critical path for the Gemini exit code.
- Security pattern:
  - OAuth material is restored to `~/.gemini/oauth.json` with `chmod 600`.
  - Runtime credentials come from env vars only.
- State-management pattern:
  - The runner decides provider setup and invocation mode centrally for all workflows.
- Implementation implication:
  - Native Gemini telemetry setup belongs in the runner, but outcome reporting still depends on the workflow status callback.

### 5. Terminal-state fallback stays in the job status API

- Reference: `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts:181-239`
- Error handling pattern:
  - Status transitions are validated against the state machine before persistence.
- Security pattern:
  - Workflow auth gates status mutations just as it gates telemetry.
- State-management pattern:
  - Terminal timestamps come from the status callback.
  - Duration is backfilled from wall clock only after terminal persistence and only when telemetry did not provide one.
- Implementation implication:
  - Gemini telemetry can enrich failed jobs, but missing telemetry must never suppress a failed status.

## Source Notes

- The current shared technical specs still state that Gemini uses `stream-json` plus batch JSON:
  - `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/api/endpoints.md:3238-3250`
  - `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/integrations.md:522-540`
  - `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/implementation/plugin-architecture.md:277-284`
  - `/home/runner/work/ai-board/ai-board/target/specs/specifications/technical/architecture/overview.md:330-335`
- The earlier Gemini design artifact also documents the batch path and must be updated to avoid conflicting guidance:
  - `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/contracts/telemetry-api.md`
  - `/home/runner/work/ai-board/ai-board/target/specs/AIB-612-add-gemini-cli/workflows/gemini-usage-ingestion.md`
