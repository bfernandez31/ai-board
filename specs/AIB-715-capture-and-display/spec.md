# Feature Specification: Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

**Feature Branch**: `AIB-715-capture-and-display`
**Created**: 2026-04-22
**Status**: Draft
**Input**: Ticket AIB-715 — Capture and display agent execution logs (Claude/Codex/Mistral/Gemini)

> Today, when an AI agent runs inside a GitHub Actions workflow to execute a ticket command, its output is lost the moment the workflow ends. The `Job.logs` field exists in the schema but is never populated, and the UI has no way to surface what the agent actually said or did. With external project support now live, project members who cannot read the ai-board GitHub Actions logs have no way to diagnose failures themselves.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

*Effective Policy: AUTO → resolved as CONSERVATIVE*
*Provided Policy: AUTO*
*Applied on: 2026-04-22*

**AUTO scoring**: Reliability/observability signals (30-day retention, hybrid storage, multi-agent normalization, audit-style debugging, "no bloat" storage discipline) ≈ +5; potential sensitive-data exposure in agent transcripts (API keys, env vars, repo contents) ≈ +3; no internal/MVP/speed signals. Net score ≈ +6 with one dominant bucket → **High confidence (0.9)**. Selected policy: **CONSERVATIVE**.

---

- **Decision**: Storage approach for the full transcript
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Hybrid storage (small structured summary kept in Postgres for fast list rendering, full transcript persisted to durable external object storage referenced by URL) avoids multi-MB row bloat at the cost of a second read hop when the user opens the full viewer.
  2. Requires provisioning and budget for external object storage; introduces an additional failure surface (storage unreachable) that must degrade gracefully.
- **Reviewer Notes**: Validate the chosen object-storage destination during planning. Confirm it inherits ai-board's existing access controls (signed URLs or proxied through the ai-board API — never publicly readable).

- **Decision**: Retention period for transcripts
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A 30-day rolling window matches the ticket's stated minimum and limits long-tail storage cost and the blast radius of any data leak.
  2. Older incidents will lose their narrative context; team must rely on summaries / telemetry counters past day 30.
- **Reviewer Notes**: Confirm 30 days is acceptable to compliance / support workflows before implementation; if stakeholders need 90 days, it is a configuration change, not a redesign.

- **Decision**: Secret redaction in captured transcripts
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Logs are scrubbed of recognizable secrets (GitHub tokens, OAuth bearer tokens, generic high-entropy `KEY=VALUE` pairs from environment, private SSH keys) before they leave the runner. Reduces risk if the storage layer is ever exposed.
  2. Over-eager redaction can mask context useful for debugging; a literal `[REDACTED]` placeholder is preferred over silent removal so reviewers can see something was elided.
- **Reviewer Notes**: Redaction patterns must be reviewed and updated as new credential types are introduced; treat the pattern list as a security-sensitive artifact.

- **Decision**: Access control for log records
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Logs follow the same authorization rules as the parent ticket and project (owner OR member). No log is ever world-readable.
  2. Inviting a new member retroactively gives them visibility into historical logs for that project, matching how other ticket data already works — explicitly accepted as consistent.
- **Reviewer Notes**: Confirm during planning that the chosen storage transport (signed URL vs. proxied download) does not bypass ai-board's authorization helpers.

- **Decision**: Capture-failure behavior
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. If transcript capture, redaction, upload, or summary submission fails, the workflow MUST still report the job's terminal status (COMPLETED / FAILED / CANCELLED). Telemetry continues to flow.
  2. The UI surfaces a visible "logs unavailable" state for that job rather than silently hiding the absence — protecting the trust signal that "every finished job has logs."
- **Reviewer Notes**: Plan should specify retry budget for upload (e.g., a small bounded number of attempts) before declaring capture failed.

- **Decision**: Preview surface in the timeline
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. For FAILED jobs, the inline preview surfaces the terminal error excerpt (truncated, secrets redacted) so users see *why* without clicking. For COMPLETED jobs, the preview shows a brief summary line (e.g., last meaningful agent message or a short tool-usage recap). For CANCELLED jobs, the preview states the cancellation cause.
  2. Generating a useful summary requires light parsing of the normalized transcript; this is acceptable additional capture-side work to keep the UI fast.
