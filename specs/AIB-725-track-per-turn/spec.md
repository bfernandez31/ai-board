# Feature Specification: Track Per-Turn Context Size on Jobs to Analyze Context Rot Impact on Quality

**Feature Branch**: `AIB-725-track-per-turn`
**Created**: 2026-04-24
**Status**: Draft
**Input**: Ticket AIB-725 — "Track per-turn context size on jobs to analyze context rot impact on quality"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Default visual-indicator thresholds for peak context size.
  - **Policy Applied**: AUTO (low confidence → CONSERVATIVE fallback)
  - **Confidence**: Low (0.3) — only an internal-observability signal (-2) and a neutral feature signal (+1); netScore -1, absScore 1.
  - **Fallback Triggered?**: Yes. Low confidence → fallback to CONSERVATIVE defaults. The ticket itself states "exact thresholds to be tuned based on observed data", so initial values are deliberately chosen from public guidance rather than invented.
  - **Trade-offs**:
    1. Starting with conservative thresholds (healthy < 60% of model context window, warning 60–80%, danger > 80%) means a few jobs may show an amber pill that turn out to be fine once real data is in. That is acceptable — the goal of the ticket is to learn, and a slightly over-sensitive indicator surfaces more candidates for analysis.
    2. Cost is one extra configurable constant that we will almost certainly revisit in a follow-up once two to three weeks of data are available.
  - **Reviewer Notes**: Threshold constants must be centralized (single module), not hard-coded in components, so they can be tuned from a single place once we have data.

- **Decision**: The new fields live on the existing `Job` model alongside current aggregated telemetry (same nullability pattern as `inputTokens`, `costUsd`, `durationMs`).
  - **Policy Applied**: AUTO
  - **Confidence**: High — every per-job telemetry field already follows this pattern (`Int?` / `Float?`), and the ticket says "recorded on completed jobs". Adding a separate entity would be over-engineering.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Three additional nullable columns on a high-cardinality table. Negligible impact for this deployment.
    2. Keeps querying trivial: the same analytics queries that join Job already see these values.
  - **Reviewer Notes**: Confirm field names during planning — suggest `peakContextTokens`, `avgContextTokens`, `turnCount` to align with existing `*Tokens` naming.

- **Decision**: The analytics view is **project-level**, extending the existing analytics dashboard rather than adding a new global view.
  - **Policy Applied**: AUTO
  - **Confidence**: Medium — the ticket says "project-level or global"; the existing analytics dashboard is already project-level and already supports filtering by range, outcome, and agent, so extending it is the lower-friction choice and matches where the user will already be looking when investigating quality regressions for a specific project.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. Users investigating fleet-wide trends across many projects will not see a single combined view. Acceptable for a hypothesis-validation feature — if the correlation is real on one project, it will be real elsewhere.
    2. Avoids building a second dashboard surface and the permission model that a global view would require.
  - **Reviewer Notes**: The dashboard already lives at `/projects/:projectId/analytics`; the new distribution chart should slot into that page.

- **Decision**: Mistral jobs (and any future agent without per-turn telemetry) leave the new fields null, and the UI renders no pill at all for those jobs (not a zero value, not a "n/a" placeholder).
  - **Policy Applied**: AUTO
  - **Confidence**: High — the ticket explicitly requires this degradation behavior.
  - **Fallback Triggered?**: No.
  - **Trade-offs**:
    1. A small visual inconsistency between Claude/Codex rows and Mistral rows, but this already exists for other agent-specific fields.
  - **Reviewer Notes**: Confirm during review of the job timeline component that a null value hides the pill rather than rendering "0" or "—".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — See peak context size on each job in the timeline (Priority: P1)

An AI-Board operator is reviewing a ticket whose verify job produced an unexpectedly low quality score. They open the ticket, expand the jobs timeline, and immediately see on each Claude job a compact pill showing the peak context size reached during that run. A job whose peak crossed the danger threshold is visually distinguished from jobs that stayed in the healthy range, so the operator can tell at a glance whether context rot is a plausible explanation for the quality drop.

**Why this priority**: Without this, the data exists in the database but is invisible; the feature is worthless until an operator can see it in the flow where they already investigate quality regressions.

**Independent Test**: Create a ticket, run a full-workflow job end-to-end with Claude as the agent, and verify that after the job completes the timeline row shows the peak context pill with the correct value and a color matching the threshold the peak crossed. Ship only this and the feature is already useful for one-off inspection.

**Acceptance Scenarios**:

