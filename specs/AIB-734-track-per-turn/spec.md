# Feature Specification: Track Per-Turn Context Size On Jobs To Analyze Context Rot Impact On Quality

**Feature Branch**: `AIB-734-track-per-turn`  
**Created**: 2026-04-24  
**Status**: Draft  
**Input**: User description: "Track per-turn context size on jobs to analyze context rot impact on quality"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Treat this ticket as a post-hoc analytics and observability feature rather than a live intervention or recommendation feature.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from reliability/quality-analysis signals and neutral product context)
- **Fallback Triggered?**: No. AUTO recommended a CONSERVATIVE stance with sufficient confidence.
- **Trade-offs**:
  1. Keeps scope focused on collecting and exposing trustworthy evidence before introducing workflow recommendations or alerts.
  2. Delays any automated QUICK-vs-FULL guidance until the team has enough historical data to validate the hypothesis.
- **Reviewer Notes**: Confirm that no live alerting, auto-routing, or predictive recommendations are expected in this ticket.

- **Decision**: Add the new context metrics only to jobs whose recorded agent telemetry includes turn-level context measurements; leave the metrics empty for unsupported agents and historical jobs.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from data-integrity and reliability signals)
- **Fallback Triggered?**: No. AUTO recommended a CONSERVATIVE stance with sufficient confidence.
- **Trade-offs**:
  1. Preserves data integrity by avoiding fabricated zeros or inferred values.
  2. Produces partial coverage at launch, but keeps comparisons honest and avoids misleading analytics.
- **Reviewer Notes**: Validate the list of supported agent telemetry formats before implementation begins.

- **Decision**: Surface the new metrics in the existing job timeline and project analytics experiences, with filtering by command type, workflow type, and quality-score bucket, instead of introducing a separate analysis product.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from neutral feature context and reliability-analysis signals)
- **Fallback Triggered?**: No. AUTO recommended a CONSERVATIVE stance with sufficient confidence.
- **Trade-offs**:
  1. Reuses existing decision-making surfaces where operators already inspect jobs and trends.
  2. Limits initial scope to project-level analysis, which may postpone broader cross-project reporting.
- **Reviewer Notes**: Confirm whether project-level analytics is sufficient for the first release or whether a true global view is required immediately.

- **Decision**: Show risk indicators only when the metric is present, and use healthy/warning/danger states that can be tuned as operational knowledge improves.
- **Policy Applied**: AUTO
- **Confidence**: Medium (score: +3 from reliability-analysis and user-facing clarity signals)
- **Fallback Triggered?**: No. AUTO recommended a CONSERVATIVE stance with sufficient confidence.
- **Trade-offs**:
  1. Gives users immediate visual signal without overcommitting to fixed thresholds before enough evidence exists.
  2. Requires reviewers to validate that the initial threshold bands remain understandable even if the exact cutoffs change later.
- **Reviewer Notes**: Agree the initial threshold bands and how they should be communicated to users once real telemetry is observed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect Context Risk On A Ticket (Priority: P1)

A project member reviewing a ticket with completed jobs can open the ticket's job history and immediately see whether any completed job ran with a potentially risky context size, along with the peak context size, average context size, and number of model turns when that telemetry exists.

**Why this priority**: The feature's primary value is helping users diagnose unexpected quality drops on specific jobs without needing external logs or manual token forensics.

**Independent Test**: Can be fully tested by opening a ticket that contains completed jobs with and without supported turn-level telemetry and confirming the timeline shows the new metrics and risk indicator only when valid data exists.

**Acceptance Scenarios**:

1. **Given** a completed job with supported turn-level telemetry, **When** a project member views the ticket's job timeline, **Then** the job row shows peak context size, average context size, turn count, and a healthy/warning/danger indicator.
2. **Given** a completed job from an agent or time period without turn-level telemetry, **When** a project member views the same timeline, **Then** the job row omits the context-size metrics and does not show a misleading zero-value indicator.
3. **Given** multiple jobs on a ticket, **When** a project member scans the timeline, **Then** the new context telemetry appears per job without obscuring the existing status, duration, cost, token, model, tool, or quality information.

