# Workflow Artifact: Gemini Native Usage Ingestion and Cost Estimation

## Workflow Definition

### Input

- native Gemini OTLP `gemini_cli.*` log events
- `job_id`
- selected Gemini model
- optional pricing lookup table

### Phases

1. Receive native OTLP log records from Gemini CLI
2. Correlate them to the workflow job using `job_id`
3. Aggregate cumulative native metrics:
   - model
   - input/output/cache tokens
   - tool names
   - wall-clock duration
4. Estimate cost when pricing exists
5. Update analytics-visible job fields on the correlated `Job`

### Environment requirements

- `JOB_ID`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- pricing metadata available to the runner or API layer

## Agent Command Specification

### Functional phases

- `gemini_cli.tool_call` / `gemini_cli.tool_result` events populate `toolsUsed`
- `gemini_cli.api_response` events populate usage and duration fields
- cost estimation happens inside the telemetry API when Gemini omits native cost

### Output format

- Standard OTLP HTTP JSON payload sent to `/api/telemetry/v1/logs`
- No reconstructed Gemini batch payload

## Callback / Reporting Contract

- Native telemetry delivery is non-authoritative relative to the workflow result
- Missing pricing must preserve usage metrics and set unavailable-cost semantics
- Job records stay analytics-visible even when cost is unavailable
