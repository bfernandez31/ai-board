# Implementation Plan: Gemini Telemetry — Switch to Native OTLP

**Branch**: `AIB-629-gemini-telemetry-switch` | **Date**: 2026-04-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/AIB-629-gemini-telemetry-switch/spec.md`

## Summary

Replace Gemini's fragile post-execution batch telemetry mechanism (stream-JSON scraping → jq parsing → curl POST) with native OTLP emission. Gemini CLI already runs in an environment with standard OTEL variables configured; this migration adds a `gemini_cli.*` event handler to the telemetry endpoint, removes the stream-JSON output mode and `collect_gemini_telemetry()` shell function, simplifies the batch handler to Mistral-only, and updates tests and documentation.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), Bash (workflow scripts)
**Primary Dependencies**: Next.js 16, Prisma 6.x, Zod, @google/gemini-cli
**Storage**: PostgreSQL 14+ (via Prisma) — no schema changes
**Testing**: Vitest (integration tests for telemetry endpoint)
**Target Platform**: Linux server (GitHub Actions runners)
**Project Type**: Web application (Next.js App Router)
**Performance Goals**: Telemetry endpoint < 200ms p95 (unchanged)
**Constraints**: Zero regression on Mistral batch telemetry; zero regression on Claude/Codex OTLP
**Scale/Scope**: ~4 files modified, ~1 file simplified, ~6 spec files updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All new code in strict TypeScript; no `any` types |
| II. Component-Driven | PASS | No UI changes — backend telemetry only |
| III. Test-Driven | PASS | Existing integration tests updated to validate OTLP path; Gemini batch tests replaced with OTLP tests |
| IV. Security-First | PASS | Auth unchanged (workflow token); no new input surfaces; Zod validation on all payloads |
| V. Database Integrity | PASS | No schema changes; same fields populated via different path |
| V. Spec Guardrails | PASS | Auto-resolved decisions documented in spec with trade-offs |

**Post-Phase 1 Re-check**: PASS — No constitution violations introduced. Data model unchanged. Batch schema simplification removes complexity rather than adding it.

## Project Structure

### Documentation (this feature)

```
specs/AIB-629-gemini-telemetry-switch/
├── plan.md                                    # This file
├── spec.md                                    # Feature specification
├── research.md                                # Phase 0: research findings
├── data-model.md                              # Phase 1: data model (no changes)
├── contracts/
│   └── telemetry-api.md                       # Phase 1: updated API contract
├── workflows/
│   ├── gemini-native-otlp-emission.md         # Phase 1: emission workflow
│   └── gemini-otlp-intake.md                  # Phase 1: intake workflow
└── tasks.md                                   # Phase 2 output (not yet created)
```

### Source Code (repository root)

```
app/api/telemetry/v1/logs/route.ts             # MODIFY: Add Gemini OTLP handler, simplify batch
.github/scripts/run-agent.sh                   # MODIFY: Remove stream-json, remove collect_gemini_telemetry
tests/integration/telemetry/agent-agnostic.test.ts  # MODIFY: Replace Gemini batch tests with OTLP tests
specs/AIB-626-fix-gemini-telemetry/            # UPDATE: Documentation-only changes
```

**Structure Decision**: Existing Next.js web application structure. All changes are to existing files — no new source files created.

## Implementation Phases

### Phase 1: Telemetry Endpoint — Add Gemini OTLP Handler

**File**: `app/api/telemetry/v1/logs/route.ts`

Add Gemini event detection and processing in the OTLP log record processing loop (after Codex handling, before tool events):

1. Add `isGeminiApiResponse` check: `eventName === 'gemini_cli.api_response'`
2. Parse token attributes: `input_tokens`, `output_tokens`, `thinking_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `duration_ms`, `model`
3. Set `geminiCostModel` on metrics for server-side cost estimation (follows Codex pattern from `route.ts:164-188`)
4. Add `gemini_cli.tool_call` and `gemini_cli.tool_result` to the tool event detection list

**Pattern**: Follow the dispatch-then-estimate pattern from the Codex handler — accumulate tokens, then use `estimateGeminiCost()` via `geminiCostModel` (already supported at `route.ts:333-344`).

### Phase 2: Telemetry Endpoint — Simplify Batch Handler to Mistral-Only