- **Reviewer Notes**: Define a hard character cap for the inline preview (suggest ≤ 280 characters) so the timeline does not visually balloon.

- **Decision**: Cross-agent log format
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. All four agents (Claude Code, Codex, Mistral/vibe, Gemini) emit transcripts that get normalized into a single, ordered event stream of typed entries (timestamped agent message, tool invocation, tool result, error, lifecycle event). Common consumer code can render any agent's logs identically.
  2. Some agent-specific richness (e.g., Claude Code's thinking blocks, Mistral session metadata) may be flattened into generic event types. The original raw transcript is preserved in the stored artifact so power users can still inspect it.
- **Reviewer Notes**: The normalized event schema is a contract — versioning it from day one (e.g., `schemaVersion: 1`) avoids future migration pain.

- **Decision**: Retention pruning ownership
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. A scheduled, idempotent retention job removes both the Postgres summary record and the external storage object once a record passes 30 days. Pruning runs on a regular cadence (e.g., daily) and is safe to re-run.
  2. Adds operational responsibility (scheduled task health). Acceptable given the storage-cost and security benefits.
- **Reviewer Notes**: Pruning must use hard delete (CONSERVATIVE matrix: data deletion → hard delete + audit trail). Retain a small audit counter (jobs pruned per run) for observability.

- **Decision**: Scope of "view full logs" rendering
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The full-log view renders the normalized event stream with typed icons/colors per event class (message vs. tool call vs. error), monospace text where appropriate, and copy-to-clipboard for individual entries. Raw JSON is downloadable but not the default presentation.
  2. Slightly more frontend work than dumping a `<pre>` block, but matches the ticket's explicit "readable formatting (not raw JSON dump)" requirement.
- **Reviewer Notes**: Plan should reuse existing modal/dialog patterns from the codebase to stay consistent with current ticket UX.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Self-service failure diagnosis from the ai-board UI (Priority: P1)

A project member opens a ticket whose most recent job is FAILED. Without leaving ai-board and without GitHub Actions access, they immediately see *why* the job failed in the timeline (a short error excerpt) and can open a full log view to walk through what the agent did up to the failure point.

**Why this priority**: This is the unblocking value of the entire ticket. External-project members today have no path to diagnose failures; this single capability removes that hard wall.

**Independent Test**: Trigger a workflow that intentionally fails (e.g., an agent command against a malformed input). After the workflow ends, a project member account (non-owner) opens the ticket and confirms (a) the timeline shows a non-empty inline preview describing the failure, and (b) clicking through opens a readable, complete log view. Delivers the core "diagnose without GitHub" value as a standalone slice.

**Acceptance Scenarios**:

1. **Given** a job has terminated with status FAILED and its transcript was successfully captured, **When** a project member opens the ticket, **Then** the timeline entry for that job shows a visible inline preview that includes the terminal error excerpt (with secrets redacted), capped to a short readable length.
2. **Given** the same FAILED job, **When** the member clicks "View full logs", **Then** a detail view opens showing the complete normalized event stream (timestamps, agent messages, tool invocations, tool results, errors) in a readable format — not a raw JSON dump.
3. **Given** the same project member is *not* the project owner, **When** they request the log for that job, **Then** access is granted because they are a project member (same rule as other ticket data).

---

### User Story 2 - Glance-able log preview inline in the timeline (Priority: P2)

A user scanning a ticket's timeline can read a one-line condensed preview of every finished job — last meaningful agent message for COMPLETED jobs, error excerpt for FAILED jobs, cancellation cause for CANCELLED jobs — without expanding or clicking anything.

**Why this priority**: Builds on P1 by improving signal density. The preview is the lever that makes the timeline genuinely useful at-a-glance and feeds the upcoming failure-notification feature, which needs a meaningful one-line "reason" string.

**Independent Test**: Run several jobs of mixed outcomes against a single ticket. Open the ticket and verify each timeline entry shows a distinct, contextually appropriate preview line without user interaction. The preview alone (no modal) should already let a reader form a hypothesis about each job's outcome.

**Acceptance Scenarios**:

1. **Given** a COMPLETED job, **When** a user views the ticket timeline, **Then** the inline preview shows a brief, readable summary derived from the agent's run (e.g., a final agent message snippet or short tool-usage recap), capped at a fixed character length.
2. **Given** a CANCELLED job, **When** a user views the timeline, **Then** the preview indicates the cancellation cause (e.g., user-cancelled, timeout, upstream error).
3. **Given** a job whose transcript capture failed (e.g., storage upload error), **When** a user views the timeline, **Then** the preview clearly states logs are unavailable for that job rather than appearing identical to a successful capture.

---

### User Story 3 - Drill-down full log viewer for deeper investigation (Priority: P3)

A user investigating a subtle agent behavior (not necessarily a failure) opens the full log view to walk through the agent's narrative — every message, tool call, tool result, and lifecycle event in order — and can copy individual entries or download the raw artifact.

**Why this priority**: Critical for power users and incident reviews, but the at-a-glance value (P1/P2) covers the daily case. P3 deepens the experience without being on the critical unblocking path.

**Independent Test**: Open the full log view on any captured job. Verify entries render with type-specific styling (message vs. tool call vs. error), timestamps, copy-to-clipboard on individual entries, and a "download raw" affordance. Reviewer can read a full agent run without scanning a wall of JSON.

**Acceptance Scenarios**:

1. **Given** a captured log for any of the four supported agents, **When** the user opens the full log view, **Then** events render in chronological order with type-specific visual treatment.
2. **Given** a long log, **When** the user scrolls, **Then** rendering remains responsive (no need for the whole transcript to fit in one screen) and the user can copy any single entry to the clipboard.
3. **Given** the user wants the raw artifact, **When** they trigger "download raw", **Then** they receive the original normalized transcript file (with secrets already redacted on the workflow side).

---

### Edge Cases

- **Capture failure during workflow**: If transcript upload fails after a bounded retry, the job's terminal status is still reported, but the log record carries an "unavailable" marker the UI surfaces explicitly. Telemetry counters (tokens, cost, duration, tools used, quality score) MUST still be recorded.
- **Storage backend temporarily unavailable when reading**: If the full-log fetch fails (storage down, signed URL expired, object pruned), the UI shows a clear, actionable error message; the inline preview from Postgres remains visible.
- **Transcript exceeds expected size**: A captured transcript that would exceed the storage-side per-object limit is truncated with a clearly marked truncation notice in the rendered output; the inline preview is unaffected.
- **Job CANCELLED before agent emitted any output**: Log record exists but contains only lifecycle entries (job started, job cancelled). The preview reflects the cancellation cause; the full view shows the lifecycle entries only.
- **Job is still RUNNING**: No log record is expected yet (real-time streaming is explicitly out of scope). The timeline entry shows the existing in-progress treatment, no log preview.
- **Project member is removed**: They lose access to logs at the same instant they lose access to the parent ticket — no separate cache.
- **Log older than 30 days**: Pruning removes both the Postgres summary and the external object. The timeline entry continues to show the job (status, telemetry) but the preview now states logs are no longer retained.
- **Secret redaction false positive**: A non-sensitive string matching a redaction pattern is replaced with `[REDACTED]`. Acceptable trade-off; the placeholder makes the redaction visible to the reader.
- **Workflow retried**: A re-run of the same job produces a new log record bound to the new job ID (jobs themselves are append-only); previous logs remain available until pruning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture an execution transcript for every job that runs an AI agent, regardless of which agent (Claude Code, Codex, Mistral/vibe, Gemini) was used.
- **FR-002**: System MUST normalize captured transcripts into a single agent-agnostic event stream containing, at minimum, timestamps, agent messages, tool invocations, tool results, errors, and job lifecycle events.
- **FR-003**: System MUST persist the captured transcript to durable storage that survives beyond the GitHub Actions retention window.
- **FR-004**: System MUST associate exactly one log record with each terminated job (COMPLETED, FAILED, or CANCELLED) for which capture was attempted.
- **FR-005**: System MUST store a short, displayable summary (the inline preview) within the primary database alongside the job record, separately from the full transcript artifact.
- **FR-006**: System MUST store the full transcript outside the primary database (e.g., object storage) so that multi-MB transcripts do not bloat the relational database.
- **FR-007**: System MUST redact recognizable secrets (GitHub tokens, OAuth bearer tokens, private keys, high-entropy `KEY=VALUE` environment-style pairs) from the transcript before it leaves the GitHub Actions runner; the placeholder used MUST be visibly distinct (e.g., `[REDACTED]`) so reviewers can see that an elision occurred.
- **FR-008**: System MUST expose log records via the ai-board API such that owner and project members can read logs for jobs in their projects, matching the access rules already used for other ticket data; no log MUST be world-readable.
- **FR-009**: System MUST display the inline log preview in the existing job timeline entry without requiring the user to click or expand.
- **FR-010**: System MUST provide a "View full logs" action that opens a detailed view rendering the normalized event stream with type-specific visual treatment (distinguishing messages, tool calls, tool results, errors, lifecycle events) — not a raw JSON dump.
- **FR-011**: System MUST allow the user to download the raw normalized transcript artifact from the full-log view.
- **FR-012**: For FAILED jobs, the inline preview MUST surface a truncated, secret-redacted excerpt of the terminal error so the cause is visible at-a-glance.
- **FR-013**: For CANCELLED jobs, the inline preview MUST indicate the cancellation cause.
- **FR-014**: For COMPLETED jobs, the inline preview MUST show a brief, contextually meaningful summary (e.g., a final agent message snippet or short tool-usage recap).
- **FR-015**: The inline preview MUST be capped to a fixed maximum readable length so the timeline cannot visually balloon.
- **FR-016**: System MUST report the job's terminal status to ai-board even if transcript capture, redaction, upload, or summary submission fails. A capture failure MUST NOT block status reporting.
- **FR-017**: When transcript capture fails, the log record MUST carry an "unavailable" marker so the UI can clearly state logs are missing for that job rather than silently hiding the absence.
- **FR-018**: System MUST preserve all existing telemetry (input/output/thinking/cache tokens, cost, duration, tools used, quality score) without regression. Telemetry submission MUST be independent of log capture so a log failure cannot suppress telemetry.
- **FR-019**: System MUST automatically prune log records — both the Postgres summary row and the external transcript object — after at least 30 days of retention.
- **FR-020**: The pruning process MUST be idempotent and MUST hard-delete pruned records (no soft-delete tombstones for transcripts).
- **FR-021**: System MUST function identically for self-managed ai-board and for external projects; no log feature MUST be conditional on the workflow running in a specific repository.
- **FR-022**: When the full transcript cannot be fetched (storage unreachable, object pruned, transient error), the UI MUST display a clear, actionable error state while continuing to show the inline preview from Postgres.
- **FR-023**: Re-running a workflow MUST produce a new log record bound to the new job ID; prior log records MUST remain accessible until they are pruned by retention policy.
- **FR-024**: Users MUST be able to copy an individual entry from the full-log view to the clipboard.
- **FR-025**: A workflow run that ends before any agent output is produced (e.g., immediate cancellation) MUST still produce a log record containing at least the job lifecycle entries.
- **FR-026**: The normalized event stream MUST carry a schema version identifier so future format changes can be handled without breaking older stored transcripts.

### Key Entities

- **Log Record**: The summary representation of an agent run associated with a Job. Holds the inline preview text, the capture status (captured / unavailable / pruned), the location reference for the full transcript artifact, the normalized-schema version, the capture timestamp, and basic counts (e.g., number of events, error count). One Log Record corresponds to exactly one terminated Job.
- **Transcript Artifact**: The full normalized event stream stored in external durable storage. Contains the ordered list of typed events (message, tool invocation, tool result, error, lifecycle), each with a timestamp, a type, and a payload. The artifact MUST be retrievable only via authorized access paths and is hard-deleted by retention pruning at the same time as its Log Record.
- **Normalized Event**: A single entry in the transcript. Carries: timestamp, type (message / tool_invocation / tool_result / error / lifecycle), agent identity (Claude / Codex / Mistral / Gemini) for cross-agent traceability, and a typed payload. The shared type set is what enables one consumer (the UI) to render any agent's run identically.

### Internal Processes *(autonomous workflows / background jobs)*

- **Agent Log Capture (per workflow run)**: Triggered as part of every workflow that invokes an AI agent, regardless of which agent.
  - **Input**: The agent's raw output (stdout, structured output files, session metadata depending on agent), the job ID, the workflow run ID.
  - **Phases**:
    1. Stream / collect the agent's output during execution.
    2. After the agent terminates, normalize the collected output into the agent-agnostic event stream.
    3. Apply secret redaction to all string payloads in the stream.
    4. Derive the inline preview (error excerpt for failure, summary line for success, cancellation cause for cancellation), capped to the maximum readable length.
    5. Upload the normalized artifact to the external durable storage with a job-scoped key.
    6. Submit the log summary (preview, capture status, artifact reference, schema version, event counts) to ai-board's API alongside the existing job-status update.
  - **Output**: One Log Record stored in Postgres + one Transcript Artifact stored externally, both bound to the same job ID. Existing telemetry continues to be reported as before.
  - **Error behavior**: Bounded retry on upload and on summary submission. If capture, redaction, or upload ultimately fails, capture is marked "unavailable" on the Log Record and the job's terminal status is still reported. Capture failures MUST NOT block status reporting and MUST NOT suppress telemetry.

- **Log Retention Pruning (scheduled)**: Triggered on a regular cadence (e.g., daily).
  - **Input**: The current time and the configured retention window (default 30 days).
  - **Phases**:
    1. Identify Log Records whose age exceeds the retention window.
    2. For each, hard-delete the external Transcript Artifact.
    3. Hard-delete the corresponding Log Record from Postgres.
    4. Record an aggregate count of pruned items for operational visibility.
  - **Output**: Storage and database both reduced by the pruned set.
  - **Error behavior**: Idempotent — a re-run skips already-pruned records. A failure to delete the external artifact for a given record MUST NOT silently delete the Postgres row; the pair is removed only when both deletions succeed (or the artifact is confirmed already absent).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of terminated jobs (COMPLETED, FAILED, CANCELLED) where capture is attempted, a Log Record is associated with the job and visible to authorized users in the ai-board UI within one minute of the job's terminal status appearing.
- **SC-002**: A non-owner project member, with no access to the underlying GitHub Actions run, can identify the cause of a failed job from the ai-board UI alone in under 60 seconds for at least 90% of typical failures.
- **SC-003**: The inline preview line in the job timeline conveys the job's outcome (success summary, failure reason, or cancellation cause) without the user having to click, in 100% of timeline entries that have an available log.
- **SC-004**: Logs are available and renderable for jobs run by any of the four supported agents (Claude Code, Codex, Mistral/vibe, Gemini), verified by at least one captured run per agent.
- **SC-005**: Adding the log capture feature does not increase the size of the relational database row for a typical Job by more than a small bounded amount (the inline preview only); full transcripts live entirely in external storage.
- **SC-006**: 100% of retained logs older than the configured retention window (30 days) are pruned from both Postgres and external storage by the next scheduled retention run.
- **SC-007**: No regression in existing telemetry: input/output/thinking/cache tokens, cost, duration, tools used, and quality score continue to be reported for the same set of jobs that report them today, even on jobs whose log capture failed.
- **SC-008**: A capture failure during a workflow run does not prevent the job's terminal status from being reported to ai-board in 100% of cases.
- **SC-009**: When a user opens the full-log view, the rendered output is recognizably structured (typed entries, timestamps, type-specific visual treatment) and is not a raw JSON blob — verified by user testing on at least one log per supported agent.
- **SC-010**: Recognizable secret patterns (GitHub tokens, OAuth bearer tokens, private keys, high-entropy `KEY=VALUE` env pairs) are not present in stored transcripts in 100% of test fixtures designed to plant them.
- **SC-011**: Access to a log record matches access to the parent ticket: a user who can read the ticket can read its logs; a user who cannot, cannot. Verified for both owner and member roles, on both self-managed and external projects.
