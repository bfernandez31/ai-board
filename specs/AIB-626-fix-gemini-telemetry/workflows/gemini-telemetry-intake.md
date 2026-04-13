# Workflow Artifact: Gemini Telemetry Intake and Normalization

> **Superseded**: The batch normalization approach described below was replaced by native OTLP intake in [AIB-629](../../AIB-629-gemini-telemetry-switch/workflows/gemini-otlp-intake.md). Gemini telemetry now arrives as `gemini_cli.*` OTLP log records and is processed by the same OTLP handler as Claude and Codex.

## Workflow Definition (SUPERSEDED)

### Input (AIB-629 — current)

- Gemini OTLP log records (via standard OTEL exporter)
- workflow bearer token (in `OTEL_EXPORTER_OTLP_HEADERS`)
- `job_id` in `OTEL_RESOURCE_ATTRIBUTES`

### Phases (AIB-629 — current)

1. Validate workflow auth.
2. Validate OTLP schema.
3. Detect `gemini_cli.api_response` events by event name.
4. Parse token attributes (`input_tokens`, `output_tokens`, `thinking_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `duration_ms`, `model`).
5. Estimate cost server-side using `estimateGeminiCost()`.
6. Merge metrics in DELTA mode (same as Claude/Codex).
7. Persist updated job telemetry.

## Callback / Reporting Contract

- `200` on accepted merge
- `404` when job does not exist
- `400` when payload shape is invalid
- `401` on invalid workflow auth

## Error behavior

- Invalid or unmatchable events must not mutate unrelated jobs.
- If no OTLP events arrive, job retains null metrics (missing-telemetry state).