**File**: `app/api/telemetry/v1/logs/route.ts`

1. Remove `agent` field from `batchPayloadSchema` (line 14)
2. Remove `usageSnapshotMode` field from `batchPayloadSchema` (line 25)
3. Remove Gemini input token normalization in `processBatchPayload()` (line 559-562: `if (data.agent === 'GEMINI')`)
4. Remove Gemini cost estimation branch (lines 566-568)
5. Simplify cost estimation to Mistral-only (remove `data.agent !== 'GEMINI'` guard on lines 569-578)
6. Remove `usageSnapshotMode` variable — always use DELTA (remove line 581, change `updateJobMetrics` call to omit merge mode)

### Phase 3: Agent Script — Remove Batch Telemetry Collection

**File**: `.github/scripts/run-agent.sh`

1. In `invoke_gemini()`: Remove `--output-format stream-json` flag, remove `output_file` variable, remove `tee "$output_file"` pipe, remove `GEMINI_STREAM_FILE` export
2. Delete `collect_gemini_telemetry()` function entirely (lines 729-791)
3. In GEMINI dispatch block (lines 816-823): Remove `gemini_exit=0`, `invoke_gemini || gemini_exit=$?`, `collect_gemini_telemetry`, `exit $gemini_exit` — replace with simple `invoke_gemini` (matching Claude dispatch pattern from lines 796-800)

### Phase 4: Tests — Migrate Gemini Tests to OTLP

**File**: `tests/integration/telemetry/agent-agnostic.test.ts`

1. Replace `describe('Gemini native batch telemetry')` test suite with `describe('Gemini native OTLP telemetry')`:
   - Test: Gemini `gemini_cli.api_response` event updates Job with token counts, model, duration, and estimated cost
   - Test: Gemini `gemini_cli.tool_call` / `gemini_cli.tool_result` events add tools to `toolsUsed`
   - Test: Multiple Gemini OTLP batches accumulate correctly (DELTA mode)
   - Test: Gemini OTLP with unsupported model preserves telemetry, cost stays null
   - Test: Gemini cost estimation works for all supported models (2.5 Pro, 2.5 Flash, 2.0 Flash)
2. Verify existing Mistral batch tests pass unchanged (regression protection — FR-009)
3. Verify existing Claude/Codex OTLP tests pass unchanged (regression protection)

### Phase 5: Documentation — Update AIB-626 Specs

**Files**: Under `specs/AIB-626-fix-gemini-telemetry/`

1. Update `spec.md`: Note that the batch approach was replaced by native OTLP in AIB-629
2. Update `contracts/telemetry-api.md`: Mark Gemini batch payload as superseded; reference AIB-629 contract
3. Update `workflows/gemini-native-telemetry-emission.md`: Remove stream-json references; reference AIB-629 workflow
4. Update `workflows/gemini-telemetry-intake.md`: Remove batch normalization; reference AIB-629 intake workflow

## Testing Strategy

Following constitution §III (Test-Driven Development):

| Test Type | File | What to Test |
|-----------|------|-------------|
| Integration | `tests/integration/telemetry/agent-agnostic.test.ts` | **Extend**: Replace Gemini batch tests with OTLP tests; keep all other tests unchanged |

**Decision tree**: Telemetry endpoint involves API calls and database operations → **Vitest integration test** (per constitution rule #3).

**No new test files**: All Gemini telemetry tests already exist in `agent-agnostic.test.ts`. The existing Gemini batch test suite is replaced in-place with OTLP equivalents. Per constitution: "Search existing tests FIRST — extend, don't duplicate."

**Regression coverage**: Existing Claude (T008-T009), Codex (T004-T007), and Mistral batch tests provide regression protection — they must pass unchanged after the migration.

## Complexity Tracking

No constitution violations. No complexity exceptions needed.

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Gemini CLI doesn't emit expected OTLP event names | Verify `gemini_cli.*` prefix against actual CLI output before merging; integration tests validate the handler |
| In-flight Gemini jobs during rollout still use batch | Batch handler still accepts generic payloads; Mistral-only simplification only removes the `agent` discriminator — unrecognized batch payloads still get stored with default DELTA merge |
| OTLP emission fails silently | Job retains null metrics (missing-telemetry state) — same behavior as Claude/Codex when OTLP fails; no silent success fabrication |
