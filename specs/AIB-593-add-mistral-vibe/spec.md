# Feature Specification: Add Mistral (vibe CLI) as Third AI Agent Provider

**Feature Branch**: `AIB-593-add-mistral-vibe`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "Add Mistral (vibe CLI) as third AI agent provider — data model, credential management, agent selection UI, workflow execution, and telemetry support"

## Auto-Resolved Decisions

### Decision 1 — Credential Type Restriction

- **Decision**: Mistral supports API_KEY credential type only (no OAuth flow)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: +5) — credential management is a sensitive area
- **Fallback Triggered?**: No — HIGH confidence with clear CONSERVATIVE signal
- **Trade-offs**:
  1. Limits future flexibility if Mistral adds OAuth; however, adding OAuth later is additive and non-breaking
  2. Simplifies initial implementation and reduces attack surface by supporting only one auth path
- **Reviewer Notes**: If Mistral introduces OAuth in the future, the existing credential type enum already includes OAUTH_TOKEN — only provider-level allowed types and verification logic would need updating

### Decision 2 — Telemetry Signal Type (Traces vs Logs)

- **Decision**: The telemetry endpoint will be extended to accept OTLP trace payloads alongside existing log payloads, with traces stored using the same job association model. Mistral's built-in datalake telemetry will be disabled in all workflow environments.
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: +5) — telemetry data collection involves data governance decisions
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Extending the telemetry route adds complexity but provides unified observability across all three agent providers
  2. Disabling Mistral datalake telemetry prevents data leakage to third-party services, aligning with data minimization principles
- **Reviewer Notes**: Verify that OTLP trace payloads from vibe contain the same `job_id` resource attribute convention used by Claude and Codex for job correlation

### Decision 3 — vibe CLI Permission Mode

- **Decision**: Use vibe's built-in auto-approve agent profile for fully autonomous workflow execution (equivalent to --dangerously-skip-permissions in other agents)
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score: +5) — permission escalation is a security-sensitive decision
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Auto-approve is required for CI/CD workflows where no human is present to approve tool calls; this matches the existing pattern for Claude and Codex
  2. Risk is mitigated by the fact that workflows run in isolated GitHub Actions runners with limited blast radius
- **Reviewer Notes**: Confirm that vibe's auto-approve profile does not grant filesystem access beyond the cloned repository directory

### Decision 4 — API Key Format Validation

- **Decision**: Mistral API key format validation will use a permissive check (minimum length, no whitespace) rather than a strict regex, since Mistral's key format is not publicly documented with a stable prefix pattern
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score: +3) — format validation is important but the exact format may change
- **Fallback Triggered?**: No — medium confidence is sufficient for a validation heuristic
- **Trade-offs**:
  1. A permissive check avoids false rejections if Mistral changes their key format
  2. Verification against the live Mistral API endpoint provides the real validation; format check is a quick pre-filter
- **Reviewer Notes**: Monitor Mistral's API key format; tighten the regex if a stable prefix pattern is established

### Decision 5 — Cost Estimation for Mistral Usage

- **Decision**: Mistral token pricing will be maintained as a configurable lookup table (similar to the existing OpenAI pricing table), populated with published Mistral API rates at launch
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score: +3) — pricing data affects billing accuracy
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A lookup table requires manual updates when Mistral changes pricing, but matches the proven pattern used for OpenAI
  2. Alternative (live pricing API) adds external dependency and latency to telemetry processing
- **Reviewer Notes**: Verify current Mistral model pricing before deployment; ensure the table covers models available via the vibe CLI

## User Scenarios & Testing

### User Story 1 — Store Mistral API Key (Priority: P1)

A project owner navigates to their project's credential settings and stores a Mistral API key. The system validates the key format and verifies it against the Mistral API before accepting it. Once stored, the key is encrypted and available for workflow execution.

**Why this priority**: Without a valid stored credential, no Mistral workflows can execute. This is the foundational prerequisite for all other Mistral functionality.

**Independent Test**: Can be fully tested by navigating to credential settings, entering a Mistral API key, and verifying it appears as stored with a masked preview. Delivers value by enabling Mistral agent selection.

**Acceptance Scenarios**:

1. **Given** a project owner on the credential settings page, **When** they select Mistral as the provider and enter a valid API key, **Then** the system validates the format, verifies the key against the Mistral API, encrypts and stores it, and displays a masked preview (last 4 characters)
2. **Given** a project owner entering an invalid or expired Mistral API key, **When** verification fails, **Then** the system displays a clear error message indicating the key could not be verified and does not store it
3. **Given** a project owner who already has a Mistral API key stored, **When** they enter a new key, **Then** the old key is replaced with the new one following the existing upsert behavior

---

### User Story 2 — Select Mistral as Default Agent (Priority: P1)

