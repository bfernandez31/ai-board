# Feature Specification: Gemini telemetry: switch to native OTLP and remove Mistral-style batch mechanism

**Feature Branch**: `AIB-631-gemini-telemetry-switch`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Gemini telemetry: switch to native OTLP and remove Mistral-style batch mechanism"

## Auto-Resolved Decisions

- **Decision**: Adopt strict schema validation for native `gemini_cli.*` OTLP events.
- **Policy Applied**: CONSERVATIVE (fallback from AUTO)
- **Confidence**: 0.3 (Low - signals for reliability [+2] and internal debt [-2] neutralized; fallback triggered)
- **Fallback Triggered?**: Yes — confidence score below 0.5 threshold for AUTO.
- **Trade-offs**:
  1. Ensures high data integrity and reliability for cost/usage reporting.
  2. Requires more precise parser implementation compared to permissive batch scraping.
- **Reviewer Notes**: Validate that the mapping of native `gemini_cli.*` attributes correctly captures all dimensions required for the existing dashboard (costs, tokens, cached tokens).

- **Decision**: Immediately reject Gemini payloads arriving via the legacy Mistral-style batch path once the new parser is active.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: 0.3 (Low)
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Prevents "dirty" telemetry where two different mechanisms might compete or double-report.
  2. Might cause temporary telemetry loss if clients are not updated in lockstep (though Gemini CLI is usually server-controlled).
- **Reviewer Notes**: Confirm if any remote/distributed agents use the batch path and need a migration grace period.

## User Scenarios & Testing

### User Story 1 - Successful Gemini Telemetry (Priority: P1)

As a developer, I want Gemini telemetry to be captured via its native OTLP emission so that cost and usage tracking is accurate and reliable without custom scraping hacks.

**Why this priority**: Core objective of the ticket. Accuracy of cost and token usage is critical for business monitoring.

**Independent Test**: Execute a Gemini job with native OTLP flags/env vars enabled, verify `/api/telemetry/v1/logs` receives `gemini_cli.*` events, and check the dashboard for correct token counts and costs.

**Acceptance Scenarios**:

1. **Given** the server is updated with the Gemini OTLP parser, **When** a Gemini job completes successfully, **Then** the native OTLP events are parsed, and the DB is updated with accurate token usage (input/output/cached).
2. **Given** a successful Gemini job, **When** viewing the job detail in the UI, **Then** the model name, cost, and duration reflect the native telemetry data exactly.

---

### User Story 2 - Failed Gemini Job Reporting (Priority: P1)

As a developer, I want failures in Gemini execution to be captured via native telemetry so that I can accurately diagnose issues without relying on stdout scraping.

**Why this priority**: Reliability in error reporting is essential for debugging and identifying system failures.

**Independent Test**: Trigger a failing Gemini job (e.g., via invalid config), verify the error status and message are captured via native OTLP events.

**Acceptance Scenarios**:

1. **Given** a Gemini job that fails, **When** the native OTLP error events are emitted, **Then** the server captures the failure status and persists the error details in the job record.

---

### User Story 3 - Mistral Path Preservation (Priority: P2)

As a system maintainer, I want Mistral telemetry to continue using the batch mechanism so that existing Mistral integrations remain functional during the Gemini migration.

**Why this priority**: Avoids regression for other providers during refactoring.

**Independent Test**: Execute a Mistral job and verify its telemetry still flows through the batch path and is recorded correctly.

**Acceptance Scenarios**:

1. **Given** a Mistral job, **When** telemetry is sent via the batch endpoint, **Then** the server correctly routes it through the existing Mistral batch logic without interference from the new Gemini parser.

### Edge Cases

- **Partial Telemetry**: What happens if only some OTLP events are received (e.g., start but no usage)?
  - *Resolution*: The job should remain in "RUNNING" or "UNKNOWN" status until a timeout or a terminal event is received. Costs should only be finalized upon receipt of the usage event.
- **Protocol Mismatch**: How does the server handle an event that looks like Gemini but lacks mandatory OTLP attributes?
  - *Resolution*: Log a "MALFORMED_TELEMETRY" warning and skip the event to avoid DB corruption.
- **Concurrent Mistral/Gemini**: Ensure that concurrent telemetry streams for different providers don't cross-contaminate.
  - *Resolution*: Explicit routing based on event prefix (`gemini_cli.*` vs batch structure).

## Requirements

### Functional Requirements

- **FR-001**: System MUST configure Gemini CLI invocation to emit native OTLP telemetry via environment variables or CLI flags.
- **FR-002**: System MUST remove the `stream-json` mode from Gemini CLI invocations.
- **FR-003**: Server MUST implement a dedicated parser for `gemini_cli.*` OTLP log events in the `/api/telemetry/v1/logs` endpoint.
- **FR-004**: System MUST remove the "reconstruction" logic that parsed Gemini stdout/streaming JSON to create batch telemetry payloads.
- **FR-005**: Server MUST maintain the existing batch telemetry path exclusively for Mistral events.
- **FR-006**: System MUST update the cost calculation logic to use native telemetry attributes (e.g., `gemini_cli.usage.input_tokens`, `gemini_cli.usage.output_tokens`).

### Out of Scope

- Refactoring of Mistral telemetry (remains on the batch path).
- Addition of new AI providers.
- Changes to the underlying database schema for telemetry storage.
- Real-time dashboard UI components (only data availability is guaranteed).

### Key Entities

- **Telemetry Event**: Represents a native OTLP log record emitted by Gemini CLI.
- **Job**: The record updated by the telemetry events (linking tokens, costs, and status).

### Internal Processes

- **Gemini Execution & Ingestion**:
  - **Input**: User prompt, Gemini configuration.
  - **Phases**:
    1. Gemini CLI started with OTLP endpoint configured to `/api/telemetry/v1/logs`.
    2. Gemini CLI executes task and emits native OTLP events during/after execution.
    3. Server receives events, identifies `gemini_cli.*` prefix.
    4. Server parses attributes into standard internal telemetry format.
    5. Server updates Job record in DB.
  - **Output**: Updated Job record with usage and cost data.
  - **Error behavior**: If OTLP ingestion fails, server logs the error; Gemini CLI execution remains independent but telemetry might be lost.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of Gemini jobs report telemetry via the native OTLP path (verified via server logs).
- **SC-002**: Token usage (input/output/cached) reported via OTLP matches Gemini CLI internal counts with zero discrepancy.
- **SC-003**: Removal of at least 200 lines of custom "scraping" and "batch reconstruction" code.
- **SC-004**: No regressions in Mistral telemetry reporting (100% success rate for valid Mistral payloads).