---

### User Story 2 - Analyze Context Rot Trends Across A Project (Priority: P2)

A project member can use the analytics experience to examine how peak context size is distributed across completed jobs and compare that distribution by command type, workflow type, and quality-score bucket to evaluate whether high context size correlates with worse outcomes.

**Why this priority**: The ticket exists to move from anecdotal suspicion to evidence. Aggregate analysis is required to validate or disprove the context-rot hypothesis.

**Independent Test**: Can be fully tested by opening project analytics for a project with a mix of completed jobs and verifying that users can view peak-context distributions and segment them by command, workflow type, and quality-score bucket.

**Acceptance Scenarios**:

1. **Given** a project with completed jobs that include context metrics, **When** a project member opens analytics, **Then** they can view the distribution of peak context size for the selected time range.
2. **Given** analytics data that spans multiple commands and workflow types, **When** the member applies command and workflow filters, **Then** the distribution and supporting summaries update to reflect only the filtered jobs.
3. **Given** completed jobs with and without quality scores, **When** the member groups or filters by quality-score bucket, **Then** only jobs with a meaningful quality bucket participate in that comparison and the UI clearly handles jobs outside that grouping.

---

### User Story 3 - Trust Missing-Data Behavior (Priority: P3)

A project member can rely on the feature not to distort history: jobs created before launch or jobs from unsupported agents remain valid records, but simply do not show context metrics until compatible telemetry is available.

**Why this priority**: The feature adds analytical value only if users trust that empty fields mean "not available," not "measured as zero."

**Independent Test**: Can be fully tested by comparing a historical job, an unsupported-agent job, and a supported-agent job and confirming that only the supported job contributes context metrics while the others remain unaffected.

**Acceptance Scenarios**:

1. **Given** historical completed jobs created before this feature ships, **When** a project member views ticket timelines or analytics, **Then** those jobs remain visible and are treated as lacking context metrics rather than being backfilled or defaulted.
2. **Given** a supported job and an unsupported job complete successfully in the same project, **When** the member compares them in analytics, **Then** only the supported job contributes to peak-context metrics and both jobs retain their existing non-context telemetry.

### Edge Cases

- What happens when a completed job reports only some of the turn-level context values? The system records and shows the context-size indicator only when the required values for that display are present, while preserving the rest of the job record.
- How does the system handle jobs whose peak and average context sizes fall on opposite sides of a threshold band? The peak value controls the risk indicator, while the average and turn count remain visible as supporting context.
- What happens when filters produce no jobs with context metrics even though the project has completed jobs? Analytics keeps the selected filters and shows an empty state that explains no compatible context data exists for that slice.
- How does the system handle jobs with quality scores but no context metrics, or context metrics but no quality score? The job remains visible, but only participates in comparisons that have the required data for the chosen grouping.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record three additional per-job telemetry metrics on completed jobs when compatible turn-level agent telemetry is available: peak context size, average context size, and turn count.
- **FR-002**: The system MUST derive the new context metrics from telemetry already emitted during the job run and MUST NOT require operators to add manual instrumentation to the runner for this feature.
- **FR-003**: The system MUST preserve all existing job telemetry behavior, including token counts, duration, cost, tools used, model, and quality score, when adding the new context metrics.
- **FR-004**: The system MUST leave the new context metrics empty for jobs whose agent telemetry does not include compatible turn-level context information.
- **FR-005**: The system MUST leave the new context metrics empty for historical jobs created before this feature is available and MUST NOT backfill or infer those values.
- **FR-006**: The ticket-level job timeline MUST display peak context size, average context size, and turn count for each completed job that has those values.
- **FR-007**: The ticket-level job timeline MUST show an at-a-glance healthy/warning/danger indicator for jobs with context metrics, based on the job's peak context size.
- **FR-008**: The ticket-level job timeline MUST hide the context-risk indicator when the required context metric is absent.
- **FR-009**: The analytics experience MUST expose aggregate reporting for peak context size so project members can examine its distribution across completed jobs for the selected time range.
- **FR-010**: The analytics experience MUST allow project members to filter or group peak-context analysis by command type, workflow type, and quality-score bucket.
- **FR-011**: The analytics experience MUST distinguish jobs that cannot participate in a quality-score bucket comparison because they do not have a quality score, rather than merging them into a misleading bucket.
- **FR-012**: The analytics experience MUST update context-size reporting on the same refresh cadence as the existing analytics experience so newly completed jobs appear without manual refresh.
- **FR-013**: Access to the new context metrics in both the ticket timeline and analytics views MUST follow the same project-access rules as the surrounding job data.
- **FR-014**: When no jobs in the selected view have compatible context metrics, the system MUST present an empty state that explains the absence of context data without implying failure of the jobs themselves.
- **FR-015**: Any job-level or aggregate display of context metrics MUST use the same units and terminology consistently so users can compare jobs and charts without ambiguity.

