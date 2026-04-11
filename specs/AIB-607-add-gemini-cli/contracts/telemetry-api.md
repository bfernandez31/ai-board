# Contract: Gemini Telemetry Processing

No new endpoints. Existing `POST /api/telemetry/v1/logs` handles all agents.

## New Gemini OTLP Event Contracts

### Event: `gemini_cli.api_response`

Received via OTLP resource logs (same transport as Claude/Codex).

**Expected attributes**:
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_tokens` | int | Yes | Input tokens consumed |
| `output_tokens` | int | Yes | Output tokens generated |
| `thought_tokens` | int | No | Thinking/reasoning tokens (maps to cacheReadTokens) |
| `model` | string | No | Model identifier (e.g., "gemini-2.5-pro") |
| `duration_ms` | int | No | API call duration in milliseconds |

### Event: `gemini_cli.tool_call`

**Expected attributes**:
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `tool_name` | string | Yes | Name of the tool invoked |

### Cost Estimation

Server-side via `estimateGeminiCost(model, inputTokens, outputTokens, cachedTokens)`.

Pricing table (per million tokens):
```
gemini-2.5-pro:   input=$1.25,  output=$10.00, cached=$0.3125
gemini-2.5-flash: input=$0.15,  output=$3.50,  cached=$0.0375
gemini-2.0-flash: input=$0.10,  output=$0.40,  cached=$0.025
```

Fallback model: `gemini-2.5-pro` (conservative, most expensive).

### Environment Variables for Gemini Telemetry

Set by `run-agent.sh` before invoking Gemini CLI:
```
GEMINI_TELEMETRY_ENABLED=1
OTEL_EXPORTER_OTLP_ENDPOINT=<app-url>/api/telemetry
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
OTEL_RESOURCE_ATTRIBUTES=job_id=<job-id>
```
