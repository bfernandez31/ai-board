# Workflow Artifact: Provider-Specific Telemetry Routing

## Workflow Definition

### Input

- Incoming telemetry request to `POST /api/telemetry/v1/logs`

### Phases

1. Distinguish OTLP payloads from non-OTLP batch JSON.
2. Within the OTLP branch, dispatch by event family:
   - `claude_code.*`
   - `codex.*`
   - `gemini_cli.*`
3. Within the non-OTLP branch, process only the Mistral batch contract.
4. Persist normalized telemetry to the correlated `Job`.

## Provider Rules

- Claude: existing OTLP handling unchanged.
- Codex: existing OTLP handling unchanged.
- Gemini: first-class OTLP handling via native provider events.
- Mistral: existing batch JSON handling unchanged.

## Output Contract

- Provider-correct telemetry processing with no cross-provider fallback.
- Gemini no longer shares Mistral's batch-only normalization path.

## Error Behavior

- Unsupported provider payloads fail safely and do not mutate unrelated jobs.
- Gemini batch-shaped payloads are not treated as a supported Gemini path after this change.
