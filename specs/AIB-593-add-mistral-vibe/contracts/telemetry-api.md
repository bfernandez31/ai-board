# API Contract: Mistral Telemetry Trace Processing

**Branch**: `AIB-593-add-mistral-vibe`

## Endpoint Extension

### POST /api/telemetry/v1/logs

**Current behavior**: Accepts OTLP log payloads; silently ignores trace payloads (`resourceSpans`).

**New behavior**: Also processes OTLP trace payloads when `resourceSpans` key is present.

### Trace Payload Format (OTLP HTTP JSON)

```json
{
  "resourceSpans": [{
    "resource": {
      "attributes": [
        { "key": "job_id", "value": { "stringValue": "456" } },
        { "key": "service.name", "value": { "stringValue": "vibe" } }
      ]
    },
    "scopeSpans": [{
      "spans": [{
        "name": "chat_completion",
        "attributes": [
          { "key": "gen_ai.system", "value": { "stringValue": "mistral" } },
          { "key": "gen_ai.request.model", "value": { "stringValue": "mistral-large-latest" } },
          { "key": "gen_ai.usage.input_tokens", "value": { "intValue": "1500" } },
          { "key": "gen_ai.usage.output_tokens", "value": { "intValue": "800" } },
          { "key": "gen_ai.usage.cache_read_tokens", "value": { "intValue": "200" } }
        ],
        "startTimeUnixNano": "1712700000000000000",
        "endTimeUnixNano": "1712700005000000000"
      }]
    }]
  }]
}
```

### Trace Processing Logic

1. **Detection**: Presence of `resourceSpans` key (vs `resourceLogs` for logs)
2. **Job ID extraction**: From `resource.attributes` with key `job_id` (same as logs)
3. **Span iteration**: For each span in `scopeSpans[].spans[]`:
   - Extract model from `gen_ai.request.model` attribute
   - Extract tokens from `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_read_tokens`
   - Calculate duration from `endTimeUnixNano - startTimeUnixNano` (convert to milliseconds)
   - Extract tool name from `tool.name` attribute on tool-type spans
4. **Cost estimation**: Use `MISTRAL_PRICING` table (same pattern as `OPENAI_PRICING`)
5. **Accumulation**: Sum all metrics, merge tools, update Job record (same as log processing)

### Response Format

Same as existing:
```json
{
  "status": "accepted",
  "jobId": 456,
  "metrics": {
    "inputTokens": 1500,
    "outputTokens": 800,
    "costUsd": 0.0078
  }
}
```

### Error Cases

| Scenario | Response |
|----------|----------|
| Invalid JSON | 400 `{ "error": "Invalid JSON in request body" }` |
| No job_id in resource attributes | 200 `{ "status": "accepted", "message": "Telemetry received but no job_id found" }` |
| Job not found | 404 `{ "error": "Job not found" }` |
| Auth failure | 401 `{ "error": "Unauthorized" }` |

### Mistral Pricing Table

```typescript
const MISTRAL_PRICING: Record<string, { input: number; output: number; cached: number }> = {
  'mistral-large-latest':  { input: 2.00, output: 6.00, cached: 1.00 },
  'mistral-medium-latest': { input: 0.70, output: 2.10, cached: 0.35 },
  'mistral-small-latest':  { input: 0.10, output: 0.30, cached: 0.05 },
  'codestral-latest':      { input: 0.30, output: 0.90, cached: 0.15 },
};
```

Cost formula: `(tokens / 1_000_000) * pricing_per_million` (identical to OpenAI pattern)
