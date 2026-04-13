# Workflow Artifact: Gemini Native Telemetry Emission

## Workflow Definition

### Input

- `JOB_ID`
- selected Gemini command and prompt
- Gemini auth material
- telemetry endpoint config

### Phases

1. Invoke Gemini headlessly with `--output-format stream-json`.
2. Write streamed events to `GEMINI_STREAM_FILE`.
3. Preserve Gemini exit code independently from telemetry export.
4. Pass the captured stream to the Gemini telemetry normalization step.

### Environment requirements

- `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `JOB_ID`

## Error behavior

- CLI/auth/install failures fail the workflow step.
- Telemetry export remains non-blocking after command execution.
- Missing telemetry must remain explicit; the workflow must not fabricate complete metrics from partial stream output.
