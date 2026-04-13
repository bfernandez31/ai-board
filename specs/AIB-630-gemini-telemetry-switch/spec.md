# Feature Specification: Gemini Telemetry via Native Provider Events

**Feature Branch**: `AIB-630-gemini-telemetry-switch`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Gemini telemetry: switch to native provider events and remove Mistral-style batch mechanism"

## Auto-Resolved Decisions

### Decision 1 - Clarification Policy Selection

- **Decision**: Use a CONSERVATIVE interpretation for this specification because the request centers on telemetry correctness, job status integrity, and removal of a fragile non-native path.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: +3) - reliability and observability requirements create a clear quality bias, but the request does not include sensitive compliance constraints.
- **Fallback Triggered?**: No - AUTO produced a single-direction recommendation with sufficient confidence.
- **Trade-offs**:
  1. The scope stays tightly focused on correctness, parity, and regression prevention instead of broader telemetry redesign.
  2. The spec carries stronger validation and backward-compatibility expectations, which increases implementation rigor.
- **Reviewer Notes**: Confirm that preserving telemetry accuracy for failed Gemini jobs is treated as a release blocker, not an optional quality improvement.

### Decision 2 - Gemini Telemetry Ingestion Model

- **Decision**: Gemini is treated as a first-class native telemetry producer and must no longer rely on a reconstructed post-run batch payload.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: +3) - the request explicitly states that the native provider telemetry path is the intended integration and the batch path is technical debt.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Removing the reconstructed path reduces drift and silent data loss risk.
  2. The change requires stricter regression checks so Mistral's batch-only flow remains intact.
- **Reviewer Notes**: Validate that no hidden Gemini workflow still depends on the reconstructed batch payload outside the primary job execution flow.

### Decision 3 - Functional Parity Expectation

- **Decision**: Telemetry parity means successful and failed Gemini jobs must both continue to surface model, token counts, duration, cost, and outcome state wherever job telemetry is already visible today.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: +3) - the payload explicitly names the data fields and user-visible surfaces that must stay complete.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This avoids a "native but incomplete" rollout that would regress trust in ticket and dashboard telemetry.
  2. It narrows acceptable implementation choices because partial event mapping is not sufficient.
- **Reviewer Notes**: Verify whether cached token reporting is always available from Gemini; if not, define how absence is displayed without implying zero usage.

### Decision 4 - Scope Boundary for Legacy Paths

- **Decision**: The batch path remains available only for Mistral and is neither a primary path nor a fallback path for Gemini after this change.
- **Policy Applied**: AUTO -> CONSERVATIVE
- **Confidence**: Medium (score: +3) - the request draws a firm provider boundary and identifies mixed handling as the root problem.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The provider-specific split keeps Mistral working without dragging Gemini into legacy normalization logic.
  2. Future provider additions will need an explicit telemetry contract instead of inheriting Gemini's removed fallback behavior.
- **Reviewer Notes**: Confirm that operational runbooks and internal specifications are updated so support teams no longer expect a Gemini batch recovery path.

## User Scenarios & Testing

### User Story 1 - Trust Gemini Job Telemetry Again (Priority: P1)

A user runs a ticket with Gemini and expects the resulting job telemetry to reflect what Gemini emitted natively, without reconstructed metrics or missing status information.

**Why this priority**: Restoring trust in telemetry correctness is the core business value. If the native data is not captured accurately, the feature does not solve the reported problem.

**Independent Test**: Can be fully tested by running a successful Gemini job and verifying the ticket and dashboard show the same model, token, cost, duration, and success state derived from native Gemini telemetry.

**Acceptance Scenarios**:

1. **Given** a ticket assigned to Gemini, **When** a workflow job completes successfully, **Then** the job telemetry shows the native Gemini model identifier, token usage, duration, cost, and completed status without relying on reconstructed command-output parsing
2. **Given** a successful Gemini job, **When** a user views the ticket detail and project telemetry views, **Then** both surfaces show the same telemetry values for that job within the normal polling window
3. **Given** a Gemini job that emits cached-token data, **When** telemetry is displayed, **Then** cached-token usage is shown distinctly rather than merged into another token category

