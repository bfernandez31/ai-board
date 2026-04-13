# Implementation Plan: Gemini Telemetry OTLP Migration

**Branch**: `AIB-631-gemini-telemetry-switch` | **Date**: 2026-04-13 | **Spec**: `specs/AIB-631-gemini-telemetry-switch/spec.md`

## Summary
Migrate Gemini CLI telemetry from a custom stdout-scraping "batch" mechanism to a native OTLP ingestion path. This improves reliability, simplifies the runner script, and reduces technical debt in the server-side telemetry endpoint.

## Technical Context
- **Language**: TypeScript (Next.js)
- **Primary Dependencies**: @google/gemini-cli, Prisma, Zod
- **Testing**: Vitest integration tests for `/api/telemetry/v1/logs`
- **Key Files**: `app/api/telemetry/v1/logs/route.ts`, `.github/scripts/run-agent.sh`

## Constitution Check

| Gate | Status |
|------|--------|
| TypeScript strict mode | PASS |
| Use existing tests FIRST | PASS (Extending `agent-agnostic.test.ts`) |
| No `any` types | PASS |
| Security (Secrets handling) | PASS (OTEL headers used) |

## Project Structure

### Documentation (this feature)
```
specs/AIB-631-gemini-telemetry-switch/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
└── contracts/
    └── telemetry-api.md # Phase 1 output: OTLP contract
```

## Implementation Phases

### Phase 1: Server-side OTLP Ingestion
1. **Extend `/api/telemetry/v1/logs/route.ts`**:
   - Add matching for `gemini_cli.api_response` and `gemini_cli.tool_call` event names.
   - Extract `gemini_cli.usage.*` attributes.
   - Extract `gemini_cli.model` and `gemini_cli.duration_ms`.
   - Update `gemini_cli.tool_name` extraction.
   - Trigger `estimateGeminiCost` using the extracted model and tokens.
2. **Refactor `processBatchPayload`**:
   - Keep Mistral support.
   - Mark Gemini batch path as DEPRECATED or remove if certain that all clients (the runner script) are updated.

### Phase 2: Agent Runner Update
1. **Update `.github/scripts/run-agent.sh`**:
   - Configure OTEL environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_RESOURCE_ATTRIBUTES`) for Gemini.
   - Invoke `gemini` without `--output-format stream-json`.
   - Remove `collect_gemini_telemetry()` function and its call.
   - Ensure `GEMINI_STREAM_FILE` is no longer needed.

### Phase 3: Validation
1. **Integration Tests**:
   - Add test cases to `tests/integration/telemetry/agent-agnostic.test.ts` for Gemini OTLP events.
   - Verify token accumulation, thinking token support, and cost estimation.
2. **E2E Verification (Manual/CI)**:
   - Run a Gemini job in a simulated CI environment and verify telemetry reaches the DB.

## Testing Strategy
- **File**: `tests/integration/telemetry/agent-agnostic.test.ts`
- **Approach**: Extend existing `Agent-Agnostic Telemetry` describe block with a new section for Gemini OTLP.
- **Scenarios**:
  - Valid `api_response` updates job tokens and cost.
  - `tool_call` updates `toolsUsed`.
  - Multiple events in one payload are merged correctly.
  - Model naming correctly triggers the right pricing bucket.