A project owner opens their project settings and selects Mistral from the "Default Agent" dropdown. All new tickets in the project will use Mistral unless individually overridden.

**Why this priority**: Agent selection is the core configuration step that determines which AI provider processes workflow stages.

**Independent Test**: Can be tested by changing the default agent to Mistral in project settings and creating a new ticket — the ticket should resolve to the Mistral agent.

**Acceptance Scenarios**:

1. **Given** a project settings page with the "Default Agent" dropdown, **When** the owner selects Mistral, **Then** the project's default agent is updated to Mistral and persisted
2. **Given** a project with Mistral as the default agent, **When** a new ticket is created without an agent override, **Then** the effective agent for that ticket resolves to Mistral
3. **Given** a project with Mistral as default but no Mistral credential stored for the project owner, **When** a workflow is dispatched, **Then** the system blocks dispatch and notifies the user that a Mistral API key is required

---

### User Story 3 — Override Agent to Mistral on a Ticket (Priority: P2)

A user editing a ticket selects Mistral as the agent override, replacing the project default for that specific ticket.

**Why this priority**: Per-ticket agent override provides flexibility but depends on the default agent functionality being in place.

**Independent Test**: Can be tested by editing a ticket's agent field to Mistral and verifying the effective agent resolves correctly.

**Acceptance Scenarios**:

1. **Given** a ticket with no agent override (using project default), **When** the user selects Mistral as the override agent, **Then** the ticket's effective agent becomes Mistral regardless of the project default
2. **Given** a ticket with Mistral override, **When** the user clears the override, **Then** the ticket reverts to the project's default agent

---

### User Story 4 — Execute Workflow with Mistral Agent (Priority: P1)

When a workflow stage (specify, plan, implement, quick-impl, verify, iterate, or assist) is dispatched for a ticket using the Mistral agent, the system installs the vibe CLI, authenticates with the stored Mistral API key, and executes the command using the same prompt pattern as other agents.

**Why this priority**: Workflow execution is the core value delivery — without it, selecting Mistral has no functional effect.

**Independent Test**: Can be tested by dispatching a workflow stage for a Mistral-assigned ticket and verifying the job completes with expected artifacts.

**Acceptance Scenarios**:

1. **Given** a ticket with effective agent Mistral and a valid stored Mistral API key, **When** a workflow stage is dispatched, **Then** the system installs the vibe CLI, injects the MISTRAL_API_KEY environment variable, and invokes vibe with the appropriate command prompt
2. **Given** a ticket with effective agent Mistral, **When** the vibe CLI is invoked, **Then** vibe reads the AGENTS.md file from the target repository for context (native filesystem walk behavior)
3. **Given** a Mistral workflow execution, **When** Mistral's built-in datalake telemetry setting is checked, **Then** it is disabled to prevent data transmission to third-party services
4. **Given** a Mistral workflow execution that fails, **When** the vibe CLI exits with a non-zero code, **Then** the job is marked as FAILED with appropriate error output captured

---

### User Story 5 — View Mistral Telemetry Data (Priority: P2)

After a Mistral-powered workflow completes, the user views the job's telemetry data showing token usage, cost estimates, tool invocations, and timing information — the same observability available for Claude and Codex jobs.

**Why this priority**: Telemetry provides visibility into agent performance and costs but is not required for core functionality.

**Independent Test**: Can be tested by running a Mistral workflow and checking that the job telemetry view displays token counts, estimated costs, and tool usage spans.

**Acceptance Scenarios**:

1. **Given** a completed Mistral workflow job, **When** the user views the job telemetry, **Then** they see input tokens, output tokens, estimated cost, and duration
2. **Given** vibe emitting OTLP trace payloads during execution, **When** the telemetry endpoint receives trace data, **Then** it extracts the job_id from resource attributes and associates the data with the correct job
3. **Given** existing Claude and Codex telemetry flows, **When** a Mistral trace payload is received, **Then** the existing log-based telemetry for Claude and Codex continues to function without regression

---

### Edge Cases

