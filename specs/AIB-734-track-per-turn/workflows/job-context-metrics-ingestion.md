# Workflow Artifact: Job Context Metrics Ingestion

## Workflow Definition

### Input

- OTLP telemetry payload sent to `POST /api/telemetry/v1/logs`
- `job_id` resource attribute
- provider-specific turn-level context attributes for supported agents
- workflow bearer token already required by the telemetry route

### Phases

1. Authenticate and parse the telemetry request using the existing telemetry route path.
2. Normalize provider event names and attributes in `lib/telemetry/otlp-processor.ts`.
3. Detect whether the payload includes a supported turn-level context measurement format.
4. Aggregate per-turn values into:
   - `peakContextSize`
   - `averageContextSize`
   - `turnCount`
5. Merge the derived context metrics into the same `updateData` object that already persists tokens, duration, cost, model, and tools.
6. Leave the context metric set null when:
   - the provider is unsupported
   - required context attributes are missing
   - the turn-level payload is unusable
7. Return the same accepted / no-op / error behavior already used by telemetry ingestion.

### Environment requirements

- Existing `Job` row
- workflow API token
- supported provider payload that already emits turn-level context measurements

## Agent Command Specification

Not applicable. This process is server-side telemetry normalization, not an interactive agent command.

## Callback / Reporting Contract

- Successful ingestion updates only normalized `Job` telemetry fields.
- Context metrics appear on the `Job` before the record is shown in ticket jobs and analytics polling flows.
- Unsupported or partial context data does not block the rest of telemetry persistence.
- Telemetry ingestion never changes job status on its own.

## Error Behavior

- `401` on invalid workflow auth
- `400` on invalid OTLP shape
- `404` when `job_id` resolves to no job
- `200 accepted` with no context mutation when no supported context records are found
- `500` only for unexpected server failures after logging context
