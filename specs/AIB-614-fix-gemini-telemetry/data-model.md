# Data Model: Fix Gemini Telemetry (AIB-614)

## Schema Changes

### Job Model — New Field

```prisma
model Job {
  // ... existing fields ...
  thinkingTokens      Int?  // Total thinking/reasoning tokens (Gemini thinking mode)
  // ... rest unchanged ...
}
```

**Migration**: Add nullable `thinkingTokens Int?` column to `Job` table. No default value needed — existing rows remain `NULL`. No data backfill required.

**Validation**: `z.number().int().nonnegative().optional()` in batch payload schema.

## New Data Structures (In-Code, Not Persisted)

### Gemini Pricing Table

```typescript
const GEMINI_PRICING: Record<string, {
  input: number;      // per million tokens
  output: number;     // per million tokens
  thinking: number;   // per million tokens
  cached: number;     // per million tokens (cache read)
}> = {
  'gemini-2.5-pro':   { input: 1.25, output: 10.00, thinking: 3.75, cached: 0.3125 },
  'gemini-2.5-flash': { input: 0.15, output: 0.60,  thinking: 0.45, cached: 0.0375 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40,  thinking: 0.00, cached: 0.025  },
};
```

**Notes**:
- Prices are per-million-token rates from Google AI pricing (to be verified at implementation time)
- `gemini-2.0-flash` has `thinking: 0.00` — model does not support thinking mode
- Default fallback: `gemini-2.5-flash` (most commonly used)
- Model name matching should be prefix-based to handle version suffixes (e.g., `gemini-2.5-pro-preview-05-06`)

### TelemetryMetrics Extension

```typescript
interface TelemetryMetrics {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;       // NEW
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number | null;
  durationMs: number;
  model: string | null;
  toolsUsed: Set<string>;
}
```

### Batch Payload Schema Extension

```typescript
const batchPayloadSchema = z.object({
  // ... existing fields ...
  thinkingTokens: z.number().int().nonnegative().optional(),  // NEW
  // ... rest unchanged ...
});
```

## Entity Relationships

No new entities or relationships. Changes are additive to the existing `Job` model.

## State Transitions

No new state transitions. The `Job.status` lifecycle remains unchanged. The new `thinkingTokens` field is populated during telemetry accumulation (same as other token fields).

## Validation Rules

| Field | Rule | Source |
|-------|------|--------|
| `thinkingTokens` | Non-negative integer, nullable | FR-005 |
| Gemini model in pricing table | Cost estimated; model not found → cost `null` | FR-006 |
| Gemini batch payload | Must include `agent: 'GEMINI'` for cost estimation | Batch schema |
