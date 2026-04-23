# Feature Specification: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Feature Branch**: `AIB-720-capture-and-display`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat this feature as post-completion observability only. Running jobs may continue to show existing status and telemetry updates, but readable execution logs become available after a job reaches `COMPLETED`, `FAILED`, or `CANCELLED`.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from general user-facing feature context and reliability/retention requirements; no conflicting signal buckets)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeps scope aligned with the stated out-of-scope exclusion for real-time streaming.
  2. Delays visibility until the job ends, but avoids introducing partial-log consistency issues.
- **Reviewer Notes**: Confirm that no stakeholder expects live tailing inside the ticket modal.

- **Decision**: Define the inline timeline preview as a condensed log summary that highlights the most recent important events, final outcome, and any error reason instead of rendering the full transcript inline.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from explicit summary-plus-drilldown requirement and neutral user-facing context)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Improves scanability in the ticket timeline and preserves the existing compact job list experience.
  2. Requires a second action for full detail, but avoids overwhelming the default view with long transcripts.
- **Reviewer Notes**: Validate that the summary format gives enough context for triage without opening the full log view.

- **Decision**: Require a normalized cross-agent event format for display, while permitting agent-specific metadata to remain visible in the detailed view when a perfect one-to-one normalization is not possible.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from multi-agent compatibility requirement and reliability emphasis)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Preserves a consistent reading experience across Claude, Codex, Mistral, and Gemini.
  2. Accepts that some provider-specific details may appear only in detailed records instead of the summary layer.
- **Reviewer Notes**: Confirm that preserving provider-specific context in the detailed view is sufficient for support and debugging workflows.

- **Decision**: Guarantee that logs remain accessible for at least 30 days and allow automated pruning after that period unless a project retains the associated job record for active operational needs.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from explicit retention requirement and reliability emphasis)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Meets the stated retention floor while avoiding indefinite growth of large log artifacts.
  2. Older forensic investigations may lose detailed transcripts after pruning unless the team captures them elsewhere.
- **Reviewer Notes**: Validate that the 30-day minimum matches support and incident-review expectations.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Diagnose a failed job from the ticket view (Priority: P1)

A project member opens a ticket after a workflow fails and can immediately see a readable log summary in the job timeline, then open the full execution log without needing GitHub Actions access.

**Why this priority**: Failure diagnosis for members on external repositories is the core problem this feature is intended to solve.

**Independent Test**: Can be fully tested by completing a job in a failed state, loading the ticket detail view as a project member, and confirming both the inline summary and full log view are available and understandable.

**Acceptance Scenarios**:

1. **Given** a project member has access to a ticket with a failed job, **When** they open the ticket detail view, **Then** the job timeline shows a condensed failure-oriented log preview with the final status and latest significant events.
2. **Given** a project member is viewing a job with captured logs, **When** they select `View full logs`, **Then** they see the complete readable execution record for that job without needing GitHub repository permissions.
3. **Given** a job completed on an external repository, **When** an authorized project member opens its logs in ai-board, **Then** they can review the same persisted log content that was captured after workflow execution ended.

---

### User Story 2 - Review successful job activity without losing timeline clarity (Priority: P2)

A user reviewing normal workflow progress can inspect what an agent did during a successful run while the main ticket timeline remains concise and scannable.

**Why this priority**: Successful jobs also need transparency, but they matter less than unblocking failure diagnosis.

**Independent Test**: Can be fully tested by completing a successful job, verifying the timeline shows a compact preview, and confirming the detailed view exposes the full sequence of messages, tool invocations, and exit outcome.

**Acceptance Scenarios**:

1. **Given** a completed job with captured logs, **When** the user views the ticket timeline, **Then** the job row shows a short preview rather than the full transcript.
2. **Given** a completed job contains agent messages and tool activity, **When** the user opens the detailed log view, **Then** the content is formatted for reading and grouped in a way that reflects execution order.

---

### User Story 3 - Compare log context with existing telemetry (Priority: P3)

A user investigating a job can use the log artifact alongside existing metrics such as duration, cost, tokens, model, and tools used, without losing any current telemetry visibility.

**Why this priority**: Narrative context is most valuable when paired with the telemetry already present in the ticket experience.

**Independent Test**: Can be fully tested by loading a ticket that already has telemetry fields populated and confirming those metrics remain visible and unchanged while the log preview and detailed log view are added.

**Acceptance Scenarios**:

1. **Given** a job already has telemetry metrics recorded, **When** logs are captured and displayed, **Then** the existing telemetry fields remain available and unchanged in the ticket experience.
2. **Given** a user is reviewing a job with both telemetry and logs, **When** they compare the two, **Then** the log content provides chronological narrative context for the metrics without replacing them.

### Edge Cases

