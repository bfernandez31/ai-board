# Feature Specification: Fix Gemini Telemetry — Native OTLP Parsing and Cost Estimation

**Feature Branch**: `AIB-614-fix-gemini-telemetry`
**Created**: 2026-04-12
**Status**: Draft
**Input**: Ticket AIB-614: Fix Gemini telemetry to reach parity with Claude, Codex, and Mistral agents

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: Whether to track thinking tokens as a separate metric or map them to an existing field
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — feature is internal tooling with no compliance signals, but data accuracy is critical for cost estimation
- **Fallback Triggered?**: No — AUTO recommended CONSERVATIVE (netScore ≥ 0)
- **Trade-offs**:
  1. Tracking thinking tokens distinctly ensures accurate cost estimation (thinking tokens have different pricing than standard output/cache tokens)
  2. Requires a new data field, adding minor schema complexity
- **Reviewer Notes**: Verify Gemini API pricing docs to confirm thinking tokens are billed at a different rate than output tokens. If rates are identical, the separate field still provides useful observability.

---

- **Decision**: Whether the Gemini OTLP integration should use native push-based telemetry (Gemini CLI's built-in OTLP export) or retain the current post-execution scraping approach
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: Medium (score 3) — native OTLP is explicitly requested in the ticket and aligns with how Claude and Codex agents already work
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Native OTLP provides real-time streaming telemetry during execution (matches Claude/Codex), eliminating data loss risk from post-execution scraping
  2. Requires Gemini CLI to support OTLP environment variables; if it does not, a lightweight adapter that converts Gemini CLI's stream-JSON output into OTLP log records during execution (rather than after) is needed
- **Reviewer Notes**: Confirm Gemini CLI supports `OTEL_EXPORTER_OTLP_ENDPOINT` and related env vars. If not, the post-execution collection function must be enhanced to parse thinking tokens and feed into the cost estimation pipeline instead.

---

- **Decision**: Which Gemini models require pricing coverage
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5) — ticket explicitly names minimum set: Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Covering the three specified models ensures current usage is priced; additional models can be added incrementally
  2. Unknown/future models should gracefully degrade (cost marked unavailable rather than estimated incorrectly)
- **Reviewer Notes**: Verify current Gemini model identifiers match what the CLI reports in telemetry. Model names may differ between API docs and CLI output.

---

- **Decision**: How to handle the analytics agent filter — hardcoded enum vs fully dynamic
- **Policy Applied**: AUTO → CONSERVATIVE
- **Confidence**: High (score 5) — ticket explicitly requires dynamic derivation from database
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. Dynamic filter eliminates manual updates when new agents are added
  2. Validation schemas may still need the enum for type safety, but the UI filter options should be driven by actual data
- **Reviewer Notes**: The agent query function already derives agents dynamically from completed tickets. The remaining hardcoded points (API validation schema, TypeScript type definitions) should be evaluated for whether they can also be made dynamic without losing type safety.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gemini Job Cost Visibility (Priority: P1)

A project owner runs a Gemini-powered job (specify, plan, or build) and expects to see accurate cost information after the job completes, just as they would for Claude, Codex, or Mistral jobs.

**Why this priority**: Without cost estimation, Gemini jobs appear as zero-cost in dashboards and comparisons, making it impossible for users to understand their spending or compare agent efficiency.

**Independent Test**: Run a Gemini job on any ticket, verify the job record shows a non-zero cost estimate calculated from token usage and the appropriate Gemini model pricing.

**Acceptance Scenarios**:

1. **Given** a completed Gemini job with token usage data, **When** the user views the job details, **Then** cost is displayed as an estimated value (not "unavailable") based on the Gemini model used
2. **Given** a Gemini job using a model not in the pricing table, **When** the job completes, **Then** cost is marked as "unavailable" rather than showing an incorrect estimate
3. **Given** a Gemini job that used thinking tokens, **When** cost is calculated, **Then** thinking tokens are priced at their correct rate, not conflated with standard output or cache tokens

