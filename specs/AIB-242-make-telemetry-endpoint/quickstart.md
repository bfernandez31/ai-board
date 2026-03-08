# Quickstart: AIB-242 Make Telemetry Endpoint Agent-Agnostic

## Scope

Extend the OTLP telemetry endpoint to accept Codex events alongside Claude Code events. No schema changes. No new files. Minimal code changes to one route handler.

## Files to Modify

1. **`app/api/telemetry/v1/logs/route.ts`** — Add `codex.api_request` and `codex.tool.call` event name matching alongside existing `claude_code.*` checks. Update JSDoc comment.

2. **`tests/unit/telemetry/otlp-schema.test.ts`** — Add test cases for Codex event payloads in OTLP format validation.

3. **`tests/integration/telemetry/`** — Add or extend integration tests:
   - Codex `api_request` event → Job metrics updated
   - Codex `tool.call` event → Job tools updated
   - Mixed Claude + Codex events in same batch
   - Backward compatibility: existing Claude events still work
   - Unrecognized events silently skipped
   - Missing attributes default to zero

## Implementation Steps

### Step 1: Extend Event Matching (route.ts)

In the log record processing loop (lines 115-131), change:

```typescript
// Before: Claude-only
if (eventName === 'claude_code.api_request') { ... }
if (eventName === 'claude_code.tool_result' || eventName === 'claude_code.tool_decision') { ... }

// After: Agent-agnostic
if (eventName === 'claude_code.api_request' || eventName === 'codex.api_request') { ... }
if (eventName === 'claude_code.tool_result' || eventName === 'claude_code.tool_decision' || eventName === 'codex.tool.call') { ... }
```

### Step 2: Update JSDoc

Update the route handler's JSDoc comment to reflect agent-agnostic support.

### Step 3: Write Tests

Follow Testing Trophy: integration tests for API behavior, unit tests for schema validation.

## Key Constraints

- No Prisma schema changes
- No new dependencies
- Backward compatible — all existing Claude telemetry must work identically
- Agent type resolved via `Ticket.agent` field, not from OTLP event names
