# Feature Specification: Fix Gemini Telemetry: Native Telemetry Parsing and Cost Estimation

**Feature Branch**: `AIB-626-fix-gemini-telemetry`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Fix Gemini telemetry: native OTLP parsing and cost estimation"

## Auto-Resolved Decisions *(mandatory when clarification policies apply)*

- **Decision**: The clarification policy was provided as `AUTO`, but this ticket only produced low-confidence neutral signals, so the specification defaults to a parity-and-correctness-first scope rather than a minimal fast patch.
- **Policy Applied**: AUTO -> CONSERVATIVE fallback
- **Confidence**: Low (score: +1, one neutral feature-context signal, no strong speed or compliance signals)
- **Fallback Triggered?**: Yes — AUTO confidence was below 0.5, so the guardrail required a conservative fallback.
- **Trade-offs**:
  1. The scope explicitly includes complete telemetry, pricing, analytics, and backward-compatibility behavior instead of only restoring a subset of missing metrics.
  2. This increases validation work, but it reduces the risk of shipping Gemini-specific accounting that disagrees with other agents or corrupts analytics.
- **Reviewer Notes**: Confirm that parity with existing agent telemetry is the intended outcome and that no temporary/manual accounting path should remain for Gemini after this change.

- **Decision**: The specification treats "accurate pricing" as requiring separate accounting for input, output, thinking, and cache-related usage categories whenever Gemini reports them distinctly.
- **Policy Applied**: CONSERVATIVE
- **Confidence**: High — the request explicitly calls out incorrect conflation between thinking and cache usage.
- **Fallback Triggered?**: No
- **Trade-offs**:
  1. This avoids undercounting or mispricing Gemini jobs when usage categories differ by model or execution path.
  2. It requires analytics and cost displays to tolerate partially populated categories instead of collapsing them into a simpler total.
- **Reviewer Notes**: Validate the expected business treatment for any Gemini usage category that is present in telemetry but not yet mapped to a billable price.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review accurate Gemini job telemetry (Priority: P1)

As a project owner reviewing AI job activity, I need Gemini jobs to show complete and accurate usage details so I can trust the dashboard when comparing agents and monitoring spend.

**Why this priority**: The primary defect is missing or incorrect telemetry for Gemini jobs, which blocks reliable analytics and cost visibility.

**Independent Test**: Can be fully tested by running a Gemini-backed job and verifying that its recorded usage, tool activity, and displayed cost are complete without relying on manual post-run scraping.

**Acceptance Scenarios**:

1. **Given** a Gemini job completes with native telemetry available, **When** the job details and analytics views are loaded, **Then** token usage, tool activity, and estimated cost are all present for that job.
2. **Given** a Gemini job reports separate input, output, thinking, and cache-related usage values, **When** the usage is recorded, **Then** each value is stored and displayed in the correct category without being merged into another category.

---

### User Story 2 - Compare Gemini cost with other agents (Priority: P2)

As a team monitoring AI spend across providers, I need Gemini jobs to use the same cost-estimation approach as other supported agents so comparisons remain meaningful and actionable.

**Why this priority**: Cost parity is the second critical gap and directly affects budgeting, analytics trust, and product consistency.

**Independent Test**: Can be fully tested by processing Gemini jobs for supported Gemini models and confirming that cost is estimated from recorded usage and model selection using the same centralized accounting approach used for other agents.

**Acceptance Scenarios**:

1. **Given** a Gemini job uses a supported Gemini model with known token usage, **When** the system estimates cost, **Then** the job receives a non-empty estimated cost derived from that model's pricing rules.
2. **Given** two Gemini jobs use different supported models with different usage volumes, **When** estimated costs are calculated, **Then** the results vary in line with the relevant model pricing and usage mix.

---

### User Story 3 - Filter analytics by supported agents without manual maintenance (Priority: P3)

As a user exploring analytics, I need agent filters to reflect the agents the system actually supports so the dashboard stays accurate as providers are added or removed.

**Why this priority**: The filter defect is smaller than the telemetry gap, but it affects discoverability and creates recurring maintenance risk.

**Independent Test**: Can be fully tested by loading the analytics filter options after adding or removing an agent type in the authoritative data source and confirming that the filter updates without manual list changes.

**Acceptance Scenarios**:

1. **Given** the system recognizes Gemini as a supported agent type, **When** the analytics dashboard is opened, **Then** Gemini appears as a filter option alongside the other supported agents.
2. **Given** the authoritative set of supported agent types changes, **When** the analytics dashboard is reopened, **Then** the filter options reflect the current supported set without requiring a separate hardcoded update.

### Edge Cases

