# Contract: Telemetry API — Gemini Native OTLP

**Endpoint**: `POST /api/telemetry/v1/logs`

## Gemini OTLP Events (NEW — replaces batch path)

Gemini CLI emits OTLP log records natively during execution using standard OpenTelemetry environment variables. Events arrive in real-time batches (delta mode).

### Resource Attributes

```json
{
  "resource": {
    "attributes": [
      { "key": "job_id", "value": { "stringValue": "456" } },
      { "key": "service.name", "value": { "stringValue": "gemini-cli" } }
    ]
  }
}
```

### Token Event: `gemini_cli.api_response`

Emitted per API request. Contains token counts and model identity.

```json
{
  "body": { "stringValue": "gemini_cli.api_response" },
  "attributes": [
    { "key": "input_tokens", "value": { "stringValue": "1500" } },
    { "key": "output_tokens", "value": { "stringValue": "800" } },
    { "key": "thinking_tokens", "value": { "stringValue": "200" } },
    { "key": "cache_read_tokens", "value": { "stringValue": "120" } },
    { "key": "cache_creation_tokens", "value": { "stringValue": "40" } },
    { "key": "duration_ms", "value": { "stringValue": "5234" } },
    { "key": "model", "value": { "stringValue": "gemini-2.5-pro-preview-05-06" } }
  ]
}
```

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_tokens` | int (string-encoded) | Yes | Non-cached input tokens |
| `output_tokens` | int (string-encoded) | Yes | Output tokens |
| `thinking_tokens` | int (string-encoded) | No | Thinking/reasoning tokens |
| `cache_read_tokens` | int (string-encoded) | No | Cache read tokens |
| `cache_creation_tokens` | int (string-encoded) | No | Cache creation tokens |
| `duration_ms` | int (string-encoded) | No | Request duration in milliseconds |
| `model` | string | Yes | Full model identifier |

### Tool Events: `gemini_cli.tool_call` / `gemini_cli.tool_result`

```json
{
  "body": { "stringValue": "gemini_cli.tool_call" },
  "attributes": [
    { "key": "tool_name", "value": { "stringValue": "read_file" } }
  ]
}
```

### Merge Strategy

- **Mode**: DELTA (default OTLP behavior)
- All token counts are summed across batches
- Duration is summed across batches
- Tools are merged into a deduplicated sorted set
- Model is set to the last reported value
- Cost is estimated server-side after merging with existing job data (uses `estimateGeminiCost()` with tier-2 threshold logic)

## Batch Payload (Mistral-only — SIMPLIFIED)

After removing Gemini from the batch path, the batch payload schema is simplified:

```json
{
  "jobId": 123,
  "inputTokens": 5000,
  "outputTokens": 2000,
  "cacheReadTokens": 300,
  "durationMs": 12000,
  "model": "devstral-medium-latest",
  "toolsUsed": ["bash", "write_file"],
  "costUsd": 0.045
}
```

**Removed fields** (were Gemini-specific):
- `agent`: No longer needed — batch path is Mistral-only
- `usageSnapshotMode`: No longer needed — Mistral uses DELTA (default)
- `costStatus`: No longer needed — Mistral always provides `costUsd` or it's estimated server-side
- `thinkingTokens`: Mistral models don't produce thinking tokens

**Retained for backward compatibility**: `thinkingTokens`, `cacheCreationTokens`, `costStatus` remain in the Zod schema as optional fields but are not expected from Mistral. The `agent` and `usageSnapshotMode` fields are removed from the schema.

## Response Format (unchanged)

```json
{
  "status": "accepted",
  "jobId": 456,
  "metrics": {
    "inputTokens": 1500,
    "outputTokens": 800,
    "thinkingTokens": 200,
    "costUsd": 0.0234
  }
}
```
