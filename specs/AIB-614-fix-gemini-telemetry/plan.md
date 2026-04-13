# Implementation Plan: Fix Gemini Telemetry (AIB-614)

**Branch**: `AIB-614-fix-gemini-telemetry`
**Spec**: `specs/AIB-614-fix-gemini-telemetry/spec.md`
**Created**: 2026-04-13

## Technical Context

| Aspect | Details |
|--------|---------|
| **Primary module** | `app/api/telemetry/v1/logs/route.ts` — telemetry endpoint |
| **Data model** | `prisma/schema.prisma` — Job model (add `thinkingTokens`) |
| **Analytics** | `lib/analytics/queries.ts`, `lib/analytics/types.ts`, analytics route + page |
| **Workflow** | `.github/scripts/run-agent.sh` — `collect_gemini_telemetry()` |
| **Tests** | `tests/integration/telemetry/agent-agnostic.test.ts`, `tests/integration/analytics/analytics-route.test.ts` |
| **Dependencies** | Prisma migration, no new packages |
| **Risk** | Low — additive changes only, existing agent telemetry paths untouched |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| TypeScript strict mode | PASS | All new code typed, no `any` |
| Security-first (Zod validation) | PASS | Batch schema extended with Zod, pricing lookup returns null for unknown models |
| Database integrity (Prisma migrations) | PASS | New nullable field via `prisma migrate dev` |
| Test-driven development | PASS | Extend existing test files, test cost estimation edge cases |
| No forbidden dependencies | PASS | No new packages |
| Error handling (structured responses) | PASS | Follow existing 401/400/404/500 pattern |

## Implementation Phases

### Phase 1: Database Schema — Add Thinking Tokens Field

**Files**:
- `prisma/schema.prisma` (line 49, after `cacheCreationTokens`)

**Changes**:
1. Add `thinkingTokens Int?` field to Job model (after `cacheCreationTokens`, before `costUsd`)
2. Run `bunx prisma migrate dev --name add-thinking-tokens`
3. Run `bunx prisma generate`

**Requirement coverage**: FR-005

---

### Phase 2: Gemini Pricing Table & Cost Estimation

**Files**:
- `app/api/telemetry/v1/logs/route.ts` (after `estimateMistralCost()`, ~line 374)