---

### User Story 2 - See Failures Reported Correctly (Priority: P1)

A user runs a Gemini job that fails and expects the job outcome and any available telemetry to reflect the failure instead of appearing successful because the old batch collector did not capture anything.

**Why this priority**: Failure visibility is required for workflow reliability and prevents silent-success regressions that mislead users and operators.

**Independent Test**: Can be fully tested by forcing a Gemini job failure and verifying the failed state and error context remain visible while any native telemetry received before failure is still associated to the job.

**Acceptance Scenarios**:

1. **Given** a Gemini job that exits unsuccessfully, **When** the job record updates, **Then** the job is shown as failed and the failure is not masked by missing telemetry
2. **Given** a Gemini job that emits native telemetry before failing, **When** the telemetry is processed, **Then** any emitted usage and timing data remains attached to that failed job
3. **Given** a failed Gemini job with no usable telemetry payload, **When** the user views the job, **Then** the job still shows a failed outcome with clear absence of telemetry rather than a silent success

---

### User Story 3 - Preserve Mistral Behavior While Removing Gemini Debt (Priority: P2)

An operator updates the telemetry pipeline and expects Mistral jobs to continue using their existing batch mechanism while Gemini no longer uses or depends on it.

**Why this priority**: The change is only safe if it removes Gemini-specific debt without breaking the provider that still depends on batch ingestion.

**Independent Test**: Can be fully tested by processing one Gemini job and one Mistral job and confirming Gemini uses the native path while Mistral still succeeds through the batch path.

**Acceptance Scenarios**:

1. **Given** a Mistral job, **When** telemetry is ingested after this feature ships, **Then** the existing Mistral batch flow still stores and displays its telemetry
2. **Given** a Gemini job, **When** telemetry is ingested after this feature ships, **Then** no Gemini-specific reconstruction or Mistral-derived normalization path is invoked
3. **Given** both Gemini and Mistral jobs in the same environment, **When** telemetry from both providers is processed, **Then** each provider is handled by its intended path without cross-provider leakage

---

### Edge Cases

- What happens when Gemini emits a partial native telemetry sequence before the job ends? The system should preserve all valid native data received and still report the final job outcome accurately.
- What happens when Gemini omits an optional field such as cached-token usage? The system should leave that field empty or unavailable without inventing reconstructed values.
- What happens when the telemetry intake service receives a Gemini-native payload for a job that no longer exists or cannot be matched? The payload should be safely ignored or logged for investigation without corrupting another job's telemetry.
- What happens when legacy Gemini batch-shaped data is sent after this feature ships? It should not be treated as a supported Gemini path and must not overwrite native Gemini telemetry.

## Requirements

### Functional Requirements

- **FR-001**: System MUST run Gemini jobs in standard execution mode and MUST NOT require streaming command-output reconstruction to obtain telemetry.
- **FR-002**: System MUST enable Gemini's native telemetry emission for workflow jobs so the platform receives first-party Gemini telemetry events during execution.
- **FR-003**: System MUST ingest Gemini-native telemetry as a dedicated provider path rather than routing Gemini through the legacy batch flow used for Mistral.
- **FR-004**: System MUST remove Gemini-specific post-run reconstruction logic, Gemini-specific batch normalization, and Gemini-specific manual cost reconstruction that depend on reconstructed command output.
- **FR-005**: System MUST continue to support the existing batch telemetry path for Mistral without changing its expected behavior.
- **FR-006**: System MUST associate Gemini-native telemetry with the correct job so the resulting telemetry appears on the ticket detail, job detail, and aggregated dashboard views already supported by the product.
- **FR-007**: System MUST preserve the following Gemini telemetry fields when they are present natively: model identifier, input tokens, output tokens, cached-token usage, duration, cost, and final outcome status.
- **FR-008**: System MUST report failed Gemini jobs as failed even when telemetry is partial, delayed, or absent.
- **FR-009**: System MUST reject silent-success behavior where a Gemini job appears successful solely because no reconstructed batch telemetry was captured.
- **FR-010**: System MUST update automated tests covering Gemini telemetry so they validate the native ingestion path and no longer validate reconstructed Gemini batch behavior.
- **FR-011**: System MUST update internal specifications and operational documentation that currently describe Gemini as using the legacy batch mechanism.
- **FR-012**: System MUST preserve existing telemetry behavior for non-Gemini providers that already rely on their current ingestion contracts.

