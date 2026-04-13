# Feature Specification: Gemini Telemetry — Switch to Native OTLP and Remove Batch Mechanism

**Feature Branch**: `AIB-629-gemini-telemetry-switch`
**Created**: 2026-04-13
**Status**: Draft
**Input**: User description: "Gemini telemetry: switch to native OTLP and remove Mistral-style batch mechanism"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat this as a full-scope correctness migration rather than a minimal swap, ensuring that every telemetry path (emission, ingestion, cost estimation, test coverage, documentation) is migrated atomically so no intermediate state ships with partial batch and partial OTLP.
- **Policy Applied**: AUTO -> CONSERVATIVE fallback
- **Confidence**: Low (score: +2, absScore: 2) — reliability signals (+2 for native OTLP, +2 for fragile collection) are offset by internal-refactoring signals (-2 for debt removal, -2 for batch cleanup), yielding low net confidence.
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5 (0.3), so the guardrail required a conservative fallback.
- **Trade-offs**:
  1. Atomic migration reduces risk of shipping a half-migrated telemetry path where some jobs emit OTLP and others still rely on batch reconstruction.
  2. Larger changeset increases review surface, but eliminates the need for follow-up patches that have plagued the current batch approach.
- **Reviewer Notes**: Confirm that no external consumer depends on the Gemini batch payload format before removal. Verify that Gemini CLI's native OTLP environment variables are stable and documented by Google.

---

- **Decision**: Keep the Gemini cost estimation logic (pricing table, tier-2 thresholds) server-side even after switching to native OTLP, since Gemini CLI does not emit cost data in its OTLP events — only token counts and model identity.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the Gemini CLI OTLP specification does not include cost fields; cost must be derived server-side from usage data, which is consistent with the existing approach for all agents.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Server-side cost estimation remains necessary, but now operates on native OTLP data instead of reconstructed batch data, improving accuracy.
  2. The pricing table must still be maintained manually when Gemini pricing changes.
- **Reviewer Notes**: Validate that the OTLP events contain sufficient token-category granularity (input, output, thinking, cache-read, cache-creation) for accurate cost calculation.

---

- **Decision**: Gemini OTLP events use `gemini_cli.*` event naming convention and should be detected by checking the OTLP resource or log record attributes for Gemini-specific identifiers, not by relying on the absence of Claude/Codex markers.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — positive identification is more robust than exclusion-based detection, especially as new agents are added.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Explicit Gemini detection prevents misrouting if a future agent also emits OTLP without Claude/Codex markers.
  2. Requires understanding and matching the exact OTLP attribute structure emitted by Gemini CLI.
- **Reviewer Notes**: Document the specific OTLP resource attributes and log record names that identify Gemini events, based on actual Gemini CLI output.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gemini job produces complete native telemetry (Priority: P1)

A project owner runs a Gemini-backed workflow (specify, plan, implement, quick-build, or iterate). The system executes Gemini with native OTLP telemetry enabled. During and after execution, telemetry events flow directly to the intake endpoint without any stream-JSON scraping or batch reconstruction. The resulting job record shows the exact model, token breakdown (input, output, thinking, cache-read, cache-creation), estimated cost, duration, and tools used.

**Why this priority**: This is the core migration — replacing the fragile batch reconstruction with native OTLP emission. Without this, all downstream telemetry remains on the deprecated path.

**Independent Test**: Can be fully tested by dispatching a Gemini workflow and verifying that the job record contains complete telemetry derived from OTLP events, with no stream-JSON file produced.

**Acceptance Scenarios**:

1. **Given** a Gemini workflow is dispatched, **When** the agent runs, **Then** Gemini CLI emits telemetry via native OTLP to the telemetry endpoint without producing a stream-JSON output file.
2. **Given** a Gemini job emits native OTLP events, **When** the telemetry endpoint receives them, **Then** the events are parsed by a dedicated Gemini OTLP handler (not the Mistral batch path) and stored with correct token breakdowns.
3. **Given** a Gemini job completes successfully, **When** the job details are viewed, **Then** the record shows exact model identity, input/output/thinking/cache tokens, estimated cost, duration, and tools used.

---

### User Story 2 - Gemini job failure surfaces clearly through native telemetry (Priority: P1)

When a Gemini workflow fails, the failure status and any available error context are captured through the native telemetry path. The system does not silently report success because the old batch mechanism failed to capture an error payload.

**Why this priority**: The batch mechanism could mask failures (silent success when scraping found nothing). Native OTLP eliminates this class of false-positive by tying status directly to the telemetry stream.

**Independent Test**: Can be fully tested by triggering a Gemini job that fails and verifying that the job record reflects the failure status and any error details from the OTLP events.

**Acceptance Scenarios**:

1. **Given** a Gemini workflow fails during execution, **When** OTLP events are processed, **Then** the job record reflects a failed status with available error context.
2. **Given** a Gemini workflow produces no telemetry events (e.g., crash before emission), **When** the job completes, **Then** the system marks the job with a clear missing-telemetry state rather than reporting fabricated success metrics.

---

### User Story 3 - Mistral batch telemetry remains unaffected (Priority: P1)

The removal of Gemini-specific batch code does not alter how Mistral telemetry is ingested. Mistral workflows continue to use the batch payload path, and Mistral job records retain their existing accuracy and completeness.

**Why this priority**: Regression protection for Mistral is a non-negotiable constraint — the batch path must remain intact for Mistral while being removed for Gemini.

**Independent Test**: Can be fully tested by running a Mistral workflow after the changes and verifying that its telemetry is ingested via the batch path with the same metrics and cost accuracy as before.

**Acceptance Scenarios**:

1. **Given** a Mistral workflow emits a batch telemetry payload, **When** the payload reaches the telemetry endpoint, **Then** it is processed through the existing batch handler with no behavioral change.
2. **Given** Gemini batch code has been removed, **When** a Mistral batch payload arrives, **Then** the batch handler accepts and processes it correctly without any Gemini-specific normalization logic interfering.

---

### User Story 4 - Updated AIB-626 documentation reflects native-only path (Priority: P2)

Internal specifications and documentation related to Gemini telemetry (AIB-626 spec, telemetry API contracts, workflow descriptions) are updated to reflect that native OTLP is the sole telemetry path for Gemini. No references to batch reconstruction, stream-JSON scraping, or post-run payload assembly remain in Gemini-related documentation.

**Why this priority**: Stale documentation creates confusion for future development and risks re-introducing the batch pattern. This is secondary to the code changes but necessary for long-term maintainability.

**Independent Test**: Can be fully tested by reviewing all Gemini telemetry documentation and confirming that no references to batch, stream-JSON, or post-run reconstruction remain.

**Acceptance Scenarios**:

1. **Given** the Gemini telemetry migration is complete, **When** the AIB-626 spec and related documents are reviewed, **Then** all references describe native OTLP as the sole Gemini telemetry mechanism.
2. **Given** telemetry API contracts exist for Gemini, **When** they are reviewed, **Then** the batch payload format is documented as Mistral-only, with Gemini using the OTLP path.

### Edge Cases

- What happens when Gemini CLI is invoked but OTLP telemetry emission fails silently (e.g., endpoint unreachable during execution)?
- How does the system handle a Gemini OTLP event that arrives after the job has already been marked complete?
- What happens if a Gemini OTLP event references an unknown or newly introduced model not yet in the pricing table?
- How does the system behave during a rollout window where some in-flight Gemini jobs were started with the old batch mechanism but complete after the migration is deployed?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST invoke Gemini CLI with native OTLP telemetry export enabled and MUST NOT use `stream-json` output mode for telemetry collection purposes.
- **FR-002**: The system MUST configure Gemini CLI to emit OTLP telemetry events to the `/api/telemetry/v1/logs` endpoint during workflow execution using Gemini's official environment variables or flags.
- **FR-003**: The telemetry endpoint MUST detect and parse Gemini-native OTLP events (`gemini_cli.*`) through a dedicated Gemini OTLP handler, separate from the Mistral batch handler.
- **FR-004**: The Gemini OTLP handler MUST extract and store token usage in distinct categories: input, output, thinking, cache-read, and cache-creation tokens.
- **FR-005**: The Gemini OTLP handler MUST extract model identity, duration, tool usage, and execution status from native OTLP events.
- **FR-006**: The system MUST estimate Gemini job cost server-side from OTLP-derived token counts and model identity, using the existing pricing table for supported models (2.5 Pro, 2.5 Flash, 2.0 Flash).
- **FR-007**: The system MUST handle unsupported Gemini models by preserving all usage metrics and marking cost as unavailable.
- **FR-008**: The system MUST remove all Gemini-specific batch telemetry code, including: stream-JSON file parsing, post-run payload reconstruction, Gemini-specific normalization in the batch handler, and Gemini-specific cost-status logic in the batch path.
- **FR-009**: The batch telemetry handler MUST continue to accept and process Mistral payloads with no behavioral change after Gemini batch code is removed.
- **FR-010**: The system MUST handle repeated, partial, or delayed Gemini OTLP events without double-counting usage or corrupting existing job metrics.
- **FR-011**: The system MUST surface Gemini job failures through the native OTLP path, preventing silent-success states that occurred when batch scraping found no data.
- **FR-012**: All existing Gemini telemetry tests MUST be updated to validate the native OTLP path instead of the batch reconstruction path.
- **FR-013**: Internal specifications and telemetry API contracts related to Gemini (particularly those from AIB-626) MUST be updated to reflect native OTLP as the sole Gemini telemetry mechanism.

### Key Entities

