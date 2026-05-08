# Feature Specification: Capture native Claude Code session JSONL alongside normalized logs

**Feature Branch**: `AIB-783-copy-of-capture`
**Created**: 2026-05-08
**Status**: Draft
**Input**: Ticket AIB-783 — Capture native Claude Code session JSONL alongside normalized logs

> Today, when a Claude Code agent finishes a job, the runner reads the native session files, aggregates them, then normalizes the result into AI-Board's internal log format before uploading to durable storage. The normalized format is great for the existing log viewer but is **lossy**: parent/child threading, sidechain markers (Task subagents), token usage, session boundaries, summaries, and version metadata are dropped. This loss prevents downstream tooling — notably Claude Code's built-in `/insights` analyzer — from replaying or analyzing the agent runs, since `/insights` requires the full native event graph. This feature persists the raw, native session as a second artifact alongside the existing normalized one, so a faithful, replayable copy is available when the follow-up Admin Insights feature ships.

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

*Effective Policy: AUTO → resolved as CONSERVATIVE*
*Provided Policy: AUTO*
*Applied on: 2026-05-08*

**AUTO scoring**: Sensitive-data signals (mandatory secret redaction, "no secrets must ever leak", token/API-key risk in tool input/output) ≈ +3; reliability/observability signals (non-blocking failure semantics, retention parity, runner observability for failed uploads) ≈ +2; neutral feature context (additional persistence pipeline reusing an existing one) ≈ +1; no speed/internal-only directives. Net score ≈ +6 with one dominant bucket → **High confidence (0.9)**. Selected policy: **CONSERVATIVE**.

---

- **Decision**: Redaction parity between normalized and raw artifacts
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The raw artifact passes through the same secret-redaction pipeline as the normalized one — same pattern set, same `[REDACTED]` placeholder, same coverage classes (GitHub tokens, OAuth bearers, generic `KEY=VALUE` env pairs, private keys).
  2. Redaction may slightly distort native field values (e.g., a tool input string containing a token becomes `[REDACTED]`), reducing fidelity for the few cases where the secret itself is the analyzed payload. This is explicitly accepted: a partial replay is preferable to a leak.
- **Reviewer Notes**: Implementation must run redaction over the *aggregated* native JSONL (every event line, every nested string field), not only top-level message text. Add at least one test that injects a fake secret into a tool-input field and asserts it is scrubbed in the raw artifact.

- **Decision**: Artifact distinct from the normalized one
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The raw native session is stored as a *separate* gzipped artifact (its own object key) under the same project/ticket/job grouping as the normalized one. Existing viewer paths and consumers are not affected; new consumers fetch the new artifact explicitly.
  2. Storage footprint roughly doubles for Claude jobs; acceptable given a 30-day retention cap and that the raw form is the source of truth for downstream replay.
- **Reviewer Notes**: Plan must define an unambiguous, derivable storage key for the raw artifact (analogous to the canonical key check enforced for normalized logs in AIB-724). The retrieval endpoint MUST re-derive the key from `(projectId, ticketId, jobId)` rather than trusting a stored value.

- **Decision**: Agent scope — Claude only
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The capture runs only for jobs whose agent is Claude Code. Other agents (Codex, Mistral, Gemini) are unaffected — no raw artifact, no error, no log entry suggesting one is missing.
  2. Future agents would each need their own native-format capture decision; the capability is not generalized in this ticket.
- **Reviewer Notes**: The "is Claude" gate must short-circuit before the capture pipeline runs (avoid wasted work and stray error logs for non-Claude jobs). Test coverage must include a Codex job asserting zero raw upload attempts.

- **Decision**: Failure isolation between normalized and raw uploads
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The raw upload is non-blocking: if it fails for any reason (network, redaction error, missing source files, storage rejection), the runner records a structured error log entry and the job continues to its terminal status as if only the normalized capture existed. The normalized artifact is unaffected.
  2. Operators must rely on log-based observability to notice raw-capture regressions. Until the follow-up Insights feature surfaces missing raw artifacts, silent gaps could persist for individual jobs.
