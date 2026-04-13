# Workflow Artifact: Gemini Native Telemetry Emission

> **Superseded**: The stream-JSON emission approach described below was replaced by native OTLP emission in [AIB-629](../../AIB-629-gemini-telemetry-switch/workflows/gemini-native-otlp-emission.md). Gemini CLI now emits OTLP log records natively using standard OTEL environment variables — no `--output-format stream-json`, no `GEMINI_STREAM_FILE`, no post-execution scraping.

## Workflow Definition (SUPERSEDED)

### Input

- `JOB_ID`
- selected Gemini command and prompt
- Gemini auth material
- telemetry endpoint config (standard OTEL env vars)

### Phases (AIB-629 — current)

1. Invoke Gemini headlessly (no `--output-format stream-json`).
2. Gemini CLI emits `gemini_cli.*` OTLP log records natively via `OTEL_EXPORTER_OTLP_ENDPOINT`.
3. Telemetry is processed in real-time by the OTLP endpoint — no post-execution collection needed.

### Environment requirements

- `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_RESOURCE_ATTRIBUTES` (includes `job_id`)

## Error behavior

- CLI/auth/install failures fail the workflow step.
- If OTLP emission fails silently, the job retains null metrics (missing-telemetry state) — no fabricated success.
