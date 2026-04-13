# Workflow Artifact: Gemini OTLP Intake and Normalization

**Replaces**: `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-telemetry-intake.md`

## Process Definition

### Trigger

Gemini OTLP events arrive at `POST /api/telemetry/v1/logs` during workflow execution.

### Detection

Gemini events are identified by event name prefix `gemini_cli.*` in the OTLP log record body:
- `gemini_cli.api_response` — token/model/duration data
- `gemini_cli.tool_call` — tool invocation
- `gemini_cli.tool_result` — tool completion

This is positive identification (not exclusion-based). Events that don't match any known agent pattern (Claude, Codex, Gemini) are silently skipped.

### Processing Flow

```
OTLP payload arrives
  → Validate OTLP schema (existing)
  → Extract job_id from resource attributes (existing)
  → For each logRecord:
      → Extract event name from body.stringValue
      → IF gemini_cli.api_response:
          → Parse input_tokens, output_tokens, thinking_tokens,
            cache_read_tokens, cache_creation_tokens, duration_ms, model
          → Accumulate into TelemetryMetrics (summation / DELTA)
          → Set geminiCostModel for server-side cost estimation
      → IF gemini_cli.tool_call OR gemini_cli.tool_result:
          → Extract tool_name → add to toolsUsed set
  → Merge with existing job data (DELTA mode)
  → Estimate Gemini cost from merged totals (tier-2 threshold aware)
  → Persist to Job record
```

### Key Differences from Batch Intake (AIB-626)

| Aspect | Batch Intake (removed) | OTLP Intake (new) |
|--------|------------------------|---------------------|
| Payload format | Custom JSON with pre-aggregated metrics | Standard OTLP resourceLogs |
| Timing | Post-execution (single payload) | Real-time (multiple batches during execution) |
| Merge mode | CUMULATIVE (replace with max) | DELTA (accumulate by sum) |
| Input token normalization | Subtract cacheReadTokens from inputTokens | Not needed — Gemini CLI reports non-cached input directly in OTLP |
| Cost estimation | Triggered by `costStatus` field in payload | Always triggered when geminiCostModel is set from OTLP model attribute |

### Error Behavior

- Invalid OTLP schema → 400 (existing behavior)
- Missing job_id → 200 accepted, not stored (existing behavior)
- Unknown event names → silently skipped (existing behavior)
- Unknown Gemini model → all metrics stored, cost remains null
- Partial events → available fields updated, no overwrite of existing data

## Batch Handler Simplification

After removing Gemini from the batch path:

### Remove from `processBatchPayload()`

1. `agent === 'GEMINI'` input token normalization (line 561)
2. `agent === 'GEMINI'` cost estimation branch (lines 566-568)
3. `usageSnapshotMode` handling — always use DELTA (line 581)

### Remove from `batchPayloadSchema`

1. `agent` field — batch is Mistral-only
2. `usageSnapshotMode` field — always DELTA

### Keep in `batchPayloadSchema`

All other fields remain for Mistral compatibility. The `thinkingTokens`, `cacheCreationTokens`, and `costStatus` fields stay as optional for forward compatibility.
