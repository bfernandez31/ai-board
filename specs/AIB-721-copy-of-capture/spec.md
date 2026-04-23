# Feature Specification: Capture and Display Agent Execution Logs

**Feature Branch**: `AIB-721-copy-of-capture`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Capture and display agent execution logs for all supported AI agents (Claude Code, Codex, Mistral/vibe, Gemini), providing persistent, viewable log artifacts accessible from the ai-board UI."

## Auto-Resolved Decisions

- **Decision**: Log storage strategy — whether to store full logs inline in the database or use a hybrid approach
- **Policy Applied**: CONSERVATIVE (via AUTO with High confidence)
- **Confidence**: High (score 6 / 0.9) — storage bloat and data integrity are explicit acceptance criteria
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Keeping large log payloads out of the primary job record avoids query performance degradation on job listings but adds complexity to retrieval
  2. Full inline storage is simpler but risks database bloat at scale (agents can produce multi-MB output per run)
- **Reviewer Notes**: Validate that the chosen storage boundary (summary vs. full content) aligns with typical log sizes observed in production workflows

---

- **Decision**: Log format normalization — whether each agent's raw output is stored as-is or normalized to a common structure
- **Policy Applied**: CONSERVATIVE (via AUTO with High confidence)
- **Confidence**: High (score 6 / 0.9) — the ticket explicitly requires normalization "to a single consumable format where possible"
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Normalization enables a consistent UI and querying experience across all agents but may lose agent-specific diagnostic detail
  2. Storing raw output preserves fidelity but forces the UI to handle multiple incompatible formats
- **Reviewer Notes**: Confirm acceptable information loss when mapping agent-specific output to the normalized format; consider retaining the original raw output alongside the normalized view

---

- **Decision**: Timeline preview content — what information appears in the condensed inline preview without requiring a click
- **Policy Applied**: CONSERVATIVE (via AUTO with High confidence)
- **Confidence**: High (score 6 / 0.9) — the ticket describes "last few key events or error summary" as example content
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Showing error summaries and final status gives immediate diagnostic value but may be insufficient for complex multi-step failures
  2. Showing more events inline improves glanceability but adds visual clutter to the timeline
- **Reviewer Notes**: Validate with representative log samples that the preview provides enough signal for the most common debugging scenarios (failed jobs with error messages)

---

- **Decision**: Retention and pruning — whether pruning is automatic with a fixed schedule or configurable per project
- **Policy Applied**: CONSERVATIVE (via AUTO with High confidence)
- **Confidence**: High (score 6 / 0.9) — ticket specifies "at least 30 days" with automatic pruning permitted
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Fixed 30-day retention is simple and predictable but offers no flexibility for projects that need longer audit trails
  2. Per-project configuration adds flexibility but introduces UI and billing complexity
- **Reviewer Notes**: A fixed 30-day minimum with no per-project override is the safest starting point; extended retention can be a follow-up feature if demand emerges

## User Scenarios & Testing

### User Story 1 — View Log Summary After Job Failure (Priority: P1)

As a project member, when a job fails I need to immediately understand why from the ai-board UI so I can decide whether to retry, adjust the ticket, or escalate — without needing GitHub Actions access.

**Why this priority**: This is the primary pain point motivating the feature. Failed jobs on external repositories are currently opaque to non-owner members.

**Independent Test**: Trigger a job that fails, then verify the timeline shows an inline error summary and the full log is accessible via a drill-down action.

**Acceptance Scenarios**:

1. **Given** a job has completed with FAILED status and captured logs, **When** the user views the ticket's job timeline, **Then** the failed job entry shows a condensed preview containing the error summary and last significant events without requiring a click.
2. **Given** a job has completed with FAILED status, **When** the user clicks "View full logs" on the timeline entry, **Then** a detailed view opens showing the complete captured output with readable formatting, timestamps, and event categorization.
3. **Given** a project member (not owner) views a failed job on an external repository, **When** they access the log detail, **Then** they see the same log content as the project owner, gated by existing project access rules.

---

### User Story 2 — Review Completed Job Execution Details (Priority: P2)

As a project owner or member, after a job completes successfully I want to review what the agent actually did — which tools it used, in what order, and what decisions it made — so I can build confidence in agent behavior and identify optimization opportunities.

**Why this priority**: Provides narrative context for the telemetry data already captured (tokens, cost, tools), turning numbers into an understandable execution story.

**Independent Test**: Complete a successful job, then verify the log shows the full sequence of agent actions with timestamps and tool invocations.

**Acceptance Scenarios**:

