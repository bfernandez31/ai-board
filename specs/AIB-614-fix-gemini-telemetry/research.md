# Research: Fix Gemini Telemetry (AIB-614)

## Existing Files

### Telemetry & Cost Estimation

| Path | Covers | Action |
|------|--------|--------|
| `app/api/telemetry/v1/logs/route.ts` | OTLP + batch telemetry endpoint, Claude/Codex parsing, Mistral/Gemini batch processing, OpenAI & Mistral pricing tables, cost estimation | **Extend** — add Gemini pricing table, `estimateGeminiCost()`, thinking token parsing, native OTLP Gemini event handling |
| `lib/schemas/otlp.ts` | OTLP schema, attribute helpers (`findAttribute`, `parseIntAttribute`, `parseFloatAttribute`) | **Reuse as-is** — no changes needed |
| `prisma/schema.prisma` (Job model, lines 29-67) | Job fields: inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed | **Extend** — add `thinkingTokens Int?` field |

### Analytics

| Path | Covers | Action |
|------|--------|--------|
| `lib/analytics/queries.ts` (lines 189-247) | `getAvailableAgents()` — dynamically queries agents with jobs, but iterates over hardcoded array `['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']` | **Modify** — derive agent list from Prisma Agent enum or query results instead of hardcoded array |
| `lib/analytics/types.ts` | `NamedAgent`, `AgentFilter`, `AgentOption`, `TokenBreakdown` types | **Extend** — add `thinkingTokens` to `TokenBreakdown` if displayed in analytics |
| `lib/analytics/aggregations.ts` (lines 114-127) | `getAgentLabel()` switch — maps agent string to display label | **Reuse as-is** — Gemini already mapped |
| `app/api/projects/[projectId]/analytics/route.ts` (line 9) | Zod validation schema — hardcoded agent enum `['all', 'CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']` | **Modify** — make dynamic or derive from Prisma enum |
| `app/projects/[projectId]/analytics/page.tsx` (line 16) | `VALID_AGENTS` Set — hardcoded for search param validation | **Modify** — derive from Prisma enum or shared constant |
| `components/analytics/analytics-dashboard.tsx` | Dashboard UI — agent filter dropdown already dynamic from `availableAgents` | **Reuse as-is** — no changes needed |
| `components/analytics/token-usage-chart.tsx` | Token usage bar chart (input, output, cache) | **Extend** — add thinking tokens category |

### Workflow & Agent Scripts

| Path | Covers | Action |
|------|--------|--------|
| `.github/scripts/run-agent.sh` (lines 434-507) | `invoke_gemini()` — runs Gemini CLI with stream-json output; `collect_gemini_telemetry()` — post-execution scraping, sends batch payload with `costStatus: UNAVAILABLE` | **Extend** — add thinking token extraction from stream-json, add cache token extraction |
| `.github/workflows/speckit.yml` (lines 192-202) | OTLP env vars for Claude/Codex (OTEL_EXPORTER_OTLP_ENDPOINT, etc.) | **Extend** — set same OTLP env vars for Gemini agent invocations if Gemini CLI supports native OTLP |
| `app/lib/utils/agent-resolution.ts` | Agent resolution, supported commands, GEMINI_SUPPORTED_COMMANDS | **Reuse as-is** |

### Comparison & Display

| Path | Covers | Action |
|------|--------|--------|
| `lib/comparison/telemetry-extractor.ts` | `aggregateJobTelemetry()`, `calculateTotalTokens()` | **Extend** — include thinkingTokens in aggregation |
| `lib/types/job-types.ts` | `TicketJobWithTelemetry` interface | **Extend** — add `thinkingTokens` field |
| `lib/types/comparison.ts` | `TicketTelemetry` interface | **Extend** — add `thinkingTokens` field |

### Tests

| Path | Covers | Action |
|------|--------|--------|
| `tests/integration/telemetry/agent-agnostic.test.ts` (468 lines) | Claude, Codex, Mistral telemetry tests | **Extend** — add Gemini batch telemetry tests, Gemini cost estimation tests, thinking token tests |
| `tests/integration/analytics/analytics-route.test.ts` (370 lines) | Analytics endpoint, agent filtering, range filtering | **Extend** — add test for dynamic agent filter (only agents with data appear) |
| `tests/unit/telemetry/otlp-schema.test.ts` | OTLP schema validation | **Reuse as-is** — no changes needed |

## Patterns to Follow

### Cost Estimation Pattern (telemetry route.ts, lines 338-374)

All cost estimation follows the same structure:
1. Define a `PRICING` record mapping model names to `{ input, output, cached }` rates (per million tokens)
2. Define an `estimate<Agent>Cost()` function that:
   - Looks up model in pricing table, falls back to a default model
   - Calculates: `(tokens / 1_000_000) * rate` for each category
   - Returns total cost as a number
