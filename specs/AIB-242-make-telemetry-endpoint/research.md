# Research: Make Telemetry Endpoint Agent-Agnostic

## Decision 1: Codex OTLP Event Name Convention

**Decision**: Codex events use `codex.*` prefix — specifically `codex.api_request` for metrics and `codex.tool.call` for tool tracking.

**Rationale**: The spec defines event name prefix (`claude_code.*` vs `codex.*`) as the deterministic discriminator. This aligns with the existing pattern where `claude_code.api_request` carries token/cost attributes. The Codex counterpart `codex.api_request` carries the same attribute set.

**Alternatives considered**:
- Using `service.name` resource attribute — adds complexity and is less deterministic than event name prefix
- Adding agent-type header to the HTTP request — requires workflow changes and breaks OTLP standard compliance

## Decision 2: Codex Tool Event Structure

**Decision**: Codex tool events use `codex.tool.call` with a `tool_name` attribute, matching the same attribute key used by Claude's `claude_code.tool_result` and `claude_code.tool_decision`.

**Rationale**: Using the same attribute key (`tool_name`) means tool extraction logic is shared. Only the event name matching needs to change.

**Alternatives considered**:
- Different attribute key for Codex tools — would require separate extraction logic, adding complexity with no benefit

## Decision 3: No Schema Changes Required

**Decision**: No Prisma schema changes. Job model already has all necessary fields. Agent type is tracked via `Ticket.agent` field (enum: CLAUDE | CODEX).

**Rationale**: The existing Job fields (`inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheCreationTokens`, `costUsd`, `durationMs`, `model`, `toolsUsed`) accommodate both agents. The `Ticket.agent` field (resolved via `resolveEffectiveAgent()` in `lib/workflows/transition.ts`) already supports CLAUDE and CODEX values.

**Alternatives considered**:
- Adding `agent` field to Job model — rejected per CONSERVATIVE auto-resolved decision in spec; creates redundant data

## Decision 4: Non-Metric Codex Events

**Decision**: `codex.sse_event` and `codex.websocket.request` are excluded from processing (silently skipped).

**Rationale**: These events do not carry token/cost attributes per the spec's CONSERVATIVE decision. The existing endpoint already silently skips unrecognized events, so no special handling is needed.

**Alternatives considered**:
- Processing all `codex.*` events — would accumulate empty/zero values unnecessarily

## Decision 5: Implementation Approach

**Decision**: Extend event name matching in the existing route handler with minimal changes — add Codex event names alongside Claude event names in the conditional checks.

**Rationale**: The telemetry endpoint (`app/api/telemetry/v1/logs/route.ts`) uses simple if-statements to match event names. Adding `codex.api_request` and `codex.tool.call` to these conditions is the minimal change. No refactoring needed.

**Alternatives considered**:
- Creating an event registry/mapping system — over-engineering for 2 additional event names
- Separate endpoint for Codex — violates DRY and complicates workflow configuration

## Decision 6: Testing Strategy

**Decision**: Integration tests for the telemetry endpoint with Codex payloads, plus unit tests extending OTLP schema coverage. Follow Testing Trophy — no E2E tests needed.

**Rationale**: Telemetry ingestion is an API endpoint with database operations → integration tests are the right layer. Unit tests verify OTLP schema handles Codex event names. No browser interaction involved.

**Alternatives considered**:
- E2E tests — unnecessary overhead for a backend API endpoint (5s vs 50ms per test)
