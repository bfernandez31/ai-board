# Data Model: Gemini Telemetry — Switch to Native OTLP

**Branch**: `AIB-629-gemini-telemetry-switch` | **Date**: 2026-04-13

## Entities

### No New Entities

This feature does not introduce new database tables or fields. The existing `Job` model already has all required columns:

| Field | Type | Purpose |
|-------|------|---------|
| `inputTokens` | `Int?` | Non-cached input tokens |
| `outputTokens` | `Int?` | Output tokens |
| `thinkingTokens` | `Int?` | Thinking/reasoning tokens |
| `cacheReadTokens` | `Int?` | Cache read tokens |
| `cacheCreationTokens` | `Int?` | Cache creation tokens |
| `costUsd` | `Float?` | Estimated cost in USD |
| `durationMs` | `Int?` | Execution duration |
| `model` | `String?` | Model identity |
| `toolsUsed` | `String[]` | Tool names used |

These fields are populated identically regardless of telemetry path (OTLP or batch). The migration changes only _how_ data arrives, not _what_ is stored.

## Modified In-Memory Structures

### TelemetryMetrics (route.ts)

No changes to the `TelemetryMetrics` interface. The existing fields and `geminiCostModel` property already support OTLP-derived Gemini telemetry:

```typescript
interface TelemetryMetrics {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number | null;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number | null;
  durationMs: number;
  model: string | null;
  toolsUsed: Set<string>;
  geminiCostModel?: string | null;  // Used for server-side Gemini cost estimation
}
```

### Batch Payload Schema (route.ts)

The `batchPayloadSchema` Zod schema will be simplified:

**Remove**: `agent` field (no longer needed to distinguish Gemini from Mistral in batch path)
**Remove**: `usageSnapshotMode` field (Mistral uses DELTA by default; CUMULATIVE was Gemini-specific)
**Keep**: All other fields for Mistral batch compatibility

After migration, the batch path is Mistral-only. The `agent` discriminator and `usageSnapshotMode` fields are no longer needed.

## State Transitions

No changes to job state transitions. The telemetry endpoint is called during `RUNNING` state and updates metrics on the job record. The transition from `RUNNING` → `COMPLETED`/`FAILED` happens independently via the job status endpoint.

## Validation Rules

- Gemini OTLP events are identified by `gemini_cli.*` event name prefix (positive identification)
- Token counts from OTLP are always non-negative integers (enforced by `parseIntAttribute()`)
- Gemini cost estimation requires a recognized model from `GEMINI_PRICING` table; unknown models get `costUsd = null`
- OTLP events without a `job_id` resource attribute are accepted but not stored (existing behavior)