- What happens when a user selects Mistral but the workflow runner lacks Python 3.12+? The system should detect the missing runtime and fail the job with a clear error message before attempting CLI installation.
- How does the system handle Mistral API rate limits during workflow execution? The vibe CLI's built-in retry behavior should be relied upon; if the job ultimately fails due to rate limits, the standard job failure flow applies.
- What happens if a Mistral API key is revoked while a workflow is in progress? The vibe CLI will fail on the next API call; the job is marked FAILED with the authentication error captured in logs.
- What happens when the telemetry endpoint receives a trace payload without a job_id resource attribute? The trace data should be accepted but logged as unassociated for debugging purposes, rather than rejected.

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow users to store a Mistral API key as a credential, encrypted with the same AES-256-GCM mechanism used for existing providers
- **FR-002**: System MUST validate Mistral API key format (minimum length, no whitespace) and verify it against the Mistral API endpoint before accepting storage
- **FR-003**: System MUST present Mistral as an option in the project "Default Agent" dropdown alongside Claude and Codex
- **FR-004**: System MUST present Mistral as an option in the per-ticket agent override selector
- **FR-005**: System MUST map the Mistral agent to the Mistral credential provider and resolve the environment variable MISTRAL_API_KEY for workflow injection
- **FR-006**: System MUST install the vibe CLI and invoke it with the command prompt when the effective agent is Mistral, following the same dispatch pattern as Codex
- **FR-007**: System MUST disable Mistral's built-in datalake telemetry in all workflow environments to prevent data transmission to third-party services
- **FR-008**: System MUST enable OTEL trace export from vibe to the platform's telemetry endpoint
- **FR-009**: System MUST accept OTLP trace payloads at the telemetry endpoint in addition to existing OTLP log payloads
- **FR-010**: System MUST associate incoming Mistral trace data with the correct job using the job_id resource attribute
- **FR-011**: System MUST extract and display token usage (input/output), estimated cost, and duration from Mistral telemetry data
- **FR-012**: System MUST block workflow dispatch when the project owner has no Mistral credential stored, with a clear notification to the user
- **FR-013**: System MUST NOT alter existing Claude or Codex agent functionality when adding Mistral support
- **FR-014**: System MUST support Mistral agent for all workflow stages: specify, plan, implement, quick-impl, verify, iterate, and assist

### Key Entities

- **Agent (enum)**: Extended with MISTRAL value representing the Mistral vibe CLI agent provider. Used as both project default and per-ticket override.
- **Credential Provider (enum)**: Extended with MISTRAL value representing Mistral API credentials. Maps 1:1 from the MISTRAL agent.
- **User Credential**: Stores the encrypted Mistral API key per user, following the existing one-credential-per-provider-per-user constraint. Supports API_KEY type only (no OAuth).
- **Job Telemetry**: Extended to store OTLP trace signal data (in addition to existing log signal data) containing LLM call spans, tool invocation spans with duration, and correlation IDs.

### Internal Processes

- **Mistral Workflow Execution**: Triggered when a workflow stage is dispatched for a ticket with effective agent MISTRAL. Receives the command type, prompt content, and job context.
  - **Input**: Agent type (MISTRAL), command prompt (from .md file), decrypted MISTRAL_API_KEY, target repository context
  - **Phases**:
    1. Validate that the MISTRAL_API_KEY environment variable is present
    2. Install the vibe CLI (Python package)
    3. Configure vibe: disable datalake telemetry, enable OTEL trace export to platform endpoint
    4. Invoke vibe with the command prompt and auto-approve permission profile
    5. Capture vibe output and exit code
  - **Output**: Command artifacts (spec files, code changes, test results depending on stage), OTLP trace data sent to telemetry endpoint, job status update (COMPLETED or FAILED)
  - **Error behavior**: Non-zero exit code marks job as FAILED; authentication errors, rate limits, and runtime failures are captured in job logs. Process is not automatically retried.

- **Telemetry Trace Ingestion**: Triggered when the telemetry endpoint receives an OTLP trace payload (as opposed to the existing log payload).
  - **Input**: OTLP trace payload containing spans with resource attributes (including job_id)
  - **Phases**:
    1. Detect payload type (trace vs log) based on content structure or request path
    2. Extract job_id from resource attributes for job association
    3. Parse span data: LLM call details (model, tokens, duration), tool invocations, correlation IDs
    4. Aggregate token usage and compute cost estimate using Mistral pricing table
    5. Store trace data associated with the job
  - **Output**: Updated job telemetry record with token counts, cost estimate, duration, and tools used
  - **Error behavior**: Malformed payloads are rejected with appropriate error response. Payloads without job_id are accepted but logged as unassociated. Processing failures do not affect the running workflow.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can store, verify, and replace a Mistral API key within the same time frame as existing credential operations (under 30 seconds end-to-end)
- **SC-002**: Mistral is selectable as default agent at the project level and as an override at the ticket level with no additional configuration steps beyond credential storage
- **SC-003**: Workflow stages dispatched with the Mistral agent complete successfully at a rate comparable to equivalent Claude and Codex workflows (same success/failure ratio for identical tasks)
- **SC-004**: Telemetry data from Mistral workflows appears in the job telemetry view within the same polling cycle as Claude and Codex telemetry (under 15 seconds after data emission)
- **SC-005**: Zero regressions in existing Claude and Codex agent functionality — all existing agent-related tests continue to pass
- **SC-006**: No telemetry data is transmitted to Mistral's external datalake service during any workflow execution
- **SC-007**: 100% of Mistral workflow executions that produce OTLP traces have those traces correctly associated with the originating job
