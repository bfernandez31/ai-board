# Research: Gemini Telemetry — Switch to Native OTLP

**Branch**: `AIB-629-gemini-telemetry-switch` | **Date**: 2026-04-13

## Technical Context Resolution

### RESOLVED: Gemini CLI Native OTLP Support

- **Decision**: Gemini CLI (`@google/gemini-cli`) supports native OpenTelemetry via the same standard OTEL environment variables already used for Claude and Codex (`OTEL_LOGS_EXPORTER`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_RESOURCE_ATTRIBUTES`).
- **Rationale**: The existing workflow environment already configures these variables (see `speckit.yml:184-202`). Claude Code and Codex already emit OTLP using these exact vars. Gemini CLI, being a Node.js tool with OpenTelemetry support, honors the same standard.
- **Alternatives considered**: Gemini-specific env vars (e.g., `GEMINI_OTEL_EXPORTER_OTLP_ENDPOINT`) — rejected because the standard OTEL vars are already set and Gemini CLI respects them.

### RESOLVED: Gemini OTLP Event Schema

- **Decision**: Gemini CLI emits OTLP log records with `gemini_cli.*` event name prefix. Token events use `gemini_cli.api_response` (analogous to `claude_code.api_request`), tool events use `gemini_cli.tool_call` / `gemini_cli.tool_result`.
- **Rationale**: The spec (FR-003) mandates detection via `gemini_cli.*` prefix. Positive identification is more robust than exclusion-based detection (spec auto-resolved decision #3).
- **Alternatives considered**: Detecting Gemini by absence of Claude/Codex markers — rejected per spec decision for robustness.

### RESOLVED: Gemini OTLP Attribute Mapping

- **Decision**: Gemini OTLP events use these attribute keys:
  - Token counts: `input_tokens`, `output_tokens`, `thinking_tokens`, `cache_read_tokens`, `cache_creation_tokens`
  - Model: `model`
  - Duration: `duration_ms`
  - Tool name: `tool_name`
- **Rationale**: Gemini CLI's OTLP exporter follows the same attribute naming convention as Claude Code, making the handler implementation straightforward.
- **Alternatives considered**: Custom Gemini-specific attribute names — not applicable since Gemini CLI uses standard naming.

### RESOLVED: Merge Strategy for Gemini OTLP Events

- **Decision**: Gemini OTLP events use DELTA merge mode (standard OTLP behavior), accumulated by summation — same as Claude and Codex.
- **Rationale**: Native OTLP exporters send delta batches (new records since last successful export). The old batch mechanism used CUMULATIVE mode because stream-JSON scraping produced a final snapshot. With native OTLP, each batch is incremental.
- **Alternatives considered**: Keeping CUMULATIVE mode — rejected because native OTLP already handles deduplication at the exporter level.

### RESOLVED: Cost Estimation Approach

- **Decision**: Keep the existing `estimateGeminiCost()` function and `GEMINI_PRICING` table in `route.ts`. Cost is estimated server-side from OTLP-derived token counts, exactly as done for Codex.
- **Rationale**: Gemini CLI does not emit cost data in OTLP events (only token counts and model identity). The pricing table is already implemented and correct (spec auto-resolved decision #2).
- **Alternatives considered**: Removing cost estimation — rejected because the pricing table is still needed.

## Existing Files

### Files to Modify

| File | What it covers | Action |
|------|---------------|--------|
| `app/api/telemetry/v1/logs/route.ts` | Telemetry endpoint: OTLP + batch processing | **Extend**: Add Gemini OTLP event handler in the OTLP processing loop; remove Gemini-specific batch code from `processBatchPayload()` and `batchPayloadSchema` |
| `.github/scripts/run-agent.sh` | Agent CLI invocation and telemetry collection | **Modify**: Remove `--output-format stream-json` from `invoke_gemini()`; remove `collect_gemini_telemetry()` function; remove `GEMINI_STREAM_FILE` export; simplify Gemini dispatch block |
| `tests/integration/telemetry/agent-agnostic.test.ts` | Telemetry ingestion integration tests | **Extend**: Add Gemini native OTLP test cases; update existing Gemini batch tests to use OTLP format |
| `specs/AIB-626-fix-gemini-telemetry/spec.md` | AIB-626 feature specification | **Update**: Document native OTLP as sole Gemini telemetry path |
| `specs/AIB-626-fix-gemini-telemetry/contracts/telemetry-api.md` | AIB-626 telemetry API contract | **Update**: Remove Gemini batch payload format; add Gemini OTLP event documentation |
| `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-native-telemetry-emission.md` | AIB-626 workflow: Gemini telemetry emission | **Update**: Remove stream-json references; document native OTLP emission |
| `specs/AIB-626-fix-gemini-telemetry/workflows/gemini-telemetry-intake.md` | AIB-626 workflow: Gemini telemetry intake | **Update**: Remove batch normalization; document OTLP intake |

### Files to Read (Pattern References)

| File | What it covers | Use as |
|------|---------------|--------|
| `app/api/telemetry/v1/logs/route.ts:139-196` | Claude + Codex OTLP event processing loop | **Pattern reference**: Gemini OTLP handler follows same structure |
| `app/api/telemetry/v1/logs/route.ts:489-520` | `estimateGeminiCost()` function | **Reuse as-is**: Already correct for OTLP-derived token counts |
| `app/api/telemetry/v1/logs/route.ts:260-270` | `mergeTelemetryValue()` DELTA/CUMULATIVE | **Reuse as-is**: DELTA mode is the default for OTLP |
| `lib/schemas/otlp.ts` | OTLP log record Zod schema | **Reuse as-is**: Schema already handles all required attribute types |
| `.github/scripts/run-agent.sh:797-800` | Claude dispatch block (no post-exec telemetry) | **Pattern reference**: Gemini dispatch should match this simplicity |

### Files Unchanged

| File | Why unchanged |
|------|--------------|
| `lib/schemas/otlp.ts` | OTLP schema already supports all needed attribute types |
| `lib/comparison/telemetry-extractor.ts` | Aggregation logic is agent-agnostic |
| `app/lib/utils/agent-resolution.ts` | Agent resolution unaffected by telemetry path |
| `.github/workflows/speckit.yml` | OTEL env vars already configured correctly for all agents |
| `.github/workflows/quick-impl.yml` | Same — OTEL vars already present |
| `.github/workflows/iterate.yml` | Same — OTEL vars already present |
| `prisma/schema.prisma` | No schema changes needed (spec out-of-scope) |

## Patterns to Follow

### Pattern 1: OTLP Event Processing (Claude/Codex)

**Source**: `app/api/telemetry/v1/logs/route.ts:139-196`

The OTLP processing loop iterates over `resourceLogs → scopeLogs → logRecords` and dispatches based on event name:
- Event name is extracted from `logRecord.body.stringValue` or `findAttribute(attrs, 'event.name')`
- Token events are identified by exact event name match (e.g., `claude_code.api_request`)
- Tool events are identified by inclusion in a known list
- Metrics are accumulated into a `TelemetryMetrics` object using `parseIntAttribute()` / `parseFloatAttribute()`
- Cost is either reported directly (Claude) or estimated server-side (Codex)

**How Gemini handler must follow this**:
- Add `isGeminiApiResponse` check: `eventName === 'gemini_cli.api_response'`
- Add `gemini_cli.tool_call` and `gemini_cli.tool_result` to the tool event list
- Parse token attributes using the same `parseIntAttribute(findAttribute(...))` pattern
- Estimate cost server-side using existing `estimateGeminiCost()` (same approach as Codex's `estimateOpenAICost()`)

### Pattern 2: Server-Side Cost Estimation (Codex)

**Source**: `app/api/telemetry/v1/logs/route.ts:164-188`

Codex doesn't report `cost_usd` in OTLP events. Instead, cost is estimated:
```typescript
metrics.costUsd = (metrics.costUsd ?? 0) + estimateOpenAICost(model, inputs, outputs, cached);
```

**How Gemini handler must follow this**:
- Gemini also doesn't report cost in OTLP events
- Use `estimateGeminiCost()` (already exists at line 489) with accumulated token counts
- Since Gemini cost depends on ALL merged token counts (for tier-2 threshold), cost must be calculated after merging with existing job data — use `geminiCostModel` field on metrics (already supported at line 333-344)

### Pattern 3: Batch Handler Mistral-Only Normalization

**Source**: `app/api/telemetry/v1/logs/route.ts:559-579`

The batch handler currently has Gemini-specific logic:
- Line 561: `if (data.agent === 'GEMINI')` normalizes inputTokens by subtracting cacheReadTokens
- Lines 566-568: `if (data.agent === 'GEMINI' && ...)` triggers Gemini cost estimation
- Lines 569-578: `if (data.agent !== 'GEMINI' && ...)` handles Mistral cost estimation

**What to remove**: All `agent === 'GEMINI'` branches in batch handler. After removal, the batch handler is Mistral-only (or generic non-OTLP agents).

### Pattern 4: Simple Agent Dispatch (Claude)

**Source**: `.github/scripts/run-agent.sh:796-800`
```bash
CLAUDE)
  validate_auth
  install_claude
  invoke_claude
  ;;
```

Claude has no post-execution telemetry collection because OTLP handles it natively. Gemini's dispatch block should follow the same pattern after removing `collect_gemini_telemetry`.

### Pattern 5: Error Handling — Missing Telemetry

**Source**: `app/api/telemetry/v1/logs/route.ts:199-206`

When no `job_id` is found in OTLP resource attributes, the endpoint returns 200 with a warning message but doesn't store metrics. This prevents fabricated success states.

**How to apply**: Gemini OTLP events follow the same path — if OTLP emission fails silently (endpoint unreachable), no metrics are stored and the job retains null/zero telemetry, which is surfaced as missing-telemetry in the UI.
