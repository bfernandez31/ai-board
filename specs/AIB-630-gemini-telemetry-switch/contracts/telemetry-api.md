# Contract: Telemetry API for Native Gemini Provider Events

## Endpoint

- `POST /api/telemetry/v1/logs`

## Authentication

- Bearer token validated by `validateWorkflowAuth()`
- Same workflow token requirement for OTLP and batch payloads

## Supported request shapes after this change

### 1. OTLP log payload

Used by Claude, Codex, and Gemini.

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "job_id", "value": { "stringValue": "123" } }
        ]
      },
      "scopeLogs": [
        {
          "logRecords": [
            {
              "body": { "stringValue": "gemini_cli.api_response" },
              "attributes": [
                { "key": "model", "value": { "stringValue": "gemini-2.5-pro" } },
                { "key": "input_tokens", "value": { "stringValue": "1200" } },
                { "key": "output_tokens", "value": { "stringValue": "350" } },
                { "key": "cache_read_tokens", "value": { "stringValue": "80" } },
                { "key": "duration_ms", "value": { "stringValue": "4300" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Gemini-specific rules:
- Event identity must come from native `gemini_cli.*` names.
- `job_id` in OTLP resource attributes is required to persist data.
- The route may accept partial Gemini events and merge whichever native fields are present.
- Tool usage comes from Gemini tool events, not reconstructed stdout.
- If Gemini emits native cost, the route stores it directly. If not, route-side estimation may be applied only from native fields.

### 2. Batch JSON payload

Used only by Mistral after this change.

```json
{
  "jobId": 123,
  "agent": "MISTRAL",
  "inputTokens": 5000,
  "outputTokens": 2000,
  "model": "devstral-medium-latest",
  "toolsUsed": ["bash", "read_file"]
}
```

Provider routing rules:
- `resourceLogs` or `resource_logs` -> OTLP branch
- Non-OTLP JSON object -> batch branch
- Gemini batch payloads are no longer a supported contract

## Persistence contract

For correlated Gemini OTLP events, the route updates the existing `Job` row using normalized fields:
- `model`
- `inputTokens`
- `outputTokens`
- `thinkingTokens`
- `cacheReadTokens`
- `cacheCreationTokens`
- `durationMs`
- `costUsd`
- `toolsUsed`

Outcome rules:
- `Job.status` remains controlled by `/api/jobs/[id]/status`
- Missing or partial Gemini telemetry must not cause a failed job to appear successful

## Response contract

### 200 Accepted

```json
{
  "status": "accepted",
  "jobId": 123,
  "metrics": {
    "inputTokens": 1200,
    "outputTokens": 350,
    "thinkingTokens": 0,
    "costUsd": 0.02
  }
}
```

### 400 Bad Request

- Invalid JSON
- Invalid OTLP shape
- Invalid Mistral batch payload

### 401 Unauthorized

- Missing or invalid workflow bearer token

### 404 Not Found

- A correlated `job_id` or `jobId` does not match an existing job

## Non-goals

- No Gemini-specific secondary endpoint
- No Gemini stdout reconstruction contract
- No Gemini batch fallback contract
