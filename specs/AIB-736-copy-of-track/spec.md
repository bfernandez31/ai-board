# Feature Specification: Track Per-Turn Context Size on Jobs

**Feature Branch**: `AIB-736-copy-of-track`
**Created**: 2026-04-24
**Status**: Draft
**Input**: User description: "Track per-turn context size on jobs to analyze context rot impact on quality"

## Auto-Resolved Decisions

### Decision 1: Context Health Threshold Values

- **Decision**: Initial threshold boundaries for the context-health pill indicator on job timeline items. The ticket states "exact thresholds to be tuned based on observed data" without prescribing values. Resolved to three-tier thresholds calibrated against the primary agent's context window (Claude's 200K token limit): healthy below 50K tokens, warning between 50K and 100K tokens, danger above 100K tokens.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — internal analytics feature with no compliance/security signals; AUTO defaulted to CONSERVATIVE
- **Fallback Triggered?**: Yes — LOW confidence AUTO promoted to CONSERVATIVE. CONSERVATIVE favors stricter defaults that surface warnings earlier rather than risk missing degradation signals.
- **Trade-offs**:
  1. Conservative thresholds may produce more amber/red indicators than necessary in early usage, but this errs on the side of visibility while the team calibrates against real quality-score correlations.
  2. Thresholds are display-only (no alerts, no blocking behavior), so a false-positive amber pill has low cost — the team simply learns to adjust the values.
- **Reviewer Notes**: These thresholds are initial values. After two to three weeks of data collection, revisit whether the 50K/100K boundaries correlate with observed quality-score drops. If quality remains stable above 100K tokens in practice, raise the thresholds accordingly.

### Decision 2: Analytics View Placement

- **Decision**: The ticket requests "a project-level or global analytics view" for context-size distribution. Resolved to extend the existing project-level analytics dashboard with a new context-health chart section, rather than building a separate global view.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — AUTO fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes — CONSERVATIVE prefers extending proven infrastructure over introducing new pages.
- **Trade-offs**:
  1. Project-level placement reuses existing analytics infrastructure (time-range selectors, agent filters, chart components, API aggregation), minimizing scope and risk.
  2. A global cross-project view would enable org-wide comparisons but requires new authorization patterns and aggregation queries — out of scope per the ticket's explicit scoping and better suited as a follow-up once the per-project view proves useful.
- **Reviewer Notes**: If cross-project comparison becomes a priority, a follow-up ticket can add a global analytics page that aggregates the same underlying data across all projects the user owns.

### Decision 3: Handling of Agents Without Per-Turn Telemetry

- **Decision**: The ticket specifies graceful degradation for agents that do not provide per-turn breakdowns (Mistral today). Resolved that all three new fields remain null (not zero) for such jobs, the timeline UI omits the context-health indicator entirely when all three fields are null, and analytics charts exclude null-valued jobs from distribution calculations rather than treating them as zero.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — AUTO fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes — CONSERVATIVE requires null-safe handling over zero-default to avoid polluting analytical data.
- **Trade-offs**:
  1. Excluding null-valued jobs from analytics means the distribution charts only reflect agents that actually report per-turn data (Claude initially). This keeps the data clean and conclusions valid.
  2. Users may wonder why some jobs lack a context indicator — the UI should make it clear this means the agent does not report per-turn data, not that something went wrong.
- **Reviewer Notes**: As additional agents (Codex, Gemini) gain per-turn telemetry support, verify they populate these fields correctly. The null-exclusion logic in analytics ensures new agents are automatically included once their fields are populated.

### Decision 4: Quality-Score Bucket Boundaries for Analytics Cross-Tabulation

