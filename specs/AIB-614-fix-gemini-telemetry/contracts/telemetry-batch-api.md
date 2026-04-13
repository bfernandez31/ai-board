# Contract: Gemini Telemetry Batch API

## Endpoint

`POST /api/telemetry/v1/logs`

## Authentication

`Authorization: Bearer <WORKFLOW_API_TOKEN>`

## Gemini Batch Payload (Enhanced)

### Request Body

```json
{
  "jobId": 123,
  "agent": "GEMINI",
  "model": "gemini-2.5-pro",
  "inputTokens": 15000,
  "outputTokens": 3000,
  "thinkingTokens": 5000,
  "cacheReadTokens": 8000,
  "cacheCreationTokens": 2000,
  "durationMs": 45000,
  "toolsUsed": ["Read", "Edit", "Bash", "Glob"],
  "costUsd": null
}

```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobId` | `number` | Yes | Job record ID |
| `agent` | `"GEMINI"` | Yes | Agent identifier |
| `model` | `string` | No | Gemini model identifier (e.g., `gemini-2.5-pro`) |
| `inputTokens` | `number` | No | Total input tokens consumed |
| `outputTokens` | `number` | No | Total output tokens generated |
| `thinkingTokens` | `number` | No | Total thinking/reasoning tokens (0 if model doesn't support thinking) |
| `cacheReadTokens` | `number` | No | Total cache read tokens |
| `cacheCreationTokens` | `number` | No | Total cache creation tokens |
| `durationMs` | `number` | No | Execution duration in milliseconds |
| `toolsUsed` | `string[]` | No | List of tools used during execution |
| `costUsd` | `number \| null` | No | Pre-computed cost (if available); when absent, server estimates from pricing table |
| `costStatus` | `"ESTIMATED" \| "UNAVAILABLE"` | No | Deprecated — server now determines cost status automatically |

### Response

```json
{
  "status": "accepted",
  "jobId": 123,
  "metrics": {
    "inputTokens": 15000,
    "outputTokens": 3000,
    "costUsd": 0.0875
  }
}
```

## Cost Estimation Behavior

| Condition | Result |
|-----------|--------|
| `costUsd` provided in payload | Use provided value |
| Model found in `GEMINI_PRICING` table | Estimate from token counts |
| Model NOT in pricing table | `costUsd` remains `null` (unavailable) |
| No token data (`inputTokens` and `outputTokens` both 0) | No estimation attempted |

## Cost Formula

```
cost = (inputTokens / 1_000_000) × input_rate
     + (outputTokens / 1_000_000) × output_rate
     + (thinkingTokens / 1_000_000) × thinking_rate
     + (cacheReadTokens / 1_000_000) × cached_rate
```

## Backward Compatibility

- Existing payloads with `costStatus: "UNAVAILABLE"` and no `thinkingTokens` continue to work
- The `costStatus` field is no longer required — server determines availability from pricing table lookup
- Payloads without `thinkingTokens` default to 0