- **Reviewer Notes**: The runner log entry for a failed raw upload must include `jobId`, agent identifier, and a non-secret error reason so operators can grep for capture regressions. Failures MUST NOT change the job's terminal status reported back to ai-board.

- **Decision**: Raw artifact contents — full native fidelity
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The raw artifact preserves all native Claude Code session fields: `uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, summary events, and any other top-level fields present in the source JSONL. Aggregation rules (combining multiple session files into one stream) match what the runner already uses for normalization, so the two artifacts describe the same run.
  2. Schema drift in Claude Code's native output (new fields, removed fields) will pass through transparently. Downstream consumers (e.g., `/insights`) inherit responsibility for tolerating native schema evolution.
- **Reviewer Notes**: Implementation must avoid any post-processing that drops, renames, or restructures native fields beyond redaction. Acceptance test: sample a real artifact and assert presence of `uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`.

- **Decision**: Retention parity (30 days)
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Raw artifacts inherit the same 30-day retention window and pruning cadence as normalized artifacts. The existing pruning job is extended (rather than duplicated) so a job's normalized and raw artifacts are deleted together.
  2. Operators cannot retain the raw form longer than the normalized one without a separate ticket. Acceptable: the two artifacts describe the same run and should age out together.
- **Reviewer Notes**: Pruning must remove both objects atomically per job (or, if not atomic, at least within the same scheduled run) so the system never has a raw artifact pointing at a job whose normalized record is gone.

- **Decision**: Empty / no-session-data Claude jobs
- **Policy Applied**: CONSERVATIVE
- **Confidence**: Medium (0.6)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. If a Claude job produces no session data at all (e.g., crashed before any event, or session files missing), no raw artifact is uploaded and the absence is logged at info level — *not* treated as an error. This matches the description's "Each Claude Code job that produces session data".
  2. A future investigation of "no logs" cases must distinguish "agent never wrote anything" from "raw upload failed" — both result in a missing raw artifact. The runner log entries differ, so this is recoverable but requires reading two log lines.
- **Reviewer Notes**: Confirm during planning that the no-session-data path emits an informational log distinct from the failure log, so future Insights tooling can tell them apart.

- **Decision**: Retrieval API surface
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High (0.9)
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. The raw artifact is fetched through a new endpoint that mirrors the existing normalized raw-log endpoint (`GET /api/projects/:projectId/tickets/:id/jobs/:jobId/logs/raw`): same authorization (project owner OR member), same canonical-key re-derivation defense from AIB-724, same gzipped-stream response. The existing endpoint URL and behavior are unchanged.
  2. Adding a sibling endpoint slightly increases API surface; alternatives like a query parameter were rejected because they complicate caching and authorization audits.
- **Reviewer Notes**: Plan must specify the exact route shape and confirm the access-control helper used (must be `verifyTicketAccess` or equivalent). The endpoint MUST 404 (not 500) for non-Claude jobs and for Claude jobs with no raw artifact.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable raw-session capture for Claude jobs (Priority: P1)

When a Claude Code agent runs a ticket command to completion, AI-Board persists the native session JSONL alongside the normalized log so downstream tooling can replay the run with full fidelity.

**Why this priority**: This is the entire feature. Without it, the follow-up Admin Insights work cannot consume real Claude Code sessions, because the normalized format is lossy. P1 because it is the prerequisite step the rest of the workflow depends on.

**Independent Test**: Run a Claude Code job end-to-end on a small ticket; verify two artifacts exist for the job (normalized — unchanged — and raw native), both gzipped, both retrievable through the API by an authorized project member.

**Acceptance Scenarios**:

1. **Given** a Claude Code job that completes successfully and produced session data, **When** the runner finishes capture, **Then** both the existing normalized artifact and a new raw native artifact are present in storage under the same project/ticket/job grouping, and both are retrievable through the API by a project member.
2. **Given** a downloaded raw artifact, **When** an inspector decompresses and parses it, **Then** every line is a valid native Claude Code session event preserving `uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, and any summary events emitted during the run.
3. **Given** an authorized project member calls the new retrieval endpoint for a job's raw artifact, **When** the request is served, **Then** the response is a gzipped stream of the native JSONL identical to what was uploaded.