- **Decision**: The ticket requires grouping by "quality-score bucket" in analytics but does not define bucket boundaries. Resolved to five buckets: Excellent (90-100), Good (70-89), Fair (50-69), Poor (30-49), Critical (0-29). These align with the existing 0-100 quality-score range and provide meaningful segmentation for correlation analysis.
- **Policy Applied**: AUTO → CONSERVATIVE (fallback)
- **Confidence**: Low (0.3) — AUTO fallback to CONSERVATIVE
- **Fallback Triggered?**: Yes — CONSERVATIVE prefers well-defined categorical boundaries over continuous scatter.
- **Trade-offs**:
  1. Fixed buckets simplify visual grouping and make it easy to spot "does quality drop when peak context exceeds X?" patterns.
  2. Five buckets may be too granular for early data with few verify jobs — the UI should gracefully handle buckets with zero data points.
- **Reviewer Notes**: Bucket boundaries are display-level groupings, not stored data. They can be adjusted in future iterations without schema changes.

## User Scenarios & Testing

### User Story 1 - View Context Health on Individual Job (Priority: P1)

A user reviewing a completed ticket opens the job timeline and sees at-a-glance context-health indicators on each job that ran with a compatible agent. For jobs where context grew large during execution, an amber or red pill draws attention to potential quality risk. The user can see the exact peak context size, average context size, and turn count to understand whether a quality-score drop correlates with heavy context usage.

**Why this priority**: This is the core value delivery — making context-size data visible where users already look (the job timeline). Without this, the remaining analytics are uninspectable at the individual-job level.

**Independent Test**: Can be fully tested by completing a job with known telemetry data and verifying the timeline displays correct values and appropriate color-coded indicators.

**Acceptance Scenarios**:

1. **Given** a completed job from a Claude run where peak context exceeded 100K tokens, **When** the user views the ticket's job timeline, **Then** the job item displays a red context-health pill showing the peak context value and the turn count.
2. **Given** a completed job from a Claude run where peak context was below 50K tokens, **When** the user views the job timeline, **Then** the job item displays a neutral/green context-health pill with the peak value.
3. **Given** a completed job from a Claude run where peak context was between 50K and 100K tokens, **When** the user views the job timeline, **Then** the job item displays an amber context-health pill.
4. **Given** a completed job from Mistral (no per-turn telemetry), **When** the user views the job timeline, **Then** no context-health indicator is shown for that job (no pill, no zeros).
5. **Given** a historical job created before this feature was deployed (all three context fields are null), **When** the user views the job timeline, **Then** no context-health indicator is shown and all other telemetry fields (cost, tokens, duration) display normally.

---

### User Story 2 - Record Context Metrics from Telemetry (Priority: P1)

When a job completes and telemetry data has been ingested from a compatible agent (Claude), the system automatically computes and persists three context-size metrics: peak context tokens (maximum input tokens observed in any single turn), average context tokens (mean input tokens across all turns), and turn count (total number of model calls). This happens without any changes to the runner or agent instrumentation — the system derives these values from per-turn telemetry spans it already receives.

**Why this priority**: Equal to P1 because the UI indicator (Story 1) depends on these values existing. Without recording the data, nothing downstream works.

**Independent Test**: Can be tested by sending simulated telemetry payloads through the ingestion endpoint and verifying the job record is updated with correct computed values.

**Acceptance Scenarios**:

1. **Given** a running job receiving telemetry spans with per-turn token counts [10000, 25000, 80000, 45000], **When** the job completes, **Then** the job record stores peak context tokens as 80000, average context tokens as 40000, and turn count as 4.
2. **Given** a running job receiving batch telemetry without per-turn breakdowns (Mistral), **When** the job completes, **Then** the three new fields remain null (not zero) and all existing telemetry fields are unaffected.
3. **Given** a running job where only one telemetry span is received, **When** the job completes, **Then** peak context tokens equals average context tokens, and turn count is 1.
4. **Given** a completed job with existing telemetry (input tokens, output tokens, cost, duration, tools used, quality score), **When** context metrics are computed, **Then** no existing telemetry field is altered or overwritten.

---

### User Story 3 - Analyze Context-Size Distribution in Project Analytics (Priority: P2)

