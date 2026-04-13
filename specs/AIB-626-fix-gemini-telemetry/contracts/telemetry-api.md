# Contract: Gemini Native Telemetry Intake

> **Superseded**: The Gemini batch payload described below was replaced by native OTLP emission in [AIB-629](../../AIB-629-gemini-telemetry-switch/contracts/telemetry-api.md). Gemini now emits `gemini_cli.*` OTLP log records natively. The batch endpoint is now Mistral-only.

## Endpoint Extended

### `POST /api/telemetry/v1/logs`

Continue supporting:
- OTLP logs for Claude, Codex, and Gemini (native)
- batch JSON for Mistral

~~Extend Gemini batch JSON so it can represent native Gemini telemetry categories without conflation.~~

## Gemini batch payload (SUPERSEDED — see AIB-629)

```json
{
  "jobId": 456,
  "agent": "GEMINI",
  "model": "gemini-2.5-pro",
  "inputTokens": 1500,
  "outputTokens": 800,
  "thinkingTokens": 200,
  "cacheReadTokens": 120,
  "cacheCreationTokens": 40,
  "toolsUsed": ["read_file", "shell"],
  "durationMs": 5234,
  "costStatus": "ESTIMATED"
}
```

When pricing is not available:

```json
{
  "jobId": 456,
  "agent": "GEMINI",
  "model": "gemini-experimental-x",
  "inputTokens": 1500,
  "outputTokens": 800,
  "thinkingTokens": 200,
  "toolsUsed": ["read_file", "shell"],
  "durationMs": 5234,
  "costStatus": "UNAVAILABLE"
}
```

## Processing rules

1. `jobId` is required for persistence.
2. `agent=GEMINI` selects Gemini-native normalization and Gemini pricing logic.
3. `thinkingTokens` must remain distinct from `outputTokens`, `cacheReadTokens`, and `cacheCreationTokens`.
4. `toolsUsed` is merged using set semantics.
5. Incremental Gemini events may be merged additively, but repeated final-result payloads must not double-count.
6. `costStatus=UNAVAILABLE` must not be converted to `0` and must not hide usage metrics.

## Responses

- `200`: accepted and merged
- `400`: invalid Gemini or OTLP payload
- `401`: unauthorized workflow callback
- `404`: referenced job not found
- `500`: unexpected ingestion error