---

### User Story 2 - No secrets leak through the raw artifact (Priority: P1)

The raw artifact must be redacted using the same rules as the normalized one, so capturing more native context never weakens AI-Board's existing secret-protection guarantees.

**Why this priority**: Adding a second persistence path doubles the leak surface for the same Claude job. Tied with Story 1 at P1 because shipping fidelity without redaction parity would regress AIB-715/AIB-724.

**Independent Test**: Run a Claude Code job whose tool input or tool output deliberately contains representative secret patterns (GitHub token, generic `KEY=VALUE` env, private SSH key, OAuth bearer); fetch the raw artifact; assert no plaintext secret remains and that `[REDACTED]` placeholders appear at every site.

**Acceptance Scenarios**:

1. **Given** a Claude Code job whose tool invocations included a string matching any redacted secret class, **When** the raw artifact is uploaded, **Then** every occurrence of the secret in any nested field (message content, tool input, tool result, summary text) is replaced with the redaction placeholder.
2. **Given** the normalized and raw artifacts for the same job, **When** both are scanned for the redaction placeholder, **Then** every secret class redacted in the normalized artifact is also redacted in the raw artifact (no class is scrubbed in one but not the other).

---

### User Story 3 - Non-Claude jobs are unaffected (Priority: P2)

Jobs run by Codex, Mistral, or Gemini agents continue to behave exactly as they do today: one normalized artifact, no raw native artifact, no errors, no log noise suggesting one is missing.

**Why this priority**: Regressing other agents is unacceptable, but the feature is gated cleanly on agent type, so the risk is contained. P2 because verification is straightforward and the gate is the smallest piece of code in the feature.

**Independent Test**: Run a Codex job (and separately a Mistral and Gemini job) and confirm exactly one artifact exists per job, no raw upload attempt is made, and no error or warning relating to raw capture is logged.

**Acceptance Scenarios**:

1. **Given** a job whose agent is not Claude Code, **When** it completes, **Then** no raw artifact is uploaded and the runner logs contain no entry referring to a raw-capture attempt or failure for that job.
2. **Given** a project mixing Claude and non-Claude jobs, **When** the retrieval endpoint is called for a non-Claude job's raw artifact, **Then** the response is a clean "not available" outcome (404), not an error.

---

### User Story 4 - Raw-capture failure never breaks the job (Priority: P2)

If anything in the raw-capture path fails — source files missing, redaction crash, storage rejection, network timeout — the job still reaches its correct terminal status with a complete normalized artifact, and the failure is visible to operators in the runner logs.

**Why this priority**: This is a reliability guarantee, not a happy-path feature. P2 because it is essential for trust but the implementation is a single failure-isolation boundary.

**Independent Test**: Inject a synthetic failure at each stage of the raw-capture pipeline (read, redact, gzip, upload); verify the job's terminal status is unchanged from a clean run, the normalized artifact is identical, and a structured error log entry identifies the job and the failed stage.

**Acceptance Scenarios**:

1. **Given** a Claude Code job whose raw upload fails for any reason, **When** the workflow reports terminal status, **Then** the status reported to AI-Board is the same as it would have been if the raw upload had succeeded, and the normalized artifact is present and complete.
2. **Given** a failed raw upload, **When** an operator searches the runner logs, **Then** a structured entry exists with the job identifier, agent identifier, and a non-secret reason describing the failure stage.

---

### User Story 5 - Retention parity for raw artifacts (Priority: P3)

Raw artifacts age out on the same 30-day schedule as normalized artifacts, so the system never accumulates orphaned raw data and storage cost stays bounded.

**Why this priority**: Required for storage hygiene and security parity, but the failure mode is gradual cost growth — not a user-visible regression. P3.

**Independent Test**: Backdate a job's records past the retention cutoff; run the pruning job; verify both the normalized and raw artifacts are removed in the same run.

**Acceptance Scenarios**:

1. **Given** a job whose normalized and raw artifacts have both passed the retention window, **When** the scheduled pruning job runs, **Then** both artifacts are deleted and observability counts the deletions.
2. **Given** a partially-pruned state (e.g., a previous run failed mid-way), **When** pruning runs again, **Then** the operation is idempotent and ends with neither artifact present.

---

### Edge Cases

- A Claude Code job started but never produced any session data (e.g., crashed before first event): no raw artifact uploaded, an informational log entry distinguishes this from a capture failure, and the retrieval endpoint returns a clean "not available" response.
- A Claude Code job retried within the same workflow run that overwrites previous artifacts: overwrite is observable (matching AIB-724's overwrite-logging requirement) for both the normalized and raw artifacts.
- A redaction rule is updated between the normalized and raw redaction passes (operationally near-impossible, but worth pinning): both artifacts MUST be redacted with the same rule set within a single job; the implementation MUST NOT reload the rule set between passes.
- A native session field contains binary or non-UTF-8 data: the artifact preserves it losslessly through the gzip layer; redaction operates only on string fields.
- The raw artifact exceeds reasonable size (e.g., very long agent run): no special-casing — the same gzip pipeline applies. If size is impractical for retrieval, that is handled in the follow-up Insights ticket, not here.
- A non-member calls the new retrieval endpoint: response matches existing access-control behavior for the normalized endpoint (forbidden / not found), with no information leaked about the artifact's existence.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When the agent for a completed job is Claude Code, the runner MUST aggregate the native Claude Code session files into a single JSONL stream and persist it as a separate artifact alongside the existing normalized artifact.
- **FR-002**: The raw artifact MUST preserve every native field present in the source session files (including, at minimum, `uuid`, `parentUuid`, `sessionId`, `isSidechain`, `usage`, `cwd`, `gitBranch`, `version`, and summary events) without renaming, dropping, or restructuring them.
- **FR-003**: The raw artifact MUST be passed through the same secret-redaction rules as the normalized artifact, applied to every string-valued field at every nesting depth, before leaving the runner.
- **FR-004**: The raw artifact MUST be gzip-compressed at rest using the same compression conventions as the normalized artifact.
- **FR-005**: The raw artifact MUST be stored under the same `(projectId, ticketId, jobId)` grouping as the normalized artifact, using a distinct, deterministically derivable storage key.
- **FR-006**: The system MUST expose the raw artifact through an authenticated retrieval endpoint that mirrors the access-control rules of the existing normalized raw-log endpoint (project owner OR member); unauthorized callers receive the same response shape as for the normalized endpoint.
- **FR-007**: The retrieval endpoint MUST re-derive the storage key from the request path (`projectId`, `ticketId`, `jobId`) rather than trusting any database-stored value, matching the AIB-724 hardening for normalized logs.
- **FR-008**: For jobs whose agent is not Claude Code, the runner MUST NOT attempt any raw-artifact capture or upload, MUST NOT emit any raw-capture error, and the retrieval endpoint MUST respond with a clean "not available" outcome.
- **FR-009**: A Claude Code job that produced no session data MUST result in no raw artifact upload, an informational log entry distinguishing this case from an upload failure, and a clean "not available" response from the retrieval endpoint.
- **FR-010**: A failure at any stage of the raw-capture path (source read, redaction, compression, upload) MUST NOT change the job's terminal status, MUST NOT affect the normalized artifact, and MUST emit a structured runner log entry containing the job identifier, agent identifier, and a non-secret failure reason.
- **FR-011**: The retention pruning job MUST delete each job's raw artifact on the same 30-day schedule as the normalized artifact, in a manner that is idempotent and that does not leave orphaned raw artifacts after a normalized artifact is removed.
- **FR-012**: Overwrites of an existing raw artifact (e.g., from a retried workflow run) MUST be observable in structured operations logs, consistent with AIB-724's overwrite-logging requirement for normalized artifacts.
- **FR-013**: The existing normalized artifact's format, storage key, retrieval endpoint, and behavior MUST NOT change.

### Assumptions

- The runner already aggregates native Claude Code session files for normalization purposes; this feature reuses that aggregation rather than re-implementing it.
- The existing secret-redaction module operates on arbitrary string content and can be invoked over each line of the aggregated native JSONL without modification beyond the call site.
- Durable object storage and the existing artifact-upload transport (the same one used for normalized logs) can accommodate roughly double the per-Claude-job storage footprint within current budgets.
- The retention pruning job is the appropriate extension point for adding raw-artifact deletion; no separate scheduler is needed.
- "Native Claude Code session JSONL" refers to the on-disk session files produced by Claude Code in its standard layout; no upstream-format change is required for this feature.

### Key Entities *(include if feature involves data)*

- **Raw native session artifact**: A gzipped JSONL stream of the aggregated native Claude Code session events for a single job, redacted of secrets, stored under the same project/ticket/job grouping as the normalized artifact, retained for 30 days.
- **Job (existing)**: Gains an associated raw native artifact when its agent is Claude Code and session data was produced; otherwise unchanged.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Raw-session capture (per Claude Code job)**: Triggered at the end of every Claude Code job that has reached a terminal status, after the existing normalized capture pipeline runs.
  - **Input**: The job identifier (`projectId`, `ticketId`, `jobId`), the agent identifier (must be Claude), and the native Claude Code session files produced during the job on the runner filesystem.
  - **Phases**:
    1. Gate on agent type — short-circuit immediately for non-Claude jobs.
    2. Aggregate the native session files into a single in-memory JSONL stream using the same aggregation rules already used for normalization.
    3. Apply the secret-redaction rules to every string-valued field at every nesting depth in every event.
    4. Gzip-compress the redacted stream.
    5. Upload the compressed artifact to durable storage under the canonical raw-artifact key for `(projectId, ticketId, jobId)`.
    6. On any failure in steps 2–5, emit a structured runner error log and proceed; on success, emit a structured info log.
  - **Output**: A gzipped raw artifact in durable storage retrievable through the new endpoint; runner log entries (info on success or no-data, error on failure) keyed by job identifier.
  - **Error behavior**: All failures are non-blocking with respect to the job's terminal status and the normalized artifact. The capture is not retried within the same workflow run; a failed raw artifact is simply absent until the next time the job runs (e.g., a retry triggered by other workflow logic).

- **Retention pruning (extended)**: The existing scheduled pruning job is extended to also delete raw artifacts.
  - **Input**: Set of jobs whose normalized artifacts are eligible for deletion under the 30-day window.
  - **Phases**:
    1. For each eligible job, attempt to delete the normalized artifact (existing behavior).
    2. For each same eligible job whose agent is Claude Code, attempt to delete the raw artifact under the canonical raw-artifact key.
    3. Increment observability counters separately for normalized deletions and raw deletions.
  - **Output**: Both artifacts removed from storage; observability counters updated.
  - **Error behavior**: Idempotent — re-running after a partial failure converges to the all-deleted state. A missing raw artifact for a Claude job is not treated as an error (it may simply have never been produced).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Claude Code job that produces session data, both a normalized artifact and a raw native artifact are present and retrievable within five minutes of the job reaching terminal status.
- **SC-002**: A randomly sampled raw artifact, when decompressed and parsed, contains every native field listed in FR-002 in at least one event of the stream — verified across a representative production sample of 20 jobs.
- **SC-003**: Across a redaction test fixture covering every secret class supported by the normalized artifact, the raw artifact contains zero plaintext occurrences of any test secret and the same number of redaction placeholders as the normalized artifact for the same fixture.
- **SC-004**: Zero non-Claude jobs produce a raw artifact, attempt a raw upload, or emit a raw-capture log entry, measured over a representative production sample of 50 non-Claude jobs.
- **SC-005**: When a synthetic raw-upload failure is injected, 100% of affected jobs still reach their correct terminal status with an unchanged normalized artifact, and 100% of failures appear as a single structured log entry containing the job identifier and a non-secret reason.
- **SC-006**: After the retention pruning job runs, no raw artifact older than 30 days exists in storage, and no raw artifact remains for any job whose normalized artifact has been deleted.
- **SC-007**: The existing normalized log viewer continues to function with no observable change in load time, content, or error rate after the feature ships, measured over the seven days following rollout.