A user navigates to the project analytics dashboard and sees a new chart showing the distribution of peak context sizes across completed jobs. The user can filter by command type (implement, verify, ship, iterate), workflow type (FULL vs QUICK), and quality-score bucket to identify patterns — for example, whether verify jobs consistently hit higher peak context than implement jobs, or whether jobs with quality scores below 50 also had peak context above 100K tokens.

**Why this priority**: This is the analytical payoff that validates the context-rot hypothesis. However, it depends on accumulated data from Stories 1-2 and provides value only after several weeks of collection.

**Independent Test**: Can be tested by seeding jobs with known context metrics and verifying the analytics chart renders correct distributions with proper filtering.

**Acceptance Scenarios**:

1. **Given** a project with 20 or more completed jobs that have context metrics populated, **When** the user opens the project analytics dashboard, **Then** a context-health distribution chart is visible showing the spread of peak context sizes.
2. **Given** the analytics view is showing context distribution, **When** the user filters by command type "verify", **Then** the chart updates to show only verify jobs.
3. **Given** the analytics view is showing context distribution, **When** the user filters by workflow type "FULL", **Then** only jobs from FULL-workflow tickets are included.
4. **Given** the analytics view is showing context distribution, **When** the user groups by quality-score bucket, **Then** the chart displays peak context distribution segmented by Excellent/Good/Fair/Poor/Critical quality buckets.
5. **Given** a project where no completed jobs have context metrics (all null — e.g., only Mistral jobs or all pre-feature historical jobs), **When** the user views analytics, **Then** the context-health chart section shows an appropriate empty state rather than a chart with zero values.

---

### User Story 4 - Context Metrics in Expanded Job Detail (Priority: P3)

A user expands a job item in the timeline to see the full telemetry breakdown. Alongside the existing token counts (input, output, cache read, cache creation), cost, and duration, the user sees the three context metrics presented clearly: peak context size, average context size, and turn count. This provides the detailed numbers behind the at-a-glance pill indicator.

**Why this priority**: Adds depth to Story 1 but is not essential for the core value of at-a-glance visibility or aggregate analytics. Users who want the exact numbers can see them here.

**Independent Test**: Can be tested by expanding a job with known context metrics and verifying all three values display correctly alongside existing telemetry.

**Acceptance Scenarios**:

1. **Given** a completed job with peak context tokens of 82000, average context tokens of 41000, and turn count of 12, **When** the user expands the job detail in the timeline, **Then** all three values are displayed with appropriate labels and human-readable formatting (e.g., "82K" or "82,000" tokens).
2. **Given** a completed job where context metrics are null, **When** the user expands the job detail, **Then** the context metrics section is not shown, and existing telemetry fields display normally.

---

### Edge Cases

- What happens when a job receives exactly one telemetry span? Peak and average are equal; turn count is 1. All three fields are populated normally.
- What happens when a job receives telemetry spans with zero input tokens in some turns? These turns are included in the average and count calculations but are unlikely to be the peak. Zero-token turns should not be excluded from the count.
- What happens when a job fails mid-execution after receiving some telemetry? Context metrics should still be computed and stored from whatever spans were received — partial data is more valuable than no data for understanding why the job failed.
- What happens when the existing analytics time-range filter (7d/30d/90d/all) is applied? Context-health charts respect the same time-range filter as all other analytics charts.
- What happens when a job has context metrics but no quality score (non-verify jobs)? The job still appears in the context-distribution chart and can be filtered by command type, but quality-score bucket grouping shows it as "N/A" or excludes it from the quality-bucketed view.

## Requirements

### Functional Requirements

