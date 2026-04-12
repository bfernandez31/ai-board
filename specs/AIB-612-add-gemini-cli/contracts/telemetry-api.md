# Contract: Gemini Batch Telemetry Ingestion

## Endpoint Extended

### `POST /api/telemetry/v1/logs`

Continue supporting:
- OTLP logs for Claude and Codex
- batch JSON for Mistral

Add:
- batch JSON for Gemini aggregated from CLI `stream-json` output

## Gemini batch payload

```json
{
  "jobId": 456,
  "agent": "GEMINI",
  "model": "gemini-3-pro",
  "inputTokens": 1500,
  "outputTokens": 800,
  "cacheReadTokens": 200,
  "cacheCreationTokens": 0,
  "toolsUsed": ["read_file", "write_file", "shell"],
  "durationMs": 5234,
  "costUsd": 0.0123,
  "costStatus": "ESTIMATED"
}
```

or, when pricing is unknown:

```json
{
  "jobId": 456,
  "agent": "GEMINI",
  "model": "gemini-experimental-x",
  "inputTokens": 1500,
  "outputTokens": 800,
  "toolsUsed": ["read_file", "shell"],
  "durationMs": 5234,
  "costStatus": "UNAVAILABLE"
}
```

## Processing rules

1. `jobId` is required to persist metrics
2. `agent=GEMINI` selects Gemini-specific cost estimation logic
3. `toolsUsed` is merged with existing job tools using set semantics
4. Token and duration fields are accumulated using the same existing merge path
5. `costStatus=UNAVAILABLE` must not be converted to `0`

## Responses

- `200`: accepted and merged
- `400`: invalid batch payload
- `401`: unauthorized workflow callback
- `404`: job not found
- `500`: unexpected ingestion error

## Compatibility

- Existing Mistral batch payload remains valid
- Existing Claude/Codex OTLP paths remain unchanged

