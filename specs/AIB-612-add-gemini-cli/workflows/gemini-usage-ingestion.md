# Workflow Artifact: Gemini Usage Ingestion and Cost Estimation

## Workflow Definition

### Input

- streamed Gemini CLI headless events
- `jobId`
- selected Gemini model
- optional pricing lookup table

### Phases

1. Read stream-json events
2. Aggregate:
   - model
   - input/output/cache tokens
   - tool names
   - wall-clock duration
3. Estimate cost when pricing exists
4. Post batch payload to telemetry API
5. Update analytics-visible job fields

### Environment requirements

- `JOB_ID`
- telemetry endpoint auth header
- pricing metadata available to the runner or API layer

## Agent Command Specification

### Functional phases

- `tool_use` / `tool_result` events populate `toolsUsed`
- final `result` event populates usage summary
- cost estimation happens outside the CLI using app-controlled pricing metadata

### Output format

```json
{
  "jobId": 456,
  "agent": "GEMINI",
  "model": "gemini-3-pro",
  "inputTokens": 1000,
  "outputTokens": 500,
  "toolsUsed": ["read_file", "shell"],
  "durationMs": 4200,
  "costStatus": "UNAVAILABLE"
}
```

## Callback / Reporting Contract

- Telemetry post is non-blocking relative to the workflow result
- Missing pricing must preserve usage metrics and set unavailable-cost semantics
- Job records stay analytics-visible even when cost is unavailable