1. **Given** a completed Claude job whose observed peak turn was well within the healthy band, **When** the operator views the jobs timeline, **Then** a neutral-styled pill displays the peak value alongside existing duration and cost indicators.
2. **Given** a completed Claude job whose observed peak turn crossed the danger threshold, **When** the operator views the jobs timeline, **Then** the peak pill is visually distinct (danger styling) so it is obvious at a glance that this job was at context-rot risk.
3. **Given** a completed Mistral job, **When** the operator views the jobs timeline, **Then** no peak-context pill is rendered for that job (not a zero, not a placeholder).
4. **Given** a job that predates this feature and has no recorded peak value, **When** the operator views the jobs timeline, **Then** no peak-context pill is rendered and the row is otherwise unchanged.

---

### User Story 2 — Cross peak context size with quality score in analytics (Priority: P2)

The same operator (or a product-side reviewer) wants to answer: "On this project, is there a correlation between peak context size and quality-score drops?" They open the project analytics page and find a distribution view of peak context size across recent jobs, with the ability to filter or group by command type (implement, verify, ship, iterate), workflow type (FULL vs QUICK), and quality-score bucket. They can visually confirm or rule out whether high-peak jobs are over-represented among low-quality-score jobs.

**Why this priority**: This is the quantitative payoff of the ticket. Without it, we can see individual jobs but cannot make the project-level judgment that the ticket says is the whole point of shipping this metric now.

**Independent Test**: Seed the project with a mix of Claude jobs spanning several commands and quality scores, open the project analytics page, and verify that the peak-context distribution view renders with correct buckets and that the documented filters actually change the displayed distribution.

**Acceptance Scenarios**:

1. **Given** a project with ≥10 completed Claude jobs spanning multiple commands, **When** the operator opens the analytics page, **Then** a peak-context-size distribution visualization is shown.
2. **Given** that visualization, **When** the operator filters or groups by command type, workflow type, or quality-score bucket, **Then** the distribution updates to reflect only matching jobs.
3. **Given** a project whose only completed jobs were run with Mistral, **When** the operator opens the analytics page, **Then** the peak-context visualization renders an empty/"no data yet" state rather than zero-filled bars.

---

### User Story 3 — Inspect average context and turn count for a single run (Priority: P3)

An operator investigating one specific job wants to distinguish "one outlier turn pushed the peak up" from "the whole run was heavy". They expand the job's detail/breakdown area and see average context size and turn count alongside the existing token / cost / duration breakdown. Together with the peak, these three numbers give them enough to form a quick hypothesis about what happened during the run.

**Why this priority**: Useful for diagnosis once the operator has already been flagged by P1, but not needed to validate the feature or ship value. Safe to land in the same PR but not the blocking path.

**Independent Test**: Open the detail/breakdown area for a completed Claude job and verify that average context size and turn count render with the correct values, and that for a Mistral job those rows are hidden rather than shown as zeros.

**Acceptance Scenarios**:

1. **Given** a completed Claude job, **When** the operator expands the breakdown, **Then** average context size and turn count are shown alongside existing telemetry.
2. **Given** a completed Mistral job, **When** the operator expands the breakdown, **Then** the average-context and turn-count rows are hidden (same rule as the timeline pill).

---

### Edge Cases

- **Single-turn job**: peak == average; turn count == 1. The indicator still renders using the same threshold rules. No special case.
- **In-progress job**: telemetry is finalized when the job completes. Running jobs do not display a partial pill. (The ticket explicitly scopes out live alerting.)
- **Telemetry arrives after completion**: if the metric-recording pipeline observes a late event for a completed job, the values update silently and the UI reflects the new numbers on the next refresh. No user-facing error.
- **Agent that normally provides per-turn data returns a run with zero turns extracted** (e.g., telemetry corruption): fields remain null rather than being stored as zeros, so the row is treated the same as a Mistral row rather than showing a false "healthy" green pill.
- **Agents that do not currently have per-turn telemetry** (Mistral today): job completes successfully, fields stay null, UI hides the indicator. No warning, no placeholder.
- **Jobs created before this feature shipped**: fields are null; UI hides the indicator. No backfill is attempted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record a peak-context-size value on a completed job whenever the agent's telemetry exposes a per-turn context size.
- **FR-002**: The system MUST record an average-context-size value on a completed job whenever the agent's telemetry exposes a per-turn context size; the average is computed as the arithmetic mean across the turns observed.
- **FR-003**: The system MUST record a turn-count value on a completed job whenever the agent's telemetry exposes per-turn boundaries.
- **FR-004**: The system MUST leave all three values unset on jobs whose agent does not expose per-turn telemetry (currently: Mistral), and MUST NOT store a zero as a stand-in for "unknown".
- **FR-005**: The system MUST populate these values from telemetry the platform already ingests. No new runner-side instrumentation, no new payload fields emitted by the agent CLIs, and no extra work on the job runner's side.
- **FR-006**: The job timeline UI MUST display the peak-context value as a compact indicator on each job row for which the value is set.
- **FR-007**: The peak-context indicator MUST use a neutral style below the warning threshold, a warning style between the warning and danger thresholds, and a danger style at or above the danger threshold. Thresholds MUST be defined as a percentage of the job's model context window and centralized in a single module so they can be tuned without touching rendering code.
- **FR-008**: The job timeline UI MUST render nothing (no pill, no placeholder) for a job whose peak-context value is unset, and the surrounding row layout MUST remain visually unchanged compared to jobs prior to this feature.
- **FR-009**: The job detail/breakdown area MUST display average context size and turn count alongside the existing per-job token, cost, and duration breakdown, with the same "hide entirely when unset" rule as the timeline pill.
- **FR-010**: The project analytics page MUST include a distribution visualization of peak context size across the project's completed jobs.
- **FR-011**: That analytics visualization MUST allow filtering or grouping by command type, workflow type (FULL vs QUICK), and quality-score bucket, so the peak-context distribution can be crossed against quality outcomes.
- **FR-012**: The analytics visualization MUST render a meaningful empty state when no jobs in the current filter have a recorded peak-context value (e.g., a Mistral-only project, or a project with only pre-feature historical jobs).
- **FR-013**: The system MUST NOT regress any existing per-job telemetry field or analytics chart: total token counts, cost, duration, tool list, quality score, and all existing dashboard visualizations continue to behave identically.
- **FR-014**: The system MUST NOT attempt to backfill the new fields on pre-existing jobs.
- **FR-015**: The new fields MUST be exposed to the existing server-rendered and polled endpoints that already return job telemetry, so the timeline and analytics views can consume them without a new bespoke API surface.

