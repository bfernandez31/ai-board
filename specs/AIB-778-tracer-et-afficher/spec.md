# Feature Specification: Track and display plugin and agent CLI version per job

**Feature Branch**: `AIB-778-tracer-et-afficher`
**Created**: 2026-05-08
**Status**: Draft
**Input**: AIB-778 — "Tracer et afficher la version du plugin et de l'agent sur chaque job 4.7"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Plugin version is captured from the AI-Board plugin manifest's published version field (the same identifier humans use to reason about plugin releases).
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — ticket says "version exacte" without specifying whether it means semantic version string, git commit SHA, or both.
- **Fallback Triggered?**: Yes — confidence < 0.5; chose the most authoritative single identifier (manifest version) as the primary value to keep scope tight while still solving the comparability problem.
- **Trade-offs**:
  1. Two runs on the same plugin version with intermediate uncommitted/unreleased changes would appear identical (acceptable: plugin releases are bumped per change in normal flow).
  2. Avoids the additional capture and display surface area of carrying both semver and SHA, which the ticket explicitly defers to future work.
- **Reviewer Notes**: Confirm a manifest version string is sufficient for the future comparison features (benchmark, A/B, replay). If commit-level precision is later required, the field can be extended without migration.

---

- **Decision**: Agent CLI version is captured from the CLI binary itself at job start, using each agent's standard version reporting mechanism.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — ticket lists 4 supported CLIs but does not specify the capture command for each.
- **Fallback Triggered?**: Yes — confidence < 0.5; chose to capture from the CLI binary (most accurate) rather than from a configured/declared version (could drift).
- **Trade-offs**:
  1. Requires per-agent knowledge of how to invoke version reporting; adds a small abstraction.
  2. Truthful reporting — what's stored is what actually ran, not what was meant to run.
- **Reviewer Notes**: Confirm each of the 4 supported CLIs (claude-code, codex, gemini-cli, mistral-vibe) exposes a stable version-reporting mechanism on the runner.

---

- **Decision**: Capture happens at job start, before the agent CLI executes its task; values are persisted on the job record alongside the existing execution metrics.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Medium (0.6) — earliest moment yields the version that actually ran the job.
- **Fallback Triggered?**: No — straightforward operational answer.
- **Trade-offs**:
  1. Adds a small step at job startup; failure must not block the job (handled by FR-004).
  2. Captured values reflect the runtime that actually executed, not a post-hoc reconstruction.
- **Reviewer Notes**: Verify that capture-step failure paths surface in logs but do not change job status.

---

- **Decision**: When either value is missing (older job or capture failure), the job detail UI shows a discreet em-dash placeholder in the same slot rather than hiding the field, omitting it conditionally, or showing an error.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Medium (0.6) — ticket explicitly asks for a "discreet placeholder rather than an empty field or error".
- **Fallback Triggered?**: No — directly stated in acceptance criteria.
- **Trade-offs**:
  1. Layout stays stable across jobs with and without the data.
  2. Reviewers can tell at a glance that the data is "not captured" rather than "zero" or "error".
- **Reviewer Notes**: Confirm placeholder visual matches existing missing-metric conventions in the job detail panel.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect plugin and agent CLI version on a single job (Priority: P1)

A user opens a ticket and expands a job in the job timeline (the same panel that already shows tokens, duration, cost, model, and per-turn context). Two new compact labels appear in that zone: the plugin version that ran this job and the agent CLI version that executed it. The user can read both values without leaving the page or querying the database.

**Why this priority**: This is the entire user-facing value of the ticket. Without this, captured data is invisible and the feature provides nothing observable. Future comparison features (benchmark, A/B, replay) all depend on this traceability being present and inspectable.

**Independent Test**: Run a new job, open its detail panel, confirm both version labels appear in the same zone as model/tokens/cost.

**Acceptance Scenarios**:

1. **Given** a job that ran after this feature shipped with successful capture, **When** the user expands the job in the job timeline, **Then** the plugin version and agent CLI version are visible as compact labels in the same metric zone as model, tokens, duration, and cost.
2. **Given** a job that pre-dates this feature, **When** the user expands the job, **Then** both labels render with a discreet placeholder (em-dash) and the rest of the panel is unaffected.
3. **Given** a job whose capture step failed, **When** the user expands the job, **Then** both labels render with the same discreet placeholder — no error message, no broken layout.

---

### User Story 2 - Persist plugin and agent CLI version with every new job (Priority: P1)

For every job started after this feature ships, the system records the plugin version and the agent CLI version on the job record itself. The values are persisted alongside the other execution metrics already captured (model, tokens, costs, durations) so they can be retrieved for any historical or future analysis.

**Why this priority**: The display surface in Story 1 only works if the data is actually persisted; this is the data-collection backbone. It is also what unlocks every future comparison feature listed as out-of-scope today (benchmark, A/B, replay, counterfactual).

**Independent Test**: Trigger a job for each of the 4 supported agents, confirm the job record contains a non-null plugin version and agent CLI version on completion (or as soon as capture finishes — versions are known at start, not end).

**Acceptance Scenarios**:

1. **Given** a job is dispatched on any of the 4 supported agents (CLAUDE, CODEX, GEMINI, MISTRAL), **When** the job starts, **Then** the runner captures the plugin version and the agent CLI version and stores them on the job record before the agent's main task runs.
2. **Given** the capture step fails (e.g., CLI binary missing, manifest unreadable), **When** the runner reaches the agent task, **Then** the job continues normally and the corresponding version field remains absent on the job record.
3. **Given** a job that started before this feature shipped, **When** the user inspects it, **Then** the version fields remain absent — no backfill is performed.

---

### User Story 3 - Graceful degradation when capture is unavailable (Priority: P2)

When version capture fails for any reason — missing CLI on the runner, unreadable plugin manifest, transient I/O error — the job runs to completion as if the capture step did not exist. The UI surfaces the absence as a discreet placeholder rather than an error.

**Why this priority**: Capture failures should be rare but inevitable; without explicit graceful degradation, a defect in this auxiliary capture path could fail real jobs. Lower than P1 because it is a non-functional safety property, not a primary user value.

**Independent Test**: Simulate a capture failure (e.g., point at a non-existent CLI binary or remove the plugin manifest); confirm the job completes with its normal status and the UI shows the placeholder.

**Acceptance Scenarios**:

1. **Given** the plugin manifest cannot be read at job start, **When** the job runs, **Then** the job's status is determined entirely by the agent task (not by capture), and the plugin version field is absent.
2. **Given** the agent CLI binary does not respond to a version query, **When** the job runs, **Then** the job's status is determined entirely by the agent task, and the agent CLI version field is absent.
3. **Given** a capture failure occurs, **When** an operator inspects runner logs, **Then** the failure cause is recorded with enough context to diagnose, but no user-facing error is shown.

---

### Edge Cases