---

### User Story 2 - Gemini Token and Tool Metrics via Native Telemetry (Priority: P1)

During Gemini job execution, telemetry events are collected in real time (or near-real-time) and parsed into accurate token breakdowns (input, output, thinking, cache) and tool usage records, consistent with how Claude and Codex telemetry works.

**Why this priority**: Current post-execution scraping is fragile — if the stream file is incomplete or the job crashes, telemetry is lost. Native telemetry collection eliminates this data loss risk and provides real-time progress visibility.

**Independent Test**: Trigger a Gemini job, observe that telemetry events are received by the endpoint during execution, and verify the resulting job record has accurate token counts and tool lists.

**Acceptance Scenarios**:

1. **Given** a running Gemini job, **When** telemetry events arrive at the endpoint, **Then** Gemini-specific OTLP events are correctly parsed for input tokens, output tokens, thinking tokens, cache read tokens, cache creation tokens, model identifier, duration, and tool usage
2. **Given** a Gemini job that uses multiple tools, **When** telemetry is processed, **Then** the tool usage list is correctly populated and deduplicated
3. **Given** a Gemini job with thinking-mode enabled, **When** telemetry events include thinking token counts, **Then** thinking tokens are tracked separately and not mixed with cache or output token counts

---

### User Story 3 - Gemini Analytics Dashboard Parity (Priority: P2)

A project owner navigates to the analytics dashboard and can filter by Gemini agent to see token breakdown, cost trends, and tool distribution — identical to the analytics available for other agents.

**Why this priority**: Analytics parity ensures users can make informed decisions about which agent to use for different tasks, enabling cost optimization across their projects.

**Independent Test**: With at least one completed Gemini job in a project, open the analytics dashboard, filter by Gemini, and verify all chart sections populate with data.

**Acceptance Scenarios**:

1. **Given** a project with completed Gemini jobs, **When** the user opens analytics and selects the Gemini agent filter, **Then** token breakdown (input, output, thinking, cache), cost over time, and tool distribution charts display accurate data
2. **Given** a project with jobs from multiple agents, **When** the user views the agent filter dropdown, **Then** only agents with actual job data appear as options (no empty/unused agents listed)

---

### User Story 4 - Dynamic Agent Filter in Analytics (Priority: P2)

The analytics agent filter dropdown shows only agents that have job data in the current project, derived from the database rather than a hardcoded list. When a new agent type is added to the system, it appears in the filter automatically once jobs exist.

**Why this priority**: Eliminates maintenance burden and prevents showing filter options that yield no results, improving user experience.

**Independent Test**: In a project with only Claude and Gemini jobs, verify the filter shows exactly those two agents (plus "all"). No Codex or Mistral options should appear.

**Acceptance Scenarios**:

1. **Given** a project with jobs from Claude and Gemini only, **When** the user opens the analytics agent filter, **Then** the options are "All", "Claude", and "Gemini" — no other agents listed
2. **Given** a new agent type is added to the system in the future, **When** a job using that agent completes, **Then** the agent automatically appears in the analytics filter without code changes

---

### Edge Cases

