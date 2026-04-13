# Implementation Plan: Fix Gemini Telemetry: Native Telemetry Parsing and Cost Estimation

**Branch**: `AIB-626-fix-gemini-telemetry` | **Date**: 2026-04-13 | **Spec**: `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/spec.md`
**Input**: Feature specification from `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/spec.md`

## Summary

Finish Gemini telemetry parity by extending the existing Gemini `stream-json` runner path and centralized telemetry route so Gemini jobs store native usage categories, estimate cost for supported Gemini model families, and appear in analytics through an authoritative supported-agent filter source. The design must preserve Claude/Codex/Mistral behavior, keep unavailable Gemini pricing explicit, and prevent double-counting when Gemini telemetry is partial, delayed, or repeated.

## Technical Context

| Aspect | Detail |
|--------|--------|
| Feature | Fix Gemini native telemetry parsing, category separation, pricing, and analytics filter sourcing |
| Language / Runtime | TypeScript 5.9 strict, Node.js 22.20.0, Bash in GitHub Actions |
| Frameworks | Next.js 16 App Router, Prisma 6.x, React 18, TanStack Query v5, Zod |
| Storage | PostgreSQL 14+ via Prisma `Job` telemetry fields; additive migration required if Gemini thinking tokens need persistent storage |
| Current Gemini path | `.github/scripts/run-agent.sh` captures `stream-json` and posts one Gemini batch payload with `inputTokens`, `outputTokens`, `durationMs`, `toolsUsed`, and `costStatus=UNAVAILABLE` |
| Existing pricing owner | `app/api/telemetry/v1/logs/route.ts` owns server-side OpenAI and Mistral cost estimation |
| Existing analytics source | `lib/analytics/queries.ts` computes available-agent filters from project job history, but still loops over a hardcoded agent list |
| Security | Workflow bearer-token auth, no secret logging, server-side pricing tables only |
| Key constraint | Thinking usage must not be merged into cache or output usage anywhere in storage, display, or pricing |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript-First | PASS | All touched surfaces are strongly typed route, Prisma, analytics, and runner-adjacent modules. |
| II. Component-Driven | PASS | UI impact is limited to existing analytics components and shared agent helpers. |
| III. Test-Driven | PASS | Existing telemetry, analytics, and agent-rule tests already cover this domain and should be extended in place. |
| IV. Security-First | PASS | Workflow auth stays centralized, pricing remains server-owned, and telemetry payloads stay validated before persistence. |
| V. Database Integrity | PASS | If a schema change is needed for thinking tokens, it is additive and localized to telemetry storage; merge/update logic already re-reads the job before update. |
| V. Spec Clarification | PASS | The spec already records auto-resolved decisions and this plan preserves the conservative parity-and-correctness scope. |

**Gate Result**: PASS. Proceed with research and design.

### Post-Design Check

| Gate | Status | Evidence |
|------|--------|----------|
| Route validation before mutation | PASS | Design keeps Gemini inside `POST /api/telemetry/v1/logs` using the existing auth/parse/schema/update flow. |
| No weaker secret handling | PASS | Gemini runner continues restoring auth to `~/.gemini/oauth.json` with restricted permissions and never moves pricing to the client or workflow layer. |
| Existing tests extended first | PASS | Telemetry and analytics work is mapped to existing integration/unit/component files discovered in Phase 0. |
| Unsupported pricing stays explicit | PASS | Cost-unavailable semantics are preserved for unknown Gemini models instead of forcing `0`. |
| Authoritative agent source used | PASS | Analytics option generation is redirected to shared supported-agent definitions rather than a local hardcoded list. |

**Gate Result**: PASS. No blocking violations after design.

## Design Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Research | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/research.md` | Resolved unknowns, existing-file inventory, implementation patterns |
| Data Model | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/data-model.md` | Job telemetry category changes, pricing-rule design, analytics option semantics |
| Telemetry Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/contracts/telemetry-api.md` | Gemini native batch payload and merge rules |
| Analytics Contract | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/contracts/analytics-api.md` | Agent filter and Gemini analytics visibility rules |
| Emission Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/workflows/gemini-native-telemetry-emission.md` | Runner-side native telemetry export contract |
| Intake Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/workflows/gemini-telemetry-intake.md` | Route-side normalization and merge contract |
| Cost Workflow | `/home/runner/work/ai-board/ai-board/target/specs/AIB-626-fix-gemini-telemetry/workflows/gemini-cost-estimation.md` | Gemini model-family pricing and unavailable-cost behavior |

## Implementation Phases

### Phase 1: Native Gemini Telemetry Extraction and Schema Alignment

**Goal**: Extend Gemini runner extraction and storage so native usage categories are captured without conflation.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh`
2. `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`
3. `/home/runner/work/ai-board/ai-board/target/prisma/schema.prisma`

