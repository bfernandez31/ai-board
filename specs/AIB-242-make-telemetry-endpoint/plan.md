# Implementation Plan: Make Telemetry Endpoint Agent-Agnostic

**Feature Branch**: `AIB-242-make-telemetry-endpoint`
**Spec**: `specs/AIB-242-make-telemetry-endpoint/spec.md`
**Created**: 2026-03-06

## Technical Context

| Item | Value |
|------|-------|
| Primary file | `app/api/telemetry/v1/logs/route.ts` (246 lines) |
| OTLP schema | `lib/schemas/otlp.ts` |
| Prisma models | Job (telemetry fields), Ticket (agent field) |
| Agent enum | `CLAUDE`, `CODEX` (in `prisma/schema.prisma`) |
| Agent resolution | `resolveEffectiveAgent()` in `lib/workflows/transition.ts` |
| Auth | Bearer token via `WORKFLOW_API_TOKEN` |
| Existing tests | `tests/unit/telemetry/otlp-schema.test.ts`, `tests/unit/comparison/telemetry-extractor.test.ts` |
| Schema changes | None required |
| New dependencies | None required |

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All changes in TypeScript strict mode, no new types needed |
| II. Component-Driven | N/A | No UI changes |
| III. Test-Driven | PASS | Integration tests for API endpoint, unit tests for schema |
| IV. Security-First | PASS | Existing auth + Zod validation unchanged |
| V. Database Integrity | PASS | No schema changes, existing fields reused |
| VI. AI-First Development | PASS | No documentation files at root |

**Gate evaluation**: All gates PASS. No violations.

## Phase 0: Research Summary

All unknowns resolved. See `research.md` for full details.

Key decisions:
1. Codex events use `codex.*` prefix — `codex.api_request` (metrics), `codex.tool.call` (tools)
2. Same OTLP attribute keys as Claude events (input_tokens, output_tokens, etc.)
3. No schema changes — Job fields accommodate both agents
4. `codex.sse_event` and `codex.websocket.request` silently skipped (no metric attributes)
5. Minimal code change: extend if-conditions in route handler

## Phase 1: Design

### Data Model

No changes to Prisma schema. See `data-model.md` for entity details.

- **Job**: Existing telemetry fields (inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, costUsd, durationMs, model, toolsUsed) store metrics from both agents
- **Ticket.agent**: Existing enum field (CLAUDE | CODEX) identifies agent type
- **Agent enum**: Already defined with CLAUDE and CODEX values

### API Contracts

No endpoint changes. See `contracts/telemetry-endpoint.md`.

The POST `/api/telemetry/v1/logs` endpoint accepts the same OTLP format. Only the event name matching logic is extended:

| Event Name | Processing | Status |
|------------|-----------|--------|
| `claude_code.api_request` | Token/cost metrics | Existing |
| `claude_code.tool_result` | Tool tracking | Existing |
| `claude_code.tool_decision` | Tool tracking | Existing |
| `codex.api_request` | Token/cost metrics | **NEW** |
| `codex.tool.call` | Tool tracking | **NEW** |

### Implementation Tasks

#### Task 1: Extend Event Matching in Route Handler
**File**: `app/api/telemetry/v1/logs/route.ts`
**Changes**:
- Line 115: Add `|| eventName === 'codex.api_request'` to the api_request condition
- Line 126: Add `|| eventName === 'codex.tool.call'` to the tool event condition
- Update JSDoc comment to reflect agent-agnostic support

**Requirements covered**: FR-001, FR-002, FR-003, FR-005, FR-006

#### Task 2: Write Integration Tests
**File**: `tests/integration/telemetry/agent-agnostic.test.ts` (new)
**Test cases**:
1. Codex `api_request` event updates Job with correct token/cost metrics
2. Codex `tool.call` event adds tool names to Job's toolsUsed
3. Multiple Codex batches accumulate metrics correctly
4. Claude events still work identically (backward compatibility)
5. Mixed Claude + Codex events in same payload accumulate correctly
6. Unrecognized event names are silently skipped
7. Missing attributes in Codex events default to zero

**Requirements covered**: FR-001 through FR-006, all acceptance scenarios

#### Task 3: Extend Unit Tests for OTLP Schema
**File**: `tests/unit/telemetry/otlp-schema.test.ts` (extend existing)
**Test cases**:
1. OTLP payload with Codex event names validates successfully
2. OTLP payload with mixed Claude + Codex events validates

**Requirements covered**: FR-001, FR-002

#### Task 4: Type-Check and Lint
Run `bun run type-check` and `bun run lint` to verify no regressions.

### Dependency Order

```
Task 1 (route handler) → Task 2 (integration tests) → Task 4 (verify)
                        → Task 3 (unit tests)       → Task 4 (verify)
```

Tasks 2 and 3 can run in parallel after Task 1.

## Phase 2: Post-Design Constitution Re-check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | No new types needed, existing strict mode applies |
| III. Test-Driven | PASS | Integration tests for API (correct layer per Testing Trophy), unit tests for schema |
| IV. Security-First | PASS | No auth changes, Zod validation unchanged, no raw SQL |
| V. Database Integrity | PASS | No schema changes, no migrations |

**All gates PASS.**

## Generated Artifacts

| Artifact | Path |
|----------|------|
| Research | `specs/AIB-242-make-telemetry-endpoint/research.md` |
| Data Model | `specs/AIB-242-make-telemetry-endpoint/data-model.md` |
| API Contract | `specs/AIB-242-make-telemetry-endpoint/contracts/telemetry-endpoint.md` |
| Quickstart | `specs/AIB-242-make-telemetry-endpoint/quickstart.md` |
