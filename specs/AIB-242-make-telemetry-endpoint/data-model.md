# Data Model: Make Telemetry Endpoint Agent-Agnostic

## Existing Entities (No Changes Required)

### Job (Prisma Model)
Stores aggregated telemetry metrics. All fields already support both Claude and Codex data.

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Primary key |
| ticketId | Int | FK to Ticket (provides agent identity) |
| inputTokens | Int? | Accumulated input tokens |
| outputTokens | Int? | Accumulated output tokens |
| cacheReadTokens | Int? | Accumulated cache read tokens |
| cacheCreationTokens | Int? | Accumulated cache creation tokens |
| costUsd | Float? | Accumulated cost in USD |
| durationMs | Int? | Accumulated API duration in ms |
| model | String? | Last model name seen |
| toolsUsed | String[] | Deduplicated, sorted tool names |

### Ticket (Prisma Model)
Provides agent identity for Jobs via the `agent` field.

| Field | Type | Description |
|-------|------|-------------|
| agent | Agent? | CLAUDE or CODEX (nullable, resolved via project default) |

### Agent (Prisma Enum)
```
enum Agent {
  CLAUDE
  CODEX
}
```

## OTLP Event Types (Logical Model)

### Metric Events (processed for token/cost aggregation)

| Event Name | Agent | Attributes |
|------------|-------|------------|
| `claude_code.api_request` | Claude | input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, duration_ms, model |
| `codex.api_request` | Codex | input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, duration_ms, model |

### Tool Events (processed for tool tracking)

| Event Name | Agent | Attributes |
|------------|-------|------------|
| `claude_code.tool_result` | Claude | tool_name |
| `claude_code.tool_decision` | Claude | tool_name |
| `codex.tool.call` | Codex | tool_name |

### Ignored Events (silently skipped)

| Event Name | Agent | Reason |
|------------|-------|--------|
| `codex.sse_event` | Codex | No metric attributes |
| `codex.websocket.request` | Codex | No metric attributes |
| Any other unrecognized event | Any | Existing skip behavior |

## Relationships

```
Ticket (agent: CLAUDE|CODEX)
  └── Job (telemetry metrics)
        └── OTLP Log Records (incoming, not persisted)
```

## Validation Rules

- `job_id` resource attribute: Required for metric storage (integer, must reference existing Job)
- Token attributes: Default to 0 if missing or null (via `parseIntAttribute`)
- Cost attribute: Default to 0.0 if missing or null (via `parseFloatAttribute`)
- Tool name: Skipped if missing or null
- Model: Only updated if present in the current batch

## State Transitions

No state transitions affected. Job status lifecycle (PENDING → RUNNING → COMPLETED|FAILED|CANCELLED) is unchanged. Telemetry arrives during RUNNING state and accumulates across batches.