1. **Given** a job has completed with COMPLETED status and captured logs, **When** the user views the timeline, **Then** the job entry shows a condensed preview highlighting key milestones (e.g., number of tool invocations, completion message).
2. **Given** a user opens the full log view for a completed job, **When** the log renders, **Then** it displays chronologically ordered entries including agent messages, tool invocations, and timestamps in a readable format (not raw JSON).
3. **Given** a job was executed by any supported agent (Claude Code, Codex, Mistral/vibe, Gemini), **When** the user views the log, **Then** the format is consistent regardless of which agent produced it.

---

### User Story 3 — Logs Persist Beyond Workflow Retention (Priority: P3)

As a user investigating a historical job, I need logs to remain available after the GitHub Actions workflow retention window expires so that past job behavior can be reviewed for debugging or auditing purposes.

**Why this priority**: Without persistent storage, logs revert to being as ephemeral as they are today once the GitHub Actions retention expires, undermining the core value proposition.

**Independent Test**: Verify that a log captured 30+ days ago is still retrievable from the ai-board UI and API.

**Acceptance Scenarios**:

1. **Given** a job completed more than 14 days ago (beyond typical GitHub Actions retention), **When** the user accesses the job's log, **Then** the full log content is still available.
2. **Given** a log record is older than 30 days, **When** the automatic pruning process runs, **Then** the log content is removed but the job's core telemetry data (tokens, cost, duration, tools, quality score) is preserved.
3. **Given** a job completed within the last 30 days, **When** the pruning process runs, **Then** the log is not affected.

---

### User Story 4 — Cancelled Job Logs (Priority: P3)

As a user who cancelled a running job, I want to see what the agent accomplished before cancellation so I can understand the partial state and decide next steps.

**Why this priority**: Cancelled jobs leave ambiguous state; logs provide clarity on what was completed before interruption.

**Independent Test**: Cancel a running job, then verify partial logs are captured and viewable.

**Acceptance Scenarios**:

1. **Given** a job is cancelled while running, **When** the log capture process runs, **Then** whatever output was produced before cancellation is captured and made available.
2. **Given** a cancelled job has captured logs, **When** the user views the log, **Then** it clearly indicates the job was cancelled and shows the exit status alongside the partial output.

---

### Edge Cases

- What happens when an agent produces no output (empty logs)? The system displays a "No log output captured" message rather than an empty or broken view.
- What happens when log content exceeds the maximum storage size? The system truncates to a configurable maximum, preserving the beginning (setup context) and end (final status/errors), with a clear indicator that truncation occurred.
- What happens when the log capture process itself fails (e.g., network error during upload)? The job completes normally; the log field remains empty with no degradation to existing telemetry or job status tracking.
- What happens when a user views a job whose logs have been pruned? The system shows a "Logs expired" message with the pruning date, while the job's core telemetry remains visible.
- What happens for jobs created before this feature existed (no logs captured)? The timeline displays normally without a log preview; the "View full logs" action is hidden or disabled with a "Logs not available" tooltip.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST capture agent execution output when a job reaches a terminal state (COMPLETED, FAILED, or CANCELLED) and persist it as a log record associated with that job.
- **FR-002**: Log capture MUST work for all supported agents: Claude Code, Codex, Mistral/vibe, and Gemini.
- **FR-003**: Captured logs MUST be normalized to a common structured format containing at minimum: timestamps, event type (agent message, tool invocation, error, status change), and content.
- **FR-004**: The system MUST store log data in a way that does not degrade query performance on job listings or bloat the primary database with multi-megabyte payloads per job.
- **FR-005**: The job timeline item MUST display a condensed inline preview of the log (error summary for failed jobs, key milestones for completed jobs) without requiring user interaction.
- **FR-006**: Each job timeline entry with captured logs MUST provide a "View full logs" action that opens a detailed, formatted view of the complete captured output.
- **FR-007**: The full log view MUST present entries in chronological order with readable formatting — not raw JSON or unstructured text dumps.
- **FR-008**: Log access MUST follow the same authorization rules as other ticket data: project owners and project members can view logs for jobs in their projects.
- **FR-009**: Logs MUST be retained for at least 30 days from the job's completion date.
- **FR-010**: The system MUST automatically prune log content older than the retention period while preserving the job's core telemetry fields (tokens, cost, duration, tools used, quality score).
- **FR-011**: Log capture MUST NOT interfere with existing telemetry data collection — tokens, cost, duration, tools used, and quality score must continue to be recorded as they are today.
- **FR-012**: The feature MUST work identically for self-managed ai-board (managing its own repository) and for external projects.
- **FR-013**: When log content exceeds the maximum permitted size, the system MUST truncate it with a clear indicator, preserving the beginning and end of the output.
- **FR-014**: When no logs are available for a job (pre-feature jobs, capture failures, pruned logs), the system MUST degrade gracefully — displaying an appropriate message and hiding or disabling the full log action.
- **FR-015**: The log capture process MUST be resilient to failures — if log capture fails, the job's status, telemetry, and all other processing must complete normally.

