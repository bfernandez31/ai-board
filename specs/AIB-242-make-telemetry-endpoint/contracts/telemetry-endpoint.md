# API Contract: POST /api/telemetry/v1/logs

## Endpoint

**Method**: POST
**Path**: `/api/telemetry/v1/logs`
**Auth**: Bearer token (`WORKFLOW_API_TOKEN`)
**Content-Type**: `application/json`

## No API Changes

The endpoint contract is **unchanged**. The same URL, authentication, request format, and response format are used for both Claude and Codex telemetry. The only difference is the event names within the OTLP payload body.

## Request Body (OTLP Logs Format)

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "job_id", "value": { "stringValue": "123" } },
          { "key": "service.name", "value": { "stringValue": "codex" } }
        ]
      },
      "scopeLogs": [
        {
          "logRecords": [
            {
              "body": { "stringValue": "codex.api_request" },
              "attributes": [
                { "key": "input_tokens", "value": { "stringValue": "500" } },
                { "key": "output_tokens", "value": { "stringValue": "200" } },
                { "key": "cache_read_tokens", "value": { "stringValue": "0" } },
                { "key": "cache_creation_tokens", "value": { "stringValue": "0" } },
                { "key": "cost_usd", "value": { "stringValue": "0.03" } },
                { "key": "duration_ms", "value": { "stringValue": "1500" } },
                { "key": "model", "value": { "stringValue": "codex-mini-latest" } }
              ]
            },
            {
              "body": { "stringValue": "codex.tool.call" },
              "attributes": [
                { "key": "tool_name", "value": { "stringValue": "shell" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Recognized Event Names

### Before (Claude-only)
- `claude_code.api_request` → token/cost metrics
- `claude_code.tool_result` → tool tracking
- `claude_code.tool_decision` → tool tracking

### After (Agent-agnostic)
- `claude_code.api_request` → token/cost metrics (unchanged)
- `claude_code.tool_result` → tool tracking (unchanged)
- `claude_code.tool_decision` → tool tracking (unchanged)
- `codex.api_request` → token/cost metrics (NEW)
- `codex.tool.call` → tool tracking (NEW)

## Response (Unchanged)

### 200 OK - Success
```json
{
  "status": "accepted",
  "jobId": 123,
  "metrics": {
    "inputTokens": 1500,
    "outputTokens": 700,
    "costUsd": 0.08
  }
}
```

### 200 OK - No job_id
```json
{
  "status": "accepted",
  "message": "Telemetry received but no job_id found in resource attributes"
}
```

### 400 Bad Request
```json
{ "error": "Invalid JSON in request body" }
```
```json
{ "error": "Invalid OTLP format" }
```

### 401 Unauthorized
```json
{ "error": "Unauthorized" }
```

### 404 Not Found
```json
{ "error": "Job not found" }
```

### 500 Internal Server Error
```json
{ "error": "Internal server error" }
```

## Attribute Mapping (Same for Both Agents)

| OTLP Attribute | Job Field | Parser | Default |
|---------------|-----------|--------|---------|
| input_tokens | inputTokens | parseIntAttribute | 0 |
| output_tokens | outputTokens | parseIntAttribute | 0 |
| cache_read_tokens | cacheReadTokens | parseIntAttribute | 0 |
| cache_creation_tokens | cacheCreationTokens | parseIntAttribute | 0 |
| cost_usd | costUsd | parseFloatAttribute | 0.0 |
| duration_ms | durationMs | parseIntAttribute | 0 |
| model | model | String() | unchanged |
| tool_name | toolsUsed[] | String() | skipped |
