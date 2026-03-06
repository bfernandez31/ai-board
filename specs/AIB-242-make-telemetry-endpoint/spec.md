# Feature Specification: Make Telemetry Endpoint Agent-Agnostic

**Feature Branch**: `AIB-242-make-telemetry-endpoint`
**Created**: 2026-03-06
**Status**: Draft
**Input**: User description: "Make telemetry endpoint agent-agnostic to accept Codex telemetry events alongside Claude Code events"

## Auto-Resolved Decisions

- **Decision**: Whether to add a dedicated agent-type field to the Job record vs. relying on the existing Ticket-level `agent` field
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 1, absScore: 1) — internal infrastructure feature with no sensitive/compliance signals
- **Fallback Triggered?**: Yes — AUTO confidence below 0.5 threshold, promoted to CONSERVATIVE
- **Trade-offs**:
  1. Using the existing Ticket `agent` field avoids schema changes; agent type is already tracked at the ticket level and linked to each Job via the Ticket relationship
  2. No redundant data storage on Job; analytics queries join through Ticket to determine agent type
- **Reviewer Notes**: Verify that all analytics queries that need agent type can efficiently join Job to Ticket. If future requirements need agent type directly on Job without joins, a schema migration would be needed.

---

- **Decision**: Whether to process `codex.sse_event` and `codex.websocket.request` event types for metrics
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 1) — these events do not carry token/cost attributes based on Codex OTLP documentation
- **Fallback Triggered?**: Yes — CONSERVATIVE default applied due to low confidence
- **Trade-offs**:
  1. Excluding non-metric events keeps the processing logic focused and avoids accumulating empty/zero values
  2. If these events gain metric attributes in future Codex versions, the endpoint would need updating
- **Reviewer Notes**: Confirm that `codex.sse_event` and `codex.websocket.request` do not carry `input_tokens`, `output_tokens`, or `cost_usd` attributes. If they do, they should be added to the relevant event lists.

---

- **Decision**: How to detect agent type from incoming OTLP telemetry data
- **Policy Applied**: CONSERVATIVE (AUTO fallback)
- **Confidence**: Low (score: 1) — event name prefix is the most reliable discriminator
- **Fallback Triggered?**: Yes
- **Trade-offs**:
  1. Using event name prefix (`claude_code.*` vs `codex.*`) is deterministic and requires no additional configuration from the agent
  2. The `service.name` resource attribute could also be used as a secondary signal but adds complexity
- **Reviewer Notes**: Validate that Codex consistently uses the `codex.*` event name prefix. If event naming conventions change, the detection logic must be updated.

## User Scenarios & Testing

### User Story 1 - Codex Telemetry Ingestion (Priority: P1)

A workflow running with the Codex agent sends OTLP telemetry data to the endpoint. The system accepts the Codex-formatted events and correctly aggregates token usage, cost, and tool information onto the associated Job record, just as it does for Claude Code telemetry.

**Why this priority**: This is the core capability — without it, Codex jobs have no telemetry tracking, making cost and usage analytics incomplete.

**Independent Test**: Can be tested by sending a Codex-formatted OTLP payload to the telemetry endpoint and verifying the Job record is updated with correct token counts, cost, and tools used.

**Acceptance Scenarios**:

1. **Given** a running Job associated with a Codex-agent ticket, **When** the endpoint receives OTLP logs containing `codex.api_request` events with token and cost attributes, **Then** the Job record is updated with accumulated input tokens, output tokens, cost, and model.
2. **Given** a running Job associated with a Codex-agent ticket, **When** the endpoint receives OTLP logs containing `codex.tool.call` events, **Then** the tool names are added to the Job's tools-used list, deduplicated and sorted.
3. **Given** a running Job, **When** the endpoint receives multiple OTLP batches from a Codex agent, **Then** metrics accumulate correctly across batches (tokens and cost sum, tools merge without duplicates).

---

### User Story 2 - Claude Telemetry Backward Compatibility (Priority: P1)

Existing Claude Code workflows continue to send telemetry and have their metrics tracked without any changes to the Claude agent configuration or OTLP format.

**Why this priority**: Equal to P1 because regression in existing functionality would break all current telemetry tracking.

**Independent Test**: Can be tested by sending a Claude-formatted OTLP payload and verifying the same behavior as before the change.

