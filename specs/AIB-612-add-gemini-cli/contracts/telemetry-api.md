# Contract: Gemini Native OTLP Telemetry Ingestion

## Endpoint Extended

### `POST /api/telemetry/v1/logs`

Continue supporting:
- OTLP logs for Claude and Codex
- batch JSON for Mistral

Add:
- OTLP logs for Gemini native `gemini_cli.*` provider events

## Gemini OTLP payload

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          { "key": "job_id", "value": { "stringValue": "456" } }
        ]
      },
      "scopeLogs": [
        {
          "logRecords": [
            {
              "body": { "stringValue": "gemini_cli.api_response" },
              "attributes": [
                { "key": "model", "value": { "stringValue": "gemini-2.5-flash" } },
                { "key": "input_tokens", "value": { "intValue": "1500" } },
                { "key": "output_tokens", "value": { "intValue": "800" } },
                { "key": "cache_read_tokens", "value": { "intValue": "200" } }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Processing rules

1. `job_id` in OTLP resource attributes is required to persist metrics
2. `gemini_cli.*` event names select the Gemini-native processing path
3. Tool usage is merged with existing job tools using set semantics
4. Token and duration fields are merged cumulatively using native Gemini values
5. Unsupported Gemini models preserve usage metrics with `costUsd = null`
6. Gemini batch JSON is no longer a supported contract

## Responses

- `200`: accepted and merged
- `400`: invalid OTLP payload or rejected Gemini batch payload
- `401`: unauthorized workflow callback
- `404`: job not found
- `500`: unexpected ingestion error

## Compatibility

- Existing Mistral batch payload remains valid
- Existing Claude/Codex OTLP paths remain unchanged
