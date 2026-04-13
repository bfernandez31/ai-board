# Workflow Artifact: Gemini Telemetry Ingestion

## Workflow Definition

### Input

- OTLP `resourceLogs` payload containing native `gemini_cli.*` events
- `job_id` in resource attributes
- workflow bearer token

### Phases

1. Authenticate the request with `validateWorkflowAuth()`.
2. Parse JSON and normalize OTLP key casing if needed.
3. Validate payload with the shared OTLP schema.
4. Identify Gemini-native records from `gemini_cli.*` event names.
5. Extract model, token buckets, tool usage, duration, cost, and any outcome metadata available in native attributes.
6. Correlate the payload to the intended `Job`.
7. Merge normalized telemetry into the existing job record.
8. Return `200 accepted` or a structured validation error.

### Environment requirements

- Workflow API token
- Existing `Job` row for the correlated `job_id`

## Callback / Reporting Contract

- Successful ingestion updates only normalized telemetry fields.
- Unsupported or malformed Gemini events are ignored or logged safely.
- Missing `job_id` returns accepted/no-store behavior consistent with other OTLP payloads.
- Job status is never promoted to success by telemetry ingestion alone.

## Error Behavior

- `401` on invalid workflow auth
- `400` on invalid JSON or OTLP shape
- `404` when `job_id` resolves to no job
- `500` only for unexpected server errors after structured logging
