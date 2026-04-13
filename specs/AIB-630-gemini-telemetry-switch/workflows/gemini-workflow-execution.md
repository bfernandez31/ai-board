# Workflow Artifact: Gemini Workflow Execution

## Workflow Definition

### Input

- `JOB_ID`
- selected Gemini command and prompt
- `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`
- OTLP endpoint configuration for the workflow environment

### Phases

1. Install Gemini CLI when missing.
2. Restore Gemini auth material in the runner environment.
3. Enable Gemini's official native telemetry export to the platform OTLP endpoint.
4. Invoke Gemini in standard execution mode, not `--output-format stream-json`.
5. Propagate the Gemini process exit code back to the workflow.
6. Send terminal job status through `/api/jobs/[id]/status`.

### Environment requirements

- `JOB_ID`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_RESOURCE_ATTRIBUTES` including `job_id`
- `GEMINI_API_KEY` or `GEMINI_OAUTH_JSON`

## Agent Command Specification

### Functional phases

- Runner configures native telemetry before invoking Gemini.
- Gemini emits `gemini_cli.*` OTLP events during execution.
- Runner does not parse Gemini stdout to reconstruct telemetry.

### Output format

- Standard Gemini command output for workflow artifacts
- Native OTLP log events delivered out-of-band to `/api/telemetry/v1/logs`

## Error Behavior

- Install/auth/invocation failures fail the workflow step.
- Telemetry delivery must remain non-authoritative for success/failure; workflow status callback still reports terminal state.
- Missing telemetry does not trigger a fallback batch reconstruction path.