**Acceptance Scenarios**:

1. **Given** a running Job associated with a Claude-agent ticket, **When** the endpoint receives OTLP logs with `claude_code.api_request` events, **Then** the Job record is updated with token counts, cost, duration, and model exactly as before.
2. **Given** a running Job, **When** the endpoint receives `claude_code.tool_result` and `claude_code.tool_decision` events, **Then** tool usage is tracked identically to existing behavior.

---

### User Story 3 - Agent-Distinguishable Analytics (Priority: P2)

Project administrators reviewing job analytics can distinguish which jobs were run by Claude vs. Codex, enabling cost comparison and agent performance analysis across their projects.

**Why this priority**: Analytics differentiation is valuable but depends on telemetry ingestion (P1) working first.

**Independent Test**: Can be tested by creating jobs linked to tickets with different agent types, sending telemetry for each, and verifying that queries can filter/group by agent type.

**Acceptance Scenarios**:

1. **Given** completed Jobs with telemetry from both Claude and Codex agents, **When** an administrator views analytics, **Then** they can distinguish agent-specific metrics (the agent type is identifiable through the Job's associated Ticket).
2. **Given** a Job with Codex telemetry, **When** the model field is populated from a `codex.api_request` event, **Then** the model name reflects the Codex model used (e.g., a non-Claude model identifier).

---

### Edge Cases

- What happens when the endpoint receives an OTLP payload with an unrecognized event name (not `claude_code.*` or `codex.*`)? The system should silently skip it without error, maintaining existing behavior for unknown events.
- What happens when a Codex payload contains attributes with different naming or missing optional fields (e.g., no `cache_read_tokens`)? The system should handle missing attributes gracefully, defaulting to zero as it does for Claude events.
- What happens when `codex exec` sends OTLP data without metric events (only logs/traces)? The endpoint should process the payload without error but not update any metric fields since no recognized metric events are present.
- What happens when a single Job receives telemetry from mixed agent event names? The system should accumulate all recognized metrics regardless of event prefix, since the Job identity is determined by `job_id`, not agent type.

## Requirements

### Functional Requirements

- **FR-001**: System MUST accept OTLP log events with the `codex.api_request` event name and extract the same metric attributes (input tokens, output tokens, cost, duration, model) as it does for `claude_code.api_request` events.
- **FR-002**: System MUST accept OTLP log events with the `codex.tool.call` event name and extract tool usage information, adding tool names to the Job's tools-used list.
- **FR-003**: System MUST continue to accept and process `claude_code.api_request`, `claude_code.tool_result`, and `claude_code.tool_decision` events with no behavioral changes.
- **FR-004**: System MUST accumulate metrics correctly when multiple OTLP batches arrive for the same Job, regardless of whether they contain Claude or Codex events.
- **FR-005**: System MUST skip unrecognized event names without producing errors, maintaining the existing silent-skip behavior.
- **FR-006**: System MUST handle missing or null metric attributes in Codex events gracefully, defaulting to zero for numeric fields.
- **FR-007**: The agent type for any Job MUST be identifiable through the existing Ticket-to-Job relationship, where the Ticket's `agent` field indicates CLAUDE or CODEX.

### Key Entities

- **Job**: Existing entity that stores aggregated telemetry metrics (tokens, cost, duration, model, tools used). No schema changes required — the same fields accommodate both Claude and Codex metrics.
- **Ticket**: Existing entity with an `agent` field (CLAUDE or CODEX) that identifies which AI agent is used. Jobs inherit agent identity through this relationship.
- **OTLP Log Record**: Incoming telemetry data containing event names and metric attributes. The event name prefix (`claude_code.*` or `codex.*`) indicates the source agent.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Codex agent jobs have telemetry data (tokens, cost, tools) populated on their Job records after workflow completion, matching the same data completeness as Claude jobs.
- **SC-002**: All existing Claude telemetry continues to function identically — zero regressions in token counts, cost tracking, or tool usage for Claude-agent jobs.
- **SC-003**: Analytics views can filter or group job metrics by agent type, enabling cost and usage comparison between Claude and Codex across projects.
- **SC-004**: The telemetry endpoint processes both Claude and Codex OTLP payloads within the same response time characteristics as the current Claude-only implementation.