### Key Entities *(include if feature involves data)*

- **Job Context Metrics**: The per-job context telemetry set consisting of peak context size, average context size, and turn count, attached to a completed job only when compatible telemetry exists.
- **Context Risk Band**: A qualitative classification derived from peak context size that communicates whether a job's peak context remained healthy, entered a warning range, or reached a danger range.
- **Quality Score Bucket**: A grouping used in analytics to compare context-size patterns against job quality outcomes when a completed job has a recorded quality score.
- **Analytics Slice**: A filtered or grouped subset of completed jobs defined by time range, command type, workflow type, agent, outcome, or quality-score bucket.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Job Telemetry Completion Processing**: Triggered whenever a job reaches completion and submits its final telemetry payload.
  - **Input**: Completed job status data, existing job telemetry fields, and any turn-level context telemetry emitted by the agent run.
  - **Phases**:
    1. Validate whether compatible turn-level context telemetry is present.
    2. Derive peak context size, average context size, and turn count from the submitted telemetry.
    3. Persist the derived metrics alongside the existing completed-job telemetry without altering unsupported or historical jobs.
  - **Output**: A completed job record that either includes the new context metrics or explicitly leaves them empty.
  - **Error behavior**: If the context-specific telemetry is missing or unusable, the job still completes normally and retains all other valid telemetry.

- **Project Context Analytics Aggregation**: Triggered whenever project analytics are requested or refreshed.
  - **Input**: Completed jobs in scope for the selected project and filters, including context metrics where available and quality scores where available.
  - **Phases**:
    1. Select the jobs that match the requested time range and filters.
    2. Build peak-context distribution views from jobs with context metrics.
    3. Segment or group the results by command type, workflow type, and quality-score bucket when requested.
    4. Exclude ineligible jobs from a grouping that requires absent data, while preserving clear empty-state messaging.
  - **Output**: Updated context-size distributions and summaries for the analytics experience.
  - **Error behavior**: If no eligible jobs exist for the selected slice, return an empty but valid analytics result with explanatory messaging.

### Assumptions & Dependencies

- Compatible turn-level context telemetry is already emitted by at least one supported agent format and can be trusted as the source of truth for this feature.
- Project members already have access to job timelines and project analytics, so this feature extends those experiences rather than creating a new permission model.
- Threshold bands for healthy, warning, and danger states may be tuned over time as more production data is collected, but the first release still needs stable initial bands.
- The first release focuses on project-level analysis; any cross-project or organization-wide reporting remains a separate decision.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly completed jobs from supported telemetry sources store peak context size, average context size, and turn count by the time the job becomes viewable in the product.
- **SC-002**: 100% of newly completed jobs from unsupported telemetry sources or historical data remain viewable without showing fabricated context values or zero-value risk indicators.
- **SC-003**: Project members can identify a job's context-risk state from the ticket timeline in one scan without opening raw logs for at least 90% of supported jobs during acceptance review.
- **SC-004**: Project analytics allows users to segment peak-context distributions by command type, workflow type, and quality-score bucket for every project that has eligible completed jobs.
- **SC-005**: Newly completed supported jobs become visible in context-size analytics within the normal analytics refresh window already used elsewhere in the product.