### Key Entities

- **Workflow Job**: A single ticket stage execution whose status, timing, model, and usage metrics must be updated from provider telemetry and exposed in the product UI.
- **Gemini Native Telemetry Event**: Provider-emitted telemetry data for a Gemini job containing usage, model, timing, and outcome details that can be associated directly to a workflow job.
- **Mistral Batch Telemetry Payload**: The legacy provider-specific telemetry submission that remains supported for Mistral after Gemini moves to native handling.
- **Ticket Telemetry View**: The user-facing ticket and dashboard surfaces where aggregated and per-job telemetry values are displayed.

### Internal Processes

- **Gemini Workflow Execution**: Triggered when a ticket stage runs with Gemini as the effective agent.
  - **Input**: Ticket context, job identity, Gemini execution request, and the telemetry destination configured for the platform
  - **Phases**:
    1. Prepare the Gemini run with native telemetry enabled
    2. Execute Gemini in standard mode rather than a telemetry-reconstruction mode
    3. Receive Gemini-native telemetry during the run
    4. Finalize the job with success or failure based on execution outcome
  - **Output**: Command artifacts for the stage, Gemini-native telemetry associated to the job, and a final job status
  - **Error behavior**: If the job fails, the failure state is preserved even when telemetry is incomplete; no reconstructed batch fallback is used for Gemini

- **Gemini Telemetry Ingestion**: Triggered when the platform receives a native Gemini telemetry payload.
  - **Input**: Provider-native Gemini telemetry records and job-correlation metadata
  - **Phases**:
    1. Identify the payload as Gemini-native telemetry
    2. Correlate the payload to the intended workflow job
    3. Extract native model, token, timing, cost, and outcome data
    4. Store and expose the resulting telemetry to existing job and ticket views
  - **Output**: Updated telemetry fields for the correlated Gemini job and refreshed downstream aggregates
  - **Error behavior**: Invalid or uncorrelated payloads are logged or discarded safely; they must not overwrite another job's telemetry or mark a failed job as successful

- **Provider-Specific Telemetry Routing**: Triggered whenever the telemetry intake service receives provider telemetry from a supported agent.
  - **Input**: Incoming telemetry payload and provider-identifying context
  - **Phases**:
    1. Distinguish whether the payload belongs to Gemini native telemetry or Mistral batch telemetry
    2. Route the payload to the matching provider-specific processing rules
    3. Preserve existing non-Gemini behavior while excluding Gemini from batch-only handling
  - **Output**: Provider-correct telemetry processing with no mixed-path handling
  - **Error behavior**: Unsupported or malformed provider payloads fail safely and do not affect other providers' telemetry

## Assumptions

- Gemini's native telemetry includes enough information to derive or directly read the fields already displayed for job telemetry without inventing substitute values from command-output parsing.
- Existing ticket, job, and dashboard views remain the authoritative places where telemetry is surfaced; this feature does not introduce new telemetry screens.
- Updating internal specifications includes the documents that currently describe Gemini as using the same batch pattern as Mistral.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of newly executed Gemini jobs use the native telemetry path and 0% use reconstructed command-output parsing to create telemetry records.
- **SC-002**: For successful Gemini jobs, the job detail and ticket-level telemetry views show the same model, token, duration, cost, and success state within the product's normal polling interval.
- **SC-003**: For failed Gemini jobs, 100% of job records display a failed outcome rather than a silent success caused by missing reconstructed telemetry.
- **SC-004**: Mistral telemetry ingestion continues to succeed for existing batch-based workflows with no regression in supported telemetry fields.
- **SC-005**: Automated test coverage for Gemini telemetry validates only the native Gemini path, with no remaining tests that require reconstructed Gemini batch behavior.
- **SC-006**: All internal specifications and runbook references covering Gemini telemetry describe native Gemini telemetry as the supported path before the feature is considered complete.