3. In `processBatchPayload()`, call the estimator when `agent === '<AGENT>'` and no explicit `costUsd` provided

**Gemini addition**: The pricing record must include a `thinking` rate (new category). The `estimateGeminiCost()` function must handle 5 categories: input, output, thinking, cacheRead, cacheCreation.

### Batch Payload Processing Pattern (telemetry route.ts, lines 380-427)

The `processBatchPayload()` function:
1. Validates with `batchPayloadSchema`
2. Creates empty metrics via `createEmptyMetrics()`
3. Maps batch fields to metrics
4. Applies cost estimation based on agent type
5. Calls `updateJobMetrics()` to persist

**For Gemini**: Add `thinkingTokens` to batch schema, map to metrics, call `estimateGeminiCost()` when `agent === 'GEMINI'` and tokens are present.

### Metrics Accumulation Pattern (telemetry route.ts, lines 257-331)

The `updateJobMetrics()` function:
1. Fetches current job from DB
2. Accumulates each metric: `(existing || 0) + new`
3. Merges tool lists with deduplication
4. Conditionally sets costUsd and model
5. Returns updated job summary

**For Gemini**: Must also accumulate `thinkingTokens`.

### Error Handling Pattern (telemetry route.ts)

- Authentication failure → 401 (line 66)
- JSON parse failure → 400 (line 79)
- Schema validation failure → 400 with logged details (line 110)
- Job not found → 404 (line 279)
- Unexpected error → 500 with context logging (line 216)
- No job_id → 200 accepted but not stored (line 200)

**For Gemini cost**: If model not in pricing table, cost remains null (unavailable) — do NOT estimate with wrong rates (FR-006).

### Dynamic Agent Filter Pattern

The `getAvailableAgents()` function (queries.ts:189-247) already queries the DB for agents with jobs. The hardcoded iteration at line 234 `['CLAUDE', 'CODEX', 'MISTRAL', 'GEMINI']` can be replaced by iterating over the keys from the `counts` Map (which is populated from actual query results). This eliminates the need to update the array when new agents are added.

For API validation (route.ts:9) and page validation (page.tsx:16), the Zod schema can use `z.nativeEnum(Agent)` from Prisma or a shared constant derived from the Prisma enum, ensuring the validation stays in sync with the data model.

## Key Decisions

### Decision 1: Gemini Cost Estimation Approach
- **Decision**: Server-side estimation from pricing table (same as Codex/Mistral)
- **Rationale**: Gemini CLI does not report cost_usd in telemetry. Server-side estimation with known pricing allows accurate cost tracking. Matches established pattern.
- **Alternatives considered**: (a) Client-side estimation — rejected, inconsistent with other agents. (b) No estimation — rejected, defeats purpose of the ticket.

### Decision 2: Thinking Tokens — New Database Field
- **Decision**: Add `thinkingTokens Int?` to Job model in Prisma schema
- **Rationale**: Thinking tokens have different pricing than output tokens (FR-005). Conflating them would produce incorrect cost estimates. The field is nullable for backward compatibility with existing jobs.
- **Alternatives considered**: (a) Store in JSON metadata field — rejected, loses queryability and type safety. (b) Map to outputTokens — rejected, violates FR-005.

### Decision 3: Gemini Pricing Table Structure
- **Decision**: Add `GEMINI_PRICING` with 5-tier structure: `{ input, output, thinking, cached, cacheCreation }`
- **Rationale**: Gemini has distinct pricing for thinking tokens (unlike Claude where cost is reported directly). Cache read and creation may also differ. Extending the existing 3-tier pattern to 5 tiers.
- **Alternatives considered**: Using the same 3-tier structure — rejected, cannot price thinking tokens separately.

### Decision 4: Native OTLP vs Enhanced Post-Execution Scraping
- **Decision**: Enhance post-execution scraping to extract thinking tokens, cache tokens, and estimate cost. Native OTLP support deferred until Gemini CLI confirms OTEL env var support.
- **Rationale**: Gemini CLI currently uses `--output-format stream-json`, not native OTLP. The existing `collect_gemini_telemetry()` function in run-agent.sh already works. Enhancing it to extract additional fields (thinking tokens, cache tokens) and removing `costStatus: UNAVAILABLE` when pricing is available is the conservative, reliable approach.
- **Alternatives considered**: Implementing a proxy adapter to convert stream-json to OTLP in real-time — rejected, over-engineering for current state. Can be added later if Gemini CLI adds native OTLP.

### Decision 5: Dynamic Agent Filter Implementation
- **Decision**: Derive agent options from Prisma `Agent` enum for validation, and from DB query results for UI options
- **Rationale**: Prisma enum is the source of truth. Using `z.nativeEnum(Agent)` in Zod schemas eliminates hardcoded arrays. The `getAvailableAgents()` query already filters to agents with actual job data.
- **Alternatives considered**: Fully dynamic from DB only — rejected, validation schemas still need a known set for type safety.