- A new agent type is added in the future: the version-capture abstraction should make adding a fifth agent a localized change (per-agent version-capture rule) rather than a cross-cutting change.
- Plugin manifest version string is malformed (e.g., not a typical semver): system stores the raw value as-is — capture is not validation.
- Two jobs run within the same second on the same plugin version and same agent CLI version: both records show identical version labels (expected, this is the comparability the feature enables).
- A job that was started but cancelled before the agent task ran: if capture happened first, version fields are populated; if cancellation pre-empted capture, fields are absent. Either is acceptable; UI handles both via the placeholder.
- Display zone width: when both labels are present they must fit alongside existing metrics without breaking the panel layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST capture and persist the AI-Board plugin version on every new job started after this feature is released. Source: the plugin's published version identifier.
- **FR-002**: System MUST capture and persist the agent CLI version on every new job started after this feature is released. Source: the running agent CLI binary's own version output.
- **FR-003**: Capture MUST cover all four supported agents — CLAUDE (claude-code), CODEX (codex), GEMINI (gemini-cli), MISTRAL (mistral-vibe). Each agent MUST have a defined mechanism for retrieving its CLI version.
- **FR-004**: If capture fails for either value (plugin or agent CLI), the job MUST continue to run normally. The corresponding field MUST be left absent rather than populated with a sentinel error string.
- **FR-005**: Jobs that completed before this feature shipped MUST remain unchanged — no backfill, no migration of historical data.
- **FR-006**: The job detail UI (the panel that already shows model, tokens, durations, cost, and per-turn context) MUST display the captured plugin version and agent CLI version in the same metric zone as those other values.
- **FR-007**: When a value is absent (old job, capture failure, or in-flight job before capture completes), the UI MUST render a discreet placeholder in that slot rather than hiding the label, omitting the row, or showing an error.
- **FR-008**: The on-screen presentation of both versions MUST be compact and consistent in style with the existing execution metric badges/labels in the same zone (no full-width row, no separate card).
- **FR-009**: Capture MUST happen at job start, before the agent CLI begins its main task, so the persisted values reflect what actually executed.
- **FR-010**: Capture failures MUST be recorded in runner-side logs with enough detail to diagnose (which value failed, error cause), but MUST NOT propagate to job status or to the user-facing UI.

### Key Entities *(include if feature involves data)*

- **Job**: Already exists. Gains two new optional metadata fields — plugin version and agent CLI version — alongside existing execution metrics (model, tokens, durations, cost, per-turn context). Both fields are nullable; null means "not captured" (either pre-feature or capture failure).
- **Plugin version source (manifest)**: The authoritative version identifier for the AI-Board plugin code that the job is running under. Read at job start.
- **Agent CLI binary**: The local CLI binary corresponding to the job's resolved agent (CLAUDE/CODEX/GEMINI/MISTRAL). Each binary exposes a version reporting mechanism that the runner can invoke.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Job-start version capture**: A pre-task step that runs once per job, before the agent CLI begins its main work, to record which plugin and which CLI are about to execute.
  - **Input**: The dispatched job context (agent type, project, ticket, command), access to the plugin manifest on disk, access to the local agent CLI binary.
  - **Phases**:
    1. Read the plugin manifest and extract the published version identifier.
    2. Resolve the agent CLI binary for the job's agent type (per-agent rule for the four supported agents).
    3. Invoke the binary's version reporting mechanism and read the result.
    4. Persist both values on the job record alongside existing execution metadata.
  - **Output**: Two new values stored on the job record; runner-side log lines covering capture success or failure.
  - **Error behavior**: Each value is captured independently — failure to read the plugin manifest does not block agent CLI version capture, and vice versa. Any failure is logged, the corresponding field is left absent, and the job proceeds to its agent task. No retry, no job-level failure, no user-facing error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of jobs started after the feature ships have a plugin version and an agent CLI version recorded on their job record when capture succeeds. Measured by: querying jobs created in the first 7 days post-release and counting the share with both fields populated.
- **SC-002**: 0 jobs fail or change status because of version capture issues. Measured by: any job whose final status differs from what the agent task itself produced is a regression — should be 0.
- **SC-003**: A reviewer inspecting a job in the UI can identify the exact plugin version and agent CLI version pairing in under 5 seconds from opening the job detail panel — no scrolling, no extra clicks, no copying from logs.
- **SC-004**: All four supported agents (CLAUDE, CODEX, GEMINI, MISTRAL) successfully report a CLI version on a representative job. Measured by: at least one completed job per agent type with the agent CLI version field populated within the first 14 days post-release.
- **SC-005**: Older jobs (pre-release) and jobs whose capture failed render the discreet placeholder in the UI without layout breakage or error. Measured by: visual review of at least one example of each missing-data scenario after release.
- **SC-006**: The new labels add no measurable overhead to job dispatch — capture step adds under 1 second to job start time on the standard runner.