**Pattern requirements**:
- Follow the non-blocking runner reporting pattern from `/home/runner/work/ai-board/ai-board/target/.github/scripts/run-agent.sh:467-507`.
- Follow the route validation-before-mutation pattern from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:61-114`.
- Preserve the additive merge and tool-dedupe behavior from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:257-330`.
- Preserve duration fallback semantics from `/home/runner/work/ai-board/ai-board/target/app/api/jobs/[id]/status/route.ts:231-239`.

**Design notes**:
- Expand Gemini stream parsing beyond `inputTokens` and `outputTokens` to include thinking and cache categories when present.
- If the current `Job` table cannot represent thinking tokens distinctly, add an additive field rather than collapsing categories.
- Keep repeated final-result payloads from double-counting prior Gemini usage.

### Phase 2: Gemini Cost Estimation and Pricing Availability

**Goal**: Add Gemini server-side pricing for supported model families while preserving unavailable-cost visibility for unknown models.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts`
2. `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts`
3. `/home/runner/work/ai-board/ai-board/target/lib/analytics/types.ts`

**Pattern requirements**:
- Follow the existing server-owned pricing pattern from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:338-374`.
- Preserve `costStatus='UNAVAILABLE'` semantics from `/home/runner/work/ai-board/ai-board/target/app/api/telemetry/v1/logs/route.ts:411-424`.

**Design notes**:
- Add Gemini family coverage for 2.5 Pro, 2.5 Flash, and 2.0 Flash.
- Price thinking and cache categories independently.
- Keep Gemini jobs analytics-visible even when price lookup fails.

### Phase 3: Authoritative Analytics Filter Sourcing

**Goal**: Remove manually maintained analytics agent options and derive them from shared supported-agent definitions plus project job history.

**Files to modify**:
1. `/home/runner/work/ai-board/ai-board/target/app/lib/utils/agent-resolution.ts`
2. `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts`
3. `/home/runner/work/ai-board/ai-board/target/lib/analytics/aggregations.ts`
4. `/home/runner/work/ai-board/ai-board/target/app/api/projects/[projectId]/analytics/route.ts`
5. `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx`

**Pattern requirements**:
- Follow effective-agent resolution from `/home/runner/work/ai-board/ai-board/target/lib/analytics/queries.ts:50-68`.
- Keep the server authoritative for filter options as in `/home/runner/work/ai-board/ai-board/target/components/analytics/analytics-dashboard.tsx:150-157`.

**Design notes**:
- Replace the analytics-local hardcoded agent loop with a shared source.
- Ensure Gemini remains filterable when the project has Gemini-backed job history.

### Phase 4: Regression Test Extensions

**Goal**: Extend the existing test suite to cover Gemini native telemetry, Gemini pricing, unavailable-cost handling, authoritative filter sourcing, and non-regression for Claude/Codex/Mistral.

**Test files to extend**:
1. `/home/runner/work/ai-board/ai-board/target/tests/integration/telemetry/agent-agnostic.test.ts`
2. `/home/runner/work/ai-board/ai-board/target/tests/integration/analytics/analytics-route.test.ts`
3. `/home/runner/work/ai-board/ai-board/target/tests/unit/components/analytics-dashboard.test.tsx`
4. `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-resolution.test.ts`
5. `/home/runner/work/ai-board/ai-board/target/tests/unit/agent-schema.test.ts`

**Test intent**:
- Add Gemini cases for thinking/cache separation, repeated-payload protection, and unsupported-model cost unavailability.
- Keep Claude/Codex/Mistral regression assertions in the same telemetry file.
- Add analytics coverage proving options come from the authoritative source and remain history-aware.

## Testing Strategy

- Default to integration tests for telemetry ingestion and analytics route behavior, per constitution section III.
- Extend `/tests/integration/telemetry/agent-agnostic.test.ts` rather than creating a new Gemini-only telemetry suite.
- Extend `/tests/integration/analytics/analytics-route.test.ts` and `/tests/unit/components/analytics-dashboard.test.tsx` for filter behavior rather than duplicating dashboard coverage.
- Add a new test file only if thinking-token persistence introduces a completely separate pure helper with no existing coverage home.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gemini stream-json schema differs from current jq extraction assumptions | Medium | High | Isolate Gemini extraction changes inside `collect_gemini_telemetry()` and cover with route-level integration tests. |
| `Job` schema lacks a thinking-token field | High | High | Use an additive Prisma migration rather than collapsing categories. |
| Repeated Gemini final payloads double-count usage | Medium | High | Add duplicate suppression before the additive merge path. |
| Hardcoded agent lists remain in parallel code paths | Medium | Medium | Centralize agent-option generation on shared supported-agent definitions and cover with analytics tests. |
| Unsupported Gemini models silently appear free | Medium | High | Keep nullable cost plus explicit unavailable-cost semantics. |