- **Gemini OTLP Event**: A telemetry log record emitted natively by Gemini CLI during workflow execution, containing token usage, model identity, tool activity, and execution status in standard OTLP format.
- **Job Telemetry Record**: The per-job analytics record updated from Gemini OTLP events, storing usage breakdowns, cost estimates, duration, and tools used.
- **Gemini Pricing Rule**: The server-side pricing reference for supported Gemini models, applied to OTLP-derived token counts to produce estimated job cost.
- **Batch Telemetry Payload**: The non-OTLP payload format retained exclusively for Mistral, containing agent-attributed usage metrics sent after workflow completion.

### Internal Processes

- **Gemini Native Telemetry Emission**: Triggered when a Gemini-backed workflow starts.
  - **Input**: Job identity, selected Gemini model, telemetry endpoint URL, OTLP configuration environment variables.
  - **Phases**:
    1. Configure Gemini CLI with OTLP environment variables pointing to the telemetry endpoint.
    2. Execute Gemini CLI in standard mode (no stream-json) with approval-mode and prompt as before.
    3. Gemini CLI emits `gemini_cli.*` OTLP events directly to the telemetry endpoint during execution.
  - **Output**: A stream of native OTLP log records sent to the telemetry endpoint in real-time.
  - **Error behavior**: If OTLP emission fails, the job execution continues but the system records a missing-telemetry state rather than fabricating metrics. Job success/failure is determined independently of telemetry completeness.

- **Gemini OTLP Intake and Normalization**: Triggered when Gemini OTLP events arrive at the telemetry endpoint.
  - **Input**: OTLP log records with Gemini-specific resource attributes and event names.
  - **Phases**:
    1. Detect Gemini OTLP events by resource attributes or event name prefix (`gemini_cli.*`).
    2. Route to the dedicated Gemini OTLP handler (bypass batch handler).
    3. Extract job identity, model, token counts (input, output, thinking, cache-read, cache-creation), tool usage, and status.
    4. Merge into existing job telemetry using appropriate accumulation strategy (handle repeated/incremental events).
  - **Output**: Updated job telemetry record with normalized Gemini metrics.
  - **Error behavior**: Invalid or unmatchable events are logged and discarded without corrupting other job data. Partial events update available fields without overwriting previously recorded data.

- **Gemini Cost Estimation (Post-OTLP)**: Triggered when usable Gemini token data and a recognized model are available for a job.
  - **Input**: OTLP-derived token breakdown and model identity from the job telemetry record.
  - **Phases**:
    1. Look up the pricing rule for the job's Gemini model (including tier-2 thresholds for high-usage jobs).
    2. Calculate cost per category from token counts and pricing rates.
    3. Store total estimated cost on the job record.
  - **Output**: Estimated job cost or explicit cost-unavailable status.
  - **Error behavior**: Unknown models preserve all usage data with cost marked unavailable.

### Assumptions & Dependencies

- Gemini CLI supports native OTLP telemetry emission via environment variables (e.g., `GEMINI_OTEL_EXPORTER_OTLP_ENDPOINT` or similar official configuration) that can be pointed at the ai-board telemetry endpoint.
- Gemini CLI's OTLP events contain sufficient granularity for token-category breakdown (input, output, thinking, cache-read, cache-creation) to maintain cost estimation accuracy.
- The existing OTLP parsing infrastructure in the telemetry endpoint can be extended with a Gemini-specific handler alongside the existing Claude/Codex handlers.
- No external systems consume the Gemini batch payload format; removal has no downstream impact beyond this codebase.
- Historical Gemini jobs ingested via the old batch path do not need retroactive re-ingestion; they retain their existing (potentially incomplete) metrics.

## Out of Scope

- Refactoring Mistral telemetry (remains on the batch path).
- Adding new AI providers or agents.
- Changing the database storage format for telemetry data.
- Retroactive correction of historical Gemini job metrics ingested via the batch path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly dispatched Gemini jobs produce telemetry via native OTLP events with no stream-JSON output file generated during execution.
- **SC-002**: For Gemini jobs using supported models, 100% of completed jobs display a complete token breakdown (input, output, thinking, cache-read, cache-creation where reported), estimated cost, duration, model identity, and tool usage in job details and analytics.
- **SC-003**: Gemini job failures are correctly reflected in job status with no silent-success occurrences caused by missing telemetry data.
- **SC-004**: 100% of Mistral batch telemetry continues to be ingested and processed with identical behavior and accuracy as before the migration.
- **SC-005**: Zero Gemini-specific batch telemetry code (stream-JSON parsing, post-run payload construction, Gemini normalization in batch handler) remains in the codebase after migration.
- **SC-006**: All Gemini telemetry tests validate the native OTLP path with no residual tests validating the removed batch reconstruction path.
- **SC-007**: AIB-626 specifications and telemetry contracts are updated to document native OTLP as the sole Gemini telemetry mechanism.