- What happens when Gemini CLI reports a model identifier not in the pricing table? Cost is marked "unavailable" rather than estimated at zero or with wrong pricing.
- How does the system handle Gemini jobs where native OTLP telemetry fails to connect? Post-execution scraping is preserved as a fallback safety net.
- What happens if thinking tokens are reported but the model does not support thinking mode? Treated as zero — no error raised.
- What happens when a Gemini job is cancelled mid-execution? Partial telemetry already received is preserved; cost estimation uses whatever tokens were accumulated.
- What happens if both native OTLP and post-execution scraping report data for the same job? Native OTLP data takes precedence; post-execution scraping only fills gaps not already covered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enable and configure Gemini CLI's native OTLP telemetry in all workflows where Gemini is invoked, pushing telemetry events to the standard endpoint during execution
- **FR-002**: System MUST parse Gemini-specific OTLP telemetry events to extract: input tokens, output tokens, thinking tokens, cache read tokens, cache creation tokens, model identifier, duration, and tool usage
- **FR-003**: System MUST maintain a Gemini pricing table covering at minimum: Gemini 2.5 Pro, Gemini 2.5 Flash, and Gemini 2.0 Flash models
- **FR-004**: System MUST estimate cost for Gemini jobs server-side from token usage and model pricing, following the same pattern used for Codex and Mistral
- **FR-005**: System MUST track thinking tokens as a distinct category, priced at their correct rate — never conflated with cache tokens or standard output tokens
- **FR-006**: System MUST mark cost as "unavailable" for Gemini models not present in the pricing table, rather than estimating incorrectly
- **FR-007**: System MUST preserve post-execution telemetry collection as a fallback when native OTLP telemetry is unavailable or fails
- **FR-008**: System MUST derive the analytics agent filter options dynamically from database records (agents with completed jobs) rather than maintaining a hardcoded list
- **FR-009**: System MUST NOT alter existing Claude, Codex, or Mistral telemetry parsing, cost estimation, or analytics behavior
- **FR-010**: System MUST display Gemini job metrics (token breakdown, cost, tool distribution) in the analytics dashboard with the same fidelity as other agents

### Key Entities *(include if feature involves data)*

- **Job**: Extended with thinking token tracking capability; accumulates telemetry from Gemini OTLP events just as it does for Claude/Codex
- **Gemini Pricing Table**: Maps Gemini model identifiers to per-token rates for input, output, thinking, and cached tokens
- **Agent Filter**: Dynamically derived set of agents with job data in a given project, used for analytics filtering

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Gemini Native OTLP Telemetry Collection**: Triggered automatically when a Gemini job starts in a workflow. The Gemini CLI pushes OTLP-formatted telemetry events to the standard telemetry endpoint during execution, authenticated via workflow API token. The endpoint identifies Gemini events by agent-specific attributes and parses token counts (including thinking tokens) and tool usage. Metrics are accumulated onto the job record in real time.
  - **Input**: OTLP log/trace records with Gemini-specific attributes (model, token counts, tool events)
  - **Phases**: (1) Gemini CLI emits OTLP events during execution → (2) Telemetry endpoint authenticates and validates events → (3) Parser extracts Gemini-specific metrics → (4) Metrics accumulated onto job record
  - **Output**: Updated job record with token counts, tool list, model, and duration
  - **Error behavior**: If OTLP push fails, telemetry for that batch is lost; post-execution fallback collects whatever data is available from the stream output

- **Gemini Cost Estimation**: Triggered when Gemini telemetry is persisted and token counts are available. The system looks up the reported model in the Gemini pricing table and calculates cost from input, output, thinking, and cached token counts.
  - **Input**: Job token counts and model identifier
  - **Phases**: (1) Match model to pricing table → (2) Calculate cost per token category → (3) Sum total cost → (4) Persist to job record
  - **Output**: Job record updated with estimated cost in USD
  - **Error behavior**: If model is not in pricing table, cost is set to null (unavailable) — no incorrect estimate is generated

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of completed Gemini jobs with known models show an estimated cost (not "unavailable"), matching the pricing table rates
- **SC-002**: Gemini token breakdowns in analytics are accurate within the same tolerance as Claude and Codex agents (no missing or double-counted tokens)
- **SC-003**: Thinking tokens for Gemini jobs are tracked and displayed as a distinct category, never conflated with cache or output tokens
- **SC-004**: Analytics agent filter shows only agents with actual job data — zero phantom/empty agent options
- **SC-005**: Existing Claude, Codex, and Mistral telemetry and cost estimation continue to function identically (zero regressions)
- **SC-006**: Gemini telemetry is collected during job execution (real-time or near-real-time), not solely after job completion
