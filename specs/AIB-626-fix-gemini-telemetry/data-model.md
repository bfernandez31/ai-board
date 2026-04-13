# Data Model: Gemini Native Telemetry and Cost Estimation

## Entity Impacts

### Job Telemetry Record

- Backed by: `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` `Job`
- Existing fields already used:
  - `inputTokens`
  - `outputTokens`
  - `cacheReadTokens`
  - `cacheCreationTokens`
  - `durationMs`
  - `costUsd`
  - `model`
  - `toolsUsed`
- Required design change:
  - Add explicit support for Gemini thinking-token storage so thinking is not collapsed into cache or output metrics.
  - Preserve nullable `costUsd` for unknown-price models.
  - Keep tool usage as a deduplicated string array.

### Gemini Usage Breakdown

- Purpose: normalized per-job token categories emitted by Gemini native telemetry
- Fields:
  - `inputTokens: Int`
  - `outputTokens: Int`
  - `thinkingTokens: Int`
  - `cacheReadTokens: Int`
  - `cacheCreationTokens: Int`
- Validation rules:
  - All usage categories are non-negative integers.
  - Missing categories are stored as `0` or `null` according to the final schema choice, but never merged into another category.
  - Repeated events must not cause the same terminal result payload to be counted twice.

### Gemini Pricing Rule

- Backed by: server-side pricing constants in telemetry normalization code
- Fields:
  - `modelFamily`
  - `inputRatePerMillion`
  - `outputRatePerMillion`
  - `thinkingRatePerMillion`
  - `cacheReadRatePerMillion`
  - `cacheWriteRatePerMillion` or explicit statement that cache creation is non-billable
  - `availabilityStatus`
- Validation rules:
  - Must exist for Gemini 2.5 Pro, 2.5 Flash, and 2.0 Flash families.
  - Unsupported models leave `costUsd` unavailable.

### Agent Type

- Backed by:
  - `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma` enum `Agent`
  - `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts`
  - `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`
- Relevant rule:
  - Analytics filter options must be derived from the shared supported-agent source plus project history, not from a duplicate hardcoded list in analytics code.

### Analytics Filter Option

- Backed by: `AgentOption` in `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`
- Fields:
  - `value`
  - `label`
  - `jobCount`
  - `isDefault`
- Validation rules:
  - `all` is always present.
  - Agent-specific options appear only when the project has relevant job history.
  - The option source must remain consistent with the authoritative supported-agent definitions.

## Relationships

- `Job` belongs to one `Ticket`; effective agent is `ticket.agent ?? project.defaultAgent`.
- One `Gemini Pricing Rule` applies to a job based on the normalized model family.
- One analytics response includes zero or more `Analytics Filter Option` entries derived from supported agent definitions and project history.

## State Transitions

### Gemini run telemetry emission

1. Gemini workflow starts and writes native `stream-json` events to `GEMINI_STREAM_FILE`.
2. Runner extracts model, tool use, duration, and usage categories.
3. Runner posts a normalized Gemini batch payload to `/api/telemetry/v1/logs`.

### Gemini telemetry intake and normalization

1. Route validates workflow auth and payload shape.
2. Route verifies the referenced `Job` exists.
3. Route normalizes Gemini categories into shared job telemetry fields.
4. Route merges tool sets and delta usage without double-counting repeated final events.
5. Route persists the updated job telemetry record.

### Gemini cost estimation

1. Route resolves Gemini model family from the normalized model string.
2. If a pricing rule exists, it calculates category-level cost contributions.
3. If no pricing rule exists, it leaves `costUsd` unavailable and preserves recorded usage.

## Validation Matrix

| Scenario | Expected stored behavior |
|----------|--------------------------|
| Gemini emits input/output only | Persist available categories; missing thinking/cache remain empty without fabrication |
| Gemini emits input/output/thinking/cache | Persist all categories distinctly |
| Gemini model is unsupported | Persist usage and tools; keep `costUsd` unavailable |
| Gemini telemetry arrives late | Merge against existing job if job exists; preserve duration fallback behavior |
| Gemini final payload is repeated | Do not double-count previously applied usage |