- What happens when a job finishes but produces only partial structured output from an agent? The system still stores and displays the available events, clearly marks the log as partial, and preserves the terminal job status.
- What happens when a job is cancelled mid-execution? The final stored log includes all captured events up to cancellation and clearly labels the job outcome as cancelled.
- What happens when log capture fails but the job reaches a terminal state? The job remains visible in the timeline with its status and telemetry, and the UI shows that full logs are unavailable for that execution rather than implying success.
- What happens when a job produces an unusually large log? The user can still access a condensed preview and the full view remains readable without forcing the entire transcript into the timeline row.
- What happens when a user lacks access to the project? They cannot retrieve either the summary or full log content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST capture a persistent execution log artifact for every supported agent-driven job that reaches a terminal state, including `COMPLETED`, `FAILED`, and `CANCELLED`.
- **FR-002**: The system MUST support log capture for Claude Code, Codex, Mistral/vibe, and Gemini jobs under a single user-facing log experience.
- **FR-003**: The system MUST preserve execution logs beyond the lifetime of the originating GitHub Actions run so authorized users can review them later from ai-board.
- **FR-004**: The system MUST expose log data through ai-board surfaces already used to inspect ticket jobs, including the job timeline in the ticket detail experience.
- **FR-005**: Each job timeline entry with available logs MUST show a condensed preview that surfaces the latest important events and a readable outcome summary without requiring the user to open a second view.
- **FR-006**: Each job with available logs MUST provide a `View full logs` action that opens a detailed, human-readable view of the complete captured execution record.
- **FR-007**: The detailed log view MUST present events in execution order and include, at minimum, timestamps, agent messages, tool invocations, errors, and final exit status when those items were produced during the job.
- **FR-008**: The system MUST normalize captured output into a consistent display model across supported agents while preserving agent-specific context in the detailed view when a fully normalized representation would hide important meaning.
- **FR-009**: The system MUST allow project members to view job logs using the same authorization rules that already govern access to ticket data for that project.
- **FR-010**: The system MUST work for both self-managed ai-board repositories and external repositories without requiring GitHub Actions log access for end users.
- **FR-011**: The system MUST preserve existing job telemetry visibility, including tokens, cost, duration, tools used, model, and quality score where available.
- **FR-012**: The system MUST make clear when logs are unavailable, partial, or pruned so users can distinguish missing data from successful capture.
- **FR-013**: The system MUST retain captured logs for at least 30 days after job completion and MAY remove older log artifacts through an automated pruning policy.
- **FR-014**: The system MUST avoid storing every job's full execution transcript in a way that causes disproportionate growth of the primary transactional database.
- **FR-015**: The system MUST keep log capture behavior independent from whether a job succeeds or fails so failure cases remain inspectable.

### Key Entities *(include if feature involves data)*

- **Job Execution Log**: The persisted record of a single job's readable execution history, including ordered events, outcome metadata, retention state, and availability status.
- **Log Event**: A timestamped unit of execution activity such as an agent message, tool invocation, warning, error, or completion result.
- **Log Summary**: A condensed representation of the most important events and outcome details used in the ticket timeline.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Job Log Capture**: Triggered when a supported workflow job finishes or is cancelled and produces execution output that should be preserved for later review.
  - **Input**: Job identifier, terminal status, agent type, execution output generated during the run, and any already-recorded telemetry context.
  - **Phases**: Collect the available execution output; normalize it into a consistent event model; create a condensed summary; persist the summary and detailed artifact; associate availability and retention state with the job.
  - **Output**: A stored job execution log artifact and a summary that can be surfaced from ticket job views.
  - **Error behavior**: If capture is incomplete or unavailable, the job still reaches its terminal state, the system records that log capture failed or is partial, and users are informed that detailed logs could not be fully preserved.

- **Log Retrieval and Presentation**: Triggered when an authorized user views a ticket timeline or opens a full log view for a job.
  - **Input**: Project access context, ticket and job identifiers, stored summary data, and stored full log artifact if retained.
  - **Phases**: Verify access; load the summary for timeline display; load and format the full execution record on demand; surface retention or partial-capture notices where relevant.
  - **Output**: A concise timeline preview and, when requested, a readable detailed log view.
  - **Error behavior**: Unauthorized requests are denied, missing or pruned artifacts are represented clearly, and telemetry remains visible even if full logs cannot be shown.

- **Log Retention Pruning**: Triggered by the platform's retention policy after the guaranteed availability window expires.
  - **Input**: Stored log artifacts, job completion timestamps, and retention eligibility rules.
  - **Phases**: Identify artifacts older than the guaranteed retention period; remove or archive expired detailed logs according to policy; keep enough metadata to explain that pruning occurred.
  - **Output**: Reduced long-term storage usage and a retained audit indicator that the job once had logs.
  - **Error behavior**: Pruning failures do not affect the visibility of active logs and can be retried later without altering job outcomes.

### Assumptions

- The existing job timeline remains the primary discovery surface for this feature.
- Some agent providers may emit provider-specific metadata that is useful in the detailed view even when it does not map cleanly into the summary format.
- Readability and access continuity matter more than preserving byte-for-byte raw workflow output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of terminal jobs created by supported agents have either an accessible log artifact or a clearly labeled unavailable/partial state visible from ai-board.
- **SC-002**: 90% of authorized users can identify the final failure reason or latest significant execution event from the inline timeline preview without opening the full log view during acceptance testing.
- **SC-003**: 95% of full log views for retained artifacts open with complete readable content on the first attempt during acceptance testing across supported agent types.
- **SC-004**: Existing ticket job telemetry remains visible and accurate for 100% of sampled jobs after log capture is introduced.
- **SC-005**: Stored job logs remain available for review for at least 30 days after job completion for 100% of retained sample jobs.