### Assumptions

- **A-001**: Claude Code CLI and Codex CLI already emit per-call OTLP events with enough information to derive a per-turn context size; the feature relies on that data being present in the telemetry stream that the platform already ingests. If a given agent's events turn out not to carry enough information to compute peak/average at the telemetry layer, that agent falls under FR-004 (fields unset, UI hidden) rather than blocking the feature.
- **A-002**: "Context size" for a single turn means the count of tokens the model had to attend to at that turn. The exact computation is an implementation detail for the planning phase; the spec only requires that the same computation be used for peak and average within a single job.
- **A-003**: The model's context-window size (used to derive percentage-based thresholds) is known per job from the `model` field that is already recorded on the Job. For models where this is unknown, the indicator falls back to the neutral style or is hidden — planning phase to choose.
- **A-004**: Post-hoc only. No alerting, no live crossing of thresholds during a running job, no user notifications.

### Key Entities

- **Job telemetry**: Extends the existing per-job telemetry with three new numeric values — peak context size, average context size, turn count — each of which is null when the agent's telemetry does not expose per-turn data. All other existing telemetry fields are unchanged.

### Internal Processes

- **Job telemetry ingestion — extended**: The existing telemetry-ingestion process that consumes agent per-call events gains the responsibility of tracking the per-turn context size observed for each event.
  - **Input**: The same agent telemetry stream already consumed today (per-call OTLP events for Claude/Codex/Gemini; batch payload for Mistral).
  - **Phases**:
    1. On each per-turn event observed, derive that turn's context size from the event's token information.
    2. Update a running maximum (peak) and a running sum + turn counter on the job.
    3. On job completion, the average is `sum / turnCount`. If no per-turn events were observed for the job, all three values remain unset.
    4. Persist the three values on the job alongside existing aggregated telemetry.
  - **Output**: Three new values on the completed job (`peak`, `average`, `turnCount`), or three nulls when the agent provided no per-turn data.
  - **Error behavior**: If telemetry arrives late or partially, the values update on the next observed event and the UI reflects them on its next refresh — same behavior as existing aggregated telemetry fields. A parsing error on a single event does not fail the job; the affected event is ignored and the job completes with whatever per-turn data was successfully observed (if zero events were successfully parsed, fields remain null per FR-004).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Claude job completed after this feature ships, all three new values are populated. Measured over a rolling seven-day window, ≥ 99% of completed Claude jobs have non-null values for peak, average, and turn count.
- **SC-002**: No Mistral job completes in a failed or degraded state because of this feature. Measured as: the completed-job success rate for Mistral agents in the two weeks after shipping is equal to or better than the two weeks before shipping.
- **SC-003**: An operator investigating a low-quality-score job can see whether peak context crossed the danger threshold without leaving the ticket page — specifically, the value and its threshold state are visible on the job row in the existing timeline UI without requiring an expand/click.
- **SC-004**: After two to three weeks of normal usage, an operator can answer from the analytics page alone whether peak context size correlates with quality-score drops on this project — i.e., the distribution view and its filters are expressive enough to form a judgment without exporting the data.
- **SC-005**: No regression on the existing telemetry surface: all current analytics charts, the overview cards, and the existing per-job breakdown continue to render identical values to before this feature across the last 30 days of data.