**Changes**:
1. Add `GEMINI_PRICING` record with models: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`
   - Pricing structure: `{ input, output, thinking, cached }` (per million tokens)
   - Default fallback: `gemini-2.5-flash` (most common)
   - Use prefix matching for model names (handle suffixes like `-preview-05-06`)
2. Add `estimateGeminiCost(model, inputTokens, outputTokens, thinkingTokens, cachedTokens)` function
   - Follow exact pattern from `estimateOpenAICost()` (route.ts:345-352)
   - Add thinking token term: `(thinkingTokens / 1_000_000) * pricing.thinking`
   - Return `null` if model not found (no fallback) — this implements FR-006
3. Extend `TelemetryMetrics` interface (route.ts:230-239) — add `thinkingTokens: number`
4. Update `createEmptyMetrics()` (route.ts:241-252) — add `thinkingTokens: 0`

**Requirement coverage**: FR-003, FR-004, FR-005, FR-006

---

### Phase 3: Telemetry Endpoint — Gemini Batch Processing

**Files**:
- `app/api/telemetry/v1/logs/route.ts`

**Changes**:
1. Extend `batchPayloadSchema` (route.ts:12-24) — add `thinkingTokens: z.number().int().nonnegative().optional()`
2. Update `processBatchPayload()` (route.ts:380-427):
   - Map `data.thinkingTokens` to `metrics.thinkingTokens`
   - Replace the Gemini cost skip logic (route.ts:413-414) with:
     ```typescript
     if (data.agent === 'GEMINI' && (metrics.inputTokens > 0 || metrics.outputTokens > 0)) {
       const cost = estimateGeminiCost(data.model ?? '', metrics.inputTokens, metrics.outputTokens, metrics.thinkingTokens, metrics.cacheReadTokens);
       if (cost !== null) metrics.costUsd = cost;
     }
     ```
3. Update `updateJobMetrics()` (route.ts:257-331):
   - Add `thinkingTokens` to the `select` clause (line 265)
   - Add accumulation: `thinkingTokens: (job.thinkingTokens || 0) + metrics.thinkingTokens`

**Requirement coverage**: FR-002, FR-004, FR-007, FR-009

---

### Phase 4: Workflow Script — Enhanced Telemetry Collection

**Files**:
- `.github/scripts/run-agent.sh` (lines 467-507, `collect_gemini_telemetry()`)

**Changes**:
1. Extract thinking tokens from stream-json:
   ```bash
   thinking_tokens=$(jq -rs '[.[] | .usage?.thinkingTokens? // .usage?.thinking_tokens? // 0] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
   ```
2. Extract cache tokens:
   ```bash
   cache_read_tokens=$(jq -rs '[.[] | .usage?.cacheReadTokens? // .usage?.cache_read_tokens? // 0] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
   cache_creation_tokens=$(jq -rs '[.[] | .usage?.cacheCreationTokens? // .usage?.cache_creation_tokens? // 0] | add // 0' "$GEMINI_STREAM_FILE" 2>/dev/null || echo "0")
   ```
3. Add new fields to the JSON payload:
   - `thinkingTokens`, `cacheReadTokens`, `cacheCreationTokens`
4. Remove `costStatus: "UNAVAILABLE"` from payload — server now determines cost availability

**Requirement coverage**: FR-001, FR-002, FR-005, FR-007

---

### Phase 5: Dynamic Agent Filter

**Files**:
- `app/api/projects/[projectId]/analytics/route.ts` (line 9)
- `app/projects/[projectId]/analytics/page.tsx` (line 16)
- `lib/analytics/queries.ts` (lines 213-218, 234)
- `lib/analytics/types.ts` (line 10-11)

**Changes**:
1. **Analytics route** (route.ts:9): Replace hardcoded Zod enum with dynamic derivation from Prisma `Agent` enum:
   ```typescript
   import { Agent } from '@prisma/client';
   const agentValues = ['all', ...Object.values(Agent)] as const;
   agent: z.enum(agentValues).default('all'),
   ```
2. **Analytics page** (page.tsx:16): Replace `VALID_AGENTS` Set with dynamic derivation:
   ```typescript
   import { Agent } from '@prisma/client';
   const VALID_AGENTS = new Set<AgentFilter>(['all', ...Object.values(Agent)]);
   ```
3. **Queries** (queries.ts:213-218): Initialize `counts` Map from `Agent` enum values instead of hardcoded array:
   ```typescript
   const counts = new Map<NamedAgent, number>(
     Object.values(Agent).map(a => [a as NamedAgent, 0])
   );
   ```
4. **Queries** (queries.ts:234): Replace hardcoded agent loop:
   ```typescript
   for (const agent of Object.values(Agent)) {
   ```
5. **Types** (types.ts:10): Keep `NamedAgent` type as-is for now — it mirrors the Prisma enum and changing it to a derived type would cascade widely. The hardcoded locations in queries/routes are the higher-priority targets.

**Requirement coverage**: FR-008

---

### Phase 6: Analytics — Thinking Tokens in Token Breakdown

**Files**:
- `lib/analytics/types.ts` — `TokenBreakdown` interface
- `lib/analytics/queries.ts` — `getTokenUsage()` function
- `components/analytics/token-usage-chart.tsx` — bar chart rendering

**Changes**:
1. Add `thinkingTokens: number` to `TokenBreakdown` interface
2. In `getTokenUsage()` query, aggregate `thinkingTokens` alongside other token types
3. In `token-usage-chart.tsx`, add a "Thinking" bar to the chart with appropriate color

**Requirement coverage**: FR-010

---

### Phase 7: Type Updates — Telemetry Interfaces

**Files**:
- `lib/types/job-types.ts` — `TicketJobWithTelemetry`
- `lib/types/comparison.ts` — `TicketTelemetry`
- `lib/comparison/telemetry-extractor.ts` — `aggregateJobTelemetry()`

**Changes**:
1. Add `thinkingTokens: number | null` to `TicketJobWithTelemetry`
2. Add `thinkingTokens: number` to `TicketTelemetry`
3. In `aggregateJobTelemetry()`, accumulate `thinkingTokens` from jobs

**Requirement coverage**: FR-002, FR-010

## Testing Strategy

### Extend: `tests/integration/telemetry/agent-agnostic.test.ts`

Add a new `describe('Gemini Telemetry')` block with:

| Test | Verifies |
|------|----------|
| Gemini batch payload with known model → cost estimated | FR-003, FR-004 |
| Gemini batch payload with unknown model → cost null | FR-006 |
| Gemini batch payload with thinking tokens → thinkingTokens accumulated | FR-005 |
| Gemini batch payload without thinking tokens → defaults to 0 | Backward compat |
| Gemini batch payload with explicit costUsd → uses provided cost | FR-004 |
| Multiple Gemini batches for same job → metrics accumulate | Accumulation pattern |

### Extend: `tests/integration/analytics/analytics-route.test.ts`

| Test | Verifies |
|------|----------|
| Agent filter with only Claude+Gemini jobs → only those agents in `availableAgents` | FR-008 |
| Token breakdown includes thinking tokens when Gemini jobs present | FR-010 |

### Unit Tests (New): `tests/unit/telemetry/gemini-cost.test.ts`

| Test | Verifies |
|------|----------|
| `estimateGeminiCost()` with known model → correct calculation | FR-004 |
| `estimateGeminiCost()` with unknown model → returns null | FR-006 |
| `estimateGeminiCost()` with prefix match (e.g., `gemini-2.5-pro-preview`) → matches | Robustness |
| `estimateGeminiCost()` with zero thinking tokens → no thinking cost added | FR-005 |
| Cost formula accuracy for each supported model | FR-003 |

## Dependency Order

```
Phase 1 (DB Schema)
  ↓
Phase 2 (Pricing + Estimation)
  ↓
Phase 3 (Batch Processing) ← depends on Phase 2
  ↓
Phase 4 (Workflow Script) ← independent, can parallel with Phase 5-7
Phase 5 (Dynamic Agent Filter) ← independent
Phase 6 (Analytics Token Breakdown) ← depends on Phase 1
Phase 7 (Type Updates) ← depends on Phase 1
```

## Non-Goals (Explicitly Out of Scope)

- Native OTLP push from Gemini CLI (deferred until CLI supports OTEL env vars)
- Real-time streaming telemetry during execution (current post-execution batch is sufficient)
- Backfilling cost for historical Gemini jobs (would require re-running pricing against stored tokens)
- Gemini-specific analytics charts (Gemini uses the same charts as all other agents)