- **FR-001**: System MUST compute and persist three new metrics on completed jobs when per-turn telemetry is available: peak context tokens (maximum input tokens in any single turn), average context tokens (mean input tokens across all turns), and turn count (number of model calls).
- **FR-002**: System MUST derive these metrics from telemetry data already received during job execution without requiring any runner-side or agent-side instrumentation changes.
- **FR-003**: System MUST leave all three new fields null (not zero) when the agent does not provide per-turn telemetry breakdowns.
- **FR-004**: System MUST NOT alter, overwrite, or regress any existing telemetry fields (input tokens, output tokens, cache read tokens, cache creation tokens, cost, duration, model, tools used, quality score, quality score details) when computing context metrics.
- **FR-005**: System MUST display a color-coded context-health indicator on each job in the timeline view, using three tiers: healthy (peak below 50K tokens), warning (peak between 50K and 100K tokens), danger (peak above 100K tokens).
- **FR-006**: System MUST hide the context-health indicator entirely for jobs where the context metrics are null (incompatible agent or pre-feature historical job).
- **FR-007**: System MUST display the three context metrics (peak, average, turn count) in the expanded job detail view alongside existing telemetry fields.
- **FR-008**: System MUST provide a context-health distribution chart in the project analytics dashboard showing peak context size distribution across completed jobs.
- **FR-009**: System MUST support filtering the context-health distribution by command type (specify, plan, implement, verify, ship, iterate, quick-impl), workflow type (FULL, QUICK), and quality-score bucket (Excellent 90-100, Good 70-89, Fair 50-69, Poor 30-49, Critical 0-29).
- **FR-010**: System MUST exclude jobs with null context metrics from context-health analytics calculations rather than treating null as zero.
- **FR-011**: System MUST handle historical jobs created before this feature (all three fields null) without errors, displaying them normally in the timeline with no context indicator.
- **FR-012**: System MUST still compute and store partial context metrics for jobs that fail mid-execution, based on whatever telemetry spans were received before failure.

### Key Entities

- **Job** (extended): The primary entity that gains three new optional attributes — peak context tokens, average context tokens, and turn count. These supplement the existing telemetry attributes (input/output/cache tokens, cost, duration, model, tools used, quality score). All three are optional to accommodate agents without per-turn telemetry and historical jobs.
- **Context Health Tier**: A display-level classification derived from peak context tokens — healthy, warning, or danger — used by the timeline indicator and analytics grouping. Not stored; computed at render time from the peak value and configurable threshold boundaries.
- **Quality Score Bucket**: A display-level grouping of the existing quality score (0-100) into five labeled ranges for cross-tabulation with context metrics. Not stored; computed at query/render time.

### Internal Processes

- **Context Metrics Computation**: Triggered when per-turn telemetry spans are ingested for a job from a compatible agent.
  - **Input**: Individual telemetry spans received during job execution, each containing input token count for that turn.
  - **Phases**:
    1. During telemetry ingestion, track running statistics: maximum input tokens seen (for peak), cumulative input tokens and count (for average), and total turn count.
    2. On job completion or when final telemetry is received, persist the computed peak, average (cumulative divided by count), and turn count to the job record.
  - **Output**: Three new fields populated on the job record. Existing telemetry fields remain unchanged.
  - **Error behavior**: If telemetry ingestion fails or no spans are received, the three fields remain null. A partial set of spans still produces valid (though incomplete) metrics — partial data is preferred over no data.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Within 24 hours of deployment, all newly completed jobs from compatible agents have the three context metrics populated (non-null peak, average, and turn count) on their job records.
- **SC-002**: The job timeline context-health indicator accurately reflects the recorded peak context value against the configured thresholds for 100% of jobs with populated context metrics.
- **SC-003**: The project analytics context-health chart displays distribution data for projects with 10 or more jobs that have context metrics, with filtering by command type, workflow type, and quality-score bucket all functional.
- **SC-004**: Zero regressions on existing telemetry fields — all pre-existing job telemetry (total tokens, cost, duration, tools used, quality score) remains identical before and after deployment.
- **SC-005**: Jobs from agents without per-turn telemetry complete successfully with the three new fields unset, and the timeline UI hides the context indicator for those jobs without displaying errors or zeros.
- **SC-006**: After two to three weeks of data accumulation, the team can query the relationship between peak context size and quality score to validate or refute the context-rot hypothesis — the data exists and is queryable in the analytics view.
