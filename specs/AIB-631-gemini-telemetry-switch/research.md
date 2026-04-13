# Research: Gemini Telemetry OTLP Migration

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js 22.20.0  
**Primary Dependencies**: Next.js 16, Prisma 6.x, Zod, @google/gemini-cli  
**Storage**: PostgreSQL (Job table)  
**Testing**: Vitest (integration)  
**Target Platform**: Vercel / GitHub Actions  
**Project Type**: Web application (Next.js)  
**Performance Goals**: N/A (Internal telemetry ingestion)  
**Constraints**: Must maintain Mistral telemetry on batch path.  
**Scale/Scope**: Telemetry ingestion for all Gemini-based jobs.

## Existing Files

| File | Coverage | Action |
|------|----------|--------|
| `app/api/telemetry/v1/logs/route.ts` | Main telemetry ingestion route. Handles OTLP (Claude/Codex) and batch (Mistral/Gemini). | **Extend** to handle `gemini_cli.*` OTLP events. **Remove** Gemini batch reconstruction logic. |
| `.github/scripts/run-agent.sh` | Agent runner script. Invokes Gemini and collects telemetry via scraping. | **Update** to enable native OTLP and remove `stream-json` scraping. |
| `lib/schemas/otlp.ts` | Zod schemas and helpers for OTLP log records. | **Reference** as-is; already supports required structure. |
| `tests/integration/telemetry/agent-agnostic.test.ts` | Integration tests for telemetry route. | **Extend** with Gemini OTLP test cases. |

## Patterns to Follow

### 1. OTLP Event Parsing (`app/api/telemetry/v1/logs/route.ts`)
- **Event Identification**: Use `logRecord.body?.stringValue` or `event.name` attribute.
- **Attribute Extraction**: Use `findAttribute`, `parseIntAttribute`, `parseFloatAttribute` from `@/lib/schemas/otlp`.
- **Merge Strategy**: Use `updateJobMetrics` which handles DELTA/CUMULATIVE merging into the `Job` record.

Example from Claude implementation:
```typescript
if (isClaudeApiRequest) {
  metrics.inputTokens += parseIntAttribute(findAttribute(attrs, 'input_tokens'));
  // ...
  const model = findAttribute(attrs, 'model');
  if (model) metrics.model = String(model);
}
```

### 2. Gemini Cost Estimation (`app/api/telemetry/v1/logs/route.ts`)
- **Pricing Table**: `GEMINI_PRICING` contains per-million token costs for different models.
- **Estimation Helper**: `estimateGeminiCost(model, metrics)` handles tiered pricing (e.g., >200k tokens) and bucket-specific rates.

### 3. Agent Runner Environment (`.github/scripts/run-agent.sh`)
- **Authentication**: `auth_gemini` handles API key or OAuth setup.
- **Invocation**: `gemini` command with flags.
- **Telemetry Environment**: Claude and Codex already use `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_RESOURCE_ATTRIBUTES`. Gemini should follow this.

## Decisions & Rationale

### Decision 1: OTLP Attribute Naming
**Decision**: Use the attribute names specified in FR-006: `gemini_cli.usage.input_tokens`, `gemini_cli.usage.output_tokens`, etc.  
**Rationale**: These match the native emission format of the Gemini CLI when OTLP is enabled.  
**Alternatives**: Mapping them to Claude-style `input_tokens` was considered but using native names in the parser is cleaner and less error-prone.

### Decision 2: Event Names
**Decision**: Handle `gemini_cli.api_response` for usage/metadata and `gemini_cli.tool_call` for tool usage.  
**Rationale**: These are the standard events emitted by the Gemini CLI. `api_response` is terminal for a single request/response cycle and contains the authoritative usage metrics.

### Decision 3: Removal of `stream-json`
**Decision**: Remove `--output-format stream-json` from `run-agent.sh`.  
**Rationale**: OTLP provides the same (and more reliable) data out-of-band. Keeping `stream-json` would be redundant and require maintaining two parsers.

## NEEDS CLARIFICATION
- **Status: RESOLVED** - The exact attribute names and event names have been identified from the feature spec and existing codebase patterns.