### Key Entities

- **Job Log**: The captured execution output for a single job run. Contains the normalized log entries (timestamped events with type and content), a condensed summary for inline preview, the raw size of the captured output, and a reference to the parent job. One log per job; created on job completion, pruned after retention period.
- **Log Entry**: An individual event within a job log. Represents a discrete moment in the agent's execution: a message it produced, a tool it invoked, an error it encountered, or a status change. Each entry has a timestamp, event type, and content payload.
- **Job** (existing): Extended with log-related state — whether logs are available, whether they have been pruned, and a reference to the associated log content.

### Internal Processes

- **Log Capture Process**: Triggered when a workflow reports a job's terminal status (COMPLETED, FAILED, or CANCELLED).
  - **Input**: Raw agent output from the workflow execution, job identifier, agent type.
  - **Phases**:
    1. Receive raw agent output alongside the job status update
    2. Detect the agent type and parse the raw output according to agent-specific patterns
    3. Normalize parsed output into the common log entry format (timestamp, event type, content)
    4. Generate a condensed summary suitable for inline timeline preview (prioritize errors, then final status, then key milestones)
    5. Validate total size against the maximum storage limit; truncate if necessary with boundary preservation
    6. Persist the normalized log and summary associated with the job
  - **Output**: A persisted job log record with normalized entries and a preview summary.
  - **Error behavior**: If any phase fails, the job's status update and telemetry processing complete normally. The log field remains empty. The failure is logged for operational visibility but does not surface to the user as an error.

- **Log Pruning Process**: Runs on a scheduled basis to remove expired log content.
  - **Input**: Current date, retention threshold (30 days).
  - **Phases**:
    1. Identify all job log records where the associated job's completion date is older than the retention threshold
    2. Remove the log content (normalized entries and raw data) while preserving the job record and its telemetry fields
    3. Mark the job's log status as "pruned" so the UI can display an appropriate message
  - **Output**: Freed storage; job records updated to reflect pruned log state.
  - **Error behavior**: Pruning is idempotent. If a run fails partway through, the next run picks up remaining expired records. No data integrity risk — pruning only deletes log content, never job metadata or telemetry.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Within 60 seconds of a job reaching terminal status, the associated log is available for viewing in the ai-board UI.
- **SC-002**: 100% of jobs completed after feature deployment have captured logs viewable through the UI (barring capture failures, which must be under 1% of total jobs).
- **SC-003**: Project members can diagnose a failed job's root cause from the ai-board log view without needing to access GitHub Actions in at least 80% of failure cases.
- **SC-004**: The inline log preview provides enough context to distinguish between different failure types (e.g., lint error vs. test failure vs. agent crash) at a glance, without opening the full view.
- **SC-005**: Log storage does not increase average job list page load time by more than 10% compared to pre-feature baseline.
- **SC-006**: Logs remain accessible for at least 30 days, exceeding the typical GitHub Actions retention window.
- **SC-007**: No regression in existing telemetry accuracy — token counts, cost, duration, tools used, and quality scores continue to be recorded correctly for 100% of jobs.
- **SC-008**: The log viewing experience is consistent across all four supported agents (Claude Code, Codex, Mistral/vibe, Gemini) — users cannot distinguish which agent produced the log based on formatting alone.

## Assumptions

- Workflows can be modified to capture and transmit agent output as part of the job status reporting process without significant changes to the workflow execution model.
- Agent output across all four supported agents can be meaningfully parsed into the common log format (timestamps, event types, content), though some agents may produce richer structured output than others.
- The existing job status endpoint can be extended to accept log payloads without breaking backward compatibility with currently deployed workflows.
- A single condensed preview per job (rather than multiple preview variants) is sufficient for the inline timeline display.
- The 30-day retention period is adequate for all current use cases; extended retention is deferred to a future feature if needed.
- Log truncation for oversized outputs is an acceptable trade-off; users needing the complete untruncated output can access the GitHub Actions run during its retention window.

## Out of Scope

- Real-time streaming of logs during job execution (post-completion capture only).
- Full-text search or indexing across job logs.
- Export of logs to third-party observability platforms (Datadog, Grafana, etc.).
- Email or Slack notifications based on log content.
- Per-project or per-user retention period configuration.
- Log diffing or comparison between job runs.