- What happens when Gemini telemetry arrives with only a subset of expected usage categories for a job?
- How does the system handle Gemini jobs that use a model not yet present in the pricing catalog?
- What happens when Gemini telemetry ingestion fails or arrives after the job has already been marked complete?
- How does the dashboard behave when historical Gemini jobs exist with incomplete legacy telemetry while newer jobs contain full usage breakdowns?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST enable Gemini's native telemetry export for Gemini-backed runs so usage and tool events are produced during execution rather than reconstructed only after the run ends.
- **FR-002**: The system MUST ingest Gemini telemetry events and associate them with the correct job record for analytics and reporting.
- **FR-003**: The system MUST record Gemini token usage in distinct categories for input, output, thinking, and cache-related usage whenever Gemini reports those categories separately.
- **FR-004**: The system MUST record Gemini tool activity in a form that supports per-job tool distribution reporting in analytics.
- **FR-005**: The system MUST estimate Gemini job cost from the recorded usage breakdown and the Gemini model used for the job.
- **FR-006**: The system MUST support cost estimation for at least the currently used Gemini model families covering 2.5 Pro, 2.5 Flash, and 2.0 Flash.
- **FR-007**: The system MUST price thinking-related usage independently from cache-related usage so the two categories cannot be conflated in stored metrics, displayed metrics, or cost calculations.
- **FR-008**: The system MUST preserve the existing telemetry and cost behavior for Claude, Codex, and Mistral jobs.
- **FR-009**: The system MUST expose Gemini job token breakdown, estimated cost, and tool distribution in the analytics experience wherever equivalent metrics are shown for other agents.
- **FR-010**: The system MUST derive analytics agent filter options from the authoritative set of supported agent types rather than from a manually maintained fixed list.
- **FR-011**: The system MUST handle unsupported or newly introduced Gemini models gracefully by preserving recorded usage and clearly indicating that cost could not yet be estimated when no pricing rule exists.
- **FR-012**: The system MUST tolerate partial, delayed, or repeated Gemini telemetry events without corrupting existing job telemetry or double-counting usage.

### Key Entities *(include if feature involves data)*

- **Job Telemetry Record**: The per-job analytics record that captures usage breakdowns, tool activity, model identity, and derived cost information for a workflow run.
- **Gemini Pricing Rule**: The pricing reference for a supported Gemini model or model family, including the billable treatment of each reported usage category.
- **Agent Type**: The authoritative classification of supported AI providers used for job attribution, filtering, and analytics segmentation.
- **Analytics Filter Option**: The user-selectable representation of an available agent type in the analytics dashboard.

### Internal Processes *(include if feature involves background jobs, workflows, or agent commands)*

- **Gemini Run Telemetry Emission**: Triggered when a Gemini-backed job starts.
  - **Input**: Job identity, selected Gemini model, execution context, and native telemetry configuration.
  - **Phases**:
    1. Start the Gemini-backed execution with native telemetry export enabled.
    2. Emit usage and tool events during execution.
    3. Attach emitted events to the correct telemetry intake flow for the running job.
  - **Output**: A stream of Gemini telemetry events tied to the job.
  - **Error behavior**: If telemetry cannot be emitted, the job may still run, but the system must preserve a clear missing-telemetry state instead of fabricating complete metrics from incomplete evidence.

- **Gemini Telemetry Intake and Normalization**: Triggered when Gemini telemetry events reach the telemetry intake flow.
  - **Input**: Gemini usage events, tool events, job identifiers, and model identity.
  - **Phases**:
    1. Validate that the event belongs to a known job.
    2. Normalize Gemini-specific usage fields into the shared analytics model.
    3. Merge repeated or incremental events without double-counting.
    4. Store the resulting telemetry breakdown for analytics consumption.
  - **Output**: Updated job telemetry containing normalized Gemini metrics.
  - **Error behavior**: Invalid or unmatchable events are rejected or isolated without mutating unrelated jobs; recoverable ingestion issues should allow later events to complete the record.

- **Gemini Cost Estimation**: Triggered when usable Gemini telemetry and a recognized model are available for a job.
  - **Input**: Normalized Gemini usage breakdown and applicable Gemini pricing rule.
  - **Phases**:
    1. Identify the relevant pricing rule for the job's Gemini model.
    2. Calculate category-level billable amounts from the recorded usage.
    3. Produce and store the total estimated job cost.
  - **Output**: Estimated Gemini job cost and pricing status.
  - **Error behavior**: If no pricing rule exists, usage remains visible and the job is marked as cost unavailable rather than receiving a misleading estimate.

- **Analytics Agent Filter Population**: Triggered when analytics views are prepared for display.
  - **Input**: The authoritative set of supported agent types and available analytics data.
  - **Phases**:
    1. Determine the current supported agent types.
    2. Build the selectable agent filter set from that source.
    3. Present metrics for Gemini and other supported agents consistently.
  - **Output**: Current analytics filter options and correctly segmented analytics data.
  - **Error behavior**: If the authoritative agent source cannot be read, the dashboard should fail predictably rather than silently presenting an outdated hardcoded subset.

## Assumptions

- Gemini telemetry should reach behavioral parity with other supported agents, not remain a special-case analytics path.
- Existing analytics views already have places to show per-agent token breakdown, estimated cost, and tool distribution once the underlying Gemini data is available.
- Historical Gemini jobs with incomplete telemetry do not need retroactive reconstruction if the system can clearly distinguish them from newly instrumented jobs.
- Supported Gemini pricing may evolve; the initial release only needs explicit pricing coverage for the current model families named in the ticket.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For newly completed Gemini jobs using supported Gemini models, 100% of jobs display a non-empty token breakdown and estimated cost in the job analytics experience.
- **SC-002**: For Gemini jobs that report distinct thinking and cache-related usage, 100% of sampled jobs preserve those categories separately in recorded and displayed metrics.
- **SC-003**: Users can filter analytics by any currently supported agent type, including Gemini, without requiring a manual dashboard update for newly supported agent types.
- **SC-004**: After release, Gemini job analytics match the same core reporting dimensions already available for Claude, Codex, and Mistral: usage breakdown, estimated cost, and tool distribution.
- **SC-005**: Changes for Gemini telemetry do not introduce regressions in telemetry parsing or cost estimation for Claude, Codex, or Mistral jobs.
